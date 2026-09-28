import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  AuthenticationError,
  AuthorizationError,
  requireAuth,
  requireProjectAccess,
} from '@emora/auth';
import { z } from 'zod';

import {
  StateHistoryError,
  toErrorEnvelope,
} from '../../../../../../../../server/states/history/errors';
import { readStateHistory } from '../../../../../../../../server/states/history/service';
import { parseLimit } from '../../../../../../../../server/states/history/validation';

export const dynamic = 'force-dynamic';

const paramsSchema = z.strictObject({
  projectId: z.uuid(),
  profileId: z.uuid(),
});

interface StateHistoryLogFields {
  readonly level: 'info' | 'error';
  readonly event: 'emotional_state_history_read';
  readonly requestId: string;
  readonly outcome: string;
  readonly latencyMs: number;
  readonly errorCategory?: string;
  readonly userId?: string;
  readonly organizationId?: string;
  readonly projectId?: string;
  readonly profileId?: string;
}

function logStateHistory(fields: StateHistoryLogFields): void {
  console.log(
    JSON.stringify(
      Object.fromEntries(
        Object.entries(fields).filter(([, value]) => value !== undefined),
      ),
    ),
  );
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[] | undefined>> },
) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  let organizationId: string | undefined;
  let projectId: string | undefined;
  let profileId: string | undefined;
  let userId: string | undefined;

  const finish = (outcome: string, errorCategory?: string) => {
    logStateHistory({
      level: errorCategory === undefined ? 'info' : 'error',
      event: 'emotional_state_history_read',
      requestId,
      outcome,
      latencyMs: Date.now() - startedAt,
      ...(errorCategory === undefined ? {} : { errorCategory }),
      ...(userId === undefined ? {} : { userId }),
      ...(organizationId === undefined ? {} : { organizationId }),
      ...(projectId === undefined ? {} : { projectId }),
      ...(profileId === undefined ? {} : { profileId }),
    });
  };

  try {
    const params = paramsSchema.safeParse(await context.params);
    if (!params.success) throw new StateHistoryError('invalid_input');
    projectId = params.data.projectId;
    profileId = params.data.profileId;

    let session;
    try {
      session = await requireAuth(request.headers);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw new StateHistoryError('unauthenticated');
      }
      throw new StateHistoryError('internal_error');
    }
    userId = session.user.id;

    let project;
    try {
      const access = await requireProjectAccess(userId, projectId, 'VIEWER');
      project = access.project;
    } catch (error) {
      if (error instanceof AuthorizationError) {
        throw new StateHistoryError('forbidden');
      }
      throw new StateHistoryError('internal_error');
    }
    organizationId = project.organizationId;

    const limit = parseLimit(request.nextUrl.searchParams.get('limit'));
    const result = await readStateHistory({
      userId,
      organizationId,
      projectId,
      profileId,
      limit,
      requestId,
    });

    finish('succeeded');
    return NextResponse.json(result.body, { status: 200 });
  } catch (error) {
    const historyError =
      error instanceof StateHistoryError
        ? error
        : new StateHistoryError('internal_error');
    finish(
      historyError.code === 'internal_error' ||
        historyError.code === 'state_data_invalid'
        ? 'failed'
        : 'rejected',
      historyError.errorCategory,
    );
    return NextResponse.json(toErrorEnvelope(historyError, requestId), {
      status: historyError.status,
    });
  }
}