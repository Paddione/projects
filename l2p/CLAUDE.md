# CLAUDE.md

Guidance for Claude Code when working in the l2p project.

## Overview

Learn2Play (L2P) is a multiplayer quiz platform: React 18 + Vite frontend, Express + Socket.io backend, PostgreSQL via Drizzle ORM. Workspace monorepo with `frontend/` and `backend/` packages.

## Commands

### Development

```bash
npm run install:all              # Install all dependencies
npm run dev:frontend             # Frontend on port 3000
npm run dev:backend              # Backend on port 3001
npm run dev:backend:tsx          # Backend with tsx watch mode
npm run build:all                # Build frontend + backend
npm run build:frontend
npm run build:backend
npm run typecheck                # Typecheck both packages
npm run typecheck:strict         # Strict mode
```

### Testing — Infrastructure Setup

```bash
npm run test:setup:db            # PostgreSQL only (unit tests)
npm run test:setup:backend       # PostgreSQL + backend (integration)
npm run test:setup:frontend      # Full stack (E2E)
npm run test:setup               # Alias for full setup
npm run test:setup:status        # Check running services
npm run test:teardown            # Stop infrastructure
npm run test:teardown:clean      # Stop + remove volumes
npm run test:browsers:install    # Install Playwright browsers
```

### Testing — Run

```bash
npm run test:unit                # All unit tests
npm run test:unit:frontend
npm run test:unit:backend
npm run test:watch               # Watch mode
npm run test:integration         # All integration tests
npm run test:integration:frontend
npm run test:integration:backend
npm run test:e2e                 # Playwright E2E
npm run test:e2e:headed          # With browser UI
npm run test:e2e:ui              # Interactive mode
npm run test:all                 # Full suite
npm run test:all:ci              # CI mode
npm run test:all:pipeline        # Typecheck + all tests
npm run test:coverage            # Generate coverage
npm run coverage:all             # Full coverage suite
npm run coverage:report          # View report
npm run coverage:badge           # Generate badge
```

### Single Test Files

```bash
# Backend unit test
cd backend
NODE_OPTIONS=--experimental-vm-modules npx jest src/services/AuthService.test.ts

# Frontend unit test
cd frontend
NODE_ENV=test npx jest src/components/Login.test.tsx

# Backend integration test
cd backend
NODE_OPTIONS=--experimental-vm-modules npx jest src/__tests__/integration/auth.test.ts

# Single E2E spec
cd frontend/e2e
npx playwright test tests/login.spec.ts
```

### Database

```bash
npm run db:migrate               # Run migrations
npm run db:status                # Migration status
npm run db:health                # Health check
npm run db:validate              # Validate schema

# From backend/ directory
cd backend
npm run db:migrate
npm run db:rollback
npm run db:test
```

### Local Docker (development only)

```bash
npm run deploy:dev               # Start local dev stack (Docker Compose)
npm run deploy:logs              # View logs
npm run deploy:down              # Stop containers
```

### Production Deployment (k3s)

Production runs on k3s (lightweight Kubernetes), NOT Docker Compose. Never use `docker-compose` or `npm run deploy:prod` to deploy to production.

```bash
# Deploy L2P to k3s cluster
../../k8s/scripts/deploy/deploy-l2p.sh

# Or deploy everything
../../k8s/scripts/deploy/deploy-all.sh
```

See `k8s/services/l2p-backend/` and `k8s/services/l2p-frontend/` for manifests.

## Project Structure

```
l2p/
├── backend/
│   └── src/
│       ├── routes/              # HTTP endpoints (auth, admin, lobbies, game, etc.)
│       ├── services/            # Business logic (Auth, Lobby, Game, Socket, Scoring, etc.)
│       ├── repositories/        # Data access (User, Lobby, Question, GameSession, etc.)
│       ├── middleware/          # Auth, validation, rate limiting, error handling
│       ├── cli/                 # Database migrations, tooling
│       ├── __tests__/           # unit/, integration/, e2e/
│       ├── utils/
│       └── types/
├── frontend/
│   └── src/
│       ├── components/          # Reusable UI (PascalCase)
│       ├── pages/               # Route screens (Home, Lobby, Game, Results)
│       ├── services/            # API client (apiService.ts), Socket.io client
│       ├── hooks/               # Custom hooks (useThing)
│       ├── stores/              # Zustand (authStore, gameStore, settingsStore, themeStore)
│       ├── __tests__/
│       └── utils/
│   └── e2e/
│       ├── tests/               # Playwright specs
│       ├── page-objects/
│       └── fixtures/
├── scripts/                     # DB, deployment, CI helpers
├── database/                    # SQL migrations and seed data
├── config/                      # Env templates, tooling presets
├── docker-compose.yml           # Production/dev
├── docker-compose.test.yml      # Test stack
└── package.json                 # Workspace root
```

Shared utilities: `../shared-infrastructure/shared/l2p/` (error-handling, test-config, test-utils).

## Architecture

### Three-Layer Backend

1. **Routes** (`routes/`): HTTP/WebSocket endpoints only. Delegate to services.
2. **Services** (`services/`): All business logic. No direct DB queries.
3. **Repositories** (`repositories/`): All database access via Drizzle ORM. Extend `BaseRepository`.

Key services: `AuthService`, `LobbyService`, `GameService`, `SocketService`, `QuestionService`, `ScoringService`, `EmailService`, `HallOfFameService`.

### Frontend Patterns

- **Pages** are route-level container components
- **Components** are reusable and presentational
- **API calls** only through `services/apiService.ts`
- **State** only through Zustand stores
- **Socket.io** client initialized in service layer

### Real-Time (Socket.io)

- Backend: `SocketService.ts` manages connections
- Events: `lobby:created`, `lobby:joined`, `player:left`, `game:started`, `question:sent`, `answer:received`, `game:ended`
- Integration tests must use real socket connections (no mocks)

### Database

- Production: `shared-postgres:5432/l2p_db` (centralized PostgreSQL)
- Test: port 5433 (isolated)
- Schema: Drizzle ORM; migrations via `backend/src/cli/database.ts`
- Key tables: `users`, `players`, `lobbies`, `game_sessions`, `questions`, `question_sets`

## Critical Constraints

### Testing (non-negotiable)

1. **ESM flag required**: ALL Jest tests need `NODE_OPTIONS=--experimental-vm-modules`. Without it, module resolution fails.
2. **Test DB isolation**: Integration tests use port 5433. Never test against production (port 5432). Test data prefixed with `test_`.
3. **Socket.io in integration tests**: Use real `socket.io-client` connections, not mocks. Tests must close connections in cleanup.
4. **Jest cleanup flags**: Integration tests require `--forceExit --detectOpenHandles` (configured in package.json).
5. **Memory**: Full backend suite can exhaust heap. Run batches or use `NODE_OPTIONS="--max-old-space-size=8192"`.

### Code Organization

- Routes handle HTTP only, delegate to services
- Services contain all business logic
- Repositories are the only layer that queries the database
- No database queries in routes or services directly

### Naming Conventions

- React components: `PascalCase`
- Hooks: `useThing`
- Stores: `thingStore.ts`
- Test files: `*.test.ts` / `*.test.tsx`
- Test data: prefix with `test_`

## Test Debugging

**Failed integration test**: Check test DB on port 5433 is running. Verify ESM flag. Look for unclosed socket connections. Review teardown.

**Failed E2E test**: Run headed (`npm run test:e2e:headed`) or UI mode (`npm run test:e2e:ui`). Verify test stack via `npm run test:setup:status`. Check ports 3000/3001 (local) or 3007/3006 (Docker).

## Test Ports Reference

| Service          | Local       | Docker Test |
|------------------|-------------|-------------|
| Frontend         | :3000       | :3007       |
| Backend API      | :3001/api   | :3006/api   |
| Test Postgres    | :5433       | :5432       |
| Redis            | —           | :6380       |
| MailHog          | —           | :8025       |

## Important Files

- `package.json` — workspace root, all npm scripts
- `jest.config.js` — multi-project Jest config
- `docker-compose.yml` / `docker-compose.test.yml`
- `scripts/rebuild.sh`, `scripts/test-runner.sh`, `scripts/deploy.sh`
- `backend/src/cli/database.ts` — DB CLI tool
- `frontend/e2e/playwright.config.ts` — E2E config
- `../shared-infrastructure/shared/l2p/test-config/test-config.yml`
