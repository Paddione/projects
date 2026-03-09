# Arena Testing Guide

Complete testing workflow for Arena project. Follow this sequence to ensure all tests pass before deployment.

## Quick Start

Run the full test suite:

```bash
npm run test:all
```

This runs **unit tests → integration tests → E2E tests** in the correct sequence.

---

## Test Breakdown

### 1️⃣ Frontend Unit Tests

**What:** React component tests (Home, Game, MatchResults, SoundService)
**Coverage:** 91 tests
**Command:** `npm run test:unit` (includes frontend + backend unit)
**Single:** `npm --prefix frontend run test`
**Watch mode:** `npm --prefix frontend run test:watch`
**UI mode:** `npm --prefix frontend run test:ui`

**Files:**
- `frontend/src/components/*.test.tsx`
- `frontend/src/services/*.test.ts`

**Requirements:**
- Vitest with jsdom environment
- React Testing Library
- No database required

**Expected output:**
```
✓ Home.test.tsx (20 tests)
✓ Game.test.tsx (33 tests)
✓ MatchResults.test.tsx (14 tests)
✓ SoundService.test.ts (24 tests)

Test Files  4 passed (4)
Tests       91 passed (91)
```

---

### 2️⃣ Backend Unit Tests

**What:** Service logic tests (LobbyService, GameService, PlayerService, etc.)
**Coverage:** 207 tests
**Command:** `npm run test:unit` (runs both frontend + backend)
**Single:** `cd backend && npm run test:unit`
**Watch mode:** `cd backend && npm run test:watch`
**With coverage:** `cd backend && npm run test:coverage`

**Files:**
- `backend/src/services/*.test.ts` (excludes `.integration.test.ts`)
- `backend/vitest.config.ts` — unit test config

**Requirements:**
- Vitest in Node environment
- No database required
- In-memory services

**Expected output:**
```
✓ LobbyService.test.ts (47 tests)
✓ GameService.test.ts (42 tests)
✓ GameService.features.test.ts (10 tests)
✓ GameService.anticheat.test.ts (5 tests)
✓ PlayerService.test.ts (28 tests)
✓ PlayerService.weapon.test.ts (7 tests)
✓ SocketService.ratelimit.test.ts (7 tests)
✓ app.integration.test.ts (43 tests)  ← NOTE: This is confusingly in unit run

Test Files  9 passed (9)
Tests       207 passed (207)
```

---

### 3️⃣ Backend Integration Tests

**What:** Server startup, database connectivity, real Socket.io events
**Coverage:** 61 tests
**Command:** `npm run test:integration`
**Single:** `cd backend && npm run test:integration`
**Location:** `backend/vitest.integration.config.ts`

**Files:**
- `backend/src/**/*.integration.test.ts`

**Requirements:**
- PostgreSQL connection (shares with unit/dev db if running locally)
- Sequential execution (tests cannot run in parallel)
- 15-second timeout per test
- Real HTTP server on port 3003
- Real Socket.io server

**Expected output:**
```
✓ app.integration.test.ts (Test server routes via HTTP)
✓ SocketService.integration.test.ts (Real socket events)

Test Files  2 passed (2)
Tests       61 passed (61)
```

**Database note:** Tests use the same `DATABASE_URL` as local dev. Make sure PostgreSQL is running:
```bash
# Verify connection
psql -h localhost -U arena_user -d arena_db -c "SELECT 1"
```

---

### 4️⃣ E2E Tests

**What:** Full browser automation (Playwright, Chrome + iPhone 13)
**Coverage:** 70 tests across 5 suites
**Command:** `npm run test:e2e`
**UI mode:** `npm run test:e2e:ui`
**Report:** `npx playwright show-report`

**Files:**
- `e2e/auth.spec.ts` — Auth flow, 401 handling
- `e2e/home.spec.ts` — Lobby creation, validation
- `e2e/lobby.spec.ts` — Lobby state, player ready
- `e2e/mobile.spec.ts` — Touch events, portrait/landscape
- `e2e/game.spec.ts` — Game initialization
- `e2e/performance.spec.ts` — Render performance
- `e2e/results.spec.ts` — Match results display

**Requirements:**
- Frontend dev server (Vite) on port 3002
- **NO backend required** — tests mock all API calls at network layer
- Chrome browser
- Single worker (socket tests need isolation)

**How it works:**
1. Playwright starts `npm run dev:frontend` automatically
2. Tests intercept network calls via `page.route()`
3. Mock helpers (`e2e/helpers/mockApi.ts`) provide fixtures and socket blockers
4. Zero database dependency

**Expected output:**
```
✓ auth.spec.ts (Authentication)
✓ home.spec.ts (Home page)
✓ lobby.spec.ts (Lobby page)
✓ mobile.spec.ts (Mobile portrait + landscape)
✓ game.spec.ts (Game page)
✓ performance.spec.ts (Performance metrics)
✓ results.spec.ts (Results page)

70 passed (1m 12s)
```

---

## Full Test Sequence (Step by Step)

For complete confidence before deployment:

```bash
# From arena/ directory

# Step 1: Unit tests (frontend + backend)
npm run test:unit

# Step 2: Integration tests (requires running database)
npm run test:integration

# Step 3: E2E tests (starts dev server automatically)
npm run test:e2e

# Or all at once:
npm run test:all
```

---

## Common Scenarios

### "I only changed frontend code"

```bash
npm --prefix frontend run test
npm run test:e2e
```

### "I only changed backend services"

```bash
cd backend && npm run test:unit
cd backend && npm run test:integration
```

### "I want to watch tests while coding"

```bash
# Terminal 1 — Frontend
npm --prefix frontend run test:watch

# Terminal 2 — Backend
cd backend && npm run test:watch
```

### "I need coverage reports"

```bash
# Frontend
npm --prefix frontend run test:coverage

# Backend
cd backend && npm run test:coverage
```

### "E2E tests are slow, can I skip some?"

```bash
# Desktop Chrome only
npx playwright test --project=chromium

# Mobile only
npx playwright test --project=mobile-portrait --project=mobile-landscape

# Specific file
npx playwright test e2e/home.spec.ts
```

### "A test is failing, debug it"

```bash
# Show browser UI
npm run test:e2e:ui

# Run single file with verbose output
cd backend && npm run test:unit src/services/GameService.test.ts -- --reporter=verbose
```

---

## Configuration Files

| File | Purpose |
|------|---------|
| `backend/vitest.config.ts` | Unit test setup (Node env, JSM globals) |
| `backend/vitest.integration.config.ts` | Integration test setup (15s timeout, sequential) |
| `frontend/vitest.config.ts` | Frontend test setup (happy-dom environment) |
| `playwright.config.ts` | E2E browser automation (Chrome + iPhone 13 profiles) |

---

## Known Gotchas

### ⚠️ Integration Tests Need Database

Integration tests require a live PostgreSQL connection. If you see:
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

Solution:
```bash
# Start PostgreSQL first
# Then run integration tests
cd backend && npm run test:integration
```

### ⚠️ E2E Tests Mock the Backend

E2E tests **do not** connect to the real backend. They mock all HTTP/WebSocket calls. This means:
- ✅ No database needed
- ✅ Fast (no network latency)
- ❌ Won't catch real backend bugs (that's what integration tests are for)

### ⚠️ Socket Tests Must Run Sequentially

The E2E config sets `workers: 1` because socket tests share port 3002. Running in parallel causes port conflicts.

---

## Test Results Snapshot

**Last verified:** 2026-03-09

| Test Type | Count | Status |
|-----------|-------|--------|
| Frontend unit | 91 | ✅ |
| Backend unit | 207 | ✅ |
| Backend integration | 61 | ✅ |
| E2E | 70 | ✅ |
| **TOTAL** | **429** | **✅ All Passing** |

---

## Next Steps

1. Run `npm run test:all` to verify your setup
2. Review test files to understand coverage
3. Add new tests when implementing features
4. Keep this guide updated as test structure evolves
