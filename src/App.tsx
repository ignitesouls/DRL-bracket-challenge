import { useEffect, useMemo, useRef, useState } from 'react';
import { BracketCanvas } from './bracket/BracketCanvas';
import { BracketSkeleton } from './bracket/BracketSkeleton';
import { Header } from './ui/Header';
import { useAuth } from './auth/AuthContext';
import { useBracketState } from './state/useBracketState';
import { usePredictions } from './state/usePredictions';
import { AdminBar } from './admin/AdminBar';
import { MatchEditor } from './admin/MatchEditor';
import { useBracketExport } from './export/useBracketExport';
import { LockCountdown } from './ui/LockCountdown';

type View = 'live' | 'predictions';

/**
 * Phase 7 — User Predictions.
 *
 * Two views share the same bracket canvas:
 *   - Live Bracket   : the actual results, driven by the admin via Phase 6
 *   - My Predictions : the user's own pick'em bracket, propagated through
 *                      the engine. Predictions for matches that have gone
 *                      live or completed are locked and scored.
 */
export default function App() {
  const { isAdmin, user } = useAuth();
  const bracket = useBracketState({ isAdmin });

  const predictions = usePredictions({
    userId: user?.id ?? null,
    players: bracket.players,
    liveMatches: bracket.matches,
  });

  const [view, setView] = useState<View>('live');
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);

  const exportRef = useRef<HTMLDivElement | null>(null);
  const exporter = useBracketExport();

  const handleExport = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    const handle = user?.user_metadata?.preferred_username || user?.user_metadata?.name;
    const suffix = view === 'predictions' && handle ? `-${handle}` : '';
    const filename = `drl-bracket-${view}${suffix}-${stamp}.png`;
    exporter.exportNode(exportRef.current, filename);
  };

  const editingMatch = editingMatchId
    ? bracket.matches.find((m) => m.id === editingMatchId) ?? null
    : null;

  const completedCount = bracket.matches.filter((m) => m.winnerId !== null).length;
  const totalMatches = bracket.matches.length || 46;
  const canPredict = !!user && bracket.matches.length > 0;

  // Per-match correct/incorrect overlay for the predictions view
  const pickResultById = useMemo(() => {
    const map = new Map<string, 'correct' | 'incorrect'>();
    for (const m of bracket.matches) {
      if (!m.winnerId) continue;
      const pick = predictions.predictionMap.get(m.id);
      if (!pick) continue;
      map.set(m.id, pick === m.winnerId ? 'correct' : 'incorrect');
    }
    return map;
  }, [bracket.matches, predictions.predictionMap]);

  // If the viewer logs out while in predictions view, snap back to live.
  useEffect(() => {
    if (view === 'predictions' && !user) setView('live');
  }, [view, user]);

  return (
    <div className="min-h-full">
      <div className="max-w-[1600px] mx-auto px-6 pt-6">
        <Header />

        {isAdmin && (
          <AdminBar
            mode={bracket.mode}
            errorMessage={bracket.errorMessage}
            hasPlayers={bracket.players.length > 0}
            hasMatches={bracket.matches.length > 0}
            onSeedPlayers={bracket.seedPlayers}
            onInitializeBracket={bracket.initializeBracket}
            onResetBracket={bracket.resetBracket}
          />
        )}

        <LockCountdown />

        {/* Toolbar with view tabs */}
        <div className="sticky-toolbar flex items-center justify-between mb-4 mt-2 flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <ViewTabs
              view={view}
              onChange={setView}
              canPredict={canPredict}
              isLoggedIn={!!user}
            />
            <span
              className="font-mono text-xs"
              style={{ color: 'var(--c-text-dim)' }}
            >
              {view === 'live'
                ? `${completedCount}/${totalMatches} matches resolved`
                : `${predictions.predictionMap.size} picks · ${predictions.correctCount}/${predictions.resolvedCount} correct`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {view === 'predictions' &&
              predictions.predictionMap.size > 0 &&
              !predictions.globallyLocked && (
                <button
                  onClick={() => {
                    if (
                      confirm(
                        'Clear all of your predictions? This cannot be undone.'
                      )
                    ) {
                      predictions.clearAllPredictions();
                    }
                  }}
                  className="btn btn--ghost"
                  style={{
                    borderColor: 'rgba(255,59,107,0.3)',
                    color: 'var(--c-red)',
                  }}
                >
                  Clear Picks
                </button>
              )}

            {view === 'live' && isAdmin && bracket.matches.length > 0 && (
              <span
                className="font-mono text-[10px] px-2 py-1"
                style={{
                  color: 'var(--c-cyan)',
                  border: '1px solid rgba(76,224,255,0.4)',
                  borderRadius: 2,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                }}
              >
                Admin · Click any match to edit
              </span>
            )}

            {view === 'predictions' && predictions.resolvedCount > 0 && (
              <AccuracyBadge
                correct={predictions.correctCount}
                resolved={predictions.resolvedCount}
              />
            )}

            {bracket.matches.length > 0 && (view === 'live' || user) && (
              <button
                onClick={handleExport}
                disabled={exporter.status === 'working'}
                className="btn"
                data-export-ignore="true"
                title="Save the current bracket view as a PNG"
              >
                {exporter.status === 'working' ? (
                  <span>Exporting…</span>
                ) : (
                  <span className="inline-flex items-center gap-1.5">
                    <DownloadIcon /> Export PNG
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {exporter.error && (
          <div
            className="font-mono text-[11px] mb-2"
            style={{ color: 'var(--c-red)' }}
          >
            Export failed: {exporter.error}
          </div>
        )}
      </div>

      {/* Empty state when DB is reachable but uninitialized and viewer is non-admin */}
      {bracket.mode === 'empty' && !isAdmin && (
        <div className="px-6 pb-12">
          <div
            className="max-w-md mx-auto text-center px-6 py-10"
            style={{
              background: 'var(--c-surface)',
              border: '1px solid var(--c-border)',
              borderRadius: 3,
            }}
          >
            <div className="section-eyebrow">Bracket Pending</div>
            <p className="mt-3 text-sm" style={{ color: 'var(--c-text-dim)' }}>
              The bracket hasn't been initialized yet. Check back when the
              admin sets things up.
            </p>
          </div>
        </div>
      )}

      {/* Logged-out predictions hint */}
      {view === 'predictions' && !user && (
        <div className="px-6 pb-12">
          <div
            className="max-w-md mx-auto text-center px-6 py-10"
            style={{
              background: 'var(--c-surface)',
              border: '1px solid var(--c-border)',
              borderRadius: 3,
            }}
          >
            <div className="section-eyebrow">Sign In Required</div>
            <p className="mt-3 text-sm" style={{ color: 'var(--c-text-dim)' }}>
              Log in with Twitch to fill out your own bracket and lock in
              predictions before the matches start.
            </p>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {bracket.mode === 'loading' && bracket.matches.length === 0 && (
        <div className="overflow-x-auto pb-12">
          <div className="px-6 mx-auto" style={{ width: 'fit-content' }}>
            <BracketSkeleton />
          </div>
        </div>
      )}

      {/* Bracket canvas (horizontally scrollable) */}
      {bracket.matches.length > 0 && (view === 'live' || user) && (
        <div className="overflow-x-auto pb-12">
          <div className="scroll-hint">← Scroll horizontally to see the full bracket →</div>
          <div
            ref={exportRef}
            className="px-6 mx-auto"
            style={{ width: 'fit-content' }}
          >
            {view === 'live' ? (
              <BracketCanvas
                matches={bracket.matches}
                playerById={bracket.playerById}
                onAdminEdit={isAdmin ? setEditingMatchId : undefined}
              />
            ) : (
              <BracketCanvas
                matches={predictions.predictedMatches}
                playerById={bracket.playerById}
                onPick={(matchId, winnerId) =>
                  predictions.setPrediction(matchId, winnerId)
                }
                lockedMatchIds={predictions.lockedMatchIds}
                pickResultById={pickResultById}
              />
            )}
          </div>
        </div>
      )}

      {/* Admin match editor modal */}
      {editingMatch && (
        <MatchEditor
          match={editingMatch}
          player1={
            editingMatch.player1Id
              ? bracket.playerById.get(editingMatch.player1Id) ?? null
              : null
          }
          player2={
            editingMatch.player2Id
              ? bracket.playerById.get(editingMatch.player2Id) ?? null
              : null
          }
          onClose={() => setEditingMatchId(null)}
          onSave={bracket.setMatchWinner}
          onClear={bracket.clearMatch}
          onSetStatus={bracket.setMatchStatus}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
function ViewTabs({
  view,
  onChange,
  canPredict,
  isLoggedIn,
}: {
  view: View;
  onChange: (v: View) => void;
  canPredict: boolean;
  isLoggedIn: boolean;
}) {
  const baseTab = (active: boolean): React.CSSProperties => ({
    fontFamily: '"Rajdhani", sans-serif',
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: '0.18em',
    textTransform: 'uppercase',
    padding: '8px 16px',
    border: '1px solid',
    borderColor: active ? 'var(--c-gold)' : 'var(--c-border)',
    background: active ? 'rgba(240,185,11,0.08)' : 'transparent',
    color: active ? 'var(--c-gold)' : 'var(--c-text-dim)',
    cursor: 'pointer',
    borderRadius: 2,
  });

  return (
    <div className="inline-flex gap-1.5">
      <button
        onClick={() => onChange('live')}
        style={baseTab(view === 'live')}
      >
        Live Bracket
      </button>
      <button
        onClick={() => onChange('predictions')}
        disabled={!canPredict && isLoggedIn}
        style={{
          ...baseTab(view === 'predictions'),
          opacity: !isLoggedIn ? 0.6 : 1,
        }}
        title={!isLoggedIn ? 'Sign in with Twitch to predict' : undefined}
      >
        My Predictions
      </button>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="square"
      aria-hidden="true"
    >
      <path d="M8 2v8m0 0L4.5 6.5M8 10l3.5-3.5" />
      <path d="M2.5 12.5v1A1.5 1.5 0 0 0 4 15h8a1.5 1.5 0 0 0 1.5-1.5v-1" />
    </svg>
  );
}

function AccuracyBadge({ correct, resolved }: { correct: number; resolved: number }) {
  const pct = resolved === 0 ? 0 : Math.round((correct / resolved) * 100);
  return (
    <div
      className="inline-flex items-center gap-2"
      style={{
        padding: '4px 10px',
        border: '1px solid var(--c-gold)',
        borderRadius: 2,
        background: 'rgba(240,185,11,0.08)',
      }}
    >
      <span
        className="font-display"
        style={{
          fontSize: 10,
          letterSpacing: '0.16em',
          color: 'var(--c-text-dim)',
          textTransform: 'uppercase',
        }}
      >
        Accuracy
      </span>
      <span
        className="font-mono"
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: 'var(--c-gold)',
        }}
      >
        {pct}%
      </span>
    </div>
  );
}
