import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/tickets';
  const token_hash = requestUrl.searchParams.get('token_hash');
  const type = requestUrl.searchParams.get('type');

  console.log('[Auth Callback] Params:', { code: !!code, token_hash: !!token_hash, type, next });

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  // Handle invite/recovery token (from email links)
  if (token_hash && type) {
    console.log('[Auth Callback] Verifying OTP with type:', type);
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: type as 'invite' | 'recovery' | 'email',
    });

    if (error) {
      console.error('[Auth Callback] OTP verification error:', error);
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url));
    }

    console.log('[Auth Callback] OTP verified, redirecting to:', next);
    return NextResponse.redirect(new URL(next, request.url));
  }

  // Handle OAuth code exchange
  if (code) {
    console.log('[Auth Callback] Exchanging code for session');
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('[Auth Callback] Code exchange error:', error);
      return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error.message)}`, request.url));
    }

    console.log('[Auth Callback] Session established, redirecting to:', next);
    return NextResponse.redirect(new URL(next, request.url));
  }

  // No code or token, redirect to login
  console.log('[Auth Callback] No code or token, redirecting to login');
  return NextResponse.redirect(new URL('/login', request.url));
}
