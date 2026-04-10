// Bracket structure for a 32-player double elimination tournament.
//
// Format:
// - Top 16 seeds (1-16) start in Winners Bracket Round 1
// - Bottom 16 seeds (17-32) start in Losers Bracket Round 1
// - Winners losers drop into specific losers rounds with crossover routing
// - Grand Final is BO3 with Winners side starting 1-0
// - Total: 46 matches (15 W + 30 L + 1 GF)

import type { Match, MatchRouting, Player } from './types';

// ---------------------------------------------------------------------------
// Round-1 seed pairings
// ---------------------------------------------------------------------------

// Winners Round 1 — top 16 seeds (1 vs 16, 8 vs 9, etc.)
const WINNERS_R1_PAIRS: Array<[number, number]> = [
  [1, 16], // W1
  [8, 9],  // W2
  [5, 12], // W3
  [4, 13], // W4
  [6, 11], // W5
  [3, 14], // W6
  [7, 10], // W7
  [2, 15], // W8
];

// Losers Round 1 — bottom 16 seeds, matched per the screenshot order
const LOSERS_R1_PAIRS: Array<[number, number]> = [
  [17, 32], // L1
  [24, 25], // L2
  [21, 28], // L3
  [20, 29], // L4
  [22, 27], // L5
  [19, 30], // L6
  [23, 26], // L7
  [18, 31], // L8
];

// ---------------------------------------------------------------------------
// Match routing map — where winners and losers of each match are sent next
// ---------------------------------------------------------------------------

export const MATCH_ROUTING: Record<string, MatchRouting> = {
  // -------- Winners Round 1 (W1-W8) --------
  // Winners advance to Winners Quarters
  // Losers drop into Losers Round 2 with crossover (W5-W8 → L9-L12, W1-W4 → L13-L16)
  W1: { winnerTo: { matchId: 'W9',  slot: 'player1' }, loserTo: { matchId: 'L13', slot: 'player1' } },
  W2: { winnerTo: { matchId: 'W9',  slot: 'player2' }, loserTo: { matchId: 'L14', slot: 'player1' } },
  W3: { winnerTo: { matchId: 'W10', slot: 'player1' }, loserTo: { matchId: 'L15', slot: 'player1' } },
  W4: { winnerTo: { matchId: 'W10', slot: 'player2' }, loserTo: { matchId: 'L16', slot: 'player1' } },
  W5: { winnerTo: { matchId: 'W11', slot: 'player1' }, loserTo: { matchId: 'L9',  slot: 'player1' } },
  W6: { winnerTo: { matchId: 'W11', slot: 'player2' }, loserTo: { matchId: 'L10', slot: 'player1' } },
  W7: { winnerTo: { matchId: 'W12', slot: 'player1' }, loserTo: { matchId: 'L11', slot: 'player1' } },
  W8: { winnerTo: { matchId: 'W12', slot: 'player2' }, loserTo: { matchId: 'L12', slot: 'player1' } },

  // -------- Winners Quarters (W9-W12) --------
  // Winners advance to Winners Semis
  // Losers drop into Losers Round 4
  W9:  { winnerTo: { matchId: 'W13', slot: 'player1' }, loserTo: { matchId: 'L21', slot: 'player1' } },
  W10: { winnerTo: { matchId: 'W13', slot: 'player2' }, loserTo: { matchId: 'L22', slot: 'player1' } },
  W11: { winnerTo: { matchId: 'W14', slot: 'player1' }, loserTo: { matchId: 'L23', slot: 'player1' } },
  W12: { winnerTo: { matchId: 'W14', slot: 'player2' }, loserTo: { matchId: 'L24', slot: 'player1' } },

  // -------- Winners Semis (W13-W14) --------
  // Winners advance to Winners Final
  // Losers drop into Losers Quarters (W14 → L27, W13 → L28)
  W13: { winnerTo: { matchId: 'W15', slot: 'player1' }, loserTo: { matchId: 'L28', slot: 'player1' } },
  W14: { winnerTo: { matchId: 'W15', slot: 'player2' }, loserTo: { matchId: 'L27', slot: 'player1' } },

  // -------- Winners Final (W15) --------
  // Winner goes to Grand Final, Loser drops to Losers Final
  W15: { winnerTo: { matchId: 'GF',  slot: 'player1' }, loserTo: { matchId: 'L30', slot: 'player1' } },

  // -------- Losers Round 1 (L1-L8) --------
  // Winners advance to Losers Round 2 (paired against Winners R1 losers)
  L1: { winnerTo: { matchId: 'L9',  slot: 'player2' }, loserTo: null },
  L2: { winnerTo: { matchId: 'L10', slot: 'player2' }, loserTo: null },
  L3: { winnerTo: { matchId: 'L11', slot: 'player2' }, loserTo: null },
  L4: { winnerTo: { matchId: 'L12', slot: 'player2' }, loserTo: null },
  L5: { winnerTo: { matchId: 'L13', slot: 'player2' }, loserTo: null },
  L6: { winnerTo: { matchId: 'L14', slot: 'player2' }, loserTo: null },
  L7: { winnerTo: { matchId: 'L15', slot: 'player2' }, loserTo: null },
  L8: { winnerTo: { matchId: 'L16', slot: 'player2' }, loserTo: null },

  // -------- Losers Round 2 (L9-L16) --------
  // Winners advance to Losers Round 3
  L9:  { winnerTo: { matchId: 'L17', slot: 'player1' }, loserTo: null },
  L10: { winnerTo: { matchId: 'L17', slot: 'player2' }, loserTo: null },
  L11: { winnerTo: { matchId: 'L18', slot: 'player1' }, loserTo: null },
  L12: { winnerTo: { matchId: 'L18', slot: 'player2' }, loserTo: null },
  L13: { winnerTo: { matchId: 'L19', slot: 'player1' }, loserTo: null },
  L14: { winnerTo: { matchId: 'L19', slot: 'player2' }, loserTo: null },
  L15: { winnerTo: { matchId: 'L20', slot: 'player1' }, loserTo: null },
  L16: { winnerTo: { matchId: 'L20', slot: 'player2' }, loserTo: null },

  // -------- Losers Round 3 (L17-L20) --------
  // Winners advance to Losers Round 4 (paired against Winners QF losers)
  L17: { winnerTo: { matchId: 'L21', slot: 'player2' }, loserTo: null },
  L18: { winnerTo: { matchId: 'L22', slot: 'player2' }, loserTo: null },
  L19: { winnerTo: { matchId: 'L23', slot: 'player2' }, loserTo: null },
  L20: { winnerTo: { matchId: 'L24', slot: 'player2' }, loserTo: null },

  // -------- Losers Round 4 (L21-L24) --------
  L21: { winnerTo: { matchId: 'L25', slot: 'player1' }, loserTo: null },
  L22: { winnerTo: { matchId: 'L25', slot: 'player2' }, loserTo: null },
  L23: { winnerTo: { matchId: 'L26', slot: 'player1' }, loserTo: null },
  L24: { winnerTo: { matchId: 'L26', slot: 'player2' }, loserTo: null },

  // -------- Losers Round 5 (L25-L26) --------
  // Winners advance to Losers Quarters (paired against Winners SF losers)
  L25: { winnerTo: { matchId: 'L27', slot: 'player2' }, loserTo: null },
  L26: { winnerTo: { matchId: 'L28', slot: 'player2' }, loserTo: null },

  // -------- Losers Quarters (L27-L28) --------
  L27: { winnerTo: { matchId: 'L29', slot: 'player1' }, loserTo: null },
  L28: { winnerTo: { matchId: 'L29', slot: 'player2' }, loserTo: null },

  // -------- Losers Semi (L29) --------
  L29: { winnerTo: { matchId: 'L30', slot: 'player2' }, loserTo: null },

  // -------- Losers Final (L30) --------
  // Winner goes to Grand Final
  L30: { winnerTo: { matchId: 'GF',  slot: 'player2' }, loserTo: null },

  // -------- Grand Final --------
  GF:  { winnerTo: null, loserTo: null },
};

// ---------------------------------------------------------------------------
// Build the initial 46-match list
// ---------------------------------------------------------------------------

const winnersRoundLabels: Record<number, string> = {
  1: 'Winners Round 1',
  2: 'Winners Quarter',
  3: 'Winners Semi',
  4: 'Winners Final',
};

const losersRoundLabels: Record<number, string> = {
  1: 'Losers Round 1',
  2: 'Losers Round 2',
  3: 'Losers Round 3',
  4: 'Losers Round 4',
  5: 'Losers Round 5',
  6: 'Losers Quarter',
  7: 'Losers Semi',
  8: 'Losers Final',
};

function blankMatch(
  id: string,
  bracketSide: 'winners' | 'losers' | 'grand_final',
  round: number,
  roundLabel: string,
  player1Id: string | null = null,
  player2Id: string | null = null
): Match {
  return {
    id,
    bracketSide,
    round,
    roundLabel,
    player1Id,
    player2Id,
    winnerId: null,
    score: null,
    status: 'pending',
    scheduledAt: null,
  };
}

export function buildInitialMatches(players: Player[]): Match[] {
  const playerBySeed = new Map(players.map((p) => [p.seed, p.id]));
  const matches: Match[] = [];

  // Winners R1
  WINNERS_R1_PAIRS.forEach((pair, i) => {
    matches.push(
      blankMatch(
        `W${i + 1}`,
        'winners',
        1,
        winnersRoundLabels[1],
        playerBySeed.get(pair[0]) ?? null,
        playerBySeed.get(pair[1]) ?? null
      )
    );
  });

  // Winners Quarters W9-W12
  for (let i = 9; i <= 12; i++) {
    matches.push(blankMatch(`W${i}`, 'winners', 2, winnersRoundLabels[2]));
  }
  // Winners Semis W13-W14
  for (let i = 13; i <= 14; i++) {
    matches.push(blankMatch(`W${i}`, 'winners', 3, winnersRoundLabels[3]));
  }
  // Winners Final W15
  matches.push(blankMatch('W15', 'winners', 4, winnersRoundLabels[4]));

  // Losers R1
  LOSERS_R1_PAIRS.forEach((pair, i) => {
    matches.push(
      blankMatch(
        `L${i + 1}`,
        'losers',
        1,
        losersRoundLabels[1],
        playerBySeed.get(pair[0]) ?? null,
        playerBySeed.get(pair[1]) ?? null
      )
    );
  });

  // Losers R2 L9-L16
  for (let i = 9; i <= 16; i++) {
    matches.push(blankMatch(`L${i}`, 'losers', 2, losersRoundLabels[2]));
  }
  // Losers R3 L17-L20
  for (let i = 17; i <= 20; i++) {
    matches.push(blankMatch(`L${i}`, 'losers', 3, losersRoundLabels[3]));
  }
  // Losers R4 L21-L24
  for (let i = 21; i <= 24; i++) {
    matches.push(blankMatch(`L${i}`, 'losers', 4, losersRoundLabels[4]));
  }
  // Losers R5 L25-L26
  for (let i = 25; i <= 26; i++) {
    matches.push(blankMatch(`L${i}`, 'losers', 5, losersRoundLabels[5]));
  }
  // Losers Quarters L27-L28
  for (let i = 27; i <= 28; i++) {
    matches.push(blankMatch(`L${i}`, 'losers', 6, losersRoundLabels[6]));
  }
  // Losers Semi L29
  matches.push(blankMatch('L29', 'losers', 7, losersRoundLabels[7]));
  // Losers Final L30
  matches.push(blankMatch('L30', 'losers', 8, losersRoundLabels[8]));

  // Grand Final
  matches.push(blankMatch('GF', 'grand_final', 1, 'Grand Final (BO3, 1-0 start)'));

  return matches;
}
