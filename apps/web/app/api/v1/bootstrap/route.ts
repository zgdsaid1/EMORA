import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { AuthenticationError, requireAuth } from '@emora/auth';

import {
  BootstrapError,
  toErrorEnvelope,
} from '../../../../server/bootstrap/errors';
import { bootstrapFirstWorkspace } from '../../../../server/bootstrap/service';
import { parseBootstrapRequest } from '../../../../server/bootstrap/validation';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();

  try {
    let session;
    try {
      session = await requireAuth(request.headers);
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw new BootstrapError('unauthenticated');
      }
      throw new BootstrapError('internal_error');
    }

    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().startsWith('application/json')) {
      throw new BootstrapError('invalid_content_type');
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      throw new BootstrapError('invalid_input');
    }

    const acceptedRequest = parseBootstrapRequest(rawBody);
    const result = await bootstrapFirstWorkspace({
      userId: session.user.id,
      requestId,
      request: acceptedRequest,
    });

    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    const bootstrapError =
      error instanceof BootstrapError
        ? error
        : new BootstrapError('internal_error');
    return NextResponse.json(toErrorEnvelope(bootstrapError, requestId), {
      status: bootstrapError.status,
    });
  }
}