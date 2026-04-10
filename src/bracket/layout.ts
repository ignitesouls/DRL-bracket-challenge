// Layout engine for the polished bracket UI.
//
// Computes absolute (x, y) pixel positions for every match in the
// 46-match double-elimination structure so we can render cards into
// an absolutely-positioned canvas and overlay SVG connector lines.
//
// Time-aligned column model
// -------------------------
// Winners and Losers rounds happen in interleaved time slots. Both sides
// share the same column grid so a winners-bracket loser drops cleanly
// into the losers round directly below it.
//
//   col 0 : W R1 / L R1
//   col 1 : W QF / L R2
//   col 2 :       L R3
//   col 3 : W SF / L R4
//   col 4 :       L R5
//   col 5 : W F  / L R6 (Losers Quarter)
//   col 6 :       L R7 (Losers Semi)
//   col 7 :       L R8 (Losers Final)
//   col 8 : Grand Final

import { MATCH_ROUTING } from './bracketData';

export interface MatchPosition {
  matchId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RoundHeaderSlot {
  side: 'winners' | 'losers';
  label: string;
  x: number;
  width: number;
  // y is implicit per side from layout (winnersHeaderY / losersHeaderY)
}

export interface BracketLayout {
  positions: Map<string, MatchPosition>;
  winnersHeaders: RoundHeaderSlot[];
  losersHeaders: RoundHeaderSlot[];
  grandFinal: MatchPosition;
  width: number;
  height: number;
  winnersHeaderY: number;
  losersHeaderY: number;
  winnersBottom: number;
  losersTop: number;
  cardWidth: number;
  cardHeight: number;
}

// ---------------------------------------------------------------------------
// Visual constants
// ---------------------------------------------------------------------------
const CARD_W = 196;
const CARD_H = 82;
const GF_CARD_W = 240;
const GF_CARD_H = 96;
const COL_GAP = 56;
const COL_W = CARD_W + COL_GAP; // 252
const ROW_PITCH = 96; // CARD_H + vertical gap
const HEADER_H = 38;
const SECTION_GAP = 96;
const CANVAS_PAD_X = 64; // room for vertical "Winners" / "Losers" side labels
const CANVAS_PAD_TOP = 8;
const CANVAS_PAD_BOTTOM = 24;

// Round → grid column index
const WINNERS_COL_BY_ROUND: Record<number, number> = { 1: 0, 2: 1, 3: 3, 4: 5 };
const LOSERS_COL_BY_ROUND: Record<number, number> = {
  1: 0,
  2: 1,
  3: 2,
  4: 3,
  5: 4,
  6: 5,
  7: 6,
  8: 7,
};
const GF_COL = 8;

const colX = (col: number) => CANVAS_PAD_X + col * COL_W;

// ---------------------------------------------------------------------------
// computeLayout
// ---------------------------------------------------------------------------
export function computeLayout(): BracketLayout {
  const positions = new Map<string, MatchPosition>();

  // ----- Winners section -----
  const winnersHeaderY = CANVAS_PAD_TOP;
  const winnersCardsTop = winnersHeaderY + HEADER_H;

  // Winners R1: W1..W8 stacked
  for (let i = 0; i < 8; i++) {
    positions.set(`W${i + 1}`, makePos(`W${i + 1}`, 1, winnersCardsTop + i * ROW_PITCH));
  }
  // QF W9..W12 from pairs
  setMidpoint('W9',  'W1', 'W2', 2);
  setMidpoint('W10', 'W3', 'W4', 2);
  setMidpoint('W11', 'W5', 'W6', 2);
  setMidpoint('W12', 'W7', 'W8', 2);
  // SF
  setMidpoint('W13', 'W9',  'W10', 3);
  setMidpoint('W14', 'W11', 'W12', 3);
  // Final
  setMidpoint('W15', 'W13', 'W14', 4);

  const winnersBottom = winnersCardsTop + 8 * ROW_PITCH - (ROW_PITCH - CARD_H);

  // ----- Losers section -----
  const losersHeaderY = winnersBottom + SECTION_GAP;
  const losersCardsTop = losersHeaderY + HEADER_H;

  // L1..L8 stacked
  for (let i = 0; i < 8; i++) {
    positions.set(`L${i + 1}`, makeLPos(`L${i + 1}`, 1, losersCardsTop + i * ROW_PITCH));
  }
  // L9..L16 — drop-ins, aligned with L1..L8 sibling
  for (let i = 1; i <= 8; i++) {
    const sibling = positions.get(`L${i}`)!;
    positions.set(`L${i + 8}`, makeLPos(`L${i + 8}`, 2, sibling.y));
  }
  // L17..L20 — midpoints of L9-L10, L11-L12, L13-L14, L15-L16
  setMidpointL('L17', 'L9',  'L10', 3);
  setMidpointL('L18', 'L11', 'L12', 3);
  setMidpointL('L19', 'L13', 'L14', 3);
  setMidpointL('L20', 'L15', 'L16', 3);
  // L21..L24 — drop-ins from L17..L20
  for (let i = 0; i < 4; i++) {
    const parent = positions.get(`L${17 + i}`)!;
    positions.set(`L${21 + i}`, makeLPos(`L${21 + i}`, 4, parent.y));
  }
  // L25..L26 — midpoints
  setMidpointL('L25', 'L21', 'L22', 5);
  setMidpointL('L26', 'L23', 'L24', 5);
  // L27..L28 — drop-ins from L25..L26
  positions.set('L27', makeLPos('L27', 6, positions.get('L25')!.y));
  positions.set('L28', makeLPos('L28', 6, positions.get('L26')!.y));
  // L29 — midpoint
  setMidpointL('L29', 'L27', 'L28', 7);
  // L30 — drop-in from L29
  positions.set('L30', makeLPos('L30', 8, positions.get('L29')!.y));

  const losersBottom = losersCardsTop + 8 * ROW_PITCH - (ROW_PITCH - CARD_H);

  // ----- Grand Final -----
  // Vertically centered between W15 and L30, at the rightmost column
  const w15 = positions.get('W15')!;
  const l30 = positions.get('L30')!;
  const gfY = (w15.y + l30.y + CARD_H - GF_CARD_H) / 2;
  const grandFinal: MatchPosition = {
    matchId: 'GF',
    x: colX(GF_COL),
    y: gfY,
    width: GF_CARD_W,
    height: GF_CARD_H,
  };
  positions.set('GF', grandFinal);

  // ----- Section headers -----
  const winnersHeaders: RoundHeaderSlot[] = [
    { side: 'winners', label: 'Round 1',  x: colX(WINNERS_COL_BY_ROUND[1]), width: CARD_W },
    { side: 'winners', label: 'Quarters', x: colX(WINNERS_COL_BY_ROUND[2]), width: CARD_W },
    { side: 'winners', label: 'Semis',    x: colX(WINNERS_COL_BY_ROUND[3]), width: CARD_W },
    { side: 'winners', label: 'Final',    x: colX(WINNERS_COL_BY_ROUND[4]), width: CARD_W },
  ];
  const losersLabels = [
    'Round 1',
    'Round 2',
    'Round 3',
    'Round 4',
    'Round 5',
    'Quarters',
    'Semi',
    'Final',
  ];
  const losersHeaders: RoundHeaderSlot[] = losersLabels.map((label, i) => ({
    side: 'losers',
    label,
    x: colX(LOSERS_COL_BY_ROUND[i + 1]),
    width: CARD_W,
  }));

  // Compute total bounds
  let maxX = grandFinal.x + grandFinal.width;
  let maxY = Math.max(losersBottom, grandFinal.y + grandFinal.height);
  positions.forEach((p) => {
    if (p.x + p.width > maxX) maxX = p.x + p.width;
    if (p.y + p.height > maxY) maxY = p.y + p.height;
  });

  return {
    positions,
    winnersHeaders,
    losersHeaders,
    grandFinal,
    width: maxX + CANVAS_PAD_X,
    height: maxY + CANVAS_PAD_BOTTOM,
    winnersHeaderY,
    losersHeaderY,
    winnersBottom,
    losersTop: losersHeaderY,
    cardWidth: CARD_W,
    cardHeight: CARD_H,
  };

  // -------------------------------------------------------------------------
  // Local helpers (closure over `positions`)
  // -------------------------------------------------------------------------
  function makePos(id: string, round: number, y: number): MatchPosition {
    return {
      matchId: id,
      x: colX(WINNERS_COL_BY_ROUND[round]),
      y,
      width: CARD_W,
      height: CARD_H,
    };
  }
  function makeLPos(id: string, round: number, y: number): MatchPosition {
    return {
      matchId: id,
      x: colX(LOSERS_COL_BY_ROUND[round]),
      y,
      width: CARD_W,
      height: CARD_H,
    };
  }
  function setMidpoint(id: string, a: string, b: string, round: number) {
    const pa = positions.get(a)!;
    const pb = positions.get(b)!;
    positions.set(id, makePos(id, round, (pa.y + pb.y) / 2));
  }
  function setMidpointL(id: string, a: string, b: string, round: number) {
    const pa = positions.get(a)!;
    const pb = positions.get(b)!;
    positions.set(id, makeLPos(id, round, (pa.y + pb.y) / 2));
  }
}

// ---------------------------------------------------------------------------
// Connector lines
// ---------------------------------------------------------------------------
export interface Connector {
  fromId: string;
  toId: string;
  kind: 'winner' | 'loser';
  d: string; // SVG path
}

/**
 * Build connector paths for the bracket. By default we draw "winner" lines
 * (the orthogonal flow of advancing players) and skip the cross-bracket
 * "loser" drop lines, which would clutter the diagram.
 */
export function computeConnectors(layout: BracketLayout): Connector[] {
  const result: Connector[] = [];
  const { positions } = layout;

  for (const [fromId, routing] of Object.entries(MATCH_ROUTING)) {
    const from = positions.get(fromId);
    if (!from) continue;

    if (routing.winnerTo) {
      const to = positions.get(routing.winnerTo.matchId);
      if (to) {
        result.push({
          fromId,
          toId: routing.winnerTo.matchId,
          kind: 'winner',
          d: orthogonalPath(from, to, routing.winnerTo.slot),
        });
      }
    }
  }

  return result;
}

function orthogonalPath(
  from: MatchPosition,
  to: MatchPosition,
  toSlot: 'player1' | 'player2'
): string {
  const x1 = from.x + from.width;
  const y1 = from.y + from.height / 2;
  const x2 = to.x;
  // Aim at the corresponding slot of the target card so two siblings
  // end up flowing into the top vs bottom slot cleanly.
  const slotOffset = toSlot === 'player1' ? to.height * 0.27 : to.height * 0.73;
  const y2 = to.y + slotOffset;
  const midX = x1 + (x2 - x1) / 2;
  return `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`;
}
