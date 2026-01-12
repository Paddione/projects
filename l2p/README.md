# Learn2Play

A multiplayer quiz platform with real-time gameplay, comprehensive testing infrastructure, and production-ready deployment.

## Overview

Learn2Play is a full-stack web application that enables users to participate in live multiplayer quiz games. Built with React, Express, and PostgreSQL, it features real-time Socket.io communication, robust authentication, and an extensive testing suite.

## Features

- Real-time multiplayer gameplay with Socket.io
- JWT-based authentication with secure password hashing
- Lobby system for live game sessions
- Question management with multiple categories
- Player progression (XP, badges)
- Admin tooling for moderation
- Unit, integration, and E2E test coverage
- Docker-based deployments

## Tech Stack

### Frontend
- React 18 + TypeScript
- Vite
- Wouter routing
- Tailwind CSS
- Radix UI
- Socket.io client

### Backend
- Express + TypeScript
- Socket.io
- Drizzle ORM
- PostgreSQL
- Passport.js (JWT)
- Security middleware + rate limiting

### Testing
- Jest (ESM) + Testing Library
- Playwright (E2E)
- Vitest (unit helpers)
- Custom test environment scripts

## Quick Start

### 1) Environment Setup

```bash
cp .env.example .env-dev
cp .env.example .env-prod
```

- Use alphanumeric-only values for Postgres credentials.
- L2P uses centralized Postgres by default (`shared-postgres:5432/l2p_db`).
- Test database remains separate on port 5433 for isolation.

### Environment Configuration

Required values (dev and prod):
- `DATABASE_URL` (points to `shared-postgres:5432/l2p_db`)
- `L2P_DB_USER`, `L2P_DB_PASSWORD` (match `shared-infrastructure/.env`)
- `JWT_SECRET`, `JWT_REFRESH_SECRET` (32-char hex, unique per env)
- `FRONTEND_URL` (dev: `http://localhost:3000`, prod: `https://l2p.korczewski.de`)
- `CORS_ORIGINS` (dev: `http://localhost:3000,http://localhost:3002`, prod: `https://l2p.korczewski.de`)

Production-only:
- `COOKIE_DOMAIN=.korczewski.de`
- `COOKIE_SECURE=true`
- `L2P_NETWORK_EXTERNAL=true`

The deployment script reads `.env`; copy `.env-prod` to `.env` when deploying with `scripts/deploy.sh`.

### 2) Install Dependencies

```bash
npm run install:all
```

### 3) Database Setup

```bash
npm run deploy:dev
npm run db:migrate
```

### 4) Start Development

```bash
npm run dev:backend
npm run dev:frontend
```

App: http://localhost:3000

## Development Commands

```bash
# Dev servers
npm run dev:frontend
npm run dev:backend
npm run dev:backend:tsx

# Build
npm run build:all
npm run build:frontend
npm run build:backend

# Typecheck
npm run typecheck
```

## Testing

```bash
# Unit
npm run test:unit
npm run test:unit:frontend
npm run test:unit:backend
npm run test:watch

# Integration
npm run test:integration
npm run test:integration:frontend
npm run test:integration:backend

# E2E
npm run test:browsers:install
npm run test:e2e
npm run test:e2e:headed
npm run test:e2e:ui

# Full suite
npm run test:all
npm run test:all:ci
```

Coverage:
```bash
npm run coverage:all
npm run coverage:report
npm run coverage:badge
```

## Deployment

Development:
```bash
npm run deploy:dev
npm run deploy:logs
npm run deploy:down
```

Production:
```bash
npm run deploy:prod
npm run stop
```

Rebuild:
```bash
./scripts/rebuild.sh
```

## Database Guide

### Environment Variables

```bash
# Option 1: Full connection string
DATABASE_URL=postgresql://user:password@host:port/database

# Option 2: Individual variables
DB_HOST=localhost
DB_PORT=5432
DB_NAME=learn2play
DB_USER=l2p_user
DB_PASSWORD=l2p_password
```

### Migrations

```bash
npm run db:migrate
npm run db:status
npm run db validate
npm run db:rollback
npm run db:rollback 20240101_000001
```

### CLI Commands

```bash
npm run db migrate
npm run db rollback
npm run db status
npm run db validate
npm run db health
npm run db test
```

### Health Endpoints

- `GET /health`
- `GET /health/database`
- `GET /api/database/test`

## Project Structure

```
l2p/
├── backend/           # Express + TS API
├── frontend/          # React + Vite application
├── shared/            # Cross-package utilities and tooling
├── config/            # Env templates, linting, tooling presets
├── scripts/           # Helper scripts (DB, email, CI helpers)
├── database/          # SQL migrations and seed data
├── data/              # Static datasets
├── docs/              # Legacy docs (now consolidated here)
├── coverage*/         # Jest coverage artifacts
├── test-*/            # Test assets
└── package.json       # Workspaces + root npm scripts
```

Supporting files such as `docker-compose*.yml`, `scripts/deploy.sh`, and `scripts/validate-deployment.sh` orchestrate local/prod environments. Root npm scripts proxy to workspace commands (`install:all`, `build:all`, `dev:*`, `test:*`).

## Backend Guide

### Directory Layout

```
backend/src
├── routes/         # HTTP endpoints (auth, admin, lobbies, etc.)
├── services/       # Domain logic (AuthService, LobbyService, ...)
├── repositories/   # Data access abstractions
├── middleware/     # Express middleware (auth, validation, logging)
├── cli/            # tsx-powered scripts (migrations, tooling)
├── health/         # Health-check helpers
├── __tests__/      # Jest unit + integration specs
└── utils/, types/  # Shared helpers and type declarations
```

### Common Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev:tsx` | Start Express via tsx with live reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run start` | Serve compiled build |
| `npm run test:unit` | Jest unit suite |
| `npm run test:integration` | Jest integration suite |
| `npm run db:migrate` | Run database migrations |

### Backend Testing

Integration tests boot the real Express app and hit routes through Supertest. Ensure Postgres is available (see `jest.setup.integration.mjs` for `DATABASE_URL`).

```bash
npm --prefix backend run test:unit
npm --prefix backend run test:integration
```

## Frontend Guide

### Overview

- Framework: React 18 + Vite + TypeScript
- State: Zustand stores + providers
- Networking: REST helpers in `src/services/apiService.ts` + Socket.IO client
- Testing: Jest + Testing Library, Playwright for E2E

### Directory Layout

```
src/
├── components/   # Reusable UI widgets (PascalCase)
├── pages/        # Route-level screens
├── hooks/        # Custom hooks (useThing)
├── services/     # API + domain helpers
├── stores/       # Zustand stores
├── __tests__/    # App-level specs
├── test-utils.tsx# RTL helpers
└── styles/, types/, etc.
```

### Useful Commands

```bash
npm --prefix frontend install
npm --prefix frontend run dev
npm --prefix frontend run build
npm --prefix frontend run test:unit
npm --prefix frontend run test:e2e
```

## Testing Reference

### Backend Tests

Structure:
- `unit/`
- `integration/`
- `e2e/`

Commands:
```bash
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:coverage
```

### Frontend Tests

Structure:
- `unit/`
- `integration/`
- `e2e/`

Commands:
```bash
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:coverage
```

### E2E Suite (Playwright)

Local dev:
```bash
cd frontend/e2e
npm install
npm run install:browsers
npm test
npm run test:ui
```

Docker test stack:
```bash
cd frontend
npm run start:docker-test
npm run test:e2e:docker
npm run stop:docker-test
```

Ports:
- Frontend: http://localhost:3007 (Docker), http://localhost:3000 (local)
- Backend API: http://localhost:3006/api (Docker), http://localhost:3001/api (local)
- Postgres (test): localhost:5433
- Redis: localhost:6380
- MailHog: http://localhost:8025

## Unified Test Configuration System

A centralized test configuration system provides consistent settings across frontend/backend.

Highlights:
- Single `test-config.yml` file
- Environment-specific settings (local/CI/Docker)
- Test-type configs (unit/integration/E2E)
- Jest config generation
- Health checks

Basic usage:
```typescript
import { TestConfigManager, TestUtilities } from 'test-config';

const configManager = TestConfigManager.getInstance();
const config = configManager.loadConfig();
const validation = configManager.validateConfig();

const context = configManager.createExecutionContext('local', 'unit');
await TestUtilities.initializeTestEnvironment('local', 'unit');
```

## Coverage Configuration System

Features:
- Multi-format reports (HTML, LCOV, JSON, XML, SVG badges)
- Per-surface thresholds (frontend/backend/global)
- Historical tracking
- CLI support

Quick start:
```bash
cd shared/test-config
npm install
npm run build
npm run coverage:collect
npm run coverage:badge
```

## Jest + TypeScript Guide

Key points:
- `tsconfig.test.json` extends the base config
- Jest config uses `ts-jest/presets/default-esm`
- Use `moduleNameMapper` for aliases
- Store manual mocks in `__mocks__/`

## Error Handling System (Shared)

Centralized error handling provides:
- Structured error formatting + context enrichment
- Recovery strategies
- Logging (console/file/remote)
- Health monitoring and alerts
- Notification channels (email/Slack/SMS/webhooks)

Initialize:
```typescript
import { initializeErrorHandling } from './shared/error-handling';

await initializeErrorHandling({
  logLevel: 'info',
  enableFileLogging: true,
  enableHealthMonitoring: true,
  enableNotifications: true
});
```

## Contributing & Placement Rules

- Frontend components in `frontend/src/components`, routes in `frontend/src/pages`.
- Backend routes in `backend/src/routes`, logic in `backend/src/services`.
- DB access in `backend/src/repositories`.
- Tests live in `__tests__` folders near the code.
- Shared packages under `shared/` must include `package.json`.

Run structure checks:
```bash
npm run lint
```

## Critical Constraints

- Do not skip `NODE_OPTIONS=--experimental-vm-modules` for tests.
- Production/dev uses centralized Postgres (`shared-postgres:5432/l2p_db`).
- Test DB stays on port 5433 for isolation.
- Integration tests require `--forceExit --detectOpenHandles`.
- Socket.io tests need real socket connections.

## Important Files

- `scripts/rebuild.sh`: Full rebuild script
- `scripts/test-runner.sh`: Interactive test menu
- `test-config.yml`: Test configuration
- `.claude/settings.local.json`: Claude permissions
