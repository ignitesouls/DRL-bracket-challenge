import { useEffect, useState } from 'react';
import type { Match, MatchStatus, Player } from '../bracket/types';

interface MatchEditorProps {
  match: Match;
  player1: Player | null;
  player2: Player | null;
  onClose: () => void;
  onSave: (matchId: string, winnerId: string, score: string | null) => Promise<void>;
  onClear: (matchId: string) => Promise<void>;
  onSetStatus: (matchId: string, status: MatchStatus) => Promise<void>;
  onSetSchedule: (matchId: string, scheduledAt: string | null) => Promise<void>;
}

/**
 * Admin-only modal for editing a single match. Lets the admin pick a winner,
 * enter a score, toggle the live/pending/completed status, or clear the
 * result entirely. Saving cascades downstream via the bracket engine.
 */
export function MatchEditor({
  match,
  player1,
  player2,
  onClose,
  onSave,
  onClear,
  onSetStatus,
  onSetSchedule,
}: MatchEditorProps) {
  const [winnerId, setWinnerId] = useState<string | null>(match.winnerId);
  const [score, setScore] = useState<string>(match.score ?? '');
  const [scheduleLocal, setScheduleLocal] = useState<string>(() =>
    isoToLocalInputValue(match.scheduledAt)
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-sync local state if the match prop changes (e.g. realtime update)
  useEffect(() => {
    setWinnerId(match.winnerId);
    setScore(match.score ?? '');
    setScheduleLocal(isoToLocalInputValue(match.scheduledAt));
  }, [match.id, match.winnerId, match.score, match.scheduledAt]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const ready = !!(player1 && player2);

  const handleSave = async () => {
    if (!winnerId) {
      setError('Pick a winner first');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(match.id, winnerId, score.trim() || null);
      onClose();
    } catch (err) {
      setError((err as Error)?.message ?? 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  const handleClear = async () => {
    setBusy(true);
    setError(null);
    try {
      await onClear(match.id);
      onClose();
    } catch (err) {
      setError((err as Error)?.message ?? 'Clear failed');
    } finally {
      setBusy(false);
    }
  };

  const handleStatus = async (status: MatchStatus) => {
    setBusy(true);
    setError(null);
    try {
      await onSetStatus(match.id, status);
    } catch (err) {
      setError((err as Error)?.message ?? 'Status update failed');
    } finally {
      setBusy(false);
    }
  };

  const handleScheduleSave = async () => {
    setBusy(true);
    setError(null);
    try {
      const iso = localInputValueToIso(scheduleLocal);
      await onSetSchedule(match.id, iso);
    } catch (err) {
      setError((err as Error)?.message ?? 'Schedule update failed');
    } finally {
      setBusy(false);
    }
  };

  const handleScheduleClear = async () => {
    setBusy(true);
    setError(null);
    try {
      await onSetSchedule(match.id, null);
      setScheduleLocal('');
    } catch (err) {
      setError((err as Error)?.message ?? 'Schedule clear failed');
    } finally {
      setBusy(false);
    }
  };

  const scheduleDirty =
    isoToLocalInputValue(match.scheduledAt) !== scheduleLocal;

  // Quick score buttons depending on selected winner
  const quickScores = (forPlayer: 1 | 2): string[] => {
    if (forPlayer === 1) return ['2-0', '2-1', '3-0', '3-1', '3-2'];
    return ['0-2', '1-2', '0-3', '1-3', '2-3'];
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: 'rgba(7, 7, 15, 0.78)',
        backdropFilter: 'blur(6px)',
      }}
      onClick={onClose}
    >
      <div
        className="relative animate-fade-up"
        style={{
          width: 460,
          maxWidth: 'calc(100vw - 32px)',
          background: 'linear-gradient(180deg, #15172a 0%, #0b0c18 100%)',
          border: '1px solid var(--c-border-strong)',
          borderRadius: 4,
          boxShadow:
            '0 0 0 1px rgba(240,185,11,0.15), 0 30px 80px rgba(0,0,0,0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{
            borderBottom: '1px solid var(--c-border)',
            background: 'linear-gradient(180deg, #1d2038 0%, #15172a 100%)',
          }}
        >
          <div>
            <div className="section-eyebrow">Admin · Edit Match</div>
            <div
              className="font-display font-bold uppercase mt-1"
              style={{ fontSize: 18, letterSpacing: '0.14em', color: 'var(--c-gold)' }}
            >
              {match.id} · {match.roundLabel}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-5 space-y-5">
          {/* Status pills */}
          <div>
            <div className="section-eyebrow mb-2">Status</div>
            <div className="flex gap-2">
              {(['pending', 'live', 'completed'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => handleStatus(s)}
                  disabled={busy}
                  className="btn"
                  style={{
                    borderColor:
                      match.status === s ? 'var(--c-gold)' : 'var(--c-border)',
                    color:
                      match.status === s ? 'var(--c-gold)' : 'var(--c-text-dim)',
                    background:
                      match.status === s
                        ? 'rgba(240,185,11,0.08)'
                        : 'transparent',
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
            <p
              className="mt-2"
              style={{
                fontSize: 10,
                color: 'var(--c-text-faint)',
                letterSpacing: '0.04em',
              }}
            >
              Tip: leave on <em>pending</em> and use the schedule below — the
              card will auto-flip to LIVE when its start time arrives.
            </p>
          </div>

          {/* Schedule */}
          <div>
            <div className="section-eyebrow mb-2">Scheduled Start</div>
            <div className="flex items-center gap-2">
              <input
                type="datetime-local"
                value={scheduleLocal}
                onChange={(e) => setScheduleLocal(e.target.value)}
                className="font-mono text-xs px-3 py-2"
                style={{
                  background: 'var(--c-bg-2)',
                  border: '1px solid var(--c-border)',
                  borderRadius: 2,
                  color: 'var(--c-text)',
                  outline: 'none',
                  flex: 1,
                  minWidth: 0,
                  colorScheme: 'dark',
                }}
              />
              <button
                onClick={handleScheduleSave}
                disabled={busy || !scheduleDirty}
                className="btn"
                style={{
                  borderColor: scheduleDirty ? 'var(--c-gold)' : 'var(--c-border)',
                  color: scheduleDirty ? 'var(--c-gold)' : 'var(--c-text-faint)',
                  background: scheduleDirty
                    ? 'rgba(240,185,11,0.08)'
                    : 'transparent',
                  cursor: scheduleDirty ? 'pointer' : 'not-allowed',
                }}
              >
                Save
              </button>
              <button
                onClick={handleScheduleClear}
                disabled={busy || !match.scheduledAt}
                className="btn btn--ghost"
                style={{
                  borderColor: 'rgba(255,59,107,0.3)',
                  color: match.scheduledAt
                    ? 'var(--c-red)'
                    : 'var(--c-text-faint)',
                  cursor: match.scheduledAt ? 'pointer' : 'not-allowed',
                }}
              >
                Clear
              </button>
            </div>
            {match.scheduledAt && (
              <div
                className="font-mono mt-2"
                style={{
                  fontSize: 10,
                  color: 'var(--c-text-dim)',
                  letterSpacing: '0.04em',
                }}
              >
                Currently set to {new Date(match.scheduledAt).toLocaleString()}
              </div>
            )}
          </div>

          {/* Pick winner */}
          <div>
            <div className="section-eyebrow mb-2">Winner</div>
            <div className="grid grid-cols-1 gap-2">
              <PickButton
                player={player1}
                selected={!!player1 && winnerId === player1.id}
                onClick={() => player1 && setWinnerId(player1.id)}
              />
              <PickButton
                player={player2}
                selected={!!player2 && winnerId === player2.id}
                onClick={() => player2 && setWinnerId(player2.id)}
              />
            </div>
          </div>

          {/* Score */}
          <div>
            <div className="section-eyebrow mb-2">Score</div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                placeholder="2-1"
                className="font-mono text-sm px-3 py-2 flex-shrink-0"
                style={{
                  width: 84,
                  background: 'var(--c-bg-2)',
                  border: '1px solid var(--c-border)',
                  borderRadius: 2,
                  color: 'var(--c-text)',
                  outline: 'none',
                  letterSpacing: '0.05em',
                }}
              />
              <div className="flex flex-wrap gap-1">
                {(winnerId &&
                player1 &&
                winnerId === player1.id
                  ? quickScores(1)
                  : winnerId && player2 && winnerId === player2.id
                  ? quickScores(2)
                  : ['2-0', '2-1', '1-2', '0-2']
                ).map((s) => (
                  <button
                    key={s}
                    onClick={() => setScore(s)}
                    className="font-mono"
                    style={{
                      fontSize: 11,
                      padding: '4px 8px',
                      border: '1px solid var(--c-border)',
                      borderRadius: 2,
                      color:
                        score === s ? 'var(--c-gold)' : 'var(--c-text-dim)',
                      background:
                        score === s
                          ? 'rgba(240,185,11,0.08)'
                          : 'transparent',
                      cursor: 'pointer',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {!ready && (
            <div
              className="text-xs px-3 py-2"
              style={{
                background: 'rgba(255, 59, 107, 0.08)',
                border: '1px solid rgba(255, 59, 107, 0.3)',
                color: 'var(--c-red)',
                borderRadius: 2,
              }}
            >
              This match doesn't have both players yet. Resolve the upstream
              matches first.
            </div>
          )}

          {error && (
            <div
              className="text-xs px-3 py-2"
              style={{
                background: 'rgba(255, 59, 107, 0.08)',
                border: '1px solid rgba(255, 59, 107, 0.3)',
                color: 'var(--c-red)',
                borderRadius: 2,
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{
            borderTop: '1px solid var(--c-border)',
            background: '#0b0c18',
          }}
        >
          <button
            onClick={handleClear}
            disabled={busy || !match.winnerId}
            className="btn btn--ghost"
            style={{
              borderColor: 'rgba(255,59,107,0.3)',
              color: match.winnerId ? 'var(--c-red)' : 'var(--c-text-faint)',
              cursor: match.winnerId ? 'pointer' : 'not-allowed',
            }}
          >
            Clear Result
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn--ghost" disabled={busy}>
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={busy || !ready || !winnerId}
              className="btn"
              style={{
                background: 'var(--c-gold)',
                color: '#000',
                borderColor: 'var(--c-gold)',
                opacity: !ready || !winnerId ? 0.4 : 1,
              }}
            >
              {busy ? 'Saving…' : 'Save Result'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// <input type="datetime-local"> always reads/writes a local-time string
// shaped 'YYYY-MM-DDTHH:mm'. We need to round-trip that to/from an ISO
// timestamp (UTC) for storage in Postgres.
// ---------------------------------------------------------------------------
function isoToLocalInputValue(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function localInputValueToIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

// ---------------------------------------------------------------------------
function PickButton({
  player,
  selected,
  onClick,
}: {
  player: Player | null;
  selected: boolean;
  onClick: () => void;
}) {
  if (!player) {
    return (
      <div
        className="flex items-center gap-3 px-3 py-3 player-slot is-empty"
        style={{
          border: '1px dashed var(--c-border)',
          background: 'transparent',
          cursor: 'not-allowed',
        }}
      >
        <span className="seed-badge">·</span>
        <span className="player-name">TBD</span>
      </div>
    );
  }
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 px-3 py-3 text-left transition-all"
      style={{
        background: selected ? 'rgba(240,185,11,0.12)' : 'var(--c-surface)',
        border: `1px solid ${selected ? 'var(--c-gold)' : 'var(--c-border)'}`,
        borderRadius: 2,
        cursor: 'pointer',
        boxShadow: selected
          ? '0 0 0 1px var(--c-gold) inset, 0 0 14px rgba(240,185,11,0.2)'
          : 'none',
      }}
    >
      <span className="seed-badge" style={{ color: selected ? 'var(--c-gold)' : undefined }}>
        {player.seed}
      </span>
      <span
        className={`player-flag fi fi-${player.countryCode.toLowerCase()}`}
      />
      <span
        className="player-name flex-1"
        style={{
          color: 'var(--c-text)',
          fontWeight: selected ? 700 : 500,
        }}
      >
        {player.displayName}
      </span>
      {selected && (
        <span
          className="font-display"
          style={{
            fontSize: 11,
            letterSpacing: '0.18em',
            color: 'var(--c-gold)',
            textTransform: 'uppercase',
          }}
        >
          Winner
        </span>
      )}
    </button>
  );
}
