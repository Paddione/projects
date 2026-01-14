# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

A full-stack application suite for **Project Diablo 2** that tracks builds, monitors the meta, and provides insights into the PD2 economy and playerbase. The monorepo contains:

- **api/** - Express.js REST API with background jobs (character scraping, player tracking)
- **web/** - React + Vite frontend with Mantine UI components

This is NOT the character exporter tool - that's in a separate repository.

## Common Commands

### API (Backend)

```bash
cd api

# Development
npm i                    # Install dependencies
npm run dev              # Start dev server with ts-node
npm run build            # Build TypeScript to dist/
npm start                # Run production build
npm run jobs             # Run background jobs (player count tracker and character scraper)

# Testing
npm test                 # Run all tests
npm run test:watch       # Watch mode
npm run test:coverage    # Generate coverage report
npm run typecheck        # TypeScript type checking

# Linting
npm run lint             # Run ESLint
```

### Web (Frontend)

```bash
cd web

# Development
npm i                    # Install dependencies
npm run dev              # Start Vite dev server (default port 5173)
npm run build            # Build for production
npm run preview          # Preview production build

# Linting
npm run lint             # Run ESLint
```

### Testing Single Files

```bash
# Backend test
cd api
npx jest src/routes/characters.test.ts

# Or with pattern matching
npx jest character
```

## Architecture & Code Organization

### Backend Architecture (api/)

Express.js REST API with PostgreSQL and Redis caching.

**Directory structure:**
- `src/routes/` - Express route handlers
  - `characters.ts` - Character search, snapshots, filtering
  - `economy.ts` - Item listing queries
  - `statistics.ts` - Player statistics and distributions
  - `leaderboard.ts` - Level 99 and mirror leaderboards
  - `accounts.ts` - Account-based queries
  - `health.ts` - Health check endpoint
  - `index.ts` - Route aggregator
- `src/database/` - Database access layer
  - `postgres/index.ts` - Character database class with connection pooling
  - `postgres/economy.ts` - Economy database class
- `src/jobs/` - Background cron jobs
  - `character-scraper.ts` - Scrapes PD2 armory for character data
  - `online-players-tracker.ts` - Tracks concurrent player count
  - `leaderboard-updater.ts` - Updates leaderboard rankings
- `src/middleware/` - Express middleware
  - `auto-cache.ts` - Automatic Redis caching layer
  - `rate-limit.ts` - Rate limiting configuration
  - `error-handler.ts` - Centralized error handling
  - `validation.ts` - Request validation helpers
- `src/utils/` - Utility functions
  - `cache.ts` - Redis client wrapper with graceful fallback
  - `parser.ts` - Data parsing utilities
  - `character-stats.ts` - Character statistics calculations
  - `skill-calculator.ts` - Complex skill point calculations
- `src/types/` - TypeScript type definitions
- `src/config/` - Configuration management

**Key patterns:**
- Database uses connection pooling via `pg.Pool`
- Redis provides automatic caching layer via middleware
- Graceful fallback: if Redis is unavailable, API continues without caching
- Background jobs run separately via `npm run jobs` (separate process from API)
- Routes use Express Router with automatic JSON parsing
- Error handling centralized in middleware
- All database queries return typed interfaces

**Dual-process model:**
- `npm start` runs the API server only (scales to 20 instances in production)
- `npm run jobs` runs background jobs only (single instance)
- This separation enables horizontal scaling of API servers

### Frontend Architecture (web/)

React + Vite SPA with Mantine UI components and TanStack Query for data fetching.

**Directory structure:**
- `src/pages/` - Top-level route components
  - `Home.tsx` - Landing page with stats
  - `Builds.tsx` - Character search and filtering
  - `Character.tsx` - Individual character details
  - `Account.tsx` - Account-level character list
  - `Economy.tsx` - Item economy browser
  - `ItemDetail.tsx` - Individual item price history
  - `Statistics.tsx` - Player statistics and distributions
  - `Leaderboard.tsx` - Rankings (Level 99, Mirror Copies)
  - `CharacterExport.tsx` - Export tool information page
  - `CorruptedZoneTracker.tsx` - Terror zone tracker
- `src/components/` - Reusable UI components organized by feature
  - `builds/` - Build filtering, skill trees, item displays
  - `character/` - Character detail views
  - `economy/` - Economy tables and charts
  - `layout/` - Header, footer, navigation
  - `shared/` - Shared components (ErrorBoundary, etc.)
- `src/api/` - API client layer
  - `client.ts` - APIClient class with typed methods (get, post, put, delete)
  - `characters.ts` - Character API calls
  - `economy.ts` - Economy API calls
  - `statistics.ts` - Statistics API calls
  - `leaderboard.ts` - Leaderboard API calls
  - `accounts.ts` - Account API calls
- `src/hooks/` - Custom React hooks
  - `useCharacterData.ts` - Character data fetching and state
  - `useCharacterFilters.ts` - Filter state management
  - `useNavbarStats.ts` - Global stats for navbar
  - `useTerrorZone.ts` - Terror zone tracking
- `src/types/` - Shared TypeScript types
- `src/config/` - Configuration (API URL from .env)
- `src/data/` - Static data (skills, items, classes)
- `src/utils/` - Utility functions

**Key patterns:**
- TanStack Query (React Query) for all data fetching with 5min stale time
- APIClient class handles all HTTP requests with error handling
- Mantine UI components for consistent dark theme
- React Router for client-side routing
- Custom hooks encapsulate business logic and API calls
- ErrorBoundary wraps entire app for graceful error handling
- No global state management library (uses TanStack Query + local state)

### Data Flow

1. Frontend makes API calls via `src/api/` modules
2. API client handles request construction and error handling
3. Backend routes receive requests and validate inputs
4. Routes query database via `characterDB` or `economyDB` instances
5. Database classes manage connection pools and execute queries
6. Auto-cache middleware intercepts responses and stores in Redis
7. Subsequent requests hit cache before database
8. Background jobs update data independently via cron schedules

### Database Schema

Two PostgreSQL databases:
- **Character DB**: Character snapshots, player counts, leaderboards
- **Economy DB**: Item listings with ingestion dates and data dates

Connection pooling configured for max 20 connections per pool.

### Caching Strategy

- Redis caches all GET responses automatically via middleware
- Cache keys derived from endpoint + query params
- Graceful fallback: continues without caching if Redis unavailable
- Background jobs bypass cache and write directly to database

## Environment Configuration

### API (.env)

Required variables:
```bash
NODE_ENV=production
PORT=3000
API_VERSION=v1

# PostgreSQL
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=pd2_tools
POSTGRES_USER=pd2_user
POSTGRES_PASSWORD=password

# Redis (optional, graceful fallback if unavailable)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Configuration
CURRENT_SEASON=12
CORS_ORIGIN=*
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100
LOG_LEVEL=debug
```

### Web (.env)

```bash
VITE_API_URL=https://api.pd2.tools/api/v1
# VITE_API_URL=http://localhost:3000/api/v1
```

For local development, uncomment the localhost URL.

## Testing

### Backend Testing

Uses Jest with ts-jest preset. Tests include:
- Route integration tests with Supertest
- Database query mocking
- Utility function unit tests
- Middleware tests

**Test setup:**
- PostgreSQL service runs in GitHub Actions CI
- Database mocked in unit tests via `jest.mock()`
- Redis mocked to avoid external dependencies
- Tests force exit after completion (`forceExit: true` in jest.config.js)
- 60s timeout configured for slow CI environments

**Running tests:**
```bash
cd api
npm test                    # All tests
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report
npx jest characters         # Pattern matching
```

### Frontend Testing

Currently uses ESLint for linting. No test suite configured yet.

## Code Style

- **Formatter**: Prettier with 2-space indentation, double quotes, semicolons, LF line endings
- **Linter**: ESLint with TypeScript support
- **TypeScript**: Strict mode enabled in both projects
- **Naming conventions**:
  - React components: PascalCase
  - Custom hooks: `use*` prefix
  - Database classes: Capitalized (e.g., `CharacterDB_Postgres`)
  - API routes: lowercase with hyphens in URLs
  - Files: kebab-case for utilities, PascalCase for components

## Important Patterns & Constraints

### Backend Constraints

- **Dual-process architecture**: API server and jobs run separately to enable horizontal scaling
- **Connection pooling**: Max 20 connections per pool; tune for high concurrency
- **Redis graceful fallback**: API continues if Redis unavailable (logs error, continues without cache)
- **Rate limiting**: Configured with `trust proxy` set to 2 (Cloudflare + nginx)
- **Error handling**: All errors flow through centralized middleware
- **Logging**: Named loggers per module (e.g., `logger.createNamedLogger("API")`)

### Frontend Constraints

- **API base URL**: Configured via `VITE_API_URL` environment variable
- **Dark theme only**: Custom Mantine dark theme applied globally
- **No SSR**: Pure client-side React app
- **Browser targeting**: Modern browsers (ES2020+)

### Database Patterns

- All database methods return typed promises
- Connection pooling managed automatically
- Graceful shutdown closes all pools
- Queries use parameterized statements (SQL injection protection)

### Type Safety

- Shared types between frontend and backend (manually kept in sync)
- API responses match TypeScript interfaces
- Database query results strongly typed

## CI/CD

GitHub Actions workflows in `.github/workflows/`:
- `backend-tests.yml` - Runs API tests with PostgreSQL service
- `frontend-tests.yml` - Runs frontend linting

PostgreSQL configured with `max_connections = 1000` for CI environment to handle test parallelization.

## Project Diablo 2 Context

This app is built for the Project Diablo 2 community (a Diablo 2 mod). Key domain concepts:
- **Character snapshots**: Historical records of character state
- **Armory**: PD2's official character database (scraped by background jobs)
- **Terror zones**: Rotating high-level zones (tracked via socket.io)
- **Season**: PD2 operates in seasons (current: Season 12)
- **Mirror copies**: Endgame PvE challenge metric
- **Skills**: Complex skill trees with synergies and +skills from items
- **Mercenaries**: Hireable NPCs with their own items and stats
