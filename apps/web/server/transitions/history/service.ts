import { recordAuditEvent } from '@emora/auth';
import { db, emotionalEvents } from '@emora/database';
import { and, desc, eq } from 'drizzle-orm';

import {
  SCIENTIFIC_DISCLOSURE_CODE,
  SCIENTIFIC_DISCLOSURE_TEXT,
} from '../disclosure';
import { TransitionHistoryError } from './errors';

/**
 * Slice C1 — bounded Transition History read service.
 *
 * Read-only for product state: no transaction, no lock, no writes except the
 * single successful-read audit row, which is created only AFTER the persisted
 * rows have been read and mapped to the public allow-list. A 200 response
 * implies exactly one `emotional_event.history_read` audit row; every failure
 * path (unauthenticated, forbidden, invalid_input, audit failure, event
 * integrity) creates none.
 *
 * The response is constructed field-by-field so no forbidden internal column
 * (projectId, profileId, context, metadata, idempotencyKey, requestHash,
 * raw JSONB, or diagnostics) can reach the client.
 */

export interface TransitionHistoryServiceInput {
  readonly userId: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly profileId: string;
  readonly limit: number;
  readonly requestId: string;
}

/** Frozen Slice C1 public per-event contract (governance allow-list only). */
export interface TransitionHistoryItem {
  readonly eventId: string;
  readonly timestamp: string;
  readonly source: string;
  readonly valence: number;
  readonly intensity: number;
  readonly relevance: number;
  readonly surprise: number;
  readonly uncertainty: number;
}

export interface TransitionHistoryResponseBody {
  readonly requestId: string;
  readonly disclosure: typeof SCIENTIFIC_DISCLOSURE_CODE;
  readonly disclosureText: typeof SCIENTIFIC_DISCLOSURE_TEXT;
  readonly transitions: readonly TransitionHistoryItem[];
}

export interface TransitionHistoryServiceResult {
  readonly status: 200;
  readonly body: TransitionHistoryResponseBody;
}

interface TransitionHistoryRow {
  readonly id: string;
  readonly timestamp: Date;
  readonly source: string;
  readonly valence: number | null;
  readonly intensity: number | null;
  readonly relevance: number | null;
  readonly surprise: number | null;
  readonly uncertainty: number | null;
}

/** Fail closed on a persisted event missing a required model feature value. */
function requireFeature(value: number | null): number {
  if (value === null) {
    throw new TransitionHistoryError('internal_error', 'event_integrity');
  }
  return value;
}

function toHistoryItem(row: TransitionHistoryRow): TransitionHistoryItem {
  return {
    eventId: row.id,
    timestamp: row.timestamp.toISOString(),
    source: row.source,
    valence: requireFeature(row.valence),
    intensity: requireFeature(row.intensity),
    relevance: requireFeature(row.relevance),
    surprise: requireFeature(row.surprise),
    uncertainty: requireFeature(row.uncertainty),
  };
}

export async function readTransitionHistory(
  input: TransitionHistoryServiceInput,
): Promise<TransitionHistoryServiceResult> {
  // 1. Bounded, deterministically ordered read of exactly this
  //    (projectId, profileId) pair. A profile belonging to another project
  //    matches nothing here and is indistinguishable from "no transitions"
  //    (no existence oracle).
  const rows = await db
    .select({
      id: emotionalEvents.id,
      timestamp: emotionalEvents.timestamp,
      source: emotionalEvents.source,
      valence: emotionalEvents.valence,
      intensity: emotionalEvents.intensity,
      relevance: emotionalEvents.relevance,
      surprise: emotionalEvents.surprise,
      uncertainty: emotionalEvents.uncertainty,
    })
    .from(emotionalEvents)
    .where(
      and(
        eq(emotionalEvents.projectId, input.projectId),
        eq(emotionalEvents.profileId, input.profileId),
      ),
    )
    .orderBy(
      desc(emotionalEvents.timestamp),
      desc(emotionalEvents.createdAt),
      desc(emotionalEvents.id),
    )
    .limit(input.limit);

  const transitions = rows.map(toHistoryItem);

  // 2. Successful-read audit: the existing recordAuditEvent mechanism with an
  //    explicit operational-identifier allow-list (projectId, profileId,
  //    requestId, outcome). resourceId is omitted per governance. Fail-closed —
  //    if the audit row cannot be written, the read fails instead of returning
  //    unaudited.
  try {
    await recordAuditEvent({
      organizationId: input.organizationId,
      userId: input.userId,
      action: 'emotional_event.history_read',
      resourceType: 'emotional_event',
      metadata: {
        projectId: input.projectId,
        profileId: input.profileId,
        requestId: input.requestId,
        outcome: 'succeeded',
      },
    });
  } catch {
    throw new TransitionHistoryError('internal_error', 'read_audit_failed');
  }

  return {
    status: 200,
    body: {
      requestId: input.requestId,
      disclosure: SCIENTIFIC_DISCLOSURE_CODE,
      disclosureText: SCIENTIFIC_DISCLOSURE_TEXT,
      transitions,
    },
  };
}
