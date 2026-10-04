import { describe, expect, it } from 'vitest';

import { messages } from './shell/messages';
import {
  VERIFICATION_CALLBACK,
  VERIFICATION_STATUS_VERIFIED,
  resolveVerificationOutcome,
} from './verification';

/**
 * Phase 3 — the /verify-email landing page state machine. Better Auth owns the
 * token entirely (it is a stateless, signed, single-use-ish JWT that never
 * reaches this code), so the only thing this module has to get right is the
 * precedence between the success marker and Better Auth's `error` code.
 */

describe('verification callback contract', () => {
  it('is a same-origin relative path so it cannot be an open redirect', () => {
    expect(VERIFICATION_CALLBACK.startsWith('/')).toBe(true);
    expect(VERIFICATION_CALLBACK.startsWith('//')).toBe(false);
    expect(VERIFICATION_CALLBACK).not.toContain('://');
    expect(VERIFICATION_CALLBACK).toBe(
      `/verify-email?status=${VERIFICATION_STATUS_VERIFIED}`,
    );
  });

  it('never carries a token', () => {
    expect(VERIFICATION_CALLBACK).not.toContain('token');
  });
});

describe('resolveVerificationOutcome', () => {
  it('reports success for the status marker Better Auth preserves', () => {
    const outcome = resolveVerificationOutcome(
      new URLSearchParams({ status: VERIFICATION_STATUS_VERIFIED }),
    );
    expect(outcome).toEqual({ state: 'verified' });
  });

  it('reports an expired link distinctly from an invalid one', () => {
    expect(
      resolveVerificationOutcome(
        new URLSearchParams({ error: 'TOKEN_EXPIRED' }),
      ),
    ).toEqual({
      state: 'failed',
      messageKey: 'verifyEmailTokenExpired',
    });

    for (const code of ['INVALID_TOKEN', 'USER_NOT_FOUND', 'INVALID_USER']) {
      expect(
        resolveVerificationOutcome(new URLSearchParams({ error: code })),
      ).toEqual({
        state: 'failed',
        messageKey: 'verifyEmailInvalidToken',
      });
    }
  });

  it('lets the error win when both markers are present', () => {
    // Better Auth appends `error` to the callbackURL, which already carries
    // `status=verified`; the failure must not be reported as a success.
    const outcome = resolveVerificationOutcome(
      new URLSearchParams({
        status: VERIFICATION_STATUS_VERIFIED,
        error: 'INVALID_TOKEN',
      }),
    );
    expect(outcome.state).toBe('failed');
  });

  it('asks for a resend when no marker at all is present', () => {
    expect(resolveVerificationOutcome(new URLSearchParams())).toEqual({
      state: 'incomplete',
      messageKey: 'verifyEmailMissingToken',
    });
    expect(
      resolveVerificationOutcome(new URLSearchParams({ status: 'nope' })),
    ).toEqual({
      state: 'incomplete',
      messageKey: 'verifyEmailMissingToken',
    });
  });
});

describe('verification copy i18n', () => {
  const keys = [
    'verifyEmailHeading',
    'verifyEmailDescription',
    'verifyEmailPendingNotice',
    'verifyEmailSentTo',
    'verifyEmailResend',
    'verifyEmailResendSent',
    'verifyEmailResendFailed',
    'verifyEmailSuccessHeading',
    'verifyEmailSuccessDescription',
    'verifyEmailInvalidToken',
    'verifyEmailTokenExpired',
    'verifyEmailMissingToken',
    'verifyEmailSignIn',
    'emailNotVerified',
  ] as const;

  it('defines every verification string in EN, FR and AR', () => {
    for (const locale of ['en', 'fr', 'ar'] as const) {
      for (const key of keys) {
        expect(messages[locale][key]?.length ?? 0).toBeGreaterThan(0);
      }
    }
  });

  it('localizes the Arabic strings rather than reusing English', () => {
    for (const key of keys) {
      expect(messages.ar[key]).toMatch(/[\u0600-\u06FF]/);
      expect(messages.ar[key]).not.toBe(messages.en[key]);
    }
    expect(messages.fr.verifyEmailHeading).not.toBe(
      messages.en.verifyEmailHeading,
    );
  });
});
