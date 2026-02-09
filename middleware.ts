import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // CRITICAL: Skip ALL API routes immediately - no auth check needed
  // Check for both /api and /api/ patterns
  if (pathname.startsWith('/api')) {
    console.log('[Middleware] Allowing API route through:', pathname);
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

  const isAuthPage = pathname.startsWith('/login');
  const isPublicPage = pathname === '/';

  // Redirect unauthenticated users to login
  if (!user && !isAuthPage) {
    console.log('[Middleware] Redirecting to login:', pathname);
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from login page
  if (user && isAuthPage) {
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
     * Only match paths that need auth protection.
     * Explicitly EXCLUDE:
     * - /api/* (all API routes)
     * - /_next/* (Next.js internals)
     * - Static files
     */
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
