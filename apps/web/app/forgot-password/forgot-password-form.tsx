'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';

import { authClient } from '@emora/auth/client';

import { usePreferences } from '../shell/preferences';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Password-reset request form.
 *
 * Anti-enumeration: the UI always renders the same generic success state
 * regardless of whether the email is associated with an account. It never
 * reveals account existence and never builds a reset URL — Better Auth owns
 * the whole flow, including delivery.
 */
export function ForgotPasswordForm() {
  const { t } = usePreferences();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);

    const email = String(new FormData(event.currentTarget).get('email') ?? '').trim();
    if (!EMAIL_PATTERN.test(email)) {
      setError(t('invalidEmail'));
      return;
    }

    setPending(true);
    try {
      // Better Auth owns the request; the client intentionally discards the
      // outcome so the success state stays generic (anti-enumeration).
      await Promise.resolve(
        authClient.requestPasswordReset({
          email,
          redirectTo: '/reset-password',
        }),
      ).catch(() => undefined);
      setSubmitted(true);
    } finally {
      setPending(false);
    }
  }

  return (
    <main>
      <h1>{t('resetRequestHeading')}</h1>
      <p>{t('resetRequestDescription')}</p>
      {submitted ? (
        <p role="status">{t('resetRequestSuccess')}</p>
      ) : (
        <form onSubmit={submit}>
          <label>
            {t('email')}
            <input name="email" type="email" required autoComplete="email" />
          </label>
          <button type="submit" disabled={pending}>
            {pending ? t('working') : t('sendResetLink')}
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
