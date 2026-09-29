# EMORA Development Methodology & Architecture Constitution

Gated Parallel Tracks · Minimal Vertical Slices · Evidence-Driven Activation

## 1. Purpose and Scope

This document governs how EMORA evolves. It is:

- a durable decision framework for future changes;
- an architectural guardrail for what must not silently change;
- a development methodology based on gated parallel tracks and minimal vertical slices;
- an activation framework for dormant capabilities.

It is NOT:

- a rigid feature roadmap;
- a promise of future features;
- an authorization to activate ML;
- an authorization to change mathematical behavior;
- a replacement for detailed technical specifications.

## 2. Current Architectural Philosophy

1. Preserve the deterministic computational core.
2. Keep product/API concerns separated from the core.
3. Keep authorization server-side and fail-closed.
4. Preserve transaction, idempotency, audit, and model-identity guarantees.
5. Keep scientific claims narrower than implementation capability.
6. Prefer minimal vertical slices over speculative infrastructure.
7. Require an actual consumer/use case before expanding infrastructure.
8. Use evidence before scaling architecture.
9. Treat dormant capabilities as dormant, not partially activated.
10. Preserve reversibility and clear decision records.

## 3. Load-Bearing Architectural Invariants

These invariants protect current behavior. A change that touches one is never a
routine edit; it requires the decision named in the row.

| Invariant                         | What it protects                                                                                                                 | What would violate it                                                                                    | Decision required to change it                                     |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Deterministic core isolation      | `packages/emotional-core` remains independent of React, Next.js, persistence, queues, billing, HTTP, browser APIs, and UI        | Importing web/database/ML infrastructure into the core, or making core output depend on external systems | Architectural decision                                             |
| Mathematical behavior is governed | The deterministic equations, dimensions, parameter meanings, and outputs                                                         | Changing an equation, coefficient, range, or fusion behavior silently or from product requirements alone | Mathematical Decision Register (MDR) review/decision               |
| Project-scoped authorization      | Every resource is reached through an authorized project query                                                                    | A query that omits the tenant predicate, or client-supplied identity treated as proof                    | Security decision                                                  |
| Tenant isolation                  | Organizations are the tenant boundary; projects belong to organizations                                                          | Cross-organization reads/writes or trusting a browser-supplied organization id                           | Security decision                                                  |
| Transaction atomicity             | Transitions persist event + state + audits atomically                                                                            | Partial writes on failure                                                                                | Architectural/governance decision                                  |
| Idempotency                       | Duplicate transition requests are detected, not double-applied                                                                   | Dropping `Idempotency-Key`/request-digest semantics                                                      | Governance decision                                                |
| Concurrency semantics             | Per-profile serialization and locked parameter activation where implemented                                                      | Removing row locks/unique constraints without replacement                                                | Governance decision                                                |
| Audit semantics                   | Successful reads are audited exactly once and fail closed; 401/403/400/404 create no audit rows                                  | Silent unaudited 200s, or audit metadata creep beyond the allow-list                                     | Governance decision (see `docs/decisions/read-audit-semantics.md`) |
| Model identity/versioning         | Outputs are attributable to an exact model version                                                                               | Replacing model identity with a generic string or omitting it                                            | Governance decision                                                |
| Parameter identity/versioning     | Learned/learnable parameter sets are separately identifiable and versioned                                                       | Silently swapping parameter sets or defaults                                                             | Governance decision                                                |
| Scientific disclosure             | One frozen canonical disclosure constant is reused API-wide                                                                      | Rewording, omitting, or diluting the disclosure                                                          | Separate governance decision                                       |
| Profile contract boundaries       | The six named model traits are consumed by deterministic computation; `additionalTraits` is stored metadata only, never consumed | Silently feeding ungoverned profile metadata into computation                                            | MDR/governance decision                                            |
| Evaluation provenance             | Evaluation artifacts carry identity/version/hash and respect D09/D10/D11 semantics                                               | Dropping hashes, roles, or independence declarations                                                     | Governance decision                                                |
| No silent ML/Memory/RAG influence | Emotional computation today uses only the deterministic provider                                                                 | Any runtime path where ML, memory, or RAG alters a computed state without explicit authorization         | Governance decision + MDR                                          |

## 4. Gated Parallel Tracks

Development proceeds in parallel tracks, not a sequential roadmap.

Active and maintained tracks:

- **T-Core** — deterministic emotional mathematics and domain contracts.
- **T-Product** — the authenticated product journey (API + UI).
- **T-Security** — authentication, authorization, tenancy, and audit.
- **T-Governance** — decision records, methodology, and boundaries.

Dormant unless activated:

- **T-ML** — machine learning.
- **T-Memory** — emotional memory as a computational input.
- **T-RAG** — retrieval-augmented generation.
- **T-SaaS** — commercial/operational SaaS expansion.

Dormant does NOT mean abandoned. It means: no implementation expansion
without an explicit activation case.

## 5. Track Activation Model

Every dormant track requires an activation case before implementation. An
activation case must contain, as applicable:

- the actual problem;
- the identifiable consumer/user;
- the expected output;
- the minimum viable capability;
- why existing architecture is insufficient;
- data requirements;
- security implications;
- scientific implications;
- evaluation requirements;
- rollback/reversibility considerations;
- explicit out-of-scope items.

No infrastructure-first activation.

## 6. G0 / G1 / G2 / G3 Gates

- **G0 — Scope:** Is the problem/use case real and sufficiently bounded?
- **G1 — Architecture:** Is the proposed implementation compatible with the
  existing invariants?
- **G2 — Scientific / Disclosure:** Does the change affect scientific meaning,
  evaluation validity, psychological interpretation, or disclosure?
- **G3 — Validation:** Does evidence demonstrate that the implementation works
  and did not violate existing invariants?

Not every documentation-only or presentation-only change requires every gate
at the same depth. Gates exist to make decisions explicit — they must not
become bureaucracy.

## 7. Consumer Before Infrastructure

**NO CONSUMER → NO INFRASTRUCTURE EXPANSION.**

Do not create:

- ML persistence without an ML consumer;
- a memory engine without a real memory use case;
- RAG emotional integration without an approved computational role;
- SaaS infrastructure without actual product demand;
- queues, microservices, or event buses merely for future scale.

Infrastructure may be introduced when evidence demonstrates a real
requirement.

## 8. Minimal Vertical Slice Methodology

The preferred cycle is:

Need → smallest viable slice → consumer → validation → evidence → decision

Avoid:

architecture → abstraction → infrastructure → future use

Each slice should identify:

- scope;
- explicit exclusions;
- dependencies;
- authorization impact;
- scientific impact;
- validation evidence;
- rollback/containment strategy.

## 9. Scientific Boundary

EMORA produces model-estimated computational state. It must NOT be
represented as:

- measurement of a person's emotional state;
- diagnosis;
- psychological assessment;
- direct detection of a person's feelings;
- proof of internal mental state.

The exact canonical disclosure wording is governed by the repository's
authoritative implementation: the frozen constants in
`apps/web/server/transitions/disclosure.ts`. This document does not reproduce
or replace that text.

## 10. Deterministic Core Change Policy

Any change that alters mathematical behavior, model semantics, parameter
meaning, fusion behavior, or deterministic output requires explicit
mathematical/governance review through the Mathematical Decision Register
(`docs/mathematical-decision-register.md`). Product requirements alone never
justify mathematical changes. Presentation/transport changes must remain
separate from computational changes.

## 11. ML Activation Policy

T-ML is dormant unless the repository contains an explicit activation case.
Activation requires, as applicable:

- a scientific question;
- a target;
- an approved dataset;
- dataset identity/integrity;
- train/dev/held-out separation;
- leakage controls;
- a deterministic baseline;
- a reproducibility contract;
- model/provider identity;
- evaluation methodology;
- model-selection criteria;
- fallback behavior;
- disclosure implications;
- an actual consumer.

The existing reproducible ML run contract
(`packages/emora-evaluation/src/ml-run/`) is preparatory infrastructure. It is
NOT itself authorization for ML activation. ML is not currently activated.

## 12. Memory Activation Policy

Memory remains dormant unless an explicit product/scientific need exists.
If activated:

- records must have provenance;
- the source must be identifiable;
- scope must be explicit;
- retention/lifecycle must be explicit;
- correction/deletion semantics must be explicit where applicable;
- access must be authorized;
- memory must not silently become an emotional-calculation input.

Any computational influence requires explicit governance.

## 13. RAG Activation Policy

RAG remains dormant unless justified. If activated, the following must be
considered:

- source provenance;
- version/hash where appropriate;
- permissions;
- retrieval context;
- retrieval timing;
- prompt-injection boundaries;
- reproducibility considerations.

RAG must not silently become evidence that a person "feels" something. Any
influence on emotional computation requires explicit governance.

## 14. SaaS Activation Policy

SaaS expansion must be demand-driven. Do not prematurely build:

- billing complexity;
- teams;
- invitations;
- quotas;
- enterprise administration;
- multi-service infrastructure;

unless actual product requirements justify them.

## 15. Security and Tenant Isolation

The security chain is:

user → organization → project → profile/resource

Authorization must be enforced server-side. Frontend filtering is never
authorization. Future endpoints must preserve object-level authorization.
Security validation should include negative/cross-tenant cases where
relevant. Current use of `requireProjectAccess` does not mean every possible
security risk is solved; each new surface must be evaluated individually.

## 16. Audit and Integrity

Audit semantics are architectural contracts. Do not weaken or alter:

- success/failure audit behavior;
- idempotency semantics;
- transaction boundaries;
- model identity;

without an explicit decision. The authoritative audit decision record is
`docs/decisions/read-audit-semantics.md`; this document does not duplicate its
implementation details.

## 17. History and Replay Boundary

Current history surfaces (`/transitions?limit=N`, `/states?limit=N`) are
read-oriented and provenance-oriented. History does NOT automatically mean:

- replay;
- recomputation;
- correction;
- comparison across model versions;
- reconstruction of a person's psychological trajectory.

Any future replay/recompute feature requires a separate contract and
governance decision.

## 18. Evaluation and Provenance

Preserve the separation between:

- synthetic evaluation;
- human behavioral evaluation.

Synthetic regression success must not be described as proof of human
psychological validity. Evaluation artifacts should retain sufficient
provenance (identity/version/hash, roles, and independence declarations) for
reproducibility. Avoid creating metrics, datasets, runners, or governance
infrastructure without an actual evaluation consumer.

## 19. Privacy and Data Lifecycle

Privacy is a product-readiness concern. Where profiles or other potentially
sensitive behavioral/model-configuration data are stored, future
production/pilot expansion must consider:

- purpose;
- access;
- retention;
- deletion;
- ownership;
- audit implications;
- data minimization.

This document makes no legal claims and does not claim GDPR or other
compliance. Legal/compliance conclusions require appropriate legal review.
See `docs/privacy.md` for the current privacy boundary.

## 20. Evidence Before Scaling

Explicitly discouraged until evidence demonstrates a real need:

- microservices;
- queues;
- event buses;
- distributed systems;
- caching layers;
- large observability platforms;
- pagination;
- rate limiting;
- advanced infrastructure.

This does not mean those technologies are forbidden. It means they require a
demonstrated problem or requirement. (`docs/architecture.md` states the same
position: services are extracted only when operational or scaling boundaries
justify the cost.)

## 21. Product Reality Validation

The current development objective is **PRODUCT REALITY VALIDATION**.

The repository already contains a functional product journey across:

- authentication;
- workspace/project discovery and bootstrap;
- profile onboarding;
- deterministic transition;
- latest state;
- bounded transition history;
- bounded state history;
- scientific disclosure.

The immediate objective is therefore not "build another UI from scratch". It
is to validate the existing journey through:

- end-to-end happy path;
- reload/persistence;
- re-authentication;
- error states;
- authorization negatives;
- disclosure comprehension;
- browser/E2E evidence;
- product coherence.

Only evidence from this validation determines the next Product slice.
Validation is not claimed complete unless repository evidence proves it.

## 22. Current State Snapshot

_Snapshot — update when the repository state materially changes._

- **Branch/HEAD:** `main` @ `b1a9fcf` (as inspected at document creation).
- **Product maturity:** functional authenticated journey (auth, bootstrap,
  profiles, transitions, latest state, bounded histories, disclosure); no SaaS
  operations; no ML output.
- **Deterministic core:** active; MDR-001…MDR-008 `RETAIN`, MDR-009 `DEFER`.
- **T-ML:** DORMANT — NOT ACTIVATABLE.
- **T-Memory:** DORMANT (schema foundation only; no runtime).
- **T-RAG:** DORMANT (no implementation).
- **T-SaaS:** DORMANT (foundation tables only; no product demand).
- **Current objective:** Product Reality Validation.

## 23. Decision Rules for Future Proposals

Every future feature proposal should answer:

1. What real problem does it solve?
2. Who consumes it?
3. Why is existing functionality insufficient?
4. What is the smallest viable slice?
5. Does it change deterministic computation?
6. Does it affect tenant/security boundaries?
7. Does it affect scientific meaning/disclosure?
8. Does it introduce new data?
9. Does it require new infrastructure?
10. What evidence will determine success?
11. What is explicitly out of scope?
12. How can it be rolled back or contained?

If these questions cannot be answered, the proposal remains exploratory
rather than implementation-ready.

## 24. Anti-Patterns

- infrastructure before consumer;
- roadmap-driven ML activation;
- speculative memory;
- speculative RAG;
- SaaS before product validation;
- changing mathematics to satisfy UI expectations;
- using frontend authorization;
- silent cross-layer coupling;
- treating synthetic evaluation as human validation;
- replay/recompute without a defined contract;
- adding governance artifacts without a real decision need;
- adding complexity solely because the system "might scale".

## 25. How This Document Evolves

This document is itself governed. Changes require:

- a clear reason;
- evidence or an architectural decision;
- consistency with the current repository state;
- no silent contradiction with authoritative decision records.

If a specific technical decision conflicts with this methodology, the
decision record must explain the exception. History is not rewritten to make
the repository appear more consistent than it was.

## 26. Final Principle

Build what evidence requires, protect what the architecture depends on, and
activate future capabilities only when a real need justifies them.
