'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { FormEvent, Suspense, useState } from 'react';

import { authClient } from '@emora/auth/client';

import { usePreferences } from '../shell/preferences';

function isTokenInvalid(message: string | undefined): boolean {
  return /invalid|expired|token/i.test(message ?? '');
}

/**
 * Password-reset form. Better Auth supplies the single-use token via the URL
 * (`?token=`) and owns validation, persistence and session semantics. This
 * component never logs, stores or displays the token.
 */
function ResetPasswordFormInner() {
  const { t } = usePreferences();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);

    const formData = new FormData(event.currentTarget);
    const newPassword = String(formData.get('password') ?? '');
    const confirmPassword = String(formData.get('confirmPassword') ?? '');

    if (newPassword.length < 8) {
      setError(t('passwordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('passwordsDoNotMatch'));
      return;
    }

    setPending(true);
    try {
      const result = await authClient.resetPassword({ newPassword, token });
      if (result.error) {
        setError(
          isTokenInvalid(result.error.message)
            ? t('resetLinkInvalid')
            : (result.error.message ?? t('authenticationFailure')),
        );
      } else {
        setSucceeded(true);
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <main>
      <h1>{t('resetPasswordHeading')}</h1>
      {!token ? (
        <p role="alert">{t('resetMissingToken')}</p>
      ) : succeeded ? (
        <p role="status">{t('resetSuccess')}</p>
      ) : (
        <form onSubmit={submit}>
          <label>
            {t('newPassword')}
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          <label>
            {t('confirmPassword')}
            <input
              name="confirmPassword"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </label>
          <button type="submit" disabled={pending}>
            {pending ? t('working') : t('resetSubmit')}
          </button>
        </form>
      )}
      {error && token && <p role="alert">{error}</p>}
      <p>
        <Link href="/login">{t('returnToSignIn')}</Link>
      </p>
    </main>
  );
}

export function ResetPasswordForm() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordFormInner />
    </Suspense>
  );
}
