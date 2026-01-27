# Learn2Play

A multiplayer quiz platform with real-time gameplay, built with React, Express, Socket.io, and PostgreSQL.

## Features

- Real-time multiplayer quiz games via Socket.io
- JWT-based authentication with OAuth support (centralized auth service)
- Lobby system for creating and joining live sessions
- Question management with multiple categories and custom question sets
- Player progression: XP, leveling, character selection, badges
- Admin panel for user moderation and question management
- Comprehensive test suite: unit, integration, and E2E coverage
- Docker-based development and production deployments

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 18, TypeScript, Vite, Wouter, Tailwind CSS, Radix UI, Socket.io client, Zustand |
| Backend | Express, TypeScript, Socket.io, Drizzle ORM, PostgreSQL, Passport.js (JWT) |
| Testing | Jest (ESM), Testing Library, Playwright, Vitest |
| Infrastructure | Docker, PostgreSQL (shared), Redis, MailHog (dev) |

## Quick Start

### 1. Environment Setup

```bash
cp .env.example .env-dev
```

Edit `.env-dev` and fill in the required values (see Environment Configuration below).

### 2. Install Dependencies

```bash
npm run install:all
```

### 3. Database Setup

```bash
npm run deploy:dev       # Start shared PostgreSQL
npm run db:migrate       # Run migrations
```

### 4. Start Development

```bash
npm run dev:backend      # Terminal 1 — port 3001
npm run dev:frontend     # Terminal 2 — port 3000
```

Open http://localhost:3000.

## Environment Configuration

### File Structure

| File | Purpose | Committed |
|------|---------|-----------|
| `.env.example` | Template with all variables documented | Yes |
| `.env-dev` | Development environment | No |
| `.env-prod` | Production environment | No |

### Required Variables

```bash
# Database (centralized PostgreSQL)
DATABASE_URL=postgresql://l2p_user:PASSWORD@shared-postgres:5432/l2p_db
DB_HOST=shared-postgres
DB_PORT=5432
DB_NAME=l2p_db
DB_USER=l2p_user
DB_PASSWORD=<alphanumeric-only>

# Authentication
JWT_SECRET=<32-char-hex>          # openssl rand -hex 32
JWT_REFRESH_SECRET=<32-char-hex>  # openssl rand -hex 32

# Application URLs
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000,http://localhost:3002
```

### Production-Only Variables

```bash
COOKIE_DOMAIN=.korczewski.de
COOKIE_SECURE=true
L2P_NETWORK_EXTERNAL=true
FRONTEND_URL=https://l2p.korczewski.de
CORS_ORIGINS=https://l2p.korczewski.de
```

### Optional: Gemini AI

```bash
GEMINI_API_KEY=<your-key>     # https://aistudio.google.com/app/apikey
```

### Security Rules

- Never commit `.env-dev` or `.env-prod`.
- Use alphanumeric-only database passwords to avoid Docker/Postgres escaping issues.
- Generate DB passwords: `openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 32`
- JWT secrets must be at least 32 characters and unique per environment.
- Database credentials must match `shared-infrastructure/.env`.

## Development Commands

| Command | Purpose |
|---------|---------|
| `npm run dev:frontend` | Frontend dev server (port 3000) |
| `npm run dev:backend` | Backend dev server (port 3001) |
| `npm run build:all` | Build both packages |
| `npm run typecheck` | TypeScript check (both) |
| `npm run deploy:dev` | Start dev Docker stack |
| `npm run deploy:down` | Stop Docker stack |
| `npm run db:migrate` | Run database migrations |
| `npm run db:status` | Check migration status |

See `CLAUDE.md` for the complete command reference.

## Testing Guide

### Prerequisites

```bash
npm run install:all
npm run test:browsers:install    # Playwright browsers (E2E only)
```

### Infrastructure Setup

Tests run against Docker containers defined in `docker-compose.test.yml`. Set up the level of infrastructure you need before running tests.

| Command | Starts | Use For |
|---------|--------|---------|
| `npm run test:setup:db` | PostgreSQL | Unit tests needing a database |
| `npm run test:setup:backend` | PostgreSQL + Backend | Integration tests |
| `npm run test:setup:frontend` | PostgreSQL + Backend + Frontend | E2E tests |
| `npm run test:setup:status` | — | Check what is running |
| `npm run test:teardown` | — | Stop test services |
| `npm run test:teardown:clean` | — | Stop and remove volumes |

### Running Tests

```bash
# Unit tests (most need no infrastructure)
npm run test:unit

# Integration tests (requires test:setup:backend)
npm run test:integration

# E2E tests (requires test:setup:frontend)
npm run test:e2e
npm run test:e2e:headed          # With browser visible
npm run test:e2e:ui              # Interactive Playwright UI

# Everything
npm run test:all
```

### Running a Single Test

```bash
# Backend (ESM flag is mandatory)
cd backend
NODE_OPTIONS=--experimental-vm-modules npx jest src/services/AuthService.test.ts

# Frontend
cd frontend
NODE_ENV=test npx jest src/components/Login.test.tsx

# E2E
cd frontend/e2e
npx playwright test tests/login.spec.ts --headed
```

### Test Service URLs

| Service | URL | Notes |
|---------|-----|-------|
| Frontend (Docker) | http://localhost:3007 | E2E target |
| Backend API (Docker) | http://localhost:3006/api | Integration/E2E |
| Test PostgreSQL | localhost:5433 | Isolated from production |
| Redis | localhost:6380 | Session/cache |
| MailHog | http://localhost:8025 | Email testing UI |

### Key Testing Constraints

- **ESM flag**: All Jest tests require `NODE_OPTIONS=--experimental-vm-modules`.
- **Database isolation**: Test DB runs on port 5433; production on 5432. Never test against production.
- **Socket.io**: Integration tests must use real socket connections, not mocks.
- **Cleanup flags**: Integration tests use `--forceExit --detectOpenHandles` (pre-configured).
- **Test data naming**: Prefix all test data with `test_` for safe cleanup.
- **Memory**: Full backend suite may exhaust heap. Use `NODE_OPTIONS="--max-old-space-size=8192"` or run in batches.

### Troubleshooting Tests

| Problem | Solution |
|---------|----------|
| DB connection fails | Run `npm run test:setup:status`, then `npm run test:setup:db` |
| Backend health check fails | Check logs: `docker logs l2p-backend-test`, restart with `npm run test:teardown && npm run test:setup:backend` |
| Port conflict (5432, 3006, 3007) | Find process: `lsof -i :PORT`, stop it or adjust `docker-compose.test.yml` |
| Tests hang / don't exit | `npm run test:teardown:clean`, then `pkill -f jest` |
| Stale test data | `npm run test:teardown:clean` to reset volumes |
| Module resolution errors | Verify `NODE_OPTIONS=--experimental-vm-modules` is set |
| Heap out of memory | Run tests in smaller batches or increase `--max-old-space-size` |

### Coverage

```bash
npm run coverage:all             # Collect coverage
npm run coverage:report          # View HTML report
npm run coverage:badge           # Generate badge
```

## Database Guide

### Connection

L2P connects to the centralized PostgreSQL instance managed by `shared-infrastructure/`. Connection can be configured via `DATABASE_URL` or individual `DB_*` variables.

### Migrations

```bash
npm run db:migrate               # Apply pending migrations
npm run db:status                # Show migration state
npm run db:validate              # Validate schema
npm run db:rollback              # Rollback last migration
npm run db:rollback 20240101_000001  # Rollback to specific migration
```

Migration CLI source: `backend/src/cli/database.ts`.

### Health Endpoints

- `GET /health` — Application health
- `GET /health/database` — Database connectivity
- `GET /api/database/test` — Full database test

## Architecture Overview

### Three-Layer Backend

```
Routes (HTTP/WS) -> Services (business logic) -> Repositories (DB via Drizzle)
```

- **Routes** handle request parsing, validation, and response formatting.
- **Services** contain all business logic; no direct database access.
- **Repositories** encapsulate all database queries via Drizzle ORM.

### Frontend Architecture

- **Pages**: Route-level container components (HomePage, LobbyPage, GamePage, ResultsPage).
- **Components**: Reusable, presentational UI widgets.
- **Stores**: Zustand for state management (auth, game, settings, theme).
- **Services**: `apiService.ts` for REST, Socket.io client for real-time events.

### Real-Time Communication

Socket.io handles all multiplayer features. The backend `SocketService` manages connections and broadcasts game events (lobby updates, question delivery, answer collection, score sync). The frontend connects via `socket.io-client` in the service layer.

### OAuth Integration

Users authenticated via the centralized auth service may not exist in the L2P local database. The lobby creation flow uses JWT token data directly (username, character, level) rather than requiring a local database lookup, with a fallback to `GameProfileService` and then local user lookup for legacy accounts.

## Deployment

### Development

```bash
npm run deploy:dev               # Start containers
npm run deploy:logs              # Tail logs
npm run deploy:down              # Stop
```

### Production

```bash
cp .env-prod .env                # Deploy script reads .env
npm run deploy:prod              # Start production stack
npm run stop                     # Stop production
./scripts/rebuild.sh             # Full rebuild
```

Verify deployment:
```bash
docker ps | grep l2p
docker logs l2p-api --tail 50
```

### Production URLs

- Frontend: https://l2p.korczewski.de
- Auth: https://auth.korczewski.de

## Project Structure

```
l2p/
├── backend/               # Express + TypeScript API server
├── frontend/              # React + Vite application
├── config/                # Environment templates, linting presets
├── scripts/               # Helper scripts (DB, deploy, CI, test runner)
├── database/              # SQL migrations and seed data
├── docker-compose.yml     # Dev/production containers
├── docker-compose.test.yml# Test infrastructure
└── package.json           # Workspace root with all npm scripts
```

Shared tooling lives at `../shared-infrastructure/shared/l2p/` (error handling, test config, test utilities).

## Contributing

- Frontend components go in `frontend/src/components/`, route pages in `frontend/src/pages/`.
- Backend routes in `backend/src/routes/`, logic in `backend/src/services/`, data access in `backend/src/repositories/`.
- Tests live in `__tests__/` folders adjacent to the code they test.
- Run `npm run typecheck && npm run test:all` before committing.
- Prefer small, targeted edits over sweeping refactors.
- Match existing patterns and naming conventions.
