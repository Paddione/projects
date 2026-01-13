# Test Infrastructure - Quick Start Guide

This guide helps you quickly set up and run tests in the Learn2Play project.

## TL;DR

```bash
# 1. Setup test infrastructure
npm run test:setup:db           # For unit tests with database
npm run test:setup:backend      # For integration tests
npm run test:setup:frontend     # For E2E tests

# 2. Run tests
npm run test:unit               # Unit tests
npm run test:integration        # Integration tests (needs backend)
npm run test:e2e                # E2E tests (needs full setup)

# 3. Cleanup
npm run test:teardown           # Stop test services
npm run test:teardown:clean     # Stop and remove all data
```

## Step-by-Step Guide

### 1. First Time Setup

```bash
# Install dependencies (if not done)
npm run install:all

# Install Playwright browsers for E2E tests
npm run test:browsers:install
```

### 2. Running Unit Tests

Unit tests generally don't require external services, but some may need a database.

```bash
# Option A: Run without infrastructure (most unit tests)
npm run test:unit

# Option B: Run with test database
npm run test:setup:db           # Start database
npm run test:unit               # Run tests
npm run test:teardown           # Cleanup
```

**Individual unit tests:**
```bash
# Backend
cd backend
NODE_OPTIONS=--experimental-vm-modules npx jest src/services/AuthService.test.ts

# Frontend
cd frontend
NODE_ENV=test npx jest src/components/Login.test.tsx
```

### 3. Running Integration Tests

Integration tests require the test database and backend services.

```bash
# Step 1: Setup infrastructure
npm run test:setup:backend

# Step 2: Run tests
npm run test:integration

# Step 3: Cleanup (when done)
npm run test:teardown
```

**Individual integration tests:**
```bash
cd backend
NODE_OPTIONS=--experimental-vm-modules npx jest src/__tests__/integration/auth.test.ts
```

### 4. Running E2E Tests

E2E tests require the full test stack (database, backend, frontend).

```bash
# Step 1: Setup full infrastructure
npm run test:setup:frontend

# Step 2: Run E2E tests
npm run test:e2e

# Step 3: Cleanup (when done)
npm run test:teardown
```

**Individual E2E tests:**
```bash
cd frontend/e2e
npx playwright test tests/login.spec.ts

# With UI for debugging
cd frontend/e2e
npx playwright test tests/login.spec.ts --headed
```

### 5. Running All Tests

```bash
# Setup full infrastructure
npm run test:setup:frontend

# Run complete test suite
npm run test:all

# Cleanup
npm run test:teardown:clean
```

## Common Workflows

### Development Workflow (Unit Tests)

```bash
# Terminal 1: Start test database (optional)
npm run test:setup:db

# Terminal 2: Run tests in watch mode
cd backend
npm run test:watch

# Or for frontend
cd frontend
npm run test:watch
```

### Development Workflow (Integration Tests)

```bash
# Terminal 1: Start test backend
npm run test:setup:backend

# Terminal 2: Run integration tests
npm run test:integration

# Or watch mode
cd backend
npm run test:watch
```

### Pre-Commit Testing

```bash
# Full validation before committing
npm run typecheck              # Type check
npm run test:setup:backend     # Setup infrastructure
npm run test:all               # Run all tests
npm run test:teardown          # Cleanup
```

### CI/CD Testing

```bash
# CI-optimized tests (use in CI pipelines)
npm run test:all:ci
```

## Useful Commands

### Check Test Infrastructure Status

```bash
# Check what's running
npm run test:setup:status

# View service URLs
./scripts/test-setup.sh urls

# View logs
docker logs l2p-backend-test
docker logs l2p-postgres-test
docker logs l2p-frontend-test
```

### Troubleshooting

```bash
# Reset everything
npm run test:teardown:clean
npm run test:setup:backend

# Check database connection
docker exec l2p-postgres-test pg_isready -U l2p_user -d l2p_db

# View backend logs
docker logs -f l2p-backend-test

# Kill stuck processes
pkill -f jest
pkill -f playwright
```

## Service URLs

When test infrastructure is running:

| Service | URL | Use |
|---------|-----|-----|
| Frontend | http://localhost:3007 | E2E testing |
| Backend API | http://localhost:3006/api | Integration/E2E |
| Backend Health | http://localhost:3006/api/health | Status check |
| Database | postgresql://l2p_user:***@localhost:5432/l2p_db | All tests |
| MailHog | http://localhost:8025 | Email testing |
| Redis | redis://localhost:6380 | Cache testing |

## Tips

1. **Always setup infrastructure before integration/E2E tests**
   - Integration tests need: `npm run test:setup:backend`
   - E2E tests need: `npm run test:setup:frontend`

2. **Use watch mode during development**
   ```bash
   npm run test:setup:backend  # Once
   npm run test:watch          # Continuous testing
   ```

3. **Clean up regularly**
   ```bash
   npm run test:teardown:clean  # Removes old data/volumes
   ```

4. **Check status if tests fail unexpectedly**
   ```bash
   npm run test:setup:status
   ```

5. **For faster unit tests, skip infrastructure**
   - Most unit tests don't need database/backend
   - Only setup when needed

## What Each Setup Does

| Command | What It Starts | Best For |
|---------|---------------|----------|
| `test:setup:db` | PostgreSQL only | Unit tests needing database |
| `test:setup:backend` | PostgreSQL + Backend | Integration tests |
| `test:setup:frontend` | PostgreSQL + Backend + Frontend | E2E tests |
| `test:setup` | Everything (alias) | Full test suite |

## Getting Help

- **Full documentation**: See `docs/testing-infrastructure.md`
- **Test setup script help**: `./scripts/test-setup.sh help`
- **Test environment script help**: `./scripts/test-environment.sh help`

## Quick Reference Card

```bash
# Setup
npm run test:setup:db           # Database only
npm run test:setup:backend      # Database + Backend
npm run test:setup:frontend     # Everything

# Run Tests
npm run test:unit               # Unit tests
npm run test:integration        # Integration tests
npm run test:e2e                # E2E tests
npm run test:all                # All tests

# Status & Info
npm run test:setup:status       # Check running services
./scripts/test-setup.sh urls    # Show service URLs

# Cleanup
npm run test:teardown           # Stop services
npm run test:teardown:clean     # Stop + remove volumes

# Development
npm run test:watch              # Watch mode
npm run typecheck               # Type checking
```

---

**Remember:** Integration and E2E tests require test infrastructure to be running!
