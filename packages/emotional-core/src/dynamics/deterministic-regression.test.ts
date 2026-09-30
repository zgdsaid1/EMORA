import { describe, expect, it } from 'vitest';

import {
  calculateMemoryInfluence,
  calculateMemoryStrength,
  calculateNextEmotionalState,
  createDefaultModelParameters,
  createEmotionVector,
  createEmotionalState,
  createEventSource,
  createPersonalityProfile,
  InvalidDomainObjectError,
  InvalidDomainValueError,
} from '../index';
import type { ModelParameters } from '../index';

const richProfile = createPersonalityProfile({
  id: 'profile-rich',
  emotionalSensitivity: 0.8,
  baselineTrust: 0.6,
  baselineAnxiety: 0.4,
  attachmentSensitivity: 0.7,
  nostalgiaSensitivity: 0.6,
  jealousySensitivity: 0.7,
});

const neutralProfile = createPersonalityProfile({
  id: 'profile-neutral',
  emotionalSensitivity: 0.5,
  baselineTrust: 0.5,
  baselineAnxiety: 0.5,
  attachmentSensitivity: 0.5,
  nostalgiaSensitivity: 0.5,
  jealousySensitivity: 0.5,
});

const currentState = createEmotionalState({
  emotionVector: createEmotionVector({ trust: 0.5, joy: 0.2 }),
  dimensions: { valence: 0, arousal: 0.2, intensity: 0.2, confidence: 0.8 },
  timestamp: '2026-01-01T00:00:00.000Z',
});

function event(
  id: string,
  timestamp: string,
  valence: number,
  intensity: number,
  relevance: number,
  surprise: number,
  uncertainty: number,
) {
  return {
    id,
    timestamp,
    source: createEventSource('test'),
    valence,
    intensity,
    relevance,
    surprise,
    uncertainty,
  } as const;
}

const positiveEvent = event(
  'event-positive',
  '2026-01-02T00:00:00.000Z',
  0.9,
  1,
  1,
  0.5,
  0.1,
);

const negativeBoundaryEvent = event(
  'event-negative-boundary',
  '2026-01-02T00:00:00.000Z',
  -1,
  1,
  1,
  1,
  1,
);

const zeroInfluence = {
  love: 0,
  fear: 0,
  nostalgia: 0,
  jealousy: 0,
  trust: 0,
  anger: 0,
  joy: 0,
};

const baselineInfluence = {
  love: 0.010000000000000002,
  fear: 0.010000000000000002,
  nostalgia: 0.010000000000000002,
  jealousy: 0.010000000000000002,
  trust: 0,
  anger: 0.010000000000000002,
  joy: 0,
};

function calculate(
  input: {
    currentState?: typeof currentState;
    event?: ReturnType<typeof event>;
    personalityProfile?: typeof richProfile;
    memories?: readonly never[];
    modelParameters?: ModelParameters;
  } = {},
) {
  return calculateNextEmotionalState({
    currentState: input.currentState ?? currentState,
    event: input.event ?? positiveEvent,
    personalityProfile: input.personalityProfile ?? richProfile,
    memories: input.memories,
    modelParameters: input.modelParameters,
  });
}

describe('deterministic emotional core exact-output regressions', () => {
  it('keeps the exact default model parameter set', () => {
    const zeroRow = {
      love: 0,
      fear: 0,
      nostalgia: 0,
      jealousy: 0,
      trust: 0,
      anger: 0,
      joy: 0,
    };

    expect(createDefaultModelParameters()).toStrictEqual({
      sets: {},
      dynamics: {
        eventImpactWeights: { surpriseBase: 0.5, surpriseScale: 0.5 },
        personalityWeights: {
          emotionalSensitivity: 0.4,
          baselineTrust: 0.3,
          baselineAnxiety: 0.4,
          attachmentSensitivity: 0.4,
          nostalgiaSensitivity: 0.4,
          jealousySensitivity: 0.4,
        },
        emotionWeights: {
          love: { positive: 0.8, negative: 0, uncertainty: 0, relevance: 0.2, surprise: 0 },
          fear: { positive: 0, negative: 0.8, uncertainty: 0.7, relevance: 0, surprise: 0 },
          nostalgia: { positive: 0, negative: 0, uncertainty: 0, relevance: 0.7, surprise: 0.3 },
          jealousy: { positive: 0, negative: 0.4, uncertainty: 0.7, relevance: 0, surprise: 0 },
          trust: { positive: 0.7, negative: 0, uncertainty: 0, relevance: 0, surprise: 0 },
          anger: { positive: 0, negative: 0.7, uncertainty: 0, relevance: 0.3, surprise: 0 },
          joy: { positive: 0.9, negative: 0, uncertainty: 0, relevance: 0, surprise: 0.1 },
        },
        interactionWeights: {
          love: { ...zeroRow, trust: 0.2 },
          fear: { ...zeroRow, trust: -0.35, anger: 0.2 },
          nostalgia: { ...zeroRow },
          jealousy: { ...zeroRow },
          trust: { ...zeroRow },
          anger: { ...zeroRow, trust: -0.3 },
          joy: { ...zeroRow, love: 0.25 },
        },
        memoryWeights: {
          love: 0.35,
          fear: 0.35,
          nostalgia: 0.5,
          jealousy: 0.3,
          trust: 0.35,
          anger: 0.3,
          joy: 0.35,
        },
        stabilityWeights: {
          rate: 0.1,
          baseline: {
            love: 0.1,
            fear: 0.1,
            nostalgia: 0.1,
            jealousy: 0.1,
            trust: 0.5,
            anger: 0.1,
            joy: 0.2,
          },
        },
        confidenceWeights: {
          base: 0.8,
          uncertaintyPenalty: 0.7,
          memoryWithData: 0.95,
          memoryWithoutData: 0.85,
        },
      },
    });
  });

  it('returns the exact representative positive transition and explanation', () => {
    expect(calculate()).toStrictEqual({
      nextState: {
        emotionVector: {
          love: 0.9358000000000002,
          fear: 0.06039999999999999,
          nostalgia: 0.6729999999999999,
          jealousy: 0.0667,
          trust: 1,
          anger: 0.27208,
          joy: 0.9224000000000001,
        },
        dimensions: {
          valence: 1,
          arousal: 0.330395,
          intensity: 0.5614828571428572,
          confidence: 0.6324000000000001,
        },
        timestamp: '2026-01-02T00:00:00.000Z',
        modelVersion: undefined,
        metadata: {},
      },
      explanationMetadata: {
        eventImpact: 0.75,
        personalityModifiers: {
          emotionalSensitivity: 1.12,
          baselineTrust: 1.03,
          baselineAnxiety: 0.96,
          attachmentSensitivity: 1.08,
          nostalgiaSensitivity: 1.04,
          jealousySensitivity: 1.08,
        },
        baseInfluence: {
          love: 0.6900000000000002,
          fear: 0.05249999999999999,
          nostalgia: 0.6375,
          jealousy: 0.05249999999999999,
          trust: 0.47250000000000003,
          anger: 0.22499999999999998,
          joy: 0.645,
        },
        interactionInfluence: {
          love: 0.1806,
          fear: 0,
          nostalgia: 0,
          jealousy: 0,
          trust: 0.055800000000000044,
          anger: 0.010079999999999999,
          joy: 0,
        },
        memoryInfluence: { ...zeroInfluence },
        stabilityInfluence: {
          love: 0.010000000000000002,
          fear: 0.010000000000000002,
          nostalgia: 0.010000000000000002,
          jealousy: 0.010000000000000002,
          trust: 0,
          anger: 0.010000000000000002,
          joy: 0,
        },
        confidenceFactors: { uncertainty: 0.1, memoryCount: 0 },
      },
      confidenceAdjustment: -0.16759999999999997,
    });
  });

  it('preserves exact positive event-boundary output and final clamping', () => {
    expect(calculate({
      event: event('positive-boundary', '2026-01-02T00:00:00.000Z', 1, 1, 1, 1, 0),
      personalityProfile: neutralProfile,
    })).toStrictEqual({
      nextState: {
        emotionVector: {
          love: 1,
          fear: 0.010000000000000002,
          nostalgia: 1,
          jealousy: 0.010000000000000002,
          trust: 1,
          anger: 0.31,
          joy: 1,
        },
        dimensions: { valence: 1, arousal: 0.3325, intensity: 0.6185714285714285, confidence: 0.68 },
        timestamp: '2026-01-02T00:00:00.000Z',
        modelVersion: undefined,
        metadata: {},
      },
      explanationMetadata: {
        eventImpact: 1,
        personalityModifiers: {
          emotionalSensitivity: 1,
          baselineTrust: 1,
          baselineAnxiety: 1,
          attachmentSensitivity: 1,
          nostalgiaSensitivity: 1,
          jealousySensitivity: 1,
        },
        baseInfluence: { love: 1, fear: 0, nostalgia: 1, jealousy: 0, trust: 0.7, anger: 0.3, joy: 1 },
        interactionInfluence: { love: 0.25, fear: 0, nostalgia: 0, jealousy: 0, trust: 0.11000000000000001, anger: 0, joy: 0 },
        memoryInfluence: { ...zeroInfluence },
        stabilityInfluence: { ...baselineInfluence },
        confidenceFactors: { uncertainty: 0, memoryCount: 0 },
      },
      confidenceAdjustment: -0.12,
    });
  });

  it('preserves exact negative event-boundary output and final clamping', () => {
    expect(calculate({
      event: negativeBoundaryEvent,
      personalityProfile: neutralProfile,
    })).toStrictEqual({
      nextState: {
        emotionVector: {
          love: 0.23500000000000001,
          fear: 1,
          nostalgia: 1,
          jealousy: 1,
          trust: 0,
          anger: 1,
          joy: 0.30000000000000004,
        },
        dimensions: { valence: -1, arousal: 0.825, intensity: 0.6478571428571429, confidence: 0.20400000000000004 },
        timestamp: '2026-01-02T00:00:00.000Z',
        modelVersion: undefined,
        metadata: {},
      },
      explanationMetadata: {
        eventImpact: 1,
        personalityModifiers: {
          emotionalSensitivity: 1,
          baselineTrust: 1,
          baselineAnxiety: 1,
          attachmentSensitivity: 1,
          nostalgiaSensitivity: 1,
          jealousySensitivity: 1,
        },
        baseInfluence: { love: 0.2, fear: 1, nostalgia: 1, jealousy: 1, trust: 0, anger: 1, joy: 0.1 },
        interactionInfluence: { love: 0.025, fear: 0, nostalgia: 0, jealousy: 0, trust: -0.6099999999999999, anger: 0.2, joy: 0 },
        memoryInfluence: { ...zeroInfluence },
        stabilityInfluence: { ...baselineInfluence },
        confidenceFactors: { uncertainty: 1, memoryCount: 0 },
      },
      confidenceAdjustment: -0.596,
    });
  });

  it('clamps a saturated upper-bound state to the exact expected output', () => {
    const saturatedState = createEmotionalState({
      emotionVector: createEmotionVector({ love: 1, fear: 1, nostalgia: 1, jealousy: 1, trust: 1, anger: 1, joy: 1 }),
      dimensions: { valence: 0, arousal: 1, intensity: 1, confidence: 0.8 },
      timestamp: '2026-01-01T00:00:00.000Z',
    });

    expect(calculate({
      currentState: saturatedState,
      event: event('saturated', '2026-01-02T00:00:00.000Z', 1, 1, 1, 1, 1),
      personalityProfile: neutralProfile,
    })).toStrictEqual({
      nextState: {
        emotionVector: { love: 1, fear: 1, nostalgia: 1, jealousy: 1, trust: 1, anger: 1, joy: 1 },
        dimensions: { valence: 0.25, arousal: 1, intensity: 1, confidence: 0.20400000000000004 },
        timestamp: '2026-01-02T00:00:00.000Z',
        modelVersion: undefined,
        metadata: {},
      },
      explanationMetadata: {
        eventImpact: 1,
        personalityModifiers: {
          emotionalSensitivity: 1,
          baselineTrust: 1,
          baselineAnxiety: 1,
          attachmentSensitivity: 1,
          nostalgiaSensitivity: 1,
          jealousySensitivity: 1,
        },
        baseInfluence: { love: 1, fear: 0.7, nostalgia: 1, jealousy: 0.7, trust: 0.7, anger: 0.3, joy: 1 },
        interactionInfluence: { love: 0.25, fear: 0, nostalgia: 0, jealousy: 0, trust: -0.13499999999999995, anger: 0.13999999999999999, joy: 0 },
        memoryInfluence: { ...zeroInfluence },
        stabilityInfluence: {
          love: -0.09000000000000001,
          fear: -0.09000000000000001,
          nostalgia: -0.09000000000000001,
          jealousy: -0.09000000000000001,
          trust: -0.05,
          anger: -0.09000000000000001,
          joy: -0.08000000000000002,
        },
        confidenceFactors: { uncertainty: 1, memoryCount: 0 },
      },
      confidenceAdjustment: -0.596,
    });
  });

  it('preserves the exact neutral fixed point', () => {
    const baselineVector = createEmotionVector({
      love: 0.1,
      fear: 0.1,
      nostalgia: 0.1,
      jealousy: 0.1,
      trust: 0.5,
      anger: 0.1,
      joy: 0.2,
    });
    const baselineState = createEmotionalState({
      emotionVector: baselineVector,
      dimensions: {
        valence: (0.1 + 0.5 + 0.2) / 3 - (0.1 + 0.1 + 0.1) / 3,
        arousal: (0.1 + 0.1 + 0.2 + 0.1) / 4,
        intensity: (0.1 + 0.1 + 0.1 + 0.1 + 0.5 + 0.1 + 0.2) / 7,
        confidence: 0.68,
      },
      timestamp: '2026-01-01T00:00:00.000Z',
    });

    expect(calculate({
      currentState: baselineState,
      event: event('neutral', '2026-01-02T00:00:00.000Z', 0, 0, 0, 0, 0),
      memories: [],
    })).toStrictEqual({
      nextState: {
        emotionVector: {
          love: 0.1,
          fear: 0.1,
          nostalgia: 0.1,
          jealousy: 0.1,
          trust: 0.5,
          anger: 0.1,
          joy: 0.2,
        },
        dimensions: { valence: 0.16666666666666663, arousal: 0.125, intensity: 0.17142857142857143, confidence: 0.68 },
        timestamp: '2026-01-02T00:00:00.000Z',
        modelVersion: undefined,
        metadata: {},
      },
      explanationMetadata: {
        eventImpact: 0,
        personalityModifiers: {
          emotionalSensitivity: 1.12,
          baselineTrust: 1.03,
          baselineAnxiety: 0.96,
          attachmentSensitivity: 1.08,
          nostalgiaSensitivity: 1.04,
          jealousySensitivity: 1.08,
        },
        baseInfluence: { ...zeroInfluence },
        interactionInfluence: { ...zeroInfluence },
        memoryInfluence: { ...zeroInfluence },
        stabilityInfluence: { love: 0, fear: 0, nostalgia: 0, jealousy: 0, trust: 0, anger: 0, joy: 0 },
        confidenceFactors: { uncertainty: 0, memoryCount: 0 },
      },
      confidenceAdjustment: 0,
    });
  });

  it('preserves the exact output of two sequential transitions', () => {
    const first = calculate();
    const secondEvent = event('event-second', '2026-01-03T00:00:00.000Z', -0.4, 0.6, 0.7, 0.2, 0.3);

    expect(calculate({ currentState: first.nextState, event: secondEvent })).toStrictEqual({
      nextState: {
        emotionVector: {
          love: 0.8917336000000002,
          fear: 0.1925776,
          nostalgia: 0.7598439999999999,
          jealousy: 0.17072920000000003,
          trust: 0.87125504,
          anger: 0.41881312,
          joy: 0.8558048000000001,
        },
        dimensions: { valence: 0.5122245066666667, arousal: 0.40948118000000006, intensity: 0.5943939085714286, confidence: 0.5372000000000001 },
        timestamp: '2026-01-03T00:00:00.000Z',
        modelVersion: undefined,
        metadata: {},
      },
      explanationMetadata: {
        eventImpact: 0.252,
        personalityModifiers: {
          emotionalSensitivity: 1.12,
          baselineTrust: 1.03,
          baselineAnxiety: 0.96,
          attachmentSensitivity: 1.08,
          nostalgiaSensitivity: 1.04,
          jealousySensitivity: 1.08,
        },
        baseInfluence: { love: 0.03528, fear: 0.13356, nostalgia: 0.13859999999999997, jealousy: 0.09324, trust: 0, anger: 0.12347999999999999, joy: 0.005040000000000001 },
        interactionInfluence: { love: 0.0014112000000000005, fear: 0, nostalgia: 0, jealousy: 0, trust: -0.07874496, anger: 0.025643520000000003, joy: 0 },
        memoryInfluence: { ...zeroInfluence },
        stabilityInfluence: {
          love: -0.08358000000000003,
          fear: 0.003960000000000002,
          nostalgia: -0.0573,
          jealousy: 0.0033300000000000014,
          trust: -0.05,
          anger: -0.017207999999999998,
          joy: -0.07224000000000001,
        },
        confidenceFactors: { uncertainty: 0.3, memoryCount: 0 },
      },
      confidenceAdjustment: -0.09519999999999995,
    });
  });

  it('preserves exact memory influence and ignores future memories', () => {
    const memoryState = createEmotionalState({
      emotionVector: createEmotionVector({ joy: 1 }),
      dimensions: { valence: 0, arousal: 0, intensity: 0, confidence: 0 },
      timestamp: '2026-01-01T00:00:00.000Z',
    });
    const memory = {
      id: 'memory-fixed',
      timestamp: '2026-01-01T00:00:00.000Z',
      emotionalState: memoryState,
      intensity: 1,
      importance: 1,
      decayRate: 0,
    } as const;
    const referenceTimestamp = '2026-01-02T00:00:00.000Z';

    expect(calculateMemoryStrength(memory, referenceTimestamp)).toStrictEqual(1);
    expect(calculateMemoryInfluence([memory], currentState.emotionVector, referenceTimestamp)).toStrictEqual({
      love: 0,
      fear: 0,
      nostalgia: 0,
      jealousy: 0,
      trust: -0.175,
      anger: 0,
      joy: 0.27999999999999997,
    });
    expect(calculateMemoryInfluence(
      [{ ...memory, timestamp: '2026-01-03T00:00:00.000Z' }],
      currentState.emotionVector,
      referenceTimestamp,
    )).toStrictEqual({ ...zeroInfluence });
  });

  it('rejects invalid event values, timestamps, and model parameters', () => {
    expect(() => calculate({
      event: { ...positiveEvent, valence: 1.0001 },
    })).toThrow(InvalidDomainValueError);
    expect(() => calculate({
      event: { ...positiveEvent, timestamp: 'not-a-date' },
    })).toThrow(InvalidDomainObjectError);

    const defaults = createDefaultModelParameters();
    const invalidParameters: ModelParameters = {
      ...defaults,
      dynamics: {
        ...defaults.dynamics,
        confidenceWeights: {
          ...defaults.dynamics.confidenceWeights,
          base: Number.NaN,
        },
      },
    };
    expect(() => calculate({ modelParameters: invalidParameters })).toThrow(
      InvalidDomainObjectError,
    );
  });

  it('fills omitted emotion-vector components with zero without renormalizing', () => {
    expect(createEmotionVector({ joy: 0.2 })).toStrictEqual({
      love: 0,
      fear: 0,
      nostalgia: 0,
      jealousy: 0,
      trust: 0,
      anger: 0,
      joy: 0.2,
    });
  });

  it('characterization: negative boundary with high nostalgia sensitivity throws before final clamping', () => {
    // This test documents current behavior. It does not assert that this behavior is scientifically or product-intended. See follow-up issue for boundary review.
    expect(() => calculate({
      event: negativeBoundaryEvent,
      personalityProfile: richProfile,
    })).toThrow(InvalidDomainValueError);
    expect(() => calculate({
      event: negativeBoundaryEvent,
      personalityProfile: richProfile,
    })).toThrow('emotion.nostalgia must be between 0 and 1 inclusive; received 1.04');
  });
});