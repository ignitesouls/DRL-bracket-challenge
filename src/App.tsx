import { useMemo, useState } from 'react';
import { PLACEHOLDER_PLAYERS } from './bracket/players';
import { buildInitialMatches } from './bracket/bracketData';
import { applyMatchResult } from './bracket/engine';
import type { Match } from './bracket/types';

/**
 * Phase 1 / 2 placeholder App.
 *
 * Renders all 46 matches in a flat list so you can sanity-check the
 * progression engine. The polished bracket UI lands in Phase 4.
 *
 * Click any "ready" match (both player slots filled) to pick a winner.
 * Watch downstream matches fill in automatically.
 */
export default function App() {
  const players = PLACEHOLDER_PLAYERS;
  const playerById = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players]
  );

  const [matches, setMatches] = useState<Match[]>(() =>
    buildInitialMatches(players)
  );

  const handlePickWinner = (matchId: string, winnerId: string) => {
    setMatches((prev) => applyMatchResult(prev, matchId, winnerId));
  };

  const handleReset = () => {
    setMatches(buildInitialMatches(players));
  };

  const winnersMatches = matches.filter((m) => m.bracketSide === 'winners');
  const losersMatches = matches.filter((m) => m.bracketSide === 'losers');
  const grandFinal = matches.find((m) => m.bracketSide === 'grand_final')!;

  return (
    <div className="min-h-full p-6 max-w-7xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="bracket-title">DRL Bracket Challenge</h1>
          <p className="text-white/60 text-sm mt-1">
            Phase 1/2 preview · click matches to test bracket progression
          </p>
        </div>
        <button
          onClick={handleReset}
          className="px-4 py-2 rounded bg-twitch-purple hover:bg-twitch-purple-dark transition text-sm font-semibold"
        >
          Reset Bracket
        </button>
      </header>

      <Section title="Winners Bracket">
        <MatchList
          matches={winnersMatches}
          playerById={playerById}
          onPick={handlePickWinner}
        />
      </Section>

      <Section title="Losers Bracket">
        <MatchList
          matches={losersMatches}
          playerById={playerById}
          onPick={handlePickWinner}
        />
      </Section>

      <Section title="Grand Final">
        <MatchList
          matches={[grandFinal]}
          playerById={playerById}
          onPick={handlePickWinner}
        />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="text-xl font-bold uppercase tracking-wide text-bracket-gold mb-3">
        {title}
      </h2>
      {children}
    </section>
  );
}

function MatchList({
  matches,
  playerById,
  onPick,
}: {
  matches: Match[];
  playerById: Map<string, { id: string; seed: number; displayName: string; countryCode: string }>;
  onPick: (matchId: string, winnerId: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
      {matches.map((m) => (
        <MatchCard
          key={m.id}
          match={m}
          playerById={playerById}
          onPick={onPick}
        />
      ))}
    </div>
  );
}

function MatchCard({
  match,
  playerById,
  onPick,
}: {
  match: Match;
  playerById: Map<string, { id: string; seed: number; displayName: string; countryCode: string }>;
  onPick: (matchId: string, winnerId: string) => void;
}) {
  const p1 = match.player1Id ? playerById.get(match.player1Id) : null;
  const p2 = match.player2Id ? playerById.get(match.player2Id) : null;
  const ready = !!(p1 && p2);

  return (
    <div className="match-card">
      <div className="flex justify-between items-center px-3 py-1 bg-bracket-surface-2 text-[10px] uppercase tracking-wider text-white/50">
        <span>{match.id}</span>
        <span>{match.roundLabel}</span>
      </div>

      <SlotRow
        slot={p1}
        isWinner={match.winnerId === match.player1Id}
        isLoser={match.winnerId !== null && match.winnerId !== match.player1Id}
        ready={ready}
        onClick={() => p1 && ready && onPick(match.id, p1.id)}
      />
      <SlotRow
        slot={p2}
        isWinner={match.winnerId === match.player2Id}
        isLoser={match.winnerId !== null && match.winnerId !== match.player2Id}
        ready={ready}
        onClick={() => p2 && ready && onPick(match.id, p2.id)}
      />
    </div>
  );
}

function SlotRow({
  slot,
  isWinner,
  isLoser,
  ready,
  onClick,
}: {
  slot: { id: string; seed: number; displayName: string; countryCode: string } | null;
  isWinner: boolean;
  isLoser: boolean;
  ready: boolean;
  onClick: () => void;
}) {
  const className = [
    'player-slot',
    isWinner && 'winner',
    isLoser && 'loser',
    ready && !isWinner && !isLoser && 'cursor-pointer hover:bg-twitch-purple/5',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className} onClick={onClick}>
      {slot ? (
        <>
          <span className="seed-badge">{slot.seed}</span>
          <span className={`fi fi-${slot.countryCode}`} />
          <span className="truncate">{slot.displayName}</span>
        </>
      ) : (
        <span className="text-white/30 italic text-xs">TBD</span>
      )}
    </div>
  );
}
