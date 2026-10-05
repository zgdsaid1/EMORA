import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { messages } from '../shell/messages';

/**
 * Email-verification landing page (source-scan convention, matching the
 * existing page/wording tests). Proves the page reads only the outcome markers
 * Better Auth redirects with, never handles the verification token, keeps the
 * resend generic (anti-enumeration) and is i18n-ready.
 */

function read(relative: string): string {
  return readFileSync(
    fileURLToPath(new URL(relative, import.meta.url)),
    'utf8',
  );
}

const pageSource = read('./page.tsx');
const statusSource = read('./verify-email-status.tsx');

describe('verify-email page wiring', () => {
  it('renders the status client island', () => {
    expect(pageSource).toContain("from './verify-email-status'");
    expect(pageSource).toContain('<VerifyEmailStatus />');
  });

  it('wraps useSearchParams in a Suspense boundary', () => {
    // Next.js requires a Suspense boundary around useSearchParams during
    // static prerendering; without it `next build` fails on this route.
    expect(statusSource).toContain('useSearchParams');
    expect(statusSource).toContain('Suspense');
    expect(statusSource).toContain('<Suspense fallback={null}>');
  });

  it('derives its state from the shared verification contract', () => {
    expect(statusSource).toContain('resolveVerificationOutcome');
    expect(statusSource).toContain('VERIFICATION_CALLBACK');
  });
});

describe('verify-email outcome states', () => {
  it('confirms success and offers a path back to sign-in', () => {
    expect(statusSource).toContain("outcome.state === 'verified'");
    expect(statusSource).toContain("t('verifyEmailSuccessHeading')");
    expect(statusSource).toContain("t('verifyEmailSuccessDescription')");
    expect(statusSource).toContain("t('verifyEmailSignIn')");
    expect(statusSource).toContain('href="/login"');
  });

  it('surfaces the failure/incomplete reason and a resend form', () => {
    expect(statusSource).toContain('t(outcome.messageKey)');
    expect(statusSource).toContain("t('verifyEmailDescription')");
    expect(statusSource).toContain("t('verifyEmailResend')");
    expect(statusSource).toContain('type="submit"');
    expect(statusSource).toContain('disabled={pending}');
  });
});

describe('verify-email resend (anti-enumeration and security)', () => {
  it('resends through Better Auth with the same relative callback', () => {
    expect(statusSource).toContain('authClient.sendVerificationEmail({');
    expect(statusSource).toContain('callbackURL: VERIFICATION_CALLBACK');
  });

  it('shows one generic confirmation for every resolved outcome', () => {
    expect(statusSource).toContain('if (result.error) {');
    expect(statusSource).toContain("setError(t('verifyEmailResendFailed'))");
    expect(statusSource).toContain('setResendSent(true)');
    expect(statusSource).toContain("t('verifyEmailResendSent')");
    // The generic confirmation must not branch on the address' existence.
    expect(statusSource).not.toContain('result.data');
  });

  it('never touches the verification token or any browser storage', () => {
    for (const forbidden of [
      "get('token')",
      'token=',
      'localStorage',
      'sessionStorage',
      'document.cookie',
      'RESEND_API_KEY',
      'console.',
    ]) {
      expect(statusSource).not.toContain(forbidden);
    }
  });

  it('routes every user-visible string through a real i18n key', () => {
    const used = [...statusSource.matchAll(/t\('([A-Za-z]+)'\)/g)].map(
      (m) => m[1],
    );
    expect(used.length).toBeGreaterThanOrEqual(8);
    const known = new Set(Object.keys(messages.en));
    for (const key of used) {
      expect(known.has(key)).toBe(true);
    }
    // The dynamic failure copy is type-checked as a MessageKey.
    expect(statusSource).toContain('t(outcome.messageKey)');
  });
});
