import { createHmac } from 'node:crypto';

import { expect, test } from '@playwright/test';
import type { BrowserContext, Page } from '@playwright/test';

/**
 * Product Reality Validation Slice 1 — the real first-user browser journey.
 *
 * Runs against a production-mode server (next start), so the actual bootstrap
 * path is exercised (no development fixture). Every assertion uses semantic
 * selectors (roles, labels, accessible names, stable disclosure attributes).
 * No product code is changed, no authorization is mocked, and no history UI
 * is required or tested (History UI is explicitly out of scope).
 *
 * The suite is serial and stateful: one registered user walks the whole
 * journey, then a second user verifies the cross-project authorization
 * boundary against the server.
 */

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const USER_A = {
  name: `E2E User ${RUN_ID}`,
  email: `e2e-${RUN_ID}@example.test`,
  password: 'e2e-pass-1234',
};
const USER_B = {
  name: `E2E Intruder ${RUN_ID}`,
  email: `e2e-intruder-${RUN_ID}@example.test`,
  password: 'e2e-pass-5678',
};

const ORG_SLUG = `e2e-org-${RUN_ID}`;
const PROJECT_SLUG = `e2e-project-${RUN_ID}`;
const PROFILE_REFERENCE = `e2e-profile-${RUN_ID}`;

const DISCLOSURE_SELECTOR =
  'aside[data-disclosure="COMPUTATIONAL_MODEL_ESTIMATED_STATE_NOT_HUMAN_MEASUREMENT"]';

/** Positive claims that must never appear on the validated surface. */
const PROHIBITED_CLAIMS = [
  'EMORA detects your',
  'EMORA knows how you feel',
  'measures your emotions',
  'a psychological assessment of you',
  'a diagnosis of you',
];

let projectIdA = '';

/**
 * The E2E environment has no mail transport (no RESEND_API_KEY), so Better
 * Auth's stateless verification token is never observed from an email. The
 * token is an HS256 JWT signed with the same AUTH_SECRET the production-mode
 * server uses, so the test mints it deterministically and drives the real
 * `/api/auth/verify-email` endpoint. The real application contract is still
 * exercised end-to-end: no parallel auth system and no database bypass.
 */
const AUTH_SECRET =
  process.env.AUTH_SECRET ?? 'emora-e2e-only-secret-not-for-production-32';
const VERIFICATION_TTL_SECONDS = 60 * 60;
const VERIFICATION_CALLBACK = '/verify-email?status=verified';

function base64url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function signVerificationToken(email: string): string {
  const header = { alg: 'HS256' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    email: email.toLowerCase(),
    iat: now,
    exp: now + VERIFICATION_TTL_SECONDS,
  };
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(
    JSON.stringify(payload),
  )}`;
  const signature = createHmac('sha256', AUTH_SECRET)
    .update(unsigned)
    .digest('base64url');
  return `${unsigned}.${signature}`;
}

// The journey is one stateful browser narrative: a single shared context (and
// page) carries the session cookie across all serial tests, exactly as a real
// user's browser would.
let sharedContext: BrowserContext;
let page: Page;

test.beforeAll(async ({ browser }) => {
  sharedContext = await browser.newContext();
  page = await sharedContext.newPage();
});

test.afterAll(async () => {
  await sharedContext.close();
});

test.describe.serial('Product Reality Validation Slice 1', () => {
  test('register a new first user and confirm verification is required', async () => {
    await page.goto('/register');
    await page.getByLabel('Name').fill(USER_A.name);
    await page.getByLabel('Email').fill(USER_A.email);
    await page.getByLabel('Password').fill(USER_A.password);
    await page.getByRole('button', { name: 'Create account' }).click();

    // Phase 3 contract: registration creates the account but grants no
    // session, so the user stays on the registration surface holding a
    // verification-required notice instead of entering the workspace.
    await expect(
      page.getByRole('heading', { name: 'Confirm your email address' }),
    ).toBeVisible();
    await expect(page.getByText(/Check your inbox/)).toBeVisible();
    await expect(page.getByText(USER_A.email)).toBeVisible();
    // No authenticated session was minted: the workspace never loads.
    await expect(page.getByText(/Signed in as/)).toHaveCount(0);
  });

  test('verify the email and deliberately sign in', async () => {
    // Verify through the real endpoint with a deterministically minted token.
    const token = signVerificationToken(USER_A.email);
    await page.goto(
      `/api/auth/verify-email?token=${token}&callbackURL=${encodeURIComponent(
        VERIFICATION_CALLBACK,
      )}`,
    );
    await expect(
      page.getByRole('heading', { name: 'Email address confirmed' }),
    ).toBeVisible();

    // Deliberate sign-in now succeeds and opens the authenticated workspace.
    await page.goto('/login');
    await page.getByLabel('Email').fill(USER_A.email);
    await page.getByLabel('Password').fill(USER_A.password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/app$/);
    await expect(page.getByText(/Signed in as/)).toContainText(USER_A.email);
  });

  test('bootstrap the first workspace through the real empty-state form', async () => {
    await expect(
      page.getByRole('heading', { name: 'No authorized project is available' }),
    ).toBeVisible();

    await page.getByLabel('Organization name').fill(`E2E Org ${RUN_ID}`);
    await page.getByLabel('Organization slug').fill(ORG_SLUG);
    await page.getByLabel('Initial project name').fill(`E2E Project ${RUN_ID}`);
    await page.getByLabel('Initial project slug').fill(PROJECT_SLUG);
    await page.getByRole('button', { name: 'Create workspace' }).click();

    // The UI reflects the resulting project, not a demo result.
    const projectLink = page
      .getByRole('link')
      .filter({ hasText: `E2E Project ${RUN_ID}` })
      .first();
    await expect(projectLink).toBeVisible();
    const href = await projectLink.getAttribute('href');
    const projectId = new URLSearchParams(href ?? '').get('projectId');
    expect(projectId).toBeTruthy();
    projectIdA = projectId as string;
  });

  test('create and select a profile within the approved contract', async () => {
    await expect(
      page.getByText(/No profile record is available/),
    ).toBeVisible();
    await page.getByLabel('External reference').fill(PROFILE_REFERENCE);
    await page.getByRole('button', { name: 'Create profile' }).click();

    await expect(page.getByText('Profile created.')).toBeVisible();
    await page
      .getByRole('link', {
        name: 'Reload the workspace to see the new profile.',
      })
      .click();

    await expect(
      page.getByText(`external reference ${PROFILE_REFERENCE}`),
    ).toBeVisible();
    // A profile with no states is a safe empty state, not an error.
    await expect(
      page.getByText(
        'No computational state has been computed for this profile yet.',
      ),
    ).toBeVisible();
  });

  test('submit a transition and observe a real server-backed computed state', async () => {
    await page.getByLabel('Valence (-1 to 1)').fill('0.4');
    await page.getByLabel('Intensity (0 to 1)').fill('0.6');
    await page.getByLabel('Relevance (0 to 1)').fill('0.3');
    await page.getByLabel('Surprise (0 to 1)').fill('0.2');
    await page.getByLabel('Uncertainty (0 to 1)').fill('0.1');
    await page
      .getByRole('button', { name: 'Run deterministic transition' })
      .click();

    await expect(
      page.getByRole('heading', {
        name: 'Computational model-estimated state',
      }),
    ).toBeVisible();
    await expect(page.getByText('Model identity')).toBeVisible();
    await expect(
      page.getByText('deterministic-emotional-dynamics').first(),
    ).toBeVisible();
    await expect(
      page.getByText('DEFAULT_DETERMINISTIC_MODEL_PARAMETERS'),
    ).toBeVisible();
  });

  test('render the canonical scientific disclosure on the product surface', async () => {
    const disclosure = page.locator(DISCLOSURE_SELECTOR).first();
    await expect(disclosure).toBeVisible();
    await expect(disclosure).toContainText(
      'not a measurement of a person\u0027s true emotional state',
    );
    for (const claim of PROHIBITED_CLAIMS) {
      await expect(page.locator('body')).not.toContainText(claim);
    }
  });

  test('persist the computed state across a full page reload', async () => {
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Most recent computational state' }),
    ).toBeVisible();
    // The reload wipes browser/React state: the panel must re-fetch the
    // persisted backend state rather than rely on in-memory results.
    await expect(
      page.getByText(
        'No computational state has been computed for this profile yet.',
      ),
    ).toHaveCount(0);
    await expect(page.getByText(/Computed at/)).toBeVisible();
  });

  test('re-authenticate and retain access to the same persisted context', async () => {
    await page.getByRole('button', { name: 'Log out' }).click();
    await expect(page).toHaveURL(/\/login$/);

    await page.getByLabel('Email').fill(USER_A.email);
    await page.getByLabel('Password').fill(USER_A.password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/app/);
    await expect(page.getByText(/Signed in as/)).toContainText(USER_A.email);
    await expect(
      page.getByText(
        'No computational state has been computed for this profile yet.',
      ),
    ).toHaveCount(0);
    await expect(page.getByText(/Computed at/)).toBeVisible();
  });

  test('reject an invalid structured event with a safe product-facing message', async () => {
    await page.getByLabel('Context (optional JSON)').fill('not-json');
    await page
      .getByRole('button', { name: 'Run deterministic transition' })
      .click();
    // The page also carries Next.js's empty route announcer (role=alert);
    // scope to the product error message itself.
    await expect(
      page
        .getByRole('alert')
        .filter({ hasText: 'Context must be valid JSON.' }),
    ).toBeVisible();
  });

  test('deny a second user access to another user project (server authority)', async ({
    browser,
  }) => {
    expect(projectIdA).toBeTruthy();

    const intruderContext = await browser.newContext();
    const intruderPage = await intruderContext.newPage();
    await intruderPage.goto('/register');
    await intruderPage.getByLabel('Name').fill(USER_B.name);
    await intruderPage.getByLabel('Email').fill(USER_B.email);
    await intruderPage.getByLabel('Password').fill(USER_B.password);
    await intruderPage.getByRole('button', { name: 'Create account' }).click();

    // Phase 3 contract: the intruder's registration also grants no session.
    await expect(
      intruderPage.getByRole('heading', {
        name: 'Confirm your email address',
      }),
    ).toBeVisible();

    // Verify and deliberately sign in so the intruder holds a real session.
    await intruderPage.goto(
      `/api/auth/verify-email?token=${signVerificationToken(
        USER_B.email,
      )}&callbackURL=${encodeURIComponent(VERIFICATION_CALLBACK)}`,
    );
    await intruderPage.goto('/login');
    await intruderPage.getByLabel('Email').fill(USER_B.email);
    await intruderPage.getByLabel('Password').fill(USER_B.password);
    await intruderPage.getByRole('button', { name: 'Sign in' }).click();

    // The intruder has no workspace of their own (empty state, no fixtures).
    await expect(
      intruderPage.getByRole('heading', {
        name: 'No authorized project is available',
      }),
    ).toBeVisible();

    // Server authority: a direct API request with the intruder's session
    // cookie must be denied, regardless of any UI state.
    const response = await intruderPage.request.get(
      `/api/v1/projects/${projectIdA}/profiles`,
    );
    expect(response.status()).toBe(403);
    const body = (await response.json()) as {
      error?: { code?: string; message?: string };
    };
    expect(body.error?.code).toBe('forbidden');
    expect(body.error?.message).toBe('Project access is not permitted.');

    await intruderContext.close();
  });
});
