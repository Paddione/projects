# Patrick's Projects Monorepo

A collection of independent full-stack applications, shared infrastructure, and AI tooling.

## Projects Overview

| Project | Description | Tech Stack | Port(s) |
| --- | --- | --- | --- |
| [Learn2Play (l2p)](./l2p/README.md) | Multiplayer quiz platform | React, Express, Socket.io, PostgreSQL | 3000, 3001 |
| [VideoVault](./VideoVault/README.md) | Client-first video management | React, Vite, File System Access API | 5100 (dev), 5000 (k8s) |
| [Payment](./payment/README.md) | Payment platform with Stripe | Next.js 16, Prisma, NextAuth | 3004 (dev), 3000 (k8s) |
| [Auth](./auth/README.md) | Unified authentication service | Node, JWT, OAuth, PostgreSQL | 5500 |
| Dashboard | Cluster control center | Node, Express, Socket.io | 4242 |
| [Reverse Proxy](./reverse-proxy/README.md) | Traefik routing and TLS | Traefik, Docker | 443/80 |
| [Shared Infrastructure](./shared-infrastructure/README.md) | Centralized Postgres + shared assets | PostgreSQL, Docker | 5432 |
| [Shared Resources](./shared-infrastructure/shared/README.md) | Cross-service packages and design assets | CSS, TypeScript, Node | - |

## 🚀 Deployment & Environment Management

**⚠️ IMPORTANT**: This repository follows a **strict single environment per service** model.

### Key Documentation
- **[k8s/README.md](./k8s/README.md)** - Kubernetes deployment guide
- **[k8s/services/README.md](./k8s/services/README.md)** - Service routing and ports
- **[k8s/infrastructure/README.md](./k8s/infrastructure/README.md)** - Infra components (Traefik/Postgres/SMB/NFS)
- **[k8s/secrets/README.md](./k8s/secrets/README.md)** - Secrets generation and handling
- **[k8s/scripts/README.md](./k8s/scripts/README.md)** - Cluster and deploy scripts
- **[scripts/README.md](./scripts/README.md)** - Root automation scripts
- **[AGENTS.md](./AGENTS.md)** - Repository guidelines and agent instructions

### Quick Deployment
```bash
# Start all production services
./scripts/start-all-production.sh

# Check service health
./scripts/health-check.sh

# Stop all services
./scripts/stop-all.sh
```

### Environment Rules
1. Each service has **exactly ONE** production environment
2. Each service has **exactly ONE** development environment (if applicable)
3. No duplicate or overlapping environments allowed
4. All deployments follow patterns in `DEPLOYMENT.md`
5. Dashboard at https://dashboard.korczewski.de manages everything

### Service URLs (Production)
- **Dashboard**: https://dashboard.korczewski.de
- **Auth**: https://auth.korczewski.de
- **L2P**: https://l2p.korczewski.de
- **Payment**: https://payment.korczewski.de (alias: https://shop.korczewski.de)
- **VideoVault**: https://videovault.korczewski.de (alias: https://video.korczewski.de)
- **Traefik**: https://traefik.korczewski.de

## Documentation

- Kubernetes deployment docs live under `k8s/`
- Project-specific documentation lives in each project directory

## Repository Guidelines

### Project Structure & Module Organization

- `l2p/`: quiz platform with `frontend/`, `backend/`; shared tooling lives in `shared-infrastructure/shared/l2p/`
- `VideoVault/`: video manager with `client/`, `server/`, `e2e/`; shared modules live in `shared-infrastructure/shared/videovault/`
- `payment/`: Next.js app with Prisma in `prisma/` and tests in `test/`
- `shared-infrastructure/shared/`: design system, MCP tooling, and per-service shared packages
- `shared-infrastructure/SMB-Share`: symlink to the host SMB share used by VideoVault storage
- Root utilities live in `scripts/`

Note: `VideoVault/shared-infrastructure` is a symlink to `../shared-infrastructure` so Vite builds resolve shared modules and dependencies locally.

### Coding Style & Naming

- TypeScript across projects; follow each ESLint config
- VideoVault uses Prettier (`VideoVault/.prettierrc.json`); other projects rely on ESLint
- Keep 2-space indentation and single quotes where the codebase uses them
- React components in `PascalCase`, hooks in `useThing`, tests in `__tests__/`, `test/`, or `e2e/`

### Testing Guidelines

- L2P: Jest unit/integration tests under `l2p/backend/src/**/__tests__` and `l2p/frontend/src/**/__tests__`, Playwright E2E under `l2p/frontend/e2e/`
- VideoVault: Vitest unit tests in `VideoVault/client/src/**.test.ts`, Playwright E2E in `VideoVault/e2e/`
- Payment: Vitest + Playwright in `payment/test/`

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
```

## Root Scripts

See `scripts/README.md` for the full list and usage. Common entry points:

- `scripts/setup.sh`: install dependencies and seed env files
- `scripts/start-all-production.sh`: start production Docker services
- `scripts/start-all-services.sh`: start shared Postgres + services
- `scripts/stop-all.sh`: stop production + dev services (optional infra)
- `scripts/health-check.sh`: check production health + container status

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
  reverse-proxy/.env-prod
```

Restore:

```bash
gpg -d env-backup-YYYYMMDD.tar.gz.gpg > env-backup-YYYYMMDD.tar.gz
tar -xzf env-backup-YYYYMMDD.tar.gz
```

## Centralized Database (Shared Infrastructure)

All services use a single PostgreSQL instance with separate databases and users. Shared assets (design system, MCP tooling, service-level shared packages) live under `shared-infrastructure/shared/`.

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

## Repository Structure

```
.
├── Obsidian/                  # User guide and service docs (Obsidian vault)
├── auth/                      # Auth service
├── dashboard/                 # Dashboard UI + server
├── k8s/                       # Kubernetes manifests and scripts
├── l2p/                       # Learn2Play
├── payment/                   # Payment
├── reverse-proxy/             # Traefik
├── shared-infrastructure/     # Centralized Postgres + shared assets
│   └── shared/                # Shared design system, MCP tooling, per-service shared packages
├── VideoVault/                # VideoVault app
├── scripts/                   # Root scripts
└── README.md
```

## Task Management
Active tasks and consolidated checklists live in the Obsidian vault (`Obsidian/`).
