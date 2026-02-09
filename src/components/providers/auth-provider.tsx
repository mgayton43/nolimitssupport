'use client';

import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
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
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Use ref to store supabase client so it doesn't change between renders
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);

  // Fetch profile helper - memoized to prevent recreating on each render
  const fetchProfile = useCallback(async (userId: string): Promise<Profile | null> => {
    console.log('AuthProvider: Fetching profile for userId:', userId);
    try {
      const { data, error, status } = await supabase
        .from('profiles')
        .select('*, team:teams(*)')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Profile fetch error:', error.message, 'code:', error.code, 'details:', error.details);
        return null;
      }

      console.log('AuthProvider: Profile fetched successfully, role:', (data as Profile)?.role);
      return data as Profile;
    } catch (err) {
      // Ignore AbortError - happens when request is cancelled
      if (err instanceof Error && err.name === 'AbortError') {
        console.log('Profile fetch aborted (component unmounted)');
        return null;
      }
      console.error('Profile fetch exception:', err);
      return null;
    }
  }, [supabase]);

  useEffect(() => {
    isMountedRef.current = true;
    let isInitialLoad = true;

    const initializeAuth = async () => {
      try {
        console.log('AuthProvider: Initializing auth...');

        const { data, error } = await supabase.auth.getUser();
        const user = data?.user ?? null;

        console.log('AuthProvider: getUser result - hasUser:', !!user, 'email:', user?.email, 'error:', error?.message || 'none');

        if (error) {
          // Ignore AbortError
          if (error.message?.includes('AbortError') || error.name === 'AbortError') {
            console.log('Auth getUser aborted');
            return;
          }
          console.error('Auth getUser error:', error.message, 'status:', error.status);
          if (isMountedRef.current) {
            setIsLoading(false);
          }
          return;
        }

        if (!isMountedRef.current) return;

        console.log('AuthProvider: Setting user state:', user?.email || 'null');
        setUser(user);

        if (user) {
          const profileData = await fetchProfile(user.id);
          if (isMountedRef.current && profileData) {
            console.log('AuthProvider: Profile loaded:', profileData.role);
            setProfile(profileData);
          }
        }
      } catch (err) {
        // Ignore AbortError
        if (err instanceof Error && err.name === 'AbortError') {
          console.log('Auth init aborted');
          return;
        }
        console.error('Auth init error:', err);
      } finally {
        if (isMountedRef.current && isInitialLoad) {
          setIsLoading(false);
          isInitialLoad = false;
        }
      }
    };

    initializeAuth();

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('AuthProvider: Auth state changed:', event);

        if (!isMountedRef.current) return;

        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          const profileData = await fetchProfile(currentUser.id);
          if (isMountedRef.current && profileData) {
            setProfile(profileData);
          }
        } else {
          setProfile(null);
        }

        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    );

    return () => {
      console.log('AuthProvider: Cleaning up...');
      isMountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  }, [supabase]);

  return (
    <AuthContext.Provider value={{ user, profile, isLoading, signOut }}>
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
