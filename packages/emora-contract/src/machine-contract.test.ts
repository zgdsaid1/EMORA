import { readFileSync } from 'node:fs';

import Ajv2020 from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';

import {
  MACHINE_CONTRACT_DISCLOSURE_CODE,
  MACHINE_CONTRACT_DISCLOSURE_TEXT,
  MACHINE_CONTRACT_EMOTIONS,
  MACHINE_CONTRACT_PARAMETER_IDENTITY,
  MACHINE_CONTRACT_VERSION,
  serializeMachineContractV1,
} from './index';
import type { MachineContractV1Input } from './index';

const disclosureSource = readFileSync(
  new URL('../../../apps/web/server/transitions/disclosure.ts', import.meta.url),
  'utf8',
);

function sourceStringConstant(name: string): string {
  const match = disclosureSource.match(
    new RegExp(`export const ${name} =\\s*(["'])([\\s\\S]*?)\\1\\s+as const;`),
  );
  if (!match) throw new Error(`Missing canonical source constant ${name}.`);
  return match[2];
}

const SCIENTIFIC_DISCLOSURE_CODE = sourceStringConstant(
  'SCIENTIFIC_DISCLOSURE_CODE',
);
const SCIENTIFIC_DISCLOSURE_TEXT = sourceStringConstant(
  'SCIENTIFIC_DISCLOSURE_TEXT',
);
const PARAMETER_IDENTITY = sourceStringConstant('PARAMETER_IDENTITY');

const schema = JSON.parse(
  readFileSync(
    new URL('../schema/machine-contract-v1.schema.json', import.meta.url),
    'utf8',
  ),
) as Record<string, unknown>;

const ajv = new Ajv2020({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);

const VALID_INPUT: MachineContractV1Input = {
  result: {
    emotionVector: {
      love: 0.1,
      fear: 0.2,
      nostalgia: 0.3,
      jealousy: 0.4,
      trust: 0.5,
      anger: 0.6,
      joy: 0.7,
    },
    dimensions: { valence: -0.25, arousal: 0.5, intensity: 0.4 },
    stateId: '66666666-6666-4666-8666-666666666666',
    eventId: '55555555-5555-4555-8555-555555555555',
    timestamp: '2026-09-22T10:00:00.000Z',
  },
  provenance: {
    modelIdentity: {
      modelVersionId: '77777777-7777-4777-8777-777777777777',
      name: 'emora-deterministic-dynamics',
      version: '1.0.0',
    },
  },
};

const serialize = (input: MachineContractV1Input = VALID_INPUT) =>
  serializeMachineContractV1(input);

describe('EMORA internal machine contract v1', () => {
  it('validates the Draft 2020-12 schema and exact required object keys', () => {
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');

    const contract = serialize();
    expect(validate(contract), JSON.stringify(validate.errors)).toBe(true);
    expect(Object.keys(contract).sort()).toEqual([
      'contractVersion',
      'disclosure',
      'provenance',
      'result',
    ]);
    expect(Object.keys(contract.result).sort()).toEqual([
      'dimensions',
      'emotionVector',
      'eventId',
      'stateId',
      'timestamp',
    ]);
    expect(Object.keys(contract.provenance).sort()).toEqual([
      'modelIdentity',
      'parameterIdentity',
    ]);
    expect(Object.keys(contract.result.emotionVector)).toEqual(
      MACHINE_CONTRACT_EMOTIONS,
    );
    expect(contract.contractVersion).toBe('1.0.0');
    expect(MACHINE_CONTRACT_VERSION).toBe('1.0.0');
  });

  it('matches the canonical disclosure constants and default parameter identity', () => {
    expect(SCIENTIFIC_DISCLOSURE_CODE).toBe(
      'COMPUTATIONAL_MODEL_ESTIMATED_STATE_NOT_HUMAN_MEASUREMENT',
    );
    expect(MACHINE_CONTRACT_DISCLOSURE_CODE).toBe(SCIENTIFIC_DISCLOSURE_CODE);
    expect(MACHINE_CONTRACT_DISCLOSURE_TEXT).toBe(SCIENTIFIC_DISCLOSURE_TEXT);
    expect(SCIENTIFIC_DISCLOSURE_TEXT).toBe(
      "EMORA output is a computational, model-estimated emotional state derived from the event and context you supplied, using EMORA's deterministic model. It is not a measurement of a person's true emotional state. It is not a detection of a person's true emotional state. It is not a diagnosis. It is not a clinical assessment. It does not establish psychological validity, and it must not be used as evidence of what a person actually feels.",
    );
    expect(MACHINE_CONTRACT_PARAMETER_IDENTITY).toBe(
      'DEFAULT_DETERMINISTIC_MODEL_PARAMETERS',
    );
    expect(MACHINE_CONTRACT_PARAMETER_IDENTITY).toBe(PARAMETER_IDENTITY);
    expect(serialize().disclosure).toEqual({
      code: SCIENTIFIC_DISCLOSURE_CODE,
      text: SCIENTIFIC_DISCLOSURE_TEXT,
    });
  });

  it('enforces the schema numeric domains and required emotion/dimension fields', () => {
    const boundaryInput: MachineContractV1Input = {
      ...VALID_INPUT,
      result: {
        ...VALID_INPUT.result,
        emotionVector: {
          love: 0,
          fear: 1,
          nostalgia: 0,
          jealousy: 1,
          trust: 0,
          anger: 1,
          joy: 0,
        },
        dimensions: { valence: -1, arousal: 0, intensity: 1 },
      },
    };
    expect(validate(serialize(boundaryInput))).toBe(true);

    const base = serialize();
    expect(
      validate({
        ...base,
        result: {
          ...base.result,
          emotionVector: { ...base.result.emotionVector, love: 1.01 },
        },
      }),
    ).toBe(false);
    expect(
      validate({
        ...base,
        result: {
          ...base.result,
          dimensions: { ...base.result.dimensions, valence: -1.01 },
        },
      }),
    ).toBe(false);
    expect(
      validate({
        ...base,
        result: {
          ...base.result,
          emotionVector: Object.fromEntries(
            Object.entries(base.result.emotionVector).filter(
              ([emotion]) => emotion !== 'joy',
            ),
          ),
        },
      }),
    ).toBe(false);
  });

  it('enforces UUID identifiers and canonical UTC timestamps with milliseconds', () => {
    expect(validate(serialize())).toBe(true);

    for (const timestamp of [
      '2026-09-22T10:00:00Z',
      '2026-09-22T10:00:00.00Z',
      '2026-09-22T12:00:00.000+02:00',
      '2026-02-30T10:00:00.000Z',
    ]) {
      const base = serialize();
      expect(
        validate({ ...base, result: { ...base.result, timestamp } }),
      ).toBe(false);
    }

    const base = serialize();
    expect(
      validate({ ...base, result: { ...base.result, eventId: 'not-a-uuid' } }),
    ).toBe(false);
    expect(
      validate({
        ...base,
        provenance: {
          ...base.provenance,
          modelIdentity: {
            ...base.provenance.modelIdentity,
            modelVersionId: 'not-a-uuid',
          },
        },
      }),
    ).toBe(false);
  });

  it('rejects unapproved additional properties and parameter claims', () => {
    const base = serialize();
    expect(validate({ ...base, requestDigest: 'a'.repeat(64) })).toBe(false);
    expect(
      validate({
        ...base,
        provenance: {
          ...base.provenance,
          parameterVersionId: '88888888-8888-4888-8888-888888888888',
        },
      }),
    ).toBe(false);
    expect(
      validate({
        ...base,
        provenance: {
          ...base.provenance,
          parameterIdentity: 'ACTIVE_PARAMETER_VERSION',
        },
      }),
    ).toBe(false);
  });

  it('serializes only approved fields and excludes unapproved input data', () => {
    const inputWithInternalFields = {
      ...VALID_INPUT,
      context: { privateNote: 'sensitive-test-context' },
      result: {
        ...VALID_INPUT.result,
        confidence: 0.9,
        metadata: { internal: true },
      },
      provenance: {
        ...VALID_INPUT.provenance,
        session: 'private-session',
        requestDigest: 'a'.repeat(64),
      },
    } as MachineContractV1Input;
    const contract = serializeMachineContractV1(inputWithInternalFields);

    expect(validate(contract)).toBe(true);
    expect(contract).not.toHaveProperty('context');
    expect(contract.result).not.toHaveProperty('context');
    expect(contract.result).not.toHaveProperty('confidence');
    expect(contract.result).not.toHaveProperty('metadata');
    expect(contract.provenance).not.toHaveProperty('requestDigest');
    expect(contract.provenance).not.toHaveProperty('session');

    const serialized = JSON.stringify(contract);
    for (const unapprovedValue of [
      'sensitive-test-context',
      'privateNote',
      'private-session',
      'confidenceAdjustment',
      'explanationMetadata',
      'memories',
      'embeddings',
      'diagnostics',
      'locale',
    ]) {
      expect(serialized).not.toContain(unapprovedValue);
    }
  });

  it('is stable for equivalent inputs and does not invent invalid values', () => {
    expect(JSON.stringify(serialize(VALID_INPUT))).toBe(
      JSON.stringify(serialize({ ...VALID_INPUT })),
    );

    const missingTimestamp = {
      ...VALID_INPUT,
      result: { ...VALID_INPUT.result, timestamp: undefined },
    } as unknown as MachineContractV1Input;
    const invalidContract = serializeMachineContractV1(missingTimestamp);
    expect(invalidContract.result.timestamp).toBeUndefined();
    expect(validate(invalidContract)).toBe(false);
  });

  it('accepts ISO timestamps emitted by the documented runtime serializers', () => {
    const runtimeTimestamp = new Date('2026-09-22T10:00:00.123Z').toISOString();
    const base = serialize();
    expect(
      validate({
        ...base,
        result: { ...base.result, timestamp: runtimeTimestamp },
      }),
    ).toBe(true);
  });
});