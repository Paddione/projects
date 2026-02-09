# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

Patrick's Projects is a monorepo containing independent full-stack applications sharing centralized PostgreSQL infrastructure. Each service operates independently but connects to a shared database instance.

| Project | Stack | Ports |
|---------|-------|-------|
| l2p | React, Express, Socket.io, Drizzle ORM | 3000, 3001 |
| VideoVault | React, Vite, File System Access API, Express | 5100/5000 |
| payment | Next.js 16, Prisma, NextAuth v5 | 3004 |
| auth | Express, Passport.js, JWT/OAuth | 5500 |
| shared-infrastructure | PostgreSQL, shared design system | 5432 |
| Obsidian | Obsidian vault (Markdown, Dataview, Templater) | — |

## Common Commands

### Root-Level Commands

```bash
# Development
npm run dev:all              # Start all services concurrently
npm run dev:l2p              # L2P frontend + backend
npm run dev:videovault       # VideoVault dev server
npm run dev:payment          # Payment dev server

# Build & Test
npm run build:all            # Build all services
npm run test:all             # Run all test suites
npm run typecheck:all        # Type check all projects
npm run validate:env         # Validate environment files

# Deployment (k8s) - Skaffold (build + deploy, use for code changes)
cd k8s && skaffold run                        # Full stack build + deploy
cd k8s && skaffold run -p l2p                 # L2P only (backend + frontend)
cd k8s && skaffold run -p auth                # Auth service only
cd k8s && skaffold run -p payment             # Payment service only
cd k8s && skaffold run -p videovault          # VideoVault only
cd k8s && skaffold run -p infra               # Infrastructure only (no builds)

# Deployment (k8s) - shell scripts (manifest-only, NO image rebuild)
./k8s/scripts/cluster/k3d-create.sh          # Create local k3d cluster
./k8s/scripts/utils/generate-secrets.sh      # Generate secrets from root .env
./k8s/scripts/deploy/deploy-all.sh           # Deploy all manifests
./k8s/scripts/utils/validate-cluster.sh      # Validate cluster health
./k8s/scripts/deploy/deploy-changed.sh       # Auto-detect and redeploy changed manifests
```

### Project-Specific Commands

**l2p** (from `l2p/` directory):
```bash
npm run dev:frontend         # Port 3000
npm run dev:backend          # Port 3001
npm run test:unit            # Unit tests (requires NODE_OPTIONS=--experimental-vm-modules)
npm run test:integration     # Integration tests (uses port 5433 test DB)
npm run test:e2e             # Playwright E2E
npm run db:migrate           # Run migrations
```

**VideoVault** (from `VideoVault/` directory):
```bash
npm run dev                  # Port 5100
npm run docker:dev           # Docker with hot reload (port 5000)
npm run test:all             # 6-stage test pipeline
npm run docker:pw:all        # Playwright E2E in Docker
```

**payment** (from `payment/` directory):
```bash
npm run dev                  # Port 3004
npm run test                 # Vitest tests
npm run test:e2e             # Playwright E2E
```

### Running Single Tests

```bash
# l2p backend (ESM requires --experimental-vm-modules)
cd l2p/backend && NODE_OPTIONS=--experimental-vm-modules npx jest src/services/AuthService.test.ts

# l2p frontend
cd l2p/frontend && NODE_ENV=test npx jest src/components/Login.test.tsx

# VideoVault
cd VideoVault && npx vitest run client/src/services/filter-engine.test.ts

# payment
cd payment && npx vitest run test/some.test.ts
```

## Architecture

### Service Architecture

Each service follows a three-layer architecture:
- **Routes**: HTTP/WebSocket endpoints
- **Services**: Business logic
- **Repositories**: Data access (Drizzle ORM or Prisma)

### Centralized PostgreSQL

All services connect to a single PostgreSQL instance with isolated databases:
- `l2p_db` - L2P quiz platform
- `videovault_db` - VideoVault (optional persistence)
- `payment_db` - Payment service
- `auth_db` - Auth service

Start shared infrastructure via Kubernetes manifests in `k8s/infrastructure/`.

### Real-Time Architecture (l2p)

L2P uses Socket.io for multiplayer functionality:
- Backend: `SocketService.ts` manages WebSocket connections
- Frontend: `socket.io-client` in service layer
- Client events: `join-lobby`, `leave-lobby`, `player-ready`, `start-game`, `submit-answer`, `perk:pick`, `perk:dump`
- Server events: `lobby-updated`, `game-started`, `question-started`, `join-success`, `join-error`, `*-error`

### Authentication (Dual-Auth Pattern)

L2P has two auth layers that must stay in sync:
- **apiService** (localStorage): `auth_token`, `user_data` — used for HTTP requests
- **Zustand authStore**: `user`, `token` — used for React component rendering
- **AuthGuard** bridges the two — must call BOTH `setUser()` AND `setToken()` for all auth paths
- Session-cookie auth (unified auth mode) uses `setToken('session')` as a sentinel value

### API Response Convention

Backend returns raw PostgreSQL column names (**snake_case**: `host_id`, `selected_character`). Frontend TypeScript types use **camelCase**. Always check the actual API response shape when accessing fields.

### Client-First Architecture (VideoVault)

VideoVault uses the browser as primary data store:
- localStorage for video metadata
- File System Access API for file handles (Chromium only)
- Session-based handles (lost on reload, rescan required)

### Documentation Vault (Obsidian)

The `Obsidian/` directory is an Obsidian knowledge vault serving as the high-level architecture and operations reference:
- **Core pages**: `Home.md`, `Architecture.md`, `Services.md`, `Infrastructure.md`, `Operations.md`
- **Service docs**: `services/{L2P,Auth,Payment,VideoVault}.md`
- **Infrastructure docs**: `infrastructure/{PostgreSQL,Traefik,SMB-CSI}.md`
- **Assets**: 10 SVG architecture diagrams in `assets/`
- **Plugins**: Dataview, Templater, obsidian-git
- **Theme**: Custom Cybervault CSS (cyan/dark aesthetic)

The Obsidian vault documents Kubernetes manifest locations, environment variable mappings, deployment procedures, and service dependencies. Use service templates in `.obsidian/templates/` when adding new service documentation.

### Network Configuration

- `traefik-public` - External routing network
- `l2p-network` - Internal service network
- Services connect to `shared-postgres:5432`

## Environment Configuration

### File Structure

```
.env.example      # Template
.env-dev          # Development (gitignored)
.env-prod         # Production (gitignored)
```

### Critical Rules

1. **Never commit** `.env-dev` or `.env-prod`
2. **Alphanumeric-only** database passwords (avoid Docker escaping issues)
3. Secrets must be **unique per environment**

### Secret Generation

```bash
# JWT/session secrets
openssl rand -hex 32

# Alphanumeric DB passwords
openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 32
```

### Required Variables (per service)

All services need:
- `DATABASE_URL` pointing to `shared-postgres:5432/<service>_db`
- `JWT_SECRET` or `SESSION_SECRET` (32-char hex minimum)
- Service-specific ports and URLs

## Testing Constraints

### l2p

**ALWAYS use `NODE_OPTIONS=--experimental-vm-modules`** for Jest tests (ESM modules).

Integration tests use separate database on **port 5433** (production on 5432).

Integration tests require `--forceExit --detectOpenHandles` flags for cleanup.

### VideoVault

**Test configuration** (`vitest.config.ts`):
- Enhanced services stubbed to avoid FlexSearch/WebCodecs dependencies
- Single-threaded execution (`singleThread: true`)
- Per-file coverage thresholds (85-95% for core services)

**Path aliases required**:
```typescript
import { VideoDatabase } from '@/services/video-database';
import { ErrorCodes } from '@shared/errors';
```

## Project-Specific Documentation

Each major project has its own CLAUDE.md with detailed guidance:
- `l2p/CLAUDE.md` - Backend/frontend architecture, Socket.io patterns, test setup
- `VideoVault/CLAUDE.md` - Client-first architecture, service patterns, test stubs

Architecture diagrams and operational runbooks live in the Obsidian vault:
- `Obsidian/` - High-level architecture, service docs, infrastructure docs, deployment procedures

Read the relevant project CLAUDE.md before making changes. Consult the Obsidian vault for cross-service architecture and deployment context.

## Multi-Agent Coordination

When multiple agents work simultaneously:

1. **Work in different projects** or different subsystems
2. **Avoid simultaneous edits** to the same file

**Critical sections** requiring exclusive access:
- Git operations (commit/merge/branch)
- Skaffold / Docker operations (rebuild/restart)
- Database migrations
- Dependency updates

## Production URLs

- **Auth**: https://auth.korczewski.de
- **L2P**: https://l2p.korczewski.de
- **Payment**: https://payment.korczewski.de (alias: https://shop.korczewski.de)
- **VideoVault**: https://videovault.korczewski.de (alias: https://video.korczewski.de)
- **Traefik**: https://traefik.korczewski.de

## Change Discipline

- Confirm target project before making changes
- Prefer small, targeted edits over sweeping refactors
- Match existing patterns and lint rules
- Do not add dependencies or change infrastructure without explicit approval
- Run the smallest relevant test suite for your change
- Update existing docs rather than creating new ones
- Always deploy changes to k3s after committing (don't leave changes undeployed)
- **Deploy with Skaffold** (`skaffold run -p <profile>`) for code changes — shell scripts only apply manifests without rebuilding images
