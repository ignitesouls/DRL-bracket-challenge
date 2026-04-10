import { useMemo, useState } from 'react';
import {
  PLAYER_STATS,
  SORT_OPTIONS,
  sortPlayers,
  type PlayerSortKey,
} from './playerData';
import { PlayerCard } from './PlayerCard';

/**
 * Top-level players tab. Renders all 32 qualifier players with a sort
 * dropdown and multi-expand cards (any number can be open at once).
 * Data is fully static — it's imported from src/data/playerStats.json at
 * build time and produced by drl_generate.py.
 */
export function PlayersView() {
  const [sortKey, setSortKey] = useState<PlayerSortKey>('rank');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const players = useMemo(
    () => sortPlayers(PLAYER_STATS, sortKey),
    [sortKey],
  );

  const toggle = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const allOpen = expanded.size === players.length && players.length > 0;
  const anyOpen = expanded.size > 0;

  return (
    <div className="players-view max-w-[1600px] mx-auto px-6 pb-12">
      <div className="players-view__toolbar">
        <div className="players-view__count">
          {players.length} qualified players
        </div>
        <div className="players-view__controls">
          <label className="players-view__sort-label" htmlFor="players-sort">
            Sort by
          </label>
          <select
            id="players-sort"
            className="players-view__sort"
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as PlayerSortKey)}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn--ghost players-view__expand-all"
            onClick={() => {
              if (allOpen || anyOpen) {
                setExpanded(new Set());
              } else {
                setExpanded(new Set(players.map((p) => p.name)));
              }
            }}
          >
            {allOpen || anyOpen ? 'Collapse all' : 'Expand all'}
          </button>
        </div>
      </div>

      <div className="players-view__grid">
        {players.map((p) => (
          <PlayerCard
            key={p.name}
            player={p}
            expanded={expanded.has(p.name)}
            onToggle={() => toggle(p.name)}
          />
        ))}
      </div>
    </div>
  );
}
