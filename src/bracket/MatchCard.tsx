import type { Match, Player } from './types';

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
}: MatchCardProps) {
  const ready = !!(player1 && player2);
  const completed = match.winnerId !== null;
  const live = match.status === 'live';
  const adminMode = !!onAdminEdit;

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
        onClick={() => player1 && onPick?.(match.id, player1.id)}
      />
      <PlayerSlot
        player={player2}
        isWinner={completed && match.winnerId === match.player2Id}
        isLoser={completed && match.winnerId !== match.player2Id}
        clickable={slotsClickable}
        score={s2}
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
  onClick: () => void;
}

function PlayerSlot({
  player,
  isWinner,
  isLoser,
  clickable,
  score,
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
    </div>
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
