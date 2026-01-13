# Test Infrastructure Guide

This guide explains how to set up and use the test infrastructure for the Learn2Play project.

## Overview

The test infrastructure consists of three main components:

1. **Test Database** (PostgreSQL) - For unit and integration tests
2. **Test Backend** - Express API server for integration tests
3. **Test Frontend** - React application for E2E tests

All test infrastructure runs in Docker containers defined in `docker-compose.test.yml`.

## Quick Start

### Setup Test Infrastructure

```bash
# From the l2p directory

# Setup just the database (for unit tests)
npm run test:setup:db

# Setup database + backend (for integration tests)
npm run test:setup:backend

# Setup full environment (for E2E tests)
npm run test:setup:frontend
# or
npm run test:setup

# Check status
npm run test:setup:status
```

### Run Tests

```bash
# Unit tests (no infrastructure needed for most)
npm run test:unit

# Integration tests (requires database)
npm run test:integration

# E2E tests (requires full infrastructure)
npm run test:e2e
```

### Teardown

```bash
# Stop test infrastructure
npm run test:teardown

# Stop and clean (removes volumes)
npm run test:teardown:clean
```

## Detailed Usage

### Test Setup Script

The `scripts/test-setup.sh` script provides fine-grained control over the test infrastructure:

```bash
# Direct script usage
./scripts/test-setup.sh [command]

# Available commands:
#   db           Setup test database only
#   backend      Setup test database and backend
#   full         Setup full test environment
#   status       Show status of test infrastructure
#   teardown     Stop test infrastructure
#   clean        Stop and remove volumes
#   urls         Show service URLs
#   help         Show help message
```

### Test Infrastructure Components

#### Test Database

- **Container**: `l2p-postgres-test`
- **Port**: `5432` (mapped to host `5432`)
- **Database**: `l2p_db`
- **User**: `l2p_user`
- **Connection String**: `postgresql://l2p_user:***@localhost:5432/l2p_db`

Setup:
```bash
npm run test:setup:db
```

Used by:
- Backend unit tests (mocked by default)
- Backend integration tests (required)
- Frontend integration tests (optional)

#### Test Backend

- **Container**: `l2p-backend-test`
- **Port**: `3006` (mapped to host)
- **API URL**: `http://localhost:3006/api`
- **Health Check**: `http://localhost:3006/api/health`

Setup:
```bash
npm run test:setup:backend
```

Used by:
- Backend integration tests
- Frontend integration tests
- E2E tests

#### Test Frontend

- **Container**: `l2p-frontend-test`
- **Port**: `3007` (mapped to host)
- **URL**: `http://localhost:3007`

Setup:
```bash
npm run test:setup:frontend
```

Used by:
- E2E tests (Playwright)

#### Additional Services

**MailHog** (Email testing):
- **Container**: `l2p-mailhog-test`
- **Web UI**: `http://localhost:8025`
- **SMTP**: `localhost:1025`

**Redis** (Session/Cache):
- **Container**: `l2p-redis-test`
- **Port**: `6380` (mapped to host)

## Running Tests with Infrastructure

### Backend Tests

```bash
cd backend

# Unit tests (with database setup)
npm run test:with-db

# Integration tests (with database setup)
npm run test:integration:with-db

# Run specific integration test
NODE_OPTIONS="--experimental-vm-modules" npx jest src/__tests__/integration/auth.test.ts
```

### Frontend Tests

```bash
cd frontend

# Unit tests (with backend setup)
npm run test:with-backend

# Integration tests (with backend setup)
npm run test:integration:with-backend

# E2E tests (with full setup)
npm run test:e2e:with-setup
```

### Root-Level Test Commands

```bash
# From l2p directory

# Run all unit tests
npm run test:unit

# Run all integration tests
npm run test:integration

# Run all E2E tests
npm run test:e2e

# Run all tests
npm run test:all
```

## Test Database Configuration

The test database uses the following configuration:

**Environment Variables** (in `docker-compose.test.yml`):
```yaml
POSTGRES_DB: l2p_db
POSTGRES_USER: l2p_user
POSTGRES_PASSWORD: [secure password]
```

**Initialization Scripts**:
- `database/init-test.sql` - Schema setup
- `database/test-data.sql` - Test seed data

**Data Persistence**:
- Uses Docker volume: `test_postgres_data`
- Volume can be cleared with: `npm run test:teardown:clean`

## Best Practices

### 1. Always Setup Infrastructure Before Tests

```bash
# Setup infrastructure first
npm run test:setup:backend

# Then run tests
npm run test:integration
```

### 2. Clean Up After Failed Tests

If tests fail or containers get stuck:

```bash
# Clean shutdown and reset
npm run test:teardown:clean

# Setup fresh
npm run test:setup:backend
```

### 3. Use Appropriate Setup for Test Type

| Test Type | Required Setup | Command |
|-----------|---------------|---------|
| Unit Tests | Database (optional) | `npm run test:setup:db` |
| Integration Tests | Database + Backend | `npm run test:setup:backend` |
| E2E Tests | Full Environment | `npm run test:setup:frontend` |

### 4. Check Status Before Running Tests

```bash
# Check if infrastructure is running
npm run test:setup:status

# View service URLs
./scripts/test-setup.sh urls
```

### 5. Use Watch Mode During Development

```bash
# Setup infrastructure once
npm run test:setup:backend

# Run tests in watch mode
cd backend
npm run test:watch
```

## Troubleshooting

### Issue: Database connection fails

**Solution:**
```bash
# Check if database is running
npm run test:setup:status

# If not running, start it
npm run test:setup:db

# Check database health
docker exec l2p-postgres-test pg_isready -U l2p_user -d l2p_db
```

### Issue: Backend health check fails

**Solution:**
```bash
# View backend logs
docker logs l2p-backend-test

# Restart backend
npm run test:teardown
npm run test:setup:backend
```

### Issue: Port conflicts (5432, 3006, 3007 already in use)

**Solution:**
```bash
# Find what's using the port
lsof -i :5432  # or :3006, :3007

# Stop conflicting service or change ports in docker-compose.test.yml
```

### Issue: Tests hang or don't exit

**Solution:**
```bash
# Force cleanup
npm run test:teardown:clean

# Kill any stuck Jest processes
pkill -f jest

# Restart infrastructure
npm run test:setup:backend
```

### Issue: Database has stale data

**Solution:**
```bash
# Clean database and volumes
npm run test:teardown:clean

# Setup fresh database
npm run test:setup:db
```

## CI/CD Integration

For CI environments, use the dedicated CI test scripts:

```bash
# Backend CI tests (use ci environment config)
cd backend
npm run test:unit:ci
npm run test:integration:ci

# Frontend CI tests
cd frontend
npm run test:ci
```

These scripts:
- Use optimized memory settings
- Run in non-interactive mode
- Generate coverage reports
- Exit properly without hanging

## Service URLs Reference

When test infrastructure is running:

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:3007 | E2E testing |
| Backend API | http://localhost:3006/api | Integration/E2E testing |
| Database | postgresql://l2p_user:***@localhost:5432/l2p_db | All tests |
| MailHog UI | http://localhost:8025 | Email testing |
| Redis | redis://localhost:6380 | Session/cache testing |

## Advanced Usage

### Running Tests Against Different Databases

```bash
# Use test database on port 5432
DATABASE_URL=postgresql://l2p_user:password@localhost:5432/l2p_db npm run test:integration

# Use custom database
DATABASE_URL=postgresql://user:pass@host:port/db npm run test:integration
```

### Debugging with Test Infrastructure

```bash
# Start infrastructure in foreground (see logs)
docker-compose -f docker-compose.test.yml up

# Attach to running backend logs
docker logs -f l2p-backend-test

# Execute commands in backend container
docker exec -it l2p-backend-test npm run db:status
```

### Custom Test Configuration

Edit `docker-compose.test.yml` to customize:
- Environment variables
- Port mappings
- Volume mounts
- Health check intervals
- Resource limits

## Summary

The test infrastructure provides isolated, reproducible test environments:

1. **Use `npm run test:setup:db`** for unit tests requiring a database
2. **Use `npm run test:setup:backend`** for integration tests
3. **Use `npm run test:setup:frontend`** for E2E tests
4. **Always `npm run test:teardown:clean`** after major test sessions
5. **Check `npm run test:setup:status`** if tests behave unexpectedly

For more details, see:
- `docker-compose.test.yml` - Infrastructure definition
- `scripts/test-setup.sh` - Setup script
- `scripts/test-environment.sh` - Advanced management
