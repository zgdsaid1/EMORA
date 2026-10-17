import { createHmac } from 'node:crypto';

import { expect, test } from '@playwright/test';
import {
  currentTestDatabaseName,
  TEST_DATABASE_NAME,
} from '../../packages/database/src/database-identity.js';

/**
 * C2 read-only State History browser journey. The user, project, profile, and
 * states are created through the real application against the isolated test
 * database. The history route always receives the real authenticated request
 * first; selected responses are delayed or altered only after that request
 * reaches the server so recoverable client states can be exercised.
 */

const RUN_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const USER = {
  name: `C2 E2E User ${RUN_ID}`,
  email: `c2-e2e-${RUN_ID}@example.test`,
  password: 'e2e-pass-1234',
};
const ORG_SLUG = `c2-e2e-org-${RUN_ID}`;
const PROJECT_SLUG = `c2-e2e-project-${RUN_ID}`;
const PROFILE_REFERENCE = `c2-e2e-profile-${RUN_ID}`;
const AUTH_SECRET =
  process.env.AUTH_SECRET ?? 'emora-e2e-only-secret-not-for-production-32';
const VERIFICATION_TTL_SECONDS = 60 * 60;
const VERIFICATION_CALLBACK = '/verify-email?status=verified';
const DISCLOSURE_CODE =
  'COMPUTATIONAL_MODEL_ESTIMATED_STATE_NOT_HUMAN_MEASUREMENT';

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

test('authenticated State History stays scoped, ordered, and localized', async ({
  page,
}) => {
  expect(await currentTestDatabaseName()).toBe(TEST_DATABASE_NAME);

  // The serial Product Reality journey runs immediately before this spec and
  // shares the same localhost IP. Better Auth allows three sign-in/sign-up
  // requests per IP in a rolling 10-second window, so let that window expire.
  await page.waitForTimeout(11_000);

  let responseMode:
    'normal' | 'delay' | 'malformed' | 'server-error' | 'abort' = 'normal';
  let signalDelayedResponse!: () => void;
  let releaseDelayedResponse!: () => void;
  const delayedResponseStarted = new Promise<void>((resolve) => {
    signalDelayedResponse = resolve;
  });
  const delayedResponseGate = new Promise<void>((resolve) => {
    releaseDelayedResponse = resolve;
  });
  const historyRequests: string[] = [];

  page.on('request', (request) => {
    const url = new URL(request.url());
    if (
      request.method() === 'GET' &&
      url.pathname.endsWith('/states') &&
      url.searchParams.get('limit') === '10'
    ) {
      historyRequests.push(request.url());
    }
  });

  await page.route(
    (url) =>
      url.pathname.endsWith('/states') &&
      url.searchParams.get('limit') === '10',
    async (route) => {
      const response = await route.fetch();
      const mode = responseMode;
      responseMode = 'normal';

      if (mode === 'delay') {
        signalDelayedResponse();
        await delayedResponseGate;
        await route.fulfill({ response });
        return;
      }

      if (mode === 'malformed') {
        const body = (await response.json()) as Record<string, unknown>;
        delete body.states;
        await route.fulfill({ response, body: JSON.stringify(body) });
        return;
      }

      if (mode === 'server-error') {
        await route.fulfill({
          response,
          status: 500,
          body: JSON.stringify({
            error: { message: 'private internal failure detail' },
          }),
        });
        return;
      }

      if (mode === 'abort') {
        await route.abort();
        return;
      }

      await route.fulfill({ response });
    },
  );

  await page.goto('/register');
  await page.getByLabel('Name').fill(USER.name);
  await page.getByLabel('Email').fill(USER.email);
  await page.getByLabel('Password').fill(USER.password);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(
    page.getByRole('heading', { name: 'Confirm your email address' }),
  ).toBeVisible();

  const token = signVerificationToken(USER.email);
  await page.goto(
    `/api/auth/verify-email?token=${token}&callbackURL=${encodeURIComponent(
      VERIFICATION_CALLBACK,
    )}`,
  );
  await expect(
    page.getByRole('heading', { name: 'Email address confirmed' }),
  ).toBeVisible();

  await page.goto('/login');
  await page.getByLabel('Email').fill(USER.email);
  await page.getByLabel('Password').fill(USER.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/app$/);

  await page.getByLabel('Organization name').fill(`C2 E2E Org ${RUN_ID}`);
  await page.getByLabel('Organization slug').fill(ORG_SLUG);
  await page
    .getByLabel('Initial project name')
    .fill(`C2 E2E Project ${RUN_ID}`);
  await page.getByLabel('Initial project slug').fill(PROJECT_SLUG);
  await page.getByRole('button', { name: 'Create workspace' }).click();
  const projectLink = page
    .getByRole('link')
    .filter({ hasText: `C2 E2E Project ${RUN_ID}` })
    .first();
  await expect(projectLink).toBeVisible();

  await page.getByLabel('External reference').fill(PROFILE_REFERENCE);
  const profileCreated = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname.endsWith('/profiles') &&
      response.ok(),
  );
  await page.getByRole('button', { name: 'Create profile' }).click();
  const createdProfile = (await (await profileCreated).json()) as {
    projectId: string;
    profileId: string;
  };
  await expect(page.getByText('Profile created.')).toBeVisible();

  const reloadLink = page.getByRole('link', {
    name: 'Reload the workspace to see the new profile.',
  });
  const reloadHref = await reloadLink.getAttribute('href');
  const selectedUrl = new URL(reloadHref ?? '', 'http://localhost');
  const projectId = selectedUrl.searchParams.get('projectId');
  const profileId = createdProfile.profileId;
  expect(projectId).toMatch(/^[0-9a-f-]{36}$/i);
  expect(profileId).toMatch(/^[0-9a-f-]{36}$/i);
  expect(createdProfile.projectId).toBe(projectId);

  responseMode = 'delay';
  await reloadLink.click();
  await delayedResponseStarted;

  const historyPanel = page.getByRole('region', { name: 'State history' });
  await expect(
    historyPanel.getByRole('heading', { name: 'State history' }),
  ).toBeVisible();
  await expect(historyPanel.getByRole('status')).toHaveText('Reading...');
  releaseDelayedResponse();
  await expect(
    historyPanel.getByText(
      'No computed states have been recorded for this profile.',
    ),
  ).toBeVisible();
  await expect(
    historyPanel.locator(`[data-disclosure="${DISCLOSURE_CODE}"]`),
  ).toBeVisible();

  const firstHistoryUrl = new URL(historyRequests[0]);
  expect(firstHistoryUrl.pathname).toBe(
    `/api/v1/projects/${projectId}/profiles/${profileId}/states`,
  );
  expect(firstHistoryUrl.searchParams.get('limit')).toBe('10');

  // The workspace header contains the route context and its locale control.
  // Scope through that semantic banner so another shell control cannot make
  // the selector ambiguous; the breadcrumb remains stable across locales.
  const workspaceHeader = page
    .getByRole('banner')
    .filter({ has: page.locator('.header-path') });
  await expect(workspaceHeader).toHaveCount(1);
  const language = workspaceHeader.getByRole('combobox');
  await expect(language).toHaveCount(1);
  await language.selectOption('fr');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(
    page.getByRole('heading', { name: 'Historique des états' }),
  ).toBeVisible();
  await language.selectOption('ar');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(
    page.getByRole('heading', { name: 'سجل الحالات' }),
  ).toBeVisible();
  await language.selectOption('en');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(
    page.getByRole('heading', { name: 'State history' }),
  ).toBeVisible();
  expect(historyRequests).toHaveLength(1);

  const transitionButton = page.getByRole('button', {
    name: 'Run deterministic transition',
  });
  const transitionForm = transitionButton.locator('xpath=ancestor::form');
  const requestCountBeforeValidationFailure = historyRequests.length;
  await page.getByLabel('Context (optional JSON)').fill('not-json');
  await transitionButton.click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Context must be valid JSON.' }),
  ).toBeVisible();
  expect(historyRequests).toHaveLength(requestCountBeforeValidationFailure);

  await page.getByLabel('Context (optional JSON)').fill('');
  await transitionForm.evaluate((form) => {
    (form as HTMLFormElement).noValidate = true;
  });
  await page.getByLabel('Valence (-1 to 1)').fill('2');
  const rejectedTransition = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith('/transitions'),
  );
  const requestCountBeforeHttpFailure = historyRequests.length;
  await transitionButton.click();
  expect((await rejectedTransition).status()).toBe(400);
  await expect(
    page.getByRole('alert').filter({ hasText: 'The request is not valid.' }),
  ).toBeVisible();
  expect(historyRequests).toHaveLength(requestCountBeforeHttpFailure);

  await page.getByLabel('Valence (-1 to 1)').fill('0.4');
  const firstTransition = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith('/transitions') &&
      response.ok(),
  );
  const firstHistoryRead = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      new URL(response.url()).pathname.endsWith('/states') &&
      new URL(response.url()).searchParams.get('limit') === '10',
  );
  await transitionButton.click();
  expect((await firstTransition).ok()).toBe(true);
  const firstHistoryResponse = await firstHistoryRead;
  const firstHistoryBody = (await firstHistoryResponse.json()) as {
    disclosure: string;
    disclosureText: string;
    states: Array<Record<string, unknown>>;
  };
  expect(firstHistoryBody.disclosure).toBe(DISCLOSURE_CODE);
  expect(firstHistoryBody.states).toHaveLength(1);
  expect(Object.keys(firstHistoryBody.states[0]).sort()).toEqual(
    [
      'dimensions',
      'emotionVector',
      'initialized',
      'modelIdentity',
      'parameterIdentity',
      'stateId',
      'timestamp',
    ].sort(),
  );
  await expect(historyPanel.locator('ol time')).toHaveCount(1);
  await expect(
    historyPanel
      .locator('aside')
      .filter({ hasText: firstHistoryBody.disclosureText }),
  ).toBeVisible();

  await page.waitForTimeout(25);
  const secondTransition = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith('/transitions') &&
      response.ok(),
  );
  const secondHistoryRead = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      new URL(response.url()).pathname.endsWith('/states') &&
      new URL(response.url()).searchParams.get('limit') === '10',
  );
  await transitionButton.click();
  expect((await secondTransition).ok()).toBe(true);
  const secondHistoryResponse = await secondHistoryRead;
  const secondHistoryBody = (await secondHistoryResponse.json()) as {
    states: Array<{ timestamp: string }>;
  };
  expect(secondHistoryBody.states).toHaveLength(2);
  const displayedTimestamps = await historyPanel
    .locator('ol time')
    .evaluateAll((nodes) =>
      nodes.map((node) => (node as HTMLTimeElement).dateTime),
    );
  expect(displayedTimestamps).toEqual(
    secondHistoryBody.states.map((state) => state.timestamp),
  );

  responseMode = 'malformed';
  const malformedRead = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      new URL(response.url()).pathname.endsWith('/states'),
  );
  await historyPanel
    .getByRole('button', { name: 'Retry history read' })
    .click();
  expect((await malformedRead).status()).toBe(200);
  await expect(
    historyPanel.getByRole('alert').filter({
      hasText: 'State history could not be read. Please try again.',
    }),
  ).toBeVisible();

  responseMode = 'server-error';
  const failedRead = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      new URL(response.url()).pathname.endsWith('/states'),
  );
  await historyPanel
    .getByRole('button', { name: 'Retry history read' })
    .click();
  expect((await failedRead).status()).toBe(500);
  await expect(
    historyPanel.getByRole('alert').filter({
      hasText: 'State history could not be read. Please try again.',
    }),
  ).toBeVisible();
  await expect(historyPanel).not.toContainText(
    'private internal failure detail',
  );

  responseMode = 'abort';
  await historyPanel
    .getByRole('button', { name: 'Retry history read' })
    .click();
  await expect(
    historyPanel.getByRole('alert').filter({
      hasText: 'State history could not be read. Please try again.',
    }),
  ).toBeVisible();

  await page.context().clearCookies();
  const unauthorizedRead = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      new URL(response.url()).pathname.endsWith('/states'),
  );
  await historyPanel
    .getByRole('button', { name: 'Retry history read' })
    .click();
  expect((await unauthorizedRead).status()).toBe(401);
  await page.waitForURL(/\/login/);

  for (const requestUrl of historyRequests) {
    const url = new URL(requestUrl);
    expect(url.pathname).toBe(
      `/api/v1/projects/${projectId}/profiles/${profileId}/states`,
    );
    expect(url.searchParams.get('limit')).toBe('10');
  }
});
