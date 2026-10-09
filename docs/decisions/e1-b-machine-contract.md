# EMORA E1-B Machine Contract — Governance Decision Record

- **Decision status:** `E1-B CLOSED` for the internal machine-contract foundation only.
- **Implementation status:** Implemented; validation evidence and its limitations are recorded below. Formal closure was explicitly authorized by the project owner on 2026-10-09.
- **Date prepared:** 2026-10-08
- **Historical design-review outcome:** `BLOCKED_BY_TECHNICAL_FINDINGS` before the approved package-scoped dependency resolution and version clarification.
- **Scope:** Internal reusable machine-contract package, schema, serializer, tests, and accurate documentation. Public API exposure, endpoint creation, database operations, and production changes are not authorized.

## 1. Purpose and authority

The owner authorized an internal reusable E1-B contract package and clarified that `contractVersion` is the fixed string `1.0.0` for this implementation. This fixes the value only; the contract is not frozen or production-approved and is not publicly exposed. E1-B is CLOSED by the explicit owner authorization recorded in Section 9. Public HTTP exposure is not authorized. Approval, implementation, validation, and closure remain distinct states. The package, schema, TypeScript serializer, focused tests, and internal-only documentation exist in the worktree. Targeted implementation checks are historical reported results, not freshly executed for closure; those results alone do not establish validation or closure.

## 2. Owner-approved decisions and constraints

### 2.1 Existing HTTP response and delivery compatibility

Preserve every existing flat transition-response field, name, value, and meaning. Do not remove, rename, relocate, or reinterpret existing fields. Do not add `machineContract` to the existing endpoint and do not create a new public endpoint. Strict clients may reject unknown fields; preserving the current response avoids that compatibility change. Public exposure remains deferred until separately authorized.

| Option | Compatibility and consumer effect | Evidence/documentation needed | Assessment |
|---|---|---|---|
| Add `machineContract` to the existing endpoint | Existing fields could remain intact, but strict clients may reject the added key. External-client behavior is not verified. | Would require a new explicit owner decision, compatibility evidence, and endpoint docs/schema. | **Not authorized.** |
| Create a separately versioned machine endpoint | Would avoid changing this response but create a new public surface with unresolved consumer/auth/operational requirements. | Would require a new explicit owner decision, consumer requirements, endpoint/version/auth design, and separate docs. | **Not authorized.** |
| Defer public exposure | Leaves the current HTTP response unchanged. The package is internal and reusable; external publication waits for a real consumer and a separately approved compatibility strategy. | Identify consumer and compatibility requirements, then obtain explicit authorization. External-client behavior remains unverified. | **Owner-approved current strategy.** |

The internal package implementation is authorized. This table's non-exposure decision does not authorize any endpoint or HTTP response change.

### 2.2 Request digest

Exclude `requestDigest` from the machine contract. Preserve the existing internal digest calculation, canonicalization, hashing, persistence, and idempotency behavior exactly. Excluding a contract field does not authorize any internal algorithm or semantics change.

### 2.3 Scientific disclosure

Use the exact canonical server/API disclosure identified by the accepted `docs/decisions/multilingual-presentation-boundary.md` (Decision items 8–10 and Implementation boundary). That decision identifies `SCIENTIFIC_DISCLOSURE_CODE` and `SCIENTIFIC_DISCLOSURE_TEXT` in `apps/web/server/transitions/disclosure.ts` as the canonical machine/API authority. UI strings are presentation text and must not weaken, shorten, or reinterpret the canonical claims. Preserve existing HTTP disclosure fields and behavior. Do not shorten, paraphrase, localize, or replace the canonical text in the internal machine contract without a separate explicit governance decision.

Current server-source values:

- **Code:** `COMPUTATIONAL_MODEL_ESTIMATED_STATE_NOT_HUMAN_MEASUREMENT`
- **Text:** `EMORA output is a computational, model-estimated emotional state derived from the event and context you supplied, using EMORA's deterministic model. It is not a measurement of a person's true emotional state. It is not a detection of a person's true emotional state. It is not a diagnosis. It is not a clinical assessment. It does not establish psychological validity, and it must not be used as evidence of what a person actually feels.`

The shorter UI `disclosure` string is distinct from this canonical server/API text. No replacement disclosure is authorized.

### 2.4 Contract version and schema

- The owner-approved `contractVersion` value is fixed to `1.0.0` in this internal implementation. That fixed value does not make the contract frozen, production-approved, or publicly exposed. Targeted validation evidence is recorded in this decision record; E1-B is `CLOSED` by the owner-authorized decision dated 2026-10-09 and is not thereby formally `VALIDATED`. Any remaining `VALIDATED` status must follow the applicable governance criteria and supporting evidence.
- Use JSON Schema Draft 2020-12. Ajv 8.20.0's `ajv/dist/2020` entry point and `ajv-formats` 3.0.1 are pinned in the package importer and lockfile. The focused schema-validation suite was reported passing (8/8) on October 9, 2026; it was not freshly rerun during the latest read-only audit. The audit freshly inspected the validator import/version and contract/schema/disclosure sources.
- The approved schema is language-neutral and authoritative. TypeScript types and serializers implement it; they are not the sole public definition.
- Incompatible changes require an appropriate new contract version and an explicit migration/consumer-transition policy. That policy requires approval before public release.

### 2.5 Additional properties

Use `additionalProperties: false` for explicitly defined objects inside the machine contract. Future fields require a deliberate schema/version decision. This nested-contract policy is distinct from compatibility of the surrounding HTTP response and does not authorize adding a field to that response.

### 2.6 Proposed fields and exclusions

The approved internal object contains `contractVersion`; `result` with `emotionVector`, `dimensions`, `stateId`, `eventId`, and `timestamp`; `provenance` with `modelIdentity` and `parameterIdentity`; and `disclosure` with `code` and `text`.

Public `provenance.requestDigest` is excluded from v1. Also exclude `confidence`, `confidenceAdjustment`, `explanationMetadata`, `context`, raw internal state, memories, embeddings, diagnostics, locale, UI formatting, and authentication/session data. No field is authorized merely because it appears in the partial serializer or draft API documentation.

### 2.7 Parameter identity

Expose only `DEFAULT_DETERMINISTIC_MODEL_PARAMETERS`, supported by the current transition runtime. Do not imply active selection, activation, versioning, or hashing of `parameter_versions` or `project_parameter_activation` records unless future runtime evidence establishes that behavior and it is separately authorized.

### 2.8 Numeric, identifier, and timestamp constraints

Current source evidence supports finite emotion-vector values in `[0,1]`, `valence` in `[-1,1]`, and `arousal` and `intensity` in `[0,1]`. The HTTP transition path uses UUID producers/persisted UUID columns for `eventId`, `stateId`, and `modelVersionId`, and UTC ISO 8601 timestamps with millisecond precision. Making these normative language-neutral schema constraints requires approval and verification against the eventual implementation surface. Do not change validators or producers under this proposal.

## 3. Decision status vocabulary

- **`PROPOSED`** — recorded for consideration; no approval implied.
- **`APPROVED_BY_OWNER`** — explicit owner approval recorded with provenance.
- **`IMPLEMENTED`** — approved behavior and artifacts exist in the repository.
- **`VALIDATED`** — required validation gates pass with recorded evidence.
- **`CLOSED`** — governance closure criteria are satisfied and recorded.

The internal implementation scope and fixed `1.0.0` value are `APPROVED_BY_OWNER`. Previously reported targeted implementation checks passed, but E1-B has not been formally recorded as `VALIDATED`; its version is not frozen, and E1-B is `CLOSED` by the owner decision in Section 9.

## 4. Outstanding owner decisions

The owner has approved the internal implementation constraints in this record. Remaining gates/decisions are:

1. `contractVersion` is fixed to `1.0.0` for this implementation; the contract is not frozen until schema/runtime validation and the required governance review pass.
2. Public exposure remains deferred; any endpoint or HTTP response exposure requires a new explicit owner decision and compatibility review.
3. The selected Ajv 8.20.0 package-scoped lock resolution and reported Draft 2020-12 test result are recorded; the focused suite was not rerun during the latest read-only audit.
4. Any future incompatible contract changes require an approved version migration policy before public exposure.
5. Additional runtime constraints not established by source inspection must remain unasserted or be reported as unresolved; do not change producers or validators to force conformance.

## 5. Evidence references

- `docs/decisions/multilingual-presentation-boundary.md` — canonical disclosure, presentation boundary, and locale exclusion.
- `docs/audits/engine-capability-scientific-workspace-gap-audit.md` — E1 gap, existing HTTP output, intentionally unexposed fields, and scientific boundary.
- `apps/web/server/transitions/disclosure.ts` — exact current server disclosure and parameter identity.
- `apps/web/server/transitions/service.ts` — existing flat response, persisted model lookup, default-parameter call, and internal digest use. The current transition service does not import or serialize the internal machine contract.
- `apps/web/server/transitions/canonicalize.ts` and `apps/web/server/transitions/validation.ts` — hashing/canonicalization and timestamp normalization.
- `packages/emotional-core/src/domain/emotion-vector.ts`, `emotional-dimensions.ts`, and `math/ranges.ts` — numeric domains.
- `packages/emotional-core/src/providers/deterministic-emotional-dynamics-provider.ts` — default-parameter behavior.
- `packages/database/src/schema/tables.ts` — persisted UUID and timestamp types.
- `apps/web/app/api/v1/projects/[projectId]/profiles/[profileId]/transitions/route.ts` — existing endpoint returns the service response body.

## 6. E1-B.1 test-isolation protection

Future work must preserve E1-B.1: test URL validator/tests, database test configuration/exports, integration opt-in selectors, Compose test database binding, CI wiring, Playwright test-database wiring, Turbo test environment, and related environment/database/E2E documentation.

Integration suites must remain explicitly opted in, use a validated loopback `TEST_DATABASE_URL` targeting `emora_test`, reject the known production Supabase identity, and never fall back to `DATABASE_URL`. This record authorizes no tests, migrations, database access, or edits to those safeguards.

## 7. Future implementation readiness checklist

Implementation and validation checklist:

- [x] Owner approval is recorded for the internal field set, disclosure, non-exposure, schema dialect target, additional-properties policy, digest exclusion, and parameter semantics.
- [x] The `@emora/contract` workspace package, pinned validator dependencies, and package importer are present in the workspace/lockfile.
- [x] Draft 2020-12 schema and focused Ajv 8.20.0/ajv-formats tests have been implemented; test/typecheck/lint results are recorded in the implementation report.
- [x] Existing HTTP response fields, names, values, and meanings remain unchanged; `machineContract` is absent and no endpoint is added.
- [x] Contract disclosure is tested against the canonical server source.
- [x] `requestDigest` is absent from the contract; internal hashing, canonicalization, and idempotency code were not changed.
- [x] Numeric bounds and identifier/timestamp formats are based on the inspected runtime validators and producers.
- [x] Tests cover contract keys, exclusions, and HTTP response absence. Database replay integration remains subject to the safe DB opt-in and is not run by this validation report.
- [x] E1-B.1 test-database isolation files and selectors are unchanged by contract implementation.
- [x] Deterministic computation and internal idempotency behavior are unchanged.
- [x] Documentation describes the internal-only implementation, historical reported validation evidence, and closure; freeze and production approval remain pending.
- [x] Governance validation review and explicit closure decision recorded below; closure is limited to the internal machine-contract foundation and its documented acceptance criteria.

## 8. Status-map handling and current gate

The Master Status Map records the internal-only E1-B implementation and closure, with the October 9, 2026 historical reported validation evidence; database-backed integration and replay tests were not run in the latest audit. Its E1-complete claim is not treated as validation or closure evidence for this implementation; the explicit owner authorization and closure decision are recorded below.

**Current gate:** E1-B is closed for the internal machine-contract implementation and its documented governance acceptance criteria by explicit project-owner authorization recorded on 2026-10-09. Basis: `E1_B_GOVERNANCE_CLOSURE_REVIEW_READY_FOR_DECISION`. The contract remains internal-only; no public `machineContract` field or endpoint is introduced. `requestDigest` remains excluded, and the existing internal digest, canonicalization, hashing, and idempotency behavior must remain unchanged. The canonical scientific disclosure remains unchanged. The fixed `1.0.0` value is an implementation value; closure does not freeze or production-approve the contract. Contract tests (8/8), route tests (14/14), and validation tests (18/18), plus contract typecheck/lint and web typecheck, are historical reported evidence and were not freshly rerun during the closure review. Database-backed integration and replay tests were not run in the latest audit. This closure makes no claim of scientific, psychological, or clinical validation of the emotional model.

## 9. Explicit governance closure decision

- **Decision:** `E1-B CLOSED` — internal machine-contract implementation and its documented governance acceptance criteria only.
- **Decision date:** 2026-10-09.
- **Authority:** Explicit authorization by the project owner in the current conversation.
- **Basis:** `E1_B_GOVERNANCE_CLOSURE_REVIEW_READY_FOR_DECISION`.
- **Evidence and limitations:** The closure relies on the recorded implementation inspection and historical reported results: contract tests 8/8, route tests 14/14, validation tests 18/18, contract package typecheck/lint, and web typecheck. These checks were not freshly executed during the closure review. Database-backed integration and replay tests were not run in the latest audit.
- **Boundary and scientific qualification:** The machine contract remains internal-only; no public `machineContract` field or endpoint is introduced. `requestDigest` remains excluded from the public contract, and existing internal digest, canonicalization, hashing, and idempotency behavior must remain unchanged. The canonical scientific disclosure remains unchanged. This decision does not freeze or production-approve version `1.0.0` and makes no claim of scientific, psychological, or clinical validation of the emotional model.