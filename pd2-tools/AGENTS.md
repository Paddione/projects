# Repository Guidelines

## Project Structure & Module Organization
- `api/` houses the Express + TypeScript backend, background jobs, and data access.
  - Routes live in `api/src/routes/`, jobs in `api/src/jobs/`, database code in `api/src/database/`.
- `web/` contains the React + Vite frontend.
  - Pages are in `web/src/pages/`, reusable UI in `web/src/components/`, API client code in `web/src/api/`.
- Shared assets/data live under each app’s `src/data/` or `src/config/` directories.

## Build, Test, and Development Commands
Backend (from `api/`):
- `npm run dev` starts the API with ts-node.
- `npm run build` compiles TypeScript to `dist/`.
- `npm start` runs the production API build.
- `npm run jobs` runs the background jobs process.
- `npm run lint` runs ESLint; `npm run typecheck` runs TypeScript checks.

Frontend (from `web/`):
- `npm run dev` starts the Vite dev server (default 5173).
- `npm run build` builds production assets.
- `npm run preview` serves the production build locally.
- `npm run lint` runs ESLint.

## Coding Style & Naming Conventions
- Formatting uses Prettier: 2-space indentation, double quotes, semicolons, LF endings.
- ESLint enforces code quality in both projects.
- Naming: React components in PascalCase, hooks use `use*`, utilities in kebab-case.
- API routes use lowercase, hyphenated paths (e.g., `/api/statistics/online-players-last`).

## Testing Guidelines
- Backend tests use Jest + Supertest; test files live alongside source (e.g., `api/src/routes/routes.test.ts`).
- Run all tests with `cd api && npm test`; watch mode with `npm run test:watch`.
- Frontend has no automated test suite yet; rely on linting and manual verification.

## Commit & Pull Request Guidelines
- Commit history favors Conventional Commit prefixes (`feat:`, `fix:`, `chore:`), but short imperative messages are also used. Prefer the prefix style when possible.
- Keep commits scoped and descriptive (e.g., `fix: rate limit` or `feat: leaderboards`).
- PRs should include a clear summary, steps to verify, and screenshots for UI changes. Link related issues when applicable.

## Configuration & Environment
- Backend config lives in `api/.env` (see `api/.env.example`); Redis is optional with graceful fallback.
- Frontend config uses `web/.env` with `VITE_API_URL` (comment/uncomment localhost for dev).
