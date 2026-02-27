'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient, User, Session } from '@supabase/supabase-js';
import type { Profile } from '@/lib/supabase/types';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isLoading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

// Module-level singleton - created ONCE, never recreated
let supabaseClient: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return supabaseClient;
}

// Fetch profile - standalone function, handles all errors silently
async function fetchProfile(userId: string): Promise<Profile | null> {
  try {
    const { data, error } = await getSupabaseClient()
      .from('profiles')
      .select('*, team:teams(*)')
      .eq('id', userId)
      .single();

    if (error) return null;
    return data as unknown as Profile;
  } catch {
    // Silently handle all errors including AbortError
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const mountedRef = useRef(true);
  const initializedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    // Only initialize once
    if (initializedRef.current) return;
    initializedRef.current = true;

    const supabase = getSupabaseClient();

    // Auth state change handler
    const handleSession = async (session: Session | null) => {
      if (!mountedRef.current) return;

      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const profileData = await fetchProfile(currentUser.id);
        if (mountedRef.current) {
          setProfile(profileData);
        }
      } else {
        setProfile(null);
      }

      if (mountedRef.current) {
        setIsLoading(false);
      }
    };

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => handleSession(session)
    );

    // Initial session check
    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        // Only handle if onAuthStateChange hasn't fired yet
        if (mountedRef.current && isLoading) {
          handleSession(session);
        }
      })
      .catch(() => {
        // Silently handle errors
        if (mountedRef.current) {
          setIsLoading(false);
        }
      });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const profileData = await fetchProfile(user.id);
    if (profileData) {
      setProfile(profileData);
    }
  }, [user]);

  const signOut = useCallback(async () => {
    try {
      await getSupabaseClient().auth.signOut();
    } catch {
      // Ignore errors
    }
    setUser(null);
    setProfile(null);
  }, []);

  const value = useMemo(() => ({
    user,
    profile,
    isLoading,
    signOut,
    refreshProfile,
  }), [user, profile, isLoading, signOut, refreshProfile]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
