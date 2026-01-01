# Patrick's Projects Monorepo

A collection of independent full-stack applications, shared infrastructure, and AI tooling.

## Projects Overview

| Project | Description | Tech Stack | Port(s) |
| --- | --- | --- | --- |
| [Learn2Play (l2p)](./l2p/README.md) | Multiplayer quiz platform | React, Express, Socket.io, PostgreSQL | 3000, 3001 |
| [VideoVault](./VideoVault/README.md) | Client-first video management | React, Vite, File System Access API | 5100/5000 |
| [Payment](./payment/README.md) | Payment platform with Stripe | Next.js 16, Prisma, NextAuth | 3004 |
| [VLLM](./vllm/README.md) | MCP server for AI inference and analysis | TypeScript, vLLM, PostgreSQL | 4100 |
| [Auth](./auth/README.md) | Unified authentication service | Node, JWT, OAuth, PostgreSQL | 5500 |
| [Reverse Proxy](./reverse-proxy/README.md) | Traefik routing and TLS | Traefik, Docker | 443/80 |
| [Shared Infrastructure](./shared-infrastructure/README.md) | Centralized Postgres | PostgreSQL, Docker | 5432 |

## Repository Guidelines

### Project Structure & Module Organization

- `l2p/`: quiz platform with `frontend/`, `backend/`, and `shared/`
- `VideoVault/`: video manager with `client/`, `server/`, and `e2e/`
- `payment/`: Next.js app with Prisma in `prisma/` and tests in `test/`
- `vllm/`: MCP server with `src/`, `tests/`, optional `dashboard/` and `rag/`
- Root utilities live in `scripts/`

### Coding Style & Naming

- TypeScript across projects; follow each ESLint config
- VideoVault uses Prettier (`VideoVault/.prettierrc.json`); other projects rely on ESLint
- Keep 2-space indentation and single quotes where the codebase uses them
- React components in `PascalCase`, hooks in `useThing`, tests in `__tests__/`, `test/`, or `e2e/`

### Testing Guidelines

- L2P: Jest unit/integration tests under `l2p/backend/src/**/__tests__` and `l2p/frontend/src/**/__tests__`, Playwright E2E under `l2p/frontend/e2e/`
- VideoVault: Vitest unit tests in `VideoVault/client/src/**.test.ts`, Playwright E2E in `VideoVault/e2e/`
- Payment: Vitest + Playwright in `payment/test/`
- VLLM: Jest tests in `vllm/tests/`

Add or update tests with every functional change.

### Commit & PR Guidelines

- Commit messages are short and imperative (include project name when helpful)
- PRs should list affected projects, summary, tests run, and env/migration changes
- Include screenshots for UI updates

## Quick Start

```bash
# Root setup
./scripts/setup.sh

# Development
cd l2p && npm run dev:backend && npm run dev:frontend
cd VideoVault && npm run dev
cd payment && npm run dev
cd vllm && npm run dev:watch
```

## Root Scripts

- `scripts/setup.sh`: install dependencies and seed env files
- `scripts/start-all-services.sh`: start shared Postgres + services
- `scripts/stop-all-services.sh`: stop services in order
- `scripts/restart_all_services.sh`: restart stacks and dashboard
- `scripts/db-viewer.sh`: inspect running DB containers and ports

## Environment Setup (General)

Standard env layout per service:
- `.env.example` (template)
- `.env-dev` (development, gitignored)
- `.env-prod` (production, gitignored)

Rules:
- Never commit `.env-dev` or `.env-prod`
- Use alphanumeric-only database passwords (avoid Docker/Postgres escaping issues)
- Secrets must be unique per environment

Validation:
```bash
npm run validate:env
npm run validate:env:dev
npm run validate:env:prod
```

Service-specific environment details live in each service README.

### Secret Generation

```bash
# JWT/session secrets
openssl rand -hex 32

# Alphanumeric DB passwords
openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 32 && echo
```

### Security Best Practices

1. Never commit `.env-dev` or `.env-prod`
2. Use strong, unique secrets per environment
3. Keep DB passwords alphanumeric only
4. Store API keys in a password manager or secrets store
5. Rotate production secrets regularly

### Troubleshooting

- If Postgres connections fail: verify `shared-infrastructure` is running and env passwords match
- If env vars are ignored: check file names and restart services
- If Docker can't find env files: use `docker-compose --env-file .env-prod up`

### API Keys

- Google Gemini AI: https://makersuite.google.com/app/apikey
- Stripe: https://dashboard.stripe.com
- Google OAuth: https://console.cloud.google.com/apis/credentials
- Hugging Face: https://huggingface.co/settings/tokens

### Backup Env Files

```bash
tar -czf env-backup-$(date +%Y%m%d).tar.gz \\
  shared-infrastructure/.env-prod \\
  auth/.env-{dev,prod} \\
  l2p/.env-{dev,prod} \\
  VideoVault/.env-{dev,prod} \\
  payment/.env-{dev,prod} \\
  vllm/.env-{dev,prod} \\
  vllm/rag/.env-prod \\
  reverse-proxy/.env-prod
```

Restore:

```bash
gpg -d env-backup-YYYYMMDD.tar.gz.gpg > env-backup-YYYYMMDD.tar.gz
tar -xzf env-backup-YYYYMMDD.tar.gz
```

## Centralized Database (Shared Infrastructure)

All services use a single PostgreSQL instance with separate databases and users. Details, migration steps, and credentials live in `shared-infrastructure/README.md`.

Start/stop all services:
```bash
./scripts/start-all-services.sh
./scripts/stop-all-services.sh
```

## Common Commands

```bash
# Build
cd l2p && npm run build:all
cd VideoVault && npm run build
cd payment && npm run build
cd vllm && npm run build

# Tests
cd l2p && npm run test:all
cd VideoVault && npm test
cd payment && npm test
```

## Docker Usage

- Start shared Postgres first: `cd shared-infrastructure && docker-compose up -d`
- Each service has its own compose config
- Reverse proxy uses Traefik with the `traefik-public` network

## Testing Philosophy

- Run the smallest relevant test suite for your change
- If tests are not run, say so and explain why
- Prefer unit tests for logic, integration tests for service boundaries, E2E for workflows

## Change Discipline (LLM Rules)

- Prefer small, targeted edits; avoid sweeping refactors
- Match existing patterns and lint rules
- Do not add dependencies, run migrations, or change infra without explicit approval
- Keep secrets out of the repo
- Update docs instead of creating new ones
- Avoid destructive operations unless explicitly requested

## LLM Rules (Detailed)

### Scope & Context

- Confirm the target project and work only in its directory unless asked otherwise
- Read the relevant project README and this root README before changes

### Multi-Agent Coordination

Task declaration:
- Check for `.agent-tasks.md` at repo root
- Add task entries with timestamp, project, status, and description
- Format: `[YYYY-MM-DD HH:MM] [project-name] [IN_PROGRESS|BLOCKED|DONE] Description`

Project isolation:
- Prefer working in different projects
- If sharing a project, coordinate on different subsystems
- Avoid simultaneous edits to the same file

Critical sections (require exclusive access):
- Git operations (commit/merge/branch)
- Docker operations (rebuild/restart containers)
- Database migrations
- Dependency updates
- Root-level changes
- Deployments

Conflict resolution:
- Mark conflicts as `[BLOCKED]`
- Yield to active critical operations
- Communicate blockers clearly

Status communication:
- Update task status between major steps
- Mark tasks `[DONE]` immediately when complete

Example:
```
[2025-12-27 14:30] [l2p] [IN_PROGRESS] Adding profile feature (frontend/src/components/Profile.tsx)
[2025-12-27 14:35] [vllm] [DONE] Updated MCP server configuration, container restarted
```

### Testing Expectations

- Run the smallest relevant test suite
- If tests are skipped, say why

### Communication

- Provide a concise summary
- List files modified
- Include commands run and assumptions

## Git Workflow

- Conventional commits recommended
- Large files excluded via `.gitignore`
- Each project maintains independent versioning

## Special Considerations

- Services are independent except for shared Postgres
- L2P and VideoVault are performance-sensitive
- VLLM tools allow SELECT-only database queries

## Repository Structure

```
.
├── auth/                      # Auth service
├── l2p/                       # Learn2Play
├── payment/                   # Payment
├── reverse-proxy/             # Traefik
├── shared-infrastructure/     # Centralized Postgres
├── vllm/                      # MCP server + tooling
├── VideoVault/                # VideoVault app
├── scripts/                   # Root scripts
└── README.md
```

## Task Management

This section is the source of truth for active tasks and consolidated checklists.

### Active Tasks

| Task ID | Status | Owner | Description | Last Update |
| :--- | :--- | :--- | :--- | :--- |
| `TASK-012` | 🟡 In Progress | Codex | Investigate why l2p.korczewski.de is not responding | 2025-12-31 |
| `TASK-016` | 🟡 In Progress | Codex | Complete OAuth migration/testing checklist (consolidated from `OAUTH_IMPLEMENTATION_STATUS.md`) | 2026-01-01 |
| `TASK-017` | 🟡 In Progress | Codex | Complete auth deployment checklist (consolidated from `auth/DEPLOYMENT_CHECKLIST.md`) | 2026-01-01 |
| `TASK-018` | 🟡 In Progress | Codex | Deliver vllm Command Center expansion plan (consolidated from `vllm/COMMAND_CENTER_PLAN.md`) | 2026-01-01 |
| `TASK-019` | 🟡 In Progress | Codex | Address Playwright follow-up recommendations (consolidated from `PLAYWRIGHT_FIXES.md`) | 2026-01-01 |
| `TASK-020` | 🟡 In Progress | Codex | Implement l2p backend test improvements (consolidated from `l2p/backend/TEST_FIXES.md`) | 2026-01-01 |
| `TASK-021` | ✅ Done | Codex | Review and reorder npm scripts across monorepo | 2026-01-01 |
| `TASK-013` | ✅ Done | Codex | Review auth process and align services to the central auth service | 2026-01-01 |
| `TASK-014` | ✅ Done | Codex | Finalize OAuth best-practice fixes and include existing OAuth files | 2026-01-01 |
| `TASK-015` | ✅ Done | Codex | Run end-to-end OAuth login test across auth + l2p | 2026-01-01 |
| `TASK-008` | ✅ Done | Codex | Investigate failing VideoVault and l2p/shared/test-config tests from latest runs | 2025-12-30 |
| `TASK-009` | ✅ Done | Codex | Align WebCodecs thumbnail service mock support detection with production behavior | 2025-12-30 |
| `TASK-001` | ✅ Done | Antigravity | Estalishing Reverse Proxy Bridge (Local Sync/Mount) | 2025-12-28 |
| `TASK-002` | ✅ Done | Antigravity | Auth Service Logic & Email Integration | 2025-12-28 |
| `TASK-003` | ✅ Done | Codex | Project-wide dependency audit and cleanup | 2025-12-30 |
| `TASK-004` | ✅ Done | Codex | Set VideoVault public domain and add NPM proxy guidance | 2025-12-28 |
| `TASK-005` | ✅ Done | Codex | Audit l2p tests that are skipped/ignored and decide whether to re-enable or remove | 2025-12-28 |
| `TASK-006` | ✅ Done | Codex | Enable VideoVault server tests and resolve excluded/enforced skips | 2025-12-30 |
| `TASK-007` | ✅ Done | Codex | Reconcile l2p/shared/test-config test coverage | 2025-12-30 |
| `TASK-010` | ✅ Done | Codex | Review unit tests across monorepo | 2025-12-31 |
| `TASK-011` | ✅ Done | Codex | Stabilize useToast unit tests and remove debug logs in GameService tests | 2025-12-31 |

### Consolidated Task Checklists

#### TASK-016: OAuth migration/testing checklist
- [ ] Run auth service migrations
- [ ] Run L2P backend migrations
- [ ] Start auth service (port 5500)
- [ ] Start L2P backend (port 5001)
- [ ] Start L2P frontend (port 3000)
- [ ] Test OAuth flow: visit l2p.korczewski.de, login via auth service, exchange code for tokens, verify game profile load
- [ ] Test token refresh
- [ ] Test logout
- [ ] Test protected routes

#### TASK-017: Auth deployment checklist
- [ ] Step 1: Google OAuth configuration (add production redirect URI)
- [ ] Step 2: Nginx Proxy Manager setup for auth.korczewski.de
- [ ] Step 3: Build and deploy auth service
- [ ] Step 4: Test OAuth flow
- [ ] Step 5: Security hardening (rotate secrets, strong DB password, NODE_ENV=production)
- [ ] Step 6: Database migration (optional)
- [ ] Step 7: Update project integrations (l2p, VideoVault, payment)
- [ ] Step 8: Final testing checklist
- [ ] Final testing: health endpoint responds
- [ ] Final testing: API info endpoint responds
- [ ] Final testing: login page loads
- [ ] Final testing: register page loads
- [ ] Final testing: OAuth redirect works
- [ ] Final testing: can register new user
- [ ] Final testing: can login with email/password
- [ ] Final testing: can login with Google OAuth
- [ ] Final testing: JWT tokens issued
- [ ] Final testing: token refresh works
- [ ] Final testing: logout works
- [ ] Final testing: password reset works
- [ ] Final testing: CORS works from project domains
- [ ] Final testing: SSL certificate is valid
- [ ] Final testing: HTTPS redirect works
- [ ] Step 9: Monitoring & backup setup (optional)
- [ ] Step 10: Documentation & handoff (update ALLOWED_ORIGINS + production URLs)

#### TASK-018: vllm Command Center expansion
- [ ] Mass operations: Start All / Stop All / Restart All controls
- [ ] Mass operations: dependency-aware startup prompts
- [ ] Advanced monitoring: real-time log streaming per service
- [ ] Advanced monitoring: CPU & system RAM tracking
- [ ] Advanced monitoring: process list for process-type services
- [ ] Alerts & automation: VRAM threshold alerts (90%/95%)
- [ ] Alerts & automation: auto-restart on failure toggle
- [ ] Alerts & automation: scheduled maintenance for restarts/updates
- [ ] Configuration management: environment variable editor with restart workflow
- [ ] Configuration management: Docker Compose sync
- [ ] Security & multi-user: role-based access
- [ ] Security & multi-user: activity log
- Priority: mass operations, log streaming, CPU/RAM tracking, env editor

#### TASK-019: Playwright follow-ups
- [ ] L2P: re-enable perks-management tests once UI is complete
- [x] VideoVault: fix failing unit test in `enhanced-thumbnail.test.ts`
- [ ] Payment: add E2E coverage for registration and purchasing flows
- [ ] All projects: set up CI/CD to run tests on pull requests

#### TASK-020: l2p backend test improvements
- [ ] Integration tests: set up test database for integration tests
- [ ] Integration tests: configure database seeding for test data
- [ ] Integration tests: implement proper cleanup between tests
- [ ] E2E tests: configure end-to-end test environment
- [ ] E2E tests: set up test user accounts
- [ ] E2E tests: implement test data management
- [ ] Performance: add performance benchmarks
- [ ] Performance: implement load testing scenarios
- [ ] Performance: monitor test execution times
- [ ] Maintenance: update test data as needed
- [ ] Maintenance: review/update mocks when services change
- [ ] Maintenance: maintain test environment configuration

### Ongoing System Maintenance
- [x] Establish Reverse Proxy Bridge (Local Sync/Mount)
- [x] Implement Email Service for Auth (Nodemailer/SMTP)
- [x] Enforce Username Normalization (lowercase)
- [x] Secure Password Reset Flow (Removed token leaks)
- [x] Add Security Email Alerts (Standard Practice)
- [ ] Monitor Nginx Proxy Manager logs
- [ ] Ensure all services in monorepo are running correctly

### Task History

| Task ID | Status | Completion Date | Summary |
| :--- | :--- | :--- | :--- |
| `TASK-000` | ✅ Done | 2025-12-28 | Initialized task tracking |
| `TASK-003` | ✅ Done | 2025-12-30 | Audited dependencies, removed unused/duplicate entries, and aligned lockfiles |
| `TASK-006` | ✅ Done | 2025-12-30 | Enabled VideoVault server tests and re-enabled enhanced-thumbnail + edit-tags-modal coverage |
| `TASK-007` | ✅ Done | 2025-12-30 | Removed stale test artifacts from test-config |
| `TASK-010` | ✅ Done | 2025-12-31 | Reviewed unit tests across monorepo |
| `TASK-011` | ✅ Done | 2025-12-31 | Reset toast test state and removed GameService debug logs |
