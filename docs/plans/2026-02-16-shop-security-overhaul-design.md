# Shop Service Security Overhaul Design

**Date**: 2026-02-16
**Scope**: Auth service ACL enforcement, shop audit fixes, comprehensive test suite
**Services affected**: auth, shop, k8s/infrastructure (Traefik middlewares)

## Background

A security audit of the shop service identified enhancements in three categories: static asset optimization, developer experience (health endpoints, rate limiting), and UX improvements (login page for unauthenticated users). The UX item evolved into a proper service-level access control system, leveraging the auth service's existing app catalog infrastructure.

## Current State

### Auth Service (already has)
- `auth.apps` table: app catalog with `key`, `name`, `description`, `url`, `is_active`
- `auth.user_app_access` table: per-user app access mapping
- `auth.access_requests` table: user-initiated access requests with admin review
- Admin panel (React SPA): tabs for Access Requests, Users, Access List
- Hub page: users see their apps, request access to new ones
- `syncAppCatalog()` seeds L2P, VideoVault, Payment on startup
- ForwardAuth via `/api/auth/verify` — checks identity only, not app-level access

### Shop Service (current gaps)
- No `robots.txt` in public assets
- No rate limiting at Traefik level on shop routes
- App catalog registers shop as `'payment'` (stale name)
- Limited test coverage: 1 unit test (booking), 4 E2E tests
- Health endpoints exist and work (`/api/health`, `/api/health/live`, `/api/health/ready`)

## Design

### 1. Service-Level Access Control (Auth Service)

#### 1A. Database: `is_default` column on `apps`

Add `is_default BOOLEAN DEFAULT false NOT NULL` to `auth.apps` table.

**Schema change** (`auth/src/db/schema.ts`):
```ts
is_default: boolean('is_default').default(false).notNull(),
```

**Migration**: `ALTER TABLE auth.apps ADD COLUMN is_default BOOLEAN DEFAULT false NOT NULL;`

Update `syncAppCatalog()` to not overwrite `is_default` (use `ON CONFLICT ... DO UPDATE SET name, description, url` — exclude `is_default`).

#### 1B. Auto-Grant Default Apps on Registration

In `AuthService.register()`, after inserting the user:

1. Query `SELECT id FROM auth.apps WHERE is_default = true AND is_active = true`
2. Insert `user_app_access` rows for each default app

This runs inside the same transaction-like flow as user creation. If app access insert fails, registration still succeeds (non-fatal, logged).

#### 1C. ForwardAuth App-Level Access Check

Extend `GET /api/auth/verify` to accept optional `?app=<key>` query param:

1. Authenticate user (existing behavior)
2. If `app` param present:
   - If user role is `ADMIN`, skip check (implicit full access)
   - Otherwise query `user_app_access` joined with `apps` on `key`
   - Return 403 `{ error: 'Access denied to this application' }` if no match
3. If `app` param absent, behave as before (identity-only check)

**Traefik middleware changes** (`k8s/infrastructure/traefik/middlewares.yaml`):

Create per-service ForwardAuth middlewares:
- `shop-auth`: address `http://auth.../api/auth/verify?app=shop`
- `videovault-auth`: address `http://auth.../api/auth/verify?app=videovault`
- `l2p-auth`: address (future, L2P uses `default-chain` today)

Create corresponding chain middlewares:
- `shop-auth-chain`: `shop-auth` + `security-headers` + `compression`
- `videovault-auth-chain`: `videovault-auth` + `security-headers` + `compression`

Update IngressRoutes to use the new per-service chains instead of generic `user-auth-chain`.

#### 1D. Admin UI: Default App Toggle

In `Admin.tsx` Access List tab, add a toggle/checkbox column for "Default" beside each app:

- Calls new `PATCH /api/admin/apps/:id` backend endpoint
- Endpoint accepts `{ is_default?: boolean, is_active?: boolean }`
- Shows visual indicator of which apps new users auto-receive

**New admin route** (`auth/src/routes/admin.ts`):
```
PATCH /api/admin/apps/:id
Body: { is_default?: boolean, is_active?: boolean }
```

### 2. Shop Service Enhancements

#### 2A. Static Asset Optimization

- Add `shop/public/robots.txt` allowing crawling of public pages
- Add `/public/images/` and `/robots.txt` to the IngressRoute public route matcher

#### 2B. Traefik Rate Limiting

Add existing `rate-limit` middleware to shop IngressRoute chain. The middleware is already defined (100 req/s avg, 200 burst). Just reference it in the shop route.

#### 2C. App Catalog Key Fix

In `auth/src/server.ts` `syncAppCatalog()`:
- Change `('payment', 'Payment', ...)` to `('shop', 'GoldCoins Shop', 'Digital currency shop', 'https://shop.korczewski.de')`

### 3. Test Suite

#### 3A. Unit Tests (shop, Vitest)

| Test file | What it tests |
|-----------|---------------|
| `test/unit/ledger.test.ts` | `processTransaction()`: deposits, purchases, wallet creation |
| `test/unit/stripe-checkout.test.ts` | Amount validation (min/max/integer), auth requirement |
| `test/unit/auth-actions.test.ts` | `getCurrentUser()` header parsing, `requireAuth()` redirect |

#### 3B. Integration Tests (shop, Vitest)

| Test file | What it tests |
|-----------|---------------|
| `test/integration/webhook.test.ts` | Stripe signature validation, deposit processing |
| `test/integration/purchase-flow.test.ts` | Full purchase: balance check, stock decrement, order creation |

#### 3C. E2E Enhancements (shop, Playwright)

- Admin panel flow: product CRUD with admin headers
- Wallet top-up: mock Stripe checkout redirect
- Notification bell visibility for admin users

#### 3D. Auth Service Tests

- Unit test for `verify` endpoint with `?app=` param
- Test auto-grant of default apps on registration
- Test admin `PATCH /api/admin/apps/:id`

## Files Changed

### Auth Service
- `auth/src/db/schema.ts` — add `is_default` to `apps` table
- `auth/src/services/AuthService.ts` — auto-grant default apps in `register()`
- `auth/src/routes/auth.ts` — extend `/verify` with `?app=` check
- `auth/src/routes/admin.ts` — add `PATCH /api/admin/apps/:id`
- `auth/src/server.ts` — fix `syncAppCatalog()` key + API docs
- `auth/frontend/src/pages/Admin.tsx` — default toggle in Access List
- `auth/frontend/src/services/authApi.ts` — add `updateApp()` method

### Shop Service
- `shop/public/robots.txt` — new file
- `shop/test/unit/ledger.test.ts` — new
- `shop/test/unit/stripe-checkout.test.ts` — new
- `shop/test/unit/auth-actions.test.ts` — new
- `shop/test/integration/webhook.test.ts` — new
- `shop/test/integration/purchase-flow.test.ts` — new
- `shop/test/e2e/admin.spec.ts` — enhance

### Kubernetes
- `k8s/infrastructure/traefik/middlewares.yaml` — per-service ForwardAuth + chains
- `k8s/services/shop/ingressroute.yaml` — use `shop-auth-chain` + add rate limiting
- `k8s/services/videovault/ingressroute.yaml` — use `videovault-auth-chain`

## Non-Goals

- No changes to L2P's IngressRoute (uses `default-chain` with ~40 public endpoints)
- No Next.js middleware rate limiting (using Traefik instead)
- No public browsing (all pages remain gated behind ForwardAuth)
- No load testing framework setup (manual verification via Traefik metrics)
