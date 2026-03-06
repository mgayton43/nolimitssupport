'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Loader2, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SetPasswordPage() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    // The Supabase client automatically detects tokens in the URL hash
    // (#access_token=xxx&refresh_token=xxx) and establishes a session.
    // We just need to listen for the auth state change.

    console.log('[SetPassword] Page loaded, checking for session...');
    console.log('[SetPassword] URL hash present:', typeof window !== 'undefined' && !!window.location.hash);

    let timeoutId: NodeJS.Timeout;

    // Listen for auth state changes - this fires when Supabase processes the hash tokens
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[SetPassword] Auth event:', event, 'Session:', !!session);

      if (session) {
        console.log('[SetPassword] Session established for:', session.user.email);
        setUserEmail(session.user.email || null);
        setIsCheckingSession(false);
        // Clear the timeout since we got a session
        if (timeoutId) clearTimeout(timeoutId);
      }
    });

    // Also check for existing session immediately
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('[SetPassword] Initial session check:', !!session);

      if (session) {
        setUserEmail(session.user.email || null);
        setIsCheckingSession(false);
      }
    };

    checkSession();

    // Give Supabase time to process the hash fragment
    // If no session after 3 seconds, show error
    timeoutId = setTimeout(() => {
      if (isCheckingSession) {
        console.log('[SetPassword] Timeout - no session established');
        setError('Invalid or expired invitation link. Please request a new invite.');
        setIsCheckingSession(false);
      }
    }, 3000);

    return () => {
      subscription.unsubscribe();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [supabase.auth, isCheckingSession]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        console.error('[SetPassword] Update password error:', updateError);
        setError(updateError.message);
        setIsLoading(false);
        return;
      }

      console.log('[SetPassword] Password updated successfully');
      setIsSuccess(true);

      setTimeout(() => {
        router.push('/tickets');
        router.refresh();
      }, 1500);
    } catch (err) {
      console.error('[SetPassword] Unexpected error:', err);
      setError('An unexpected error occurred');
      setIsLoading(false);
    }
  };

  if (isCheckingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
            <p className="mt-4 text-sm text-zinc-500">Verifying invitation...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <h2 className="mt-4 text-xl font-semibold">Password Set Successfully!</h2>
            <p className="mt-2 text-sm text-zinc-500">Redirecting you to the dashboard...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900">
            <KeyRound className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl">Set Your Password</CardTitle>
          <CardDescription>
            {userEmail ? (
              <>Welcome! Create a password for <strong>{userEmail}</strong></>
            ) : (
              'Create a password to complete your account setup'
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && !userEmail ? (
            <div className="space-y-4">
              <div className="rounded-md bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                {error}
              </div>
              <Button
                onClick={() => router.push('/login')}
                className="w-full"
                variant="outline"
              >
                Go to Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  {error}
                </div>
              )}
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="confirmPassword" className="text-sm font-medium">
                  Confirm Password
                </label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Re-enter your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Setting Password...
                  </>
                ) : (
                  'Set Password & Continue'
                )}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
