'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient, User, AuthChangeEvent, Session } from '@supabase/supabase-js';
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

// Module-level singleton - created once, reused across all renders
let globalSupabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!globalSupabase) {
    globalSupabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return globalSupabase;
}

// Fetch profile - standalone function to avoid dependency issues
async function fetchProfileData(userId: string): Promise<Profile | null> {
  const supabase = getSupabase();
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, team:teams(*)')
      .eq('id', userId)
      .single();

    if (error) {
      console.error('[Auth] Profile error:', error.message);
      return null;
    }

    return data as unknown as Profile;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      return null; // Expected during cleanup
    }
    console.error('[Auth] Profile exception:', err);
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Use ref to track initialization - doesn't trigger re-renders
  const initRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    const supabase = getSupabase();

    // Handler for auth state changes
    const handleAuthChange = async (event: AuthChangeEvent, session: Session | null) => {
      console.log('[Auth] Event:', event);

      if (!mountedRef.current) return;

      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const profileData = await fetchProfileData(currentUser.id);
        if (mountedRef.current) {
          console.log('[Auth] Profile loaded:', profileData?.role);
          setProfile(profileData);
        }
      } else {
        setProfile(null);
      }

      if (mountedRef.current) {
        setIsLoading(false);
      }
    };

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(handleAuthChange);

    // Then do initial check (only once)
    if (!initRef.current) {
      initRef.current = true;
      console.log('[Auth] Initial check...');

      supabase.auth.getSession().then(({ data: { session }, error }) => {
        if (error) {
          console.error('[Auth] Session error:', error.message);
          if (mountedRef.current) {
            setIsLoading(false);
          }
          return;
        }

        // If we got a session, the onAuthStateChange will handle it
        // If no session, we need to clear loading state
        if (!session && mountedRef.current) {
          console.log('[Auth] No session');
          setIsLoading(false);
        }
      }).catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') {
          console.log('[Auth] Session check aborted');
          return;
        }
        console.error('[Auth] Session check error:', err);
        if (mountedRef.current) {
          setIsLoading(false);
        }
      });
    }

    return () => {
      console.log('[Auth] Cleanup');
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []); // Empty deps - only run once on mount

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const profileData = await fetchProfileData(user.id);
    if (profileData) {
      setProfile(profileData);
    }
  }, [user]);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, []);

  const contextValue = useMemo(() => ({
    user,
    profile,
    isLoading,
    signOut,
    refreshProfile,
  }), [user, profile, isLoading, signOut, refreshProfile]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
