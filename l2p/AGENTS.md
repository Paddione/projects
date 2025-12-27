# Repository Guidelines

## Project Structure & Module Organization
Mono-repo comprises `frontend/` (React + Vite TS), `backend/` (Express TS API), and `shared/` utilities. Keep UI components in `frontend/src/components` and route-level pages in `frontend/src/pages`; mirror tests under `frontend/src/__tests__`. Backend HTTP layers live in `backend/src/routes`, business logic in `backend/src/services`, and data access in `backend/src/repositories` with matching specs in `backend/src/__tests__`. Shared tooling, scripts, and infra artifacts sit in `shared/`, `scripts/`, `config/`, `database/`, `data/`, and `docs/`.

## Build, Test, and Development Commands
Install every workspace with `npm run install:all`. Build the entire repo via `npm run build:all` or scope with `npm run build --workspace frontend`. Start dev servers using `npm run dev:frontend` and `npm run dev:backend:tsx`, or run both through `npm run start:test-env`. Core test suites: `npm run test:unit`, `npm run test:integration`, `npm run test:e2e`, and coverage via `npm run test:coverage`.

## Coding Style & Naming Conventions
TypeScript runs in strict ESM mode (backend targets NodeNext). Use 2-space indentation, avoid unnecessary semicolons, and prefer descriptive identifiers. React components stay PascalCase, hooks follow `useThing`, and alias imports such as `@/components/Button` are available. Run `npm run lint` before pushing to keep formatting and ESLint rules consistent.

## Testing Guidelines
Jest backs unit and integration suites, React Testing Library exercises UI, and Playwright drives frontend E2E. Name specs `*.test.ts` or `*.test.tsx` and colocate under the nearest `__tests__` directory. Honor the existing coverage thresholds; HTML and lcov artifacts live in `coverage/` and `coverage-reports/`.

## Commit & Pull Request Guidelines
Follow Conventional Commits (`feat: add lobby timer`, `fix(backend): handle JWT refresh`). Each PR should link relevant issues (e.g., `#123`), summarize scope, call out touched packages, list executed test commands, and attach UI screenshots or recordings when applicable. Ensure the affected suites (at minimum `npm run test:unit`) pass before requesting review.

## Security & Configuration Tips
Never commit secrets; manage env files like `.env.dev` locally. AI features require `GEMINI_API_KEY` validated via `./check_gemini_key.sh`. Database access relies on `DATABASE_URL`; run migrations with `npm --prefix backend run db:migrate`. Rotate keys promptly and scrub logs before sharing.
