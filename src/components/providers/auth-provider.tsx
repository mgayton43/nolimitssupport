'use client';

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/lib/supabase/types';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  isLoading: true,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Use useState with lazy initializer to create client ONCE
  const [supabase] = useState(() => createClient());

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authInitialized, setAuthInitialized] = useState(false);

  // Fetch profile - stable function that doesn't change
  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    console.log('[Auth] Fetching profile for:', userId);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, team:teams(*)')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('[Auth] Profile fetch error:', error.message);
        return null;
      }

      const profile = data as Profile;
      console.log('[Auth] Profile loaded:', profile?.email, 'role:', profile?.role);
      return profile;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return null;
      }
      console.error('[Auth] Profile fetch exception:', err);
      return null;
    }
  }, [supabase]);

  // Initialize auth on mount
  useEffect(() => {
    let isCancelled = false;

    const initialize = async () => {
      console.log('[Auth] Initializing...');

      try {
        const { data: { user: authUser }, error } = await supabase.auth.getUser();

        if (isCancelled) return;

        if (error) {
          console.error('[Auth] getUser error:', error.message);
          setIsLoading(false);
          setAuthInitialized(true);
          return;
        }

        console.log('[Auth] User:', authUser?.email || 'none');
        setUser(authUser);

        if (authUser) {
          const profileData = await fetchProfile(authUser.id);
          if (!isCancelled && profileData) {
            setProfile(profileData);
          } else if (!isCancelled) {
            console.warn('[Auth] No profile found for user');
          }
        }
      } catch (err) {
        console.error('[Auth] Init error:', err);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
          setAuthInitialized(true);
        }
      }
    };

    initialize();

    // Listen for auth changes AFTER initial load
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[Auth] State change:', event);

        if (isCancelled) return;

        // Only handle changes after initialization
        if (!authInitialized && event === 'INITIAL_SESSION') {
          return; // Skip - we handle this in initialize()
        }

        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          const profileData = await fetchProfile(currentUser.id);
          if (!isCancelled) {
            setProfile(profileData);
          }
        } else {
          setProfile(null);
        }

        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    );

    return () => {
      console.log('[Auth] Cleanup');
      isCancelled = true;
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile, authInitialized]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, [supabase]);

  // Memoize context value to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    user,
    profile,
    isLoading,
    signOut,
  }), [user, profile, isLoading, signOut]);

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
