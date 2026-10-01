'use client';

import { FormEvent, useState } from 'react';

import { authClient } from '@emora/auth/client';
import { validateReturnTarget } from './session-recovery';

type AuthMode = 'login' | 'register';

export function AuthForm({
  mode,
  returnTo = '/app',
}: {
  mode: AuthMode;
  returnTo?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
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
              callbackURL: '/app',
            });

      if (result.error)
        setError(result.error.message ?? 'Authentication failed.');
      else {
        window.location.assign(
          mode === 'login' ? validateReturnTarget(returnTo) : '/app',
        );
      }
    } finally {
      setPending(false);
    }
  }

  const title = mode === 'login' ? 'Sign in' : 'Create account';

  return (
    <main>
      <h1>{title}</h1>
      <form onSubmit={submit}>
        {mode === 'register' && (
          <label>
            Name
            <input name="name" required autoComplete="name" />
          </label>
        )}
        <label>
          Email
          <input name="email" type="email" required autoComplete="email" />
        </label>
        <label>
          Password
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
          {pending ? 'Working...' : title}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
    </main>
  );
}
