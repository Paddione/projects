# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

Patrick's Projects is a monorepo containing independent full-stack applications sharing centralized PostgreSQL infrastructure. See [README.md](README.md) for the full service table, production URLs, and quick start.

Detailed documentation lives in [`docs/`](docs/README.md):
- **[Architecture](docs/architecture/)** -- System design, networking, database, storage
- **[Guides](docs/guides/)** -- Getting started, testing, deployment, environment variables
- **[Infrastructure](docs/infrastructure/)** -- Kubernetes, CI/CD, registry, secrets, PXE boot
- **[Services](docs/services/)** -- Per-service deep dives (only what's unique to each)

## Common Commands

### Root-Level Commands

```bash
# Development
npm run dev:all              # Start all services concurrently
npm run dev:arena            # Arena frontend + backend
npm run dev:l2p              # L2P frontend + backend
npm run dev:videovault       # VideoVault dev server
npm run dev:shop             # Shop dev server
npm run dev:sos              # SOS dev server

# Build & Test
npm run build:all            # Build all services
npm run test:all             # Run all test suites
npm run typecheck:all        # Type check all projects
npm run validate:env         # Validate environment files

# Deployment (k8s) - see docs/guides/deployment.md for full reference
./k8s/scripts/deploy/deploy-all.sh
./k8s/scripts/deploy/deploy-changed.sh
./k8s/scripts/deploy/deploy-changed.sh --committed
./k8s/scripts/utils/deploy-tracker.sh status
```

### Running Single Tests

```bash
# l2p backend (ESM requires --experimental-vm-modules)
cd l2p/backend && NODE_OPTIONS=--experimental-vm-modules npx jest src/services/AuthService.test.ts

# l2p frontend
cd l2p/frontend && NODE_ENV=test npx jest src/components/Login.test.tsx

# VideoVault
cd VideoVault && npx vitest run client/src/services/filter-engine.test.ts

# shop
cd shop && npx vitest run test/some.test.ts
```

## Project-Specific Documentation

Each service has its own README.md and CLAUDE.md:

| Service | README | CLAUDE.md | Deep Dive |
|---------|--------|-----------|-----------|
| Arena | [arena/README.md](arena/README.md) | [arena/CLAUDE.md](arena/CLAUDE.md) | [docs/services/arena.md](docs/services/arena.md) |
| L2P | [l2p/README.md](l2p/README.md) | [l2p/CLAUDE.md](l2p/CLAUDE.md) | [docs/services/l2p.md](docs/services/l2p.md) |
| VideoVault | [VideoVault/README.md](VideoVault/README.md) | [VideoVault/CLAUDE.md](VideoVault/CLAUDE.md) | [docs/services/videovault.md](docs/services/videovault.md) |
| Shop | [shop/README.md](shop/README.md) | -- | [docs/services/shop.md](docs/services/shop.md) |
| Auth | [auth/README.md](auth/README.md) | -- | [docs/services/auth.md](docs/services/auth.md) |
| SOS | [SOS/README.md](SOS/README.md) | [SOS/CLAUDE.md](SOS/CLAUDE.md) | [docs/services/sos.md](docs/services/sos.md) |
| Assetgenerator | [Assetgenerator/README.md](Assetgenerator/README.md) | [Assetgenerator/CLAUDE.md](Assetgenerator/CLAUDE.md) | [docs/services/assetgenerator.md](docs/services/assetgenerator.md) |

Infrastructure: [k8s/README.md](k8s/README.md), [shared-infrastructure/README.md](shared-infrastructure/README.md), [SMB-Symlinks/README.md](SMB-Symlinks/README.md)

Architecture diagrams and operational runbooks: [Obsidian vault](SMB-Symlinks/storage-pve3a/Obsidian/)

**Read the relevant project CLAUDE.md before making changes.** Consult `docs/` for cross-service architecture and shared patterns.

## Architecture Quick Reference

For details see [docs/architecture/overview.md](docs/architecture/overview.md).

### Three-Layer Backend

All services: Routes (HTTP/WebSocket) → Services (business logic) → Repositories (Drizzle/Prisma).

### Centralized PostgreSQL

All services connect to a single PostgreSQL instance with isolated databases. See [docs/architecture/database.md](docs/architecture/database.md).

### Real-Time (Socket.io)

L2P and Arena use Socket.io for multiplayer. See service-specific docs for event lists.

### Authentication

- **Auth service**: Unified JWT/OAuth provider. See [docs/services/auth.md](docs/services/auth.md).
- **L2P dual-auth**: Two auth layers (apiService + Zustand) must stay in sync. See [docs/services/l2p.md](docs/services/l2p.md).
- **Shop**: NextAuth v5 with auth service integration.

### Frontend Runtime Config (L2P, Arena)

Same Docker image works across all environments via runtime env injection. See [docs/guides/environment-variables.md](docs/guides/environment-variables.md#frontend-runtime-config-l2p-arena).

## Testing Constraints

For full testing reference see [docs/guides/testing.md](docs/guides/testing.md).

### Critical Rules

1. **L2P ESM flag**: ALL Jest tests need `NODE_OPTIONS=--experimental-vm-modules`
2. **L2P test DB isolation**: Integration tests use port 5433. Never test against production (5432).
3. **VideoVault test stubs**: Enhanced services stubbed in `vitest.config.ts`. Single-threaded execution.
4. **VideoVault coverage**: Per-file thresholds (85-95%) enforced.

## Environment Configuration

For full reference see [docs/guides/environment-variables.md](docs/guides/environment-variables.md).

### Critical Rules

1. **Never commit** `.env-dev` or `.env-prod`
2. **Alphanumeric-only** database passwords (avoid Docker escaping issues)
3. Secrets must be **unique per environment**
4. **Lockfiles are committed** — include `package-lock.json` changes with dependency updates

## Multi-Agent Coordination

When multiple agents work simultaneously:

1. **Work in different projects** or different subsystems
2. **Avoid simultaneous edits** to the same file

**Critical sections** requiring exclusive access:
- Git operations (commit/merge/branch)
- Skaffold / Docker operations (rebuild/restart)
- Database migrations
- Dependency updates

## Feature Implementation Workflow

When implementing a feature (whether via `/feature-dev` or a direct request), follow this end-to-end pipeline. Do NOT stop between steps unless you need a genuine design decision from the user.

### Visual Companions for Questions

Whenever you ask the user a question during implementation, **always include a visual diagram** directly above the question:

- **Architecture/design decisions** → Mermaid `graph` or `flowchart` showing components and data flow
- **UI/UX questions** → ASCII wireframe or HTML mockup of the proposed layout
- **Data model questions** → Mermaid `erDiagram` showing entities and relationships
- **Trade-off questions** → Markdown comparison table with columns for each option

Never ask a bare-text question without a visual. The visual helps make the right decision faster.

### Question Answering Rules

- **NEVER self-answer your own questions.** Present the visual, present the options, then STOP and WAIT for the user's response.
- The ONLY exception: if the user explicitly says "use recommended", "your call", "you decide", or similar — only then may you pick an option and continue.
- After the user answers, immediately resume implementation — do not summarize or confirm, just build.

### Auto-Continue After User Answers

After the user answers a question, **immediately continue implementation**. Do not:
- Summarize what they said back to them
- Ask "shall I proceed?" or "ready to continue?"
- Pause for confirmation unless there's a new ambiguity

### Full Pipeline (complete all before stopping)

1. **Implement** — Write the feature code
2. **Test** — Write unit + e2e tests for ALL new/changed code. Run unit and integration tests. Fix until green.
3. **Deploy** — Deploy to k3s production via `./k8s/scripts/deploy/deploy-<service>.sh`. Run e2e tests against production. Fix and redeploy until green.
4. **Document** — MANDATORY: Update Obsidian vault (`SMB-Symlinks/storage-pve3a/Obsidian/`) — service docs, architecture, infrastructure as applicable. Update relevant docs in `docs/` for cross-service changes. Do NOT skip Obsidian.
5. **Ship** — `git commit` with descriptive message including all changes (implementation, tests, docs), `git push`.

## Change Discipline

- Confirm target project before making changes
- Prefer small, targeted edits over sweeping refactors
- Match existing patterns and lint rules
- Do not add dependencies or change infrastructure without explicit approval
- Run the smallest relevant test suite for your change
- Update existing docs rather than creating new ones
- **Update Obsidian vault** when implementing new features or changing existing ones
- Always deploy changes to k3s after committing (don't leave changes undeployed)
- **Deploy with shell scripts** — they build, push, and restart automatically
- After deploying, verify with `deploy-tracker.sh status` that the SHA was recorded
