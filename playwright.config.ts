import { defineConfig, devices } from '@playwright/test';

/**
 * Product Reality Validation Slice 1 — minimal Playwright configuration.
 *
 * The E2E suite exercises the EXISTING product journey in a production-mode
 * server (`next start`, no development-only fixtures), so the real first-user
 * bootstrap path is validated. Prerequisites are documented in
 * tests/e2e/README.md: a migrated PostgreSQL (docker-compose + db:migrate) and
 * a production build (`pnpm build`).
 */

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
const databaseUrl =
  process.env.DATABASE_URL ??
  'postgresql://emora:emora_dev_only@localhost:5432/emora';
const authSecret =
  process.env.AUTH_SECRET ?? 'emora-e2e-only-secret-not-for-production-32';
const betterAuthUrl = process.env.BETTER_AUTH_URL ?? 'http://localhost:3000';
const captureFailureDiagnostics = process.env.CI === 'true';

export default defineConfig({
  testDir: './tests/e2e',
  // The journey is one serial, stateful browser narrative: one worker, no
  // parallelism, no retries.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL,
    trace: captureFailureDiagnostics ? 'retain-on-failure' : 'off',
    screenshot: captureFailureDiagnostics ? 'only-on-failure' : 'off',
    video: captureFailureDiagnostics ? 'retain-on-failure' : 'off',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'pnpm --filter @emora/web exec next start',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      DATABASE_URL: databaseUrl,
      AUTH_SECRET: authSecret,
      BETTER_AUTH_URL: betterAuthUrl,
    },
  },
});
