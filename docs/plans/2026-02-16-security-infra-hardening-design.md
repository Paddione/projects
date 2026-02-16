# Security & Infrastructure Hardening Design

**Date**: 2026-02-16
**Status**: Approved

## Overview

Address static file exposure, rate limiting gaps, request ID tracking, and health endpoint inconsistencies across L2P, Auth, VideoVault, and Shop services.

## Section 1: Static File Exposure Remediation (High Priority)

### Problem

Several `.env` files are tracked by git. VideoVault serves `/fixtures` in all environments.

### Solution

**1a. Untrack .env files** (`git rm --cached`):
- `auth/.env-dev`
- `shop/.env.local`, `shop/.env-test`, `shop/.next/.env`
- `VideoVault/env/.env-app.local`
- `shared-infrastructure/.env`
- `openclaw/.env`, `openclaw/.env.openclaw`

No full history rewrite (BFG) — private repo, low risk. Rotate secrets after untracking.

**1b. Harden .gitignore** — add explicit subdirectory patterns:
```gitignore
**/.env
**/.env-dev
**/.env-test
**/.env.local
**/.env-prod
!.env.example
!**/.env.example
```

**1c. VideoVault `/fixtures` serving** — gate behind `NODE_ENV !== 'production'` in `VideoVault/server/index.ts`.

**1d. Pre-commit hook** — reject commits containing `.env` files (excluding `.env.example`).

### Files Modified
- `.gitignore`
- `VideoVault/server/index.ts` (conditional `/fixtures` mount)
- `.githooks/pre-commit` (new)

## Section 2: Graduated Rate Limiting (High Priority)

### Problem

All services use binary allow/block at 100 requests/15min. No client-side visibility into remaining quota. Only L2P sends `Retry-After` on 429.

### Current State

All 3 Express services already set `standardHeaders: true`, so `express-rate-limit` emits `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset` headers on every response. Missing:
- Warning signal when approaching limit
- Consistent `Retry-After` on 429 across all services

### Solution

Add per-service middleware (~15 lines) that:
1. Hooks into `res.on('finish')` to read `RateLimit-Remaining` header
2. Sets `X-RateLimit-Warning: true` when remaining < 20% of limit
3. Logs a warning for monitoring

Standardize `Retry-After` header in Auth and VideoVault 429 handlers (L2P already has it).

### Files Modified
- `l2p/backend/src/middleware/rateLimitWarning.ts` (new)
- `l2p/backend/src/server.ts` (wire middleware)
- `auth/src/server.ts` (add Retry-After + warning middleware)
- `VideoVault/server/middleware/rate-limit.ts` (add Retry-After + warning middleware)

## Section 3: Request ID Tracking (Medium Priority)

### Problem

Auth has no request ID tracking. VideoVault's is partial (no `X-Correlation-Id`).

### Solution

Copy L2P's `correlationId.ts` pattern (~28 lines) per-service:

| Service | Action |
|---------|--------|
| L2P | No change (already complete) |
| Auth | Add `middleware/correlationId.ts`, wire into pipeline |
| VideoVault | Upgrade `middleware/observability.ts` to dual-header pattern |
| Shop | Skip (Next.js, different request lifecycle) |

Pattern: reads `X-Request-Id` or `X-Correlation-Id` from incoming headers, generates UUIDv4 if absent, sets both headers on response, attaches `req.correlationId` for logging.

### Files Modified
- `auth/src/middleware/correlationId.ts` (new)
- `auth/src/server.ts` (wire middleware)
- `VideoVault/server/middleware/observability.ts` (upgrade to dual-header)

## Section 4: Standardized Health Endpoints (Medium Priority)

### Problem

Auth has minimal `{ status: 'ok' }` health endpoint. Shop has only a standalone script.

### Solution

Port L2P's health route pattern to Auth and Shop.

**Auth** (Express):
- `GET /health` — enhance with memory + DB status
- `GET /health/ready` — DB connection check (readiness probe)
- `GET /health/live` — simple liveness
- `GET /health/detailed` — full metrics

**Shop** (Next.js API routes):
- `GET /api/health` — Prisma connection check + memory
- `GET /api/health/ready` — Prisma connectivity (readiness probe)
- `GET /api/health/live` — simple liveness

**K8s**: Update Auth and Shop deployment manifests to use `/health/ready` (readiness) and `/health/live` (liveness) probes.

### Files Modified
- `auth/src/routes/health.ts` (new, replaces inline handler)
- `auth/src/server.ts` (mount health router)
- `shop/app/api/health/route.ts` (new)
- `shop/app/api/health/ready/route.ts` (new)
- `shop/app/api/health/live/route.ts` (new)
- `k8s/services/auth/deployment.yaml` (add probes)
- `k8s/services/shop/deployment.yaml` (add probes)

## Priority Order

1. **Section 1** — Static file exposure (security, do first)
2. **Section 2** — Rate limiting (security, quick win)
3. **Section 3** — Request ID tracking (observability)
4. **Section 4** — Health endpoints (operational)

## Out of Scope

- Full BFG history rewrite (private repo, disproportionate risk)
- Shop rate limiting (Next.js, different middleware model — separate task)
- OpenTelemetry / distributed tracing (much larger initiative)
- Debug-only routes (not needed per requirements)
