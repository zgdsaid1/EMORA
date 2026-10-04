import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { messages } from './shell/messages';

/**
 * Phase 3 registration/login surface (source-scan convention, matching the
 * existing form/wording tests). `requireEmailVerification` makes sign-up return
 * no session, so these tests pin the behaviour that matters: a new account is
 * held on a delivery notice instead of being navigated into the workspace, an
 * unverified sign-in is reported rather than retried, and the resend goes
 * through Better Auth with the same relative callback.
 */

const formSource = readFileSync(
  fileURLToPath(new URL('./auth-form.tsx', import.meta.url)),
  'utf8',
);

describe('registration does not enter the workspace unverified', () => {
  it('sends the relative verification callback at sign-up only', () => {
    expect(formSource).toContain('callbackURL: VERIFICATION_CALLBACK');
    const signUpCall = formSource.slice(
      formSource.indexOf('authClient.signUp.email({'),
      formSource.indexOf('authClient.sendVerificationEmail({'),
    );
    expect(signUpCall).toContain('callbackURL: VERIFICATION_CALLBACK');
    // The login branch must not redirect anywhere but the validated target.
    expect(formSource).toContain(
      'authClient.signIn.email({ email, password })',
    );
  });

  it('holds the user on a pending-verification notice after a successful sign-up', () => {
    expect(formSource).toContain('setPendingVerificationEmail(email)');
    expect(formSource).toContain("t('verifyEmailHeading')");
    expect(formSource).toContain("t('verifyEmailPendingNotice')");
    expect(formSource).toContain("t('verifyEmailSentTo')");
    expect(formSource).toContain('role="status"');
  });

  it('navigates only from the login branch', () => {
    expect(formSource.match(/window\.location\.assign\(/g)).toHaveLength(1);
    expect(formSource).toContain("if (mode === 'login') {");
    // The single navigation is the validated return target, never a raw input.
    expect(formSource).toContain('validateReturnTarget(returnTo)');
  });

  it('never enters the pending state on a sign-up error', () => {
    const errorCheck = formSource.indexOf('if (result.error) {');
    const pendingSet = formSource.indexOf('setPendingVerificationEmail(email)');
    expect(errorCheck).toBeGreaterThan(-1);
    expect(pendingSet).toBeGreaterThan(errorCheck);
  });
});

describe('unverified sign-in feedback', () => {
  it('recognizes EMAIL_NOT_VERIFIED and reports it without navigating', () => {
    expect(formSource).toContain("candidate.code === 'EMAIL_NOT_VERIFIED'");
    expect(formSource).toContain('isUnverifiedError(result.error)');
    expect(formSource).toContain('setUnverified(true)');
    expect(formSource).toContain("t('emailNotVerified')");
  });

  it('offers a route to the resend surface', () => {
    expect(formSource).toContain('href="/verify-email"');
    expect(formSource).toContain("t('verifyEmailResend')");
  });

  it('keeps the generic provider message for every other failure', () => {
    expect(formSource).toContain(
      "setError(result.error.message ?? t('authenticationFailure'))",
    );
  });
});

describe('resend from the pending state', () => {
  it('calls Better Auth with the same relative callback', () => {
    expect(formSource).toContain('authClient.sendVerificationEmail({');
    expect(formSource).toContain('callbackURL: VERIFICATION_CALLBACK');
    expect(formSource).toContain('if (resendPending) return;');
    expect(formSource).toContain('disabled={resendPending}');
  });

  it('reports one generic confirmation and a generic failure', () => {
    expect(formSource).toContain("setResendNotice(t('verifyEmailResendSent'))");
    expect(formSource).toContain(
      "setResendError(t('verifyEmailResendFailed'))",
    );
    expect(formSource).toContain('role="alert"');
    // Anti-enumeration: the confirmation must not depend on the response body.
    expect(formSource).not.toContain('result.data');
  });
});

describe('auth-form security and i18n boundaries', () => {
  it('never handles a verification token, storage or provider secret', () => {
    for (const forbidden of [
      "get('token')",
      'localStorage',
      'sessionStorage',
      'document.cookie',
      'RESEND_API_KEY',
      'console.',
    ]) {
      expect(formSource).not.toContain(forbidden);
    }
  });

  it('keeps the existing password policy', () => {
    expect(formSource).toContain('minLength={8}');
    expect(formSource).toContain(
      "mode === 'login' ? 'current-password' : 'new-password'",
    );
  });

  it('uses only i18n keys that exist, in every locale', () => {
    const used = [...formSource.matchAll(/t\('([A-Za-z]+)'\)/g)].map(
      (m) => m[1],
    );
    const known = new Set(Object.keys(messages.en));
    for (const key of used) {
      expect(known.has(key)).toBe(true);
      for (const locale of ['en', 'fr', 'ar'] as const) {
        expect(
          messages[locale][key as keyof typeof messages.en].length,
        ).toBeGreaterThan(0);
      }
    }
  });
});
