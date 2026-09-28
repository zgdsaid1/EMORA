import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

import {
  SCIENTIFIC_DISCLOSURE_CODE,
  SCIENTIFIC_DISCLOSURE_TEXT,
} from '../disclosure';

/**
 * Route-level tests for the Slice C1 bounded Transition History read surface.
 * The history service (which owns the successful-read audit) is mocked here;
 * the real persistence/audit path is covered by service.integration.test.ts.
 * The Slice 1 POST service is also mocked because it is imported by the same
 * route file and would otherwise initialize @emora/database at import time.
 */

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireProjectAccess: vi.fn(),
  runProjectScopedTransition: vi.fn(),
  readTransitionHistory: vi.fn(),
  AuthenticationError: class AuthenticationError extends Error {},
  AuthorizationError: class AuthorizationError extends Error {},
}));

vi.mock('@emora/auth', () => ({
  requireAuth: mocks.requireAuth,
  requireProjectAccess: mocks.requireProjectAccess,
  AuthenticationError: mocks.AuthenticationError,
  AuthorizationError: mocks.AuthorizationError,
}));

vi.mock('../service', () => ({
  runProjectScopedTransition: mocks.runProjectScopedTransition,
  requestDigest: () => 'digest',
}));

vi.mock('./service', () => ({
  readTransitionHistory: mocks.readTransitionHistory,
}));

const { GET } = await import(
  '../../../app/api/v1/projects/[projectId]/profiles/[profileId]/transitions/route'
);

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';
const PROFILE_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = '33333333-3333-4333-8333-333333333333';
const ORGANIZATION_ID = '44444444-4444-4444-8444-444444444444';
const EVENT_ID = '55555555-5555-4555-8555-555555555555';

function successBody() {
  return {
    requestId: 'request-id',
    disclosure: SCIENTIFIC_DISCLOSURE_CODE,
    disclosureText: SCIENTIFIC_DISCLOSURE_TEXT,
    transitions: [
      {
        eventId: EVENT_ID,
        timestamp: '2026-09-22T10:00:00.000Z',
        source: 'api_transition',
        valence: 0.5,
        intensity: 0.5,
        relevance: 0.5,
        surprise: 0.5,
        uncertainty: 0.5,
      },
    ],
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
  const request = makeRequest(options.query);
  const response = await GET(request, context(options.params) as never);
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
  mocks.readTransitionHistory.mockResolvedValue({
    status: 200,
    body: successBody(),
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Slice C1 transition history read route', () => {
  it('rejects malformed path parameters before authentication', async () => {
    const { status, body } = await invoke({ params: { projectId: 'bad' } });
    expect(status).toBe(400);
    expect((body.error as Record<string, unknown>).code).toBe('invalid_input');
    expect(mocks.requireAuth).not.toHaveBeenCalled();
    expect(mocks.readTransitionHistory).not.toHaveBeenCalled();
  });

  it('returns 401 for an unauthenticated request without invoking the audited service', async () => {
    mocks.requireAuth.mockRejectedValue(new mocks.AuthenticationError());
    const { status, body } = await invoke();
    expect(status).toBe(401);
    expect((body.error as Record<string, unknown>).code).toBe('unauthenticated');
    expect(mocks.readTransitionHistory).not.toHaveBeenCalled();
    const line = JSON.parse(logged[0]) as Record<string, unknown>;
    expect(line.outcome).toBe('rejected');
    expect(line.errorCategory).toBe('unauthenticated');
  });

  it('returns 403 when the caller has no project access, without audit', async () => {
    mocks.requireProjectAccess.mockRejectedValue(new mocks.AuthorizationError());
    const { status, body } = await invoke();
    expect(status).toBe(403);
    expect((body.error as Record<string, unknown>).code).toBe('forbidden');
    expect(mocks.readTransitionHistory).not.toHaveBeenCalled();
    const line = JSON.parse(logged[0]) as Record<string, unknown>;
    expect(line.outcome).toBe('rejected');
    expect(line.errorCategory).toBe('forbidden');
  });

  it('rejects limit=0 as invalid_input without invoking the service', async () => {
    const { status, body } = await invoke({ query: '?limit=0' });
    expect(status).toBe(400);
    expect((body.error as Record<string, unknown>).code).toBe('invalid_input');
    expect(mocks.readTransitionHistory).not.toHaveBeenCalled();
  });

  it('rejects a negative limit as invalid_input', async () => {
    const { status, body } = await invoke({ query: '?limit=-5' });
    expect(status).toBe(400);
    expect((body.error as Record<string, unknown>).code).toBe('invalid_input');
    expect(mocks.readTransitionHistory).not.toHaveBeenCalled();
  });

  it('rejects a limit above 50 as invalid_input', async () => {
    const { status, body } = await invoke({ query: '?limit=51' });
    expect(status).toBe(400);
    expect((body.error as Record<string, unknown>).code).toBe('invalid_input');
    expect(mocks.readTransitionHistory).not.toHaveBeenCalled();
  });

  it('rejects a non-integer limit as invalid_input', async () => {
    for (const limit of ['10.5', 'abc', '1e2', '3.0', '0.5', '']) {
      const { status, body } = await invoke({ query: `?limit=${limit}` });
      expect(status).toBe(400);
      expect((body.error as Record<string, unknown>).code).toBe('invalid_input');
    }
    expect(mocks.readTransitionHistory).not.toHaveBeenCalled();
  });

  it('applies the default limit of 10 when the parameter is missing', async () => {
    const { status } = await invoke();
    expect(status).toBe(200);
    const argument = mocks.readTransitionHistory.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(argument.limit).toBe(10);
  });

  it('accepts limit=50 and forwards it to the service', async () => {
    const { status } = await invoke({ query: '?limit=50' });
    expect(status).toBe(200);
    const argument = mocks.readTransitionHistory.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(argument.limit).toBe(50);
  });

  it('authorizes reads at the VIEWER floor and passes server-derived identifiers', async () => {
    const { status } = await invoke({ query: '?limit=3' });
    expect(status).toBe(200);
    expect(mocks.requireProjectAccess).toHaveBeenCalledWith(
      USER_ID,
      PROJECT_ID,
      'VIEWER',
    );
    const argument = mocks.readTransitionHistory.mock.calls[0][0] as Record<
      string,
      unknown
    >;
    expect(argument.organizationId).toBe(ORGANIZATION_ID);
    expect(argument.projectId).toBe(PROJECT_ID);
    expect(argument.profileId).toBe(PROFILE_ID);
    expect(argument.userId).toBe(USER_ID);
    expect(argument.limit).toBe(3);
    expect(typeof argument.requestId).toBe('string');
  });

  it('returns the exact frozen response contract with byte-identical disclosure', async () => {
    const { status, body } = await invoke();
    expect(status).toBe(200);
    expect(Object.keys(body).sort()).toEqual(
      ['disclosure', 'disclosureText', 'requestId', 'transitions'].sort(),
    );
    expect(body.disclosure).toBe(SCIENTIFIC_DISCLOSURE_CODE);
    expect(body.disclosureText).toBe(SCIENTIFIC_DISCLOSURE_TEXT);
    const transitions = body.transitions as Record<string, unknown>[];
    expect(transitions).toHaveLength(1);
    expect(Object.keys(transitions[0]).sort()).toEqual(
      [
        'eventId',
        'intensity',
        'relevance',
        'source',
        'surprise',
        'timestamp',
        'uncertainty',
        'valence',
      ].sort(),
    );
  });

  it('never exposes prohibited fields in any response', async () => {
    const { body } = await invoke();
    const serialized = JSON.stringify(body);
    // Check JSON keys (quoted) so prose words in the disclosure text — e.g.
    // "context" — cannot produce false matches.
    for (const forbiddenKey of [
      'projectId',
      'profileId',
      'context',
      'metadata',
      'idempotencyKey',
      'requestHash',
      'confidence',
      'stateId',
      'modelVersionId',
      'createdAt',
    ]) {
      expect(serialized).not.toContain(`"${forbiddenKey}"`);
    }
    expect(serialized).not.toContain('jsonb');
    expect(serialized).not.toContain('SELECT');
  });

  it('maps an audit failure to a safe 500 without leaking internals', async () => {
    const { TransitionHistoryError } = await import('./errors');
    mocks.readTransitionHistory.mockRejectedValue(
      new TransitionHistoryError('internal_error', 'read_audit_failed'),
    );
    const { status, body } = await invoke();
    expect(status).toBe(500);
    const error = body.error as Record<string, unknown>;
    expect(error.code).toBe('internal_error');
    expect(error.message).toBe('The transition history could not be read.');
    expect(JSON.stringify(body)).not.toContain('read_audit_failed');
    const line = JSON.parse(logged[0]) as Record<string, unknown>;
    expect(line.outcome).toBe('failed');
    expect(line.errorCategory).toBe('read_audit_failed');
  });

  it('fails closed with internal_error for an unexpected failure', async () => {
    mocks.readTransitionHistory.mockRejectedValue(
      new Error('raw database failure: select from emotional_events'),
    );
    const { status, body } = await invoke();
    expect(status).toBe(500);
    const error = body.error as Record<string, unknown>;
    expect(error.code).toBe('internal_error');
    expect(JSON.stringify(body)).not.toContain('emotional_events');
    expect(JSON.stringify(body)).not.toContain('stack');
    const line = JSON.parse(logged[0]) as Record<string, unknown>;
    expect(line.outcome).toBe('failed');
  });

  it('emits only allow-listed fields in the structured log on success', async () => {
    await invoke();
    expect(logged).toHaveLength(1);
    const line = JSON.parse(logged[0]) as Record<string, unknown>;
    expect(Object.keys(line).sort()).toEqual(
      [
        'event',
        'latencyMs',
        'level',
        'organizationId',
        'outcome',
        'projectId',
        'profileId',
        'requestId',
        'userId',
      ].sort(),
    );
    expect(line.event).toBe('transition_history_read');
    expect(line.outcome).toBe('succeeded');
    for (const forbidden of [
      'valence',
      'intensity',
      'relevance',
      'surprise',
      'uncertainty',
      'context',
      'idempotencyKey',
      'requestHash',
      'eventId',
      'stateId',
      'stack',
      'token',
    ]) {
      expect(logged[0]).not.toContain(forbidden);
    }
  });
});
