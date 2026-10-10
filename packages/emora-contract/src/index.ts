export const MACHINE_CONTRACT_VERSION = '1.0.0' as const;
export const MACHINE_CONTRACT_PARAMETER_IDENTITY =
  'DEFAULT_DETERMINISTIC_MODEL_PARAMETERS' as const;
export const MACHINE_CONTRACT_DISCLOSURE_CODE =
  'COMPUTATIONAL_MODEL_ESTIMATED_STATE_NOT_HUMAN_MEASUREMENT' as const;
export const MACHINE_CONTRACT_DISCLOSURE_TEXT =
  "EMORA output is a computational, model-estimated emotional state derived from the event and context you supplied, using EMORA's deterministic model. It is not a measurement of a person's true emotional state. It is not a detection of a person's true emotional state. It is not a diagnosis. It is not a clinical assessment. It does not establish psychological validity, and it must not be used as evidence of what a person actually feels." as const;

/** Ordered v1 emotion fields; the JSON Schema remains their authority. */
export const MACHINE_CONTRACT_EMOTIONS = [
  'love',
  'fear',
  'nostalgia',
  'jealousy',
  'trust',
  'anger',
  'joy',
] as const;

export type MachineContractEmotion =
  (typeof MACHINE_CONTRACT_EMOTIONS)[number];
export type MachineContractEmotionVector = Readonly<
  Record<MachineContractEmotion, number>
>;

export interface MachineContractDimensions {
  readonly valence: number;
  readonly arousal: number;
  readonly intensity: number;
}

export interface MachineContractModelIdentity {
  readonly modelVersionId: string;
  readonly name: string;
  readonly version: string;
}

export interface MachineContractDisclosure {
  readonly code: typeof MACHINE_CONTRACT_DISCLOSURE_CODE;
  readonly text: typeof MACHINE_CONTRACT_DISCLOSURE_TEXT;
}

export interface MachineContractV1Input {
  readonly result: {
    readonly emotionVector: MachineContractEmotionVector;
    readonly dimensions: MachineContractDimensions;
    readonly stateId: string;
    readonly eventId: string;
    readonly timestamp: string;
  };
  readonly provenance: {
    readonly modelIdentity: MachineContractModelIdentity;
  };
}

export interface MachineContractV1 {
  readonly contractVersion: typeof MACHINE_CONTRACT_VERSION;
  readonly result: {
    readonly emotionVector: MachineContractEmotionVector;
    readonly dimensions: MachineContractDimensions;
    readonly stateId: string;
    readonly eventId: string;
    readonly timestamp: string;
  };
  readonly provenance: {
    readonly modelIdentity: MachineContractModelIdentity;
    readonly parameterIdentity: typeof MACHINE_CONTRACT_PARAMETER_IDENTITY;
  };
  readonly disclosure: MachineContractDisclosure;
}

/**
 * Construct the allow-listed internal v1 contract without defaults or runtime
 * coercion. The language-neutral JSON Schema is authoritative for validation.
 */
export function serializeMachineContractV1(
  input: MachineContractV1Input,
): MachineContractV1 {
  const emotionVector = Object.fromEntries(
    MACHINE_CONTRACT_EMOTIONS.map((emotion) => [
      emotion,
      input.result.emotionVector[emotion],
    ]),
  ) as Record<MachineContractEmotion, number>;

  return {
    contractVersion: MACHINE_CONTRACT_VERSION,
    result: {
      emotionVector,
      dimensions: {
        valence: input.result.dimensions.valence,
        arousal: input.result.dimensions.arousal,
        intensity: input.result.dimensions.intensity,
      },
      stateId: input.result.stateId,
      eventId: input.result.eventId,
      timestamp: input.result.timestamp,
    },
    provenance: {
      modelIdentity: {
        modelVersionId: input.provenance.modelIdentity.modelVersionId,
        name: input.provenance.modelIdentity.name,
        version: input.provenance.modelIdentity.version,
      },
      parameterIdentity: MACHINE_CONTRACT_PARAMETER_IDENTITY,
    },
    disclosure: {
      code: MACHINE_CONTRACT_DISCLOSURE_CODE,
      text: MACHINE_CONTRACT_DISCLOSURE_TEXT,
    },
  };
}