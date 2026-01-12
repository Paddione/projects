# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

Learn2Play is a multiplayer quiz platform with real-time gameplay, built as a workspace-based monorepo with independent frontend and backend packages.

**Tech Stack**:
- **Frontend**: React 18, TypeScript, Vite, Wouter routing, Tailwind CSS, Radix UI, Socket.io client, Zustand
- **Backend**: Express, TypeScript, Socket.io, Drizzle ORM, PostgreSQL, Passport.js (JWT)
- **Testing**: Jest (ESM), Testing Library, Playwright (E2E), Vitest

## Common Commands

### Development

```bash
# Install dependencies
npm run install:all

# Start development servers
npm run dev:backend          # Backend on port 3001
npm run dev:frontend         # Frontend on port 3000
npm run dev:backend:tsx      # Backend with tsx watch mode

# Build
npm run build:all            # Build both frontend and backend
npm run build:frontend
npm run build:backend

# Type checking
npm run typecheck            # Check both
npm run typecheck:strict     # Strict mode
```

### Testing

**Unit Tests**:
```bash
npm run test:unit                 # All unit tests
npm run test:unit:frontend
npm run test:unit:backend
npm run test:watch                # Watch mode for unit tests
```

**Integration Tests**:
```bash
npm run test:integration          # All integration tests
npm run test:integration:frontend
npm run test:integration:backend
```

**E2E Tests**:
```bash
npm run test:browsers:install     # Install Playwright browsers
npm run test:e2e                  # Run E2E suite
npm run test:e2e:headed           # With browser UI
npm run test:e2e:ui               # Interactive mode
```

**Full Test Suite**:
```bash
npm run test:all                  # All tests
npm run test:all:ci               # CI mode
npm run test:all:pipeline         # Typecheck + all tests
```

**Single Test File**:
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

### Database

```bash
npm run db:migrate               # Run migrations
npm run db:status                # Migration status
npm run db:health                # Health check
npm run db:validate              # Validate schema

# CLI commands (from backend directory)
cd backend
npm run db:migrate
npm run db:rollback
npm run db:test
```

### Deployment

```bash
# Development
npm run deploy:dev               # Start dev stack
npm run deploy:logs              # View logs
npm run deploy:down              # Stop containers

# Production
npm run deploy:prod
npm run stop

# Rebuild
./scripts/rebuild.sh
```

### Coverage

```bash
npm run test:coverage            # Generate coverage
npm run coverage:all             # Full coverage suite
npm run coverage:report          # View coverage report
npm run coverage:badge           # Generate badge
```

## Project Structure

```
l2p/
├── backend/                # Express + TypeScript API
│   ├── src/
│   │   ├── routes/        # HTTP endpoints (auth, admin, lobbies, game, etc.)
│   │   ├── services/      # Domain logic (AuthService, LobbyService, GameService, etc.)
│   │   ├── repositories/  # Data access layer (UserRepository, LobbyRepository, etc.)
│   │   ├── middleware/    # Express middleware (auth, validation, rate limiting, error handling)
│   │   ├── cli/           # Command-line utilities (database migrations, testing tools)
│   │   ├── __tests__/     # Jest tests (unit/, integration/, e2e/)
│   │   ├── utils/         # Shared utilities
│   │   └── types/         # Type declarations
│   └── package.json
├── frontend/              # React + Vite application
│   ├── src/
│   │   ├── components/    # Reusable UI components (PascalCase)
│   │   ├── pages/         # Route-level screens (Login, Lobby, Game, etc.)
│   │   ├── services/      # API clients and domain helpers (apiService.ts for REST)
│   │   ├── hooks/         # Custom React hooks (useThing naming)
│   │   ├── stores/        # Zustand state management stores
│   │   ├── __tests__/     # Jest + Testing Library tests
│   │   └── utils/         # Shared utilities
│   ├── e2e/               # Playwright E2E tests
│   │   ├── tests/         # Test specs
│   │   ├── page-objects/  # Page object models
│   │   └── fixtures/      # Test fixtures
│   └── package.json
├── shared/                # Cross-package utilities
│   ├── error-handling/    # Centralized error handling
│   ├── test-config/       # Test configuration system
│   └── test-utils/        # Test utilities
├── scripts/               # Helper scripts (DB, deployment, CI)
├── database/              # SQL migrations and seed data
├── config/                # Environment templates and tooling presets
└── package.json           # Workspace root
```

## Architecture

### Backend Architecture

**Three-Layer Architecture**:

1. **Routes** (`backend/src/routes/`): HTTP endpoints and request handling
   - `auth.ts`: Authentication (login, register, password reset)
   - `lobbies.ts`: Lobby management (create, join, leave)
   - `questions.ts`: Question retrieval for gameplay
   - `question-management.ts`: Admin question CRUD
   - `admin.ts`: Admin operations
   - `hall-of-fame.ts`: Leaderboards

2. **Services** (`backend/src/services/`): Business logic and domain operations
   - `AuthService.ts`: User authentication and JWT management
   - `LobbyService.ts`: Lobby lifecycle and player management
   - `GameService.ts`: Game state management and question flow
   - `SocketService.ts`: Real-time Socket.io event handling
   - `QuestionService.ts`: Question selection and validation
   - `ScoringService.ts`: Score calculation and XP/leveling
   - `EmailService.ts`: Email notifications (password reset)
   - `HallOfFameService.ts`: Leaderboard aggregation

3. **Repositories** (`backend/src/repositories/`): Data access abstractions
   - `UserRepository.ts`: User CRUD and authentication queries
   - `LobbyRepository.ts`: Lobby persistence
   - `QuestionRepository.ts`: Question querying and filtering
   - `GameSessionRepository.ts`: Game session tracking
   - `HallOfFameRepository.ts`: Leaderboard data access
   - `BaseRepository.ts`: Common database operations

### Frontend Architecture

**Component Structure**:
- **Pages** (`frontend/src/pages/`): Top-level route components (HomePage, LobbyPage, GamePage, ResultsPage)
- **Components** (`frontend/src/components/`): Reusable UI components
- **Stores** (`frontend/src/stores/`): Zustand state management
  - `authStore.ts`: Authentication state
  - `gameStore.ts`: Game state
  - `settingsStore.ts`: User preferences
  - `themeStore.ts`: Theme management
- **Services** (`frontend/src/services/`): API communication
  - `apiService.ts`: REST API client
  - Socket.io client initialization for real-time events
- **Hooks** (`frontend/src/hooks/`): Custom React hooks

### Real-Time Architecture

**Socket.io Integration**:
- Backend uses `SocketService.ts` to manage WebSocket connections
- Frontend connects via `socket.io-client` in service layer
- Game state synchronized through WebSocket events:
  - Lobby events: `lobby:created`, `lobby:joined`, `player:left`
  - Game events: `game:started`, `question:sent`, `answer:received`, `game:ended`
- All real-time features (lobby updates, live gameplay, player status) use Socket.io

### Database

**PostgreSQL with Drizzle ORM**:
- Production uses centralized Postgres instance (`shared-postgres:5432/l2p_db`)
- Test database runs on port 5433 for isolation
- Migrations managed via custom CLI (`backend/src/cli/database.ts`)
- Schema defined with Drizzle ORM

**Key Tables**:
- `users`: User accounts and authentication
- `players`: Player profiles (linked to users)
- `lobbies`: Game lobbies
- `game_sessions`: Active game state
- `questions`: Quiz questions
- `question_sets`: Question collections

## Testing Strategy

### Critical Testing Requirements

**ALWAYS use `NODE_OPTIONS=--experimental-vm-modules` for Jest tests** - This project uses ESM modules and Jest requires this flag.

**Test Database Isolation**:
- Integration tests use separate database on port 5433
- Production database is on port 5432
- Never run tests against production database
- Test database configuration in `jest.setup.*.mjs` files

### Unit Tests

**Backend**:
- Location: `backend/src/**/__tests__/*.test.ts`
- Run: `npm run test:unit:backend`
- Focus: Services, repositories, utilities
- Mocked dependencies: database, external services

**Frontend**:
- Location: `frontend/src/**/__tests__/*.test.tsx`
- Run: `npm run test:unit:frontend`
- Tools: Jest + Testing Library
- Focus: Components, hooks, stores
- Mocked: API calls, Socket.io

### Integration Tests

**Backend**:
- Location: `backend/src/__tests__/integration/*.test.ts`
- Run: `npm run test:integration:backend`
- Uses Supertest for HTTP testing
- Real Socket.io connections (not mocks)
- Requires `--forceExit --detectOpenHandles` flags
- Test database on port 5433

**Frontend**:
- Location: `frontend/src/__tests__/integration/*.test.tsx`
- Run: `npm run test:integration:frontend`
- Tests component integration with mocked API

### E2E Tests (Playwright)

**Location**: `frontend/e2e/tests/`

**Setup**:
```bash
# First time setup
cd frontend/e2e
npm install
npm run install:browsers

# Run tests
npm run test                    # Headless
npm run test:headed            # With browser UI
npm run test:ui                # Interactive mode
```

**Test Environments**:
- **Local**: Tests against `http://localhost:3000` (dev server)
- **Docker**: Tests against `http://localhost:3007` (test stack)

**Docker Test Stack**:
```bash
cd frontend
npm run start:docker-test       # Start test environment
npm run test:e2e:docker        # Run E2E against Docker
npm run stop:docker-test       # Cleanup
```

**Ports**:
- Frontend (local): `http://localhost:3000`
- Backend API (local): `http://localhost:3001/api`
- Frontend (Docker test): `http://localhost:3007`
- Backend API (Docker test): `http://localhost:3006/api`
- Test Postgres: `localhost:5433`
- Test Redis: `localhost:6380`
- MailHog: `http://localhost:8025`

### Test Configuration System

**Centralized test config** in `shared/test-config/`:
- `test-config.yml`: Single source of truth for test settings
- Environment-specific configs (local/CI/Docker)
- Test-type configs (unit/integration/E2E)
- Auto-generates Jest configuration
- Manages coverage thresholds

## Environment Configuration

**Files**:
- `.env.example`: Template with all variables and documentation
- `.env-dev`: Development environment (not committed)
- `.env-prod`: Production environment (not committed)

**Required Variables**:
```bash
# Database (uses centralized PostgreSQL)
DATABASE_URL=postgresql://l2p_user:PASSWORD@shared-postgres:5432/l2p_db
DB_HOST=shared-postgres
DB_PORT=5432
DB_NAME=l2p_db
DB_USER=l2p_user
DB_PASSWORD=alphanumeric-only-password

# JWT Authentication (generate with: openssl rand -hex 32)
JWT_SECRET=32-char-hex-string
JWT_REFRESH_SECRET=32-char-hex-string

# Application URLs
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000,http://localhost:3002

# Production-only
COOKIE_DOMAIN=.korczewski.de
COOKIE_SECURE=true
```

**Critical Rules**:
1. Never commit `.env-dev` or `.env-prod`
2. Use **alphanumeric-only** database passwords (avoid Docker/Postgres escaping issues)
3. Generate DB passwords: `openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c 32`
4. Secrets must be unique per environment
5. JWT secrets minimum 32 characters

## Critical Constraints

### Testing Constraints

**MUST follow these rules**:

1. **ESM Module Support**: ALL Jest tests require `NODE_OPTIONS=--experimental-vm-modules`
   - This is non-negotiable for this project
   - Without it, tests will fail with module resolution errors

2. **Test Database Isolation**: Integration tests MUST use separate database on port 5433
   - Production DB on port 5432 must never be used for tests
   - Test data prefixed with `test_` for safety

3. **Socket.io Testing**: Integration tests MUST use real Socket.io connections
   - Do not mock Socket.io in integration tests
   - Use `socket.io-client` to create real connections
   - Tests must properly close connections in cleanup

4. **Jest Cleanup Flags**: Integration tests require `--forceExit --detectOpenHandles`
   - Ensures proper cleanup of database connections and sockets
   - Already configured in package.json scripts

### Code Organization Constraints

1. **Backend Structure**:
   - Routes handle HTTP only, delegate to services
   - Services contain all business logic
   - Repositories are the only layer that queries database
   - No database queries in routes or services

2. **Frontend Structure**:
   - Components in `components/` are reusable and presentational
   - Pages in `pages/` are route-level and container components
   - API calls only in `services/apiService.ts`
   - State management only in Zustand stores

3. **Naming Conventions**:
   - React components: PascalCase
   - Hooks: `useThing` prefix
   - Stores: `thingStore.ts`
   - Test files: `*.test.ts` or `*.test.tsx`

### Database Constraints

1. **Migrations**: Run via CLI tool `npm run db:migrate` from backend directory
2. **Connection**: Uses centralized Postgres instance in production
3. **Test Isolation**: Tests never touch production database
4. **Credentials**: Must match between `.env` and `shared-infrastructure/.env`

## Development Workflow

### Starting Development

1. **Start Database** (if not running):
   ```bash
   npm run deploy:dev
   ```

2. **Run Migrations**:
   ```bash
   npm run db:migrate
   ```

3. **Start Dev Servers**:
   ```bash
   npm run dev:backend    # Terminal 1
   npm run dev:frontend   # Terminal 2
   ```

### Adding a New Feature

1. **Backend**:
   - Add route handler in `backend/src/routes/`
   - Implement business logic in `backend/src/services/`
   - Add data access in `backend/src/repositories/` if needed
   - Write unit tests for service
   - Write integration tests for route

2. **Frontend**:
   - Add component in `frontend/src/components/` or page in `frontend/src/pages/`
   - Add API calls to `frontend/src/services/apiService.ts`
   - Update Zustand store if needed
   - Write unit tests for component
   - Add E2E test if user-facing feature

### Running Tests

**Before committing**:
```bash
npm run typecheck        # Check TypeScript
npm run test:all         # Run all tests
```

**For specific areas**:
```bash
npm run test:unit:backend          # Backend services/repos
npm run test:unit:frontend         # Frontend components
npm run test:integration          # API integration tests
npm run test:e2e                  # End-to-end flows
```

### Debugging Tests

**Failed Integration Test**:
1. Check test database is running on port 5433
2. Verify `NODE_OPTIONS=--experimental-vm-modules` is set
3. Check for unclosed Socket.io connections
4. Review database cleanup in test teardown

**Failed E2E Test**:
1. Run in headed mode: `npm run test:e2e:headed`
2. Use UI mode: `npm run test:e2e:ui`
3. Check test stack is running: `npm run start:docker-test`
4. Verify ports 3000 (frontend) and 3001 (backend) are available

## Important Files

- `package.json`: Workspace root with all npm scripts
- `jest.config.js`: Multi-project Jest configuration
- `docker-compose.yml`: Production/dev deployment
- `docker-compose.test.yml`: Test environment stack
- `test-config.yml`: Centralized test configuration
- `scripts/rebuild.sh`: Full rebuild script
- `scripts/test-runner.sh`: Interactive test menu
- `scripts/deploy.sh`: Deployment orchestration
- `backend/src/cli/database.ts`: Database CLI tool
- `frontend/e2e/playwright.config.ts`: E2E test configuration
