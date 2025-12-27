# Repository Guidelines

This monorepo contains four independent applications (`l2p`, `VideoVault`, `payment`, `vllm`). Each project has its own README, `package.json`, and workflow; use the root docs for cross-project context.

## Project Structure & Module Organization

- `l2p/`: multiplayer quiz platform with `frontend/`, `backend/`, and `shared/` modules.
- `VideoVault/`: video manager with `client/`, `server/`, and `e2e/` test harness.
- `payment/`: Next.js app (`app/`) with Prisma schema in `prisma/` and tests in `test/`.
- `vllm/`: MCP server with `src/`, `tests/`, and optional `dashboard/` and `rag/` tooling.
- Root utilities: `setup.sh` for bootstrapping and `CLAUDE.md` for AI/dev guidance.

## Build, Test, and Development Commands

Run commands from the project directory. Common examples:

```bash
./setup.sh
cd l2p && npm run dev:backend && npm run dev:frontend
cd VideoVault && npm run dev
cd payment && npm run dev
cd vllm && bash deploy.sh
```

Builds typically use `npm run build` (or `npm run build:all` in `l2p`). Tests are project-specific: `l2p` uses `npm run test:all`, while `VideoVault` and `payment` use `npm test`.

## Coding Style & Naming Conventions

- Language: TypeScript across projects; follow each project’s ESLint config.
- Formatting: VideoVault uses Prettier (`VideoVault/.prettierrc.json`); other projects rely on ESLint. Keep 2-space indentation and single quotes where existing files do.
- Naming: React components in `PascalCase`, hooks in `useThing` form, test files as `*.test.ts(x)` or `*.e2e.test.ts` under `__tests__/`, `test/`, or `e2e/`.

## Testing Guidelines

- `l2p`: Jest unit/integration tests in `l2p/backend/src/**/__tests__` and frontend tests in `l2p/frontend/src/**/__tests__`, plus Playwright E2E under `l2p/frontend/e2e/`.
- `VideoVault`: Vitest unit tests in `VideoVault/client/src/**.test.ts`, Playwright E2E in `VideoVault/e2e/`.
- `payment`: Vitest + Playwright in `payment/test/`.
- `vllm`: Jest tests in `vllm/tests/`.

Add or update tests with every functional change.

## Commit & Pull Request Guidelines

- Commit messages are short, imperative sentences (e.g., “Add payment webhook docs”). Include the project name when it clarifies scope.
- PRs should state affected project(s), provide a concise summary, list tests run, and note any `.env` or migration changes. Include screenshots for UI updates and link issues when available.

## Configuration & Secrets

Each project expects its own `.env`. Start from `.env.example` and never commit secrets. Keep database and port settings aligned with each project’s README.
