# Repository Guidelines

## Project Structure & Module Organization
- Root contains shared docs (`docs/`), scripts (`scripts/`), and service folders.
- Services: `l2p/`, `VideoVault/`, `payment/`, `auth/`, `vllm/`, `reverse-proxy/`, `shared-infrastructure/`.
- Each service keeps its own source and tests (see service README for exact paths).

## Build, Test, and Development Commands
- Root setup: `./scripts/setup.sh` installs deps and seeds env templates.
- Start infra/services: `./scripts/start-all-services.sh` and `./scripts/stop-all-services.sh`.
- Example dev commands:
  - `cd l2p && npm run dev:backend` (API) and `npm run dev:frontend` (UI)
  - `cd VideoVault && npm run dev`
  - `cd payment && npm run dev`
  - `cd vllm && npm run dev:watch`
- Example build/test:
  - `cd l2p && npm run build:all` / `npm run test:all`
  - `cd VideoVault && npm run build` / `npm test`
  - `cd payment && npm run build` / `npm test`
  - `cd vllm && npm run build`

## Coding Style & Naming Conventions
- TypeScript is the default across apps; follow each project’s ESLint config.
- VideoVault uses Prettier (`VideoVault/.prettierrc.json`); others rely on ESLint.
- Indentation is 2 spaces where established.
- Naming: React components in `PascalCase`, hooks in `useThing`, tests in `__tests__/`, `test/`, or `e2e/`.

## Testing Guidelines
- L2P: Jest unit/integration tests; Playwright E2E in `l2p/frontend/e2e/`.
- VideoVault: Vitest unit tests, Playwright E2E in `VideoVault/e2e/`.
- Payment: Vitest + Playwright under `payment/test/`.
- VLLM: Jest tests in `vllm/tests/`.
- No explicit coverage threshold; add or update tests with functional changes.

## Commit & Pull Request Guidelines
- Git history is mixed (some `feat:`/`fix:` conventional commits, some minimal messages). Prefer concise, conventional messages when possible (e.g., `feat: add checkout retry`).
- PRs should list affected services, tests run, and env/migration impacts.
- Include screenshots for UI changes.

## Security & Configuration Tips
- Environment files: `.env.example` templates; `.env-dev`/`.env-prod` are gitignored.
- Never commit secrets; use unique values per environment.
- Shared Postgres runs via `shared-infrastructure/`; start it before dependent services.

## Agent-Specific Instructions
- Work within the target service directory unless asked otherwise.
- Avoid dependency or infra changes without explicit approval.
- Keep edits small and aligned with existing patterns.
