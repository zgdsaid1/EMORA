import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import type { NextRequest } from 'next/server';
import { and, eq, inArray, sql } from 'drizzle-orm';

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

const authMocks = vi.hoisted(() => ({ requireAuth: vi.fn() }));

vi.mock('@emora/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@emora/auth')>();
  return { ...actual, requireAuth: authMocks.requireAuth };
});

process.env.AUTH_SECRET ??= 'integration-only-secret';
process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';

const databaseUrl = process.env.DATABASE_URL;
const integration = process.env.CI ? describe : describe.skipIf(!databaseUrl);
const createdOrganizationIds: string[] = [];
const createdUserIds: string[] = [];

interface Scenario {
  readonly userId: string;
}

const validRequest = (suffix: string) => ({
  organizationName: `Bootstrap Organization ${suffix}`,
  organizationSlug: `bootstrap-org-${suffix}`,
  projectName: `Initial Project ${suffix}`,
  projectSlug: `initial-project-${suffix}`,
});

async function createScenario(): Promise<Scenario> {
  const unique = crypto.randomUUID();
  const [user] = await db
    .insert(users)
    .values({
      email: `bootstrap-${unique}@example.test`,
      name: 'Bootstrap Test User',
    })
    .returning({ id: users.id });
  createdUserIds.push(user.id);
  return { userId: user.id };
}

function prepareAuth(scenario: Scenario): void {
  authMocks.requireAuth.mockResolvedValue({ user: { id: scenario.userId } });
}

async function invoke(
  scenario: Scenario,
  body: unknown,
): Promise<{ status: number; body: Record<string, unknown> }> {
  prepareAuth(scenario);
  const { POST } = await import('../../app/api/v1/bootstrap/route');
  const request = {
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
  } as unknown as NextRequest;
  const response = await POST(request);
  const responseBody = (await response.json()) as Record<string, unknown>;
  if (response.status === 201) {
    createdOrganizationIds.push(
      String(responseBody.organizationId),
    );
  }
  return { status: response.status, body: responseBody };
}

async function auditsFor(userId: string) {
  return db
    .select({
      organizationId: auditLogs.organizationId,
      userId: auditLogs.userId,
      action: auditLogs.action,
      resourceType: auditLogs.resourceType,
      resourceId: auditLogs.resourceId,
      metadata: auditLogs.metadata,
    })
    .from(auditLogs)
    .where(
      and(
        eq(auditLogs.userId, userId),
        eq(auditLogs.action, 'organization.bootstrapped'),
      ),
    );
}

async function createExistingWorkspace(ownerUserId: string) {
  const unique = crypto.randomUUID();
  const [organization] = await db
    .insert(organizations)
    .values({ name: `Existing ${unique}`, slug: `existing-${unique}` })
    .returning({ id: organizations.id });
  createdOrganizationIds.push(organization.id);
  const [project] = await db
    .insert(projects)
    .values({
      organizationId: organization.id,
      name: `Existing Project ${unique}`,
      slug: `existing-project-${unique}`,
    })
    .returning({ id: projects.id });
  await db.insert(organizationMembers).values({
    organizationId: organization.id,
    userId: ownerUserId,
    role: 'OWNER',
  });
  return { organizationId: organization.id, projectId: project.id };
}

afterAll(async () => {
  if (!databaseUrl) return;
  for (const organizationId of new Set(createdOrganizationIds)) {
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
});

integration('first-user workspace bootstrap persistence', () => {
  it('creates one organization/project/OWNER, audits once, discovers it and continues existing flow', async () => {
    const scenario = await createScenario();
    const request = validRequest(crypto.randomUUID());
    const { status, body } = await invoke(scenario, request);
    expect(status).toBe(201);

    const organizationId = String(body.organizationId);
    const projectId = String(body.projectId);
    const [organization] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId));
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));
    const memberships = await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.organizationId, organizationId));

    expect(project.organizationId).toBe(organization.id);
    expect(
      await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, request.organizationSlug)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(projects)
        .where(eq(projects.organizationId, organizationId)),
    ).toHaveLength(1);
    expect(memberships).toHaveLength(1);
    expect(memberships[0]).toMatchObject({
      userId: scenario.userId,
      role: 'OWNER',
    });

    const audits = await auditsFor(scenario.userId);
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({
      organizationId,
      userId: scenario.userId,
      action: 'organization.bootstrapped',
      resourceType: 'organization',
      resourceId: organizationId,
    });
    expect(Object.keys(audits[0].metadata ?? {}).sort()).toEqual(
      [
        'organizationMemberId',
        'outcome',
        'projectId',
        'requestId',
        'role',
      ].sort(),
    );
    expect(audits[0].metadata).toMatchObject({
      projectId,
      organizationMemberId: memberships[0].id,
      role: 'OWNER',
      requestId: body.requestId,
      outcome: 'succeeded',
    });

    const { GET: getProjects } = await import(
      '../../app/api/v1/projects/route'
    );
    const discoveryResponse = await getProjects({
      headers: new Headers(),
    } as unknown as NextRequest);
    expect(discoveryResponse.status).toBe(200);
    const listed = (await discoveryResponse.json()) as {
      projects: { projectId: string }[];
    };
    expect(listed.projects.map((item) => item.projectId)).toEqual([projectId]);

    const { createProjectProfile } = await import('../profiles/service');

    const { parseCreateProfileRequest } = await import(
      '../profiles/validation'
    );
    const profile = await createProjectProfile({
      userId: scenario.userId,
      organizationId,
      projectId,
      requestId: crypto.randomUUID(),
      request: parseCreateProfileRequest({
        externalReference: `profile-${crypto.randomUUID()}`,
        personalityProfile: {
          emotionalSensitivity: 0.5,
          baselineTrust: 0.5,
          baselineAnxiety: 0.5,
          attachmentSensitivity: 0.5,
          nostalgiaSensitivity: 0.5,
          jealousySensitivity: 0.5,
        },
      }),
    });
    const { runProjectScopedTransition } = await import(
      '../transitions/service'
    );
    const transition = await runProjectScopedTransition({
      userId: scenario.userId,
      organizationId,
      projectId,
      profileId: profile.profileId,
      idempotencyKey: crypto.randomUUID(),
      request: {
        valence: 0.5,
        intensity: 0.5,
        relevance: 0.5,
        surprise: 0.5,
        uncertainty: 0.5,
      },
      requestId: crypto.randomUUID(),
      now: new Date(),
    });
    expect(transition.status).toBe(201);
    const { readLatestState } = await import('../states/service');
    const latest = await readLatestState({
      userId: scenario.userId,
      organizationId,
      projectId,
      profileId: profile.profileId,
      requestId: crypto.randomUUID(),
    });
    expect(latest.body.stateId).toBe(transition.stateId);
  });

  it('returns 409 for sequential retry without creating another workspace or audit', async () => {
    const scenario = await createScenario();
    const request = validRequest(crypto.randomUUID());
    const first = await invoke(scenario, request);
    const second = await invoke(scenario, validRequest(crypto.randomUUID()));

    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    expect((second.body.error as Record<string, unknown>).code).toBe(
      'bootstrap_already_initialized',
    );
    const organizationId = String(first.body.organizationId);
    const memberships = await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, scenario.userId));
    expect(memberships).toHaveLength(1);
    expect(
      await db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, request.organizationSlug)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(projects)
        .where(eq(projects.organizationId, organizationId)),
    ).toHaveLength(1);
    expect(await auditsFor(scenario.userId)).toHaveLength(1);
  });

  it('serializes concurrent requests so only one bootstrap commits', async () => {
    const scenario = await createScenario();
    const results = await Promise.all([
      invoke(scenario, validRequest(crypto.randomUUID())),
      invoke(scenario, validRequest(crypto.randomUUID())),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
    expect(
      results.find((result) => result.status === 409)?.body.error,
    ).toMatchObject({ code: 'bootstrap_already_initialized' });
    const success = results.find((result) => result.status === 201)!;
    const organizationId = String(success.body.organizationId);
    const memberships = await db
      .select()
      .from(organizationMembers)
      .where(eq(organizationMembers.userId, scenario.userId));
    expect(memberships).toHaveLength(1);
    expect(
      await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, organizationId)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(projects)
        .where(eq(projects.organizationId, organizationId)),
    ).toHaveLength(1);
    expect(await auditsFor(scenario.userId)).toHaveLength(1);
  });

  it('maps an organization slug conflict without revealing the existing organization', async () => {
    const scenario = await createScenario();
    const unique = crypto.randomUUID();
    const slug = `occupied-${unique}`;
    const [existing] = await db
      .insert(organizations)
      .values({ name: 'Existing organization', slug })
      .returning({ id: organizations.id });
    createdOrganizationIds.push(existing.id);

    const { status, body } = await invoke(scenario, {
      ...validRequest(unique),
      organizationSlug: slug,
    });
    expect(status).toBe(409);
    expect((body.error as Record<string, unknown>).code).toBe(
      'bootstrap_slug_conflict',
    );
    expect(JSON.stringify(body)).not.toContain(existing.id);
    expect(await db.select().from(organizationMembers).where(eq(organizationMembers.userId, scenario.userId))).toHaveLength(0);
    expect(await auditsFor(scenario.userId)).toHaveLength(0);
  });

  it('rolls back the organization when project slug insertion conflicts', async () => {
    const scenario = await createScenario();
    const unique = crypto.randomUUID();
    const request = {
      ...validRequest(unique),
      projectSlug: 'bootstrap-forced-project-conflict',
    };
    await db.execute(sql`
      CREATE OR REPLACE FUNCTION public.test_bootstrap_project_conflict()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.slug = 'bootstrap-forced-project-conflict' THEN
          RAISE EXCEPTION 'duplicate project slug'
            USING ERRCODE = '23505', CONSTRAINT = 'projects_organization_slug_unique';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await db.execute(sql`
      CREATE TRIGGER test_bootstrap_project_conflict_trigger
      BEFORE INSERT ON projects FOR EACH ROW
      EXECUTE FUNCTION public.test_bootstrap_project_conflict()
    `);

    try {
      const { status, body } = await invoke(scenario, request);
      expect(status).toBe(409);
      expect((body.error as Record<string, unknown>).code).toBe(
        'bootstrap_slug_conflict',
      );
      expect(
        await db
          .select()
          .from(organizations)
          .where(eq(organizations.slug, request.organizationSlug)),
      ).toHaveLength(0);
      expect(await db.select().from(organizationMembers).where(eq(organizationMembers.userId, scenario.userId))).toHaveLength(0);
      expect(await auditsFor(scenario.userId)).toHaveLength(0);
    } finally {
      await db.execute(sql`
        DROP TRIGGER IF EXISTS test_bootstrap_project_conflict_trigger ON projects
      `);
      await db.execute(sql`
        DROP FUNCTION IF EXISTS public.test_bootstrap_project_conflict()
      `);
    }
  });

  it('rolls back organization and project when OWNER membership insertion fails', async () => {
    const scenario = await createScenario();
    const request = validRequest(crypto.randomUUID());
    await db.execute(sql`
      CREATE OR REPLACE FUNCTION public.test_bootstrap_membership_failure()
      RETURNS trigger AS $$
      BEGIN
        IF NEW.role = 'OWNER' THEN
          RAISE EXCEPTION 'forced membership insert failure'
            USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    await db.execute(sql`
      CREATE TRIGGER test_bootstrap_membership_failure_trigger
      BEFORE INSERT ON organization_members FOR EACH ROW
      EXECUTE FUNCTION public.test_bootstrap_membership_failure()
    `);

    try {
      const { status, body } = await invoke(scenario, request);
      expect(status).toBe(500);
      expect((body.error as Record<string, unknown>).code).toBe('internal_error');
      expect(
        await db
          .select()
          .from(organizations)
          .where(eq(organizations.slug, request.organizationSlug)),
      ).toHaveLength(0);
      expect(
        await db
          .select()
          .from(projects)
          .where(eq(projects.slug, request.projectSlug)),
      ).toHaveLength(0);
      expect(await auditsFor(scenario.userId)).toHaveLength(0);
    } finally {
      await db.execute(sql`
        DROP TRIGGER IF EXISTS test_bootstrap_membership_failure_trigger
        ON organization_members
      `);
      await db.execute(sql`
        DROP FUNCTION IF EXISTS public.test_bootstrap_membership_failure()
      `);
    }
  });

  it('rolls back all rows on audit failure and allows retry after rollback', async () => {
    const scenario = await createScenario();
    const unique = crypto.randomUUID();
    const request = validRequest(unique);
    await db.execute(sql`
      ALTER TABLE audit_logs ADD CONSTRAINT test_bootstrap_audit_failure
      CHECK (metadata->>'requestId' IS DISTINCT FROM '__bootstrap_audit_failure__')
    `);

    try {
      const { bootstrapFirstWorkspace } = await import('./service');
      await expect(
        bootstrapFirstWorkspace({
          userId: scenario.userId,
          requestId: '__bootstrap_audit_failure__',
          request,
        }),
      ).rejects.toMatchObject({ code: 'internal_error', status: 500 });

      expect(
        await db
          .select()
          .from(organizations)
          .where(eq(organizations.slug, request.organizationSlug)),
      ).toHaveLength(0);
      expect(await db.select().from(organizationMembers).where(eq(organizationMembers.userId, scenario.userId))).toHaveLength(0);
      expect(await auditsFor(scenario.userId)).toHaveLength(0);
    } finally {
      await db.execute(sql`
        ALTER TABLE audit_logs DROP CONSTRAINT test_bootstrap_audit_failure
      `);
    }

    const retry = await invoke(scenario, request);
    expect(retry.status).toBe(201);
  });

  it('rejects an existing organization identifier and preserves existing isolation', async () => {
    const existingOwner = await createScenario();
    const outsider = await createScenario();
    const existing = await createExistingWorkspace(existingOwner.userId);

    const { status, body } = await invoke(outsider, {
      ...validRequest(crypto.randomUUID()),
      organizationId: existing.organizationId,
    });
    expect(status).toBe(400);
    expect((body.error as Record<string, unknown>).code).toBe('invalid_input');
    expect(await db.select().from(organizationMembers).where(eq(organizationMembers.userId, outsider.userId))).toHaveLength(0);

    const { requireProjectAccess, AuthorizationError } = await import(
      '@emora/auth'
    );
    await expect(
      requireProjectAccess(outsider.userId, existing.projectId, 'VIEWER'),
    ).rejects.toBeInstanceOf(AuthorizationError);
  });
});