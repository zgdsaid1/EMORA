# Decision: Read-Audit Semantics (Slice 2 Latest-State Read)

- **Status:** Accepted
- **Date:** 2026-09-25
- **Applies to:** `GET /api/v1/projects/[projectId]/profiles/[profileId]/states/latest`
  and its service layer (`apps/web/server/states/`)
- **Record type:** Durable repository decision record, created after the Slice 2
  governance audit

## Context

Slice 2 introduced the authenticated, project-scoped latest-state read endpoint
and durable audit behavior for successful reads through the existing
`recordAuditEvent` mechanism (action `emotional_state.read`).

A post-commit governance audit of Slice 2 (commit `d59b1e2`) found that the final
read-audit semantics and their provenance were established only in
pre-implementation planning and gate session records, not inside the
repository. This document is the durable repository record created **after**
that governance audit, to preserve the final decision and its provenance. No
repository decision record contained these rules before Slice 2, and no
historical claim below is attributed to a file or commit that did not contain
it.

## Final decision

### Unsuccessful or unauthorized reads (HTTP 401, 403, 404)

- No durable `audit_logs` row is written.
- Structured operational/error logging may still occur, per the existing
  implementation.
- HTTP 404 (`state_not_found`) remains indistinguishable from "no state
  exists". The behavior must not create an existence oracle — including for a
  `(projectId, profileId)` pair that crosses a project boundary.

### Successful read (HTTP 200)

- Exactly ONE `emotional_state.read` audit row is written per successful read.
- The audit metadata allow-list is unchanged: operational identifiers only
  (`projectId`, `profileId`, `stateId`, `requestId`, `outcome`). No emotion
  values, dimensions, confidence, raw JSONB, context, memories, embeddings,
  payloads, or secrets.

### Audit-write failure — fail-closed

If the required audit row for an otherwise successful read cannot be written:

- the read MUST fail;
- the HTTP response MUST be 500 (`internal_error`) inside the existing safe,
  frozen error envelope;
- the system MUST NOT silently return HTTP 200 for an unaudited successful
  read.

This is the current fail-closed behavior. The committed Slice 2 implementation
(`read_audit_failed` in `apps/web/server/states/service.ts`) and its unit and
integration tests already establish it. This record documents that behavior; it
does not change it.

## Supersession and provenance

Earlier pre-implementation planning artifacts contained different audit options:

1. An earlier planning proposal (the Slice 2 scope-gate report, held in session
   records only) considered auditing denied reads — one audit row with
   `outcome: 'forbidden'` for denied (403) access.
2. A later clarification artifact (the pre-implementation clarification-gate
   answer, held in session records only) considered fail-open behavior — the
   read would still return 200 if audit/log emission failed.
3. The final approved Slice 2 implementation uses:
   - no durable audit rows for 401/403/404;
   - exactly one audit row for a successful 200 read;
   - fail-closed behavior (HTTP 500, safe envelope) if that successful-read
     audit write fails.

Alternatives (1) and (2) are superseded by (3). Neither (1) nor (2) was ever
recorded in a repository file; both existed only in pre-implementation
planning/gate session records.

## Rationale

- The final implementation deliberately requires successful reads to be
  auditable, so a 200 response must not be returned when its required audit
  write fails.
- This is consistent with the existing Slice 1 write-path principle that
  required audit failures are not silently swallowed (an in-transaction audit
  failure rolls the write back).
- Zero audit rows on 401/403/404 matches the pre-existing, tested Slice 1
  convention that failed pre-data access writes no audit rows, and avoids
  audit writes reachable by unauthenticated callers.
- The fail-closed choice is an explicit availability/auditability trade-off: a
  transient audit-write failure turns an otherwise valid read into HTTP 500
  rather than allowing an unaudited read.
- This choice makes no claim about psychological validity and does not alter the
  emotional mathematics or scientific methodology.

## Scope and non-scope

This decision applies only to the Slice 2 latest-state read/audit behavior
described above.

It does NOT define:

- future history or pagination endpoints;
- rate limiting;
- audit policies for future endpoints;
- human behavioral evaluation;
- ML/hybrid behavior;
- emotional-model equations;
- scientific validity;
- product ranking or thresholds.

Any future change requires a new explicit decision.

---

# Decision: Bounded Historical-Read Governance (Future Read Surfaces)

- **Status:** Accepted — governing policy for bounded historical reads.
  Accepting this policy does NOT mean either endpoint is implemented; neither
  endpoint exists until a future implementation slice creates it.
- **Date:** 2026-09-28
- **Applies to (future endpoints only):**
  - Bounded Transition History:
    `GET /api/v1/projects/{projectId}/profiles/{profileId}/transitions?limit=N`
  - Bounded State Timeline:
    `GET /api/v1/projects/{projectId}/profiles/{profileId}/states?limit=N`
- **Record type:** Durable repository decision record. Extension of this file;
  the Slice 2 latest-state decision above is preserved verbatim and remains
  authoritative for `GET .../states/latest`.

## Context

The Slice 2 read-audit decision above deliberately scoped itself to the
latest-state read and did not define history or pagination endpoints. Before
any bounded historical-read surface is implemented, a single reusable policy
must govern both future surfaces so they do not diverge. This section records
that policy. Recording it does not implement anything.

## Final decision

### Authorization

- `requireAuth` runs first; a missing or invalid session yields 401
  `unauthenticated`.
- Project access uses the existing mechanism:
  `requireProjectAccess(userId, projectId, 'VIEWER')`; failure yields 403
  `forbidden`.
- The organization is always derived server-side from the authorized project.
- No client-supplied organization may establish authorization.

### Profile/project isolation

- All reads are constrained to the authorized `(projectId, profileId)` pair.
- No cross-project reads.
- An inaccessible or nonexistent profile must not create an existence oracle.
- After successful project authorization, a profile with no accessible rows
  may return HTTP 200 with an empty list.

### Limit

- Optional integer query parameter: `limit`.
- Default: 10.
- Maximum: 50.
- Values below 1, above 50, or non-integer values return 400 `invalid_input`.

### Ordering

- Most recent first.
- Deterministic ordering: `timestamp DESC, createdAt DESC, id DESC`.

### Pagination

- Cursor pagination and page-based pagination are OUT OF SCOPE.
- Only the most recent N records are returned.

### Audit

- Every successful bounded historical read produces exactly ONE audit event
  for the request, not one event per returned item.
- Transition History:
  - `action = emotional_event.history_read`
  - `resourceType = emotional_event`
  - `resourceId` omitted.
- State Timeline:
  - `action = emotional_state.history_read`
  - `resourceType = emotional_state`
  - `resourceId` omitted.
- Audit metadata allow-list: `projectId`, `profileId`, `requestId`, `outcome`.
- Do not include returned data, item IDs, counts, raw JSON, metadata, context,
  confidence, `idempotencyKey`, `requestHash`, or other internal fields in
  audit metadata.
- Audit failure is fail-closed: return 500 `internal_error` and never return an
  unaudited successful response.
- 401, 403, and 400 responses do not create audit events.

### Errors

- Reuse the existing frozen error-envelope conventions.
- 401 `unauthenticated`.
- 403 `forbidden`.
- 400 `invalid_input`.
- 500 `internal_error`.
- For State Timeline, domain-invalid persisted state data must fail the whole
  request with the existing `state_data_invalid` behavior; corrupt rows must
  never be silently skipped.

### Disclosure

- Both future historical-read response bodies must carry the existing canonical
  `SCIENTIFIC_DISCLOSURE_CODE` and `SCIENTIFIC_DISCLOSURE_TEXT`.
- UI surfaces must render the existing persistent, non-dismissible scientific
  disclosure.
- Never present computational/model-estimated state as a measurement or
  detection of a person's true emotion.
- No psychological, clinical, diagnostic, or human-validity implication may be
  introduced.

### Data exposure

#### Transition History may expose only

- `eventId`
- `timestamp`
- `source`
- `valence`
- `intensity`
- `relevance`
- `surprise`
- `uncertainty`

#### Transition History must NOT expose

- `context`
- `metadata`
- `idempotencyKey`
- `requestHash`
- raw JSONB / internal fields

#### State Timeline may expose only the existing latest-state per-row public shape

- `stateId`
- `timestamp` (the existing latest-state shape field name)
- `emotionVector`
- `dimensions`: valence, arousal, intensity
- `modelIdentity`
- `parameterIdentity`
- `initialized`

#### State Timeline must NOT expose

- `confidence`
- raw `state` JSONB
- internal diagnostics

### Out of scope

- Pagination/cursors.
- Aggregation.
- Comparison.
- Ranking.
- Multi-profile sorting.
- Dominant-emotion calculations.
- Thresholds/composite scores.
- Profile lifecycle.
- Database schema changes.
- ML.
- Equation changes.
- `DeterministicEmotionalDynamicsProvider` changes.
- Evaluation-runtime coupling.
- Webhooks.
- Rate limiting.

### Scientific governance

- This decision does not authorize any mathematical/equation change.
- No `DeterministicEmotionalDynamicsProvider` change is permitted under this
  decision.
- Any future equation change still requires the Mathematical Decision Register
  (`docs/mathematical-decision-register.md`).
- Synthetic Evaluation and Human Behavioral Evaluation remain separate.

### Documentation scope

- This decision modifies only this file
  (`docs/decisions/read-audit-semantics.md`).
- `docs/api.md` is NOT modified by this decision; it will be updated only when
  an endpoint is actually implemented.
- Neither endpoint is implemented by this decision.
- No tests for the future endpoints are added by this decision.
