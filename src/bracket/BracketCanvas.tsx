import { useMemo } from 'react';
import type { Match, Player } from './types';
import { computeLayout, computeConnectors } from './layout';
import { MatchCard } from './MatchCard';

interface BracketCanvasProps {
  matches: Match[];
  playerById: Map<string, Player>;
  onPick?: (matchId: string, winnerId: string) => void;
  onAdminEdit?: (matchId: string) => void;
  /** Predictions view: match IDs whose actual status is live or completed. */
  lockedMatchIds?: Set<string>;
  /** Predictions view: per-match scoring overlay. */
  pickResultById?: Map<string, 'correct' | 'incorrect'>;
}

/**
 * Absolutely-positioned bracket canvas. Renders all 46 match cards plus
 * an SVG overlay for the orthogonal connector lines between them.
 *
 * The canvas is wider than the viewport on most screens — wrap this
 * in a horizontally scrollable container.
 */
export function BracketCanvas({
  matches,
  playerById,
  onPick,
  onAdminEdit,
  lockedMatchIds,
  pickResultById,
}: BracketCanvasProps) {
  const layout = useMemo(() => computeLayout(), []);
  const connectors = useMemo(() => computeConnectors(layout), [layout]);

  return (
    <div
      className="bracket-canvas relative"
      style={{ width: layout.width, height: layout.height }}
    >
      {/* Section divider band between Winners and Losers */}
      <div
        className="absolute left-0 right-0 pointer-events-none"
        style={{
          top: layout.winnersBottom + 16,
          height: layout.losersTop - layout.winnersBottom - 32,
          background:
            'linear-gradient(180deg, transparent 0%, rgba(240,185,11,0.05) 50%, transparent 100%)',
          borderTop: '1px solid rgba(240, 185, 11, 0.18)',
          borderBottom: '1px solid rgba(240, 185, 11, 0.18)',
        }}
      />

      {/* Round headers — Winners */}
      {layout.winnersHeaders.map((h, i) => (
        <div
          key={`wh-${i}`}
          className="absolute round-header"
          style={{ left: h.x, top: layout.winnersHeaderY, width: h.width }}
        >
          {h.label}
        </div>
      ))}

      {/* Side label — Winners */}
      <div
        className="absolute select-none pointer-events-none"
        style={{
          left: 12,
          top: layout.winnersHeaderY,
          height: layout.winnersBottom - layout.winnersHeaderY,
        }}
      >
        <SideLabel label="Winners" />
      </div>

      {/* Round headers — Losers */}
      {layout.losersHeaders.map((h, i) => (
        <div
          key={`lh-${i}`}
          className="absolute round-header"
          style={{ left: h.x, top: layout.losersHeaderY, width: h.width }}
        >
          {h.label}
        </div>
      ))}

      {/* Side label — Losers */}
      <div
        className="absolute select-none pointer-events-none"
        style={{
          left: 12,
          top: layout.losersHeaderY,
          height: layout.height - layout.losersHeaderY - 24,
        }}
      >
        <SideLabel label="Losers" />
      </div>

      {/* SVG connector overlay */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width={layout.width}
        height={layout.height}
        style={{ overflow: 'visible' }}
      >
        <defs>
          <linearGradient id="conn-grad" x1="0" x2="1" y1="0" y2="0">
            <stop offset="0%" stopColor="rgba(240,185,11,0.55)" />
            <stop offset="100%" stopColor="rgba(240,185,11,0.18)" />
          </linearGradient>
        </defs>
        {connectors.map((c, i) => (
          <path
            key={`${c.fromId}-${c.toId}`}
            d={c.d}
            fill="none"
            stroke="url(#conn-grad)"
            strokeWidth={1.5}
            strokeLinecap="square"
            strokeLinejoin="miter"
            pathLength={1}
            className="bracket-connector"
            style={{ animationDelay: `${300 + i * 14}ms` }}
          />
        ))}
      </svg>

      {/* Match cards */}
      {matches.map((m, i) => {
        const pos = layout.positions.get(m.id);
        if (!pos) return null;
        const p1 = m.player1Id ? playerById.get(m.player1Id) ?? null : null;
        const p2 = m.player2Id ? playerById.get(m.player2Id) ?? null : null;

        return (
          <div
            key={m.id}
            className="absolute card-enter"
            style={{
              left: pos.x,
              top: pos.y,
              width: pos.width,
              animationDelay: `${(i % 24) * 22}ms`,
            }}
          >
            <MatchCard
              match={m}
              player1={p1}
              player2={p2}
              onPick={onPick}
              onAdminEdit={onAdminEdit}
              variant={m.id === 'GF' ? 'grand-final' : 'normal'}
              locked={lockedMatchIds?.has(m.id) ?? false}
              pickResult={pickResultById?.get(m.id) ?? null}
            />
          </div>
        );
      })}

      {/* Grand Final eyebrow label above the GF card */}
      <div
        className="absolute pointer-events-none section-eyebrow"
        style={{
          left: layout.grandFinal.x,
          top: layout.grandFinal.y - 22,
          width: layout.grandFinal.width,
          textAlign: 'center',
          color: 'var(--c-gold)',
        }}
      >
        Grand Final · BO3
      </div>
    </div>
  );
}

function SideLabel({ label }: { label: string }) {
  return (
    <div
      className="font-display font-bold uppercase flex items-center justify-center h-full"
      style={{
        width: 24,
        fontSize: 11,
        letterSpacing: '0.36em',
        color: 'rgba(240,185,11,0.7)',
        writingMode: 'vertical-rl',
        transform: 'rotate(180deg)',
        whiteSpace: 'nowrap',
        borderLeft: '1px solid rgba(240,185,11,0.18)',
        paddingLeft: 6,
      }}
    >
      {label}
    </div>
  );
}
