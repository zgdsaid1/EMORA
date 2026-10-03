import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { messages } from '../shell/messages';

/**
 * Password-reset request surface (source-scan convention, matching the
 * existing page/wording tests). Verifies the form contract, anti-enumeration,
 * security boundaries and i18n without rendering a browser.
 */

const formSource = readFileSync(
  fileURLToPath(new URL('./forgot-password-form.tsx', import.meta.url)),
  'utf8',
);

describe('forgot-password form structure', () => {
  it('renders an accessible, validated email form with a submit control', () => {
    expect(formSource).toContain('name="email"');
    expect(formSource).toContain('type="email"');
    expect(formSource).toContain('autoComplete="email"');
    expect(formSource).toContain('required');
    expect(formSource).toContain('type="submit"');
    expect(formSource).toContain("t('email')");
  });

  it('provides loading, generic success and generic error states plus a login path', () => {
    expect(formSource).toContain('disabled={pending}');
    expect(formSource).toContain('if (pending) return;');
    expect(formSource).toContain('role="status"');
    expect(formSource).toContain('role="alert"');
    expect(formSource).toContain('href="/login"');
  });
});

describe('forgot-password anti-enumeration (mandatory)', () => {
  it('delegates the request to the existing Better Auth client', () => {
    expect(formSource).toContain('authClient.requestPasswordReset');
    expect(formSource).toContain("redirectTo: '/reset-password'");
  });

  it('always renders the same generic success state regardless of outcome', () => {
    expect(formSource).toContain('.catch(() => undefined)');
    expect(formSource).toContain('setSubmitted(true)');
    expect(formSource).toContain("t('resetRequestSuccess')");
  });

  it('never reveals account existence', () => {
    for (const forbidden of [
      'Account not found',
      'Email not registered',
      'User does not exist',
      'result.error',
    ]) {
      expect(formSource).not.toContain(forbidden);
    }
    // Success copy must be the generic anti-enumeration message in all locales.
    for (const locale of ['en', 'fr', 'ar'] as const) {
      expect(messages[locale].resetRequestSuccess).toMatch(/si |if |إذا/i);
    }
  });
});

describe('forgot-password security boundaries', () => {
  it('never calls Resend, builds a reset URL, or handles a token client-side', () => {
    for (const forbidden of ['resend', 'RESEND_API_KEY', 'token', 'resetUrl']) {
      expect(formSource).not.toContain(forbidden);
    }
  });

  it('does not log anything from the reset request', () => {
    expect(formSource).not.toContain('console.');
  });
});
