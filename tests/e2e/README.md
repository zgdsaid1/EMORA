# Product Reality Validation — E2E Scope

This directory holds the browser-level Product Reality Validation suite and
the separate C2 State History journey.

## Scope boundary

This validation slice covers exactly the existing user journey:

Register → Bootstrap → Project → Profile → Transition → Computed State →
Disclosure → Reload/Persistence → Re-authentication.

The Product Reality journey below remains unchanged. C2 State History is
validated separately by `state-history.spec.ts`; it is a read-only view of the
existing bounded state-history API. Transition history, charts, replay,
recomputation, cross-model comparison, and psychological trajectory
visualization remain out of scope.

Also out of scope: ML, Memory, RAG, SaaS, deterministic-core changes, new
endpoints, new database tables, and product code outside the C2 State History
UI.

## Prerequisites

1. Start the repository's local PostgreSQL service:
   `docker compose up -d postgres`.
2. If it does not already exist in this local Compose instance, create the
   dedicated test database once:
   `docker compose exec -T postgres psql -U emora -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE emora_test OWNER emora"`.
3. Set the validated test URL and migrate only `emora_test`:
   ```
   export TEST_DATABASE_URL=postgresql://emora:emora_dev_only@127.0.0.1:5432/emora_test
   export EMORA_RUN_DB_INTEGRATION=1
   pnpm --filter @emora/database db:migrate:test
   ```
4. A production build (the suite runs against `next start`, so the real
   first-user bootstrap path is exercised without development fixtures):
   `DATABASE_URL="$TEST_DATABASE_URL" pnpm build`
5. Playwright browsers: `pnpm exec playwright install chromium`

## Run

```
EMORA_RUN_DB_INTEGRATION=1 \
AUTH_SECRET=emora-e2e-only-secret-not-for-production-32 \
BETTER_AUTH_URL=http://localhost:3000 \
pnpm exec playwright test
```

`TEST_DATABASE_URL` must pass the strict local test-database policy (loopback
host, port 5432 or 5433, database `emora_test`). Playwright never reads
`DATABASE_URL`: the web server it launches receives only the validated test URL.

## Test isolation and known limitations

- Every run registers a fresh, unique test user through the real registration
  flow with test-only credentials; no production account is used. The
  dedicated `emora_test` database accumulates test users across runs.
- Idempotent duplicate submission cannot be exercised through the current UI
  (the UI always sends a fresh `Idempotency-Key`); it is covered by the
  backend route tests instead.
- The suite does not weaken or mock server authorization: the cross-project
  denial check sends a real request with the second user's session cookie and
  expects the server's 403 envelope.

## C2 State History journey

Run the isolated browser journey after the same dedicated local `emora_test`
database prerequisites above are satisfied:

```
pnpm exec playwright test tests/e2e/state-history.spec.ts
```

The Playwright configuration requires an explicit `TEST_DATABASE_URL`, checks
that it targets loopback `emora_test` on port 5432 or 5433, and gives the web
server only that validated URL. Never use production data or substitute
`DATABASE_URL` for `TEST_DATABASE_URL`. The C2 journey creates a unique test
account, project, profile, and computed states through the real application;
the account remains in the dedicated test database after the run.

The history request is forwarded to the real authenticated API before the
browser test delays it or simulates malformed, failed, or unauthorized
responses. This exercises the panel's client behavior without creating fake
state records or bypassing the API authorization path for successful reads.
