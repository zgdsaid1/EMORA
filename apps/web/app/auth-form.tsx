'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';

import { authClient } from '@emora/auth/client';
import { validateReturnTarget } from './session-recovery';
import { usePreferences } from './shell/preferences';
import { VERIFICATION_CALLBACK } from './verification';

type AuthMode = 'login' | 'register';

/**
 * Recognizes Better Auth's `EMAIL_NOT_VERIFIED` rejection. The server stays the
 * only authority: this merely selects clearer copy, and the UI never navigates
 * on an error response, so a missed match can only downgrade wording.
 */
function isUnverifiedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; message?: unknown };
  if (candidate.code === 'EMAIL_NOT_VERIFIED') return true;
  return (
    typeof candidate.message === 'string' &&
    /not verified/i.test(candidate.message)
  );
}

export function AuthForm({
  mode,
  returnTo = '/app',
}: {
  mode: AuthMode;
  returnTo?: string;
}) {
  const { t } = usePreferences();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [unverified, setUnverified] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<
    string | null
  >(null);
  const [resendPending, setResendPending] = useState(false);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setUnverified(false);
    setPending(true);
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get('email') ?? '');

    try {
      const password = String(formData.get('password') ?? '');
      const result =
        mode === 'login'
          ? await authClient.signIn.email({ email, password })
          : await authClient.signUp.email({
              email,
              password,
              name: String(formData.get('name') ?? ''),
              // Phase 3: with requireEmailVerification enabled, sign-up returns
              // no session (`token: null`, no session cookie) and this
              // callbackURL is used only to build the verification link, so the
              // user lands on the status page rather than the workspace.
              callbackURL: VERIFICATION_CALLBACK,
            });

      if (result.error) {
        if (mode === 'login' && isUnverifiedError(result.error)) {
          setUnverified(true);
          setError(t('emailNotVerified'));
          return;
        }
        setError(result.error.message ?? t('authenticationFailure'));
        return;
      }

      if (mode === 'login') {
        window.location.assign(validateReturnTarget(returnTo));
        return;
      }

      // Registration created an unverified account and no session, so we confirm
      // delivery and hold the user here until the address is proven.
      setPendingVerificationEmail(email);
      setResendNotice(null);
      setResendError(null);
    } finally {
      setPending(false);
    }
  }

  async function resend(email: string) {
    if (resendPending) return;
    setResendNotice(null);
    setResendError(null);
    setResendPending(true);
    try {
      // Better Auth answers with a generic `{ status: true }` for any address
      // (after a 500ms anti-enumeration floor) and only sends when the account
      // exists and is still unverified, so this confirmation is identical
      // whether or not the address has an account. Only transport failures
      // surface as an error.
      await authClient.sendVerificationEmail({
        email,
        callbackURL: VERIFICATION_CALLBACK,
      });
      setResendNotice(t('verifyEmailResendSent'));
    } catch {
      setResendError(t('verifyEmailResendFailed'));
    } finally {
      setResendPending(false);
    }
  }

  const title = mode === 'login' ? t('signIn') : t('createAccount');

  if (mode === 'register' && pendingVerificationEmail) {
    return (
      <main>
        <h1>{t('verifyEmailHeading')}</h1>
        <p role="status">{t('verifyEmailPendingNotice')}</p>
        <p>
          {t('verifyEmailSentTo')} <strong>{pendingVerificationEmail}</strong>
        </p>
        {resendNotice && <p role="status">{resendNotice}</p>}
        <button
          type="button"
          disabled={resendPending}
          onClick={() => void resend(pendingVerificationEmail)}
        >
          {resendPending ? t('working') : t('verifyEmailResend')}
        </button>
        {resendError && <p role="alert">{resendError}</p>}
        <p>
          <Link href="/login">{t('returnToSignIn')}</Link>
        </p>
      </main>
    );
  }

  return (
    <main>
      <h1>{title}</h1>
      <form onSubmit={submit}>
        {mode === 'register' && (
          <label>
            {t('name')}
            <input name="name" required autoComplete="name" />
          </label>
        )}
        <label>
          {t('email')}
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          {t('password')}
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={
              mode === 'login' ? 'current-password' : 'new-password'
            }
          />
        </label>
        <button type="submit" disabled={pending}>
          {pending ? t('working') : title}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {unverified && (
        <p>
          <Link href="/verify-email">{t('verifyEmailResend')}</Link>
        </p>
      )}
    </main>
  );
}
