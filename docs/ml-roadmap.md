# ML Roadmap

Future work may evaluate feature design, training data, offline experiments, model versioning, evaluation metrics, drift monitoring, and a controlled prediction provider boundary. No machine-learning code or model artifacts are included in Phase 1.

## ML Governance Decision Freeze

**Status:** Accepted governance boundary. This decision does not activate T-ML.
T-ML remains **DORMANT — NOT ACTIVATABLE**. MDR-009 remains **DEFER**.

### Learning scope

If ML is separately authorized, learning is limited to explicitly approved
families within the existing bounded `LearnableParameterSet`. The existence of
a defined family does not approve it for training. Learned parameters remain
separately identifiable and versioned; they do not silently change deterministic
defaults or directly mutate `DeterministicEmotionalDynamicsProvider`.
Unrestricted end-to-end learning is not authorized. Emotional dimensions,
emotion-vector semantics, state representation, deterministic equations,
transition semantics, scientific interpretation, and disclosure meaning are
outside this scope. Crossing any of these boundaries requires a separate
mathematical/governance decision.

### Data use

- Synthetic fixtures may support engineering verification and governed
  synthetic evaluation. They are not human behavioral truth. Their existence
  alone does not authorize ML training use.
- No human-data collection or use is authorized by this decision. Any future
  use requires governed source and provenance, population and construct,
  measurement/label method, consent or other authorization, permitted purpose,
  applicable ethics requirements, retention, deletion, withdrawal, exclusions,
  versioning, and leakage controls.
- Production/user-generated events and states are not automatically training
  data. Database storage does not establish training authorization; a separate
  purpose and authorization decision is required.
- EMORA-generated states, confidence, and other derived outputs are not training
  labels by default. Any exception requires a separate explicit decision,
  provenance, and methodological justification; uncontrolled self-training is
  not authorized.

### Evaluation and reproducibility

Future ML evaluation requires identified and versioned datasets, hashes where
applicable, explicit train/held-out separation, and participant-level
separation where human data require it. Existing D11 overlap semantics remain:
unknown overlap is `NOT_EVALUABLE`; confirmed overlap is
`EVALUATION_DATA_LEAKAGE`. D11 is a governance/comparability control, not a
complete training-pipeline leakage detector.

Comparisons may descriptively include deterministic, ML, and hybrid outputs
where each implementation exists, under identified datasets and evaluation
conditions. They do not select a winner, establish superiority, or imply
psychological or scientific validity. No numerical acceptance threshold is
created here.

A future reproducible ML run must identify its dataset and partitions, model
configuration, learned-parameter version, training configuration, seed where
stochastic, repository commit, runtime/toolchain, evaluation procedure, and
result artifact. This list defines future prerequisites; it does not claim they
are currently implemented.

### MDR-009 and user-visible output

MDR-009 remains **DEFER**. These boundaries do not reopen it. Hybrid activation
or any material change to hybrid semantics requires a separate explicit
mathematical/governance decision after the required ML, data, and evaluation
prerequisites are demonstrated.

The current canonical disclosure is unchanged. Before any ML/hybrid output is
shown to users, a separate governance decision must ensure accurate attribution
to the computational provider/model and preserve that outputs are computational
and model-estimated, not a measurement or detection of a person's true emotional
state, diagnosis, clinical assessment, psychological validity, or evidence of
what a person actually feels.

Acceptance of this freeze does not authorize training, inference, human-data
collection, production-data training, hybrid activation, or user-visible ML
output. Future activation remains conditional on the evidence and implementation
gates above.
