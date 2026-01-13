# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a monorepo containing independent full-stack applications sharing centralized infrastructure:

- **l2p/** - Multiplayer quiz platform (React, Express, Socket.io, PostgreSQL)
- **VideoVault/** - Client-first video management (React, Vite, File System Access API)
- **payment/** - Payment platform with Stripe (Next.js 16, Prisma, NextAuth)
- **vllm/** - MCP server for AI inference and analysis (TypeScript, vLLM, PostgreSQL)
- **auth/** - Unified authentication service (Node, JWT, OAuth, PostgreSQL)
- **reverse-proxy/** - Traefik routing and TLS
- **shared-infrastructure/** - Centralized PostgreSQL instance with isolated databases per service

## Common Commands

### Root-Level Operations

```bash
# Install all dependencies
npm run install:all

# Build all projects
npm run build:all

# Run all services in development
npm run dev:all

# Test all projects
npm run test:all

# Validate environment files
npm run validate:env
npm run validate:env:dev
npm run validate:env:prod
```

### L2P (Learn2Play)

```bash
cd l2p

# Development
npm run dev:backend          # Start backend on port 3001
npm run dev:frontend         # Start frontend on port 3000

# Build
npm run build:all
npm run build:frontend
npm run build:backend

# Testing
npm run test:all             # Full test suite
npm run test:unit            # Unit tests (frontend + backend)
npm run test:integration     # Integration tests
npm run test:e2e             # Playwright E2E tests
npm run test:watch           # Watch mode for unit tests

# Single-project tests
npm run test:unit:frontend
npm run test:unit:backend
npm run test:integration:frontend
npm run test:integration:backend

# Type checking
npm run typecheck

# Database
npm run db:migrate           # Run migrations
npm run db:status            # Check migration status
npm run db:health            # Database health check

# Docker deployment
npm run deploy:dev           # Development stack
npm run deploy:prod          # Production stack
npm run deploy:logs          # View logs
npm run deploy:down          # Stop containers
```

### VideoVault

```bash
cd VideoVault

# Development
npm run dev                  # Local dev server (port 5100)
npm run docker:dev           # Docker dev with hot reload (port 5000)
npm run docker:down          # Stop environment
npm run docker:restart       # Restart environment
npm run docker:logs          # View logs

# Testing
npm run check                # TypeScript checking
npm run test:all             # Full 6-stage test pipeline
npm run test:client          # Client tests only
npm run test:server          # Server tests only
npm run test:e2e             # Integration tests
npm run docker:pw:all        # Playwright E2E tests

# Build & Production
npm run build
npm run start                # Production server
```

### Payment

```bash
cd payment

# Development
npm run dev                  # Next.js dev server (port 3004)

# Build & Production
npm run build
npm run start

# Testing
npm test
npm run test:e2e
npm run lint

# Prisma
npx prisma migrate dev       # Development migrations
npx prisma migrate deploy    # Production migrations
npx prisma studio            # Database GUI
```

### VLLM

```bash
cd vllm

# Build MCP server
npm install
npm run build

# Development
npm run dev:watch

# Dashboard
cd dashboard
node server.js               # Port 4242

# RAG stack
./scripts/start_rag.sh       # Start full RAG environment

# Deployment
bash scripts/deploy.sh       # Deploy vLLM container
```

### Auth

```bash
cd auth

# Docker
docker-compose --env-file .env-dev up -d
docker-compose down
```

### Shared Infrastructure

```bash
cd shared-infrastructure

# Start centralized Postgres
docker-compose up -d
docker-compose down

# Or use root scripts
../scripts/start-all-services.sh
../scripts/stop-all-services.sh
```

## Architecture & Code Organization

### Centralized Database Architecture

All services connect to a single PostgreSQL instance (`shared-postgres`) with isolated databases:
- `auth_db` (user: `auth_user`)
- `l2p_db` (user: `l2p_user`)
- `payment_db` (user: `payment_user`)
- `videovault_db` (user: `videovault_user`)

**Critical**: Always start `shared-infrastructure` before other services. Connection strings use `shared-postgres:5432/<db_name>`.

### L2P Structure

**Workspace-based monorepo** with `frontend/` and `backend/` workspaces:

Backend (`backend/src/`):
- `routes/` - HTTP endpoints (auth, admin, lobbies, game, etc.)
- `services/` - Domain logic (AuthService, LobbyService, GameService, etc.)
- `repositories/` - Data access layer (UserRepository, LobbyRepository, etc.)
- `middleware/` - Express middleware (auth, validation, rate limiting, error handling)
- `cli/` - Command-line utilities (database migrations, testing tools)
- `__tests__/` - Jest tests (unit/, integration/, e2e/)

Frontend (`frontend/src/`):
- `components/` - Reusable UI components (PascalCase naming)
- `pages/` - Route-level screens (Login, Lobby, Game, etc.)
- `services/` - API clients and domain helpers (apiService.ts for REST, Socket.io client)
- `hooks/` - Custom React hooks (useThing naming convention)
- `stores/` - Zustand state management stores
- `__tests__/` - Jest + Testing Library tests

**Real-time architecture**: Backend uses Socket.io for live gameplay. Frontend connects via `socket.io-client`. Game state synchronized through WebSocket events.

**Testing architecture**:
- Jest with ESM modules (`NODE_OPTIONS=--experimental-vm-modules`)
- Separate test databases on port 5433 to avoid interference
- Integration tests use Supertest for HTTP and real Socket.io connections
- E2E tests use Playwright with Docker test stack

### VideoVault Structure

**Client-first architecture** using File System Access API:

Client (`client/src/`):
- `components/` - React components (video player, grid, filters)
- `services/` - Core business logic (VideoDatabase, FileScanner, FilterEngine, BulkOperationsService)
- `hooks/` - useVideoManager orchestrates all services

Server (`server/`):
- Express server with Vite dev middleware
- Optional Postgres persistence (falls back to in-memory)
- Drizzle ORM schema in `server/db/`

**Key constraint**: Requires Chromium-based browsers for File System Access API. File handles are session-based; rescan required after reload.

### Payment Structure

**Next.js App Router** with:
- `app/` - Next.js 16 App Router pages
- `prisma/` - Database schema and migrations
- `test/` - Vitest + Playwright tests

**Auth integration**: Uses NextAuth v5 and integrates with centralized auth service.

### VLLM Structure

**MCP Server** communicating via stdio:
- `src/` - TypeScript tool handlers
- `tests/` - Jest tests
- `dashboard/` - Control panel for vLLM/Forge/Infinity containers
- `rag/` - RAG stack (Qdrant, LlamaIndex, Open WebUI)

**Tool architecture**: MCP tools call vLLM API via Axios, database tools use PostgreSQL for Open-WebUI queries (SELECT-only for security).

## Testing Strategy

### L2P Testing

**Unit tests** (`npm run test:unit`):
- Run with `NODE_OPTIONS=--experimental-vm-modules`
- Backend: Service and utility tests
- Frontend: Component and hook tests with Testing Library
- No external dependencies; mocked services

**Integration tests** (`npm run test:integration`):
- Real Express server via Supertest
- Real Socket.io connections
- Test database on port 5433
- Require `--forceExit --detectOpenHandles`

**E2E tests** (`npm run test:e2e`):
- Playwright in `frontend/e2e/`
- Full Docker test stack: `npm run deploy:dev`
- Tests hit http://localhost:3000 (local) or http://localhost:3007 (Docker)

**Test one file**:
```bash
# Backend unit test
cd backend
NODE_OPTIONS=--experimental-vm-modules npx jest src/services/AuthService.test.ts

# Frontend unit test
cd frontend
NODE_ENV=test npx jest src/components/Login.test.tsx

# Integration test
cd backend
NODE_OPTIONS=--experimental-vm-modules npx jest src/__tests__/integration/auth.test.ts

# Single E2E spec
cd frontend/e2e
npx playwright test tests/login.spec.ts
```

### VideoVault Testing

```bash
# Unit tests
npm test

# Single test file
npm run test -- client/src/services/VideoDatabase.test.ts

# E2E with Docker
npm run docker:pw:all
```

### Payment Testing

```bash
# All tests
npm test

# E2E
npm run test:e2e
```

## Environment Configuration

**Structure**: Each service uses `.env.example`, `.env-dev`, `.env-prod`.

**Critical rules**:
1. Never commit `.env-dev` or `.env-prod`
2. Use **alphanumeric-only** database passwords (avoid Docker/Postgres escaping issues)
3. Secrets must be unique per environment
4. Generate secrets: `openssl rand -hex 32`
5. Generate DB passwords: `openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 32`

**Shared infrastructure precedence**: Database credentials in `shared-infrastructure/.env` must match each service's `.env` file.

### L2P Environment

Required:
- `DATABASE_URL=postgresql://l2p_user:<password>@shared-postgres:5432/l2p_db`
- `JWT_SECRET`, `JWT_REFRESH_SECRET` (32-char hex)
- `FRONTEND_URL` (dev: `http://localhost:3000`, prod: `https://l2p.korczewski.de`)
- `CORS_ORIGINS` (comma-separated)


Production-only:
- `COOKIE_DOMAIN=.korczewski.de`
- `COOKIE_SECURE=true`

### Auth Environment

Required:
- `DATABASE_URL=postgresql://auth_user:<password>@shared-postgres:5432/auth_db`
- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `SESSION_SECRET` (32-char hex each)
- SMTP settings
- Google OAuth client ID and secret

### Payment Environment

Required:
- `DATABASE_URL=postgresql://payment_user:<password>@shared-postgres:5432/payment_db?schema=public`
- `NEXTAUTH_SECRET`, `AUTH_SECRET` (32-char hex)
- `NEXTAUTH_URL` (dev: `http://localhost:3004`, prod: `https://payment.korczewski.de`)
- Stripe API keys and webhook secret

### VideoVault Environment

Required:
- `SESSION_SECRET` (32-char hex)
- `ADMIN_PASS`
- `MEDIA_ROOT` (path to video library)
- `DATABASE_URL` (optional Postgres persistence)

## Multi-Agent Coordination

If multiple Claude instances are working simultaneously:

1. **Task declaration**: Update `.agent-tasks.md` at repo root
   - Format: `[YYYY-MM-DD HH:MM] [project-name] [IN_PROGRESS|BLOCKED|DONE] Description`
   - Include specific files/subsystems being modified

2. **Project isolation**: Prefer working in different projects (l2p vs vllm vs payment)

3. **Critical sections** (require exclusive access):
   - Git operations (commit/merge/branch)
   - Docker operations (rebuild/restart)
   - Database migrations
   - Dependency updates
   - Root-level changes
   - Deployments

4. **Conflict resolution**: Mark as `[BLOCKED]` and yield to active operations

## Important Patterns & Constraints

### L2P Constraints

- **ESM modules**: All Jest tests require `NODE_OPTIONS=--experimental-vm-modules`
- **Test isolation**: Integration tests use separate database on port 5433
- **Socket.io testing**: Must use real socket connections, not mocks
- **Database**: Production uses centralized Postgres; test DB stays isolated
- **Migrations**: Run via `npm run db:migrate` from backend

### VideoVault Constraints

- **Browser dependency**: Chromium-based browsers only for File System Access API
- **Session-based handles**: File access lost on reload; requires rescan
- **Storage**: Primary persistence is localStorage; Postgres optional
- **Thumbnails**: Generated on-demand, not persisted (quota management)

### Payment Constraints

- **Prisma requirement**: All migrations need valid `DATABASE_URL`
- **NextAuth**: Requires `NEXTAUTH_SECRET` and `NEXTAUTH_URL`
- **Stripe webhooks**: Must configure `STRIPE_WEBHOOK_SECRET`

### VLLM Constraints

- **Database tools**: Only SELECT queries allowed (security constraint)
- **MCP config**: Absolute paths required in Claude Desktop config
- **GPU**: Recommended for optimal vLLM performance

## Code Style

- **TypeScript** across all projects
- **2-space indentation**, single quotes preferred
- **React components**: PascalCase
- **Hooks**: `useThing` naming
- **Tests**: Colocated in `__tests__/` directories
- **VideoVault**: Uses Prettier (`.prettierrc.json`)
- Other projects: ESLint only

## Documentation & Task Tracking

- **Root README.md**: Project overview and guidelines
- **TASKS.md**: Active tasks and checklists
- **docs/**: Consolidated documentation
- **Project READMEs**: Service-specific documentation in each directory
