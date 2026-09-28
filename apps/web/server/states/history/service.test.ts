import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  recordAuditEvent: vi.fn(),
  select: vi.fn(),
  toDomainModelVersion: vi.fn(),
  toDomainState: vi.fn(),
  eq: vi.fn((left: unknown, right: unknown) => [left, right]),
  desc: vi.fn((column: unknown) => column),
  and: vi.fn((...conditions: unknown[]) => conditions),
  emotionalStates: {
    id: 'states.id',
    timestamp: 'states.timestamp',
    state: 'states.state',
    modelVersionId: 'states.modelVersionId',
    projectId: 'states.projectId',
    profileId: 'states.profileId',
    createdAt: 'states.createdAt',
  },
  modelVersions: {
    id: 'models.id',
    name: 'models.name',
    version: 'models.version',
  },
}));

vi.mock('@emora/auth', () => ({
  recordAuditEvent: mocks.recordAuditEvent,
}));

vi.mock('@emora/database', () => ({
  db: { select: mocks.select },
  emotionalStates: mocks.emotionalStates,
  modelVersions: mocks.modelVersions,
}));

vi.mock('@emora/emotional-core', () => ({
  emotionNames: ['joy', 'fear'],
  DeterministicEmotionalDynamicsProvider: class {
    readonly identifier = 'deterministic-emotional-dynamics';
    readonly modelVersion = { version: '1.0.0' };
  },
}));

vi.mock('drizzle-orm', () => ({
  and: mocks.and,
  desc: mocks.desc,
  eq: mocks.eq,
}));

vi.mock('../../transitions/domain-mapping', () => ({
  toDomainModelVersion: mocks.toDomainModelVersion,
  toDomainState: mocks.toDomainState,
}));

const { readStateHistory } = await import('./service');
const { StateHistoryError } = await import('./errors');

const INPUT = {
  userId: 'user-id',
  organizationId: 'organization-id',
  projectId: 'project-id',
  profileId: 'profile-id',
  limit: 2,
  requestId: 'request-id',
};

function makeRow(id: string, modelVersionId: string) {
  return {
    id,
    timestamp: new Date('2026-09-22T10:00:00.000Z'),
    state: { private: 'raw-state' },
    modelVersionId,
    modelId: modelVersionId,
    modelName: 'persisted-model',
    modelVersion: '1.0.0',
  };
}

function createQuery(rows: ReturnType<typeof makeRow>[]) {
  const query = {
    from: vi.fn(() => query),
    leftJoin: vi.fn(() => query),
    where: vi.fn(() => query),
    orderBy: vi.fn(() => query),
    limit: vi.fn().mockResolvedValue(rows),
  };
  mocks.select.mockReturnValue(query);
  return query;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.recordAuditEvent.mockResolvedValue(undefined);
  mocks.toDomainModelVersion.mockImplementation((row: unknown) => row);
  mocks.toDomainState.mockImplementation((row: unknown) => {
    const { timestamp } = row as { timestamp: Date };
    return {
      timestamp: timestamp.toISOString(),
      emotionVector: { joy: 0.7, fear: 0.3 },
      dimensions: { valence: 0.4, arousal: 0.5, intensity: 0.6 },
      metadata: undefined,
    };
  });
});

describe('readStateHistory service', () => {
  it('validates every row, returns the allow-list and writes one audit event', async () => {
    const rows = [makeRow('state-2', 'model-2'), makeRow('state-1', 'model-1')];
    createQuery(rows);

    const result = await readStateHistory(INPUT);

    expect(result.status).toBe(200);
    expect(result.body.states).toHaveLength(2);
    expect(result.body.states.map((state) => state.stateId)).toEqual([
      'state-2',
      'state-1',
    ]);
    expect(Object.keys(result.body.states[0]).sort()).toEqual(
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
    expect(result.body.states[0].modelIdentity.modelVersionId).toBe('model-2');
    expect(mocks.toDomainModelVersion).toHaveBeenCalledTimes(2);
    expect(mocks.toDomainState).toHaveBeenCalledTimes(2);
    expect(mocks.recordAuditEvent).toHaveBeenCalledTimes(1);
    expect(mocks.recordAuditEvent).toHaveBeenCalledWith({
      organizationId: INPUT.organizationId,
      userId: INPUT.userId,
      action: 'emotional_state.history_read',
      resourceType: 'emotional_state',
      metadata: {
        projectId: INPUT.projectId,
        profileId: INPUT.profileId,
        requestId: INPUT.requestId,
        outcome: 'succeeded',
      },
    });
  });

  it('audits an authorized empty result exactly once', async () => {
    createQuery([]);
    const result = await readStateHistory(INPUT);
    expect(result.body.states).toEqual([]);
    expect(mocks.recordAuditEvent).toHaveBeenCalledTimes(1);
  });

  it('fails the whole read and does not audit when any row is invalid', async () => {
    createQuery([makeRow('state-1', 'model-1'), makeRow('state-2', 'model-2')]);
    mocks.toDomainState
      .mockImplementationOnce(() => ({
        timestamp: '2026-09-22T10:00:00.000Z',
        emotionVector: { joy: 0.7, fear: 0.3 },
        dimensions: { valence: 0.4, arousal: 0.5, intensity: 0.6 },
      }))
      .mockImplementationOnce(() => {
        throw new Error('invalid persisted state');
      });

    await expect(readStateHistory(INPUT)).rejects.toMatchObject({
      code: 'state_data_invalid',
      status: 500,
    });
    expect(mocks.toDomainState).toHaveBeenCalledTimes(2);
    expect(mocks.recordAuditEvent).not.toHaveBeenCalled();
  });

  it('fails closed when the single audit event cannot be written', async () => {
    createQuery([]);
    mocks.recordAuditEvent.mockRejectedValue(new Error('audit unavailable'));

    const read = readStateHistory(INPUT);
    await expect(read).rejects.toBeInstanceOf(StateHistoryError);
    await expect(read).rejects.toMatchObject({
      code: 'internal_error',
      status: 500,
      errorCategory: 'read_audit_failed',
    });
    expect(mocks.recordAuditEvent).toHaveBeenCalledTimes(1);
  });
});