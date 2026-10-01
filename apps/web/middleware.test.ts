import { afterAll, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import type { BetterAuthOptions } from 'better-auth';
import { getCookies } from 'better-auth/cookies';

/**
 * Regression tests for the production session-cookie recognition defect:
 * middleware previously checked only the unprefixed `emora.session_token`
 * cookie name, while production Better Auth (cookiePrefix 'emora',
 * useSecureCookies: NODE_ENV === 'production') issues the session cookie as
 * `__Secure-emora.session_token`, so authenticated users were redirected from
 * /app to /login in production mode.
 *
 * The middleware is an early redirect heuristic only; server-side requireAuth
 * remains the sole authority. These tests prove the middleware recognizes the
 * application's legitimate session cookie in BOTH environments, never treats
 * an arbitrary cookie name as a session, and stays in sync with the Better
 * Auth naming rule by comparing against better-auth/cookies directly.
 */

function requestWithCookie(path: string, cookieName?: string): NextRequest {
  return {
    cookies: {
      has: (name: string) => cookieName !== undefined && name === cookieName,
    },
    nextUrl: new URL(`http://localhost:3000${path}`),
    url: `http://localhost:3000${path}`,
  } as unknown as NextRequest;
}

function redirectLocation(response: Response): string | null {
  return response.headers.get('location');
}

/**
 * NODE_ENV is typed read-only; the tests deliberately exercise both the
 * production and development cookie branches by mutating it through the
 * index signature before (re-)importing the middleware module.
 */
function setNodeEnv(value: 'development' | 'production' | 'test'): void {
  (process.env as Record<string, string | undefined>).NODE_ENV = value;
}

const originalNodeEnv = process.env.NODE_ENV;
const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const PROFILE_ID = '22222222-2222-4222-8222-222222222222';

afterAll(() => {
  setNodeEnv(originalNodeEnv);
  vi.resetModules();
});

describe('middleware session-cookie recognition', () => {
  it('stays in sync with the Better Auth cookie naming rule', () => {
    const production = getCookies({
      advanced: { useSecureCookies: true, cookiePrefix: 'emora' },
    } as unknown as BetterAuthOptions);
    expect(production.sessionToken.name).toBe('__Secure-emora.session_token');

    const development = getCookies({
      advanced: { useSecureCookies: false, cookiePrefix: 'emora' },
    } as unknown as BetterAuthOptions);
    expect(development.sessionToken.name).toBe('emora.session_token');
  });

  it('recognizes the production __Secure- prefixed session cookie on /app', async () => {
    setNodeEnv('production');
    vi.resetModules();
    const { middleware } = await import('./middleware');

    const response = middleware(
      requestWithCookie('/app', '__Secure-emora.session_token'),
    );
    expect(response.status).toBe(200);
    expect(redirectLocation(response)).toBeNull();
  });

  it('redirects a production request with no session cookie', async () => {
    setNodeEnv('production');
    vi.resetModules();
    const { middleware } = await import('./middleware');

    const response = middleware(requestWithCookie('/app'));
    expect(response.status).toBe(307);
    expect(redirectLocation(response)).toContain('/login?callbackUrl=%2Fapp');
  });

  it('never treats an arbitrary cookie name as a session in production', async () => {
    setNodeEnv('production');
    vi.resetModules();
    const { middleware } = await import('./middleware');

    for (const forged of ['session_token', 'better-auth.session_token']) {
      const response = middleware(requestWithCookie('/app', forged));
      expect(response.status).toBe(307);
    }
  });

  it('preserves development behavior with the unprefixed session cookie', async () => {
    setNodeEnv('development');
    vi.resetModules();
    const { middleware } = await import('./middleware');

    const response = middleware(
      requestWithCookie('/app', 'emora.session_token'),
    );
    expect(response.status).toBe(200);
    expect(redirectLocation(response)).toBeNull();
  });

  it('keeps public routes reachable regardless of cookies', async () => {
    setNodeEnv('production');
    vi.resetModules();
    const { middleware } = await import('./middleware');

    for (const route of ['/login', '/register', '/forgot-password']) {
      const response = middleware(requestWithCookie(route));
      expect(response.status).toBe(200);
      expect(redirectLocation(response)).toBeNull();
    }
  });

  it('keeps login reachable when an expired session cookie is still present', async () => {
    setNodeEnv('production');
    vi.resetModules();
    const { middleware } = await import('./middleware');

    const response = middleware(
      requestWithCookie(
        '/login?callbackUrl=%2Fapp',
        '__Secure-emora.session_token',
      ),
    );
    expect(response.status).toBe(200);
    expect(redirectLocation(response)).toBeNull();
  });

  it.each(['production', 'development'] as const)(
    'preserves the full path and query in callbackUrl when redirecting from /app with no session cookie (%s)',
    async (nodeEnv) => {
      setNodeEnv(nodeEnv);
      vi.resetModules();
      const { middleware } = await import('./middleware');

      const response = middleware(
        requestWithCookie(
          `/app?projectId=${PROJECT_ID}&profileId=${PROFILE_ID}`,
        ),
      );
      expect(response.status).toBe(307);
      expect(redirectLocation(response)).toBe(
        `http://localhost:3000/login?callbackUrl=${encodeURIComponent(
          `/app?projectId=${PROJECT_ID}&profileId=${PROFILE_ID}`,
        )}`,
      );
    },
  );
});
