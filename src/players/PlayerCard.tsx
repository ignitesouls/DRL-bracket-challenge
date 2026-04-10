import { type PlayerStats, bestSeed } from './playerData';

interface Props {
  player: PlayerStats;
  expanded: boolean;
  onToggle: () => void;
}

/**
 * A single player card. Collapsed by default: shows avatar, rank, name,
 * flag, country, and a twitch link. Clicking the header expands to reveal
 * qualifier seed scores, RAGE/BAIT/Consistency pills, tournament reach
 * bars, and a small meta grid. Mirrors the layout of the HTML dashboard's
 * player card.
 */
export function PlayerCard({ player, expanded, onToggle }: Props) {
  const isWinners = player.bracketEntry === 'Winners';
  const best = bestSeed(player.seeds);
  const initials = player.name.slice(0, 2).toUpperCase();

  return (
    <div className={`pcard${expanded ? ' pcard--open' : ''}`}>
      <button
        type="button"
        className="pcard__head"
        onClick={onToggle}
        aria-expanded={expanded}
      >
        <span className="pcard__expand" aria-hidden="true">
          ▸
        </span>
        <div className="pcard__avatar">
          {player.avatar ? (
            <img
              src={player.avatar}
              alt={player.name}
              onError={(e) => {
                const img = e.currentTarget;
                const parent = img.parentElement;
                if (parent) parent.textContent = initials;
              }}
            />
          ) : (
            <span>{initials}</span>
          )}
        </div>
        <span
          className={`pcard__rank${player.rank <= 16 ? ' pcard__rank--top16' : ''}`}
        >
          #{player.rank}
        </span>
        <div className="pcard__info">
          <div className="pcard__name">{player.name}</div>
          {player.country && (
            <div className="pcard__country">
              <FlagBox code={player.country} />
              <span>{player.countryName ?? player.country.toUpperCase()}</span>
            </div>
          )}
        </div>
        {player.twitch && (
          <a
            href={player.twitch}
            target="_blank"
            rel="noreferrer noopener"
            className="pcard__twitch"
            title={`${player.name} on Twitch`}
            onClick={(e) => e.stopPropagation()}
            aria-label={`${player.name} on Twitch`}
          >
            <TwitchIcon />
          </a>
        )}
      </button>

      {expanded && (
        <div className="pcard__detail">
          {/* ── Qualifier Seed Scores ─────────────────────────────── */}
          <div className="pcard__section">
            <div className="pcard__label">Qualifier Seed Scores</div>
            <div className="pcard__seed-bars">
              {player.seeds.map((score, i) => {
                const isBest = best !== null && i === best.index;
                if (score === null) {
                  return (
                    <div key={i} className="pcard__seed-col">
                      <div className="pcard__seed-bar pcard__seed-bar--null" />
                      <div className="pcard__seed-score pcard__seed-score--null">
                        —
                      </div>
                      <div className="pcard__seed-lbl">S{i + 1}</div>
                    </div>
                  );
                }
                const h = Math.round((Math.max(0, score) / 88) * 64);
                return (
                  <div key={i} className="pcard__seed-col">
                    <div
                      className={`pcard__seed-bar${isBest ? ' pcard__seed-bar--best' : ''}`}
                    >
                      <div
                        className="pcard__seed-bar-fill"
                        style={{
                          height: `${h}px`,
                          background: isBest
                            ? 'var(--c-gold-light)'
                            : scoreColor(score),
                        }}
                      />
                    </div>
                    <div
                      className={`pcard__seed-score${isBest ? ' pcard__seed-score--best' : ''}`}
                    >
                      {score}
                    </div>
                    <div className="pcard__seed-lbl">S{i + 1}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Model Stats (RAGE / BAIT / CONSISTENCY) ────────────── */}
          <div className="pcard__section">
            <div className="pcard__label">Model Stats</div>
            <div className="pcard__pills">
              <StatPill
                variant="rage"
                label="Rage Factor"
                value={formatNumber(player.rage, 1)}
              />
              <StatPill
                variant="bait"
                label="Bait Chance"
                value={formatNumber(player.bait, 1)}
              />
              <StatPill
                variant="cons"
                label="Consistency"
                value={formatNumber(player.cons, 3)}
              />
            </div>
          </div>

          {/* ── Tournament Reach ─────────────────────────────────── */}
          <div className="pcard__section">
            <div className="pcard__label">Tournament Reach</div>
            <div className="pcard__reach">
              <ReachRow label="Top 16" pct={player.reach.top16} tone="accent" />
              <ReachRow label="Top 8" pct={player.reach.top8} tone="accent" />
              <ReachRow label="Top 4" pct={player.reach.top4} tone="gold" />
              <ReachRow
                label="Finalist"
                pct={player.reach.finalist}
                tone="gold"
              />
              <ReachRow
                label="Champion"
                pct={player.reach.champion}
                tone="green"
              />
            </div>
          </div>

          {/* ── Meta grid (right-hand column) ────────────────────── */}
          <div className="pcard__meta">
            <span className="pcard__meta-key">Qual. rank</span>
            <span className="pcard__meta-val">#{player.rank}</span>
            <span className="pcard__meta-key">Total score</span>
            <span className="pcard__meta-val">{player.total}</span>
            <span className="pcard__meta-key">Best seed</span>
            <span className="pcard__meta-val">
              {best ? `${best.score} · Seed ${best.index + 1}` : '—'}
            </span>
            <span className="pcard__meta-key">Bracket entry</span>
            <span
              className="pcard__meta-val"
              style={{
                color: isWinners ? 'var(--c-winners, #4a9f6a)' : 'var(--c-red)',
              }}
            >
              {player.bracketEntry}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small subcomponents

function StatPill({
  variant,
  label,
  value,
}: {
  variant: 'rage' | 'bait' | 'cons';
  label: string;
  value: string;
}) {
  return (
    <div className={`pcard__pill pcard__pill--${variant}`}>
      <span className="pcard__pill-label">{label}</span>
      <span className="pcard__pill-value">{value}</span>
    </div>
  );
}

function ReachRow({
  label,
  pct,
  tone,
}: {
  label: string;
  pct: number;
  tone: 'accent' | 'gold' | 'green';
}) {
  const percent = pct * 100;
  const shown =
    percent > 0 && percent < 0.05
      ? '<0.1%'
      : `${percent.toFixed(1)}%`;
  const color =
    tone === 'gold'
      ? 'var(--c-gold-light)'
      : tone === 'green'
        ? 'var(--c-winners, #4a9f6a)'
        : 'var(--c-twitch)';
  return (
    <div className="pcard__reach-row">
      <span className="pcard__reach-label">{label}</span>
      <div className="pcard__reach-bar">
        <div
          className="pcard__reach-fill"
          style={{ width: `${Math.max(percent, percent > 0 ? 0.5 : 0)}%`, background: color }}
        />
      </div>
      <span className="pcard__reach-pct">{shown}</span>
    </div>
  );
}

function FlagBox({ code }: { code: string }) {
  // Use flagcdn.com — no bundled assets, serves proper flag PNGs keyed by
  // 2-letter ISO country code. 2x size for retina, rendered at 20x15.
  const lower = code.toLowerCase();
  return (
    <img
      className="pcard__flag-img"
      src={`https://flagcdn.com/40x30/${lower}.png`}
      srcSet={`https://flagcdn.com/80x60/${lower}.png 2x`}
      width={20}
      height={15}
      alt={code.toUpperCase()}
      loading="lazy"
    />
  );
}

function TwitchIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M3 0 1 4v11h4v2h3l2-2h3l5-5V0H3zm2 2h11v7l-3 3h-3l-2 2v-2H5V2z" />
      <path d="M7 5h1.5v4H7V5zm4 0h1.5v4H11V5z" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Helpers

function formatNumber(n: number | null, digits: number): string {
  if (n === null || Number.isNaN(n)) return '—';
  return n.toFixed(digits);
}

/** Gradient from red→amber→green based on qualifier score (0–88 scale). */
function scoreColor(score: number): string {
  if (score >= 80) return '#4a9f6a';
  if (score >= 70) return '#8ab34a';
  if (score >= 55) return '#d9a441';
  if (score >= 35) return '#c87843';
  return '#a14848';
}
