import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { NextRequest } from 'next/server';
import { and, eq, inArray } from 'drizzle-orm';

import {
  auditLogs,
  db,
  emotionalEvents,
  emotionalProfiles,
  emotionalStates,
  modelVersions,
  organizationMembers,
  organizations,
  projects,
  users,
} from '@emora/database';

const authMocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  requireProjectAccess: vi.fn(),
}));

vi.mock('@emora/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@emora/auth')>();
  return {
    ...actual,
    requireAuth: authMocks.requireAuth,
    requireProjectAccess: authMocks.requireProjectAccess,
  };
});

/**
 * Slice D1.2 database-backed validation for the bounded historical state read.
 * Auth is stubbed only to exercise the real route; Drizzle reads, domain
 * mapping, audit writes, and all seeded data use the actual PostgreSQL stack.
 */
process.env.AUTH_SECRET ??= 'integration-only-secret';
process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';

const databaseUrl = process.env.DATABASE_URL;
const integration = process.env.CI ? describe : describe.skipIf(!databaseUrl);

const createdOrganizationIds: string[] = [];
const createdUserIds: string[] = [];

interface Scenario {
  readonly organizationId: string;
  readonly userId: string;
  readonly projectId: string;
  readonly profileId: string;
}

async function createScenario(): Promise<Scenario> {
  const unique = crypto.randomUUID();
  const [organization] = await db
    .insert(organizations)
    .values({
      name: `Slice D1.2 Test Org ${unique}`,
      slug: `sliced12-org-${unique}`,
    })
    .returning();
  const [user] = await db
    .insert(users)
    .values({ email: `sliced12-${unique}@example.test`, name: 'Slice D1.2' })
    .returning();
  createdOrganizationIds.push(organization.id);
  createdUserIds.push(user.id);

  await db.insert(organizationMembers).values({
    organizationId: organization.id,
    userId: user.id,
    role: 'VIEWER',
  });
  const [project] = await db
    .insert(projects)
    .values({
      organizationId: organization.id,
      name: `Slice D1.2 Project ${unique}`,
      slug: `sliced12-project-${unique}`,
    })
    .returning();
  const profileData = (
    await import('../../transitions/fixture')
  ).CONTROLLED_PROFILE_DATA;
  const [profile] = await db
    .insert(emotionalProfiles)
    .values({
      projectId: project.id,
      externalReference: `sliced12-profile-${unique}`,
      profileData: profileData as unknown as Record<string, unknown>,
    })
    .returning();

  return {
    organizationId: organization.id,
    userId: user.id,
    projectId: project.id,
    profileId: profile.id,
  };
}

async function seedTransition(scenario: Scenario, at: Date = new Date()) {
  const { runProjectScopedTransition } = await import(
    '../../transitions/service'
  );
  return runProjectScopedTransition({
    userId: scenario.userId,
    organizationId: scenario.organizationId,
    projectId: scenario.projectId,
    profileId: scenario.profileId,
    idempotencyKey: crypto.randomUUID(),
    request: {
      valence: 0.9,
      intensity: 1,
      relevance: 1,
      surprise: 0.5,
      uncertainty: 0.2,
    },
    requestId: crypto.randomUUID(),
    now: at,
  });
}

async function seedValidStateRows(scenario: Scenario, count: number) {
  const base = new Date(Date.now() - 60_000);
  const seed = await seedTransition(scenario, base);
  const [source] = await db
    .select({ state: emotionalStates.state, modelVersionId: emotionalStates.modelVersionId })
    .from(emotionalStates)
    .where(eq(emotionalStates.id, seed.body.stateId));

  const additionalRows = Array.from({ length: count - 1 }, (_, index) => {
    const at = new Date(base.getTime() + (index + 1) * 1_000);
    return {
      id: crypto.randomUUID(),
      projectId: scenario.projectId,
      profileId: scenario.profileId,
      timestamp: at,
      createdAt: at,
      state: source.state,
      modelVersionId: source.modelVersionId,
    };
  });
  if (additionalRows.length > 0) {
    await db.insert(emotionalStates).values(additionalRows);
  }
  return [seed.body.stateId, ...additionalRows.map((row) => row.id)];
}

async function readAudits(scenario: Scenario) {
  return db
    .select({
      action: auditLogs.action,
      resourceType: auditLogs.resourceType,
      resourceId: auditLogs.resourceId,
      userId: auditLogs.userId,
      metadata: auditLogs.metadata,
    })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.organizationId, scenario.organizationId),
        eq(auditLogs.action, 'emotional_state.history_read'),
      ),
    );
}

function prepareAuth(
  scenario: Scenario,
  options: {
    projectId?: string;
    organizationId?: string;
  } = {},
): void {
  authMocks.requireAuth.mockResolvedValue({ user: { id: scenario.userId } });
  authMocks.requireProjectAccess.mockResolvedValue({
    project: {
      id: options.projectId ?? scenario.projectId,
      organizationId: options.organizationId ?? scenario.organizationId,
    },
    membership: { role: 'VIEWER' },
  });
}

async function invokeRoute(
  scenario: Scenario,
  options: {
    query?: string;
    projectId?: string;
    profileId?: string;
    organizationId?: string;
  } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  prepareAuth(scenario, options);
  const { GET } = await import(
    '../../../app/api/v1/projects/[projectId]/profiles/[profileId]/states/route'
  );
  const request = {
    headers: new Headers(),
    nextUrl: new URL(`http://localhost/ignored${options.query ?? ''}`),
  } as unknown as NextRequest;
  const response = await GET(request, {
    params: Promise.resolve({
      projectId: options.projectId ?? scenario.projectId,
      profileId: options.profileId ?? scenario.profileId,
    }),
  });
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

afterAll(async () => {
  if (!databaseUrl) return;
  for (const organizationId of createdOrganizationIds) {
    const projectRows = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.organizationId, organizationId));
    const projectIds = projectRows.map((row) => row.id);
    if (projectIds.length > 0) {
      await db
        .delete(emotionalStates)
        .where(inArray(emotionalStates.projectId, projectIds));
      await db
        .delete(emotionalEvents)
        .where(inArray(emotionalEvents.projectId, projectIds));
      await db
        .delete(emotionalProfiles)
        .where(inArray(emotionalProfiles.projectId, projectIds));
    }
    await db
      .delete(auditLogs)
      .where(eq(auditLogs.organizationId, organizationId));
    await db
      .delete(organizationMembers)
      .where(eq(organizationMembers.organizationId, organizationId));
    await db
      .delete(projects)
      .where(eq(projects.organizationId, organizationId));
    await db.delete(organizations).where(eq(organizations.id, organizationId));
  }
  if (createdUserIds.length > 0) {
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

integration('Slice D1.2 historical state read persistence', () => {
  it('returns a bounded newest-first allow-list with persisted model identity and one audit', async () => {
    const scenario = await createScenario();
    const base = new Date(Date.now() - 60_000);
    const first = await seedTransition(scenario, base);
    const second = await seedTransition(
      scenario,
      new Date(base.getTime() + 1_000),
    );
    const third = await seedTransition(
      scenario,
      new Date(base.getTime() + 2_000),
    );

    const { status, body } = await invokeRoute(scenario, { query: '?limit=2' });
    expect(status).toBe(200);
    const states = body.states as Record<string, unknown>[];
    expect(states).toHaveLength(2);
    expect(states.map((state) => state.stateId)).toEqual([
      third.body.stateId,
      second.body.stateId,
    ]);
    expect(states.map((state) => state.stateId)).not.toContain(
      first.body.stateId,
    );

    const serialized = JSON.stringify(body);
    for (const forbiddenKey of [
      'confidence',
      'state',
      'diagnostics',
      'projectId',
      'profileId',
      'eventId',
      'createdAt',
    ]) {
      expect(serialized).not.toContain(`"${forbiddenKey}"`);
    }
    expect(Object.keys(body).sort()).toEqual(
      ['disclosure', 'disclosureText', 'requestId', 'states'].sort(),
    );
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

    const firstItem = states[0];
    const modelIdentity = firstItem.modelIdentity as Record<string, unknown>;
    const [persistedState] = await db
      .select({ modelVersionId: emotionalStates.modelVersionId })
      .from(emotionalStates)
      .where(eq(emotionalStates.id, String(firstItem.stateId)));
    const [persistedModel] = await db
      .select({ id: modelVersions.id, name: modelVersions.name, version: modelVersions.version })
      .from(modelVersions)
      .where(eq(modelVersions.id, persistedState.modelVersionId));
    expect(modelIdentity).toMatchObject({
      modelVersionId: persistedState.modelVersionId,
      name: persistedModel.name,
      version: persistedModel.version,
    });

    const audits = await readAudits(scenario);
    expect(audits).toHaveLength(1);
    expect(audits[0].action).toBe('emotional_state.history_read');
    expect(audits[0].resourceType).toBe('emotional_state');
    expect(audits[0].resourceId).toBeNull();
    expect(audits[0].userId).toBe(scenario.userId);
    const metadata = audits[0].metadata as Record<string, unknown>;
    expect(Object.keys(metadata).sort()).toEqual(
      ['outcome', 'projectId', 'profileId', 'requestId'].sort(),
    );
    expect(metadata).toMatchObject({
      outcome: 'succeeded',
      projectId: scenario.projectId,
      profileId: scenario.profileId,
    });
    expect(typeof metadata.requestId).toBe('string');
  });

  it('orders equal timestamps by createdAt DESC and then id DESC', async () => {
    const scenario = await createScenario();
    const base = new Date(Date.now() - 60_000);
    const seeds = [
      await seedTransition(scenario, base),
      await seedTransition(scenario, new Date(base.getTime() + 1_000)),
      await seedTransition(scenario, new Date(base.getTime() + 2_000)),
    ];
    const sharedTimestamp = new Date(base.getTime() + 3_000);
    const createdAtById = new Map([
      [seeds[0].body.stateId, new Date(base.getTime() + 1_000)],
      [seeds[1].body.stateId, new Date(base.getTime() + 2_000)],
      [seeds[2].body.stateId, new Date(base.getTime() + 2_000)],
    ]);
    for (const [stateId, createdAt] of createdAtById) {
      await db
        .update(emotionalStates)
        .set({ timestamp: sharedTimestamp, createdAt })
        .where(eq(emotionalStates.id, stateId));
    }

    const { status, body } = await invokeRoute(scenario, { query: '?limit=50' });
    expect(status).toBe(200);
    const actual = (body.states as Record<string, unknown>[]).map((state) =>
      String(state.stateId),
    );
    const expected = [...createdAtById.keys()].sort((left, right) => {
      const createdAtOrder =
        createdAtById.get(right)!.getTime() -
        createdAtById.get(left)!.getTime();
      return createdAtOrder || right.localeCompare(left);
    });
    expect(actual).toEqual(expected);
  });

  it('uses the default limit of 10 and accepts limits 1 and 50 against persisted rows', async () => {
    const scenario = await createScenario();
    await seedValidStateRows(scenario, 51);

    const defaultResult = await invokeRoute(scenario);
    expect(defaultResult.status).toBe(200);
    expect(defaultResult.body.states).toHaveLength(10);

    const oneResult = await invokeRoute(scenario, { query: '?limit=1' });
    expect(oneResult.status).toBe(200);
    expect(oneResult.body.states).toHaveLength(1);

    const maxResult = await invokeRoute(scenario, { query: '?limit=50' });
    expect(maxResult.status).toBe(200);
    expect(maxResult.body.states).toHaveLength(50);
    expect(await readAudits(scenario)).toHaveLength(3);
  });

  it('returns 200 empty for no rows and for a cross-project profile pair', async () => {
    const emptyScenario = await createScenario();
    const empty = await invokeRoute(emptyScenario);
    expect(empty.status).toBe(200);
    expect(empty.body.states).toEqual([]);
    expect(await readAudits(emptyScenario)).toHaveLength(1);

    const otherScenario = await createScenario();
    await seedTransition(otherScenario);
    const crossPair = await invokeRoute(emptyScenario, {
      profileId: otherScenario.profileId,
    });
    expect(crossPair.status).toBe(200);
    expect(crossPair.body.states).toEqual([]);
    expect(await readAudits(emptyScenario)).toHaveLength(2);
    expect(await readAudits(otherScenario)).toHaveLength(0);

    const ownPair = await invokeRoute(otherScenario);
    expect(ownPair.status).toBe(200);
    expect(ownPair.body.states).toHaveLength(1);
    expect(await readAudits(otherScenario)).toHaveLength(1);
  });

  it('fails the whole read on a corrupt row and writes no successful audit', async () => {
    const scenario = await createScenario();
    const base = new Date(Date.now() - 60_000);
    const older = await seedTransition(scenario, base);
    await seedTransition(scenario, new Date(base.getTime() + 1_000));
    await db
      .update(emotionalStates)
      .set({ state: { corrupted: true } as unknown as Record<string, unknown> })
      .where(eq(emotionalStates.id, older.body.stateId));

    const { status, body } = await invokeRoute(scenario, { query: '?limit=10' });
    expect(status).toBe(500);
    expect((body.error as Record<string, unknown>).code).toBe(
      'state_data_invalid',
    );
    expect(body).not.toHaveProperty('states');
    expect(await readAudits(scenario)).toHaveLength(0);
  });

  it('fails closed with 500 when the successful-read audit cannot be inserted', async () => {
    const scenario = await createScenario();
    await seedTransition(scenario);
    const invalidOrganizationId = crypto.randomUUID();

    const { status, body } = await invokeRoute(scenario, {
      organizationId: invalidOrganizationId,
    });
    expect(status).toBe(500);
    expect((body.error as Record<string, unknown>).code).toBe('internal_error');
    expect(body).not.toHaveProperty('states');
    expect(await readAudits(scenario)).toHaveLength(0);
  });
});