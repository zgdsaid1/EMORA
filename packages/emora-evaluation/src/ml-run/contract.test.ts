import { describe, expect, it } from 'vitest';

import { hashCanonical } from '../canonicalize';
import {
  ML_RUN_DATASET_ROLES,
  MlRunContractViolationError,
  computeMlRunContractHash,
  createMlRunContract,
  verifyMlRunContractHash,
} from './contract';
import type { MlRunContractInput } from './contract';

/**
 * T-ML Slice 1 contract tests. These tests verify metadata validation and
 * fail-closed integrity only — they never train, infer, select, or authorize
 * anything, and no dataset or ML runtime is involved.
 */

function validInput(): MlRunContractInput {
  return {
    runId: 'run-1',
    datasets: [
      {
        datasetId: 'ds-1',
        datasetVersion: '1.0.0',
        datasetHash: 'dataset-content-hash-1',
        role: 'TRAIN',
      },
    ],
    splitIdentity: 'split-v1',
    trainingConfigurationHash: 'training-config-hash',
    seed: 42,
    providerIdentifier: 'future-ml-provider',
    modelName: 'future-model',
    modelVersion: '0.0.0',
    parameterVersionId: 'pv-1',
    parameterVersionHash: 'parameter-set-hash',
    repositoryCommit: 'abcdef0123456789',
    runtimeContract: 'ml-runtime-contract-v1',
    toolchainIdentity: 'node-22 pnpm-10',
  };
}

function violationOf(input: MlRunContractInput): string | undefined {
  try {
    createMlRunContract(input);
    return undefined;
  } catch (error) {
    if (error instanceof MlRunContractViolationError) {
      return error.violation;
    }
    throw error;
  }
}

describe('reproducible ML run contract (T-ML Slice 1)', () => {
  it('freezes the governance dataset role set', () => {
    expect(ML_RUN_DATASET_ROLES).toEqual([
      'TRAIN',
      'DEV',
      'HELD_OUT',
      'REFERENCE_ONLY',
    ]);
  });

  it('creates a frozen contract whose runHash equals the canonical identity hash', () => {
    const input = validInput();
    const contract = createMlRunContract(input);
    expect(contract.runHash).toBe(hashCanonical({
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
    }));
    expect(contract.runHash).toBe(computeMlRunContractHash(input));
    expect(Object.isFrozen(contract)).toBe(true);
    expect(Object.isFrozen(contract.datasets)).toBe(true);
    expect(Object.isFrozen(contract.datasets[0])).toBe(true);
    expect(verifyMlRunContractHash(contract)).toBe(true);
  });

  it('is deterministic and independent of key insertion order', () => {
    const input = validInput();
    const reordered: MlRunContractInput = {
      toolchainIdentity: input.toolchainIdentity,
      runtimeContract: input.runtimeContract,
      repositoryCommit: input.repositoryCommit,
      parameterVersionHash: input.parameterVersionHash,
      parameterVersionId: input.parameterVersionId,
      modelVersion: input.modelVersion,
      modelName: input.modelName,
      providerIdentifier: input.providerIdentifier,
      seed: input.seed,
      trainingConfigurationHash: input.trainingConfigurationHash,
      splitIdentity: input.splitIdentity,
      datasets: input.datasets,
      runId: input.runId,
    };
    expect(computeMlRunContractHash(reordered)).toBe(
      computeMlRunContractHash(input),
    );
    expect(computeMlRunContractHash(input)).toBe(computeMlRunContractHash(input));
  });

  it('changes when any identity field changes', () => {
    const input = validInput();
    const base = computeMlRunContractHash(input);
    expect(
      computeMlRunContractHash({
        ...input,
        datasets: [{ ...input.datasets[0], datasetVersion: '1.0.1' }],
      }),
    ).not.toBe(base);
    expect(computeMlRunContractHash({ ...input, seed: 43 })).not.toBe(base);
    expect(
      computeMlRunContractHash({ ...input, parameterVersionHash: 'other-hash' }),
    ).not.toBe(base);
    expect(
      computeMlRunContractHash({ ...input, repositoryCommit: 'f' }),
    ).not.toBe(base);
  });

  it('rejects each missing required identity field with its violation code', () => {
    const input = validInput();
    const cases: Array<[string, MlRunContractInput, string]> = [
      ['runId', { ...input, runId: '' }, 'RUN_ID_REQUIRED'],
      ['datasets', { ...input, datasets: [] }, 'DATASETS_REQUIRED'],
      [
        'datasetId',
        { ...input, datasets: [{ ...input.datasets[0], datasetId: '' }] },
        'DATASET_ID_REQUIRED',
      ],
      [
        'datasetVersion',
        { ...input, datasets: [{ ...input.datasets[0], datasetVersion: '' }] },
        'DATASET_VERSION_REQUIRED',
      ],
      [
        'datasetHash',
        { ...input, datasets: [{ ...input.datasets[0], datasetHash: '' }] },
        'DATASET_HASH_REQUIRED',
      ],
      [
        'trainingConfigurationHash',
        { ...input, trainingConfigurationHash: '' },
        'TRAINING_CONFIGURATION_HASH_REQUIRED',
      ],
      [
        'providerIdentifier',
        { ...input, providerIdentifier: '' },
        'PROVIDER_IDENTIFIER_REQUIRED',
      ],
      ['modelName', { ...input, modelName: '' }, 'MODEL_NAME_REQUIRED'],
      ['modelVersion', { ...input, modelVersion: '' }, 'MODEL_VERSION_REQUIRED'],
      [
        'parameterVersionId',
        { ...input, parameterVersionId: '' },
        'PARAMETER_VERSION_ID_REQUIRED',
      ],
      [
        'parameterVersionHash',
        { ...input, parameterVersionHash: '' },
        'PARAMETER_VERSION_HASH_REQUIRED',
      ],
      [
        'repositoryCommit',
        { ...input, repositoryCommit: '' },
        'REPOSITORY_COMMIT_REQUIRED',
      ],
      [
        'runtimeContract',
        { ...input, runtimeContract: '' },
        'RUNTIME_CONTRACT_REQUIRED',
      ],
      [
        'toolchainIdentity',
        { ...input, toolchainIdentity: '' },
        'TOOLCHAIN_IDENTITY_INVALID',
      ],
    ];
    for (const [label, mutated, expected] of cases) {
      expect(violationOf(mutated), label).toBe(expected);
    }
  });

  it('rejects an invalid dataset role', () => {
    const input = validInput();
    const mutated: MlRunContractInput = {
      ...input,
      datasets: [{ ...input.datasets[0], role: 'PRODUCTION' as never }],
    };
    expect(violationOf(mutated)).toBe('DATASET_ROLE_INVALID');
  });

  it('requires a split identity when any dataset role is TRAIN, DEV, or HELD_OUT', () => {
    for (const role of ['TRAIN', 'DEV', 'HELD_OUT'] as const) {
      const input: MlRunContractInput = {
        ...validInput(),
        splitIdentity: undefined,
        datasets: [{ ...validInput().datasets[0], role }],
      };
      expect(violationOf(input), role).toBe('SPLIT_IDENTITY_REQUIRED');
    }
  });

  it('does not require a split identity for REFERENCE_ONLY-only runs', () => {
    const input: MlRunContractInput = {
      ...validInput(),
      splitIdentity: undefined,
      datasets: [{ ...validInput().datasets[0], role: 'REFERENCE_ONLY' }],
    };
    const contract = createMlRunContract(input);
    expect(contract.splitIdentity).toBeUndefined();
    expect(verifyMlRunContractHash(contract)).toBe(true);
  });

  it('accepts a seed only when it is a finite number or a non-empty string', () => {
    expect(violationOf({ ...validInput(), seed: 42 })).toBeUndefined();
    expect(violationOf({ ...validInput(), seed: 'seed-1' })).toBeUndefined();
    expect(violationOf({ ...validInput(), seed: undefined })).toBeUndefined();
    expect(violationOf({ ...validInput(), seed: Number.NaN })).toBe('SEED_INVALID');
    expect(violationOf({ ...validInput(), seed: '' })).toBe('SEED_INVALID');
    expect(violationOf({ ...validInput(), seed: {} as never })).toBe('SEED_INVALID');
  });

  it('fails closed when the claimed run hash does not match the recomputed hash', () => {
    const input = validInput();
    expect(violationOf({ ...input, runHash: 'claimed-but-wrong' })).toBe(
      'RUN_HASH_MISMATCH',
    );
    expect(
      violationOf({ ...input, runHash: computeMlRunContractHash(input) }),
    ).toBeUndefined();
  });

  it('detects tampering through hash verification', () => {
    const contract = createMlRunContract(validInput());
    const tampered = {
      ...contract,
      datasets: [{ ...contract.datasets[0], datasetVersion: '2.0.0' }],
    };
    expect(verifyMlRunContractHash(contract)).toBe(true);
    expect(verifyMlRunContractHash(tampered)).toBe(false);
  });

  it('treats identity as metadata only — no existence, authorization, or validity checks', () => {
    const input: MlRunContractInput = {
      ...validInput(),
      datasets: [
        {
          datasetId: 'never-existing-dataset',
          datasetVersion: '9.9.9',
          datasetHash: 'unknown-content-hash',
          role: 'TRAIN',
        },
      ],
      providerIdentifier: 'not-a-real-provider',
      modelName: 'not-a-real-model',
      modelVersion: '0.0.0',
    };
    const contract = createMlRunContract(input);
    expect(contract.runHash).toBe(computeMlRunContractHash(input));
    const keys = Object.keys(contract).sort();
    expect(keys).not.toContain('authorizationStatus');
    expect(keys).not.toContain('authorized');
    expect(keys).not.toContain('valid');
  });

  it('exposes the violation code on the contract violation error', () => {
    const error = new MlRunContractViolationError(
      'RUN_ID_REQUIRED',
      'runId is required.',
    );
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('MlRunContractViolationError');
    expect(error.violation).toBe('RUN_ID_REQUIRED');
  });
});
