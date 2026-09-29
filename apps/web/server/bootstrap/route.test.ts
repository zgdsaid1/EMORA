import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  bootstrapFirstWorkspace: vi.fn(),
  AuthenticationError: class AuthenticationError extends Error {},
}));

vi.mock('@emora/auth', () => ({
  requireAuth: mocks.requireAuth,
  AuthenticationError: mocks.AuthenticationError,
}));

vi.mock('./service', () => ({
  bootstrapFirstWorkspace: mocks.bootstrapFirstWorkspace,
}));

const { POST } = await import('../../app/api/v1/bootstrap/route');

const USER_ID = '11111111-1111-4111-8111-111111111111';
const BODY = {
  organizationName: 'EMORA Research',
  organizationSlug: 'emora-research',
  projectName: 'Workspace',
  projectSlug: 'workspace',
};

function makeRequest(options: {
  body?: unknown;
  contentType?: string;
  malformed?: boolean;
} = {}): NextRequest {
  const headers = new Headers();
  headers.set('content-type', options.contentType ?? 'application/json');
  return {
    headers,
    json: options.malformed
      ? async () => {
          throw new SyntaxError('bad json');
        }
      : async () => options.body ?? BODY,
  } as unknown as NextRequest;
}

async function invoke(options?: Parameters<typeof makeRequest>[0]) {
  const response = await POST(makeRequest(options));
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAuth.mockResolvedValue({ user: { id: USER_ID } });
  mocks.bootstrapFirstWorkspace.mockResolvedValue({
    status: 201,
    body: {
      requestId: 'request-id',
      organizationId: '22222222-2222-4222-8222-222222222222',
      organizationName: 'EMORA Research',
      organizationSlug: 'emora-research',
      projectId: '33333333-3333-4333-8333-333333333333',
      projectName: 'Workspace',
      projectSlug: 'workspace',
    },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('POST /api/v1/bootstrap', () => {
  it('returns 401 and does not call the service when unauthenticated', async () => {
    mocks.requireAuth.mockRejectedValue(new mocks.AuthenticationError());
    const { status, body } = await invoke();
    expect(status).toBe(401);
    expect((body.error as Record<string, unknown>).code).toBe(
      'unauthenticated',
    );
    expect(mocks.bootstrapFirstWorkspace).not.toHaveBeenCalled();
  });

  it('rejects non-JSON and malformed JSON without calling the service', async () => {
    const nonJson = await invoke({ contentType: 'text/plain' });
    expect(nonJson.status).toBe(400);
    expect((nonJson.body.error as Record<string, unknown>).code).toBe(
      'invalid_content_type',
    );

    const malformed = await invoke({ malformed: true });
    expect(malformed.status).toBe(400);
    expect((malformed.body.error as Record<string, unknown>).code).toBe(
      'invalid_input',
    );
    expect(mocks.bootstrapFirstWorkspace).not.toHaveBeenCalled();
  });

  it('passes only session identity and validated fields to the service', async () => {
    const { status, body } = await invoke();
    expect(status).toBe(201);
    expect(body).toMatchObject({
      organizationId: expect.any(String),
      projectId: expect.any(String),
    });
    expect(mocks.bootstrapFirstWorkspace).toHaveBeenCalledWith({
      userId: USER_ID,
      requestId: expect.any(String),
      request: BODY,
    });
  });

  it('maps the already-initialized result to a safe 409', async () => {
    const { BootstrapError } = await import('./errors');
    mocks.bootstrapFirstWorkspace.mockRejectedValue(
      new BootstrapError('bootstrap_already_initialized'),
    );
    const { status, body } = await invoke();
    expect(status).toBe(409);
    expect((body.error as Record<string, unknown>).code).toBe(
      'bootstrap_already_initialized',
    );
  });
});