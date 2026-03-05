'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { KeyRound, Loader2, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const handleAuth = async () => {
      // Check for error in URL params (from failed callback)
      const urlError = searchParams.get('error');
      if (urlError) {
        setError(decodeURIComponent(urlError));
        setIsCheckingSession(false);
        return;
      }

      // Check for token_hash in URL (Supabase invite/recovery link)
      const tokenHash = searchParams.get('token_hash');
      const type = searchParams.get('type');

      if (tokenHash && type) {
        console.log('[SetPassword] Verifying OTP token...');
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as 'invite' | 'recovery' | 'email',
        });

        if (verifyError) {
          console.error('[SetPassword] OTP verification failed:', verifyError);
          setError(verifyError.message);
          setIsCheckingSession(false);
          return;
        }
      }

      // Check for hash fragments (access_token in URL hash)
      if (typeof window !== 'undefined' && window.location.hash) {
        console.log('[SetPassword] Hash fragment detected, waiting for auth...');
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Now check for session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) {
        console.error('[SetPassword] Session error:', sessionError);
        setError(sessionError.message);
        setIsCheckingSession(false);
        return;
      }

      if (!session) {
        console.log('[SetPassword] No session found');
        setError('Invalid or expired invitation link. Please request a new invite.');
        setIsCheckingSession(false);
        return;
      }

      console.log('[SetPassword] Session found for:', session.user.email);
      setUserEmail(session.user.email || null);
      setIsCheckingSession(false);
    };

    handleAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[SetPassword] Auth state changed:', event);
      if (event === 'SIGNED_IN' && session) {
        setUserEmail(session.user.email || null);
        setIsCheckingSession(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [supabase.auth, searchParams]);

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
        setError(updateError.message);
        setIsLoading(false);
        return;
      }

      setIsSuccess(true);

      setTimeout(() => {
        router.push('/tickets');
        router.refresh();
      }, 1500);
    } catch {
      setError('An unexpected error occurred');
      setIsLoading(false);
    }
  };

  if (isCheckingSession) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
          <p className="mt-4 text-sm text-zinc-500">Verifying invitation...</p>
        </CardContent>
      </Card>
    );
  }

  if (isSuccess) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <CheckCircle className="h-12 w-12 text-green-500" />
          <h2 className="mt-4 text-xl font-semibold">Password Set Successfully!</h2>
          <p className="mt-2 text-sm text-zinc-500">Redirecting you to the dashboard...</p>
        </CardContent>
      </Card>
    );
  }

  return (
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
  );
}

function LoadingCard() {
  return (
    <Card className="w-full max-w-md">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
        <p className="mt-4 text-sm text-zinc-500">Loading...</p>
      </CardContent>
    </Card>
  );
}

export default function SetPasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <Suspense fallback={<LoadingCard />}>
        <SetPasswordForm />
      </Suspense>
    </div>
  );
}
