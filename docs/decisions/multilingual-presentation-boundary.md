# EMORA Multilingual Presentation Boundary

- **Status:** Accepted
- **Date:** 2026-10-05
- **Applies to:** EMORA web presentation layer (`apps/web/app/`), EN/FR/AR UI
  presentation, scientific disclosure presentation
- **Record type:** Durable architectural decision record, created after the
  Multilingual Scientific Language Boundary Audit
  (`MULTILINGUAL_BOUNDARY_AUDIT_PASS_WITH_FINDINGS`)

## Decision

1. EMORA supports **EN/FR/AR presentation** of its user-facing workspace.
2. **Locale is presentation metadata.** It is selected and persisted in the
   client preferences store only (`emora.locale` in `localStorage`).
3. **Locale is not a computational input.** It never enters the deterministic
   emotional model, its parameters, dynamics, or state transitions.
4. **Locale is not persisted in the database.** No table, column, or migration
   carries a locale.
5. **Locale is not included in `requestDigest`.** Idempotency and request
   hashes are language-invariant by construction.
6. **Locale is not included in audit metadata.** Audit rows record
   operational identifiers only, never locale.
7. **Locale must not alter deterministic equations, parameters, dynamics,
   state transitions, or model outputs.** Any change that would make an
   emotional value, transition, confidence value, or model parameter depend on
   language is prohibited.
8. **Canonical machine/API tokens remain language-invariant.** The canonical
   scientific disclosure constant (`SCIENTIFIC_DISCLOSURE_CODE` /
   `SCIENTIFIC_DISCLOSURE_TEXT` in `apps/web/server/transitions/disclosure.ts`)
   remains the machine/API authority and is not translated, weakened, or
   reinterpreted. API contracts and response schemas are unchanged.
9. **Scientific disclosures have one canonical semantic definition.** The
   canonical English constant defines the meaning: computational,
   model-estimated, derived from the supplied event/context; NOT a measurement,
   NOT a detection, NOT a diagnosis, NOT a clinical assessment, NOT
   psychological validity, NOT evidence of what a person actually feels.
10. **UI translations must preserve that definition.** The EN/FR/AR
    presentation strings (`disclosureText` in
    `apps/web/app/shell/messages.ts`) are presentation translations keyed by
    the same canonical disclosure code. They must not weaken, shorten,
    embellish, or scientifically reinterpret the canonical claims.
11. **Future semantic multilingual input is a separate architectural decision
    and is NOT established by this record.**

## Explicit non-establishment

This decision does not establish multilingual semantic understanding,
emotion detection, psychological inference, or psychological validity.

## Implementation boundary

- The server canonical disclosure constant remains frozen and unchanged; it is
  the machine/API canonical disclosure. UI presentation resolves through the
  presentation dictionary keyed by the canonical disclosure code
  (`data-disclosure={SCIENTIFIC_DISCLOSURE_CODE}` + `t('disclosureText')`).
- The `/app` page remains a server component for authentication,
  membership-scoped discovery, and the development-only fixture gate. A minimal
  client presentation boundary (`apps/web/app/workspace-view.tsx`) renders
  already-resolved, serializable identity data through the presentation
  dictionary. Locale does not cross the server/client boundary into requests.
- Arabic numerals: scientific numeric readouts, IDs, timestamps, and counts
  remain ASCII digits; Arabic-Indic digits are not forced anywhere. Numeric
  computation and canonical serialization are unchanged.
- Accessibility labels (including the scientific disclosure labels) resolve
  through the same presentation dictionary so the accessible name follows the
  active UI language.

## Rationale

The audit proved language does not reach the deterministic emotional core,
does not affect computation, is not persisted, and is not part of
`requestDigest`. This record preserves those invariants while making the
presentation layer consistent: one disclosure mechanism across all localized
scientific surfaces, complete EN/FR/AR coverage of implemented workspace
strings, and regression tests that keep the boundary in place.
