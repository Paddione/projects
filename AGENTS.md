# Repository Guidelines

## Project Structure & Module Organization
- `l2p/`, `VideoVault/`, `payment/`, `auth/`, and `reverse-proxy/` are independent services with their own `README.md` and build/test scripts.
- Service docs: `l2p/README.md`, `VideoVault/README.md`, `payment/README.md`, `auth/README.md`, `reverse-proxy/README.md`, and `shared-infrastructure/README.md`.
- `shared-infrastructure/` hosts the shared Postgres setup; reusable packages and design assets live in `shared-infrastructure/shared/`.
- `Obsidian/` contains the user guide and service docs, `k8s/` holds deployment manifests, and `scripts/` contains root utilities (setup, health checks, env validation).
- Keep changes scoped to a single service unless the feature explicitly spans multiple apps.

## Build, Test, and Development Commands
- `npm run dev:all` runs all core services in parallel.
- `npm run build:all` builds all apps sequentially (useful for CI checks).
- `npm run test:all` runs each service’s test suite in order.
- `./scripts/start-all-services.sh` and `./scripts/stop-all-services.sh` manage shared infra + services.
- `npm run validate:env` (or `:dev` / `:prod`) verifies required environment variables.

## Coding Style & Naming Conventions
- TypeScript is the default across services; follow each project’s ESLint config.
- VideoVault uses Prettier (`VideoVault/.prettierrc.json`); other services rely on ESLint formatting rules.
- Indentation is 2 spaces and single quotes where the local style uses them.
- React components are `PascalCase`, hooks are `useThing`, tests live in `__tests__/`, `test/`, or `e2e/`.

## Testing Guidelines
- L2P: Jest unit/integration tests under `l2p/**/__tests__`; Playwright E2E under `l2p/frontend/e2e/`.
- VideoVault: Vitest unit tests in `VideoVault/client/src/*.test.ts`; Playwright E2E in `VideoVault/e2e/`.
- Payment: Vitest + Playwright in `payment/test/`.
- Prefer the smallest relevant suite and state when tests are skipped.

## Commit & Pull Request Guidelines
- Git history favors conventional commits like `feat:`, `fix:`, and `chore:`; keep messages short and imperative.
- Include the project name in the subject when the change targets a single service (e.g., `feat: l2p matchmaking cleanup`).
- PRs should list affected services, summarize changes, note tests run, and include screenshots for UI updates.

## Security & Configuration Tips
- Do not commit `.env-dev` or `.env-prod`; use `.env.example` templates and `npm run validate:env*`.
- Use unique, alphanumeric-only DB passwords to avoid Docker/Postgres escaping issues.
