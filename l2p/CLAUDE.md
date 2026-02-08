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

**Use Skaffold for code changes** (builds images + deploys):
```bash
cd ../../k8s && skaffold run -p l2p        # Build + deploy L2P (backend + frontend)
cd ../../k8s && skaffold run               # Build + deploy everything
```

Shell scripts only apply manifests (no image rebuild):
```bash
../../k8s/scripts/deploy/deploy-l2p.sh     # Manifest-only (use for config changes)
```

See `k8s/services/l2p-backend/` and `k8s/services/l2p-frontend/` for manifests. Skaffold config at `k8s/skaffold.yaml`.

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
│       ├── stores/              # Zustand (8 stores, see Architecture below)
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

**Backend Services** (`services/`):

| Service | Responsibility |
|---------|----------------|
| AuthService | Login, register, JWT tokens, password reset |
| LobbyService | Lobby CRUD, player join/leave |
| GameService | Game session orchestration, question delivery, answer processing |
| SocketService | WebSocket connection management, real-time events |
| QuestionService | Question and question set retrieval |
| ScoringService | Score calculation with perk modifiers, XP awards |
| HallOfFameService | Leaderboard management |
| CharacterService | Character selection, level/XP tracking, perk unlock progression |
| PerkDraftService | Draft-based perk selection, skill tree management |
| PerkEffectEngine | Perk effect calculation and application to gameplay |
| PerksManager | Perk activation/deactivation, user active settings |
| EmailService | SMTP for verification and password reset |
| DatabaseService | PostgreSQL connection pooling singleton |
| MigrationService | Database migration runner |
| FileProcessingService | DOCX/HTML processing for question generation |
| GeminiService | Google Gemini AI integration for question generation |
| OAuthService | OAuth integration with centralized auth service |
| GameProfileService | OAuth user game profile CRUD |
| CleanupService | Periodic cleanup of inactive lobbies |

### Frontend Patterns

- **Pages** are route-level container components
- **Components** are reusable and presentational
- **API calls** only through `services/apiService.ts`
- **State** only through Zustand stores
- **Socket.io** client initialized in service layer

**Zustand Stores** (`stores/`):

| Store | State Managed |
|-------|---------------|
| authStore | User authentication (user, token, login/logout) |
| gameStore | Active game state (question, players, scores, timers, perk drafts) |
| settingsStore | User preferences (theme, language, animations) |
| themeStore | Theme management (light/dark/auto, system detection) |
| audioStore | Audio settings (volume, mute, sound effects) |
| characterStore | Character selection, level/XP progress |
| fileUploadStore | File upload progress (question generation) |
| perkDraftStore | Perk draft state (pending drafts, history, active perks, skill tree) |

### Real-Time (Socket.io)

Backend: `SocketService.ts` manages connections. Integration tests must use real socket connections (no mocks).

**Client → Server events:**
`join-lobby`, `leave-lobby`, `player-ready`, `start-game`, `submit-answer`, `update-question-sets`, `get-question-set-info`, `perk:pick`, `perk:dump`, `ping`

**Server → Client events:**
`connected`, `join-success`, `join-error`, `lobby-updated`, `lobby-deleted`, `leave-success`, `leave-error`, `ready-error`, `game-started`, `start-game-error`, `question-started`, `answer-error`, `question-sets-updated`, `question-sets-update-success`, `question-sets-update-error`, `question-set-info`, `question-set-info-error`, `perk:draft-result`, `perk:pool-exhausted`, `pong`

Error events follow the pattern `{action}-error` (e.g., `join-error`, `start-game-error`).

### Authentication (Dual-Auth Pattern)

L2P has two auth layers that must stay in sync:
- **apiService** (localStorage): `auth_token`, `user_data` — used for HTTP requests
- **Zustand authStore**: `user`, `token` — used by React components for rendering
- **AuthGuard** bridges the two — must call BOTH `setUser()` AND `setToken()` for all auth paths
- Session-cookie auth (unified mode via `VITE_AUTH_SERVICE_URL`) uses `setToken('session')` as sentinel

If only one layer is updated, components like PerksManager silently fail to render.

### Lobby Join (Two-Phase)

Lobby join requires both phases:
1. **REST API** (`apiService.getLobby()`): Persistence — loads player list, determines host
2. **Socket.io** (`emit('join-lobby', ...)`): Real-time — joins socket room for live updates

Without phase 1, player list is empty on page load. Without phase 2, no real-time updates.

### Perk System (Draft-Based)

Perks use a draft system where players pick perks from random pools at level-up:
- 40 gameplay perks across 5 categories: Time, Information, Scoring, Recovery, XP
- `PerkDraftService` manages draft pools and choices
- `PerkEffectEngine` applies perk effects during gameplay
- `PerksManager` handles activation/deactivation (cosmetic config: avatar, theme, badge)
- A perk is "unlocked" when `chosen_perk_id IS NOT NULL` in `user_perk_drafts`
- All chosen draft perks are gameplay-active; "activate" is only for cosmetic configuration

### Database

- Production: `shared-postgres:5432/l2p_db` (centralized PostgreSQL)
- Test: port 5433 (isolated)
- Schema: Drizzle ORM; migrations in `backend/migrations/`; CLI via `backend/src/cli/database.ts`
- **API returns snake_case** column names (`host_id`, `selected_character`), frontend types use camelCase — always check actual response shape

**Tables:**
`users`, `user_game_profiles`, `user_migration_mapping`, `lobbies` (players stored as JSONB), `game_sessions`, `player_results`, `hall_of_fame`, `questions`, `question_sets`, `perks`, `user_perks`, `user_perk_drafts`, `health_check`

**Views:** `question_set_leaderboards`, `overall_leaderboard`, `experience_leaderboard`

## Critical Constraints

### Testing (non-negotiable)

1. **ESM flag required**: ALL Jest tests need `NODE_OPTIONS=--experimental-vm-modules`. Without it, module resolution fails.
2. **Test DB isolation**: Integration tests use port 5433. Never test against production (port 5432). Test data prefixed with `test_`.
3. **Socket.io in integration tests**: Use real `socket.io-client` connections, not mocks. Tests must close connections in cleanup.
4. **Jest cleanup flags**: Integration tests require `--forceExit --detectOpenHandles` (configured in package.json).
5. **Memory**: Full backend suite can exhaust heap. Run batches or use `NODE_OPTIONS="--max-old-space-size=8192"`.
6. **resetMocks: true**: Both frontend and backend configs reset mocks between tests. In `jest.mock()` factories, use plain functions (not `jest.fn(() => value)`) — `resetMocks` clears `jest.fn()` implementations before tests run.
7. **Fake timers with setInterval**: Never use `jest.runAllTimersAsync()` on code with `setInterval` — it loops forever. Use `jest.advanceTimersByTime(ms)` + `await Promise.resolve()` instead.
8. **Falsy zero in options**: `options.value || defaultValue` treats `0` as falsy. Watch for this pattern when writing tests with numeric config values.

### Code Organization

- Routes handle HTTP only, delegate to services
- Services contain all business logic
- Repositories are the only layer that queries the database
- No database queries in routes or services directly
- Perk activation/deactivation queries must use `user_perk_drafts` table (not legacy `user_perks`)

### Naming Conventions

- React components: `PascalCase`
- Hooks: `useThing`
- Stores: `thingStore.ts`
- Test files: `*.test.ts` / `*.test.tsx`
- Test data: prefix with `test_`

## Test Suite Stats

- **Frontend**: 53 suites, 906 tests (Jest + jsdom)
- **Backend**: 30 suites, 967 tests (Jest + node, ESM)
- **E2E**: Playwright (chromium + integration projects)

## Test Debugging

**Failed unit test**: Check ESM flag (backend), check mock setup (`resetMocks: true` clears implementations), run single file to isolate.

**Failed integration test**: Check test DB on port 5433 is running. Verify ESM flag. Look for unclosed socket connections. Review teardown.

**Failed E2E test**: Run headed (`npm run test:e2e:headed`) or UI mode (`npm run test:e2e:ui`). Verify test stack via `npm run test:setup:status`. Check ports 3000/3001 (local) or 3007/3006 (Docker).

**OOM crash**: Run frontend and backend separately (`test:unit:frontend` then `test:unit:backend`), or increase heap with `--max-old-space-size=8192`.

**Post-test process crash**: GameService timer callbacks may fire during Jest teardown. This is not a test failure — all tests pass. Run GameService in a separate batch if it blocks other suites.

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
