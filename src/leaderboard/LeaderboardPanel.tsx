import { useState } from 'react';
import type { LeaderboardEntry } from './useLeaderboard';

interface LeaderboardPanelProps {
  entries: LeaderboardEntry[];
  loading: boolean;
  error: string | null;
  /** Current viewer's user ID, used to highlight their own row. */
  currentUserId: string | null;
}

const TOP_N = 10;

/**
 * Floating leaderboard panel anchored to the top-right of the viewport.
 *
 * Collapsible — by default it's expanded; clicking the header chevron
 * collapses it down to a single chip. Hidden on narrow viewports
 * (handled in CSS) so it never covers the bracket on phones.
 */
export function LeaderboardPanel({
  entries,
  loading,
  error,
  currentUserId,
}: LeaderboardPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  const top = entries.slice(0, TOP_N);
  // Find the current user's rank even if they're outside the top N
  const myIndex = currentUserId
    ? entries.findIndex((e) => e.userId === currentUserId)
    : -1;
  const showMyRowBelow = myIndex >= TOP_N;

  return (
    <aside
      className={'leaderboard-panel' + (collapsed ? ' is-collapsed' : '')}
      data-export-ignore="true"
      aria-label="Top predictors"
    >
      <button
        type="button"
        className="leaderboard-panel__header"
        onClick={() => setCollapsed((c) => !c)}
        title={collapsed ? 'Expand leaderboard' : 'Collapse leaderboard'}
      >
        <span className="leaderboard-panel__title">
          <TrophyIcon /> Top Predictors
        </span>
        <span className="leaderboard-panel__chev" aria-hidden>
          {collapsed ? '▾' : '▴'}
        </span>
      </button>

      {!collapsed && (
        <div className="leaderboard-panel__body">
          {error && (
            <div className="leaderboard-panel__error">
              Couldn't load: {error}
            </div>
          )}

          {!error && loading && entries.length === 0 && (
            <div className="leaderboard-panel__empty">Loading…</div>
          )}

          {!error && !loading && entries.length === 0 && (
            <div className="leaderboard-panel__empty">
              No completed brackets yet. Once results start rolling in,
              the leaderboard fills up here.
            </div>
          )}

          {top.length > 0 && (
            <ol className="leaderboard-panel__list">
              {top.map((entry, idx) => (
                <Row
                  key={entry.userId}
                  rank={idx + 1}
                  entry={entry}
                  isMe={entry.userId === currentUserId}
                />
              ))}
            </ol>
          )}

          {showMyRowBelow && myIndex >= 0 && (
            <>
              <div className="leaderboard-panel__sep" aria-hidden>
                · · ·
              </div>
              <ol
                className="leaderboard-panel__list leaderboard-panel__list--mine"
                start={myIndex + 1}
              >
                <Row
                  rank={myIndex + 1}
                  entry={entries[myIndex]}
                  isMe
                />
              </ol>
            </>
          )}

          {entries.length > TOP_N && (
            <div className="leaderboard-panel__footer">
              {entries.length} full brackets · scoring weighted by round
            </div>
          )}
        </div>
      )}
    </aside>
  );
}

// ---------------------------------------------------------------------------
function Row({
  rank,
  entry,
  isMe,
}: {
  rank: number;
  entry: LeaderboardEntry;
  isMe: boolean;
}) {
  const medal =
    rank === 1
      ? 'gold'
      : rank === 2
      ? 'silver'
      : rank === 3
      ? 'bronze'
      : rank === 4
      ? 'fourth'
      : rank === 5
      ? 'fifth'
      : null;
  const accuracy =
    entry.resolvedCount > 0
      ? Math.round((entry.correctCount / entry.resolvedCount) * 100)
      : null;
  return (
    <li
      className={
        'leaderboard-row' +
        (isMe ? ' is-me' : '') +
        (medal ? ` is-${medal}` : '')
      }
    >
      <span className="leaderboard-row__rank">{rank}</span>
      <span className="leaderboard-row__name" title={entry.displayName}>
        {entry.displayName}
      </span>
      <span className="leaderboard-row__pts">
        <span className="leaderboard-row__pts-num">{entry.points}</span>
        <span className="leaderboard-row__pts-label">PTS</span>
      </span>
      <span className="leaderboard-row__acc" title="Correct picks / resolved">
        {entry.correctCount}
        <span className="leaderboard-row__acc-sep">/</span>
        {entry.resolvedCount}
        {accuracy !== null && (
          <span className="leaderboard-row__acc-pct"> · {accuracy}%</span>
        )}
      </span>
    </li>
  );
}

function TrophyIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="square"
      aria-hidden="true"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <path d="M4 2h8v4a4 4 0 0 1-8 0V2z" />
      <path d="M4 4H2v1a2 2 0 0 0 2 2" />
      <path d="M12 4h2v1a2 2 0 0 1-2 2" />
      <path d="M6 14h4M8 11v3" />
    </svg>
  );
}
