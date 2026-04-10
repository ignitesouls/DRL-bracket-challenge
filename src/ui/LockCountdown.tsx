import { useEffect, useState } from 'react';
import {
  PREDICTIONS_LOCK_AT_MS,
  arePredictionsLocked,
  formatCountdown,
  msUntilLock,
} from '../config/lockTime';

/**
 * Banner above the bracket showing the prediction deadline.
 *
 *  - Before lock: gold strip with a live ticking countdown
 *  - Past lock:   red strip stating that brackets are locked
 *
 * Updates once per second while still pre-lock; stops the interval
 * cleanly the instant the deadline passes.
 */
export function LockCountdown() {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (arePredictionsLocked(now)) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [now]);

  const locked = arePredictionsLocked(now);
  const remaining = msUntilLock(now);

  // Pretty-print the deadline in the viewer's local timezone
  const deadlineLabel = new Date(PREDICTIONS_LOCK_AT_MS).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  return (
    <div
      role="status"
      aria-live={locked ? 'off' : 'polite'}
      className="mb-4"
      style={{
        border: '1px solid',
        borderColor: locked ? 'rgba(255,59,107,0.5)' : 'var(--c-gold)',
        background: locked
          ? 'linear-gradient(180deg, rgba(255,59,107,0.16) 0%, rgba(255,59,107,0.06) 100%)'
          : 'linear-gradient(180deg, rgba(240,185,11,0.14) 0%, rgba(240,185,11,0.04) 100%)',
        borderRadius: 2,
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        flexWrap: 'wrap',
      }}
    >
      <span
        className="font-display"
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.22em',
          textTransform: 'uppercase',
          color: locked ? 'var(--c-red)' : 'var(--c-gold)',
        }}
      >
        {locked ? 'Brackets Locked' : 'Predictions Lock In'}
      </span>

      {!locked && (
        <span
          className="font-mono"
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: 'var(--c-text)',
            letterSpacing: '0.04em',
          }}
        >
          {formatCountdown(remaining)}
        </span>
      )}

      <span
        className="font-mono text-[11px]"
        style={{ color: 'var(--c-text-dim)', marginLeft: 'auto' }}
      >
        {locked ? 'Deadline passed' : 'Deadline'}: {deadlineLabel}
      </span>
    </div>
  );
}
