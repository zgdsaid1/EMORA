# EMORA Deterministic Emotional Core — Model Specification

This specification records implemented behavior in `@emora/emotional-core` and the current product transition path. It does not authorize or activate new behavior.

## Inputs and State

**IMPLEMENTED BEHAVIOR** — A transition receives a current `EmotionalState`, an `EmotionalEvent`, a `PersonalityProfile`, optional memories, and optional model parameters. An event has an id, timestamp, source, signed valence, intensity, relevance, surprise, and uncertainty. The profile has six normalized traits: emotional sensitivity, baseline trust, baseline anxiety, attachment sensitivity, nostalgia sensitivity, and jealousy sensitivity. Additional traits are validated but are not used by the transition calculation.

**IMPLEMENTED BEHAVIOR** — The emotion vector contains `love`, `fear`, `nostalgia`, `jealousy`, `trust`, `anger`, and `joy`, each independently in `[0, 1]`. Continuous dimensions are `valence` in `[-1, 1]`, and `arousal`, `intensity`, and `confidence` in `[0, 1]`. The vector is not normalized to sum to one.

**IMPLEMENTED BEHAVIOR** — The core copies the event's five numeric features; it performs no text or NLP inference. The returned state's timestamp is the event timestamp, its model version is copied from the current state, and its metadata is shallow-copied.

## Transition Calculation

**IMPLEMENTED BEHAVIOR** — With default parameters, event impact is:

$$
I = event.intensity \times event.relevance \times (0.5 + 0.5 \times event.surprise)
$$

**IMPLEMENTED BEHAVIOR** — Let $p=\max(valence,0)$ and $n=\max(-valence,0)$. Before personality modulation, emotion influences are:

| Emotion | Implemented influence before explicit `[0,1]` clamp |
| --- | --- |
| love | $I(p\cdot0.8 + relevance\cdot0.2)$ |
| fear | $I(n\cdot0.8 + uncertainty\cdot0.7)$ |
| nostalgia | $I(relevance\cdot0.7 + surprise\cdot0.3)$ |
| jealousy | $I(uncertainty\cdot0.7 + n\cdot0.4)$ |
| trust | $I(p\cdot0.7)$ |
| anger | $I(n\cdot0.7 + relevance\cdot0.3)$ |
| joy | $I(p\cdot0.9 + surprise\cdot0.1)$ |

**IMPLEMENTED BEHAVIOR** — A trait modifier is $\max(0,1+w(trait-0.5))$. Default trait weights are emotional sensitivity `0.4`, baseline trust `0.3`, and baseline anxiety, attachment sensitivity, nostalgia sensitivity, and jealousy sensitivity `0.4` each. The mapping is: love←attachment sensitivity; fear←baseline anxiety; nostalgia←nostalgia sensitivity; jealousy←jealousy sensitivity; trust←baseline trust; anger and joy←emotional sensitivity.

**IMPLEMENTED BEHAVIOR** — Interaction contribution is a single matrix pass:

$$
interaction[target]=\sum_{source} influence[source]\times interactionWeights[source][target]
$$

Default nonzero interactions are fear→trust `-0.35`, fear→anger `0.2`, anger→trust `-0.3`, joy→love `0.25`, and love→trust `0.2`; all other entries are zero. Positive fear→trust and anger→trust weights are rejected.

**IMPLEMENTED BEHAVIOR** — For each emotion, memory strength at or before the event timestamp is $S=intensity\times importance\times e^{-decayRate\times elapsedSeconds}$. A future memory has strength zero. Its influence is $(memory[e]-current[e])\times S\times memoryWeight[e]$. Default memory weights are love/fear/trust/joy `0.35`, nostalgia `0.5`, and jealousy/anger `0.3`.

**IMPLEMENTED BEHAVIOR** — The three influences are summed as `delta`. Temporal stability then computes:

$$
next[e]=clamp01(current[e]+delta[e]+rate\times(baseline[e]-current[e]))
$$

The default rate is `0.1`; default baselines in vector order are `[0.1, 0.1, 0.1, 0.1, 0.5, 0.1, 0.2]`.

## Dimensions, Confidence, and Validation

**IMPLEMENTED BEHAVIOR** — Output valence is the positive average `(love + trust + joy) / 3` minus the negative average `(fear + jealousy + anger) / 3`, plus `0.25 × event.valence`, clamped to `[-1,1]`. Arousal is `(fear + anger + joy + jealousy) / 4`; intensity is the mean of the seven vector values.

**IMPLEMENTED BEHAVIOR** — Confidence is `clamp01(base × (1 - uncertainty × uncertaintyPenalty) × memoryFactor)`. Defaults are base `0.8`, uncertainty penalty `0.7`, memory factor `0.95` when at least one memory is supplied, and `0.85` otherwise. `confidenceAdjustment` is next confidence minus current confidence. The product API does not expose confidence or explanation metadata.

**IMPLEMENTED BEHAVIOR** — Inputs must be finite and within their declared ranges: event valence and emotional-state valence `[-1,1]`; other event features, personality traits, emotion values, and emotional-state `arousal`, `intensity`, and `confidence` `[0,1]`. Parameter bounds are validated; interaction matrices must be complete, with finite values in `[-1,1]`. Factories fill omitted emotion-vector components with zero. Validation does not silently clamp input values. Base influences and final emotion values are explicitly clamped; final valence is explicitly clamped. Confidence is explicitly clamped.

**IMPLEMENTED BEHAVIOR** — Personality-modulated influence is passed to emotion-interaction validation as an emotion vector before final temporal clamping. Therefore a modulated intermediate component above `1` can throw `InvalidDomainValueError`, including for individually in-range input values. This behavior is characterized by a regression test; it is not described as desired behavior.

**IMPLEMENTED BEHAVIOR** — The transport uses a strict Zod object for the five numeric event fields, rejects unknown fields, and canonicalizes a provided timestamp to ISO format. Context is bounded separately. Domain validation remains authoritative inside the emotional core.

## Product Path, Persistence, and Versioning

**ENGINEERING CONVENTION** — The product transition path supplies `memories: []` and `modelParameters: undefined`; the provider supplies default deterministic parameters. The resulting parameter identity is `DEFAULT_DETERMINISTIC_MODEL_PARAMETERS`.

**ENGINEERING CONVENTION** — A profile with no stored state starts from a zero emotion vector and zero dimensions with a computational-initialization marker. This is not a psychological baseline. For persisted state, the service selects the latest row by timestamp, creation time, then id. Timestamp ordering and future-clock tolerance are service-level persistence rules, not psychological-time rules in the core.

**ENGINEERING CONVENTION** — The service persists the accepted event, resulting state, and audit records in one transaction. The state stores the vector, dimensions, metadata, timestamp, model-version foreign key, and event link. Idempotent replay returns the stored state without recalculation.

**ENGINEERING CONVENTION** — The provider identifier is `deterministic-emotional-dynamics`. Its provider-level `ModelVersion` has `id` `emora-deterministic-dynamics`, `name` `Deterministic Emotional Dynamics`, and `version` `1.0.0`. Separately, the database seeds a `model_versions` row with name `emora-deterministic-dynamics` and version `1.0.0`; this database identity is not the provider-level `ModelVersion` name. Parameter-version records and their candidate/validation/activation lifecycle exist separately; the current product transition service does not resolve or apply an active parameter-version record.

**ENGINEERING CONVENTION** — For the same validated inputs, including timestamps and parameters, core calculations are deterministic. The core does not read a clock, use randomness, perform I/O, or mutate inputs. Returned domain/result objects are frozen at their public boundaries.

## Interpretation and Limits

**SCIENTIFIC HYPOTHESIS** — The event-to-emotion coefficients, personality-to-influence mapping, memory contribution, and return-to-baseline term are computational operationalizations. They are not established psychological laws or claims about how people actually experience emotion.

**UNKNOWN / REQUIRES VALIDATION** — Empirical calibration, psychological validity, population generalization, and whether outputs correspond to any person's internal experience are not established by this implementation or by exact-output tests. Such tests establish reproducibility only.

**IMPLEMENTED BEHAVIOR** — Outputs are computational model estimates. They are not measurements or detections of a person's true emotional state, diagnoses, clinical assessments, or evidence of what a person actually feels.