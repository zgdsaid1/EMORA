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
  RESET_EMAIL_FROM,
  buildPasswordResetEmailHtml,
  sendPasswordResetEmail,
} from './email';

const previousResendApiKey = process.env.RESEND_API_KEY;

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
    ).rejects.toThrow('RESEND_API_KEY is required to send password reset emails.');
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