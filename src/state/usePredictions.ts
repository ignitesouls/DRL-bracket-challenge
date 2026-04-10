import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../auth/supabaseClient';
import { buildInitialMatches } from '../bracket/bracketData';
import { applyMatchResult } from '../bracket/engine';
import type { Match, Player } from '../bracket/types';
import {
  PREDICTIONS_LOCK_AT_MS,
  arePredictionsLocked,
} from '../config/lockTime';

/**
 * Per-user predictions hook.
 *
 * Backed by the `predictions` table (RLS: anyone can read, only own
 * row can be written). The user's predictions are stored as a flat
 * map of matchId → predictedWinnerId, but the *view* of those
 * predictions is built by running the bracket engine over the player
 * roster — the same engine the live bracket uses — so the cascade
 * works exactly the same way (downstream picks auto-clear when an
 * upstream pick changes).
 *
 * If Supabase isn't configured (or the user is logged out) the hook
 * runs in pure local memory so the UI is still interactive.
 */

export interface PredictionRow {
  id: string;
  user_id: string;
  match_id: string;
  predicted_winner_id: string;
}

interface UsePredictionsOptions {
  userId: string | null;
  players: Player[];
  liveMatches: Match[];
}

export interface PredictionsState {
  /** Map<matchId, predictedWinnerId> for raw stored picks. */
  predictionMap: Map<string, string>;
  /** Bracket of 46 matches with the user's picks propagated through. */
  predictedMatches: Match[];
  /** Match IDs whose actual status is live or completed → predictions are locked. */
  lockedMatchIds: Set<string>;
  /** Total picks the user has made for matches that are now resolved. */
  resolvedCount: number;
  /** How many of the resolved picks turned out correct. */
  correctCount: number;
  loading: boolean;
  error: string | null;
  /** True once the global prediction deadline has passed. */
  globallyLocked: boolean;
  /** Save (or update) a prediction. Cascade-clears stale downstream picks. */
  setPrediction: (matchId: string, predictedWinnerId: string) => Promise<void>;
  /** Wipe all of the user's predictions. */
  clearAllPredictions: () => Promise<void>;
}

export function usePredictions({
  userId,
  players,
  liveMatches,
}: UsePredictionsOptions): PredictionsState {
  const [rawPredictions, setRawPredictions] = useState<Map<string, string>>(
    () => new Map()
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rawRef = useRef(rawPredictions);
  useEffect(() => {
    rawRef.current = rawPredictions;
  }, [rawPredictions]);

  // Live-tick the global lock so the UI flips at the deadline without
  // needing a page refresh. We schedule a single timeout for the exact
  // remaining duration (capped) and re-arm after it fires.
  const [globallyLocked, setGloballyLocked] = useState<boolean>(() =>
    arePredictionsLocked()
  );
  useEffect(() => {
    if (globallyLocked) return;
    const remaining = PREDICTIONS_LOCK_AT_MS - Date.now();
    if (remaining <= 0) {
      setGloballyLocked(true);
      return;
    }
    // Cap at ~24 days so a faraway deadline still gets a periodic check.
    const wait = Math.min(remaining + 50, 2_000_000_000);
    const id = window.setTimeout(() => setGloballyLocked(arePredictionsLocked()), wait);
    return () => window.clearTimeout(id);
  }, [globallyLocked]);

  // -------------------------------------------------------------------------
  // Initial fetch + realtime subscription (own predictions only)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isSupabaseConfigured || !userId) {
      // Logged out — clear any in-memory predictions from a previous session
      setRawPredictions(new Map());
      return;
    }

    let cancelled = false;
    setLoading(true);

    supabase
      .from('predictions')
      .select('*')
      .eq('user_id', userId)
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          // eslint-disable-next-line no-console
          console.error('[predictions] load failed:', err.message);
          setError(err.message);
          setLoading(false);
          return;
        }
        const map = new Map<string, string>();
        for (const row of (data ?? []) as PredictionRow[]) {
          map.set(row.match_id, row.predicted_winner_id);
        }
        setRawPredictions(map);
        setLoading(false);
      });

    let channel: ReturnType<typeof supabase.channel> | null = null;

    const buildChannel = () =>
      supabase
        .channel(`predictions-${userId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'predictions',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            if (payload.eventType === 'DELETE') {
              const old = payload.old as Partial<PredictionRow>;
              if (!old.match_id) return;
              setRawPredictions((prev) => {
                const next = new Map(prev);
                next.delete(old.match_id!);
                return next;
              });
              return;
            }
            const row = payload.new as PredictionRow;
            if (!row?.match_id) return;
            setRawPredictions((prev) => {
              const next = new Map(prev);
              next.set(row.match_id, row.predicted_winner_id);
              return next;
            });
          }
        )
        .subscribe();

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

    if (document.visibilityState === 'visible') subscribe();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      unsubscribe();
    };
  }, [userId]);

  // -------------------------------------------------------------------------
  // Derived: predicted bracket
  // -------------------------------------------------------------------------
  const predictedMatches = useMemo(
    () => derivePredictedBracket(players, rawPredictions),
    [players, rawPredictions]
  );

  // -------------------------------------------------------------------------
  // Locked match IDs.
  //
  //  - Per-match locks: any live or completed match (admin already started it)
  //  - Global lock: every match once the prediction deadline has passed.
  //    We pull match IDs off the user's predicted bracket so the locked set
  //    covers the full 46-match grid even if the live bracket isn't fully
  //    populated yet.
  // -------------------------------------------------------------------------
  const lockedMatchIds = useMemo(() => {
    const set = new Set<string>();
    for (const m of liveMatches) {
      if (m.status === 'live' || m.status === 'completed') set.add(m.id);
    }
    if (globallyLocked) {
      for (const m of liveMatches) set.add(m.id);
    }
    return set;
  }, [liveMatches, globallyLocked]);

  // -------------------------------------------------------------------------
  // Accuracy: pick was correct iff actual.winnerId === prediction
  // -------------------------------------------------------------------------
  const { resolvedCount, correctCount } = useMemo(() => {
    let resolved = 0;
    let correct = 0;
    for (const m of liveMatches) {
      if (!m.winnerId) continue;
      const pick = rawPredictions.get(m.id);
      if (!pick) continue;
      resolved += 1;
      if (pick === m.winnerId) correct += 1;
    }
    return { resolvedCount: resolved, correctCount: correct };
  }, [liveMatches, rawPredictions]);

  // -------------------------------------------------------------------------
  // Write helpers
  // -------------------------------------------------------------------------
  const setPrediction = useCallback(
    async (matchId: string, predictedWinnerId: string) => {
      // Hard cutoff: nothing changes after the global deadline. RLS
      // enforces this server-side too, this is the friendly client guard.
      if (arePredictionsLocked()) return;

      // Don't allow predictions on already-locked matches
      if (lockedMatchIds.has(matchId)) return;

      // No-op if the user clicked the player they already picked.
      if (rawRef.current.get(matchId) === predictedWinnerId) return;

      // 1. Apply the pick to the current predicted bracket via the engine
      const currentBracket = derivePredictedBracket(players, rawRef.current);
      let nextBracket: Match[];
      try {
        nextBracket = applyMatchResult(
          currentBracket,
          matchId,
          predictedWinnerId,
          null
        );
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn('[predictions] applyMatchResult failed:', err);
        return;
      }

      // 2. Build the new prediction map from the resulting bracket state
      const nextMap = new Map<string, string>();
      for (const m of nextBracket) {
        if (m.winnerId) nextMap.set(m.id, m.winnerId);
      }

      // 3. Diff: which IDs were added/changed vs removed?
      const prevMap = rawRef.current;
      const upserts: Array<{ match_id: string; predicted_winner_id: string }> = [];
      for (const [mid, wid] of nextMap.entries()) {
        if (prevMap.get(mid) !== wid) upserts.push({ match_id: mid, predicted_winner_id: wid });
      }
      const deletes: string[] = [];
      for (const mid of prevMap.keys()) {
        if (!nextMap.has(mid)) deletes.push(mid);
      }

      // 4. Optimistic local update
      setRawPredictions(nextMap);

      // 5. Persist (only if logged in via Supabase)
      if (!isSupabaseConfigured || !userId) return;

      try {
        if (deletes.length > 0) {
          const { error: delErr } = await supabase
            .from('predictions')
            .delete()
            .eq('user_id', userId)
            .in('match_id', deletes);
          if (delErr) throw delErr;
        }
        if (upserts.length > 0) {
          const rows = upserts.map((u) => ({
            user_id: userId,
            match_id: u.match_id,
            predicted_winner_id: u.predicted_winner_id,
          }));
          const { error: upErr } = await supabase
            .from('predictions')
            .upsert(rows, { onConflict: 'user_id,match_id' });
          if (upErr) throw upErr;
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('[predictions] save failed:', err);
        setError((err as Error)?.message ?? 'Save failed');
        // Roll back optimistic update
        setRawPredictions(prevMap);
      }
    },
    [players, userId, lockedMatchIds]
  );

  const clearAllPredictions = useCallback(async () => {
    if (arePredictionsLocked()) return;
    const prev = rawRef.current;
    setRawPredictions(new Map());
    if (!isSupabaseConfigured || !userId) return;
    const { error: err } = await supabase
      .from('predictions')
      .delete()
      .eq('user_id', userId);
    if (err) {
      // eslint-disable-next-line no-console
      console.error('[predictions] clear failed:', err.message);
      setError(err.message);
      setRawPredictions(prev);
    }
  }, [userId]);

  return {
    predictionMap: rawPredictions,
    predictedMatches,
    lockedMatchIds,
    resolvedCount,
    correctCount,
    loading,
    error,
    globallyLocked,
    setPrediction,
    clearAllPredictions,
  };
}

// ---------------------------------------------------------------------------
// derivePredictedBracket
// ---------------------------------------------------------------------------
/**
 * Build a fully-propagated bracket from the user's raw prediction map.
 *
 * Walks matches in topological order (W1..W15, L1..L30, GF) and applies
 * any prediction whose match has both player slots filled and whose
 * picked winner is one of the two slot occupants.
 */
function derivePredictedBracket(
  players: Player[],
  predictions: Map<string, string>
): Match[] {
  if (players.length === 0) return [];

  let bracket = buildInitialMatches(players);
  const order = topologicalOrder();

  for (const matchId of order) {
    const pick = predictions.get(matchId);
    if (!pick) continue;
    const m = bracket.find((x) => x.id === matchId);
    if (!m) continue;
    if (!m.player1Id || !m.player2Id) continue;
    if (pick !== m.player1Id && pick !== m.player2Id) continue; // stale pick
    try {
      bracket = applyMatchResult(bracket, matchId, pick, null);
    } catch {
      // Skip any prediction that fails to apply (shouldn't happen given guards)
    }
  }

  return bracket;
}

function topologicalOrder(): string[] {
  const order: string[] = [];
  for (let i = 1; i <= 15; i++) order.push(`W${i}`);
  for (let i = 1; i <= 30; i++) order.push(`L${i}`);
  order.push('GF');
  return order;
}
