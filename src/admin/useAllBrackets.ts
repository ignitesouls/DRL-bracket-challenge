import { useCallback, useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../auth/supabaseClient';

/**
 * One submitted bracket, normalized from the `get_all_brackets()` RPC.
 * `picks` is already a Map so callers can feed it straight into
 * `derivePredictedBracket`.
 */
export interface BracketEntry {
  userId: string;
  displayName: string;
  twitchHandle: string | null;
  picks: Map<string, string>;
  submittedAt: string | null;
  totalPicks: number;
}

interface RpcRow {
  user_id: string;
  display_name: string;
  twitch_handle: string | null;
  picks: Record<string, string> | null;
  submitted_at: string | null;
  total_picks: number;
}

interface UseAllBracketsOptions {
  /**
   * Hook stays inert until this is true. Usually wired to
   * `isAdmin && globallyLocked` so we never make the RPC call before
   * the deadline (the function would 403 anyway, this just avoids a
   * wasted roundtrip and a noisy console error).
   */
  enabled: boolean;
}

export interface AllBracketsState {
  entries: BracketEntry[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Fetches every submitted bracket via the admin-only `get_all_brackets()`
 * SECURITY DEFINER SQL function. The function itself enforces:
 *   - caller must be an admin
 *   - global prediction deadline must have passed
 * so a non-admin (or a too-early admin) will get a 403-ish error and an
 * empty entry list.
 *
 * No realtime subscription — brackets don't change after the lock.
 */
export function useAllBrackets({ enabled }: UseAllBracketsOptions): AllBracketsState {
  const [entries, setEntries] = useState<BracketEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOnce = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setEntries([]);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.rpc('get_all_brackets');
    if (err) {
      // eslint-disable-next-line no-console
      console.error('[all-brackets] rpc failed:', err.message);
      setError(err.message);
      setEntries([]);
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as RpcRow[];
    setEntries(
      rows.map((r) => {
        const picks = new Map<string, string>();
        for (const [matchId, winnerId] of Object.entries(r.picks ?? {})) {
          picks.set(matchId, winnerId);
        }
        return {
          userId: r.user_id,
          displayName: r.display_name,
          twitchHandle: r.twitch_handle,
          picks,
          submittedAt: r.submitted_at,
          totalPicks: r.total_picks,
        };
      }),
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void fetchOnce();
  }, [enabled, fetchOnce]);

  return { entries, loading, error, refetch: fetchOnce };
}
