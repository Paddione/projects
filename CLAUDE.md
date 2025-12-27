# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a monorepo containing four independent projects with shared infrastructure:

- **l2p** (`/l2p`): Learn2Play multiplayer quiz platform (React + Express + PostgreSQL)
- **VideoVault** (`/VideoVault`): Client-first video management app with File System Access API (React + Vite + Express)
- **payment** (`/payment`): Next.js payment system with Stripe integration
- **vllm** (`/vllm`): vLLM MCP server for AI inference, code analysis, and database management

Each project is fully independent with its own dependencies, build process, and runtime requirements.

## Common Development Commands

### Root-Level Setup

```bash
# Initial setup for all projects
./setup.sh

# This will:
# - Install dependencies for all Node.js projects
# - Create .env files from .env.example templates
# - Set up Python virtual environments (for vllm/ai-image-gen)
# - Optionally start Docker services
```

### Project-Specific Commands

#### Learn2Play (l2p)

```bash
cd l2p

# Development
npm run dev:frontend          # Frontend dev server (port 5173)
npm run dev:backend           # Backend dev server (port 5001)
npm run dev:backend:tsx       # Backend with tsx hot reload

# Build & Deploy
npm run build:all             # Build both frontend and backend
npm run deploy:dev            # Start development Docker stack
npm run deploy:prod           # Start production Docker stack
npm run deploy:down           # Stop all containers

# Testing
npm run test:unit             # Unit tests (frontend + backend)
npm run test:integration      # Integration tests
npm run test:e2e              # Playwright E2E tests
npm run test:all              # Full test suite
npm run test:watch            # Watch mode for unit tests
npm run typecheck             # TypeScript type checking

# Database
npm run db:migrate            # Run Drizzle migrations
npm run db:health             # Check database health

# Test Environment
npm run test:env:start        # Start test containers
npm run test:env:stop         # Stop test containers
npm run test:env:health       # Check test environment health

# Coverage
npm run coverage:all          # Generate coverage reports
npm run coverage:report       # View coverage summary
```

**Important L2P Notes:**
- Uses Drizzle ORM with PostgreSQL
- Backend tests require NODE_OPTIONS="--experimental-vm-modules"
- Test environment runs on separate port (5433 for test DB)
- E2E tests require Playwright browsers: `npm run test:browsers:install`
- Uses Socket.io for real-time multiplayer functionality
- Workspace structure: root orchestrates frontend/backend workspaces

#### VideoVault

```bash
cd VideoVault

# Development
npm run dev                   # Local dev server (port 5100)
npm run docker:dev            # Docker dev with hot reload (port 5000)
npm run docker:dev:detached   # Docker background mode

# Testing
npm test                      # Vitest unit tests
npm run test:watch            # Watch mode
npm run test:e2e              # Server E2E tests
npm run check                 # TypeScript type checking

# Docker Playwright E2E
npm run docker:pw:all         # Full E2E with Postgres + app + tests
npm run docker:pw:up          # Start app containers
npm run docker:pw:run         # Run Playwright tests only
npm run docker:pw:ui          # Interactive Playwright UI (port 9323)

# Build & Production
npm run build                 # Production build
npm run start                 # Serve production build
npm run verify                # Full verification (typecheck + tests + build)

# Database (optional Postgres)
npm run db:push               # Push Drizzle schema changes

# Docker Management
npm run docker:shell          # Access container shell
npm run docker:logs           # View container logs
npm run docker:down           # Stop containers
npm run docker:clean          # Clean up volumes and images
```

**Important VideoVault Notes:**
- Primary storage: localStorage (browser-based)
- Optional Postgres backend for shared persistence
- Requires Chromium-based browsers for File System Access API
- Playwright tests use MSW for mocking when VITE_E2E_MSW=true
- E2E artifacts in `test-results/playwright/`
- Tailwind config: `tailwind.config.cjs` (single root config)

#### Payment

```bash
cd payment

# Development
npm run dev                   # Next.js dev server (port 3004)

# Build & Production
npm run build                 # Next.js production build
npm run start                 # Start production server

# Testing
npm test                      # Vitest unit tests
npm run test:e2e              # Playwright E2E tests
npm run lint                  # ESLint

# Database
npx prisma migrate dev        # Run Prisma migrations
npx prisma studio             # Open Prisma Studio
```

**Important Payment Notes:**
- Uses Next.js 16 with Prisma ORM
- NextAuth v5 (beta) for authentication
- Stripe integration for payments
- Requires DATABASE_URL in .env
- Uses --webpack flag (explicitly specified in scripts)

#### VLLM

```bash
cd vllm

# Development & Build
npm install
npm run build                 # Build MCP server

# Deployment
bash deploy.sh                # Deploy vLLM Docker container

# AI Image Generation (optional)
bash setup_ai_image_stack.sh  # Setup Stable Diffusion Forge
bash download_image_models.sh # Download SDXL models

# Dashboard (if exists)
cd dashboard && npm install && npm run dev
```

**Important VLLM Notes:**
- MCP server for Claude Desktop integration
- Provides AI inference, code review, and database management tools
- Requires VLLM_BASE_URL and DATABASE_URL environment variables
- Built output: `build/src/index.js`
- Claude Desktop config location varies by OS (see README)
- RAG stack in `/rag` subdirectory (Qdrant + LlamaIndex)
- Custom analyzer rules: `.analyzer-rules.yml`

## Architecture & Key Patterns

### L2P Architecture

**Monorepo Workspace Structure:**
- Root `package.json` orchestrates frontend/backend workspaces
- Frontend: React + Vite, uses Wouter for routing
- Backend: Express + Socket.io + Drizzle ORM
- Shared code in `/shared` directory (test config, types)

**Testing Infrastructure:**
- Jest with ES modules (`NODE_OPTIONS=--experimental-vm-modules`)
- Separate test databases and environments
- Integration tests use real database connections
- E2E tests with Playwright
- Coverage collection via custom CLI in `/shared/test-config`

**Key Services (Backend):**
- `AuthService`: JWT-based authentication
- `GameService`: Multiplayer game logic
- `SocketService`: Real-time Socket.io events
- `DatabaseService`: Drizzle ORM wrapper
- `EmailService`: SMTP email handling

**Directory Structure:**
```
l2p/
├── frontend/          # React SPA
│   ├── src/
│   │   ├── components/
│   │   ├── services/
│   │   └── __tests__/
├── backend/           # Express API
│   ├── src/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── middleware/
│   │   └── __tests__/
├── shared/            # Shared utilities
└── scripts/           # Build and test scripts
```

### VideoVault Architecture

**Client-First Design:**
- File System Access API for local file operations
- localStorage for primary metadata storage
- Optional Postgres backend for shared library persistence
- Worker threads for thumbnail generation (OffscreenCanvas)

**Core Services:**
- `useVideoManager`: Central state orchestration hook
- `VideoDatabase`: localStorage abstraction
- `FileScanner`: Concurrent directory scanning
- `FilterEngine`: Advanced filtering (date, size, duration, categories)
- `BulkOperationsService`: Multi-select batch operations

**Performance:**
- Virtual scrolling for large libraries (react-window)
- Lazy thumbnail generation
- Bundle optimization via manual chunking
- Performance monitoring in dev mode

### Payment Architecture

**Next.js App Router:**
- Uses Next.js 16 with React 19
- NextAuth v5 (beta) with Prisma adapter
- API routes for Stripe webhooks
- Server components for data fetching

### VLLM Architecture

**MCP Server Pattern:**
- Stdio-based communication with Claude Desktop
- Tool handlers in TypeScript
- Axios for vLLM API communication
- PostgreSQL connection for database tools

**Tool Categories:**
- Inference: chat_completion, completion, list_models
- Analysis: analyze_repository, review_code_ai, check_guidelines
- Advanced: scan_vulnerability, analyze_git, analyze_coverage
- Database: db_describe, db_list_users, db_run_query, db_set_role

## Environment Variables

Each project requires its own `.env` file. Use `.env.example` as template.

**Common patterns:**
- Database URLs use PostgreSQL connection strings
- Node environment: `NODE_ENV=development|production|test`
- Ports are configurable but have defaults (see project READMEs)
- Secrets must be alphanumeric (especially for L2P Postgres)

## Docker Usage

**L2P:**
- `docker-compose.yml`: Full stack (frontend, backend, postgres, nginx)
- `docker-compose.prod.yml`: Production overrides
- `docker-compose.test.yml`: Test environment
- Services run on Docker network for inter-communication

**VideoVault:**
- Development container with hot reload
- Postgres container for optional persistence
- Playwright container for E2E tests (uses `videovault-dev:5000`)
- Playwright image pinned to match `@playwright/test` version

**Payment:**
- Basic compose setup for Postgres
- App runs outside Docker in dev mode

**VLLM:**
- vLLM API container (GPU-enabled if available)
- Managed via `deploy.sh` script
- Environment from `.env` file

## Testing Philosophy

**L2P:**
- Unit tests mock external dependencies
- Integration tests use test database
- E2E tests run against full stack
- Test environment scripts in `/scripts`
- Coverage threshold tracking via CoverageConfigCLI

**VideoVault:**
- Unit tests with Vitest + jsdom
- Server E2E tests for API endpoints
- Playwright E2E for full workflows
- MSW for optional network mocking in E2E

**Payment:**
- Unit tests with Vitest
- Playwright E2E for user flows
- React Testing Library for components

## Critical Constraints

### L2P
- NEVER skip `NODE_OPTIONS=--experimental-vm-modules` for tests
- Test database must be on port 5433 (dev on 5432)
- Integration tests require `--forceExit --detectOpenHandles`
- Socket.io tests need real socket connections

### VideoVault
- Requires Chromium-based browser for full functionality
- File handles are session-based (require rescan after reload)
- Thumbnails NOT persisted (regenerated on demand)
- Docker Playwright tests write artifacts inside container (no permissions issues)

### Payment
- Prisma migrations require DATABASE_URL
- Stripe webhooks need STRIPE_WEBHOOK_SECRET
- NextAuth requires NEXTAUTH_SECRET and NEXTAUTH_URL

### VLLM
- Database tools only allow SELECT queries (security)
- GPU required for optimal vLLM performance
- MCP server path must be absolute in Claude config

## Important Files

### L2P
- `rebuild.sh`: Full rebuild script (stops containers, rebuilds, restarts)
- `test-runner.sh`: Interactive test menu
- `test-config.yml`: Test configuration
- `.claude/settings.local.json`: Claude permissions (extensive Bash allowlist)

### VideoVault
- `AGENTS.md`: AI agent documentation
- `docker-compose.yml`: Dev and E2E environment
- `scripts/ensure-playwright-match.mjs`: Version validation

### Payment
- `compose.yaml`: Database setup
- `auth.config.ts` & `auth.ts`: NextAuth configuration

### VLLM
- `deploy.sh`: vLLM container deployment
- `.analyzer-rules.yml`: Custom linting rules
- `claude_desktop_config.json`: Example MCP config

## Database Migrations

**L2P (Drizzle):**
```bash
cd l2p
npm run db:migrate          # Development
NODE_ENV=test npm run db:migrate  # Test environment
```

**VideoVault (Drizzle - optional):**
```bash
cd VideoVault
npm run db:push            # Push schema changes
```

**Payment (Prisma):**
```bash
cd payment
npx prisma migrate dev     # Development
npx prisma migrate deploy  # Production
```

## Git Workflow

- Repository uses conventional commits (based on scripts)
- Large files excluded via `.gitignore` (models, venvs, node_modules, databases)
- No AI models or large binaries committed
- Each project maintains independent versioning

## Special Considerations

1. **Cross-Project Dependencies**: None. Each project is fully independent.

2. **Shared Infrastructure**: Root `setup.sh` provides convenience for initializing all projects, but each can be set up independently.

3. **Performance**: L2P and VideoVault are performance-critical and use virtualization/optimization strategies.

4. **Security**:
   - VLLM database tools restricted to SELECT only
   - L2P uses rate limiting and CSRF protection
   - Payment uses NextAuth for secure authentication
   - Environment secrets never committed

5. **AI/ML Components**:
   - VLLM provides local AI inference
   - AI image generation stack optional (large downloads)
   - RAG system in VLLM for document retrieval

6. **Browser Compatibility**:
   - VideoVault requires Chromium (File System Access API)
   - Others work in all modern browsers
