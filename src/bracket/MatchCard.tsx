import type { Match, Player } from './types';
import { getWinProbability } from '../players/playerData';

interface MatchCardProps {
  match: Match;
  player1: Player | null;
  player2: Player | null;
  onPick?: (matchId: string, winnerId: string) => void;
  /**
   * Admin click handler. When provided, the entire card becomes clickable
   * (rather than individual player slots). Takes precedence over onPick.
   */
  onAdminEdit?: (matchId: string) => void;
  variant?: 'normal' | 'grand-final';
  /**
   * Predictions view: lock the card so the user can't change a pick once
   * the actual match has gone live or finished.
   */
  locked?: boolean;
  /**
   * Predictions view: when the user has a pick on this match and the actual
   * match is resolved, mark the pick as correct or incorrect.
   */
  pickResult?: 'correct' | 'incorrect' | null;
  /**
   * Current epoch time, ticked from BracketCanvas. Used to render the
   * "IN 2H 14M" countdown for matches that have a scheduled start time.
   */
  now?: number;
}

/**
 * Polished match card. Renders match metadata bar + two player slots.
 *
 * Visual states:
 *   - is-ready    — both players known, no winner picked yet (clickable)
 *   - is-live     — match.status === 'live' (gold pulse)
 *   - is-completed— winner picked
 *   - is-grand-final — special widened card with gold border
 *   - is-locked   — predictions view, the underlying actual match is sealed
 *   - is-correct / is-incorrect — predictions view, scoring overlay
 */
export function MatchCard({
  match,
  player1,
  player2,
  onPick,
  onAdminEdit,
  variant = 'normal',
  locked = false,
  pickResult = null,
  now,
}: MatchCardProps) {
  const ready = !!(player1 && player2);
  const completed = match.winnerId !== null;
  const live = match.status === 'live';
  const adminMode = !!onAdminEdit;
  // Countdown only applies when there's a scheduled start that hasn't been
  // reached yet, the match isn't already live, and isn't completed.
  const countdown =
    !live && !completed && match.scheduledAt && now !== undefined
      ? formatCountdown(match.scheduledAt, now)
      : null;
  const startingSoon = countdown === 'STARTING SOON';

  const classes = [
    'match-card',
    variant === 'grand-final' && 'is-grand-final',
    adminMode && 'is-admin',
    locked && 'is-locked',
    pickResult === 'correct' && 'is-correct',
    pickResult === 'incorrect' && 'is-incorrect',
    ready && !completed && !adminMode && !locked && 'is-ready',
    completed && 'is-completed',
    live && 'is-live',
  ]
    .filter(Boolean)
    .join(' ');

  const [s1, s2] = parseScore(match.score);
  const slotsClickable = !adminMode && !locked && ready && !!onPick;

  // Win % badges — only when both slots are filled and the match isn't yet
  // completed. Looked up from the simulator's pairwise table by displayName.
  const odds =
    ready && !completed && player1 && player2
      ? getWinProbability(player1.displayName, player2.displayName)
      : null;
  const p1Pct = odds ? Math.round(odds.aWin * 100) : null;
  const p2Pct = odds ? Math.round(odds.bWin * 100) : null;
  const p1IsFav = odds !== null && odds.aWin >= odds.bWin;

  return (
    <div
      className={classes}
      onClick={adminMode ? () => onAdminEdit!(match.id) : undefined}
      style={adminMode ? { cursor: 'pointer' } : undefined}
    >
      <div className="match-meta">
        <span className="match-meta__id">{match.id}</span>
        {locked ? (
          <span className="match-meta__locked">
            <LockIcon /> LOCKED
          </span>
        ) : live ? (
          <span className="match-meta__live">LIVE</span>
        ) : countdown ? (
          <span
            className={
              'match-meta__countdown' +
              (startingSoon ? ' is-imminent' : '')
            }
          >
            <ClockIcon /> {countdown}
          </span>
        ) : (
          <span>{shortRoundLabel(match.roundLabel)}</span>
        )}
      </div>

      <PlayerSlot
        player={player1}
        isWinner={completed && match.winnerId === match.player1Id}
        isLoser={completed && match.winnerId !== match.player1Id}
        clickable={slotsClickable}
        score={s1}
        winPct={p1Pct}
        isFavorite={odds !== null && p1IsFav}
        onClick={() => player1 && onPick?.(match.id, player1.id)}
      />
      <PlayerSlot
        player={player2}
        isWinner={completed && match.winnerId === match.player2Id}
        isLoser={completed && match.winnerId !== match.player2Id}
        clickable={slotsClickable}
        score={s2}
        winPct={p2Pct}
        isFavorite={odds !== null && !p1IsFav}
        onClick={() => player2 && onPick?.(match.id, player2.id)}
      />
    </div>
  );
}

interface PlayerSlotProps {
  player: Player | null;
  isWinner: boolean;
  isLoser: boolean;
  clickable: boolean;
  score: string | null;
  /** Integer 0–100 of the model's win probability; null = hide. */
  winPct: number | null;
  /** When true, this slot is the model's favorite (>= 50%). */
  isFavorite: boolean;
  onClick: () => void;
}

function PlayerSlot({
  player,
  isWinner,
  isLoser,
  clickable,
  score,
  winPct,
  isFavorite,
  onClick,
}: PlayerSlotProps) {
  const classes = [
    'player-slot',
    !player && 'is-empty',
    isWinner && 'is-winner',
    isLoser && 'is-loser',
    clickable && 'is-clickable',
  ]
    .filter(Boolean)
    .join(' ');

  if (!player) {
    return (
      <div className={classes}>
        <span className="seed-badge">·</span>
        <span className="player-flag" style={{ background: '#1c1f33' }} />
        <span className="player-name">TBD</span>
      </div>
    );
  }

  return (
    <div className={classes} onClick={clickable ? onClick : undefined}>
      <span className="seed-badge">{player.seed}</span>
      <span
        className={`player-flag fi fi-${player.countryCode.toLowerCase()}`}
        aria-label={player.countryCode}
      />
      <span className="player-name">{player.displayName}</span>
      {score !== null && <span className="player-score">{score}</span>}
      {winPct !== null && score === null && (
        <span
          className={
            'player-win-pct' + (isFavorite ? ' is-favorite' : ' is-underdog')
          }
          title={`Model probability: ${winPct}%`}
        >
          {winPct}%
        </span>
      )}
    </div>
  );
}

function ClockIcon() {
  return (
    <svg
      width="9"
      height="9"
      viewBox="0 0 10 10"
      fill="none"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <circle cx="5" cy="5" r="4" stroke="currentColor" />
      <path d="M5 2.6V5l1.7 1" stroke="currentColor" strokeLinecap="round" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg
      width="9"
      height="11"
      viewBox="0 0 9 11"
      fill="none"
      style={{ display: 'inline-block', verticalAlign: 'middle' }}
    >
      <rect x="0.5" y="4.5" width="8" height="6" rx="0.5" stroke="currentColor" />
      <path
        d="M2.5 4.5V3a2 2 0 0 1 4 0v1.5"
        stroke="currentColor"
        fill="none"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
function parseScore(score: string | null): [string | null, string | null] {
  if (!score) return [null, null];
  const m = score.match(/^(\d+)\s*[-:]\s*(\d+)$/);
  if (!m) return [null, null];
  return [m[1], m[2]];
}

/**
 * Render a relative countdown to a scheduled match time. Returns null when
 * the time has already passed (the auto-live overlay should take over by
 * then). The output is uppercase and short enough to fit the meta strip.
 */
function formatCountdown(scheduledAtIso: string, now: number): string | null {
  const target = Date.parse(scheduledAtIso);
  if (Number.isNaN(target)) return null;
  const ms = target - now;
  if (ms <= 0) return null;
  const totalMin = Math.floor(ms / 60_000);
  if (totalMin < 5) return 'STARTING SOON';
  if (totalMin < 60) return `IN ${totalMin}M`;
  const totalHr = Math.floor(totalMin / 60);
  const remMin = totalMin % 60;
  if (totalHr < 24) {
    return remMin > 0 ? `IN ${totalHr}H ${remMin}M` : `IN ${totalHr}H`;
  }
  const totalDay = Math.floor(totalHr / 24);
  const remHr = totalHr % 24;
  return remHr > 0 ? `IN ${totalDay}D ${remHr}H` : `IN ${totalDay}D`;
}

function shortRoundLabel(label: string): string {
  return label
    .replace('Winners ', 'W')
    .replace('Losers ', 'L')
    .replace('Round ', 'R')
    .replace('Quarter', 'QF')
    .replace('Semi', 'SF')
    .replace('Final', 'F')
    .replace(/\s+/g, ' ');
}
