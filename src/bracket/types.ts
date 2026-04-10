// Core domain types for the DRL Bracket Challenge

export type BracketSide = 'winners' | 'losers' | 'grand_final';
export type MatchStatus = 'pending' | 'live' | 'completed';

export interface Player {
  id: string;
  seed: number;
  twitchUsername: string;
  displayName: string;
  countryCode: string; // ISO 3166-1 alpha-2, e.g. 'FR', 'US'
}

export interface Match {
  id: string; // 'W1' .. 'W15', 'L1' .. 'L30', 'GF'
  bracketSide: BracketSide;
  round: number;
  roundLabel: string;
  player1Id: string | null;
  player2Id: string | null;
  winnerId: string | null;
  score: string | null; // e.g. '2-1' for BO3
  status: MatchStatus;
}

export interface Prediction {
  matchId: string;
  predictedWinnerId: string;
}

/**
 * Routing rule: when a match completes, where do the winner and loser go next?
 *
 * - winnerTo: { matchId, slot } — fills player1 or player2 of the next match
 * - loserTo: { matchId, slot } — only set for winners-bracket matches; sends
 *            the loser into the losers bracket. Losers in losers-bracket are eliminated.
 */
export interface MatchRouting {
  winnerTo: { matchId: string; slot: 'player1' | 'player2' } | null;
  loserTo: { matchId: string; slot: 'player1' | 'player2' } | null;
}
