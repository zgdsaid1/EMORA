import { Resend } from 'resend';

/**
 * Verified Resend sender address for EMORA transactional email.
 * Server-only module — never imported from client components.
 */
export const EMAIL_FROM = 'noreply@emora.dev';

/**
 * @deprecated Use {@link EMAIL_FROM}. Retained so the existing password-reset
 * configuration and its tests keep referencing a single, verified sender.
 */
export const RESET_EMAIL_FROM = EMAIL_FROM;

const RESET_EMAIL_SUBJECT = 'Reset your EMORA password';
const VERIFICATION_EMAIL_SUBJECT = 'Verify your EMORA email address';

export interface PasswordResetEmailInput {
  /** Recipient email address. */
  readonly email: string;
  /**
   * Full reset URL supplied by Better Auth. It already contains the
   * single-use reset token; this module never generates tokens itself.
   */
  readonly url: string;
}

export interface EmailVerificationEmailInput {
  /** Recipient email address. */
  readonly email: string;
  /**
   * Full verification URL supplied by Better Auth. It already contains the
   * single-use verification token; this module never generates tokens itself.
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
 * Builds the HTML body for an email-verification email. Kept pure so the output
 * can be asserted in tests without sending anything.
 */
export function buildEmailVerificationEmailHtml(
  verificationUrl: string,
): string {
  return [
    '<p>Confirm this address to activate your EMORA account.</p>',
    '<p><a href="',
    escapeHtml(verificationUrl),
    '">Verify your email address</a></p>',
    '<p>If you did not create an EMORA account, you can safely ignore this email.</p>',
  ].join('');
}

interface DeliverInput {
  readonly to: string;
  readonly subject: string;
  readonly html: string;
  /** Thrown when RESEND_API_KEY is absent (fail loudly, never silently). */
  readonly missingApiKeyMessage: string;
  /** Thrown when Resend rejects the send request. */
  readonly deliveryFailureMessage: string;
}

/**
 * Shared Resend delivery path for every EMORA transactional email. The Resend
 * client is created lazily so that importing this module (or the auth
 * configuration that relies on it) does not require RESEND_API_KEY unless an
 * email is actually sent.
 */
async function deliver(input: DeliverInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(input.missingApiKeyMessage);
  }

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from: EMAIL_FROM,
    to: input.to,
    subject: input.subject,
    html: input.html,
  });

  if (result.error) {
    throw new Error(input.deliveryFailureMessage);
  }
}

/**
 * Sends a password reset email via Resend using the configured sender address.
 */
export async function sendPasswordResetEmail(
  input: PasswordResetEmailInput,
): Promise<void> {
  await deliver({
    to: input.email,
    subject: RESET_EMAIL_SUBJECT,
    html: buildPasswordResetEmailHtml(input.url),
    missingApiKeyMessage:
      'RESEND_API_KEY is required to send password reset emails.',
    deliveryFailureMessage: 'Failed to send the password reset email.',
  });
}

/**
 * Sends an email-verification email via Resend using the configured sender
 * address. Invoked by Better Auth's `emailVerification.sendVerificationEmail`
 * callback at sign-up and on explicit resend requests.
 */
export async function sendVerificationEmail(
  input: EmailVerificationEmailInput,
): Promise<void> {
  await deliver({
    to: input.email,
    subject: VERIFICATION_EMAIL_SUBJECT,
    html: buildEmailVerificationEmailHtml(input.url),
    missingApiKeyMessage:
      'RESEND_API_KEY is required to send verification emails.',
    deliveryFailureMessage: 'Failed to send the verification email.',
  });
}
