import { recordAuditEvent } from '@emora/auth';
import { db, emotionalStates, modelVersions } from '@emora/database';
import {
  DeterministicEmotionalDynamicsProvider,
  emotionNames,
} from '@emora/emotional-core';
import type { EmotionalState } from '@emora/emotional-core';
import { and, desc, eq } from 'drizzle-orm';

import {
  INITIALIZATION_MARKER,
  PARAMETER_IDENTITY,
  SCIENTIFIC_DISCLOSURE_CODE,
  SCIENTIFIC_DISCLOSURE_TEXT,
} from '../../transitions/disclosure';
import {
  toDomainModelVersion,
  toDomainState,
} from '../../transitions/domain-mapping';
import { StateHistoryError } from './errors';

const provider = new DeterministicEmotionalDynamicsProvider();

export interface StateHistoryServiceInput {
  readonly userId: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly profileId: string;
  readonly limit: number;
  readonly requestId: string;
}

export interface StateHistoryItem {
  readonly stateId: string;
  readonly timestamp: string;
  readonly emotionVector: Record<string, number>;
  readonly dimensions: {
    readonly valence: number;
    readonly arousal: number;
    readonly intensity: number;
  };
  readonly modelIdentity: {
    readonly modelVersionId: string;
    readonly name: string;
    readonly version: string;
    readonly providerIdentifier: string;
    readonly providerVersion: string;
  };
  readonly parameterIdentity: string;
  readonly initialized: boolean;
}

export interface StateHistoryResponseBody {
  readonly requestId: string;
  readonly disclosure: typeof SCIENTIFIC_DISCLOSURE_CODE;
  readonly disclosureText: typeof SCIENTIFIC_DISCLOSURE_TEXT;
  readonly states: readonly StateHistoryItem[];
}

export interface StateHistoryServiceResult {
  readonly status: 200;
  readonly body: StateHistoryResponseBody;
}

function toHistoryItem(row: {
  readonly id: string;
  readonly timestamp: Date;
  readonly state: unknown;
  readonly modelVersionId: string;
  readonly modelId: string | null;
  readonly modelName: string | null;
  readonly modelVersion: string | null;
}): StateHistoryItem {
  if (
    row.modelId === null ||
    row.modelName === null ||
    row.modelVersion === null
  ) {
    throw new StateHistoryError('state_data_invalid', 'model_version_integrity');
  }

  let state: EmotionalState;
  try {
    const modelVersion = toDomainModelVersion({
      id: row.modelId,
      name: row.modelName,
      version: row.modelVersion,
    });
    state = toDomainState(
      {
        state: row.state,
        timestamp: row.timestamp,
        modelVersionId: row.modelVersionId,
      },
      modelVersion,
    );
  } catch {
    throw new StateHistoryError('state_data_invalid', 'state_integrity');
  }

  const emotionVector: Record<string, number> = {};
  for (const emotion of emotionNames) {
    emotionVector[emotion] = state.emotionVector[emotion];
  }

  return {
    stateId: row.id,
    timestamp: state.timestamp,
    emotionVector,
    dimensions: {
      valence: state.dimensions.valence,
      arousal: state.dimensions.arousal,
      intensity: state.dimensions.intensity,
    },
    modelIdentity: {
      modelVersionId: row.modelVersionId,
      name: row.modelName,
      version: row.modelVersion,
      providerIdentifier: provider.identifier,
      providerVersion: provider.modelVersion?.version ?? 'unknown',
    },
    parameterIdentity: PARAMETER_IDENTITY,
    initialized:
      state.metadata?.initialization === INITIALIZATION_MARKER,
  };
}

export async function readStateHistory(
  input: StateHistoryServiceInput,
): Promise<StateHistoryServiceResult> {
  const rows = await db
    .select({
      id: emotionalStates.id,
      timestamp: emotionalStates.timestamp,
      state: emotionalStates.state,
      modelVersionId: emotionalStates.modelVersionId,
      modelId: modelVersions.id,
      modelName: modelVersions.name,
      modelVersion: modelVersions.version,
    })
    .from(emotionalStates)
    .leftJoin(
      modelVersions,
      eq(emotionalStates.modelVersionId, modelVersions.id),
    )
    .where(
      and(
        eq(emotionalStates.projectId, input.projectId),
        eq(emotionalStates.profileId, input.profileId),
      ),
    )
    .orderBy(
      desc(emotionalStates.timestamp),
      desc(emotionalStates.createdAt),
      desc(emotionalStates.id),
    )
    .limit(input.limit);

  const states = rows.map(toHistoryItem);

  try {
    await recordAuditEvent({
      organizationId: input.organizationId,
      userId: input.userId,
      action: 'emotional_state.history_read',
      resourceType: 'emotional_state',
      metadata: {
        projectId: input.projectId,
        profileId: input.profileId,
        requestId: input.requestId,
        outcome: 'succeeded',
      },
    });
  } catch {
    throw new StateHistoryError('internal_error', 'read_audit_failed');
  }

  return {
    status: 200,
    body: {
      requestId: input.requestId,
      disclosure: SCIENTIFIC_DISCLOSURE_CODE,
      disclosureText: SCIENTIFIC_DISCLOSURE_TEXT,
      states,
    },
  };
}