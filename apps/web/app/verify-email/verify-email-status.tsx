'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';

import { authClient } from '@emora/auth/client';

import { usePreferences } from '../shell/preferences';
import {
  VERIFICATION_CALLBACK,
  resolveVerificationOutcome,
} from '../verification';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Email-verification status page (Phase 3).
 *
 * Better Auth owns token verification entirely: the Better Auth-generated
 * verification token travels to
 * `/api/auth/verify-email`, never to this page, so nothing here reads, stores or
 * logs it. This surface only reports the outcome Better Auth redirected back
 * with, and — when no valid link was used — offers a resend that goes through
 * `authClient.sendVerificationEmail`.
 */
function VerifyEmailStatusInner() {
  const { t } = usePreferences();
  const outcome = resolveVerificationOutcome(useSearchParams());

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  async function resend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);

    const email = String(
      new FormData(event.currentTarget).get('email') ?? '',
    ).trim();
    if (!EMAIL_PATTERN.test(email)) {
      setError(t('invalidEmail'));
      return;
    }

    setPending(true);
    try {
      // Anti-enumeration: Better Auth answers a generic 2xx for unknown or
      // already-verified addresses (after a constant-time floor) and only sends
      // for a known, unverified account, so `resendSent` is identical in every
      // case. Only a transport failure or a rejection surfaces an error.
      const result = await authClient.sendVerificationEmail({
        email,
        callbackURL: VERIFICATION_CALLBACK,
      });
      if (result.error) {
        setError(t('verifyEmailResendFailed'));
        return;
      }
      setResendSent(true);
    } catch {
      setError(t('verifyEmailResendFailed'));
    } finally {
      setPending(false);
    }
  }

  if (outcome.state === 'verified') {
    return (
      <main>
        <h1>{t('verifyEmailSuccessHeading')}</h1>
        <p role="status">{t('verifyEmailSuccessDescription')}</p>
        <p>
          <Link href="/login">{t('verifyEmailSignIn')}</Link>
        </p>
      </main>
    );
  }

  return (
    <main>
      <h1>{t('verifyEmailHeading')}</h1>
      <p role="alert">{t(outcome.messageKey)}</p>
      <p>{t('verifyEmailDescription')}</p>
      {resendSent ? (
        <p role="status">{t('verifyEmailResendSent')}</p>
      ) : (
        <form onSubmit={resend}>
          <label>
            {t('email')}
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <button type="submit" disabled={pending}>
            {pending ? t('working') : t('verifyEmailResend')}
          </button>
        </form>
      )}
      {error && <p role="alert">{error}</p>}
      <p>
        <Link href="/login">{t('returnToSignIn')}</Link>
      </p>
    </main>
  );
}

export function VerifyEmailStatus() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailStatusInner />
    </Suspense>
  );
}
