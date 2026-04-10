import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

/**
 * Auth context tracking the current Supabase session, the logged-in user,
 * and whether they're recognized as an admin.
 *
 * Admin status is determined by checking the `admins` table for the user's
 * Twitch provider id. The client-side flag is purely for UI gating —
 * Row-Level Security on the database is the actual security boundary.
 */

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  twitchUserId: string | null;
  twitchLogin: string | null;
  twitchDisplayName: string | null;
  twitchAvatarUrl: string | null;
  isAdmin: boolean;
  loading: boolean;
  signInWithTwitch: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Bootstrap: fetch existing session + subscribe to auth changes
  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
      }
    );

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const user = session?.user ?? null;

  // Twitch metadata is on user.user_metadata after OAuth login
  const meta = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const twitchUserId = (meta.provider_id as string) ?? (meta.sub as string) ?? null;
  const twitchLogin =
    (meta.nickname as string) ??
    (meta.preferred_username as string) ??
    (meta.user_name as string) ??
    null;
  const twitchDisplayName =
    (meta.full_name as string) ??
    (meta.name as string) ??
    twitchLogin ??
    null;
  const twitchAvatarUrl =
    (meta.avatar_url as string) ?? (meta.picture as string) ?? null;

  // Check admin status whenever the Twitch user id changes
  useEffect(() => {
    if (!twitchUserId) {
      setIsAdmin(false);
      return;
    }

    let cancelled = false;
    supabase
      .from('admins')
      .select('twitch_user_id')
      .eq('twitch_user_id', twitchUserId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          // eslint-disable-next-line no-console
          console.warn('[auth] admin lookup failed:', error.message);
          setIsAdmin(false);
          return;
        }
        setIsAdmin(!!data);
      });

    return () => {
      cancelled = true;
    };
  }, [twitchUserId]);

  const signInWithTwitch = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'twitch',
      options: {
        // Return to the current page after OAuth round-trip
        redirectTo: window.location.origin + window.location.pathname,
      },
    });
    if (error) {
      // eslint-disable-next-line no-console
      console.error('[auth] Twitch sign-in failed:', error.message);
      alert('Twitch sign-in failed: ' + error.message);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsAdmin(false);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      twitchUserId,
      twitchLogin,
      twitchDisplayName,
      twitchAvatarUrl,
      isAdmin,
      loading,
      signInWithTwitch,
      signOut,
    }),
    [
      session,
      user,
      twitchUserId,
      twitchLogin,
      twitchDisplayName,
      twitchAvatarUrl,
      isAdmin,
      loading,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
