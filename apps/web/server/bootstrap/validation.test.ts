import { describe, expect, it } from 'vitest';

import { BootstrapError } from './errors';
import { parseBootstrapRequest } from './validation';

const VALID_REQUEST = {
  organizationName: '  EMORA Lab  ',
  organizationSlug: 'emora-lab',
  projectName: '  Research  ',
  projectSlug: 'research',
};

describe('bootstrap request validation', () => {
  it('trims names and preserves explicit slugs', () => {
    expect(parseBootstrapRequest(VALID_REQUEST)).toEqual({
      organizationName: 'EMORA Lab',
      organizationSlug: 'emora-lab',
      projectName: 'Research',
      projectSlug: 'research',
    });
  });

  it.each([
    { ...VALID_REQUEST, organizationName: '   ' },
    { ...VALID_REQUEST, projectName: '' },
    { ...VALID_REQUEST, organizationSlug: 'EMORA-Lab' },
    { ...VALID_REQUEST, projectSlug: 'two words' },
    { ...VALID_REQUEST, projectSlug: 'trailing-' },
    { ...VALID_REQUEST, organizationId: 'client-controlled' },
    { ...VALID_REQUEST, projectId: 'client-controlled' },
    { ...VALID_REQUEST, userId: 'client-controlled' },
    { ...VALID_REQUEST, ownerUserId: 'client-controlled' },
    { ...VALID_REQUEST, organizationMemberId: 'client-controlled' },
    { ...VALID_REQUEST, role: 'OWNER' },
  ])('rejects invalid or unknown fields: %o', (request) => {
    expect(() => parseBootstrapRequest(request)).toThrow(BootstrapError);
    try {
      parseBootstrapRequest(request);
    } catch (error) {
      expect(error).toMatchObject({ code: 'invalid_input', status: 400 });
    }
  });
});