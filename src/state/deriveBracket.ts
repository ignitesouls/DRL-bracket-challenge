import { buildInitialMatches } from '../bracket/bracketData';
import { applyMatchResult } from '../bracket/engine';
import type { Match, Player } from '../bracket/types';

/**
 * Build a fully-propagated bracket from a raw prediction map.
 *
 * Walks matches in topological order (W1..W15, L1..L30, GF) and applies
 * any prediction whose match has both player slots filled and whose
 * picked winner is one of the two slot occupants. Stale picks (ones
 * whose player no longer sits in that slot because an upstream pick
 * changed) are skipped silently.
 *
 * Shared between `usePredictions` (for the user's own bracket) and
 * `AllBracketsView` (for the admin-only view of everyone else's picks).
 */
export function derivePredictedBracket(
  players: Player[],
  predictions: Map<string, string>,
): Match[] {
  if (players.length === 0) return [];

  let bracket = buildInitialMatches(players);
  const order = topologicalOrder();

  for (const matchId of order) {
    const pick = predictions.get(matchId);
    if (!pick) continue;
    const m = bracket.find((x) => x.id === matchId);
    if (!m) continue;
    if (!m.player1Id || !m.player2Id) continue;
    if (pick !== m.player1Id && pick !== m.player2Id) continue;
    try {
      bracket = applyMatchResult(bracket, matchId, pick, null);
    } catch {
      // Skip any prediction that fails to apply (shouldn't happen given guards)
    }
  }

  return bracket;
}

function topologicalOrder(): string[] {
  const order: string[] = [];
  for (let i = 1; i <= 15; i++) order.push(`W${i}`);
  for (let i = 1; i <= 30; i++) order.push(`L${i}`);
  order.push('GF');
  return order;
}
