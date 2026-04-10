import { useAuth } from '../auth/AuthContext';

/**
 * Top header with logo, Twitch login button, and admin badge.
 */
export function Header() {
  const {
    user,
    twitchDisplayName,
    twitchAvatarUrl,
    isAdmin,
    loading,
    signInWithTwitch,
    signOut,
  } = useAuth();

  return (
    <header className="flex items-center justify-between mb-8 gap-4">
      <div>
        <h1 className="bracket-title">DRL Bracket Challenge</h1>
        <p className="text-white/60 text-sm mt-1">
          32-player double elimination · live results
        </p>
      </div>

      <div className="flex items-center gap-3">
        {loading ? (
          <span className="text-white/40 text-sm">Loading…</span>
        ) : user ? (
          <UserPill
            displayName={twitchDisplayName ?? 'User'}
            avatarUrl={twitchAvatarUrl}
            isAdmin={isAdmin}
            onSignOut={signOut}
          />
        ) : (
          <TwitchLoginButton onClick={signInWithTwitch} />
        )}
      </div>
    </header>
  );
}

function TwitchLoginButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-4 py-2 rounded-md bg-twitch-purple hover:bg-twitch-purple-dark transition text-sm font-semibold shadow-lg shadow-twitch-purple/20"
    >
      <TwitchGlitchIcon className="w-4 h-4" />
      Login with Twitch
    </button>
  );
}

function UserPill({
  displayName,
  avatarUrl,
  isAdmin,
  onSignOut,
}: {
  displayName: string;
  avatarUrl: string | null;
  isAdmin: boolean;
  onSignOut: () => void;
}) {
  return (
    <div className="flex items-center gap-3 bg-bracket-surface border border-bracket-border rounded-full pl-1 pr-3 py-1">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt=""
          className="w-8 h-8 rounded-full border border-bracket-border"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-twitch-purple flex items-center justify-center text-xs font-bold">
          {displayName.slice(0, 1).toUpperCase()}
        </div>
      )}
      <span className="text-sm font-medium">{displayName}</span>
      {isAdmin && (
        <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-bracket-gold text-black">
          Admin
        </span>
      )}
      <button
        onClick={onSignOut}
        className="text-xs text-white/50 hover:text-white transition ml-1"
      >
        Sign out
      </button>
    </div>
  );
}

function TwitchGlitchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M4 2l-2 4v16h6v3h3l3-3h5l5-5V2H4zm17 12l-3 3h-5l-3 3v-3H6V4h15v10zm-3-7v6h-2V7h2zm-5 0v6h-2V7h2z" />
    </svg>
  );
}
