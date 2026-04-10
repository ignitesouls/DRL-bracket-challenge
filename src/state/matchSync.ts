// Conversion helpers between camelCase domain types and snake_case DB rows.
//
// The Postgres schema uses player1_id / player2_id / winner_id / etc.,
// while the React side uses player1Id / player2Id / winnerId. These
// converters keep that boundary in one place.

import type { BracketSide, Match, MatchStatus, Player } from '../bracket/types';

// ---------------------------------------------------------------------------
// DB row shapes (mirror the Supabase schema)
// ---------------------------------------------------------------------------
export interface PlayerRow {
  id: string;
  seed: number;
  twitch_username: string | null;
  display_name: string;
  country_code: string;
  created_at?: string;
}

export interface MatchRow {
  id: string;
  bracket_side: BracketSide;
  round: number;
  round_label: string;
  player1_id: string | null;
  player2_id: string | null;
  winner_id: string | null;
  score: string | null;
  status: MatchStatus;
  started_at?: string | null;
  completed_at?: string | null;
  updated_at?: string | null;
}

// ---------------------------------------------------------------------------
// row → domain
// ---------------------------------------------------------------------------
export function rowToPlayer(row: PlayerRow): Player {
  return {
    id: row.id,
    seed: row.seed,
    twitchUsername: row.twitch_username ?? '',
    displayName: row.display_name,
    countryCode: row.country_code,
  };
}

export function rowToMatch(row: MatchRow): Match {
  return {
    id: row.id,
    bracketSide: row.bracket_side,
    round: row.round,
    roundLabel: row.round_label,
    player1Id: row.player1_id,
    player2Id: row.player2_id,
    winnerId: row.winner_id,
    score: row.score,
    status: row.status,
  };
}

// ---------------------------------------------------------------------------
// domain → row
// ---------------------------------------------------------------------------
export function matchToRow(match: Match): MatchRow {
  return {
    id: match.id,
    bracket_side: match.bracketSide,
    round: match.round,
    round_label: match.roundLabel,
    player1_id: match.player1Id,
    player2_id: match.player2Id,
    winner_id: match.winnerId,
    score: match.score,
    status: match.status,
  };
}

export function playerToInsertRow(player: Player): Omit<PlayerRow, 'id' | 'created_at'> {
  return {
    seed: player.seed,
    twitch_username: player.twitchUsername || null,
    display_name: player.displayName,
    country_code: player.countryCode,
  };
}

// ---------------------------------------------------------------------------
// Diff: which matches actually changed between two snapshots?
// Used to minimise the number of rows we upsert per admin action.
// ---------------------------------------------------------------------------
export function diffMatches(prev: Match[], next: Match[]): Match[] {
  const prevById = new Map(prev.map((m) => [m.id, m]));
  const changed: Match[] = [];
  for (const m of next) {
    const before = prevById.get(m.id);
    if (!before || !matchesEqual(before, m)) {
      changed.push(m);
    }
  }
  return changed;
}

function matchesEqual(a: Match, b: Match): boolean {
  return (
    a.player1Id === b.player1Id &&
    a.player2Id === b.player2Id &&
    a.winnerId === b.winnerId &&
    a.score === b.score &&
    a.status === b.status
  );
}
