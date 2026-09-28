import { afterAll, describe, expect, it } from 'vitest';
import { and, eq, inArray } from 'drizzle-orm';

import {
  auditLogs,
  db,
  emotionalEvents,
  emotionalProfiles,
  emotionalStates,
  organizationMembers,
  organizations,
  projects,
  users,
} from '@emora/database';

import {
  SCIENTIFIC_DISCLOSURE_CODE,
  SCIENTIFIC_DISCLOSURE_TEXT,
} from '../disclosure';
import { TransitionHistoryError } from './errors';
import { readTransitionHistory } from './service';

/**
 * Slice C1 read-path persistence tests against the real database: exact read
 * contract, deterministic bounded ordering, the successful-read audit row with
 * its metadata allow-list, fail-closed audit, and project/profile isolation.
 * Transitions are seeded through Slice 1's real transition service (production
 * write path) except for the ordering test, which inserts rows with fully
 * controlled ordering keys. Controlled test fixtures only.
 *
 * `@emora/auth` (used by the service for `recordAuditEvent`) requires
 * AUTH_SECRET at module load.
 */
process.env.AUTH_SECRET ??= 'integration-only-secret';
process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';

const databaseUrl = process.env.DATABASE_URL;
const integration = process.env.CI ? describe : describe.skipIf(!databaseUrl);

const STRONG_EVENT = {
  valence: 0.9,
  intensity: 1,
  relevance: 1,
  surprise: 0.5,
  uncertainty: 0.2,
} as const;

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
      name: `Slice C1 Test Org ${unique}`,
      slug: `slicec1-org-${unique}`,
    })
    .returning();
  const [user] = await db
    .insert(users)
    .values({ email: `slicec1-${unique}@example.test`, name: 'Slice C1 Test' })
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
      name: `Slice C1 Test Project ${unique}`,
      slug: `slicec1-project-${unique}`,
    })
    .returning();
  const profileData = (await import('../fixture')).CONTROLLED_PROFILE_DATA;
  const [profile] = await db
    .insert(emotionalProfiles)
    .values({
      projectId: project.id,
      externalReference: `slicec1-profile-${unique}`,
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

/** Seed a real transition through Slice 1's production write path. */
async function seedTransition(scenario: Scenario, at: Date = new Date()) {
  const { runProjectScopedTransition } = await import('../service');
  return runProjectScopedTransition({
    userId: scenario.userId,
    organizationId: scenario.organizationId,
    projectId: scenario.projectId,
    profileId: scenario.profileId,
    idempotencyKey: crypto.randomUUID(),
    request: { ...STRONG_EVENT },
    requestId: crypto.randomUUID(),
    now: at,
  });
}

function read(
  scenario: Scenario,
  options: {
    organizationId?: string;
    profileId?: string;
    limit?: number;
  } = {},
) {
  return readTransitionHistory({
    userId: scenario.userId,
    organizationId: options.organizationId ?? scenario.organizationId,
    projectId: scenario.projectId,
    profileId: options.profileId ?? scenario.profileId,
    limit: options.limit ?? 50,
    requestId: crypto.randomUUID(),
  });
}

async function readAudits(scenario: Scenario) {
  return db
    .select()
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.organizationId, scenario.organizationId),
        eq(auditLogs.action, 'emotional_event.history_read'),
      ),
    );
}

interface Violation {
  readonly code: string;
  readonly status: number;
  readonly category: string;
}

async function violationOf(fn: () => Promise<unknown>): Promise<Violation> {
  try {
    await fn();
    throw new Error('Expected the call to fail, but it succeeded.');
  } catch (error) {
    if (error instanceof TransitionHistoryError) {
      return {
        code: error.code,
        status: error.status,
        category: error.errorCategory,
      };
    }
    throw error;
  }
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

integration('Slice C1 transition history read persistence', () => {
  it('returns a 200 empty list for an authorized profile with no rows and writes one audit row', async () => {
    const scenario = await createScenario();

    const result = await read(scenario);
    expect(result.status).toBe(200);
    expect(result.body.transitions).toEqual([]);
    expect(result.body.disclosure).toBe(SCIENTIFIC_DISCLOSURE_CODE);
    expect(result.body.disclosureText).toBe(SCIENTIFIC_DISCLOSURE_TEXT);

    const audits = await readAudits(scenario);
    expect(audits).toHaveLength(1);
    expect(audits[0].action).toBe('emotional_event.history_read');
    expect(audits[0].resourceType).toBe('emotional_event');
    expect(audits[0].resourceId).toBeNull();
  });

  it('writes exactly one audit row for a multi-row successful read', async () => {
    const scenario = await createScenario();
    const base = new Date();
    await seedTransition(scenario, base);
    await seedTransition(scenario, new Date(base.getTime() + 1_000));
    await seedTransition(scenario, new Date(base.getTime() + 2_000));

    const result = await read(scenario);
    expect(result.body.transitions).toHaveLength(3);

    const audits = await readAudits(scenario);
    expect(audits).toHaveLength(1);
  });

  it('records audit metadata containing only the approved fields', async () => {
    const scenario = await createScenario();
    await seedTransition(scenario);

    await read(scenario);

    const audits = await readAudits(scenario);
    expect(audits).toHaveLength(1);
    const metadata = (audits[0].metadata ?? {}) as Record<string, unknown>;
    expect(Object.keys(metadata).sort()).toEqual(
      ['outcome', 'profileId', 'projectId', 'requestId'].sort(),
    );
    expect(metadata.outcome).toBe('succeeded');
    expect(metadata.projectId).toBe(scenario.projectId);
    expect(metadata.profileId).toBe(scenario.profileId);
    expect(typeof metadata.requestId).toBe('string');
  });

  it('exposes only the governed allow-list fields', async () => {
    const scenario = await createScenario();
    await seedTransition(scenario);

    const result = await read(scenario);
    expect(Object.keys(result.body).sort()).toEqual(
      ['disclosure', 'disclosureText', 'requestId', 'transitions'].sort(),
    );
    const item = result.body.transitions[0];
    expect(Object.keys(item).sort()).toEqual(
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
    const serialized = JSON.stringify(result.body);
    // Verify forbidden JSON keys (quoted), not prose substrings: the canonical
    // scientific disclosure text legitimately contains the word "context".
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
  });

  it('orders rows deterministically by timestamp DESC, createdAt DESC, id DESC', async () => {
    const scenario = await createScenario();
    const base = new Date('2026-09-28T10:00:00.000Z');

    const rows = [
      {
        id: '00000000-0000-4000-8000-000000000001',
        timestamp: new Date(base.getTime() + 2_000),
        createdAt: new Date(base.getTime() + 1_000),
      },
      {
        id: '00000000-0000-4000-8000-000000000002',
        timestamp: new Date(base.getTime() + 2_000),
        createdAt: new Date(base.getTime() + 2_000),
      },
      {
        id: '00000000-0000-4000-8000-000000000003',
        timestamp: new Date(base.getTime() + 2_000),
        createdAt: new Date(base.getTime() + 2_000),
      },
      {
        id: '00000000-0000-4000-8000-000000000004',
        timestamp: new Date(base.getTime() + 1_000),
        createdAt: new Date(base.getTime() + 3_000),
      },
    ];

    await db.insert(emotionalEvents).values(
      rows.map((row) => ({
        id: row.id,
        projectId: scenario.projectId,
        profileId: scenario.profileId,
        timestamp: row.timestamp,
        createdAt: row.createdAt,
        source: 'api_transition',
        valence: 0.1,
        intensity: 0.2,
        relevance: 0.3,
        surprise: 0.4,
        uncertainty: 0.5,
      })),
    );

    const result = await read(scenario, { limit: 50 });
    expect(result.body.transitions.map((item) => item.eventId)).toEqual([
      '00000000-0000-4000-8000-000000000003',
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000004',
    ]);
  });

  it('bounds the result to the requested limit, newest first', async () => {
    const scenario = await createScenario();
    const base = new Date();
    await seedTransition(scenario, base);
    const second = await seedTransition(scenario, new Date(base.getTime() + 1_000));
    const third = await seedTransition(scenario, new Date(base.getTime() + 2_000));

    const result = await read(scenario, { limit: 2 });
    expect(result.body.transitions).toHaveLength(2);
    expect(result.body.transitions[0].eventId).toBe(third.body.eventId);
    expect(result.body.transitions[1].eventId).toBe(second.body.eventId);
  });

  it('does not expose a profile that belongs to another project (no existence oracle)', async () => {
    const scenarioA = await createScenario();
    const scenarioB = await createScenario();
    await seedTransition(scenarioB);

    // scenarioA's project + scenarioB's profile matches nothing and is
    // indistinguishable from "no transitions" (200 empty, not 404).
    const crossProject = await read(scenarioA, { profileId: scenarioB.profileId });
    expect(crossProject.status).toBe(200);
    expect(crossProject.body.transitions).toEqual([]);

    // scenarioB's own data remains intact and readable under its own project.
    const own = await read(scenarioB);
    expect(own.body.transitions).toHaveLength(1);
  });

  it('fails closed when the successful-read audit row cannot be written', async () => {
    const scenario = await createScenario();
    await seedTransition(scenario);
    const before = await readAudits(scenario);

    // A nonexistent organization id passes Zod but violates the audit FK — the
    // audit insert fails after the read, so the whole read fails closed.
    expect(
      await violationOf(() =>
        read(scenario, { organizationId: crypto.randomUUID() }),
      ),
    ).toEqual({
      code: 'internal_error',
      status: 500,
      category: 'read_audit_failed',
    });

    const after = await readAudits(scenario);
    expect(after).toHaveLength(before.length);
  });
});
