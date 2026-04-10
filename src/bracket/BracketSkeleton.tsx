import { useMemo } from 'react';
import { computeLayout } from './layout';

/**
 * Loading skeleton that mirrors the real bracket layout. Renders 46 empty
 * cards at their final positions so the layout doesn't jump when data
 * arrives — just a soft pulsing rectangle in each slot.
 */
export function BracketSkeleton() {
  const layout = useMemo(() => computeLayout(), []);
  const positions = Array.from(layout.positions.values());

  return (
    <div
      className="bracket-canvas relative bracket-skeleton"
      style={{ width: layout.width, height: layout.height }}
      aria-busy="true"
      aria-label="Loading bracket"
    >
      {/* Section divider band */}
      <div
        className="absolute left-0 right-0 pointer-events-none"
        style={{
          top: layout.winnersBottom + 16,
          height: layout.losersTop - layout.winnersBottom - 32,
          background:
            'linear-gradient(180deg, transparent 0%, rgba(240,185,11,0.04) 50%, transparent 100%)',
          borderTop: '1px solid rgba(240, 185, 11, 0.12)',
          borderBottom: '1px solid rgba(240, 185, 11, 0.12)',
        }}
      />

      {/* Pulsing skeleton cards */}
      {positions.map((p, i) => (
        <div
          key={p.matchId}
          className="absolute skeleton-card"
          style={{
            left: p.x,
            top: p.y,
            width: p.width,
            height: p.height,
            animationDelay: `${(i % 16) * 60}ms`,
          }}
        />
      ))}
    </div>
  );
}
