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
  TransitionError,
  toErrorEnvelope,
} from '../../../../../../../../server/transitions/errors';
import { logTransition } from '../../../../../../../../server/transitions/logging';
import { runProjectScopedTransition } from '../../../../../../../../server/transitions/service';
import {
  parseIdempotencyKey,
  parseTransitionRequest,
} from '../../../../../../../../server/transitions/validation';
import {
  TransitionHistoryError,
  toErrorEnvelope as toHistoryErrorEnvelope,
} from '../../../../../../../../server/transitions/history/errors';
import { readTransitionHistory } from '../../../../../../../../server/transitions/history/service';
import { parseLimit } from '../../../../../../../../server/transitions/history/validation';

// Node.js runtime (default): PostgreSQL, node:crypto, and Better Auth sessions
// are all required. No edge runtime.
export const dynamic = 'force-dynamic';

const paramsSchema = z.strictObject({
  projectId: z.uuid(),
  profileId: z.uuid(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<Record<string, string | string[] | undefined>> },
) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();

  let organizationId: string | undefined;
  let projectId: string | undefined;
  let profileId: string | undefined;
  let eventId: string | undefined;
  let stateId: string | undefined;
  let userId: string | undefined;
  let duplicate: boolean | undefined;
  let modelId: string | undefined;
  let modelVersion: string | undefined;

  const finish = (outcome: string, errorCategory?: string) => {
    logTransition({
      level: errorCategory === undefined ? 'info' : 'error',
      event: 'emotional_transition',
      requestId,
      outcome,
      latencyMs: Date.now() - startedAt,
      ...(errorCategory === undefined ? {} : { errorCategory }),
      ...(userId === undefined ? {} : { userId }),
      ...(organizationId === undefined ? {} : { organizationId }),
      ...(projectId === undefined ? {} : { projectId }),
      ...(profileId === undefined ? {} : { profileId }),
      ...(eventId === undefined ? {} : { eventId }),
      ...(stateId === undefined ? {} : { stateId }),
      ...(modelId === undefined ? {} : { modelId }),
      ...(modelVersion === undefined ? {} : { modelVersion }),
      ...(duplicate === undefined ? {} : { duplicate }),
    });
  };

  try {
    const params = paramsSchema.safeParse(await context.params);
    if (!params.success) throw new TransitionError('invalid_input');
    projectId = params.data.projectId;
    profileId = params.data.profileId;

    // 1. Authentication.
    let session;
    try {
      session = await requireAuth(request.headers);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw new TransitionError('unauthenticated');
      }
      throw new TransitionError('internal_error');
    }
    userId = session.user.id;

    // 2. Project authorization (organization identity comes from the project row).
    let project;
    try {
      const access = await requireProjectAccess(userId, projectId, 'MEMBER');
      project = access.project;
    } catch (error) {
      if (error instanceof AuthorizationError) {
        throw new TransitionError('forbidden');
      }
      throw new TransitionError('internal_error');
    }
    organizationId = project.organizationId;

    // 3. Mandatory idempotency key.
    const idempotencyKey = parseIdempotencyKey(
      request.headers.get('idempotency-key'),
    );

    // 4. Content type.
    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().startsWith('application/json')) {
      throw new TransitionError('invalid_content_type');
    }

    // 5. Strict body validation.
    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      throw new TransitionError('invalid_input');
    }
    const acceptedRequest = parseTransitionRequest(rawBody);

    const result = await runProjectScopedTransition({
      userId,
      organizationId,
      projectId,
      profileId,
      idempotencyKey,
      request: acceptedRequest,
      requestId,
      now: new Date(),
    });

    eventId = result.eventId;
    stateId = result.stateId;
    duplicate = result.body.duplicate;
    modelId = result.body.modelIdentity.providerIdentifier;
    modelVersion = result.body.modelIdentity.version;
    finish(result.body.duplicate ? 'duplicate_replayed' : 'created');

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    const transitionError =
      error instanceof TransitionError
        ? error
        : new TransitionError('internal_error');
    finish(
      transitionError.code === 'internal_error' ? 'failed' : 'rejected',
      transitionError.errorCategory,
    );
    return NextResponse.json(toErrorEnvelope(transitionError, requestId), {
      status: transitionError.status,
    });
  }
}

/**
 * Allow-listed structured log fields only — the same discipline as the Slice 1
 * logging.ts and Slice 2 route. No event feature values, context, raw JSONB,
 * or secrets have any path into this line.
 */
interface TransitionHistoryLogFields {
  readonly level: 'info' | 'error';
  readonly event: 'transition_history_read';
  readonly requestId: string;
  readonly outcome: string;
  readonly latencyMs: number;
  readonly errorCategory?: string;
  readonly userId?: string;
  readonly organizationId?: string;
  readonly projectId?: string;
  readonly profileId?: string;
}

function logTransitionHistory(fields: TransitionHistoryLogFields): void {
  const line = JSON.stringify(
    Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined),
    ),
  );
  console.log(line);
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
    logTransitionHistory({
      level: errorCategory === undefined ? 'info' : 'error',
      event: 'transition_history_read',
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
    if (!params.success) throw new TransitionHistoryError('invalid_input');
    projectId = params.data.projectId;
    profileId = params.data.profileId;

    // 1. Authentication.
    let session;
    try {
      session = await requireAuth(request.headers);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw new TransitionHistoryError('unauthenticated');
      }
      throw new TransitionHistoryError('internal_error');
    }
    userId = session.user.id;

    // 2. Project authorization at the VIEWER read floor. Organization identity
    //    is derived server-side from the project row — never from the request.
    let project;
    try {
      const access = await requireProjectAccess(userId, projectId, 'VIEWER');
      project = access.project;
    } catch (error) {
      if (error instanceof AuthorizationError) {
        throw new TransitionHistoryError('forbidden');
      }
      throw new TransitionHistoryError('internal_error');
    }
    organizationId = project.organizationId;

    // 3. Bounded limit validation (transport).
    const limit = parseLimit(request.nextUrl.searchParams.get('limit'));

    // 4. Read the bounded transition history. The service owns the
    //    successful-read audit; failure paths create no audit rows.
    const result = await readTransitionHistory({
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
      error instanceof TransitionHistoryError
        ? error
        : new TransitionHistoryError('internal_error');
    finish(
      historyError.code === 'internal_error' ? 'failed' : 'rejected',
      historyError.errorCategory,
    );
    return NextResponse.json(toHistoryErrorEnvelope(historyError, requestId), {
      status: historyError.status,
    });
  }
}
