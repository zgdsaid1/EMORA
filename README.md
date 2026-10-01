# HYBRID EMOTIONAL ENGINE

Foundation monorepo for a hybrid AI engine that will model estimated emotional states using psychological equations, machine learning, contextual reasoning, temporal dynamics, and emotional memory. The product never claims to detect or measure a person's true emotion.

## Architecture

This is a modular pnpm and Turborepo monorepo. The Next.js application lives in `apps/web`; reusable boundaries live in `packages`; future ML workloads live in `services/ml`. `packages/emotional-core` is pure TypeScript and has no dependency on React, Next.js, databases, queues, HTTP, browser APIs, or UI.

## Technology Stack

- TypeScript, strict mode, ESLint, Prettier
- pnpm and Turborepo
- Next.js App Router, React, Tailwind CSS, shadcn/ui foundation, Lucide
- Zod validation foundation
- PostgreSQL and Drizzle foundation
- Vitest, Testing Library, and Playwright foundations
- Docker Compose and GitHub Codespaces devcontainer

## Repository Structure

```text
apps/web             Next.js application
packages/emotional-core  Framework-independent domain contracts
packages/{database,auth,validation,ai,config,types,ui}
services/ml          Future ML boundary
docs                   Architecture and product foundations
tests                  Cross-package test boundary
```

## Local Development

Requirements: Node.js 22+, pnpm 10+, and Docker for local infrastructure.

```bash
pnpm install
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Start PostgreSQL for application persistence. Compose also defines Redis, which currently has no application usage:

```bash
docker compose up -d
```

The application uses PostgreSQL. Redis is a Compose-only service and is not used by application code.

## Codespaces

Open the repository in GitHub Codespaces. The `.devcontainer` configuration provides Node.js, pnpm setup, Docker tooling, forwarded web/database ports, and the recommended editor extensions. Run `docker compose up -d` for local PostgreSQL and Redis.

## Environment Variables

Copy `.env.example` to a local environment file when future phases need configuration. It contains placeholders only. Server secrets must never be exposed to the browser or committed to Git.

## Roadmap

The repository includes PostgreSQL persistence, Better Auth authentication, versioned `/api/v1` product APIs, and an active deterministic emotional model. Redis is defined in Compose but is not used by application code. There is no ML inference or training runtime; ML provider contracts exist without an implementation. See `docs/` for current boundaries and limitations.

## Governance

For the governing development methodology and architectural decision framework, see [`docs/architecture/development-methodology.md`](docs/architecture/development-methodology.md).
