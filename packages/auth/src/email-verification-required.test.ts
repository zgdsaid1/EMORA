import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * Phase 3 — new accounts must confirm their email address before they can sign
 * in. Source-scan convention (matching `password-reset-session.test.ts`): assert
 * the server wiring uses the installed Better Auth 1.7.3 contract rather than
 * re-implementing verification, and pin the contract to the dependency so an
 * upgrade cannot silently change the semantics.
 */

const sourceOf = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const authSource = sourceOf('./auth.ts');
const emailSource = sourceOf('./email.ts');

/**
 * Strips comments so that documentation *mentioning* a disabled option is never
 * mistaken for the option actually being enabled. Only comments are removed, so
 * string literals (e.g. `'http://localhost:3000'`) survive untouched.
 */
const codeOf = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

const authCode = codeOf(authSource);

// Resolve the installed better-auth package without relying on a subpath export
// (better-auth does not export "./package.json").
const betterAuthEntry = createRequire(import.meta.url).resolve('better-auth');
const betterAuthDist = dirname(betterAuthEntry);
const betterAuthPackage = JSON.parse(
  readFileSync(join(betterAuthDist, '..', 'package.json'), 'utf8'),
) as { version: string };

const readDist = (relative: string) =>
  readFileSync(join(betterAuthDist, relative), 'utf8');

describe('email verification requirement (Phase 3)', () => {
  it('requires a verified email address for authentication', () => {
    expect(authSource).toContain('requireEmailVerification: true');
  });

  it('sends the first verification email at sign-up and documents the TTL', () => {
    expect(authSource).toContain('emailVerification: {');
    expect(authSource).toContain('sendOnSignUp: true');
    expect(authSource).toContain('expiresIn: 60 * 60');
  });

  it('does not silently sign users in when they follow the verification link', () => {
    // autoSignInAfterVerification must stay unset so clicking the link only
    // flips emailVerified; the user then signs in deliberately.
    expect(authCode).not.toContain('autoSignInAfterVerification');
  });

  it('does not auto-send verification emails on every sign-in attempt', () => {
    // sendOnSignIn would mail a fresh link on each failed login, which is both
    // a spam vector and an account-enumeration oracle.
    expect(authCode).not.toContain('sendOnSignIn');
  });

  it('delegates delivery to the Resend sender without generating a token', () => {
    expect(authSource).toContain('sendVerificationEmail');
    expect(authSource).toContain(
      'await sendVerificationEmail({ email: user.email, url })',
    );

    // The module transports the URL Better Auth built; it never mints secrets.
    for (const forbidden of [
      'randomUUID',
      'randomBytes',
      'crypto.',
      'createHash',
    ]) {
      expect(emailSource).not.toContain(forbidden);
    }
  });

  it('leaves password reset, cookies and session configuration untouched', () => {
    expect(authSource).toContain('revokeSessionsOnPasswordReset: true');
    expect(authSource).toContain("cookiePrefix: 'emora'");
    expect(authSource).toContain('useSecureCookies');
    expect(authSource).toContain('autoSignIn: true');
    expect(authSource).not.toContain('session: {');
    expect(authSource).not.toContain('disableSignUp');
  });

  it('targets the Better Auth version whose routes honor that option', () => {
    expect(betterAuthPackage.version).toMatch(/^1\.7\./);
  });

  it('relies on the installed sign-up route skipping auto sign-in', () => {
    // better-auth 1.7.x: requireEmailVerification forces shouldSkipAutoSignIn,
    // so registration returns no session cookie.
    const signUpRoute = readDist(join('api', 'routes', 'sign-up.mjs'));
    expect(signUpRoute).toContain('shouldSkipAutoSignIn');
    expect(signUpRoute).toContain('requireEmailVerification');
  });

  it('relies on the installed sign-in route rejecting unverified accounts', () => {
    // better-auth 1.7.x: an unverified credential is rejected with
    // 403 EMAIL_NOT_VERIFIED before any session is created.
    const signInRoute = readDist(join('api', 'routes', 'sign-in.mjs'));
    expect(signInRoute).toContain('EMAIL_NOT_VERIFIED');
  });

  it('exposes the framework send-verification-email endpoint for resends', () => {
    const verificationRoute = readDist(
      join('api', 'routes', 'email-verification.mjs'),
    );
    expect(verificationRoute).toContain('/send-verification-email');
    expect(verificationRoute).toContain('sendVerificationEmail');
  });
});
