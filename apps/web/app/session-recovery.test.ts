import { describe, expect, it, vi } from 'vitest';

import {
  handleUnauthorizedResponse,
  validateReturnTarget,
} from './session-recovery';

const projectId = '11111111-1111-4111-8111-111111111111';
const profileId = '22222222-2222-4222-8222-222222222222';

describe('validateReturnTarget', () => {
  it('accepts /app and the canonical project/profile identifier pair', () => {
    expect(validateReturnTarget('/app')).toBe('/app');
    expect(
      validateReturnTarget(`/app?projectId=${projectId}&profileId=${profileId}`),
    ).toBe(`/app?projectId=${projectId}&profileId=${profileId}`);
  });

  it.each([
    '//evil.com',
    'https://evil.com',
    '/evil.com',
    '/app/',
    '/app/extra',
    `/app?projectId=${projectId}`,
    `/app?profileId=${profileId}`,
    `/app?projectId=invalid&profileId=${profileId}`,
    `/app?projectId=123&profileId=${profileId}`,
    `/app?projectId=${projectId}&profileId=${profileId}&admin=true`,
    `/app?projectId=${projectId}&profileId=${profileId}&unknown=value`,
    `/app?profileId=${profileId}&projectId=${projectId}`,
    `/app?projectId=${projectId}&profileId=${profileId}&profileId=${profileId}`,
    `/app?projectId=%E0%A4%A&profileId=${profileId}`,
    'javascript:alert(1)',
    '\\\\evil.com',
    '/\\\\evil.com',
    '/app\\\\@evil.com',
    '/%2f%2fevil.com',
    '/%252f%252fevil.com',
    '/%5c%5cevil.com',
    '/app#section',
    '',
    undefined,
    null,
    42,
  ])('rejects unsafe or unsupported target %s', (candidate) => {
    expect(validateReturnTarget(candidate)).toBe('/app');
  });

  it('rejects invalid identifiers and duplicate parameters by falling back to /app', () => {
    expect(validateReturnTarget('/app?projectId=invalid&other=value')).toBe(
      '/app',
    );
    expect(
      validateReturnTarget(
        `/app?projectId=${projectId}&projectId=${profileId}`,
      ),
    ).toBe('/app');
  });
});

describe('handleUnauthorizedResponse', () => {
  it('navigates only on 401 and encodes the validated callback URL', () => {
    const navigate = vi.fn();

    expect(
      handleUnauthorizedResponse(
        401,
        `/app?projectId=${projectId}&profileId=${profileId}`,
        navigate,
      ),
    ).toBe(true);
    expect(navigate).toHaveBeenCalledWith(
      `/login?callbackUrl=${encodeURIComponent(`/app?projectId=${projectId}&profileId=${profileId}`)}`,
    );
  });

  it('falls back to /app when a callback target contains an unexpected parameter', () => {
    const navigate = vi.fn();

    handleUnauthorizedResponse(
      401,
      `/app?projectId=${projectId}&profileId=${profileId}&admin=true`,
      navigate,
    );

    expect(navigate).toHaveBeenCalledWith('/login?callbackUrl=%2Fapp');
  });

  it.each([200, 403, 404, 409, 500])(
    'does not navigate for status %s',
    (status) => {
      const navigate = vi.fn();
      expect(handleUnauthorizedResponse(status, '/app', navigate)).toBe(false);
      expect(navigate).not.toHaveBeenCalled();
    },
  );
});
