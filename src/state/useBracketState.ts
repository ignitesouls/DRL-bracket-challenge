import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../auth/supabaseClient';
import { buildInitialMatches } from '../bracket/bracketData';
import { applyMatchResult, clearMatchResult } from '../bracket/engine';
import { PLACEHOLDER_PLAYERS } from '../bracket/players';
import type { Match, MatchStatus, Player } from '../bracket/types';
import {
  diffMatches,
  matchToRow,
  playerToInsertRow,
  rowToMatch,
  rowToPlayer,
  type MatchRow,
  type PlayerRow,
} from './matchSync';

/**
 * Connection / persistence mode for the bracket.
 *
 *  - 'local'      : no Supabase env vars; running in pure preview mode
 *  - 'loading'    : initial DB fetch in flight
 *  - 'empty'      : DB reachable but no players seeded yet
 *  - 'connected'  : live, subscribed to realtime updates
 *  - 'error'      : DB call failed; we fell back to local placeholders
 */
export type BracketMode = 'local' | 'loading' | 'empty' | 'connected' | 'error';

export interface BracketState {
  mode: BracketMode;
  errorMessage: string | null;
  players: Player[];
  matches: Match[];
  playerById: Map<string, Player>;
}

export interface AdminActions {
  /** Pick the winner of a match (with optional score) and propagate downstream. */
  setMatchWinner: (matchId: string, winnerId: string, score: string | null) => Promise<void>;
  /** Clear a match result and cascade-clear downstream. */
  clearMatch: (matchId: string) => Promise<void>;
  /** Toggle a match's lifecycle status (pending / live / completed). */
  setMatchStatus: (matchId: string, status: MatchStatus) => Promise<void>;
  /** Insert the placeholder roster into the players table. */
  seedPlayers: () => Promise<void>;
  /** Build all 46 matches from the current player roster and upsert. */
  initializeBracket: () => Promise<void>;
  /** Wipe all matches and re-initialize with empty slots. */
  resetBracket: () => Promise<void>;
}

interface UseBracketStateOptions {
  /** Whether the current user has admin privileges (for write actions). */
  isAdmin: boolean;
}

/**
 * Single source of truth for bracket data.
 *
 * Behaviour:
 *  - If Supabase is not configured, runs in `local` mode using placeholder
 *    players and lets the admin pick winners purely client-side.
 *  - Otherwise loads players + matches from DB, subscribes to Realtime,
 *    and routes admin writes through Supabase. The realtime subscription
 *    pushes updates back into local state for all viewers in real time.
 */
export function useBracketState({ isAdmin }: UseBracketStateOptions): BracketState & AdminActions {
  const [mode, setMode] = useState<BracketMode>(isSupabaseConfigured ? 'loading' : 'local');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>(() =>
    isSupabaseConfigured ? [] : PLACEHOLDER_PLAYERS
  );
  const [matches, setMatches] = useState<Match[]>(() =>
    isSupabaseConfigured ? [] : buildInitialMatches(PLACEHOLDER_PLAYERS)
  );

  // Most recent matches snapshot, kept in a ref so async actions can diff
  // against the current state without re-binding callbacks on every render.
  const matchesRef = useRef<Match[]>(matches);
  useEffect(() => {
    matchesRef.current = matches;
  }, [matches]);

  // Guard against concurrent admin button presses. The admin UI buttons
  // check this before firing, so a double-click won't issue two seed
  // / initialize / reset writes back to back.
  const busyRef = useRef(false);

  const playerById = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players]
  );

  // -------------------------------------------------------------------------
  // Initial fetch + realtime subscription
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    let cancelled = false;

    const load = async () => {
      try {
        const [{ data: playerRows, error: pErr }, { data: matchRows, error: mErr }] =
          await Promise.all([
            supabase.from('players').select('*').order('seed'),
            supabase.from('matches').select('*'),
          ]);

        if (cancelled) return;
        if (pErr) throw pErr;
        if (mErr) throw mErr;

        const ps = (playerRows ?? []).map((r) => rowToPlayer(r as PlayerRow));
        const ms = (matchRows ?? []).map((r) => rowToMatch(r as MatchRow));
        setPlayers(ps);
        setMatches(ms);
        setMode(ps.length === 0 || ms.length === 0 ? 'empty' : 'connected');
      } catch (err) {
        if (cancelled) return;
        // eslint-disable-next-line no-console
        console.error('[bracket] load failed:', err);
        setErrorMessage((err as Error)?.message ?? String(err));
        setMode('error');
        // Fall back to local placeholders so the UI still renders something
        setPlayers(PLACEHOLDER_PLAYERS);
        setMatches(buildInitialMatches(PLACEHOLDER_PLAYERS));
      }
    };

    load();

    // Pause realtime when the tab is hidden so we don't hold a connection
    // open for idle viewers (Supabase free tier caps concurrent connections).
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const subscribe = () => {
      if (channel) return;
      channel = buildChannel();
    };
    const unsubscribe = () => {
      if (!channel) return;
      supabase.removeChannel(channel);
      channel = null;
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') subscribe();
      else unsubscribe();
    };

    function buildChannel() {
      return supabase
        .channel('drl-bracket')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const old = payload.old as Partial<MatchRow>;
            if (!old.id) return;
            setMatches((prev) => prev.filter((m) => m.id !== old.id));
            return;
          }
          const row = payload.new as MatchRow;
          if (!row?.id) return;
          const updated = rowToMatch(row);
          setMatches((prev) => {
            const idx = prev.findIndex((m) => m.id === updated.id);
            if (idx === -1) return [...prev, updated];
            const copy = prev.slice();
            copy[idx] = updated;
            return copy;
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'players' },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const old = payload.old as Partial<PlayerRow>;
            if (!old.id) return;
            setPlayers((prev) => prev.filter((p) => p.id !== old.id));
            return;
          }
          const row = payload.new as PlayerRow;
          if (!row?.id) return;
          const p = rowToPlayer(row);
          setPlayers((prev) => {
            const idx = prev.findIndex((x) => x.id === p.id);
            if (idx === -1) return [...prev, p].sort((a, b) => a.seed - b.seed);
            const copy = prev.slice();
            copy[idx] = p;
            return copy;
          });
        }
      )
      .subscribe();
    }

    if (document.visibilityState === 'visible') subscribe();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      unsubscribe();
    };
  }, []);

  // When players appear and matches don't, flip to 'empty' so admin can init
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    if (mode === 'loading') return;
    if (players.length > 0 && matches.length === 0) setMode('empty');
    if (players.length > 0 && matches.length > 0 && mode !== 'connected') setMode('connected');
  }, [players, matches, mode]);

  // -------------------------------------------------------------------------
  // Write helpers
  // -------------------------------------------------------------------------
  /** Apply a transformation locally; if connected, also push the diff to DB. */
  const applyAndSync = useCallback(
    async (next: Match[]) => {
      const prev = matchesRef.current;
      const changed = diffMatches(prev, next);
      // Optimistic local update first — realtime will reconcile
      setMatches(next);
      if (!isSupabaseConfigured || mode === 'local' || mode === 'error') return;
      if (changed.length === 0) return;
      const { error } = await supabase
        .from('matches')
        .upsert(changed.map(matchToRow), { onConflict: 'id' });
      if (error) {
        // eslint-disable-next-line no-console
        console.error('[bracket] upsert failed:', error.message);
        setErrorMessage(error.message);
        // Roll back optimistic update
        setMatches(prev);
        throw error;
      }
    },
    [mode]
  );

  const setMatchWinner = useCallback(
    async (matchId: string, winnerId: string, score: string | null) => {
      if (!isAdmin && isSupabaseConfigured) return; // RLS would reject anyway
      const next = applyMatchResult(matchesRef.current, matchId, winnerId, score);
      await applyAndSync(next);
    },
    [isAdmin, applyAndSync]
  );

  const clearMatch = useCallback(
    async (matchId: string) => {
      if (!isAdmin && isSupabaseConfigured) return;
      const next = clearMatchResult(matchesRef.current, matchId);
      await applyAndSync(next);
    },
    [isAdmin, applyAndSync]
  );

  const setMatchStatus = useCallback(
    async (matchId: string, status: MatchStatus) => {
      if (!isAdmin && isSupabaseConfigured) return;
      const next = matchesRef.current.map((m) =>
        m.id === matchId ? { ...m, status } : m
      );
      await applyAndSync(next);
    },
    [isAdmin, applyAndSync]
  );

  const seedPlayers = useCallback(async () => {
    if (busyRef.current) return;
    if (!isSupabaseConfigured) {
      setPlayers(PLACEHOLDER_PLAYERS);
      return;
    }
    if (!isAdmin) return;
    busyRef.current = true;
    try {
      const rows = PLACEHOLDER_PLAYERS.map(playerToInsertRow);
      const { data, error } = await supabase.from('players').insert(rows).select('*');
      if (error) {
        // eslint-disable-next-line no-console
        console.error('[bracket] seedPlayers failed:', error.message);
        setErrorMessage(error.message);
        throw error;
      }
      const ps = (data ?? []).map((r) => rowToPlayer(r as PlayerRow));
      setPlayers(ps);
    } finally {
      busyRef.current = false;
    }
  }, [isAdmin]);

  const initializeBracket = useCallback(async () => {
    if (busyRef.current) return;
    const ps = players.length > 0 ? players : PLACEHOLDER_PLAYERS;
    const fresh = buildInitialMatches(ps);
    if (!isSupabaseConfigured) {
      setMatches(fresh);
      return;
    }
    if (!isAdmin) return;
    busyRef.current = true;
    try {
      const { error } = await supabase
        .from('matches')
        .upsert(fresh.map(matchToRow), { onConflict: 'id' });
      if (error) {
        // eslint-disable-next-line no-console
        console.error('[bracket] initializeBracket failed:', error.message);
        setErrorMessage(error.message);
        throw error;
      }
      setMatches(fresh);
      setMode('connected');
    } finally {
      busyRef.current = false;
    }
  }, [players, isAdmin]);

  const resetBracket = useCallback(async () => {
    if (busyRef.current) return;
    const ps = players.length > 0 ? players : PLACEHOLDER_PLAYERS;
    const fresh = buildInitialMatches(ps);
    if (!isSupabaseConfigured) {
      setMatches(fresh);
      return;
    }
    if (!isAdmin) return;
    busyRef.current = true;
    try {
      // Upsert all 46 with cleared state
      const { error } = await supabase
        .from('matches')
        .upsert(fresh.map(matchToRow), { onConflict: 'id' });
      if (error) {
        // eslint-disable-next-line no-console
        console.error('[bracket] resetBracket failed:', error.message);
        setErrorMessage(error.message);
        throw error;
      }
      setMatches(fresh);
    } finally {
      busyRef.current = false;
    }
  }, [players, isAdmin]);

  return {
    mode,
    errorMessage,
    players,
    matches,
    playerById,
    setMatchWinner,
    clearMatch,
    setMatchStatus,
    seedPlayers,
    initializeBracket,
    resetBracket,
  };
}
