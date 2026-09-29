import { hashCanonical } from '../canonicalize';

/**
 * T-ML Slice 1 — reproducible ML run contract foundation.
 *
 * This module is metadata/contract ONLY. It implements no training, inference,
 * optimizer, ML provider, dataset, registry, or pipeline, and it does not
 * activate T-ML.
 *
 * Governance preservation (see docs/ml-roadmap.md and
 * docs/decisions/data-independence-governance.md):
 *
 * - Reproducibility metadata is a PREREQUISITE, NOT AUTHORIZATION.
 * - A run contract does not imply that a dataset is authorized. Datasets
 *   default to NOT_AUTHORIZED under the Data & Independence Governance Freeze;
 *   declaring an identity/hash here never changes that.
 * - A model identity does not imply that a model is valid.
 * - Metadata integrity does not establish psychological validity.
 *
 * The contract fails closed: required identity information must be present,
 * and a claimed run hash must match the recomputed canonical hash. Nothing is
 * repaired, guessed, or defaulted.
 */

export const ML_RUN_CONTRACT_VERSION = '1.0.0' as const;

/**
 * Dataset roles frozen by the Data & Independence Governance Freeze. A role
 * change requires a new dataset identity/version/hash (not implemented here —
 * this contract only records the declared role).
 */
export type MlRunDatasetRole = 'TRAIN' | 'DEV' | 'HELD_OUT' | 'REFERENCE_ONLY';

export const ML_RUN_DATASET_ROLES: readonly MlRunDatasetRole[] = Object.freeze([
  'TRAIN',
  'DEV',
  'HELD_OUT',
  'REFERENCE_ONLY',
]);

export interface MlRunDatasetIdentity {
  readonly datasetId: string;
  readonly datasetVersion: string;
  /** Canonical content hash of the dataset (caller-supplied). */
  readonly datasetHash: string;
  readonly role: MlRunDatasetRole;
}

export interface MlRunContractInput {
  /** Artifact/run identity. */
  readonly runId: string;
  /** One or more datasets consumed by the run, each identified and versioned. */
  readonly datasets: readonly MlRunDatasetIdentity[];
  /**
   * Train/held-out separation identity. Required when any dataset role is
   * TRAIN, DEV, or HELD_OUT; omitted for REFERENCE_ONLY-only runs.
   */
  readonly splitIdentity?: string;
  /** Canonical hash of the frozen training configuration. */
  readonly trainingConfigurationHash: string;
  /** Present only when the training procedure actually uses randomness. */
  readonly seed?: string | number;
  /** ML model/provider identity. A valid identity is not a valid model. */
  readonly providerIdentifier: string;
  readonly modelName: string;
  readonly modelVersion: string;
  /** Learnable-parameter version identity (id + canonical set hash). */
  readonly parameterVersionId: string;
  readonly parameterVersionHash: string;
  /** Repository identity (commit that produced the run). */
  readonly repositoryCommit: string;
  /** Runtime contract identity (engine/runtime contract). */
  readonly runtimeContract: string;
  /** Optional caller-supplied toolchain identity (e.g. node/pnpm versions). */
  readonly toolchainIdentity?: string;
  /**
   * Claimed run hash. When present it must equal the recomputed canonical
   * hash; a mismatch fails closed.
   */
  readonly runHash?: string;
}

/** Frozen, validated contract: the validated input plus the canonical run hash. */
export interface MlRunContract extends MlRunContractInput {
  readonly runHash: string;
}

export type MlRunContractViolation =
  | 'RUN_ID_REQUIRED'
  | 'DATASETS_REQUIRED'
  | 'DATASET_ID_REQUIRED'
  | 'DATASET_VERSION_REQUIRED'
  | 'DATASET_HASH_REQUIRED'
  | 'DATASET_ROLE_INVALID'
  | 'SPLIT_IDENTITY_REQUIRED'
  | 'TRAINING_CONFIGURATION_HASH_REQUIRED'
  | 'SEED_INVALID'
  | 'PROVIDER_IDENTIFIER_REQUIRED'
  | 'MODEL_NAME_REQUIRED'
  | 'MODEL_VERSION_REQUIRED'
  | 'PARAMETER_VERSION_ID_REQUIRED'
  | 'PARAMETER_VERSION_HASH_REQUIRED'
  | 'REPOSITORY_COMMIT_REQUIRED'
  | 'RUNTIME_CONTRACT_REQUIRED'
  | 'TOOLCHAIN_IDENTITY_INVALID'
  | 'RUN_HASH_MISMATCH';

export class MlRunContractViolationError extends Error {
  readonly violation: MlRunContractViolation;

  constructor(violation: MlRunContractViolation, message: string) {
    super(message);
    this.name = 'MlRunContractViolationError';
    this.violation = violation;
  }
}

function fail(violation: MlRunContractViolation, message: string): never {
  throw new MlRunContractViolationError(violation, message);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isTrainingRole(role: MlRunDatasetRole): boolean {
  return role === 'TRAIN' || role === 'DEV' || role === 'HELD_OUT';
}

/**
 * Canonical identity object for the run hash. The claimed `runHash` itself is
 * excluded, mirroring the dataset identity convention.
 */
function identityObject(input: MlRunContractInput): Record<string, unknown> {
  return {
    runId: input.runId,
    datasets: input.datasets,
    splitIdentity: input.splitIdentity,
    trainingConfigurationHash: input.trainingConfigurationHash,
    seed: input.seed,
    providerIdentifier: input.providerIdentifier,
    modelName: input.modelName,
    modelVersion: input.modelVersion,
    parameterVersionId: input.parameterVersionId,
    parameterVersionHash: input.parameterVersionHash,
    repositoryCommit: input.repositoryCommit,
    runtimeContract: input.runtimeContract,
    toolchainIdentity: input.toolchainIdentity,
  };
}

export function computeMlRunContractHash(input: MlRunContractInput): string {
  return hashCanonical(identityObject(input));
}

function validateInput(input: MlRunContractInput): void {
  if (!isNonEmptyString(input.runId)) {
    fail('RUN_ID_REQUIRED', 'A run contract requires a non-empty runId.');
  }
  if (!Array.isArray(input.datasets) || input.datasets.length === 0) {
    fail(
      'DATASETS_REQUIRED',
      'A run contract requires at least one dataset identity.',
    );
  }
  let trainingRolePresent = false;
  for (const dataset of input.datasets) {
    if (!isNonEmptyString(dataset.datasetId)) {
      fail(
        'DATASET_ID_REQUIRED',
        `Dataset ${dataset.datasetId ?? ''} requires a non-empty datasetId.`,
      );
    }
    if (!isNonEmptyString(dataset.datasetVersion)) {
      fail(
        'DATASET_VERSION_REQUIRED',
        `Dataset ${dataset.datasetId} requires a non-empty datasetVersion.`,
      );
    }
    if (!isNonEmptyString(dataset.datasetHash)) {
      fail(
        'DATASET_HASH_REQUIRED',
        `Dataset ${dataset.datasetId} requires a non-empty datasetHash.`,
      );
    }
    if (!ML_RUN_DATASET_ROLES.includes(dataset.role)) {
      fail(
        'DATASET_ROLE_INVALID',
        `Dataset ${dataset.datasetId} has an invalid role '${String(dataset.role)}'.`,
      );
    }
    if (isTrainingRole(dataset.role)) {
      trainingRolePresent = true;
    }
  }
  if (trainingRolePresent && !isNonEmptyString(input.splitIdentity)) {
    fail(
      'SPLIT_IDENTITY_REQUIRED',
      'A run with TRAIN, DEV, or HELD_OUT datasets requires a non-empty splitIdentity.',
    );
  }
  if (!isNonEmptyString(input.trainingConfigurationHash)) {
    fail(
      'TRAINING_CONFIGURATION_HASH_REQUIRED',
      'A run contract requires a non-empty trainingConfigurationHash.',
    );
  }
  if (input.seed !== undefined) {
    const validSeed =
      (typeof input.seed === 'number' && Number.isFinite(input.seed)) ||
      isNonEmptyString(input.seed);
    if (!validSeed) {
      fail(
        'SEED_INVALID',
        'The seed, when present, must be a finite number or a non-empty string.',
      );
    }
  }
  if (!isNonEmptyString(input.providerIdentifier)) {
    fail(
      'PROVIDER_IDENTIFIER_REQUIRED',
      'A run contract requires a non-empty providerIdentifier.',
    );
  }
  if (!isNonEmptyString(input.modelName)) {
    fail(
      'MODEL_NAME_REQUIRED',
      'A run contract requires a non-empty modelName.',
    );
  }
  if (!isNonEmptyString(input.modelVersion)) {
    fail(
      'MODEL_VERSION_REQUIRED',
      'A run contract requires a non-empty modelVersion.',
    );
  }
  if (!isNonEmptyString(input.parameterVersionId)) {
    fail(
      'PARAMETER_VERSION_ID_REQUIRED',
      'A run contract requires a non-empty parameterVersionId.',
    );
  }
  if (!isNonEmptyString(input.parameterVersionHash)) {
    fail(
      'PARAMETER_VERSION_HASH_REQUIRED',
      'A run contract requires a non-empty parameterVersionHash.',
    );
  }
  if (!isNonEmptyString(input.repositoryCommit)) {
    fail(
      'REPOSITORY_COMMIT_REQUIRED',
      'A run contract requires a non-empty repositoryCommit.',
    );
  }
  if (!isNonEmptyString(input.runtimeContract)) {
    fail(
      'RUNTIME_CONTRACT_REQUIRED',
      'A run contract requires a non-empty runtimeContract.',
    );
  }
  if (
    input.toolchainIdentity !== undefined &&
    !isNonEmptyString(input.toolchainIdentity)
  ) {
    fail(
      'TOOLCHAIN_IDENTITY_INVALID',
      'The toolchainIdentity, when present, must be a non-empty string.',
    );
  }
}

/**
 * Validates the input, fails closed on missing or inconsistent identity
 * information, and returns a frozen contract carrying the canonical run hash.
 */
export function createMlRunContract(input: MlRunContractInput): MlRunContract {
  validateInput(input);
  const runHash = computeMlRunContractHash(input);
  if (input.runHash !== undefined && input.runHash !== runHash) {
    fail(
      'RUN_HASH_MISMATCH',
      `The claimed runHash '${input.runHash}' does not match the recomputed hash '${runHash}'.`,
    );
  }
  return Object.freeze({
    ...input,
    datasets: Object.freeze(
      input.datasets.map((dataset) => Object.freeze({ ...dataset })),
    ),
    runHash,
  });
}

export function verifyMlRunContractHash(contract: MlRunContract): boolean {
  return computeMlRunContractHash(contract) === contract.runHash;
}

