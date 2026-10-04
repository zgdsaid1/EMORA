import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

import { db } from '@emora/database';
import * as schema from '@emora/database/schema';

import { sendPasswordResetEmail, sendVerificationEmail } from './email';

const authSecret = process.env.AUTH_SECRET;

if (!authSecret) {
  throw new Error('AUTH_SECRET is required to initialize authentication.');
}

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
    schema,
    usePlural: true,
  }),
  secret: authSecret,
  baseURL: process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL,
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'],
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    /**
     * Phase 3: new accounts must confirm their email address before they can
     * authenticate. Better Auth 1.7.3 honours this flag in two places:
     *  - sign-up (dist/api/routes/sign-up.mjs): `requireEmailVerification`
     *    forces `shouldSkipAutoSignIn`, so the response contains no session
     *    cookie (`token: null`) and the fresh credential cannot be used yet;
     *  - sign-in (dist/api/routes/sign-in.mjs): an unverified credential is
     *    rejected with 403 EMAIL_NOT_VERIFIED, before any session is created.
     * Password-reset behaviour, cookie semantics, session duration, RBAC and
     * trusted origins are intentionally unchanged.
     */
    requireEmailVerification: true,
    /**
     * F1: revoking existing sessions on a successful password reset is a
     * first-class Better Auth 1.7.3 option (see dist/api/routes/password.mjs:
     * `emailAndPassword?.revokeSessionsOnPasswordReset` → `deleteUserSessions`).
     * A successful reset now invalidates every existing session, so the user
     * must authenticate again with the new password. Cookie semantics, session
     * duration, RBAC and trusted origins are intentionally unchanged.
     */
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      if (user.email) {
        await sendPasswordResetEmail({ email: user.email, url });
      }
    },
  },
  emailVerification: {
    /**
     * `sendOnSignUp` delivers the first verification email as part of
     * registration; `POST /send-verification-email` (exposed to the UI via
     * `authClient.sendVerificationEmail`) covers resends and is deliberately
     * NOT enabled as `sendOnSignIn` so delivery stays user-initiated after
     * sign-up. `expiresIn` documents Better Auth's default one-hour token
     * lifetime, which the /verify-email copy communicates to the user.
     */
    sendOnSignUp: true,
    expiresIn: 60 * 60,
    /**
     * The callback receives the fully built verification URL (with the
     * single-use token) from Better Auth, so no token is generated here — this
     * module only transports the link over the existing Resend integration
     * (sender `noreply@emora.dev`). Because `autoSignInAfterVerification` is
     * left unset (falsy), clicking the link verifies the address without
     * silently creating a session; the user signs in deliberately afterwards.
     */
    sendVerificationEmail: async ({ user, url }) => {
      if (user.email) {
        await sendVerificationEmail({ email: user.email, url });
      }
    },
  },
  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    },
    useSecureCookies: process.env.NODE_ENV === 'production',
    cookiePrefix: 'emora',
  },
});
