import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // CRITICAL: Skip ALL API routes immediately - no auth check needed
  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  // Skip static files and images
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico)$/)
  ) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = pathname.startsWith('/login');
  const isAuthRoute = pathname.startsWith('/auth'); // /auth/callback, /auth/set-password
  const isPublicPage = pathname === '/';

  // Allow auth routes (callback, set-password) - they handle their own auth
  if (isAuthRoute) {
    return supabaseResponse;
  }

  // Redirect unauthenticated users to login
  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from login page
  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/tickets';
    return NextResponse.redirect(url);
  }

  // Redirect root to tickets for authenticated users
  if (user && isPublicPage) {
    const url = request.nextUrl.clone();
    url.pathname = '/tickets';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - /api/* (all API routes)
     * - /_next/* (Next.js internals)
     * - Static files
     * Note: /auth/* routes are handled in middleware but still need cookie handling
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
