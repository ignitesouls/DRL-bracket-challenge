// Bracket progression engine.
//
// Pure functions — no side effects, no I/O. The admin panel and prediction
// UI both call these to compute the new bracket state when a result changes.

import { MATCH_ROUTING } from './bracketData';
import type { Match } from './types';

/**
 * Set the winner of a match and propagate the player IDs forward to
 * downstream matches per the routing map. Returns a new array of matches.
 *
 * If the result of an upstream match is changed (e.g. admin corrects a
 * mistake), all downstream slots and winners that depended on the old
 * result are cleared.
 */
export function applyMatchResult(
  matches: Match[],
  matchId: string,
  winnerId: string,
  score: string | null = null
): Match[] {
  const byId = new Map(matches.map((m) => [m.id, { ...m }]));
  const target = byId.get(matchId);
  if (!target) throw new Error(`Match ${matchId} not found`);
  if (!target.player1Id || !target.player2Id)
    throw new Error(`Match ${matchId} is missing players`);
  if (winnerId !== target.player1Id && winnerId !== target.player2Id)
    throw new Error(`Winner ${winnerId} is not a player in match ${matchId}`);

  const previousWinner = target.winnerId;
  const loserId =
    target.player1Id === winnerId ? target.player2Id : target.player1Id;

  // 1. If we're changing an existing winner, clear all downstream propagation
  //    that depended on the old values first.
  if (previousWinner && previousWinner !== winnerId) {
    clearDownstream(byId, matchId);
  }

  // 2. Set the new result on this match
  target.winnerId = winnerId;
  target.score = score;
  target.status = 'completed';
  byId.set(matchId, target);

  // 3. Propagate winner forward
  const routing = MATCH_ROUTING[matchId];
  if (routing?.winnerTo) {
    const next = byId.get(routing.winnerTo.matchId);
    if (next) {
      const updated = { ...next, [routing.winnerTo.slot + 'Id']: winnerId };
      byId.set(next.id, updated as Match);
    }
  }

  // 4. Propagate loser to losers bracket (if applicable)
  if (routing?.loserTo) {
    const next = byId.get(routing.loserTo.matchId);
    if (next) {
      const updated = { ...next, [routing.loserTo.slot + 'Id']: loserId };
      byId.set(next.id, updated as Match);
    }
  }

  return Array.from(byId.values());
}

/**
 * Recursively clear all downstream slots and winners that were filled in
 * because of the result at `matchId`. Used when an admin corrects a result.
 */
function clearDownstream(byId: Map<string, Match>, matchId: string): void {
  const routing = MATCH_ROUTING[matchId];
  if (!routing) return;

  const source = byId.get(matchId);
  if (!source) return;

  const oldWinner = source.winnerId;
  const oldLoser =
    source.player1Id && source.player2Id && oldWinner
      ? oldWinner === source.player1Id
        ? source.player2Id
        : source.player1Id
      : null;

  // Clear winner from downstream match
  if (routing.winnerTo && oldWinner) {
    const dest = byId.get(routing.winnerTo.matchId);
    if (dest) {
      const slotKey = (routing.winnerTo.slot + 'Id') as 'player1Id' | 'player2Id';
      if (dest[slotKey] === oldWinner) {
        const cleared: Match = { ...dest, [slotKey]: null };
        // Also clear this match's own result since a player just disappeared
        if (cleared.winnerId) {
          cleared.winnerId = null;
          cleared.score = null;
          cleared.status = 'pending';
          byId.set(cleared.id, cleared);
          clearDownstream(byId, cleared.id);
        } else {
          byId.set(cleared.id, cleared);
        }
      }
    }
  }

  // Clear loser from losers bracket
  if (routing.loserTo && oldLoser) {
    const dest = byId.get(routing.loserTo.matchId);
    if (dest) {
      const slotKey = (routing.loserTo.slot + 'Id') as 'player1Id' | 'player2Id';
      if (dest[slotKey] === oldLoser) {
        const cleared: Match = { ...dest, [slotKey]: null };
        if (cleared.winnerId) {
          cleared.winnerId = null;
          cleared.score = null;
          cleared.status = 'pending';
          byId.set(cleared.id, cleared);
          clearDownstream(byId, cleared.id);
        } else {
          byId.set(cleared.id, cleared);
        }
      }
    }
  }
}

/**
 * Reset a match to pending and cascade-clear downstream.
 * Useful for admin "undo" actions.
 */
export function clearMatchResult(matches: Match[], matchId: string): Match[] {
  const byId = new Map(matches.map((m) => [m.id, { ...m }]));
  const target = byId.get(matchId);
  if (!target) throw new Error(`Match ${matchId} not found`);

  if (target.winnerId) {
    clearDownstream(byId, matchId);
    target.winnerId = null;
    target.score = null;
    target.status = 'pending';
    byId.set(matchId, target);
  }

  return Array.from(byId.values());
}

/**
 * Quick helper used by the UI to know if a match is ready to play
 * (both player slots filled).
 */
export function isMatchReady(match: Match): boolean {
  return match.player1Id !== null && match.player2Id !== null;
}
