# NPM Scripts Reference

This document lists npm scripts across the monorepo and where to run them.

General usage:
```bash
npm run <script>
```

## Root scripts (`/home/patrick/projects/package.json`)

Run from `/home/patrick/projects`.

| Script | Purpose |
| --- | --- |
| `build:all` | Build all production services (l2p, auth, VideoVault, payment, vllm). |
| `dev:all` | Start all local dev services in parallel. |
| `dev:all:web` | Start only the web-facing dev services (no vllm). |
| `dev:l2p` | Start l2p frontend + backend (parallel wrapper). |
| `dev:l2p:parallel` | Same as `dev:l2p` with explicit concurrent labels. |
| `dev:payment` | Start payment dev server. |
| `dev:videovault` | Start VideoVault dev server. |
| `dev:vllm` | Start vllm dev server in watch mode. |
| `install:all` | Install dependencies for l2p, VideoVault, payment, vllm. |
| `restart:outdated` | Rebuild and restart only services with outdated Docker images. |
| `test:all` | Run l2p + auth + VideoVault + payment + vllm test suites. |
| `typecheck:all` | Run typechecks across services (L2P, auth, VideoVault, payment, vllm). |
| `validate:env` | Validate all environments via `scripts/validate-env.js`. |
| `validate:env:dev` | Validate development env. |
| `validate:env:prod` | Validate production env. |

## Auth service (`/home/patrick/projects/auth/package.json`)

Run from `/home/patrick/projects/auth`.

| Script | Purpose |
| --- | --- |
| `build` | Compile server and build frontend. |
| `build:frontend` | Install frontend deps and build the auth UI. |
| `db:generate` | Generate Drizzle migrations. |
| `db:migrate` | Run DB migrations. |
| `db:push` | Push schema changes to DB. |
| `db:studio` | Start Drizzle Studio. |
| `dev` | Run server in watch mode. |
| `lint` | Lint server source. |
| `start` | Run compiled server. |
| `test` | Run Jest tests. |
| `typecheck` | TypeScript typecheck. |

## Auth frontend (`/home/patrick/projects/auth/frontend/package.json`)

Run from `/home/patrick/projects/auth/frontend`.

| Script | Purpose |
| --- | --- |
| `build` | Typecheck and build with Vite. |
| `dev` | Start Vite dev server. |
| `lint` | Lint frontend sources. |
| `preview` | Preview the Vite build. |

## Learn2Play root (`/home/patrick/projects/l2p/package.json`)

Run from `/home/patrick/projects/l2p`.

| Script | Purpose |
| --- | --- |
| `backup` | Dump production database via Docker. |
| `build:all` | Build frontend + backend. |
| `build:backend` | Build backend only. |
| `build:frontend` | Build frontend only. |
| `coverage:all` | Run coverage for frontend + backend and collect summary. |
| `coverage:badge` | Generate coverage badge. |
| `coverage:collect` | Collect coverage artifacts. |
| `coverage:config` | Show coverage config. |
| `coverage:exclude` | Add coverage exclusion. |
| `coverage:report` | Generate coverage report. |
| `coverage:threshold` | Set coverage thresholds. |
| `coverage:validate` | Validate coverage config. |
| `db:health` | Run backend DB health check. |
| `db:migrate` | Run backend DB migrations. |
| `deploy` | Run deploy script. |
| `deploy:dev` | Start dev docker profile. |
| `deploy:down` | Stop all docker services. |
| `deploy:logs` | Tail docker logs. |
| `deploy:prod` | Start production Docker compose stack (uses prod compose file). |
| `dev:backend` | Start backend dev server. |
| `dev:backend:tsx` | Start backend dev server (tsx). |
| `dev:frontend` | Start frontend dev server. |
| `dev:no-compile` | Run no-compile dev mode. |
| `diagnostics:ts` | Count TS diagnostics. |
| `diagnostics:ts:update-baseline` | Update TS diagnostics baseline. |
| `import:questions` | Import questions into DB. |
| `import:questions:validate` | Validate question import data. |
| `import:questions:verify` | Verify imported questions. |
| `install:all` | Install root + frontend + backend deps. |
| `lint` | Lint structure. |
| `lint:structure` | Verify structure via script. |
| `logs` | Tail production docker logs. |
| `pipeline:complete` | Run full pipeline (config, tests, coverage). |
| `rebuild` | Run rebuild script. |
| `run` | Run the script runner. |
| `run:backend` | Run backend script runner. |
| `run:frontend` | Run frontend script runner. |
| `run:shared` | Run shared script runner. |
| `setup` | Run setup script. |
| `show` | Show test pipeline. |
| `smtp:apply` | Apply SMTP fixes. |
| `smtp:fix` | Generate SMTP fixes. |
| `smtp:test` | Test SMTP changes. |
| `start:test-env` | Start test env with backend + frontend. |
| `stop` | Stop production docker services. |
| `test:all` | Run unit + integration + e2e. |
| `test:all:ci` | Run CI-friendly tests. |
| `test:all:full` | Typecheck then run all tests. |
| `test:all:pipeline` | Typecheck and run pipeline tests. |
| `test:all:pipeline:soft` | Best-effort pipeline tests. |
| `test:browsers:install` | Install Playwright browsers. |
| `test:browsers:install:all` | Install Playwright browsers for frontend + e2e. |
| `test:config:health` | Test config health check. |
| `test:config:help` | Show config help. |
| `test:config:init` | Init test config env. |
| `test:config:show` | Show test config. |
| `test:config:validate` | Validate test config. |
| `test:coverage` | Run coverage for frontend + backend. |
| `test:coverage:backend` | Backend coverage. |
| `test:coverage:frontend` | Frontend coverage. |
| `test:debug` | Frontend debug tests. |
| `test:e2e` | Frontend e2e tests. |
| `test:e2e:guarded` | Run e2e only if env is ready. |
| `test:e2e:headed` | Run e2e headed. |
| `test:e2e:ui` | Run e2e UI. |
| `test:env:cleanup` | Cleanup test environment. |
| `test:env:health` | Check test environment health. |
| `test:env:logs` | Tail test environment logs. |
| `test:env:reset` | Reset test environment. |
| `test:env:restart` | Restart test environment. |
| `test:env:start` | Start test environment. |
| `test:env:status` | Show test environment status. |
| `test:env:stop` | Stop test environment. |
| `test:env:urls` | List test environment URLs. |
| `test:env:validate` | Validate test environment config. |
| `test:fix` | Placeholder for moved test fixes. |
| `test:integration` | Run frontend + backend integration tests. |
| `test:integration:backend` | Backend integration tests. |
| `test:integration:frontend` | Frontend integration tests. |
| `test:interactive` | Run interactive test runner. |
| `test:quick` | Run frontend unit tests. |
| `test:smtp` | Run SMTP test script. |
| `test:smtp:integration` | SMTP integration test in backend. |
| `test:smtp:real` | Real SMTP tests. |
| `test:unit` | Run frontend + backend unit tests. |
| `test:unit:backend` | Backend unit tests. |
| `test:unit:frontend` | Frontend unit tests. |
| `test:validate` | Placeholder for moved validation. |
| `test:watch` | Watch unit tests. |
| `test:watch:integration` | Watch integration tests (frontend + backend). |
| `test:watch:unit` | Watch unit tests (frontend + backend). |
| `typecheck` | Typecheck frontend + backend. |
| `typecheck:strict` | Strict typecheck for frontend + backend. |
| `validate:no-compile` | Validate no-compile setup. |

## L2P backend (`/home/patrick/projects/l2p/backend/package.json`)

Run from `/home/patrick/projects/l2p/backend`.

| Script | Purpose |
| --- | --- |
| `build` | Compile backend. |
| `build:nonblocking` | Compile with non-zero exit allowed. |
| `build:with-tsc-log` | Compile and log TS diagnostics. |
| `db:check-plans` | Check DB query plans. |
| `db:explain` | Explain queries. |
| `db:explain:file` | Explain queries from file. |
| `db:health` | DB health check. |
| `db:migrate` | Run migrations. |
| `db:status` | Show migration status. |
| `db:test` | Run DB tests. |
| `db:top-slow` | Show slow queries. |
| `db:validate` | Validate DB state. |
| `dev` | Start backend dev server (watch). |
| `dev:nonblocking` | Start backend once (nonblocking). |
| `dev:tsx` | Start backend dev server (tsx). |
| `prebuild` | Build shared error-handling package first. |
| `start` | Run compiled server. |
| `test` | Run unit tests (default). |
| `test:ai` | Run AI CLI test. |
| `test:ai-mock` | Run mocked AI CLI test. |
| `test:ai-real` | Run real AI CLI test. |
| `test:api` | Run API integration tests. |
| `test:coverage` | Run tests with coverage. |
| `test:e2e` | Run backend e2e tests. |
| `test:email` | Run email test script. |
| `test:integration` | Run backend integration tests. |
| `test:integration:ci` | CI integration tests. |
| `test:integration:docker` | Docker integration tests. |
| `test:integration:local` | Local integration tests. |
| `test:performance` | Performance tests. |
| `test:socket` | Websocket integration tests. |
| `test:unit` | Unit tests with exclusions. |
| `test:unit:ci` | CI unit tests. |
| `test:unit:local` | Local unit tests. |
| `test:watch` | Watch unit tests. |
| `tsc:log` | Output TS diagnostics log. |
| `typecheck` | Strict typecheck. |
| `typecheck:loose` | Loose typecheck. |
| `typecheck:strict` | Strict typecheck. |

## L2P frontend (`/home/patrick/projects/l2p/frontend/package.json`)

Run from `/home/patrick/projects/l2p/frontend`.

| Script | Purpose |
| --- | --- |
| `build` | Build frontend. |
| `build:with-tsc-log` | Build + log TS diagnostics. |
| `check:test-env` | Check test env prerequisites. |
| `dev` | Start Vite dev server. |
| `preview` | Preview build. |
| `start:docker-test` | Start docker-based test env. |
| `start:test-env` | Start test-mode frontend. |
| `status:docker-test` | Check docker test env status. |
| `stop:docker-test` | Stop docker test env. |
| `test` | Run frontend unit tests. |
| `test:ci` | CI unit tests. |
| `test:coverage` | Unit tests with coverage. |
| `test:e2e` | Run e2e tests (delegates to e2e package). |
| `test:e2e:accessibility` | Run accessibility e2e suite. |
| `test:e2e:docker` | Run e2e against docker env. |
| `test:e2e:docker:headed` | Run e2e docker headed. |
| `test:e2e:docker:integration` | Run e2e docker integration suite. |
| `test:e2e:docker:smoke` | Run e2e docker smoke suite. |
| `test:e2e:docker:ui` | Run e2e docker UI mode. |
| `test:e2e:error-handling` | Run error-handling e2e suite. |
| `test:e2e:headed` | Run e2e headed. |
| `test:e2e:integration` | Run e2e integration suite. |
| `test:e2e:performance` | Run e2e performance suite. |
| `test:e2e:smoke` | Run e2e smoke suite. |
| `test:e2e:ui` | Run e2e UI mode. |
| `test:integration` | Frontend integration tests. |
| `test:integration:ci` | CI integration tests. |
| `test:integration:local` | Local integration tests. |
| `test:unit` | Unit tests. |
| `test:unit:ci` | CI unit tests. |
| `test:unit:local` | Local unit tests. |
| `test:watch` | Watch unit tests. |
| `tsc:log` | Output TS diagnostics log. |
| `typecheck` | Strict typecheck. |
| `typecheck:loose` | Loose typecheck. |
| `typecheck:strict` | Strict typecheck. |

## L2P frontend e2e (`/home/patrick/projects/l2p/frontend/e2e/package.json`)

Run from `/home/patrick/projects/l2p/frontend/e2e`.

| Script | Purpose |
| --- | --- |
| `install:browsers` | Install Playwright browsers. |
| `test` | Run e2e tests. |
| `test:accessibility` | Run accessibility suite. |
| `test:debug` | Run tests in debug mode. |
| `test:error-handling` | Run error-handling suite. |
| `test:headed` | Run headed tests. |
| `test:integration` | Run integration suite. |
| `test:performance` | Run performance suite. |
| `test:report` | Show Playwright report. |
| `test:smoke` | Run smoke suite. |
| `test:ui` | Run Playwright UI. |
| `test:ui:xvfb` | Run UI with Xvfb. |

## L2P shared test-config (`/home/patrick/projects/shared-infrastructure/shared/l2p/test-config/package.json`)

Run from `/home/patrick/projects/shared-infrastructure/shared/l2p/test-config`.

| Script | Purpose |
| --- | --- |
| `build` | Build ESM + CJS outputs. |
| `build:cjs` | Build CJS output. |
| `build:esm` | Build ESM output. |
| `coverage:badge` | Generate coverage badge. |
| `coverage:collect` | Collect coverage. |
| `coverage:jest-config` | Emit Jest config. |
| `coverage:report` | Generate coverage report. |
| `coverage:show` | Show coverage config. |
| `coverage:validate` | Validate coverage config. |
| `deploy:build` | Build deployment pipeline artifacts. |
| `deploy:history` | Show deployment history. |
| `deploy:production` | Deploy to production. |
| `deploy:production:dry-run` | Dry-run production deploy. |
| `deploy:rollback:production` | Roll back production deploy. |
| `deploy:rollback:staging` | Roll back staging deploy. |
| `deploy:staging` | Deploy to staging. |
| `deploy:staging:dry-run` | Dry-run staging deploy. |
| `deploy:status` | Show deployment status. |
| `deploy:validate` | Validate deployment pipeline. |
| `deploy:validate:production` | Validate production deploy config. |
| `deploy:validate:staging` | Validate staging deploy config. |
| `nginx:generate` | Generate nginx config. |
| `nginx:generate-both` | Generate nginx config for both targets. |
| `nginx:reload` | Reload nginx. |
| `nginx:switch` | Switch nginx target. |
| `nginx:validate` | Validate nginx config. |
| `test` | Run Jest tests. |
| `test:env:cleanup` | Cleanup test env. |
| `test:env:health` | Check test env health. |
| `test:env:start` | Start test env. |
| `test:env:status` | Show test env status. |
| `test:env:stop` | Stop test env. |
| `test:run:all` | Run full test suite. |
| `test:run:e2e` | Run e2e tests. |
| `test:run:health` | Run health checks. |
| `test:run:integration` | Run integration tests. |
| `test:run:unit` | Run unit tests. |
| `test:watch` | Watch tests. |

## L2P shared error-handling (`/home/patrick/projects/shared-infrastructure/shared/l2p/error-handling/package.json`)

Run from `/home/patrick/projects/shared-infrastructure/shared/l2p/error-handling`.

| Script | Purpose |
| --- | --- |
| `build` | Build ESM + CJS outputs. |
| `build:cjs` | Build CJS output. |
| `build:esm` | Build ESM output. |

## VideoVault (`/home/patrick/projects/VideoVault/package.json`)

Run from `/home/patrick/projects/VideoVault`.

| Script | Purpose |
| --- | --- |
| `build` | Build client and server bundles. |
| `check` | Typecheck. |
| `clean:reports` | Remove Playwright reports. |
| `db:migrate` | Run DB migrations. |
| `db:push` | Push DB schema. |
| `dev` | Start dev server. |
| `dev:seed` | Seed dev database. |
| `docker:clean` | Remove docker containers and volumes. |
| `docker:dev` | Start dev docker stack. |
| `docker:dev:detached` | Start dev docker stack (detached). |
| `docker:down` | Stop docker stack. |
| `docker:logs` | Tail docker logs. |
| `docker:pw:all` | Run Playwright in docker profile. |
| `docker:pw:run` | Run Playwright container once. |
| `docker:pw:ui` | Start Playwright UI container. |
| `docker:pw:ui:detached` | Start Playwright UI container (detached). |
| `docker:pw:up` | Start Playwright deps (postgres + app). |
| `docker:shell` | Shell into dev container. |
| `docs:build` | Build combined docs. |
| `predocker:pw:all` | Ensure Playwright match before docker run. |
| `predocker:pw:run` | Ensure Playwright match before docker run. |
| `predocker:pw:up` | Ensure Playwright match before docker up. |
| `prepare` | Install Husky hooks. |
| `pretest` | Typecheck tests. |
| `pretest:pw` | Validate Playwright host requirements. |
| `process-inbox` | Process inbox via local OLLAMA URL. |
| `smb:link:win` | Link SMB share on Windows. |
| `smb:mount:unix` | Mount SMB share on Unix. |
| `smb:umount:unix` | Unmount SMB share on Unix. |
| `smb:unlink:win` | Unlink SMB share on Windows. |
| `start` | Start compiled server. |
| `test` | Run client + server tests. |
| `test:all` | Check + coverage + Playwright docker run. |
| `test:client` | Run client tests (fast). |
| `test:coverage` | Run tests with coverage. |
| `test:e2e` | Run e2e tests (vitest config). |
| `test:pw` | Run Playwright tests. |
| `test:pw:install` | Install Playwright chromium. |
| `test:pw:report` | Show Playwright report. |
| `test:pw:ui` | Run Playwright UI. |
| `test:server` | Run server tests (fast). |
| `test:unit:coverage` | Alias to coverage tests. |
| `test:watch` | Watch tests. |
| `thumbs` | Generate thumbnails. |
| `thumbs:prune` | Prune thumbnails. |
| `verify` | Run full verification suite. |

## Payment (`/home/patrick/projects/payment/package.json`)

Run from `/home/patrick/projects/payment`.

| Script | Purpose |
| --- | --- |
| `build` | Build Next.js app. |
| `dev` | Start dev server on port 3004. |
| `lint` | Lint project. |
| `start` | Start production server. |
| `test` | Run unit tests. |
| `test:e2e` | Run Playwright tests. |

## vLLM (`/home/patrick/projects/vllm/package.json`)

Run from `/home/patrick/projects/vllm`.

| Script | Purpose |
| --- | --- |
| `build` | Compile and make entry executable. |
| `dev` | Watch TypeScript compile. |
| `dev:server` | Run compiled server with watch. |
| `dev:watch` | Run tsx watch server. |
| `prepare` | Build on install. |
| `test` | Run Jest tests. |

## vLLM dashboard (`/home/patrick/projects/vllm/dashboard/package.json`)

Run from `/home/patrick/projects/vllm/dashboard`.

| Script | Purpose |
| --- | --- |
| `dev` | Start dashboard with nodemon. |
| `start` | Start dashboard server. |
| `test` | Placeholder test script. |

## shared-postgres-mcp (`/home/patrick/projects/shared-infrastructure/shared/postgres-mcp/package.json`)

Run from `/home/patrick/projects/shared-infrastructure/shared/postgres-mcp`.

| Script | Purpose |
| --- | --- |
| `start` | Start MCP server. |
| `build` | Compile TypeScript. |

## browser-control (`/home/patrick/projects/browser-control/package.json`)

Run from `/home/patrick/projects/browser-control`.

| Script | Purpose |
| --- | --- |
| `test` | Placeholder test script. |
