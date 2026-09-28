import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

import {
  SCIENTIFIC_DISCLOSURE_CODE,
  SCIENTIFIC_DISCLOSURE_TEXT,
} from '../../transitions/disclosure';

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireProjectAccess: vi.fn(),
  readStateHistory: vi.fn(),
  AuthenticationError: class AuthenticationError extends Error {},
  AuthorizationError: class AuthorizationError extends Error {},
}));

vi.mock('@emora/auth', () => ({
  requireAuth: mocks.requireAuth,
  requireProjectAccess: mocks.requireProjectAccess,
  AuthenticationError: mocks.AuthenticationError,
  AuthorizationError: mocks.AuthorizationError,
}));

vi.mock('./service', () => ({
  readStateHistory: mocks.readStateHistory,
}));

const { GET } = await import(
  '../../../app/api/v1/projects/[projectId]/profiles/[profileId]/states/route'
);

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const PROFILE_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';
const ORGANIZATION_ID = '44444444-4444-4444-8444-444444444444';
const STATE_ID = '55555555-5555-4555-8555-555555555555';

function stateItem() {
  return {
    stateId: STATE_ID,
    timestamp: '2026-09-22T10:00:00.000Z',
    emotionVector: {
      love: 0.1,
      fear: 0.2,
      nostalgia: 0.3,
      jealousy: 0.4,
      trust: 0.5,
      anger: 0.6,
      joy: 0.7,
    },
    dimensions: { valence: 0.1, arousal: 0.2, intensity: 0.3 },
    modelIdentity: {
      modelVersionId: '66666666-6666-4666-8666-666666666666',
      name: 'emora-deterministic-dynamics',
      version: '1.0.0',
      providerIdentifier: 'deterministic-emotional-dynamics',
      providerVersion: '1.0.0',
    },
    parameterIdentity: 'DEFAULT_DETERMINISTIC_MODEL_PARAMETERS',
    initialized: false,
  };
}

function successBody(states = [stateItem()]) {
  return {
    requestId: 'request-id',
    disclosure: SCIENTIFIC_DISCLOSURE_CODE,
    disclosureText: SCIENTIFIC_DISCLOSURE_TEXT,
    states,
  };
}

const context = (params: Record<string, string> = {}) => ({
  params: Promise.resolve({
    projectId: PROJECT_ID,
    profileId: PROFILE_ID,
    ...params,
  }),
});

function makeRequest(query?: string): NextRequest {
  return {
    headers: new Headers(),
    nextUrl: new URL(`http://localhost/ignored${query ?? ''}`),
  } as unknown as NextRequest;
}

async function invoke(
  options: { params?: Record<string, string>; query?: string } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await GET(
    makeRequest(options.query),
    context(options.params) as never,
  );
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

let logged: string[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  logged = [];
  vi.spyOn(console, 'log').mockImplementation((line: unknown) => {
    logged.push(String(line));
  });
  mocks.requireAuth.mockResolvedValue({ user: { id: USER_ID } });
  mocks.requireProjectAccess.mockResolvedValue({
    project: { id: PROJECT_ID, organizationId: ORGANIZATION_ID },
    membership: { role: 'VIEWER' },
  });
  mocks.readStateHistory.mockResolvedValue({
    status: 200,
    body: successBody(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('bounded emotional-state history route', () => {
  it('returns 401 without invoking the audited service', async () => {
    mocks.requireAuth.mockRejectedValue(new mocks.AuthenticationError());
    const { status, body } = await invoke();
    expect(status).toBe(401);
    expect((body.error as Record<string, unknown>).code).toBe('unauthenticated');
    expect(mocks.readStateHistory).not.toHaveBeenCalled();
  });

  it('returns 403 without invoking the audited service', async () => {
    mocks.requireProjectAccess.mockRejectedValue(
      new mocks.AuthorizationError(),
    );
    const { status, body } = await invoke();
    expect(status).toBe(403);
    expect((body.error as Record<string, unknown>).code).toBe('forbidden');
    expect(mocks.readStateHistory).not.toHaveBeenCalled();
  });

  it.each(['0', '-1', '51', '1.5', 'abc'])('rejects limit=%s', async (limit) => {
    const { status, body } = await invoke({ query: `?limit=${limit}` });
    expect(status).toBe(400);
    expect((body.error as Record<string, unknown>).code).toBe('invalid_input');
    expect(mocks.readStateHistory).not.toHaveBeenCalled();
  });

  it('uses the default limit and invokes the audited service exactly once', async () => {
    const { status } = await invoke();
    expect(status).toBe(200);
    expect(mocks.requireProjectAccess).toHaveBeenCalledWith(
      USER_ID,
      PROJECT_ID,
      'VIEWER',
    );
    expect(mocks.readStateHistory).toHaveBeenCalledTimes(1);
    expect(mocks.readStateHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: USER_ID,
        organizationId: ORGANIZATION_ID,
        projectId: PROJECT_ID,
        profileId: PROFILE_ID,
        limit: 10,
        requestId: expect.any(String),
      }),
    );
  });

  it('forwards an explicit valid limit', async () => {
    const { status } = await invoke({ query: '?limit=25' });
    expect(status).toBe(200);
    expect(mocks.readStateHistory).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 25 }),
    );
  });

  it('returns the governed response shape and excludes internal fields', async () => {
    const { status, body } = await invoke();
    expect(status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(
      ['disclosure', 'disclosureText', 'requestId', 'states'].sort(),
    );
    expect(body.disclosure).toBe(SCIENTIFIC_DISCLOSURE_CODE);
    expect(body.disclosureText).toBe(SCIENTIFIC_DISCLOSURE_TEXT);
    const states = body.states as Record<string, unknown>[];
    expect(states).toHaveLength(1);
    expect(Object.keys(states[0]).sort()).toEqual(
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
    expect(Object.keys(states[0].dimensions as object).sort()).toEqual([
      'arousal',
      'intensity',
      'valence',
    ]);
    expect(JSON.stringify(body)).not.toContain('confidence');
    expect(JSON.stringify(body)).not.toContain('createdAt');
    expect(JSON.stringify(body)).not.toContain('projectId');
    expect(JSON.stringify(body)).not.toContain('profileId');
    expect(JSON.stringify(body)).not.toContain('eventId');
  });

  it('returns an empty states list for an authorized empty result', async () => {
    mocks.readStateHistory.mockResolvedValue({
      status: 200,
      body: successBody([]),
    });
    const { status, body } = await invoke();
    expect(status).toBe(200);
    expect(body.states).toEqual([]);
    expect(mocks.readStateHistory).toHaveBeenCalledTimes(1);
  });

  it('maps invalid persisted state data to a safe 500', async () => {
    const { StateHistoryError } = await import('./errors');
    mocks.readStateHistory.mockRejectedValue(
      new StateHistoryError('state_data_invalid', 'state_integrity'),
    );
    const { status, body } = await invoke();
    expect(status).toBe(500);
    expect((body.error as Record<string, unknown>).code).toBe(
      'state_data_invalid',
    );
    expect(JSON.stringify(body)).not.toContain('state_integrity');
  });

  it('fails closed when the audited read fails', async () => {
    const { StateHistoryError } = await import('./errors');
    mocks.readStateHistory.mockRejectedValue(
      new StateHistoryError('internal_error', 'read_audit_failed'),
    );
    const { status, body } = await invoke();
    expect(status).toBe(500);
    expect((body.error as Record<string, unknown>).code).toBe('internal_error');
    expect(JSON.stringify(body)).not.toContain('read_audit_failed');
    expect(mocks.readStateHistory).toHaveBeenCalledTimes(1);
  });
});