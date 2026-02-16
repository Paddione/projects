# Security & Infrastructure Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix static file exposure, add graduated rate limiting with warning headers, standardize request ID tracking, and add health endpoints across all services.

**Architecture:** Each service gets its own copies of middleware (no shared packages). Changes are additive — existing behavior is preserved, new headers/endpoints are layered on top. K8s probes are updated to use dedicated health endpoints.

**Tech Stack:** Express.js, express-rate-limit, postgres.js (auth), Prisma (shop), Next.js App Router (shop), Kubernetes deployment manifests

**Design doc:** `docs/plans/2026-02-16-security-infra-hardening-design.md`

---

## Task 1: Untrack .env Files from Git

**Files:**
- Modify: `.gitignore`

**Step 1: Check which .env files are tracked**

Run: `cd /home/patrick/projects && git ls-files | grep -E '\.env' | grep -v '.env.example' | grep -v node_modules`

Expected: List of tracked .env files

**Step 2: Untrack all .env files (keep local copies)**

Run: `cd /home/patrick/projects && git ls-files | grep -E '\.env' | grep -v '.env.example' | grep -v node_modules | xargs -r git rm --cached`

Expected: Files removed from index, local copies preserved

**Step 3: Harden .gitignore**

Replace the existing env section (lines 14-26 of `.gitignore`) with:

```gitignore
# Environment variables (except examples)
**/.env
**/.env-dev
**/.env-test
**/.env-prod
**/.env.local
**/.env.development.local
**/.env.test.local
**/.env.production.local
**/.env.production
*.env

# Keep example files
!.env.example
!**/.env.example
```

**Step 4: Verify no .env files are staged**

Run: `cd /home/patrick/projects && git status | grep -E '\.env' | grep -v '.env.example'`

Expected: Only "deleted" entries for previously tracked files, no new .env files staged

**Step 5: Commit**

```bash
cd /home/patrick/projects
git add .gitignore
git commit -m "security: untrack .env files and harden .gitignore

Remove all .env files from git tracking (local copies preserved).
Add recursive **/.env patterns to prevent future leaks."
```

---

## Task 2: Add Pre-commit Hook for .env Protection

**Files:**
- Create: `.githooks/pre-commit`

**Step 1: Create the pre-commit hook**

Create `.githooks/pre-commit`:

```bash
#!/bin/bash
# Pre-commit hook: reject .env files (except .env.example)

ENV_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.env' | grep -v '\.env\.example$' || true)

if [ -n "$ENV_FILES" ]; then
  echo "ERROR: Attempting to commit .env files:"
  echo "$ENV_FILES"
  echo ""
  echo "Remove them with: git reset HEAD <file>"
  exit 1
fi
```

**Step 2: Make executable and configure git**

Run:
```bash
chmod +x /home/patrick/projects/.githooks/pre-commit
cd /home/patrick/projects && git config core.hooksPath .githooks
```

**Step 3: Test the hook works**

Run:
```bash
cd /home/patrick/projects
echo "TEST=1" > /tmp/test-env-hook.env
cp /tmp/test-env-hook.env test-hook.env
git add test-hook.env
git commit -m "test" 2>&1 || true
git reset HEAD test-hook.env
rm test-hook.env
```

Expected: Commit rejected with "ERROR: Attempting to commit .env files"

**Step 4: Commit**

```bash
cd /home/patrick/projects
git add .githooks/pre-commit
git commit -m "security: add pre-commit hook to reject .env files"
```

---

## Task 3: Gate VideoVault /fixtures Behind Production Check

**Files:**
- Modify: `VideoVault/server/index.ts:62-67`

**Step 1: Update the fixtures mount to check NODE_ENV**

In `VideoVault/server/index.ts`, replace lines 62-67:

```typescript
// Serve fixtures directory for test data
const fixturesPath = path.join(process.cwd(), 'fixtures');
if (fs.existsSync(fixturesPath)) {
  app.use('/fixtures', express.static(fixturesPath));
  logger.info('Fixtures directory mounted', { path: fixturesPath });
}
```

With:

```typescript
// Serve fixtures directory for test data (development only)
if (process.env.NODE_ENV !== 'production') {
  const fixturesPath = path.join(process.cwd(), 'fixtures');
  if (fs.existsSync(fixturesPath)) {
    app.use('/fixtures', express.static(fixturesPath));
    logger.info('Fixtures directory mounted', { path: fixturesPath });
  }
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd /home/patrick/projects/VideoVault && npx tsc --noEmit --project tsconfig.server.json 2>&1 | head -20`

If no `tsconfig.server.json`, try: `cd /home/patrick/projects/VideoVault && npm run check`

Expected: No errors

**Step 3: Commit**

```bash
cd /home/patrick/projects
git add VideoVault/server/index.ts
git commit -m "security: gate VideoVault /fixtures behind production check

Only serve test fixtures directory in development/test environments."
```

---

## Task 4: Add Rate Limit Warning Middleware to L2P

**Files:**
- Create: `l2p/backend/src/middleware/rateLimitWarning.ts`
- Modify: `l2p/backend/src/server.ts`

**Step 1: Create the warning middleware**

Create `l2p/backend/src/middleware/rateLimitWarning.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';

/**
 * Adds X-RateLimit-Warning header when remaining requests drop below 20% of limit.
 * Must be mounted AFTER express-rate-limit (which sets RateLimit-* headers).
 *
 * express-rate-limit with standardHeaders:true already sends:
 *   RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset
 * This middleware reads those and adds a warning signal.
 */
export function rateLimitWarning(req: Request, res: Response, next: NextFunction) {
  const originalWriteHead = res.writeHead;

  res.writeHead = function (this: Response, ...args: Parameters<typeof res.writeHead>) {
    const limit = parseInt(res.getHeader('RateLimit-Limit') as string, 10);
    const remaining = parseInt(res.getHeader('RateLimit-Remaining') as string, 10);

    if (!isNaN(limit) && !isNaN(remaining) && limit > 0) {
      const threshold = Math.ceil(limit * 0.2);
      if (remaining <= threshold && remaining > 0) {
        res.setHeader('X-RateLimit-Warning', 'true');
      }
    }

    return originalWriteHead.apply(this, args);
  } as typeof res.writeHead;

  next();
}
```

**Step 2: Wire into L2P server.ts**

In `l2p/backend/src/server.ts`, add import near line 28 (after correlationId import):

```typescript
import { rateLimitWarning } from './middleware/rateLimitWarning.js';
```

Then after the general rate limiter is applied (after line 339 `app.use('/api/health', healthRoutes);`), add:

```typescript
// Rate limit warning headers (reads RateLimit-Remaining set by express-rate-limit)
app.use(rateLimitWarning);
```

Mount it BEFORE the route handlers but AFTER the rate limiter.

**Step 3: Verify TypeScript compiles**

Run: `cd /home/patrick/projects/l2p/backend && npx tsc --noEmit`

Expected: No errors

**Step 4: Commit**

```bash
cd /home/patrick/projects
git add l2p/backend/src/middleware/rateLimitWarning.ts l2p/backend/src/server.ts
git commit -m "feat(l2p): add rate limit warning headers

Adds X-RateLimit-Warning: true when remaining requests drop below 20%
of the limit. Works with existing express-rate-limit standard headers."
```

---

## Task 5: Add Rate Limit Warning + Retry-After to Auth Service

**Files:**
- Modify: `auth/src/server.ts:98-115`

**Step 1: Add Retry-After to auth rate limiters and add warning middleware**

In `auth/src/server.ts`, replace the rate limiter definitions (lines 98-115) with versions that include custom 429 handlers with `Retry-After`:

```typescript
const authLimiter = isRateLimitDisabled ? noopLimiter : rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.AUTH_RATE_LIMIT_MAX ? parseInt(process.env.AUTH_RATE_LIMIT_MAX) : 100,
  skip: hasBypassKey,
  message: { error: 'Too many requests from this IP, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.setHeader('Retry-After', String(Math.ceil(15 * 60)));
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later',
      retryAfterSeconds: 15 * 60,
    });
  },
});

const strictAuthLimiter = isRateLimitDisabled ? noopLimiter : rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.AUTH_STRICT_RATE_LIMIT_MAX ? parseInt(process.env.AUTH_STRICT_RATE_LIMIT_MAX) : 5,
  skip: hasBypassKey,
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (_req, res) => {
    res.setHeader('Retry-After', String(Math.ceil(15 * 60)));
    res.status(429).json({
      error: 'Too many authentication attempts, please try again later',
      retryAfterSeconds: 15 * 60,
    });
  },
});
```

**Step 2: Add rate limit warning middleware**

After the rate limiter definitions (before `// ROUTES` section at line 117), add:

```typescript
// Rate limit warning: adds X-RateLimit-Warning header when remaining < 20%
function rateLimitWarning(req: express.Request, res: express.Response, next: express.NextFunction) {
  const originalWriteHead = res.writeHead;
  res.writeHead = function (this: express.Response, ...args: Parameters<typeof res.writeHead>) {
    const limit = parseInt(res.getHeader('RateLimit-Limit') as string, 10);
    const remaining = parseInt(res.getHeader('RateLimit-Remaining') as string, 10);
    if (!isNaN(limit) && !isNaN(remaining) && limit > 0) {
      const threshold = Math.ceil(limit * 0.2);
      if (remaining <= threshold && remaining > 0) {
        res.setHeader('X-RateLimit-Warning', 'true');
      }
    }
    return originalWriteHead.apply(this, args);
  } as typeof res.writeHead;
  next();
}

app.use(rateLimitWarning);
```

**Step 3: Verify TypeScript compiles**

Run: `cd /home/patrick/projects/auth && npx tsc --noEmit`

Expected: No errors

**Step 4: Commit**

```bash
cd /home/patrick/projects
git add auth/src/server.ts
git commit -m "feat(auth): add Retry-After header and rate limit warnings

Standardize 429 responses with Retry-After header.
Add X-RateLimit-Warning when remaining requests < 20%."
```

---

## Task 6: Add Rate Limit Warning + Retry-After to VideoVault

**Files:**
- Modify: `VideoVault/server/middleware/rate-limit.ts`

**Step 1: Add Retry-After to all rate limiters**

In `VideoVault/server/middleware/rate-limit.ts`, update the `apiLimiter` handler (replace lines 35-43):

```typescript
        handler: (req, res) => {
            logger.warn('Rate limit exceeded', {
                ip: req.ip,
                path: req.path,
            });
            res.setHeader('Retry-After', String(Math.ceil(15 * 60)));
            res.status(429).json({
                error: 'Too many requests. Please try again later.',
                retryAfterSeconds: 15 * 60,
            });
        },
```

Add a handler to `authLimiter` (after `skipSuccessfulRequests: true` at line 50):

```typescript
        handler: (_req, res) => {
            res.setHeader('Retry-After', String(Math.ceil(15 * 60)));
            res.status(429).json({
                error: 'Too many login attempts. Please wait 15 minutes.',
                retryAfterSeconds: 15 * 60,
            });
        },
```

Add a handler to `uploadLimiter` (after the message at line 62):

```typescript
        handler: (_req, res) => {
            res.setHeader('Retry-After', String(Math.ceil(60 * 60)));
            res.status(429).json({
                error: 'Upload limit reached. Please wait one hour.',
                retryAfterSeconds: 60 * 60,
            });
        },
```

**Step 2: Add warning middleware at the end of setupRateLimiting**

Before the closing `}` of `setupRateLimiting()`, add:

```typescript
    // Rate limit warning: adds X-RateLimit-Warning header when remaining < 20%
    app.use((req, res, next) => {
        const originalWriteHead = res.writeHead;
        res.writeHead = function (this: typeof res, ...args: Parameters<typeof res.writeHead>) {
            const limit = parseInt(res.getHeader('RateLimit-Limit') as string, 10);
            const remaining = parseInt(res.getHeader('RateLimit-Remaining') as string, 10);
            if (!isNaN(limit) && !isNaN(remaining) && limit > 0) {
                const threshold = Math.ceil(limit * 0.2);
                if (remaining <= threshold && remaining > 0) {
                    res.setHeader('X-RateLimit-Warning', 'true');
                }
            }
            return originalWriteHead.apply(this, args);
        } as typeof res.writeHead;
        next();
    });
```

**Step 3: Verify TypeScript compiles**

Run: `cd /home/patrick/projects/VideoVault && npm run check`

Expected: No errors

**Step 4: Commit**

```bash
cd /home/patrick/projects
git add VideoVault/server/middleware/rate-limit.ts
git commit -m "feat(videovault): add Retry-After header and rate limit warnings

Standardize 429 responses with Retry-After header across all limiters.
Add X-RateLimit-Warning when remaining requests < 20%."
```

---

## Task 7: Add Correlation ID Middleware to Auth Service

**Files:**
- Create: `auth/src/middleware/correlationId.ts`
- Modify: `auth/src/server.ts`

**Step 1: Create the correlation ID middleware**

Create `auth/src/middleware/correlationId.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

export const REQUEST_ID_HEADER = 'x-request-id';
export const CORRELATION_ID_HEADER = 'x-correlation-id';

/**
 * Correlation ID middleware.
 * Reads X-Request-Id or X-Correlation-Id from incoming headers if present,
 * otherwise generates a UUIDv4. Attaches to req.correlationId and sets
 * response headers for cross-service tracing.
 */
export function correlationId(req: Request, res: Response, next: NextFunction) {
  const incomingId = (req.header(REQUEST_ID_HEADER) || req.header(CORRELATION_ID_HEADER) || '').trim();
  const id = incomingId || randomUUID();

  (req as any).correlationId = id;

  res.setHeader(REQUEST_ID_HEADER, id);
  res.setHeader(CORRELATION_ID_HEADER, id);

  next();
}
```

**Step 2: Wire into auth server.ts**

In `auth/src/server.ts`, add import at line 10 (after other imports):

```typescript
import { correlationId } from './middleware/correlationId.js';
```

After `app.use(passport.session());` (line 81), add:

```typescript
// Attach correlation ID for request tracing
app.use(correlationId);
```

**Step 3: Verify TypeScript compiles**

Run: `cd /home/patrick/projects/auth && npx tsc --noEmit`

Expected: No errors

**Step 4: Commit**

```bash
cd /home/patrick/projects
git add auth/src/middleware/correlationId.ts auth/src/server.ts
git commit -m "feat(auth): add correlation ID middleware for request tracing

Reads X-Request-Id/X-Correlation-Id from incoming headers or generates
UUIDv4. Sets both headers on response for cross-service tracing."
```

---

## Task 8: Upgrade VideoVault Request ID to Dual-Header Pattern

**Files:**
- Modify: `VideoVault/server/middleware/observability.ts:15-20`

**Step 1: Update requestId middleware to support dual headers**

In `VideoVault/server/middleware/observability.ts`, replace lines 15-20:

```typescript
export function requestId(req: Request, res: Response, next: NextFunction) {
  const id = (req.headers['x-request-id'] as string) || randomUUID();
  req.id = id;
  res.setHeader('X-Request-ID', id);
  next();
}
```

With:

```typescript
const REQUEST_ID_HEADER = 'x-request-id';
const CORRELATION_ID_HEADER = 'x-correlation-id';

export function requestId(req: Request, res: Response, next: NextFunction) {
  const incomingId = (
    (req.headers[REQUEST_ID_HEADER] as string) ||
    (req.headers[CORRELATION_ID_HEADER] as string) ||
    ''
  ).trim();
  const id = incomingId || randomUUID();
  req.id = id;
  res.setHeader('X-Request-ID', id);
  res.setHeader('X-Correlation-ID', id);
  next();
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd /home/patrick/projects/VideoVault && npm run check`

Expected: No errors

**Step 3: Commit**

```bash
cd /home/patrick/projects
git add VideoVault/server/middleware/observability.ts
git commit -m "feat(videovault): upgrade request ID to dual-header pattern

Now reads both X-Request-Id and X-Correlation-Id from incoming headers.
Sets both headers on response for cross-service tracing consistency."
```

---

## Task 9: Add Health Routes to Auth Service

**Files:**
- Create: `auth/src/routes/health.ts`
- Modify: `auth/src/server.ts:122-124`

**Step 1: Create the health router**

Create `auth/src/routes/health.ts`:

```typescript
import { Router } from 'express';
import { client } from '../config/database.js';

const router = Router();

/**
 * GET /health
 * Basic health check with memory and database status
 */
router.get('/', async (_req, res) => {
  const memoryUsage = process.memoryUsage();

  try {
    const start = Date.now();
    await client`SELECT 1`;
    const responseTime = Date.now() - start;

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      service: 'auth',
      environment: process.env.NODE_ENV || 'development',
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
      },
      database: {
        status: 'healthy',
        responseTime,
      },
    });
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      service: 'auth',
      environment: process.env.NODE_ENV || 'development',
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
      },
      database: {
        status: 'unhealthy',
        responseTime: 0,
      },
    });
  }
});

/**
 * GET /health/ready
 * Readiness probe for Kubernetes — checks database connectivity
 */
router.get('/ready', async (_req, res) => {
  try {
    await client`SELECT 1`;
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: { database: 'ok' },
    });
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed',
    });
  }
});

/**
 * GET /health/live
 * Liveness probe for Kubernetes — simple process check
 */
router.get('/live', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    pid: process.pid,
  });
});

/**
 * GET /health/detailed
 * Full health metrics for monitoring dashboards
 */
router.get('/detailed', async (_req, res) => {
  const memoryUsage = process.memoryUsage();
  let dbStatus = 'healthy';
  let dbResponseTime = 0;

  try {
    const start = Date.now();
    await client`SELECT 1`;
    dbResponseTime = Date.now() - start;
  } catch {
    dbStatus = 'unhealthy';
  }

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    status: dbStatus === 'healthy' ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    memory: {
      rss: memoryUsage.rss,
      heapTotal: memoryUsage.heapTotal,
      heapUsed: memoryUsage.heapUsed,
      external: memoryUsage.external,
    },
    checks: {
      server: { status: 'healthy', message: 'Server is running' },
      database: { status: dbStatus, responseTime: dbResponseTime },
    },
  });
});

export default router;
```

**Step 2: Replace inline health handler with router in server.ts**

In `auth/src/server.ts`, add import (near the other route imports at line 18):

```typescript
import healthRoutes from './routes/health.js';
```

Replace the inline health handler (lines 122-124):

```typescript
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});
```

With:

```typescript
app.use('/health', healthRoutes);
```

Also update the SPA fallback at line 210 to skip health routes:

```typescript
if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
```

**Step 3: Verify TypeScript compiles**

Run: `cd /home/patrick/projects/auth && npx tsc --noEmit`

Expected: No errors

**Step 4: Commit**

```bash
cd /home/patrick/projects
git add auth/src/routes/health.ts auth/src/server.ts
git commit -m "feat(auth): add comprehensive health endpoints

Add /health, /health/ready, /health/live, /health/detailed routes
matching L2P's health check pattern for k8s probe compatibility."
```

---

## Task 10: Add Health Routes to Shop Service

**Files:**
- Create: `shop/app/api/health/route.ts`
- Create: `shop/app/api/health/ready/route.ts`
- Create: `shop/app/api/health/live/route.ts`

**Step 1: Create the main health endpoint**

Create `shop/app/api/health/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const memoryUsage = process.memoryUsage();

  try {
    const start = Date.now();
    await db.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - start;

    return NextResponse.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      service: 'shop',
      environment: process.env.NODE_ENV || 'development',
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
      },
      database: { status: 'healthy', responseTime },
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      service: 'shop',
      database: { status: 'unhealthy', responseTime: 0 },
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
```

**Step 2: Create the readiness endpoint**

Create `shop/app/api/health/ready/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: { database: 'ok' },
    }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch {
    return NextResponse.json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed',
    }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
```

**Step 3: Create the liveness endpoint**

Create `shop/app/api/health/live/route.ts`:

```typescript
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    pid: process.pid,
  }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
```

**Step 4: Verify build**

Run: `cd /home/patrick/projects/shop && npx next build 2>&1 | tail -20`

Expected: Build succeeds without errors

**Step 5: Commit**

```bash
cd /home/patrick/projects
git add shop/app/api/health/route.ts shop/app/api/health/ready/route.ts shop/app/api/health/live/route.ts
git commit -m "feat(shop): add health endpoints for k8s probes

Add /api/health, /api/health/ready, /api/health/live routes with
Prisma DB connectivity checks."
```

---

## Task 11: Update K8s Deployment Probes

**Files:**
- Modify: `k8s/services/auth/deployment.yaml:94-117`
- Modify: `k8s/services/shop/deployment.yaml:78-101`

**Step 1: Update auth deployment probes**

In `k8s/services/auth/deployment.yaml`, replace the probe section (lines 94-117):

```yaml
          livenessProbe:
            httpGet:
              path: /health/live
              port: 5500
            initialDelaySeconds: 40
            periodSeconds: 30
            timeoutSeconds: 10
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 5500
            initialDelaySeconds: 10
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          startupProbe:
            httpGet:
              path: /health/live
              port: 5500
            initialDelaySeconds: 10
            periodSeconds: 5
            timeoutSeconds: 5
            failureThreshold: 30
```

**Step 2: Update shop deployment probes**

In `k8s/services/shop/deployment.yaml`, replace the probe section (lines 78-101):

```yaml
          livenessProbe:
            httpGet:
              path: /api/health/live
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 30
            timeoutSeconds: 10
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /api/health/ready
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          startupProbe:
            httpGet:
              path: /api/health/live
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 5
            timeoutSeconds: 5
            failureThreshold: 30
```

**Step 3: Validate YAML syntax**

Run: `python3 -c "import yaml; yaml.safe_load(open('/home/patrick/projects/k8s/services/auth/deployment.yaml')); yaml.safe_load(open('/home/patrick/projects/k8s/services/shop/deployment.yaml')); print('OK')"`

Expected: OK

**Step 4: Commit**

```bash
cd /home/patrick/projects
git add k8s/services/auth/deployment.yaml k8s/services/shop/deployment.yaml
git commit -m "ops: update k8s probes to use dedicated health endpoints

Auth: /health/live (liveness), /health/ready (readiness)
Shop: /api/health/live (liveness), /api/health/ready (readiness)

Previously both used / or /health for all probes."
```

---

## Task 12: Final Verification

**Step 1: Run L2P typecheck**

Run: `cd /home/patrick/projects/l2p/backend && npx tsc --noEmit`

Expected: No errors

**Step 2: Run VideoVault typecheck**

Run: `cd /home/patrick/projects/VideoVault && npm run check`

Expected: No errors

**Step 3: Run Auth typecheck**

Run: `cd /home/patrick/projects/auth && npx tsc --noEmit`

Expected: No errors

**Step 4: Verify no .env files tracked**

Run: `cd /home/patrick/projects && git ls-files | grep -E '\.env' | grep -v '.env.example' | grep -v node_modules`

Expected: Empty output (no .env files tracked)

**Step 5: Review all changes**

Run: `cd /home/patrick/projects && git log --oneline -12`

Expected: 11 commits from this plan, in order:
1. security: untrack .env files and harden .gitignore
2. security: add pre-commit hook to reject .env files
3. security: gate VideoVault /fixtures behind production check
4. feat(l2p): add rate limit warning headers
5. feat(auth): add Retry-After header and rate limit warnings
6. feat(videovault): add Retry-After header and rate limit warnings
7. feat(auth): add correlation ID middleware
8. feat(videovault): upgrade request ID to dual-header
9. feat(auth): add comprehensive health endpoints
10. feat(shop): add health endpoints for k8s probes
11. ops: update k8s probes to use dedicated health endpoints
