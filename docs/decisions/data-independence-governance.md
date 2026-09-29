# Decision: Data & Independence Governance Freeze

- **Status:** Accepted
- **Date:** 2026-09-29
- **Applies to:** all present and future EMORA datasets, data categories, and
  train/held-out independence practices
- **Record type:** Durable repository decision record, created after the Data &
  Split Governance Scope Audit
- **Scope:** Principles only. This decision selects no dataset, authorizes no
  data use, authorizes no data collection, and does not activate T-ML.

## Context

The ML Governance Decision Freeze (`docs/ml-roadmap.md`, commit `5185ef3`) froze
the high-level ML boundaries without selecting datasets, authorizing training,
or reopening MDR-009. The follow-up Data & Split Governance Scope Audit
identified the remaining governance gap: the data-category eligibility,
dataset identity/provenance, train/held-out independence, leakage, and
reproducibility principles that can be frozen now — without selecting or
authorizing any real dataset and without activating T-ML.

This document is the durable repository record of those principles. It is
created after that audit, preserves its provenance, and does not change
`docs/ml-roadmap.md`, any equation, the deterministic provider, the disclosure,
MDR-009, Phase 6.15, or any implementation.

## Final decision

### 1. Data categories

Four data categories are recognized:

1. **Synthetic fixtures** — eligible in principle for engineering verification
   and governed synthetic evaluation; currently **NOT AUTHORIZED** for ML
   training/use.
2. **Human behavioral observations** — eligible in principle only under future
   governed conditions (a resolved Phase 6.15 protocol, governed source and
   provenance, population and construct, measurement/label method, consent or
   other authorization, permitted purpose, applicable ethics requirements,
   retention, deletion, withdrawal, exclusions, versioning, and leakage
   controls); currently **NOT AUTHORIZED**.
3. **Production/user data** — eligible in principle only under a separate
   future purpose-and-authorization decision; database storage does not
   establish training authorization; currently **NOT AUTHORIZED**.
4. **EMORA-generated outputs** — not training labels by default; any exception
   requires a separate explicit decision, provenance, and methodological
   justification; uncontrolled self-training is not authorized; currently
   **NOT AUTHORIZED**.

**Eligible in principle does not mean authorized for use.** Storage, existence,
hashing, or provenance alone must never imply training authorization.

### 2. Dataset identity and provenance

Any future dataset must carry:

- `datasetId`
- `datasetVersion`
- canonical content hash
- provenance/source declaration
- purpose/role
- authorization status

The default authorization status is `NOT_AUTHORIZED`.

**Hash integrity does not confer methodological authority.** A canonically
hashed dataset is not thereby approved, selected, or scientifically supported.

### 3. Dataset roles and independence

Future datasets must declare an explicit role fixed **before first use**:

- `TRAIN`
- `DEV`
- `HELD_OUT`
- `REFERENCE_ONLY`

A role change requires a new dataset identity/version/hash. Held-out data must
not be used for design, tuning, optimization, selection, or post-result
modification. When human data are involved, participant-level separation
between train and held-out partitions is required where applicable and must be
verifiable.

### 4. Leakage and D11

Existing D11 governance semantics remain authoritative:

- unknown overlap → `NOT_EVALUABLE`
- confirmed overlap → `EVALUATION_DATA_LEAKAGE`
- missing independence evidence → `NOT_EVALUABLE`

D11 is a governance/comparability control. It is NOT, by itself, a complete
training-pipeline leakage detector.

### 5. Reproducibility

The already-frozen prerequisites relevant to any future reproducible ML run are
restated here (not implemented):

- dataset identity/version/hash
- train/held-out identity and separation
- applicable participant separation
- training/evaluation configuration
- seed/model/configuration identity
- learned-parameter/version identity
- run/artifact provenance

### 6. Explicit non-activation boundary

This document:

- keeps T-ML **DORMANT — NOT ACTIVATABLE**;
- authorizes **no** ML training;
- selects and authorizes **no** dataset;
- authorizes **no** data collection;
- leaves **MDR-009 DEFERRED**;
- authorizes **no** hybrid activation;
- authorizes **no** human behavioral validity claim.

## Rationale

- Freezing eligibility and identity/provenance requirements now closes the data
  provenance and independence gaps without needing any real dataset.
- Freezing role, separation, and leakage principles now prevents future
  train/held-out ambiguity without implementing any split logic.
- Keeping every category and every dataset explicitly unauthorized preserves
  the ML Governance Decision Freeze and MDR-009 unchanged.

## Out of scope

Dataset selection, data collection, dataset creation, train/test splitting,
dataset registries or databases, ML implementation, MDR-009 reopening, T-ML
activation, Phase 6.15 changes, human-study methodology, statistical
thresholds, acceptance criteria, scientific claims, disclosure changes,
equation changes, and deterministic-provider changes.

## Documentation scope

This decision modifies only this file
(`docs/decisions/data-independence-governance.md`).
