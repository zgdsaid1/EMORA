import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';

import { db } from '@emora/database';
import * as schema from '@emora/database/schema';

import { sendPasswordResetEmail } from './email';

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
    requireEmailVerification: false,
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
    sendVerificationEmail: async () => {
      // Email delivery is intentionally deferred; the verification flow is enabled.
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
