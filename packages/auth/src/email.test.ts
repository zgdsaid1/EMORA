import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mocks.send };
  },
}));

import {
  EMAIL_FROM,
  RESET_EMAIL_FROM,
  buildEmailVerificationEmailHtml,
  buildPasswordResetEmailHtml,
  sendPasswordResetEmail,
  sendVerificationEmail,
} from './email';

const previousResendApiKey = process.env.RESEND_API_KEY;

// The HTML body escapes `&` as `&amp;`, so a raw URL comparison has to undo that
// escaping first (the same convention the integration test follows).
const unescapeHtml = (value: string) => value.replaceAll('&amp;', '&');

describe('password reset email sender', () => {
  afterEach(() => {
    mocks.send.mockReset();
    if (previousResendApiKey === undefined) {
      delete process.env.RESEND_API_KEY;
    } else {
      process.env.RESEND_API_KEY = previousResendApiKey;
    }
  });

  it('uses the verified EMORA sender address', () => {
    expect(RESET_EMAIL_FROM).toBe('noreply@emora.dev');
  });

  it('embeds the reset URL supplied by Better Auth in the email body', () => {
    const url = 'https://emora.dev/reset-password/token123?callbackURL=%2Fapp';
    const html = buildPasswordResetEmailHtml(url);
    expect(html).toContain(url);
    expect(html).toContain('Reset your password');
  });

  it('does not generate or otherwise handle a reset token', () => {
    // The sender only consumes the URL that Better Auth constructs; it never
    // produces a token itself. The build function has no token parameter.
    const url = 'https://emora.dev/reset-password/sometoken';
    expect(buildPasswordResetEmailHtml(url)).toContain('sometoken');
  });

  it('requires RESEND_API_KEY when invoked', async () => {
    delete process.env.RESEND_API_KEY;
    await expect(
      sendPasswordResetEmail({
        email: 'user@example.com',
        url: 'https://emora.dev/reset-password/token123',
      }),
    ).rejects.toThrow(
      'RESEND_API_KEY is required to send password reset emails.',
    );
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('sends from noreply@emora.dev and preserves the reset URL', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    mocks.send.mockResolvedValue({ data: { id: 'email-1' }, error: null });

    const url = 'https://emora.dev/reset-password/token123?callbackURL=%2Fapp';
    await sendPasswordResetEmail({ email: 'user@example.com', url });

    expect(mocks.send).toHaveBeenCalledTimes(1);
    const [payload] = mocks.send.mock.calls[0];
    expect(payload.from).toBe('noreply@emora.dev');
    expect(payload.to).toBe('user@example.com');
    expect(payload.subject).toBe('Reset your EMORA password');
    expect(payload.html).toContain(url);

    // The API key must not be present anywhere in the email payload.
    const serialized = JSON.stringify(payload);
    expect(serialized).not.toContain('test-key');
  });

  it('throws a generic error without leaking details when Resend fails', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    mocks.send.mockResolvedValue({
      data: null,
      error: { message: 'internal Resend detail', name: 'Error' },
    });

    await expect(
      sendPasswordResetEmail({
        email: 'user@example.com',
        url: 'https://emora.dev/reset-password/token123',
      }),
    ).rejects.toThrow('Failed to send the password reset email.');
  });
});

describe('email verification sender', () => {
  afterEach(() => {
    mocks.send.mockReset();
    if (previousResendApiKey === undefined) {
      delete process.env.RESEND_API_KEY;
    } else {
      process.env.RESEND_API_KEY = previousResendApiKey;
    }
  });

  it('reuses the single verified EMORA sender address', () => {
    expect(EMAIL_FROM).toBe('noreply@emora.dev');
    // The reset path is aliased onto the shared constant so the two mail flows
    // can never drift apart.
    expect(RESET_EMAIL_FROM).toBe(EMAIL_FROM);
  });

  it('embeds the verification URL supplied by Better Auth in the email body', () => {
    const url =
      'https://emora.dev/api/auth/verify-email?token=token123&callbackURL=%2Fverify-email%3Fstatus%3Dverified';
    const html = buildEmailVerificationEmailHtml(url);
    expect(unescapeHtml(html)).toContain(url);
    expect(html).toContain('Verify your email');
  });

  it('does not generate or otherwise handle a verification token', () => {
    // The sender only consumes the URL Better Auth constructs; it never mints
    // or inspects a token. This mirrors the password-reset sender contract.
    const url = 'https://emora.dev/api/auth/verify-email?token=sometoken';
    expect(buildEmailVerificationEmailHtml(url)).toContain('sometoken');
  });

  it('escapes the verification URL instead of interpolating it as markup', () => {
    const html = buildEmailVerificationEmailHtml(
      'https://emora.dev/api/auth/verify-email?token=<script>"x"</script>',
    );
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&quot;');
  });

  it('requires RESEND_API_KEY when invoked', async () => {
    delete process.env.RESEND_API_KEY;
    await expect(
      sendVerificationEmail({
        email: 'user@example.com',
        url: 'https://emora.dev/api/auth/verify-email?token=t',
      }),
    ).rejects.toThrow(
      'RESEND_API_KEY is required to send verification emails.',
    );
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('sends from noreply@emora.dev and preserves the verification URL', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    mocks.send.mockResolvedValue({ data: { id: 'email-2' }, error: null });

    const url =
      'https://emora.dev/api/auth/verify-email?token=token123&callbackURL=%2Fverify-email%3Fstatus%3Dverified';
    await sendVerificationEmail({ email: 'user@example.com', url });

    expect(mocks.send).toHaveBeenCalledTimes(1);
    const [payload] = mocks.send.mock.calls[0];
    expect(payload.from).toBe('noreply@emora.dev');
    expect(payload.to).toBe('user@example.com');
    expect(payload.subject).toBe('Verify your EMORA email address');
    expect(payload.html).toBeTypeOf('string');
    expect(unescapeHtml(payload.html)).toContain(url);

    // The API key must not be present anywhere in the email payload.
    expect(JSON.stringify(payload)).not.toContain('test-key');
  });

  it('throws a generic error without leaking details when Resend fails', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    mocks.send.mockResolvedValue({
      data: null,
      error: { message: 'internal Resend detail', name: 'Error' },
    });

    await expect(
      sendVerificationEmail({
        email: 'user@example.com',
        url: 'https://emora.dev/api/auth/verify-email?token=t',
      }),
    ).rejects.toThrow('Failed to send the verification email.');
  });

  it('does not log recipient addresses or verification URLs', () => {
    const moduleSource = readFileSync(
      fileURLToPath(new URL('./email.ts', import.meta.url)),
      'utf8',
    );
    expect(moduleSource).not.toContain('console.');
    for (const forbidden of ['setTimeout', 'setInterval']) {
      expect(moduleSource).not.toContain(forbidden);
    }
  });
});

describe('password reset timing / anti-enumeration (F4)', () => {
  it('relies on the framework timing mitigation and adds no homemade delay', () => {
    // F4: Better Auth 1.7.3 already mitigates timing for unknown accounts by
    // simulating token generation + a DB lookup before returning the generic
    // response. This module must not add an application-level sleep/jitter,
    // which would be redundant and a potential DoS vector.
    const moduleSource = readFileSync(
      fileURLToPath(new URL('./email.ts', import.meta.url)),
      'utf8',
    );
    for (const forbidden of ['setTimeout', 'setInterval', 'sleep(', 'delay(']) {
      expect(moduleSource).not.toContain(forbidden);
    }
  });

  it('does not log recipient addresses or reset URLs', () => {
    const moduleSource = readFileSync(
      fileURLToPath(new URL('./email.ts', import.meta.url)),
      'utf8',
    );
    expect(moduleSource).not.toContain('console.');
  });
});
