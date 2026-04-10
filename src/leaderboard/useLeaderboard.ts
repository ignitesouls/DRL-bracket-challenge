import { useCallback, useEffect, useRef, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../auth/supabaseClient';

/**
 * One row in the leaderboard. Mirrors the columns returned by the
 * `get_leaderboard()` SQL function.
 */
export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  twitchHandle: string | null;
  totalPicks: number;
  resolvedCount: number;
  correctCount: number;
  points: number;
}

interface RpcRow {
  user_id: string;
  display_name: string;
  twitch_handle: string | null;
  total_picks: number;
  resolved_count: number;
  correct_count: number;
  points: number;
}

interface UseLeaderboardOptions {
  /** Skip fetching when the panel isn't visible (saves a Supabase request). */
  enabled: boolean;
}

export interface LeaderboardState {
  entries: LeaderboardEntry[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Fetches the public leaderboard via the `get_leaderboard()` SECURITY DEFINER
 * SQL function and re-fetches whenever a match update arrives over realtime
 * (debounced so a flurry of admin updates only triggers one refetch).
 *
 * The hook stays inert until `enabled` is true so the side panel doesn't
 * burn an RPC call before the first match has been resolved.
 */
export function useLeaderboard({ enabled }: UseLeaderboardOptions): LeaderboardState {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounce timer for realtime-triggered refetches.
  const debounceRef = useRef<number | null>(null);

  const fetchOnce = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.rpc('get_leaderboard');
    if (err) {
      // eslint-disable-next-line no-console
      console.error('[leaderboard] rpc failed:', err.message);
      setError(err.message);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as RpcRow[];
    setEntries(
      rows.map((r) => ({
        userId: r.user_id,
        displayName: r.display_name,
        twitchHandle: r.twitch_handle,
        totalPicks: r.total_picks,
        resolvedCount: r.resolved_count,
        correctCount: r.correct_count,
        points: r.points,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured) return;

    let cancelled = false;
    void fetchOnce();

    // Watch the matches table; whenever the admin records or amends a result,
    // schedule a debounced refetch so the leaderboard stays in sync.
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const scheduleRefetch = () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        if (!cancelled) void fetchOnce();
      }, 800);
    };

    const subscribe = () => {
      if (channel) return;
      channel = supabase
        .channel('leaderboard-watch')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'matches' },
          scheduleRefetch
        )
        .subscribe();
    };
    const unsubscribe = () => {
      if (!channel) return;
      supabase.removeChannel(channel);
      channel = null;
    };
    const onVis = () => {
      if (document.visibilityState === 'visible') {
        subscribe();
        // Coming back to the tab — also refetch in case we missed updates.
        void fetchOnce();
      } else {
        unsubscribe();
      }
    };

    if (document.visibilityState === 'visible') subscribe();
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelled = true;
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      document.removeEventListener('visibilitychange', onVis);
      unsubscribe();
    };
  }, [enabled, fetchOnce]);

  return { entries, loading, error, refetch: fetchOnce };
}
