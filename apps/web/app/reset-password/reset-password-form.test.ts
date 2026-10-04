import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { messages } from '../shell/messages';

/**
 * Password-reset form (source-scan convention). Verifies token handling via
 * Better Auth, password policy reuse, validation, security (no token logging)
 * and i18n.
 */

const formSource = readFileSync(
  fileURLToPath(new URL('./reset-password-form.tsx', import.meta.url)),
  'utf8',
);

describe('reset-password form structure', () => {
  it('reads the token from the URL and hands it to Better Auth', () => {
    expect(formSource).toContain("useSearchParams");
    expect(formSource).toContain("searchParams.get('token')");
    expect(formSource).toContain('authClient.resetPassword');
    expect(formSource).toContain('{ newPassword, token }');
  });

  it('collects new password + confirmation with the existing policy (min 8)', () => {
    expect(formSource).toContain('name="password"');
    expect(formSource).toContain('name="confirmPassword"');
    expect(formSource).toContain('type="password"');
    expect(formSource).toContain('autoComplete="new-password"');
    expect(formSource).toContain('minLength={8}');
    expect(formSource).toContain('newPassword.length < 8');
  });

  it('handles missing token, mismatch, loading, error and success states', () => {
    expect(formSource).toContain("t('resetMissingToken')");
    expect(formSource).toContain("t('passwordsDoNotMatch')");
    expect(formSource).toContain('disabled={pending}');
    expect(formSource).toContain('role="alert"');
    expect(formSource).toContain('role="status"');
    expect(formSource).toContain("t('resetSuccess')");
    expect(formSource).toContain('href="/login"');
  });

  it('distinguishes invalid/expired tokens from other errors', () => {
    expect(formSource).toContain('isTokenInvalid');
    expect(formSource).toContain("t('resetLinkInvalid')");
  });
});

describe('reset-password security boundaries', () => {
  it('never logs or displays the reset token', () => {
    expect(formSource).not.toContain('console.');
    // The token is only forwarded to Better Auth, never rendered into the DOM.
    expect(formSource).not.toContain('{token}');
  });
});

describe('password-reset i18n (EN/FR/AR)', () => {
  const keys = [
    'resetRequestHeading',
    'resetRequestSuccess',
    'sendResetLink',
    'invalidEmail',
    'resetPasswordHeading',
    'newPassword',
    'confirmPassword',
    'resetSubmit',
    'passwordsDoNotMatch',
    'passwordTooShort',
    'resetMissingToken',
    'resetLinkInvalid',
    'resetSuccess',
  ] as const;

  it('provides a non-empty translation for every reset key in all locales', () => {
    for (const locale of ['en', 'fr', 'ar'] as const) {
      for (const key of keys) {
        expect(messages[locale][key]).not.toBe('');
      }
    }
  });

  it('keeps the locale dictionaries structurally aligned', () => {
    for (const locale of ['fr', 'ar'] as const) {
      expect(Object.keys(messages[locale]).sort()).toEqual(
        Object.keys(messages.en).sort(),
      );
    }
  });
});
