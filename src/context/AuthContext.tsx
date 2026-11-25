/**
 * Customer auth state (Step 3).
 *
 * Wraps Supabase Auth (@supabase/ssr browser client). When Supabase is
 * NOT configured, `configured` is false and every auth page shows a clear
 * notice instead of a broken form — accounts need the Supabase project
 * (see README). Guest checkout and guest order tracking always work.
 */
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/data/store-client";
import type { Profile } from "@/lib/types";

interface AuthContextValue {
  configured: boolean;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  /** Id of the user whose profile has been loaded (null = none yet). */
  const [profileUserId, setProfileUserId] = useState<string | null>(null);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();
      setProfile((data as unknown as Profile | null) ?? null);
    } catch {
      setProfile(null);
    } finally {
      setProfileUserId(userId);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    await fetchProfile(user.id);
  }, [user, fetchProfile]);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }
    const supabase = createClient();
    let cancelled = false;
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        const sessionUser = data.session?.user ?? null;
        if (cancelled) return;
        setUser(sessionUser);
        // Wait for the profile before clearing `loading`: the admin
        // guard shows "Access denied" while user is set but profile is
        // still null, so clearing loading first flashes a denial on
        // every fresh page load.
        if (sessionUser) await fetchProfile(sessionUser.id);
        if (!cancelled) setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) void fetchProfile(session.user.id);
      else {
        setProfile(null);
        setProfileUserId(null);
      }
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [configured, fetchProfile]);

  const signOut = useCallback(async () => {
    if (!configured) return;
    await createClient().auth.signOut();
    setUser(null);
    setProfile(null);
    setProfileUserId(null);
  }, [configured]);

  // Loading covers the profile too: while a signed-in user has no
  // profile loaded yet, guards must wait instead of deciding the user
  // is not an admin. Signed-out users have nothing to load.
  const loadingWithProfile = loading || (user !== null && profileUserId !== user.id);

  const value = useMemo<AuthContextValue>(
    () => ({ configured, user, profile, loading: loadingWithProfile, signOut, refreshProfile }),
    [configured, user, profile, loadingWithProfile, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
