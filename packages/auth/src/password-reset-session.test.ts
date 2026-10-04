import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

/**
 * F1 — a successful password reset must revoke existing authenticated sessions.
 * Source-scan convention: assert the server wiring uses the installed Better
 * Auth 1.7.3 contract rather than re-implementing revocation.
 */

const authSource = readFileSync(
  fileURLToPath(new URL('./auth.ts', import.meta.url)),
  'utf8',
);

// Resolve the installed better-auth package.json without relying on a
// subpath export (better-auth does not export "./package.json").
const betterAuthEntry = createRequire(import.meta.url).resolve('better-auth');
const betterAuthPackageJson = join(dirname(betterAuthEntry), '..', 'package.json');
const betterAuthPackage = JSON.parse(
  readFileSync(betterAuthPackageJson, 'utf8'),
) as { version: string };

describe('password reset session revocation (F1)', () => {
  it('enables the supported Better Auth option to revoke sessions on reset', () => {
    expect(authSource).toContain('revokeSessionsOnPasswordReset: true');
  });

  it('targets the Better Auth version whose reset route honors that option', () => {
    // better-auth 1.7.x implements revokeSessionsOnPasswordReset →
    // deleteUserSessions in dist/api/routes/password.mjs.
    expect(betterAuthPackage.version).toMatch(/^1\.7\./);
  });

  it('does not alter unrelated session/cookie configuration', () => {
    // The fix must not touch cookie prefix, secure-cookie handling or session
    // duration — only the revocation flag is added.
    expect(authSource).toContain("cookiePrefix: 'emora'");
    expect(authSource).toContain('useSecureCookies');
    expect(authSource).not.toContain('session: {');
  });
});
