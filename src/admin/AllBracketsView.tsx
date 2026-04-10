import { useMemo, useState } from 'react';
import { BracketCanvas } from '../bracket/BracketCanvas';
import type { Match, Player } from '../bracket/types';
import { derivePredictedBracket } from '../state/deriveBracket';
import { useAllBrackets, type BracketEntry } from './useAllBrackets';

interface Props {
  players: Player[];
  playerById: Map<string, Player>;
  liveMatches: Match[];
  enabled: boolean;
}

type SortKey =
  | 'points'
  | 'correct'
  | 'name'
  | 'name_desc'
  | 'submitted'
  | 'picks';

const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'points', label: 'Most points' },
  { key: 'correct', label: 'Most correct' },
  { key: 'name', label: 'Name A → Z' },
  { key: 'name_desc', label: 'Name Z → A' },
  { key: 'submitted', label: 'Last submitted' },
  { key: 'picks', label: 'Most picks' },
];

/** Per-match point weights — kept in sync with `003_leaderboard_function.sql`. */
function matchPoints(m: Match): number {
  if (m.bracketSide === 'grand_final') return 8;
  if (m.bracketSide === 'winners') {
    if (m.round === 1) return 1;
    if (m.round === 2) return 2;
    if (m.round === 3) return 3;
    if (m.round === 4) return 5;
    return 1;
  }
  // losers
  if (m.round <= 2) return 1;
  if (m.round <= 4) return 2;
  if (m.round <= 6) return 3;
  if (m.round <= 8) return 5;
  return 1;
}

interface ScoredEntry extends BracketEntry {
  points: number;
  correctCount: number;
  resolvedCount: number;
}

export function AllBracketsView({
  players,
  playerById,
  liveMatches,
  enabled,
}: Props) {
  const { entries, loading, error, refetch } = useAllBrackets({ enabled });
  const [sortKey, setSortKey] = useState<SortKey>('points');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Precompute points/correctness for every entry using the live results.
  const scored: ScoredEntry[] = useMemo(() => {
    const resolvedIds = new Map<string, string>(); // matchId -> winnerId
    const pointsById = new Map<string, number>();
    for (const m of liveMatches) {
      if (m.winnerId) resolvedIds.set(m.id, m.winnerId);
      pointsById.set(m.id, matchPoints(m));
    }
    return entries.map((e) => {
      let points = 0;
      let correct = 0;
      let resolved = 0;
      for (const [matchId, pick] of e.picks.entries()) {
        const actual = resolvedIds.get(matchId);
        if (!actual) continue;
        resolved += 1;
        if (pick === actual) {
          correct += 1;
          points += pointsById.get(matchId) ?? 0;
        }
      }
      return { ...e, points, correctCount: correct, resolvedCount: resolved };
    });
  }, [entries, liveMatches]);

  const sorted: ScoredEntry[] = useMemo(() => {
    const copy = [...scored];
    copy.sort((a, b) => {
      switch (sortKey) {
        case 'points':
          if (b.points !== a.points) return b.points - a.points;
          if (b.correctCount !== a.correctCount)
            return b.correctCount - a.correctCount;
          return a.displayName.localeCompare(b.displayName);
        case 'correct':
          if (b.correctCount !== a.correctCount)
            return b.correctCount - a.correctCount;
          return a.displayName.localeCompare(b.displayName);
        case 'name':
          return a.displayName.localeCompare(b.displayName);
        case 'name_desc':
          return b.displayName.localeCompare(a.displayName);
        case 'submitted': {
          const aT = a.submittedAt ? Date.parse(a.submittedAt) : 0;
          const bT = b.submittedAt ? Date.parse(b.submittedAt) : 0;
          return bT - aT;
        }
        case 'picks':
          return b.totalPicks - a.totalPicks;
      }
    });
    return copy;
  }, [scored, sortKey]);

  const anyResolved = useMemo(
    () => liveMatches.some((m) => m.winnerId !== null),
    [liveMatches],
  );

  const toggle = (userId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const allOpen = expanded.size === sorted.length && sorted.length > 0;
  const anyOpen = expanded.size > 0;

  return (
    <div className="abview max-w-[1600px] mx-auto px-6 pb-12">
      <div className="abview__toolbar">
        <div className="abview__count">
          {loading
            ? 'Loading brackets…'
            : `${sorted.length} ${sorted.length === 1 ? 'bracket' : 'brackets'} submitted`}
        </div>
        <div className="abview__controls">
          <label className="abview__sort-label" htmlFor="abview-sort">
            Sort by
          </label>
          <select
            id="abview-sort"
            className="abview__sort"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => {
              if (allOpen || anyOpen) setExpanded(new Set());
              else setExpanded(new Set(sorted.map((e) => e.userId)));
            }}
            disabled={sorted.length === 0}
          >
            {allOpen || anyOpen ? 'Collapse all' : 'Expand all'}
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => void refetch()}
            disabled={loading}
            title="Refetch from Supabase"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error && (
        <div className="abview__error">
          <strong>Couldn&apos;t load brackets:</strong> {error}
          <div className="abview__error-hint">
            If the deadline hasn&apos;t passed yet, the server will refuse the
            request by design. Try again after{' '}
            <span className="font-mono">2026-04-12 08:00 PT</span>.
          </div>
        </div>
      )}

      {!loading && !error && sorted.length === 0 && (
        <div className="abview__empty">
          No brackets submitted yet.
        </div>
      )}

      <div className="abview__list">
        {sorted.map((entry, idx) => (
          <BracketRow
            key={entry.userId}
            entry={entry}
            rank={idx + 1}
            expanded={expanded.has(entry.userId)}
            onToggle={() => toggle(entry.userId)}
            players={players}
            playerById={playerById}
            anyResolved={anyResolved}
          />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

interface RowProps {
  entry: ScoredEntry;
  rank: number;
  expanded: boolean;
  onToggle: () => void;
  players: Player[];
  playerById: Map<string, Player>;
  anyResolved: boolean;
}

function BracketRow({
  entry,
  rank,
  expanded,
  onToggle,
  players,
  playerById,
  anyResolved,
}: RowProps) {
  // Replay the user's picks through the engine when the row is expanded.
  const predictedMatches = useMemo(
    () => (expanded ? derivePredictedBracket(players, entry.picks) : []),
    [expanded, players, entry.picks],
  );

  // Every match is "locked" in this read-only view so the canvas renders
  // the picks as fixed results (no hover actions, no pointer cursor).
  const lockedAll = useMemo(
    () => new Set(predictedMatches.map((m) => m.id)),
    [predictedMatches],
  );

  const initials = entry.displayName.slice(0, 2).toUpperCase();
  const submittedLabel = entry.submittedAt
    ? new Date(entry.submittedAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—';

  return (
    <div className={`abcard${expanded ? ' abcard--open' : ''}`}>
      <button
        type="button"
        className="abcard__head"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span className="abcard__expand" aria-hidden="true">
          ▸
        </span>
        <span className="abcard__rank">#{rank}</span>
        <div className="abcard__avatar">{initials}</div>
        <div className="abcard__info">
          <div className="abcard__name">{entry.displayName}</div>
          <div className="abcard__meta">
            {entry.twitchHandle && (
              <span className="abcard__handle">@{entry.twitchHandle}</span>
            )}
            <span className="abcard__sep">·</span>
            <span>{entry.totalPicks}/46 picks</span>
            <span className="abcard__sep">·</span>
            <span>Submitted {submittedLabel}</span>
          </div>
        </div>
        {anyResolved && (
          <div className="abcard__score">
            <span className="abcard__points">{entry.points} pts</span>
            <span className="abcard__correct">
              {entry.correctCount}/{entry.resolvedCount} correct
            </span>
          </div>
        )}
      </button>

      {expanded && (
        <div className="abcard__detail">
          <div className="abcard__bracket-scroll">
            <div className="abcard__bracket-inner">
              <BracketCanvas
                matches={predictedMatches}
                playerById={playerById}
                lockedMatchIds={lockedAll}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
