# `@emora/contract`

This private workspace package defines EMORA's internal, language-neutral
machine-consumption contract. Its authoritative schema is
[`schema/machine-contract-v1.schema.json`](./schema/machine-contract-v1.schema.json),
written for JSON Schema Draft 2020-12. TypeScript types and
`serializeMachineContractV1()` are implementation helpers for that schema, not
replacements for it.

## Current boundary

The contract is internal and reusable. It is **not** returned by the current
transition HTTP endpoint, and no public endpoint exposes it. Public exposure
requires a separate owner decision and compatibility review. Contract version
`1.0.0` is the fixed implementation target, but is not considered frozen until
the technical and governance validation gates pass.

The v1 contract contains only `contractVersion`, result values/identifiers/
timestamp, model and parameter identity, and the canonical disclosure. It
excludes `requestDigest`, confidence data, explanation metadata, context, raw
state, memories, embeddings, diagnostics, locale, UI formatting, and
authentication/session data. The parameter identity is fixed to
`DEFAULT_DETERMINISTIC_MODEL_PARAMETERS`; it does not claim active parameter
selection, activation, or parameter-set hashing.

The serializer selects an explicit allow-list and does not add defaults or
coerce values. Focused tests validate serialized objects against the Draft
2020-12 schema using Ajv 8.20.0's `ajv/dist/2020` entry point and
`ajv-formats` 3.0.1. No runtime Ajv dependency is used by the serializer.