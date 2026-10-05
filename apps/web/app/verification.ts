import type { MessageKey } from './shell/messages';

/**
 * Shared contract for the email-verification surface.
 *
 * Better Auth builds the emailed link as
 * `/api/auth/verify-email?token=…&callbackURL=<encoded callbackURL>` and, when
 * the token is rejected, appends `error=<CODE>` to that callbackURL before
 * redirecting. The success marker therefore survives a failure redirect, which
 * is why {@link resolveVerificationOutcome} inspects the error first.
 */

/** Callback target sent at sign-up and resend time. */
export const VERIFICATION_CALLBACK = '/verify-email?status=verified';

/** Success marker Better Auth preserves when the address is confirmed. */
export const VERIFICATION_STATUS_VERIFIED = 'verified';

export type VerificationOutcome =
  | { readonly state: 'verified' }
  | { readonly state: 'incomplete'; readonly messageKey: MessageKey }
  | { readonly state: 'failed'; readonly messageKey: MessageKey };

/**
 * Resolves the status page state from the query string. Pure and dependency
 * free so the precedence rule can be unit tested without rendering.
 */
export function resolveVerificationOutcome(searchParams: {
  get(name: string): string | null;
}): VerificationOutcome {
  const error = searchParams.get('error');
  if (error) {
    return {
      state: 'failed',
      messageKey:
        error === 'TOKEN_EXPIRED'
          ? 'verifyEmailTokenExpired'
          : 'verifyEmailInvalidToken',
    };
  }

  if (searchParams.get('status') === VERIFICATION_STATUS_VERIFIED) {
    return { state: 'verified' };
  }

  return { state: 'incomplete', messageKey: 'verifyEmailMissingToken' };
}
