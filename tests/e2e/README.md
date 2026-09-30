# Product Reality Validation — E2E Scope

This directory holds the browser-level Product Reality Validation suite for the
current product journey.

## Scope boundary

This validation slice covers exactly the existing user journey:

Register → Bootstrap → Project → Profile → Transition → Computed State →
Disclosure → Reload/Persistence → Re-authentication.

**History UI is explicitly OUT OF SCOPE for this slice.** The transition-history
(`GET .../transitions?limit=N`) and state-history (`GET .../states?limit=N`)
endpoints remain backend capabilities only. No history UI, history navigation,
history charts, replay, recomputation, cross-model comparison, or psychological
trajectory visualization exists or is validated here.

Also out of scope: ML, Memory, RAG, SaaS, deterministic-core changes, new
endpoints, new database tables, and any product-code changes.

## Prerequisites

1. A migrated local PostgreSQL (repository-standard mechanism):
   `docker compose up -d postgres` then
   `DATABASE_URL=postgresql://emora:emora_dev_only@localhost:5432/emora pnpm --filter @emora/database db:migrate`
2. A production build (the suite runs against `next start`, so the real
   first-user bootstrap path is exercised without development fixtures):
   `pnpm build`
3. Playwright browsers: `pnpm exec playwright install chromium`

## Run

```
DATABASE_URL=postgresql://emora:emora_dev_only@localhost:5432/emora \
AUTH_SECRET=emora-e2e-only-secret-not-for-production-32 \
BETTER_AUTH_URL=http://localhost:3000 \
pnpm exec playwright test
```

## Test isolation and known limitations

- Every run registers a fresh, unique test user through the real registration
  flow; no credentials are hard-coded and no production account is used. The
  local development database accumulates test users across runs.
- Idempotent duplicate submission cannot be exercised through the current UI
  (the UI always sends a fresh `Idempotency-Key`); it is covered by the
  backend route tests instead.
- The suite does not weaken or mock server authorization: the cross-project
  denial check sends a real request with the second user's session cookie and
  expects the server's 403 envelope.
