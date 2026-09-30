import { NextRequest, NextResponse } from 'next/server';

const publicRoutes = ['/login', '/register', '/forgot-password'];

/**
 * Session-cookie name mirrors the application's Better Auth configuration in
 * `packages/auth/src/auth.ts` (`cookiePrefix: 'emora'`;
 * `advanced.useSecureCookies: NODE_ENV === 'production'`). Production issues
 * the session cookie as `__Secure-emora.session_token`; development uses
 * `emora.session_token`. This check is only an early redirect heuristic —
 * authentication is always re-derived server-side through `requireAuth` and
 * cookie presence here never authorizes anything.
 */
const sessionCookieName =
  process.env.NODE_ENV === 'production'
    ? '__Secure-emora.session_token'
    : 'emora.session_token';

export function middleware(request: NextRequest) {
  if (publicRoutes.includes(request.nextUrl.pathname)) {
    return NextResponse.next();
  }

  const hasSessionCookie = request.cookies.has(sessionCookieName);
  if (!hasSessionCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*'],
};
