import { Resend } from 'resend';

/**
 * Verified Resend sender address for EMORA transactional email.
 * Server-only module — never imported from client components.
 */
export const RESET_EMAIL_FROM = 'noreply@emora.dev';

const RESET_EMAIL_SUBJECT = 'Reset your EMORA password';

export interface PasswordResetEmailInput {
  /** Recipient email address. */
  readonly email: string;
  /**
   * Full reset URL supplied by Better Auth. It already contains the
   * single-use reset token; this module never generates tokens itself.
   */
  readonly url: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Builds the HTML body for a password reset email. Kept pure so the output can
 * be asserted in tests without sending anything.
 */
export function buildPasswordResetEmailHtml(resetUrl: string): string {
  return [
    '<p>A password reset was requested for your EMORA account.</p>',
    '<p><a href="',
    escapeHtml(resetUrl),
    '">Reset your password</a></p>',
    '<p>If you did not request a password reset, you can safely ignore this email.</p>',
  ].join('');
}

/**
 * Sends a password reset email via Resend using the configured sender address.
 * The Resend client is created lazily so that importing this module (or the
 * auth configuration that relies on it) does not require RESEND_API_KEY unless
 * a reset email is actually sent.
 */
export async function sendPasswordResetEmail(
  input: PasswordResetEmailInput,
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is required to send password reset emails.');
  }

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from: RESET_EMAIL_FROM,
    to: input.email,
    subject: RESET_EMAIL_SUBJECT,
    html: buildPasswordResetEmailHtml(input.url),
  });

  if (result.error) {
    throw new Error('Failed to send the password reset email.');
  }
}