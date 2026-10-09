# EMORA — Master Status Map

**Version:** 1.1
**Status:** AUTHORITATIVE
**Baseline:** `main @ ea79fccd09ee90753a2a315c49d367777392513f`
**Effective date:** 2026-10-05
**Purpose:** authoritative project-state and governance reference
**Scope:** repository / product / scientific / engineering / evaluation status

---

## Status history

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-10-03 | Initial authoritative project-state baseline |
| 1.1 | 2026-10-05 | Phase 3 (authentication: email verification + password reset) closed — production verified |

---

## 1. Purpose

This document is the consolidated status map for EMORA.

It distinguishes four different states that must never be confused:

1. **Implemented** — capability exists and is covered by the current architecture/code.
2. **Implemented but not product-exposed** — backend/core exists but no complete UI surface exists.
3. **Foundation only / dormant** — contracts, schema, governance or boundaries exist, but runtime activation is intentionally absent.
4. **Deferred / not established** — requires future scientific, engineering, privacy, or validation work.

The existence of a database table, Sidebar item, interface, or contract does **NOT** mean that the corresponding capability is active.

---

## 2. Current EMORA position

EMORA has crossed the following boundary:

> It is now a real production-connected scientific computational product foundation, not merely a prototype or UI shell.

Current production chain:

```
GitHub main
    ↓
Vercel Production
    ↓
Next.js application
    ↓
Better Auth / server authorization
    ↓
PostgreSQL / Supabase EMORA
    ↓
Deterministic Emotional Core
    ↓
Persisted Event + Computational State + Audit
```

The current product is intentionally much smaller than the complete future Observatory represented by the Sidebar.

---

## 3. Global status

| Area | Status | Interpretation |
|---|---|---|
| Repository architecture | COMPLETE | Stable modular monorepo |
| Deterministic emotional core | COMPLETE / GOVERNED | Active computational path |
| Mathematical governance | COMPLETE / ACTIVE | Changes require MDR |
| Scientific disclosure | COMPLETE / FROZEN | Central disclosure enforced |
| Evaluation foundation | COMPLETE / GOVERNED | Synthetic engineering evaluation established |
| D09/D10/D11 governance | CLOSED-STABLE | Leakage/independence controls established |
| Database schema | PRODUCTION | Drizzle 0000–0006 applied |
| Better Auth | PRODUCTION | Sessions/authentication operational |
| RBAC / tenant isolation | PRODUCTION FOUNDATION | Server-side authorization active |
| API v1 foundation | IMPLEMENTED | Core product contract operational |
| Audit semantics | IMPLEMENTED / GOVERNED | Important reads/writes auditable |
| Design Foundation | COMPLETE | Scientific Instrument / Observatory direction |
| Product Reality Slice 1 | PASS | Real production-connected path validated |
| Workspace UI | PARTIAL | Initial product surface exists |
| State history UI | NOT COMPLETE | API exists, UI does not |
| Scientific visualization | NOT COMPLETE | Future product slice |
| Research workspace | NOT COMPLETE | Future product slice |
| Human behavioral evaluation | DEFERRED | Not scientifically established |
| ML runtime | DORMANT | Contracts only |
| ML training | DORMANT | Not implemented |
| Memory activation | DORMANT | Schema/core structures exist, runtime consumer absent |
| RAG | DORMANT | No active retrieval pipeline |
| AI reasoning/chat | DORMANT | Sidebar architecture only |
| SaaS expansion | DORMANT | Schema foundation only |
| RLS policies | NEEDS REVIEW | RLS enabled, no application policies |
| Full privacy lifecycle | PARTIAL | Needs future product/data governance |
| Full Research Observatory | NOT COMPLETE | Roadmap target |

---

## 4. Scientific core

### 4.1 Implemented

The deterministic emotional engine currently contains:

- emotional vector:
  - love
  - fear
  - nostalgia
  - jealousy
  - trust
  - anger
  - joy
- valence
- arousal
- intensity
- confidence
- event impact
- personality modulation
- emotion interaction matrix
- memory influence mechanism
- temporal stability
- baseline return
- parameter validation
- deterministic calculation
- domain validation
- regression coverage

The core remains framework-independent. It does **NOT** depend on React, Next.js, HTTP, PostgreSQL, UI, browser APIs, queues, or billing. This isolation is an architectural invariant.

---

## 5. Scientific interpretation boundary

The current equations and coefficients are **scientific hypotheses / computational operationalizations**. They are **NOT** established psychological laws.

The implementation does not establish:

- psychological validity
- empirical calibration
- population generalization
- correspondence with a person's internal emotional experience

EMORA output remains:

> Computational, model-estimated emotional state.

It is **not** a measurement, a detection, a diagnosis, a clinical assessment, or evidence of what a person actually feels. This boundary is currently frozen across the product/API.

---

## 6. Mathematical governance

**COMPLETE / ACTIVE.**

The Mathematical Decision Register (MDR) governs changes to equations, coefficients, parameter meanings, ranges, interaction behavior, and deterministic/ML fusion behavior.

A product requirement cannot silently modify deterministic mathematics. Any such change requires the appropriate mathematical decision:

```
Product requirement
    ↓ (cannot directly change equation)
Scientific / Mathematical decision
    ↓
MDR
    ↓
Implementation
    ↓
Evaluation
```

---

## 7. Evaluation system

### 7.1 Engineering evaluation

Implemented: deterministic reproducibility, bounds, structural invariants, regression tests, reference/synthetic cases, metrics infrastructure, provenance, evaluation contracts.

Synthetic evaluation is explicitly separated from human behavioral evaluation.

### 7.2 D09 / D10 / D11

The evaluation governance has established dataset identity, provenance, independence requirements, overlap detection, leakage handling, held-out semantics, and comparability rules.

**D11 is CLOSED-STABLE**, with the rule:

- Unknown overlap → `NOT EVALUABLE`
- Declared overlap → `EVALUATION_DATA_LEAKAGE`

This is a governance control, not merely a test.

---

## 8. ML status

**Foundation exists.** The repository contains ML provider contracts, hybrid-learning foundation, fusion contract, reproducible ML run contract, dataset/evaluation governance, the future ML boundary, and `services/ml`.

**But ML is NOT ACTIVE.** There is currently no authorized ML inference runtime, training pipeline, learned parameter activation, production ML model, human-data training pipeline, or ML influence on the production deterministic state.

Current production model: **Deterministic Emotional Dynamics 1.0.0**.

ML remains **DORMANT** until explicit scientific and engineering activation gates are satisfied.

---

## 9. Memory status

Memory exists at the infrastructure/domain level: emotional memory schema, memory-related domain concepts, memory contribution mathematics, persistence structures.

But the current product transition path supplies `memories: []`.

> Memory infrastructure exists, but Memory is not an active product computational dependency.

Memory remains dormant until there is a defined consumer, retrieval semantics, provenance, evaluation, privacy/data lifecycle, and a scientific decision on its role.

---

## 10. RAG / knowledge status

The architecture reserves Knowledge Base, Documents, Sources, Retrieval, RAG Evaluation, Provenance, and embeddings/vector infrastructure.

But **RAG is not active**. There is no production retrieval path influencing the emotional computation.

---

## 11. Database status

Production Supabase contains the migrated application schema: **22 application tables**, including `organizations`, `organization_members`, `projects`, `users`, `accounts`, `sessions`, `verifications`, `emotional_profiles`, `emotional_events`, `emotional_states`, `emotional_memories`, `emotion_predictions`, `emotion_feedback`, `model_versions`, `model_parameters`, `parameter_versions`, `project_parameter_activation`, `api_keys`, `usage_records`, `subscriptions`, `billing_events`, `audit_logs`.

Drizzle migrations `0000` through `0006` — all seven applied successfully.

---

## 12. Database integrity

Implemented: foreign-key integrity, project/profile ownership constraints, cross-resource tenant consistency, model identity, parameter governance, immutability trigger, idempotency, event linkage, CHECK constraints, pgvector, Better Auth schema.

The production database started effectively empty; the expected deterministic model identity was seeded. No destructive migration was used.

---

## 13. RLS status

Current state: **22/22 tables → RLS ENABLED; 0 application policies.**

This is intentionally classified **NEEDS REVIEW**. It is not currently treated as a Product Reality blocker because the application uses server-side PostgreSQL access and authorization.

> Before introducing direct client-side Supabase access, RLS policy architecture must be explicitly reviewed.

No automatic policy generation should be performed.

---

## 14. Authentication / authorization

Implemented: Better Auth, registration, login, sessions, logout, protected application route, server-side session retrieval, organization context, project authorization, RBAC, secure production cookies.

RBAC hierarchy: `VIEWER` → `MEMBER` → `ADMIN` → `OWNER`.

Authorization is **server-side**. Browser-supplied identity or organization information is not trusted as authorization proof.

Email verification + password reset (Phase 3) — **CLOSED / PRODUCTION VERIFIED / SECURITY VERIFIED**.

- Registration requires email verification: a new sign-up returns no session until the address is confirmed (`requireEmailVerification`).
- Unverified sign-in is rejected (`EMAIL_NOT_VERIFIED`); verified sign-in opens the authenticated workspace.
- Verification and password-reset emails are delivered through Resend (`noreply@emora.dev`); Resend sending is operational.
- Production-verified: signup, verification email delivery, email verification, verified sign-in, password reset, and Resend delivery.
- Duplicate-signup anti-enumeration audit: expected Better Auth 1.7.3 behavior (generic response; no verification email is sent for an existing address). Non-blocking; optional UI-copy refinement recorded for the future.

---

## 15. API status

The `/api/v1` foundation is implemented. Current product path:

```
Projects → Profiles → Transitions → Latest State → State History → Transition History
```

Transition execution provides:

```
Validated Event → Deterministic computation → State → Event + State + Audit → Atomic transaction
```

Idempotency is supported for transitions. Replay does not double-apply the event.

---

## 16. Audit status

Implemented and governed: profile creation audit, transition audit, latest-state read audit, history read audit, fail-closed audit semantics, restricted audit metadata.

The audit system deliberately does **not** store sensitive computational payloads such as emotion vectors, raw JSON, memories, embeddings, secrets, or unnecessary context.

---

## 17. Product Reality Slice 1

**COMPLETE / VALIDATED.**

The first real product path has been validated:

```
Register → Login → Authenticated workspace → Project → Profile → Transition
→ Persist event → Persist computational state → Read latest state → Reload
→ Persisted state remains → Logout → Login again → State remains
```

Authorization negative path was also validated: a second user cannot access another project's resources merely by knowing their identifiers.

---

## 18. Design Foundation

The visual foundation is aligned with **Scientific Instrument / Observatory** rather than generic AI SaaS.

Current language: paper/ivory, graphite/ink, scientific blue, restrained semantic colors, fine rules, scientific tables, evidence, provenance, calibration, reproducibility.

Explicitly avoided: gradients, glassmorphism, excessive shadows, neon AI aesthetics, generic dashboard styling.

Validated: desktop, tablet, mobile, light/dark/system, EN, FR, AR, LTR, RTL, basic accessibility, scientific disclosure.

---

## 19. Sidebar — Product Map

The Sidebar contains **18 sections / 104 navigation items**. The Sidebar is a **PRODUCT MAP**. It must **NOT** be interpreted as 104 completed features.

---

## 20. Sidebar status

- **Observatory** — Overview: IMPLEMENTED · Command Center: PLANNED · System Status: PLANNED
- **Workspace** — Projects: IMPLEMENTED · Profiles: IMPLEMENTED · Experiments: PLANNED · Sessions: PLANNED
- **State Engine** — Current State: IMPLEMENTED · State History: API IMPLEMENTED / UI PLANNED · Transitions: API IMPLEMENTED / UI PLANNED · Dynamics: PLANNED · Model Versions: PLANNED
- **Visualization** — all items future product surfaces (Emotion State, Emotion Map, Valence/Arousal, Temporal View, Emotion Timeline, State Comparison, Visualization Lab)
- **Analytics** — future (Advanced Analytics, Trends, Statistics, Comparisons, Correlations, Pattern Analysis, Analytics Lab)
- **Machine Learning** — future / DORMANT (Models, Model Registry, Training, Datasets, Experiments, Evaluation, Model Comparison, Diagnostics)
- **Memory** — future / DORMANT (Memory, Timeline, Graph, Context, Provenance)
- **Knowledge / RAG** — future / DORMANT (Knowledge Base, Sources, Documents, Retrieval, RAG Evaluation, Provenance)
- **AI Intelligence** — future / DORMANT (AI Chat, AI Insights, Recommendations, AI Analysis, Reasoning Evidence)
- **Assessment** — future and scientifically sensitive (Psychological Assessment, Behavioral Evaluation, Assessment History, Assessment Reports). Must not imply clinical/psychological validity.
- **Collaboration** — future (Team, Shared Projects, Research Sessions, Comments, Activity, Review)
- **Data** — future / partially backed by current backend (Events, Observations, Data Sources, Imports, Exports, Data Quality, Data Explorer)
- **Research** — future (Research Hub, Experiments, Runs, Evidence, Reproducibility, Research Evaluation, Research Notes, Audit)
- **Instrumentation** — future (Live Monitor, Signals, Parameters, Schematics, Calibration, Diagnostics)
- **Visual Lab** — future / experimental (Emotion Visualizations, Dynamic Emotion Field, Emotion Particles, Emotional Landscape, State Pulse, Interactive Emotion Map, Experimental Visuals)
- **Reports** — future (Research Reports, Assessment Reports, Analytics Reports, Export Center)
- **System** — partially foundational, UI still future (Model Configuration, System Configuration, Security, Audit Log, API, Integrations)
- **Settings** — future (Account, Workspace Settings, Appearance, Language, Notifications, Accessibility)

---

## 21. What is implemented but not yet visible

This distinction is critical. The following already exist significantly below the UI:

- Transition History API
- State History API
- Audit system
- Model identity
- Parameter identity
- Event persistence
- State persistence
- Idempotency
- Project authorization
- RBAC
- Database integrity
- Scientific disclosure
- Deterministic engine
- Evaluation infrastructure

The next product work should **expose existing capability** before creating entirely new infrastructure.

---

## 22. What is dormant

The following must remain explicitly dormant: ML runtime, ML training, learned parameters, hybrid activation, memory retrieval, RAG retrieval, embeddings as computational input, AI reasoning over emotional state, AI recommendations, SaaS expansion, third-party API-key ecosystem, advanced analytics.

Dormant does not mean abandoned. It means:

> No activation without evidence, consumer/use case, governance and validation.

---

## 23. Scientific work still required

The most important unresolved scientific areas:

- **Human Behavioral Evaluation** — not implemented. Requires a real methodology for human observations, annotation, protocol, dataset independence, held-out evaluation, statistical analysis, participant/data governance.
- **Empirical Calibration** — current coefficients remain computational hypotheses.
- **Psychological Validity** — not established.
- **Population Generalization** — not established.
- **External Validation** — not implemented.

These cannot be solved by adding more unit tests.

---

## 24. Engineering work still required

1. Authenticated Workspace completion.
2. Project/profile selection UX.
3. State history UI.
4. Transition history UI.
5. Model/provenance visibility.
6. Scientific visualization.
7. Research workspace.
8. RLS architectural review.
9. Privacy lifecycle.
10. Resource administration.
11. Rate limiting when API becomes externally consumable.
12. API-key surface only when third-party access is actually required.
13. Production observability as usage grows.

---

## 25. Privacy / data-lifecycle gaps

Before real human behavioral data is introduced, define: data retention, deletion, profile lifecycle, project lifecycle, participant/data-subject model, consent boundaries where applicable, export/deletion semantics, audit retention, access controls, data minimization.

Current immutable profile behavior is an engineering constraint, not a complete privacy lifecycle.

---

## 26. Roadmap — Phase P1: Product Reality / Workspace (current)

Build:

```
Login → Workspace → Project context → Profile context → Current State
→ State History → Transition History → Model Identity → Audit / provenance
```

No ML. No RAG. No mathematical changes.

---

## 27. Phase P2 — Scientific State Observatory

After P1: state visualization, temporal visualization, valence/arousal view, state timeline, transition inspection, model/version provenance, scientific tables, reproducibility-oriented views. Visualizations must remain descriptive rather than implying psychological measurement.

---

## 28. Phase P3 — Research Workspace

Then: Research → Experiment → Run → Evidence → Evaluation → Reproducibility → Audit → Report. This is where EMORA begins to become a genuine research instrument rather than only an emotional computation service.

---

## 29. Phase P4 — Scientific Validation Expansion

Only after the product/research workflow is stable: human behavioral evaluation protocol, appropriate datasets, independent evaluation, statistical methodology, calibration studies, external validation. Requires separate scientific governance.

---

## 30. Phase P5 — ML Activation

ML should only become active after its prerequisites are satisfied. Required gates:

```
Scientific scope → Data independence → Dataset governance → Reproducible run contract
→ Evaluation protocol → ML model validation → Scientific/disclosure review → Explicit activation decision
```

Until then: **ML = DORMANT**.

---

## 31. Phase P6 — Memory / RAG

Memory and RAG should be activated independently. Neither should become computational input merely because the database supports it. Each requires a defined consumer, provenance, retrieval semantics, privacy model, evaluation, scientific interpretation boundary, and reproducibility.

---

## 32. Phase P7 — External Platform / SaaS

Only after the research product is proven: API keys, external API consumers, usage metering, subscriptions, integrations, webhooks, external model access, enterprise features. The existing billing/subscription schema is foundation only.

---

## 33. Gates

- **G0 — Scope:** What exactly are we building now?
- **G1 — Architecture:** Does this change violate existing boundaries?
- **G2 — Scientific / Disclosure:** Does this change alter scientific meaning or create a misleading claim?
- **G3 — Validation:** What evidence proves the new capability works?

No major capability should bypass these gates.

---

## 34. Change authority

**Routine changes** (may proceed within current contracts): UI refinement, copy improvements, non-semantic accessibility improvements, tests, presentation of already-existing API data, product navigation, responsive improvements.

**Changes requiring explicit architectural/security decision:** tenant model, authorization semantics, database integrity model, transaction semantics, RLS architecture, API trust boundaries.

**Changes requiring MDR:** equation changes, coefficient changes, parameter meaning changes, emotional interaction changes, deterministic/ML fusion changes, scientific interpretation of outputs.

**Changes requiring scientific validation:** claims about human emotional validity, human behavioral evaluation, calibration claims, population generalization, clinical/psychological interpretation.

---

## 35. What we should NOT do next

Do **NOT**:

- activate ML because the contracts exist;
- activate Memory because the table exists;
- activate RAG because pgvector exists;
- build all 104 Sidebar pages;
- redesign the entire navigation;
- change deterministic equations for product convenience;
- add psychological interpretations;
- introduce microservices prematurely;
- build the SaaS before the research product is validated;
- treat synthetic tests as psychological validation.

---

## 36. Immediate next target

The next target is **AUTHENTICATED RESEARCH WORKSPACE — Minimal Vertical Slice 2**.

Scope: authenticated user → workspace → project selection → profile selection → current computational state → transition history → state history → model identity / parameter identity → scientific disclosure → audit visibility where appropriate.

Acceptance must prove: real authenticated session; real production database; real project; real profile; real persisted state; real history; real authorization; no cross-project leakage; unchanged deterministic output; unchanged disclosure; unchanged audit semantics; no ML activation; no Memory activation; no RAG activation; no schema change except explicit approval.

---

## 37. Master status statement

EMORA has completed its foundational scientific, deterministic, governance, persistence, authentication, authorization, API, design, and first product-reality layers. The production path is operational. The next step is neither ML, nor RAG, nor Memory, nor SaaS. The next step is to turn existing backend capabilities into a genuine authenticated Scientific Research Workspace, then add scientific visualization and research flows. ML, Memory, RAG, and SaaS remain explicitly dormant until their activation conditions are satisfied.

---

## 38. Baseline rule

From now on, any new implementation request must first be classified into one of the following categories:

- **A.** Existing capability → expose it
- **B.** Missing product surface → build a minimal vertical slice
- **C.** Missing infrastructure → justify the consumer/use case first
- **D.** Scientific change → MDR
- **E.** Security/architecture change → architecture/security decision
- **F.** Scientific validation → G2/G3
- **G.** Dormant capability → activation review

This classification is the mandatory first step before any implementation.

---

## 39. Related governance documents

- [`docs/audits/engine-capability-scientific-workspace-gap-audit.md`](../audits/engine-capability-scientific-workspace-gap-audit.md) —
  Engine Capability & Scientific Workspace Gap Audit
  (`ENGINE_AUDIT_COMPLETE_WITH_FINDINGS`) — the ENGINE TRACK governance baseline.
- E1-B implementation: the `@emora/contract` package defines an internal-only
  Machine Consumption Contract with `contractVersion` fixed to `1.0.0` for this
  implementation. It is provided as the internal workspace package
  `packages/emora-contract` and is not imported or consumed by the application
  runtime. It is not a public API: the transition HTTP response retains
  its existing flat fields and does not expose `machineContract`. The contract
  excludes `requestDigest`; internal digest, canonicalization, and idempotency
  behavior remain separate and unchanged. The current parameter identity is
  `DEFAULT_DETERMINISTIC_MODEL_PARAMETERS`, not a `parameter_versions`
  activation id.

  Historical reported validation evidence (October 9, 2026), not freshly run for this closure:
  contract test 8/8; route tests 14/14; validation tests 18/18; contract package
  typecheck and lint; and web typecheck were reported passed. Draft 2020-12 contract
  validation uses Ajv 8.20.0; ESLint retains Ajv 6.15.0. Database-backed
  integration and replay tests were not run in the latest audit. Separately,
  isolated package-level checks (frozen-lockfile install, 8/8 package tests,
  typecheck, lint) were freshly executed on 2026-10-09 in clean copies;
  repository-wide validation (route tests, validation tests, web typecheck,
  database-backed tests, CI) was not freshly executed. E1-B CLOSED,
  effective October 9, 2026, by explicit project-owner authorization in this
  conversation. Basis: `E1_B_GOVERNANCE_CLOSURE_REVIEW_READY_FOR_DECISION`. The
  contract remains internal-only: no public machineContract field or endpoint; requestDigest is excluded; internal canonicalization, digest/hash, idempotency, and canonical scientific disclosure remain unchanged. Version 1.0.0 is not frozen or production-approved; no scientific, psychological, or clinical validation is implied.

---

*This document is a status/governance artifact, not an executable specification. It does not change application behavior, equations, database schema, Auth/RBAC, RLS, scientific disclosure, or infrastructure, and it does not activate ML, Memory, RAG, or SaaS.*
