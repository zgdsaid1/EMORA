import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';

import * as schema from '@emora/database/schema';

const mocks = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mocks.send };
  },
}));

/**
 * Phase 3 integration coverage: registering must not grant a session, signing in
 * with an unverified credential must be refused, and the emailed link must flip
 * `emailVerified` so that sign-in then succeeds. Requires DATABASE_URL (the
 * workflow in CI, an explicit local override otherwise) — never run against the
 * hosted Supabase project.
 */

const databaseUrl = process.env.DATABASE_URL;
const integration = process.env.CI ? describe : describe.skipIf(!databaseUrl);
const client = databaseUrl ? postgres(databaseUrl, { max: 1 }) : null;
const database = client ? drizzle(client, { schema }) : null;
const createdEmails: string[] = [];

const ORIGIN = 'http://localhost:3000';
const PASSWORD = 'secure-password-123';
const CALLBACK = '/verify-email?status=verified';
const SESSION_COOKIE = 'emora.session_token=';

process.env.AUTH_SECRET ??= 'integration-only-secret';
process.env.BETTER_AUTH_URL ??= ORIGIN;
process.env.RESEND_API_KEY = 'test-key';

async function getAuth() {
  const { auth } = await import('./auth');
  return auth;
}

function newEmail() {
  const email = `verify-test-${crypto.randomUUID()}@example.test`;
  createdEmails.push(email);
  return email;
}

async function post(path: string, body: unknown) {
  const auth = await getAuth();
  return auth.handler(
    new Request(`${ORIGIN}/api/auth/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
}

function signUp(email: string, name: string) {
  return post('sign-up/email', {
    email,
    password: PASSWORD,
    name,
    callbackURL: CALLBACK,
  });
}

function cookieHeader(response: Response) {
  return response.headers.get('set-cookie')?.split(';', 1)[0] ?? '';
}

function sentSessionCookieCount(response: Response) {
  return (response.headers.getSetCookie?.() ?? []).filter((cookie) =>
    cookie.startsWith(SESSION_COOKIE),
  ).length;
}

function lastEmail() {
  const call = mocks.send.mock.calls.at(-1);
  if (!call) {
    throw new Error('no email was sent');
  }
  return call[0] as { from: string; to: string; subject: string; html: string };
}

/** The HTML body escapes `&` as `&amp;`, so unescape before parsing the link. */
function linkFromEmail() {
  const href = /href="([^"]+)"/.exec(lastEmail().html)?.[1];
  if (!href) {
    throw new Error('the verification link is missing from the email');
  }
  return href.replace(/&amp;/g, '&');
}

async function isVerified(email: string) {
  const rows = await database!
    .select({ emailVerified: schema.users.emailVerified })
    .from(schema.users)
    .where(eq(schema.users.email, email));
  return rows[0]?.emailVerified;
}

integration('email verification (Phase 3)', () => {
  beforeEach(() => {
    mocks.send.mockReset();
    mocks.send.mockResolvedValue({ data: { id: 'email-id' }, error: null });
  });

  afterAll(async () => {
    if (database) {
      for (const email of createdEmails) {
        await database
          .delete(schema.users)
          .where(eq(schema.users.email, email));
      }
    }
    await client?.end({ timeout: 5 });
  });

  it('registers without a session and emails the verification link', async () => {
    const email = newEmail();
    const response = await signUp(email, 'Verification Test');

    expect(response.status).toBe(200);
    const body = (await response.json()) as { token: string | null };
    expect(body.token).toBeNull();
    expect(sentSessionCookieCount(response)).toBe(0);
    expect(await isVerified(email)).toBe(false);

    const sent = lastEmail();
    expect(sent.from).toBe('noreply@emora.dev');
    expect(sent.to).toBe(email);
    expect(sent.subject).toBe('Verify your EMORA email address');

    const link = new URL(linkFromEmail());
    expect(link.origin).toBe(ORIGIN);
    expect(link.pathname).toBe('/api/auth/verify-email');
    expect(link.searchParams.get('token')).toBeTruthy();
    expect(link.searchParams.get('callbackURL')).toBe(CALLBACK);
  });

  it('refuses sign-in for an unverified credential without a session', async () => {
    const email = newEmail();
    await signUp(email, 'Unverified User');

    const response = await post('sign-in/email', { email, password: PASSWORD });
    expect(response.status).toBe(403);
    const body = (await response.json()) as { code?: string };
    expect(body.code).toBe('EMAIL_NOT_VERIFIED');
    expect(sentSessionCookieCount(response)).toBe(0);
  });

  it('verifies through the emailed link and only then permits sign-in', async () => {
    const email = newEmail();
    await signUp(email, 'Verify Me');

    const auth = await getAuth();
    const verification = await auth.handler(new Request(linkFromEmail()));
    expect(verification.status).toBe(302);
    const location = verification.headers.get('location') ?? '';
    expect(location).toContain('/verify-email');
    expect(location).toContain('status=verified');
    expect(location).not.toContain('error=');
    // autoSignInAfterVerification stays unset: verifying never mints a session.
    expect(sentSessionCookieCount(verification)).toBe(0);
    expect(await isVerified(email)).toBe(true);

    const signIn = await post('sign-in/email', { email, password: PASSWORD });
    expect(signIn.status).toBe(200);
    const cookie = cookieHeader(signIn);
    expect(cookie).toContain(SESSION_COOKIE);

    const session = await auth.api.getSession({
      headers: new Headers({ cookie }),
    });
    expect(session?.user.email).toBe(email);
    expect(session?.user.emailVerified).toBe(true);
  });

  it('keeps the verification link idempotent rather than single-use', async () => {
    const email = newEmail();
    await signUp(email, 'Replay User');

    const auth = await getAuth();
    const link = linkFromEmail();
    expect((await auth.handler(new Request(link))).status).toBe(302);
    const replay = await auth.handler(new Request(link));

    // Better Auth 1.7.3 signs a stateless HS256 JWT (no `verifications` row),
    // so a replay simply re-asserts `emailVerified`. Pin the behaviour the
    // framework actually provides instead of a guarantee it does not make.
    expect(replay.status).toBe(302);
    expect(replay.headers.get('location') ?? '').toContain('status=verified');
    expect(await isVerified(email)).toBe(true);
  });

  it('redirects an invalid token back to the callback with an error code', async () => {
    const auth = await getAuth();
    const callback = encodeURIComponent(CALLBACK);
    const response = await auth.handler(
      new Request(
        `${ORIGIN}/api/auth/verify-email?token=not-a-token&callbackURL=${callback}`,
      ),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get('location') ?? '').toMatch(
      /error=(INVALID_TOKEN|TOKEN_EXPIRED)/,
    );
  });

  it('resends on request while staying generic for unknown addresses', async () => {
    const email = newEmail();
    await signUp(email, 'Resend User');
    mocks.send.mockClear();

    const resend = await post('send-verification-email', {
      email,
      callbackURL: CALLBACK,
    });
    expect(resend.status).toBe(200);
    expect(mocks.send).toHaveBeenCalledTimes(1);
    expect(lastEmail().to).toBe(email);

    mocks.send.mockClear();
    const unknown = await post('send-verification-email', {
      email: newEmail(),
      callbackURL: CALLBACK,
    });
    // Anti-enumeration: an unknown address returns the same success payload and
    // no message is sent.
    expect(unknown.status).toBe(200);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('still delivers password-reset email through the shared sender', async () => {
    const email = newEmail();
    await signUp(email, 'Reset User');

    const auth = await getAuth();
    await auth.handler(new Request(linkFromEmail()));
    mocks.send.mockClear();

    const response = await post('request-password-reset', {
      email,
      redirectTo: `${ORIGIN}/reset-password`,
    });
    expect(response.status).toBe(200);

    const sent = lastEmail();
    expect(sent.from).toBe('noreply@emora.dev');
    expect(sent.subject).toBe('Reset your EMORA password');
  });
});
