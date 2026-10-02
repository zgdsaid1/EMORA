import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Node-environment coverage for the /app session-expiry redirect added in
 * page.tsx. Auth, headers, navigation, discovery, and the dev-only fixture
 * are mocked so this test never touches @emora/database (no DATABASE_URL
 * required) and never renders JSX.
 */
const mocks = vi.hoisted(() => {
  class AuthenticationError extends Error {}
  class RedirectSignal extends Error {
    constructor(public readonly url: string) {
      super('REDIRECT');
    }
  }
  return {
    requireAuth: vi.fn(),
    redirect: vi.fn((url: string) => {
      throw new RedirectSignal(url);
    }),
    discoverAuthorizedProjects: vi.fn(),
    discoverAuthorizedProfiles: vi.fn(),
    ensureControlledFixture: vi.fn(),
    grantControlledMembership: vi.fn(),
    AuthenticationError,
    RedirectSignal,
  };
});

vi.mock('@emora/auth', () => ({
  requireAuth: mocks.requireAuth,
  AuthenticationError: mocks.AuthenticationError,
}));

vi.mock('next/headers', () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

vi.mock('../../server/discovery', () => ({
  discoverAuthorizedProjects: mocks.discoverAuthorizedProjects,
  discoverAuthorizedProfiles: mocks.discoverAuthorizedProfiles,
}));

vi.mock('../../server/transitions/fixture', () => ({
  ensureControlledFixture: mocks.ensureControlledFixture,
  grantControlledMembership: mocks.grantControlledMembership,
}));

const { default: ProtectedAppPage } = await import('./page');

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const PROFILE_ID = '22222222-2222-4222-8222-222222222222';

function searchParamsOf(
  query: Record<string, string | string[] | undefined>,
): Promise<Record<string, string | string[] | undefined>> {
  return Promise.resolve(query);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('/app session-expiry recovery', () => {
  it('redirects to /login with the validated return target on AuthenticationError', async () => {
    mocks.requireAuth.mockRejectedValue(
      new mocks.AuthenticationError('expired'),
    );

    await expect(
      ProtectedAppPage({
        searchParams: searchParamsOf({
          projectId: PROJECT_ID,
          profileId: PROFILE_ID,
          other: 'value',
        }),
      }),
    ).rejects.toBeInstanceOf(mocks.RedirectSignal);

    expect(mocks.redirect).toHaveBeenCalledTimes(1);
    expect(mocks.redirect).toHaveBeenCalledWith(
      `/login?callbackUrl=${encodeURIComponent(
        `/app?projectId=${PROJECT_ID}&profileId=${PROFILE_ID}`,
      )}`,
    );
    expect(mocks.discoverAuthorizedProjects).not.toHaveBeenCalled();
  });

  it('drops invalid and array-valued selection parameters from the return target', async () => {
    mocks.requireAuth.mockRejectedValue(
      new mocks.AuthenticationError('expired'),
    );

    await expect(
      ProtectedAppPage({
        searchParams: searchParamsOf({
          projectId: ['a', 'b'],
          profileId: 'not-a-uuid',
        }),
      }),
    ).rejects.toBeInstanceOf(mocks.RedirectSignal);

    expect(mocks.redirect).toHaveBeenCalledWith(
      `/login?callbackUrl=${encodeURIComponent('/app')}`,
    );
  });

  it('rethrows a non-authentication error and never calls redirect', async () => {
    const boom = new Error('infrastructure failure');
    mocks.requireAuth.mockRejectedValue(boom);

    await expect(
      ProtectedAppPage({ searchParams: searchParamsOf({}) }),
    ).rejects.toBe(boom);

    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
