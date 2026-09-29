import { db, auditLogs, organizationMembers, organizations, projects, users } from '@emora/database';
import { eq } from 'drizzle-orm';

import { BootstrapError } from './errors';
import type { AcceptedBootstrapRequest } from './validation';

export interface BootstrapServiceInput {
  readonly userId: string;
  readonly requestId: string;
  readonly request: AcceptedBootstrapRequest;
}

export interface BootstrapResponseBody {
  readonly requestId: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly organizationSlug: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly projectSlug: string;
}

export interface BootstrapServiceResult {
  readonly status: 201;
  readonly body: BootstrapResponseBody;
}

function hasConstraint(error: unknown, constraintName: string): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5; depth += 1) {
    if (typeof current !== 'object' || current === null) return false;
    const candidate = current as {
      code?: unknown;
      constraint?: unknown;
      constraint_name?: unknown;
      constraintName?: unknown;
      cause?: unknown;
    };
    if (
      candidate.code === '23505' &&
      (candidate.constraint === constraintName ||
        candidate.constraint_name === constraintName ||
        candidate.constraintName === constraintName)
    ) {
      return true;
    }
    current = candidate.cause;
  }
  return false;
}

export async function bootstrapFirstWorkspace(
  input: BootstrapServiceInput,
): Promise<BootstrapServiceResult> {
  try {
    return await db.transaction(async (tx) => {
      const [lockedUser] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1)
        .for('update');
      if (!lockedUser) throw new BootstrapError('internal_error');

      const [existingProject] = await tx
        .select({ id: projects.id })
        .from(organizationMembers)
        .innerJoin(
          projects,
          eq(projects.organizationId, organizationMembers.organizationId),
        )
        .where(eq(organizationMembers.userId, input.userId))
        .limit(1);
      if (existingProject) {
        throw new BootstrapError('bootstrap_already_initialized');
      }

      const [organization] = await tx
        .insert(organizations)
        .values({
          name: input.request.organizationName,
          slug: input.request.organizationSlug,
        })
        .returning({ id: organizations.id });

      const [project] = await tx
        .insert(projects)
        .values({
          organizationId: organization.id,
          name: input.request.projectName,
          slug: input.request.projectSlug,
        })
        .returning({ id: projects.id });

      const [membership] = await tx
        .insert(organizationMembers)
        .values({
          organizationId: organization.id,
          userId: input.userId,
          role: 'OWNER',
        })
        .returning({ id: organizationMembers.id });

      await tx.insert(auditLogs).values({
        organizationId: organization.id,
        userId: input.userId,
        action: 'organization.bootstrapped',
        resourceType: 'organization',
        resourceId: organization.id,
        metadata: {
          projectId: project.id,
          organizationMemberId: membership.id,
          role: 'OWNER',
          requestId: input.requestId,
          outcome: 'succeeded',
        },
      });

      return {
        status: 201 as const,
        body: {
          requestId: input.requestId,
          organizationId: organization.id,
          organizationName: input.request.organizationName,
          organizationSlug: input.request.organizationSlug,
          projectId: project.id,
          projectName: input.request.projectName,
          projectSlug: input.request.projectSlug,
        },
      };
    });
  } catch (error) {
    if (error instanceof BootstrapError) throw error;
    if (
      hasConstraint(error, 'organizations_slug_unique') ||
      hasConstraint(error, 'projects_organization_slug_unique')
    ) {
      throw new BootstrapError('bootstrap_slug_conflict');
    }
    throw new BootstrapError('internal_error');
  }
}