# Project Structure Guide

This document summarizes how the Learn2Play (L2P) mono-repo is laid out today so contributors can quickly navigate the codebase.

## Mono-Repo Overview

![Architecture Diagram](./architecture-diagram.svg)

```
.
├── backend/           # Express + TS API
├── frontend/          # React + Vite application
├── shared/            # Cross-package utilities and tooling
├── config/            # Env templates, linting, tooling presets
├── scripts/           # Helper scripts (DB, email, CI helpers)
├── database/          # SQL migrations and seed data
├── data/              # Static datasets consumed by services
├── docs/              # Project documentation (this file)
├── coverage*/         # Jest coverage artifacts
├── test-*/            # Auxiliary assets for tests & demos
└── package.json       # Workspaces + root npm scripts
```

Supporting files such as `docker-compose.*.yml`, `deploy.sh`, and `validate-deployment.sh` orchestrate local/prod environments. Root `npm run <task>` proxies to workspace-specific commands (`install:all`, `build:all`, `dev:*`, `test:*`).

## Frontend (`frontend/`)

Vite + React 18 + TypeScript application.

- `src/main.tsx`, `src/App.tsx`: entry and root component.
- `src/components/`: reusable UI elements (PascalCase). Tests mirror component paths under `src/__tests__/`.
- `src/pages/`: route-level screens. Routing defined via React Router (see `src/App.tsx`).
- `src/hooks/`: shared React hooks; follow `useThing` naming.
- `src/services/`: browser-side API clients (REST + Socket.IO) and domain helpers.
- `src/stores/`: Zustand stores for client-side state.
- `src/types/`: common TypeScript interfaces.
- `src/styles/`: global styles and theme tokens.
- `src/__tests__/`: Jest + React Testing Library specs mirroring components/pages/services.
- `src/test-utils.tsx`: custom render helpers and providers for RTL.
- `vite.config.ts`, `tsconfig.*.json`: build + TS settings.
- `package.json`: workspace scripts (`dev`, `build`, `test`, `lint`).

## Backend (`backend/`)

Express + TypeScript API plus Socket.IO.

- `src/server.ts`: main Express bootstrap (HTTP server, Socket.IO, middleware, routes).
- `src/app.ts` / `src/test-server.ts`: lightweight app entry-points for tests/CLI.
- `src/config/env.ts`: centralized environment loader.
- `src/routes/`: HTTP route handlers (auth, admin, lobbies, questions, etc.).
- `src/services/`: business logic modules (AuthService, LobbyService, PerksManager, etc.).
- `src/repositories/`: data access layer for PostgreSQL (UserRepository, GameSessionRepository, ...).
- `src/middleware/`: Express middleware (auth, logging, validation, file upload, metrics, etc.).
- `src/health/`: readiness/liveness checks.
- `src/cli/`: TSX-powered CLI utilities (database migrations, AI tooling).
- `src/utils/` & `src/types/`: shared helpers/types.
- `src/__tests__/`: Jest suites (unit + integration). Integration tests live under `src/__tests__/integration/**` and exercise the API via Supertest.
- `jest.config.js`, `jest.setup*.mjs`: testing configuration (ts-jest preset, env overrides, integration setup).
- `tsconfig*.json`: compile targets (NodeNext ESM) and strict builds.

## Shared Utilities (`shared/`)

Cross-cutting packages published via workspace linking.

- `shared/error-handling/`: reusable error response helpers; built before backend compilation.
- `shared/test-config/`: helpers for configuring env vars in tests (used by backend services).
- Additional shared utilities live under `shared/` as the project grows; each sub-folder behaves like its own package with `package.json` and build scripts.

## Scripts & Operational Assets

- `scripts/`: bash/TS utilities (email tests, rebuilding, orchestration helpers). Often invoked through root npm scripts or CI pipelines.
- `config/`: shared configuration (ESLint, prettier-style settings, env templates).
- `database/`: SQL migration files, schema snapshots, and migration helpers.
- `data/`: CSV/SQL datasets for seeding tests or demos (`perks-data.sql`, etc.).
- `docker-compose*.yml`: local/prod service compositions (frontend, backend, postgres, redis, etc.).
- `deploy.sh`, `rebuild.sh`, `validate-deployment.sh`: deployment workflows.

## Testing & Artifacts

- `coverage/`, `coverage-reports/`, `logs/`, `test-reports/`: generated artifacts from Jest/Playwright runs.
- `test-artifacts/`, `test-badges.html`, etc.: supporting files for demos and automated validation.
- Root npm scripts (`test:unit`, `test:integration`, `test:e2e`, `test:coverage`) orchestrate backend suites; frontend has parallel scripts under its workspace.

## Conventions Recap

- TypeScript everywhere, strict mode. Backend uses NodeNext ESM.
- Frontend components live in `src/components`, pages in `src/pages`, tests mirrored under `src/__tests__`.
- Backend HTTP routes under `src/routes`, services under `src/services`, repositories under `src/repositories`, integration tests under `src/__tests__/integration`.
- Shared packages house cross-cutting logic to avoid duplication.
- Run `npm run install:all` to bootstrap every workspace, and `npm run build:all` / `npm run test:unit` before pushing.

Refer back to `README.md` for deeper setup instructions, environment variable details, and subsystem guides.
