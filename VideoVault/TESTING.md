# VideoVault Testing Guide

This guide explains the streamlined testing workflow for VideoVault, designed to verify everything works before deployment.

## Quick Start

### Run All Tests (Pre-Deployment)
```bash
npm run test:all
# or
npm run test:pre-deploy
```

This runs all 6 test stages sequentially and stops on first failure.

### Run Individual Test Stages

Run tests one by one to isolate issues:

```bash
# Step 1: Type checking (fastest, ~5-10 seconds)
npm run test:1:types

# Step 2: Unit tests - Client + Server (~30-60 seconds)
npm run test:2:unit

# Step 3: Integration tests with Vitest (~10-20 seconds)
npm run test:3:integration

# Step 4: E2E tests with Playwright (~2-5 minutes)
npm run test:4:e2e

# Step 5: Production build verification (~30-60 seconds)
npm run test:5:build

# Step 6: Health check (instant)
npm run test:6:health
```

## Test Stages Explained

### Stage 1: Type Checking (`test:1:types`)
**What it does**: Validates TypeScript types across the entire codebase.
**Fast fail**: Catches type errors before running any tests.
**Runs**: `tsc` compiler in check mode.

```bash
npm run test:1:types
```

**Common failures**:
- Missing type definitions
- Type mismatches
- Import errors

---

### Stage 2: Unit Tests (`test:2:unit`)
**What it does**: Runs client and server unit tests in fast mode.
**Coverage**: Core business logic in services, utilities, and components.
**Runs**: Vitest with `FAST_TESTS=1` flag.

```bash
npm run test:2:unit
```

**Tests include**:
- Client services (VideoDatabase, FilterEngine, RenameEngine, etc.)
- Server routes and middleware
- Utility functions
- React hooks

**Fast mode**: Skips slow integration tests to provide quick feedback.

---

### Stage 3: Integration Tests (`test:3:integration`)
**What it does**: Runs server-side integration tests with real database.
**Coverage**: API endpoints, database operations, file operations.
**Runs**: Vitest with e2e config.

```bash
npm run test:3:integration
```

**Tests include**:
- REST API endpoints
- Database persistence
- File system operations
- Error handling flows

---

### Stage 4: E2E Tests (`test:4:e2e`)
**What it does**: Full end-to-end tests in Docker with Playwright.
**Coverage**: Real browser interactions, full app workflows.
**Runs**: Docker Compose with Playwright service.

```bash
npm run test:4:e2e
```

**Tests include**:
- Bulk operations and filtering
- Grid performance and virtualization
- Selection workflows
- Undo/redo operations

**Note**: This is the longest-running stage (2-5 minutes).

---

### Stage 5: Production Build (`test:5:build`)
**What it does**: Verifies the production build completes without errors.
**Coverage**: Build process, bundling, asset generation.
**Runs**: Vite build + esbuild for server.

```bash
npm run test:5:build
```

**Checks**:
- Client bundle generation
- Server bundle generation
- No build-time errors
- Asset optimization

---

### Stage 6: Health Check (`test:6:health`)
**What it does**: Final confirmation that all stages passed.
**Output**: Success message with checkmark.

```bash
npm run test:6:health
```

---

## Additional Test Commands

### Quick Tests (Skip E2E)
Run only types and unit tests for fast feedback:
```bash
npm run test:quick
```

### Full Coverage Report
Generate detailed coverage report with thresholds:
```bash
npm run test:coverage:full
```

### Watch Mode (Development)
Run tests in watch mode during development:
```bash
npm run test:watch
```

### Individual Test Suites
```bash
# Client tests only
npm run test:client

# Server tests only
npm run test:server

# Server integration tests only
npm run test:e2e

# Playwright tests (local)
npm run test:pw
npm run test:pw:ui  # Interactive UI mode
```

### Docker E2E Commands
```bash
# Full Playwright suite (recommended)
npm run docker:pw:all

# Start test environment only
npm run docker:pw:up

# Run Playwright tests against running environment
npm run docker:pw:run

# Interactive Playwright UI (port 9323)
npm run docker:pw:ui

# View Playwright report
npm run test:pw:report
```

---

## Test Workflow Examples

### Before Every Commit
```bash
npm run test:quick
```

### Before Pull Request
```bash
npm run test:all
```

### Before Deployment
```bash
npm run test:pre-deploy
```

### Debugging Failed Tests
```bash
# Run individual stage that failed
npm run test:2:unit  # If unit tests failed

# Run specific test file
npm run test -- client/src/services/filter-engine.test.ts

# Run with coverage to see what's missing
npm run test:coverage:full
```

### Local E2E Development
```bash
# Start dev environment
npm run docker:dev:detached

# Run Playwright in UI mode for debugging
npm run test:pw:ui

# Stop environment
npm run docker:down
```

---

## Continuous Integration

For CI/CD pipelines, use:
```bash
npm run test:pre-deploy
```

This ensures all stages pass before deployment.

**Expected runtime**:
- Stage 1 (Types): ~5-10s
- Stage 2 (Unit): ~30-60s
- Stage 3 (Integration): ~10-20s
- Stage 4 (E2E): ~2-5m
- Stage 5 (Build): ~30-60s
- **Total**: ~4-8 minutes

---

## Troubleshooting

### Tests Fail at Stage 1 (Types)
- Run `npm run check` to see detailed type errors
- Check for missing dependencies or type definitions
- Verify tsconfig.json configuration

### Tests Fail at Stage 2 (Unit)
- Run `npm run test:client` or `npm run test:server` separately
- Run individual test files: `npm run test -- path/to/test.ts`
- Check test setup in `client/src/test/setup.ts`

### Tests Fail at Stage 3 (Integration)
- Verify database connection in `.env-dev`
- Check server routes and middleware
- Run with verbose logging: `npm run test:e2e -- --reporter=verbose`

### Tests Fail at Stage 4 (E2E)
- Ensure Docker is running
- Check Docker Compose logs: `npm run docker:logs`
- Run Playwright in UI mode for debugging: `npm run docker:pw:ui`
- Verify Playwright version matches: `npm run predocker:pw:all`

### Tests Fail at Stage 5 (Build)
- Check for build errors in output
- Verify all imports and assets exist
- Run `npm run build` directly for detailed errors

---

## Coverage Thresholds

Core services have strict coverage requirements:

| Service | Branches | Functions | Lines | Statements |
|---------|----------|-----------|-------|------------|
| FilterEngine | 90% | 95% | 95% | 95% |
| RenameEngine | 85% | 95% | 95% | 95% |
| DirectoryDatabase | 90% | 95% | 95% | 95% |
| VideoDatabase | 85% | 95% | 95% | 95% |

Run `npm run test:coverage:full` to see current coverage.

---

## Environment Setup

### Required for Local Testing
```bash
# Install dependencies
npm install

# Install Playwright browsers (for local E2E)
npm run test:pw:install

# Copy environment file
cp .env.example .env-dev
```

### Required for Docker E2E
- Docker and Docker Compose installed
- `shared-postgres` service running (from shared-infrastructure)

---

## Best Practices

1. **Always run `test:1:types` first** - Fastest way to catch issues
2. **Use `test:quick` during development** - Fast feedback loop
3. **Run `test:all` before pushing** - Ensure nothing is broken
4. **Use watch mode for TDD** - `npm run test:watch`
5. **Check coverage regularly** - `npm run test:coverage:full`
6. **Debug with Playwright UI** - `npm run test:pw:ui` or `npm run docker:pw:ui`

---

## Summary

```bash
# Full pre-deployment check (recommended)
npm run test:all

# Quick feedback during development
npm run test:quick

# Individual stages for debugging
npm run test:1:types
npm run test:2:unit
npm run test:3:integration
npm run test:4:e2e
npm run test:5:build
npm run test:6:health
```

**When all stages pass, your code is ready to deploy! ✅**
