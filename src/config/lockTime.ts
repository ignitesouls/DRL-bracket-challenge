/**
 * Prediction lock cutoff.
 *
 * After this moment, users can no longer create / edit / delete their
 * bracket predictions. Locked picks remain visible (so users can watch
 * how their bracket fares against the live results) but every match
 * card is rendered in the locked state.
 *
 * IMPORTANT: change this constant in ONE place if the deadline moves.
 * The same value is also enforced server-side by the predictions RLS
 * policies (see supabase/migrations/001_initial_schema.sql) — if you
 * shift the deadline here, update the SQL migration too and re-run it.
 *
 * Time chosen: Sunday April 12, 2026 — 8:00 AM Pacific.
 *
 * April 12 falls inside US Daylight Saving Time (DST starts March 8,
 * 2026), so 8 AM Pacific local clock time === 8 AM PDT === UTC-7 ===
 * 15:00 UTC. (The user requested "8 AM PST", which we interpret as
 * Pacific local time; in April that's PDT / UTC-7.)
 */
export const PREDICTIONS_LOCK_AT_ISO = '2026-04-12T08:00:00-07:00';

export const PREDICTIONS_LOCK_AT_MS = Date.parse(PREDICTIONS_LOCK_AT_ISO);

/** True if the global prediction deadline has already passed. */
export function arePredictionsLocked(now: number = Date.now()): boolean {
  return now >= PREDICTIONS_LOCK_AT_MS;
}

/** Milliseconds remaining until lock; zero if already locked. */
export function msUntilLock(now: number = Date.now()): number {
  return Math.max(0, PREDICTIONS_LOCK_AT_MS - now);
}

/**
 * Format a duration as `Dd HHh MMm SSs`, dropping leading zero units.
 * Used by the countdown banner.
 */
export function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Locked';
  const totalSec = Math.floor(ms / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  if (days > 0) return `${days}d ${pad(hours)}h ${pad(minutes)}m`;
  if (hours > 0) return `${hours}h ${pad(minutes)}m ${pad(seconds)}s`;
  if (minutes > 0) return `${minutes}m ${pad(seconds)}s`;
  return `${seconds}s`;
}
