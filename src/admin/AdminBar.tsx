import { useState } from 'react';
import type { BracketMode } from '../state/useBracketState';

interface AdminBarProps {
  mode: BracketMode;
  errorMessage: string | null;
  hasPlayers: boolean;
  hasMatches: boolean;
  onSeedPlayers: () => Promise<void>;
  onInitializeBracket: () => Promise<void>;
  onResetBracket: () => Promise<void>;
}

/**
 * Top-of-page admin control strip. Shown only to logged-in admins.
 *
 * Surfaces the current sync mode, exposes one-shot DB seeding actions,
 * and provides a destructive reset for re-running the bracket from scratch.
 */
export function AdminBar({
  mode,
  errorMessage,
  hasPlayers,
  hasMatches,
  onSeedPlayers,
  onInitializeBracket,
  onResetBracket,
}: AdminBarProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const wrap = (key: string, fn: () => Promise<void>) => async () => {
    setBusy(key);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="mb-6"
      style={{
        background: 'linear-gradient(180deg, #16182d 0%, #0e0f1d 100%)',
        border: '1px solid var(--c-border)',
        borderRadius: 3,
        padding: '12px 16px',
        position: 'relative',
      }}
    >
      {/* Gold accent bar */}
      <div
        className="absolute left-0 top-0 bottom-0"
        style={{ width: 3, background: 'var(--c-gold)' }}
      />

      <div className="flex items-center justify-between flex-wrap gap-3 pl-3">
        <div className="flex items-center gap-4">
          <div>
            <div className="section-eyebrow">Admin Console</div>
            <div className="flex items-center gap-2 mt-0.5">
              <ModeBadge mode={mode} />
              {errorMessage && (
                <span
                  className="font-mono text-xs"
                  style={{ color: 'var(--c-red)' }}
                >
                  {errorMessage}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!hasPlayers && (
            <button
              onClick={wrap('seed', onSeedPlayers)}
              disabled={busy !== null}
              className="btn"
            >
              {busy === 'seed' ? 'Seeding…' : 'Seed Players (32)'}
            </button>
          )}

          {hasPlayers && !hasMatches && (
            <button
              onClick={wrap('init', onInitializeBracket)}
              disabled={busy !== null}
              className="btn"
              style={{
                background: 'var(--c-gold)',
                color: '#000',
                borderColor: 'var(--c-gold)',
              }}
            >
              {busy === 'init' ? 'Building…' : 'Initialize Bracket'}
            </button>
          )}

          {hasMatches && (
            <>
              {!confirmReset ? (
                <button
                  onClick={() => setConfirmReset(true)}
                  className="btn btn--ghost"
                  style={{
                    borderColor: 'rgba(255,59,107,0.3)',
                    color: 'var(--c-red)',
                  }}
                >
                  Reset Bracket
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span
                    className="font-mono text-xs"
                    style={{ color: 'var(--c-text-dim)' }}
                  >
                    Wipe all results?
                  </span>
                  <button
                    onClick={async () => {
                      await wrap('reset', onResetBracket)();
                      setConfirmReset(false);
                    }}
                    disabled={busy !== null}
                    className="btn"
                    style={{
                      background: 'var(--c-red)',
                      color: '#fff',
                      borderColor: 'var(--c-red)',
                    }}
                  >
                    {busy === 'reset' ? 'Resetting…' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => setConfirmReset(false)}
                    className="btn btn--ghost"
                    disabled={busy !== null}
                  >
                    Cancel
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
function ModeBadge({ mode }: { mode: BracketMode }) {
  const { label, color, dot } = MODE_STYLES[mode];
  return (
    <span
      className="inline-flex items-center gap-2 font-mono"
      style={{
        fontSize: 11,
        padding: '3px 8px',
        border: `1px solid ${color}`,
        borderRadius: 2,
        color,
        textTransform: 'uppercase',
        letterSpacing: '0.12em',
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          background: dot,
          boxShadow: `0 0 6px ${dot}`,
        }}
      />
      {label}
    </span>
  );
}

const MODE_STYLES: Record<BracketMode, { label: string; color: string; dot: string }> = {
  local: {
    label: 'Local Preview',
    color: 'rgba(245,246,251,0.4)',
    dot: 'rgba(245,246,251,0.5)',
  },
  loading: {
    label: 'Loading',
    color: 'rgba(76,224,255,0.6)',
    dot: 'rgba(76,224,255,0.8)',
  },
  empty: {
    label: 'DB Empty · Needs Init',
    color: 'rgba(240,185,11,0.7)',
    dot: 'var(--c-gold)',
  },
  connected: {
    label: 'Live · Realtime On',
    color: 'rgba(76,224,255,0.8)',
    dot: 'var(--c-cyan)',
  },
  error: {
    label: 'DB Error · Local Fallback',
    color: 'var(--c-red)',
    dot: 'var(--c-red)',
  },
};
