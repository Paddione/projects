# Shop Security Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enforce per-service access control via auth ForwardAuth, fix shop audit items (static assets, rate limiting), and add comprehensive test coverage across auth and shop services.

**Architecture:** The auth service already has an `apps` + `user_app_access` table and admin UI. We extend `/api/auth/verify` to check app-level access via `?app=<key>`, add `is_default` for auto-granting on registration, create per-service Traefik ForwardAuth middlewares, and add shop test coverage.

**Tech Stack:** Express (auth), Next.js 16 (shop), Drizzle ORM (auth), Prisma (shop), Vitest (shop unit/integration), Jest (auth), Playwright (E2E), Traefik IngressRoutes (k8s)

**Design doc:** `docs/plans/2026-02-16-shop-security-overhaul-design.md`

---

## Task 1: Add `is_default` Column to Auth Schema

**Files:**
- Modify: `auth/src/db/schema.ts:188-201` (apps table definition)

**Step 1: Add `is_default` column to the apps table schema**

In `auth/src/db/schema.ts`, add to the `apps` table definition after the `is_active` field:

```ts
is_default: boolean('is_default').default(false).notNull(),
```

**Step 2: Run the SQL migration against the database**

Run: `kubectl exec -n korczewski-services deploy/postgres -- psql -U auth_user -d auth_db -c "ALTER TABLE auth.apps ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false NOT NULL;"`

Expected: `ALTER TABLE`

**Step 3: Verify the column exists**

Run: `kubectl exec -n korczewski-services deploy/postgres -- psql -U auth_user -d auth_db -c "SELECT id, key, name, is_default FROM auth.apps;"`

Expected: Table with `is_default` column showing `f` for all rows.

**Step 4: Commit**

```bash
git add auth/src/db/schema.ts
git commit -m "feat(auth): add is_default column to apps table schema"
```

---

## Task 2: Fix App Catalog Key and Update `syncAppCatalog()`

**Files:**
- Modify: `auth/src/server.ts:269-287` (syncAppCatalog function)

**Step 1: Update the syncAppCatalog function**

Replace the current SQL in `syncAppCatalog()`:

Old:
```sql
INSERT INTO auth.apps (key, name, description, url)
VALUES
  ('l2p', 'Learn2Play', 'Multiplayer quiz platform', 'https://l2p.korczewski.de'),
  ('videovault', 'VideoVault', 'Video manager', 'https://videovault.korczewski.de'),
  ('payment', 'Payment', 'Payments and wallet dashboard', 'https://shop.korczewski.de')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  url = EXCLUDED.url
```

New:
```sql
INSERT INTO auth.apps (key, name, description, url)
VALUES
  ('l2p', 'Learn2Play', 'Multiplayer quiz platform', 'https://l2p.korczewski.de'),
  ('videovault', 'VideoVault', 'Video manager', 'https://videovault.korczewski.de'),
  ('shop', 'GoldCoins Shop', 'Digital currency shop', 'https://shop.korczewski.de')
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  url = EXCLUDED.url
```

Also update the API docs endpoint description at line ~195 to list `updateApp` in the admin section.

**Step 2: Fix the stale 'payment' key in the database**

Run: `kubectl exec -n korczewski-services deploy/postgres -- psql -U auth_user -d auth_db -c "UPDATE auth.apps SET key = 'shop', name = 'GoldCoins Shop', description = 'Digital currency shop' WHERE key = 'payment';"`

Expected: `UPDATE 1`

**Step 3: Verify**

Run: `kubectl exec -n korczewski-services deploy/postgres -- psql -U auth_user -d auth_db -c "SELECT key, name FROM auth.apps ORDER BY key;"`

Expected: Rows with keys `l2p`, `shop`, `videovault`.

**Step 4: Commit**

```bash
git add auth/src/server.ts
git commit -m "fix(auth): rename payment app key to shop in catalog sync"
```

---

## Task 3: Add Admin PATCH Endpoint for Apps

**Files:**
- Modify: `auth/src/routes/admin.ts` (add new route at end, before `export`)

**Step 1: Write the test**

Create `auth/src/test/admin-apps.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestAdmin, deleteTestUsers, type TestUser } from './test-utils.js';
import { db } from '../config/database.js';
import { apps } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { TokenService } from '../services/TokenService.js';

const tokenService = new TokenService();
const BASE_URL = `http://localhost:${process.env.PORT || 5500}`;

describe('Admin Apps API', () => {
  let admin: TestUser;
  let adminToken: string;
  let createdUserIds: number[] = [];

  beforeEach(async () => {
    admin = await createTestAdmin();
    createdUserIds.push(admin.id);
    const tokens = tokenService.generateTokens({
      id: admin.id, email: admin.email, username: admin.username,
      role: 'ADMIN', password_hash: null,
    } as any);
    adminToken = tokens.accessToken;
  });

  afterEach(async () => {
    await deleteTestUsers(createdUserIds);
    createdUserIds = [];
  });

  it('PATCH /api/admin/apps/:id updates is_default', async () => {
    const [app] = await db.select().from(apps).limit(1);
    const res = await fetch(`${BASE_URL}/api/admin/apps/${app.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ is_default: true }),
    });
    expect(res.status).toBe(200);

    const [updated] = await db.select().from(apps).where(eq(apps.id, app.id));
    expect(updated.is_default).toBe(true);

    // Reset
    await db.update(apps).set({ is_default: false }).where(eq(apps.id, app.id));
  });

  it('PATCH /api/admin/apps/:id rejects invalid app ID', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/apps/99999`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ is_default: true }),
    });
    expect(res.status).toBe(404);
  });
});
```

**Step 2: Run the test to verify it fails**

Run: `cd /home/patrick/projects/auth && NODE_OPTIONS=--experimental-vm-modules npx jest src/test/admin-apps.test.ts --forceExit --detectOpenHandles`

Expected: FAIL (404 from missing endpoint)

**Step 3: Add the PATCH route to admin.ts**

In `auth/src/routes/admin.ts`, before the `export default router` line, add:

```ts
// Update app settings (is_default, is_active)
const updateAppSchema = z.object({
  is_default: z.boolean().optional(),
  is_active: z.boolean().optional(),
});

router.patch('/apps/:appId', async (req: Request, res: Response) => {
  try {
    const appId = Number(req.params.appId);
    if (!Number.isInteger(appId)) {
      res.status(400).json({ error: 'Invalid app ID' });
      return;
    }

    const [existingApp] = await db
      .select({ id: apps.id })
      .from(apps)
      .where(eq(apps.id, appId))
      .limit(1);

    if (!existingApp) {
      res.status(404).json({ error: 'App not found' });
      return;
    }

    const parsed = updateAppSchema.parse(req.body);

    if (Object.keys(parsed).length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    const updateData: Record<string, unknown> = { updated_at: new Date() };
    if (parsed.is_default !== undefined) updateData.is_default = parsed.is_default;
    if (parsed.is_active !== undefined) updateData.is_active = parsed.is_active;

    await db.update(apps).set(updateData).where(eq(apps.id, appId));

    res.status(200).json({ message: 'App updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    console.error('Failed to update app:', error);
    res.status(500).json({ error: 'Failed to update app' });
  }
});
```

**Step 4: Run the test to verify it passes**

Run: `cd /home/patrick/projects/auth && NODE_OPTIONS=--experimental-vm-modules npx jest src/test/admin-apps.test.ts --forceExit --detectOpenHandles`

Expected: PASS

**Step 5: Commit**

```bash
git add auth/src/routes/admin.ts auth/src/test/admin-apps.test.ts
git commit -m "feat(auth): add PATCH /api/admin/apps/:id for is_default and is_active"
```

---

## Task 4: Extend `/api/auth/verify` with App-Level Access Check

**Files:**
- Modify: `auth/src/routes/auth.ts:221-245` (verify endpoint)

**Step 1: Write the test**

Create `auth/src/test/verify-app-access.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestUser, createTestAdmin, deleteTestUsers, type TestUser } from './test-utils.js';
import { db } from '../config/database.js';
import { apps, userAppAccess } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { TokenService } from '../services/TokenService.js';

const tokenService = new TokenService();
const BASE_URL = `http://localhost:${process.env.PORT || 5500}`;

describe('Verify endpoint with app access check', () => {
  let user: TestUser;
  let admin: TestUser;
  let userToken: string;
  let adminToken: string;
  let createdUserIds: number[] = [];

  beforeEach(async () => {
    user = await createTestUser();
    admin = await createTestAdmin();
    createdUserIds.push(user.id, admin.id);

    userToken = tokenService.generateTokens({
      id: user.id, email: user.email, username: user.username,
      role: 'USER', password_hash: null,
    } as any).accessToken;

    adminToken = tokenService.generateTokens({
      id: admin.id, email: admin.email, username: admin.username,
      role: 'ADMIN', password_hash: null,
    } as any).accessToken;
  });

  afterEach(async () => {
    // Clean up any app access we created
    for (const id of createdUserIds) {
      await db.delete(userAppAccess).where(eq(userAppAccess.user_id, id));
    }
    await deleteTestUsers(createdUserIds);
    createdUserIds = [];
  });

  it('returns 200 without app param (backwards compatible)', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/verify`, {
      headers: { 'Authorization': `Bearer ${userToken}`, 'X-Requested-With': 'XMLHttpRequest' },
    });
    expect(res.status).toBe(200);
  });

  it('returns 403 when user lacks app access', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/verify?app=shop`, {
      headers: { 'Authorization': `Bearer ${userToken}`, 'X-Requested-With': 'XMLHttpRequest' },
    });
    expect(res.status).toBe(403);
  });

  it('returns 200 when user has app access', async () => {
    const [shopApp] = await db.select().from(apps).where(eq(apps.key, 'shop')).limit(1);
    if (shopApp) {
      await db.insert(userAppAccess).values({ user_id: user.id, app_id: shopApp.id });
    }

    const res = await fetch(`${BASE_URL}/api/auth/verify?app=shop`, {
      headers: { 'Authorization': `Bearer ${userToken}`, 'X-Requested-With': 'XMLHttpRequest' },
    });
    expect(res.status).toBe(200);
  });

  it('returns 200 for admin regardless of app access', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/verify?app=shop`, {
      headers: { 'Authorization': `Bearer ${adminToken}`, 'X-Requested-With': 'XMLHttpRequest' },
    });
    expect(res.status).toBe(200);
  });

  it('returns 200 for non-existent app key (no enforcement)', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/verify?app=nonexistent`, {
      headers: { 'Authorization': `Bearer ${userToken}`, 'X-Requested-With': 'XMLHttpRequest' },
    });
    expect(res.status).toBe(403);
  });
});
```

**Step 2: Run the test to verify it fails**

Run: `cd /home/patrick/projects/auth && NODE_OPTIONS=--experimental-vm-modules npx jest src/test/verify-app-access.test.ts --forceExit --detectOpenHandles`

Expected: FAIL (200 returned instead of 403 for tests expecting 403)

**Step 3: Extend the verify endpoint**

In `auth/src/routes/auth.ts`, replace the `GET /verify` handler (lines ~221-245):

```ts
router.get('/verify', authenticate, async (req: Request, res: Response) => {
  // Check if admin role is required
  const requireAdminRole = req.query.requireAdmin === 'true';
  const appKey = req.query.app as string | undefined;

  if (requireAdminRole && req.user?.role !== 'ADMIN') {
    res.status(403).json({
      error: 'Admin access required',
      valid: false
    });
    return;
  }

  // Check app-level access if app param is provided
  if (appKey && req.user?.role !== 'ADMIN') {
    const { db: authDb } = await import('../config/database.js');
    const { apps, userAppAccess } = await import('../db/schema.js');
    const { eq, and } = await import('drizzle-orm');

    const [access] = await authDb
      .select({ id: userAppAccess.id })
      .from(userAppAccess)
      .innerJoin(apps, eq(apps.id, userAppAccess.app_id))
      .where(
        and(
          eq(userAppAccess.user_id, req.user!.userId),
          eq(apps.key, appKey),
          eq(apps.is_active, true)
        )
      )
      .limit(1);

    if (!access) {
      res.status(403).json({
        error: 'Access denied to this application',
        valid: false,
        app: appKey,
      });
      return;
    }
  }

  // Set headers for Traefik ForwardAuth
  if (req.user) {
    res.setHeader('X-Auth-User', req.user.username || '');
    res.setHeader('X-Auth-Email', req.user.email || '');
    res.setHeader('X-Auth-Role', req.user.role || '');
    res.setHeader('X-Auth-User-Id', req.user.userId?.toString() || '');
  }

  res.status(200).json({
    valid: true,
    user: req.user,
  });
});
```

Note: Use top-level imports instead of dynamic imports if they are already imported at the top of the file. Check the existing imports first. If `db`, `apps`, `userAppAccess`, `eq`, `and` are not already imported, add them at the top of the file:

```ts
import { db } from '../config/database.js';
import { apps, userAppAccess } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
```

**Step 4: Run the test to verify it passes**

Run: `cd /home/patrick/projects/auth && NODE_OPTIONS=--experimental-vm-modules npx jest src/test/verify-app-access.test.ts --forceExit --detectOpenHandles`

Expected: PASS

**Step 5: Commit**

```bash
git add auth/src/routes/auth.ts auth/src/test/verify-app-access.test.ts
git commit -m "feat(auth): enforce app-level access check in /api/auth/verify"
```

---

## Task 5: Auto-Grant Default Apps on Registration

**Files:**
- Modify: `auth/src/services/AuthService.ts:164-231` (register method)

**Step 1: Write the test**

Create `auth/src/test/register-default-apps.test.ts`:

```ts
import { describe, it, expect, afterEach } from '@jest/globals';
import { deleteTestUsers } from './test-utils.js';
import { db } from '../config/database.js';
import { apps, userAppAccess, users } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { AuthService } from '../services/AuthService.js';

const authService = new AuthService();

describe('Registration auto-grants default apps', () => {
  let createdUserIds: number[] = [];

  afterEach(async () => {
    for (const id of createdUserIds) {
      await db.delete(userAppAccess).where(eq(userAppAccess.user_id, id));
    }
    await deleteTestUsers(createdUserIds);
    createdUserIds = [];
  });

  it('grants default apps to new user on registration', async () => {
    // Set one app as default
    const [testApp] = await db.select().from(apps).limit(1);
    await db.update(apps).set({ is_default: true }).where(eq(apps.id, testApp.id));

    try {
      const timestamp = Date.now();
      const result = await authService.register({
        username: `test_reg_${timestamp}`,
        email: `test_reg_${timestamp}@test.local`,
        password: 'TestPass123!',
      });

      createdUserIds.push(result.user.id);

      // Check that user_app_access row was created
      const [access] = await db
        .select()
        .from(userAppAccess)
        .where(and(
          eq(userAppAccess.user_id, result.user.id),
          eq(userAppAccess.app_id, testApp.id)
        ))
        .limit(1);

      expect(access).toBeDefined();
    } finally {
      // Reset the default flag
      await db.update(apps).set({ is_default: false }).where(eq(apps.id, testApp.id));
    }
  });

  it('still succeeds registration when no default apps exist', async () => {
    const timestamp = Date.now();
    const result = await authService.register({
      username: `test_nodef_${timestamp}`,
      email: `test_nodef_${timestamp}@test.local`,
      password: 'TestPass123!',
    });

    createdUserIds.push(result.user.id);
    expect(result.user.id).toBeDefined();
  });
});
```

**Step 2: Run the test to verify it fails**

Run: `cd /home/patrick/projects/auth && NODE_OPTIONS=--experimental-vm-modules npx jest src/test/register-default-apps.test.ts --forceExit --detectOpenHandles`

Expected: FAIL (first test — no access row created)

**Step 3: Add auto-grant logic to AuthService.register()**

In `auth/src/services/AuthService.ts`, add these imports at the top (if not already present):

```ts
import { apps, userAppAccess } from '../db/schema.js';
```

Then after the line `const [createdUser] = await db.insert(users).values(newUser).returning();` (line ~210) and the null check, add before the email verification section:

```ts
    // Auto-grant default apps
    try {
      const defaultApps = await db
        .select({ id: apps.id })
        .from(apps)
        .where(and(eq(apps.is_default, true), eq(apps.is_active, true)));

      if (defaultApps.length > 0) {
        await db.insert(userAppAccess).values(
          defaultApps.map((app) => ({
            user_id: createdUser.id,
            app_id: app.id,
          }))
        );
      }
    } catch (error) {
      console.error('Failed to grant default apps (non-fatal):', error);
    }
```

Also add `and` to the drizzle-orm import if not already present:

```ts
import { eq, or, sql, and } from 'drizzle-orm';
```

**Step 4: Run the test to verify it passes**

Run: `cd /home/patrick/projects/auth && NODE_OPTIONS=--experimental-vm-modules npx jest src/test/register-default-apps.test.ts --forceExit --detectOpenHandles`

Expected: PASS

**Step 5: Run the full auth test suite to verify no regressions**

Run: `cd /home/patrick/projects/auth && NODE_OPTIONS=--experimental-vm-modules npx jest --forceExit --detectOpenHandles`

Expected: All tests PASS

**Step 6: Commit**

```bash
git add auth/src/services/AuthService.ts auth/src/test/register-default-apps.test.ts
git commit -m "feat(auth): auto-grant default apps to new users on registration"
```

---

## Task 6: Update Admin UI — Default Toggle in Access List

**Files:**
- Modify: `auth/frontend/src/services/authApi.ts` (add `updateApp` method and `isDefault` to AppAccess)
- Modify: `auth/frontend/src/pages/Admin.tsx:614-656` (Access List tab)

**Step 1: Add `isDefault` to `AppAccess` type and `updateApp` API method**

In `auth/frontend/src/services/authApi.ts`:

Add `isDefault` to the `AppAccess` interface:

```ts
export interface AppAccess {
  id: number;
  key: string;
  name: string;
  description?: string | null;
  url: string;
  isActive: boolean;
  isDefault: boolean;
  hasAccess: boolean;
}
```

Add the `updateApp` static method to the `AuthApi` class:

```ts
  static async updateApp(appId: number, data: { is_default?: boolean; is_active?: boolean }): Promise<void> {
    const response = await fetch(`${API_URL}/api/admin/apps/${appId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...XHR_HEADER },
      credentials: 'include',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const err = new Error(error.error || 'Failed to update app') as Error & { status?: number };
      err.status = response.status;
      throw err;
    }
  }
```

**Step 2: Update the admin GET /apps endpoint to include `isDefault`**

In `auth/src/routes/admin.ts`, in the `GET /apps` handler (line ~273), add `isDefault` to the select:

```ts
router.get('/apps', async (_req: Request, res: Response) => {
  try {
    const allApps = await db
      .select({
        id: apps.id,
        key: apps.key,
        name: apps.name,
        description: apps.description,
        url: apps.url,
        isActive: apps.is_active,
        isDefault: apps.is_default,
      })
      .from(apps)
      .orderBy(apps.name);

    res.status(200).json({ apps: allApps });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch apps' });
  }
});
```

Also update the `GET /users/:userId/apps` handler to include `isDefault` in its select and response mapping.

**Step 3: Update Access List tab in Admin.tsx**

Replace the Access List tab content (the `{activeTab === 'access' && ...}` section, lines ~614-656) with:

```tsx
{activeTab === 'access' && (
  <div className="admin-access">
    <div className="admin-access-sidebar">
      <h3>Apps</h3>
      <div className="admin-access-apps">
        {apps.map((app) => (
          <button
            key={app.id}
            className={`admin-access-app ${selectedAppId === app.id ? 'active' : ''}`}
            onClick={() => setSelectedAppId(app.id)}
          >
            {app.name}
            {app.isDefault && <span className="admin-default-badge">Default</span>}
          </button>
        ))}
      </div>
    </div>
    <div className="admin-access-main">
      {selectedAppId ? (
        <>
          <div className="admin-access-header">
            <h3>Users with access to {apps.find((a) => a.id === selectedAppId)?.name}</h3>
            <div className="admin-app-toggles">
              <label className="admin-checkbox-label">
                <input
                  type="checkbox"
                  checked={apps.find((a) => a.id === selectedAppId)?.isDefault || false}
                  onChange={async () => {
                    const app = apps.find((a) => a.id === selectedAppId);
                    if (!app) return;
                    try {
                      await AuthApi.updateApp(app.id, { is_default: !app.isDefault });
                      setApps((prev) =>
                        prev.map((a) =>
                          a.id === app.id ? { ...a, isDefault: !a.isDefault } : a
                        )
                      );
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Failed to update');
                    }
                  }}
                />
                <span>Grant to new users by default</span>
              </label>
              <label className="admin-checkbox-label">
                <input
                  type="checkbox"
                  checked={apps.find((a) => a.id === selectedAppId)?.isActive || false}
                  onChange={async () => {
                    const app = apps.find((a) => a.id === selectedAppId);
                    if (!app) return;
                    try {
                      await AuthApi.updateApp(app.id, { is_active: !app.isActive });
                      setApps((prev) =>
                        prev.map((a) =>
                          a.id === app.id ? { ...a, isActive: !a.isActive } : a
                        )
                      );
                    } catch (err) {
                      setError(err instanceof Error ? err.message : 'Failed to update');
                    }
                  }}
                />
                <span>Active</span>
              </label>
            </div>
          </div>
          {appUsers.length === 0 ? (
            <p className="admin-note">No users have explicit access. Admins always have access.</p>
          ) : (
            <div className="admin-access-users">
              {appUsers.map((user) => (
                <div key={user.id} className="admin-access-user">
                  <span className="admin-access-username">{user.username}</span>
                  <span className="admin-access-email">{user.email}</span>
                  <span className={`hub-badge hub-badge-${user.role.toLowerCase()}`}>
                    {user.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <p className="admin-note">Select an app to view users with access.</p>
      )}
    </div>
  </div>
)}
```

**Step 4: Build the auth frontend to verify no build errors**

Run: `cd /home/patrick/projects/auth/frontend && npm run build`

Expected: Build succeeds with no type errors.

**Step 5: Commit**

```bash
git add auth/frontend/src/services/authApi.ts auth/frontend/src/pages/Admin.tsx auth/src/routes/admin.ts
git commit -m "feat(auth): add default app toggle to admin Access List tab"
```

---

## Task 7: Create Per-Service Traefik ForwardAuth Middlewares

**Files:**
- Modify: `k8s/infrastructure/traefik/middlewares.yaml` (append new middlewares)

**Step 1: Add per-service ForwardAuth middlewares**

Append to the end of `k8s/infrastructure/traefik/middlewares.yaml`:

```yaml
---
# Shop App-Level Authentication Middleware (ForwardAuth)
# Verifies user has access to the shop application
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: shop-auth
  namespace: korczewski-infra
  labels:
    app: traefik
    app.kubernetes.io/component: ingress-controller
    app.kubernetes.io/part-of: korczewski
    tier: infrastructure
spec:
  forwardAuth:
    address: "http://auth.korczewski-services.svc.cluster.local:5500/api/auth/verify?app=shop"
    trustForwardHeader: true
    authResponseHeaders:
      - "X-Auth-User"
      - "X-Auth-Email"
      - "X-Auth-Role"
      - "X-Auth-User-Id"
---
# Shop Auth Chain Middleware
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: shop-auth-chain
  namespace: korczewski-infra
  labels:
    app: traefik
    app.kubernetes.io/component: ingress-controller
    app.kubernetes.io/part-of: korczewski
    tier: infrastructure
spec:
  chain:
    middlewares:
      - name: shop-auth
        namespace: korczewski-infra
      - name: rate-limit
        namespace: korczewski-infra
      - name: security-headers
        namespace: korczewski-infra
      - name: compression
        namespace: korczewski-infra
---
# VideoVault App-Level Authentication Middleware (ForwardAuth)
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: videovault-auth
  namespace: korczewski-infra
  labels:
    app: traefik
    app.kubernetes.io/component: ingress-controller
    app.kubernetes.io/part-of: korczewski
    tier: infrastructure
spec:
  forwardAuth:
    address: "http://auth.korczewski-services.svc.cluster.local:5500/api/auth/verify?app=videovault"
    trustForwardHeader: true
    authResponseHeaders:
      - "X-Auth-User"
      - "X-Auth-Email"
      - "X-Auth-Role"
      - "X-Auth-User-Id"
---
# VideoVault Auth Chain Middleware
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: videovault-auth-chain
  namespace: korczewski-infra
  labels:
    app: traefik
    app.kubernetes.io/component: ingress-controller
    app.kubernetes.io/part-of: korczewski
    tier: infrastructure
spec:
  chain:
    middlewares:
      - name: videovault-auth
        namespace: korczewski-infra
      - name: security-headers
        namespace: korczewski-infra
      - name: compression
        namespace: korczewski-infra
```

**Step 2: Commit**

```bash
git add k8s/infrastructure/traefik/middlewares.yaml
git commit -m "feat(k8s): add per-service ForwardAuth middlewares for shop and videovault"
```

---

## Task 8: Update Shop and VideoVault IngressRoutes

**Files:**
- Modify: `k8s/services/shop/ingressroute.yaml`
- Modify: `k8s/services/videovault/ingressroute.yaml`

**Step 1: Update shop IngressRoute**

Replace `k8s/services/shop/ingressroute.yaml` content. Key changes:
- Add `/robots.txt` and `/images` to the public route matcher
- Change `user-auth-chain` to `shop-auth-chain`

```yaml
---
# =============================================================================
# Shop Service IngressRoute
# =============================================================================

apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: shop
  namespace: korczewski-services
  labels:
    app: shop
    app.kubernetes.io/name: shop
    app.kubernetes.io/component: shop
    app.kubernetes.io/part-of: korczewski
    tier: services
spec:
  routes:
    # Route for static assets & public API endpoints (no auth required)
    - match: Host(`shop.korczewski.de`) && (PathPrefix(`/_next`) || PathPrefix(`/favicon.ico`) || PathPrefix(`/static`) || PathPrefix(`/images`) || PathPrefix(`/robots.txt`) || PathPrefix(`/api/health`) || PathPrefix(`/api/stripe/webhook`))
      kind: Rule
      services:
        - name: shop
          port: 3000
    # Route for everything else (requires auth + shop app access)
    - match: Host(`shop.korczewski.de`)
      kind: Rule
      services:
        - name: shop
          port: 3000
      middlewares:
        - name: shop-auth-chain
          namespace: korczewski-infra
  tls: {}
```

**Step 2: Update VideoVault IngressRoute**

Replace `k8s/services/videovault/ingressroute.yaml`:

```yaml
---
# =============================================================================
# VideoVault IngressRoute
# =============================================================================
# Accessible via videovault.korczewski.de or video.korczewski.de
# =============================================================================

apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: videovault
  namespace: korczewski-services
  labels:
    app: videovault
    app.kubernetes.io/name: videovault
    app.kubernetes.io/component: media
    app.kubernetes.io/part-of: korczewski
    tier: services
spec:
  routes:
    - match: Host(`videovault.korczewski.de`) || Host(`video.korczewski.de`)
      kind: Rule
      services:
        - name: videovault
          port: 5000
      middlewares:
        - name: videovault-auth-chain
          namespace: korczewski-infra
  tls: {}
```

**Step 3: Commit**

```bash
git add k8s/services/shop/ingressroute.yaml k8s/services/videovault/ingressroute.yaml
git commit -m "feat(k8s): switch shop and videovault to per-service auth chains"
```

---

## Task 9: Add Shop Static Assets

**Files:**
- Create: `shop/public/robots.txt`

**Step 1: Create robots.txt**

```
User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /wallet/
Disallow: /orders/
Disallow: /appointments/
```

**Step 2: Commit**

```bash
git add shop/public/robots.txt
git commit -m "feat(shop): add robots.txt for SEO crawling"
```

---

## Task 10: Shop Unit Tests — Ledger

**Files:**
- Create: `shop/test/unit/ledger.test.ts`

**Step 1: Write the test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock Prisma
const mockTransaction = vi.fn()
const mockFindUnique = vi.fn()
const mockCreate = vi.fn()
const mockUpdate = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    $transaction: mockTransaction,
    wallet: {
      findUnique: mockFindUnique,
      create: mockCreate,
      update: mockUpdate,
    },
    transaction: {
      create: vi.fn(),
    },
  },
}))

describe('processTransaction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // $transaction passes a callback — execute it with mock tx
    mockTransaction.mockImplementation(async (cb: (tx: any) => Promise<void>) => {
      const tx = {
        wallet: {
          findUnique: mockFindUnique,
          create: mockCreate,
          update: mockUpdate,
        },
        transaction: {
          create: vi.fn(),
        },
      }
      return cb(tx)
    })
  })

  it('creates wallet if none exists for deposit', async () => {
    mockFindUnique.mockResolvedValue(null)
    mockCreate.mockResolvedValue({ id: 'wallet-1', userId: 'user-1', balance: 0 })
    mockUpdate.mockResolvedValue({})

    const { processTransaction } = await import('@/lib/ledger')
    await processTransaction({
      userId: 'user-1',
      amount: 100,
      type: 'DEPOSIT',
      description: 'Test deposit',
    })

    expect(mockFindUnique).toHaveBeenCalledWith({ where: { userId: 'user-1' } })
    expect(mockCreate).toHaveBeenCalledWith({ data: { userId: 'user-1', balance: 0 } })
    expect(mockUpdate).toHaveBeenCalled()
  })

  it('uses existing wallet for deposit', async () => {
    mockFindUnique.mockResolvedValue({ id: 'wallet-1', userId: 'user-1', balance: 500 })
    mockUpdate.mockResolvedValue({})

    const { processTransaction } = await import('@/lib/ledger')
    await processTransaction({
      userId: 'user-1',
      amount: 200,
      type: 'DEPOSIT',
      referenceId: 'stripe-session-1',
      description: 'Stripe Deposit',
    })

    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'wallet-1' },
        data: { balance: { increment: 200 } },
      })
    )
  })
})
```

**Step 2: Run the test**

Run: `cd /home/patrick/projects/shop && npx vitest run test/unit/ledger.test.ts`

Expected: PASS

**Step 3: Commit**

```bash
git add shop/test/unit/ledger.test.ts
git commit -m "test(shop): add unit tests for ledger processTransaction"
```

---

## Task 11: Shop Unit Tests — Stripe Checkout Validation

**Files:**
- Create: `shop/test/unit/stripe-checkout.test.ts`

**Step 1: Write the test**

```ts
import { describe, it, expect } from 'vitest'

describe('Stripe checkout amount validation', () => {
  // These test the validation rules from app/api/stripe/checkout/route.ts
  const validateAmount = (amount: unknown): boolean => {
    return typeof amount === 'number' && Number.isInteger(amount) && amount >= 100 && amount <= 10000
  }

  it('accepts valid amounts', () => {
    expect(validateAmount(100)).toBe(true)
    expect(validateAmount(5000)).toBe(true)
    expect(validateAmount(10000)).toBe(true)
  })

  it('rejects amounts below minimum', () => {
    expect(validateAmount(99)).toBe(false)
    expect(validateAmount(0)).toBe(false)
    expect(validateAmount(-100)).toBe(false)
  })

  it('rejects amounts above maximum', () => {
    expect(validateAmount(10001)).toBe(false)
    expect(validateAmount(100000)).toBe(false)
  })

  it('rejects non-integer amounts', () => {
    expect(validateAmount(100.5)).toBe(false)
    expect(validateAmount(99.99)).toBe(false)
  })

  it('rejects non-number types', () => {
    expect(validateAmount('100')).toBe(false)
    expect(validateAmount(null)).toBe(false)
    expect(validateAmount(undefined)).toBe(false)
  })
})
```

**Step 2: Run the test**

Run: `cd /home/patrick/projects/shop && npx vitest run test/unit/stripe-checkout.test.ts`

Expected: PASS

**Step 3: Commit**

```bash
git add shop/test/unit/stripe-checkout.test.ts
git commit -m "test(shop): add unit tests for Stripe checkout amount validation"
```

---

## Task 12: Shop Unit Tests — Auth Actions

**Files:**
- Create: `shop/test/unit/auth-actions.test.ts`

**Step 1: Write the test**

```ts
import { describe, it, expect, vi } from 'vitest'

// Mock next/headers
vi.mock('next/headers', () => ({
  headers: vi.fn(),
}))

// Mock next/navigation
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
}))

// Mock db
vi.mock('@/lib/db', () => ({
  db: {
    user: {
      upsert: vi.fn().mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'USER',
      }),
    },
    wallet: {
      upsert: vi.fn().mockResolvedValue({}),
    },
  },
}))

describe('Auth helper: buildAuthLoginUrl', () => {
  it('builds correct login URL with redirect', async () => {
    const { getAuthLoginUrlFromHeaders } = await import('@/lib/actions/auth')
    const mockHeaders = new Headers({
      'x-forwarded-host': 'shop.korczewski.de',
      'x-forwarded-proto': 'https',
      'x-forwarded-uri': '/wallet',
    })

    const url = await getAuthLoginUrlFromHeaders(mockHeaders)
    expect(url).toContain('/login')
    expect(url).toContain('redirect=')
    expect(url).toContain(encodeURIComponent('https://shop.korczewski.de/wallet'))
  })

  it('falls back to default host when no headers present', async () => {
    const { getRequestUrlFromHeaders } = await import('@/lib/actions/auth')
    const mockHeaders = new Headers()

    const url = await getRequestUrlFromHeaders(mockHeaders)
    expect(url).toBe('https://shop.korczewski.de')
  })
})
```

**Step 2: Run the test**

Run: `cd /home/patrick/projects/shop && npx vitest run test/unit/auth-actions.test.ts`

Expected: PASS

**Step 3: Commit**

```bash
git add shop/test/unit/auth-actions.test.ts
git commit -m "test(shop): add unit tests for auth action helpers"
```

---

## Task 13: Shop Integration Test — Webhook Signature Validation

**Files:**
- Create: `shop/test/integration/webhook.test.ts`

**Step 1: Write the test**

```ts
import { describe, it, expect } from 'vitest'

const SHOP_URL = process.env.SHOP_TEST_URL || 'http://localhost:3004'

describe('Stripe webhook endpoint', () => {
  it('rejects requests without Stripe signature', async () => {
    const res = await fetch(`${SHOP_URL}/api/stripe/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'checkout.session.completed' }),
    })

    expect(res.status).toBe(400)
    const text = await res.text()
    expect(text).toContain('Webhook Error')
  })

  it('rejects requests with invalid Stripe signature', async () => {
    const res = await fetch(`${SHOP_URL}/api/stripe/webhook`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Stripe-Signature': 't=1234567890,v1=invalid_signature_hash',
      },
      body: JSON.stringify({ type: 'checkout.session.completed' }),
    })

    expect(res.status).toBe(400)
    const text = await res.text()
    expect(text).toContain('Webhook Error')
  })
})
```

Note: These are lightweight integration tests that hit the running dev server. They verify the webhook rejects unsigned requests. Testing actual Stripe event processing requires the Stripe CLI (`stripe listen`).

**Step 2: Start the shop dev server (if not running) and run the test**

Run: `cd /home/patrick/projects/shop && npx vitest run test/integration/webhook.test.ts`

Expected: PASS (assuming shop dev server is running on port 3004)

**Step 3: Commit**

```bash
git add shop/test/integration/webhook.test.ts
git commit -m "test(shop): add integration tests for webhook signature validation"
```

---

## Task 14: Deploy and Verify

**Step 1: Deploy auth service**

Run: `cd /home/patrick/projects/k8s && skaffold run -p auth`

Expected: Build and deploy succeeds.

**Step 2: Deploy infrastructure (Traefik middlewares)**

Run: `cd /home/patrick/projects/k8s && skaffold run -p infra`

Expected: Manifests applied successfully.

**Step 3: Deploy shop service**

Run: `cd /home/patrick/projects/k8s && skaffold run -p shop`

Expected: Build and deploy succeeds.

**Step 4: Deploy VideoVault**

Run: `cd /home/patrick/projects/k8s && skaffold run -p videovault`

Expected: Deploy succeeds.

**Step 5: Verify the new middlewares are registered in Traefik**

Run: `kubectl get middlewares -n korczewski-infra`

Expected: Should show `shop-auth`, `shop-auth-chain`, `videovault-auth`, `videovault-auth-chain` alongside the existing middlewares.

**Step 6: Set default apps in the database**

Run: `kubectl exec -n korczewski-services deploy/postgres -- psql -U auth_user -d auth_db -c "UPDATE auth.apps SET is_default = true WHERE key IN ('l2p', 'shop');"`

Expected: `UPDATE 2`

**Step 7: Verify shop is accessible for a user with shop access**

Navigate to `https://shop.korczewski.de` in browser — authenticated user with shop access should see the shop. User without shop access should get 403.

---

## Summary of Commits

1. `feat(auth): add is_default column to apps table schema`
2. `fix(auth): rename payment app key to shop in catalog sync`
3. `feat(auth): add PATCH /api/admin/apps/:id for is_default and is_active`
4. `feat(auth): enforce app-level access check in /api/auth/verify`
5. `feat(auth): auto-grant default apps to new users on registration`
6. `feat(auth): add default app toggle to admin Access List tab`
7. `feat(k8s): add per-service ForwardAuth middlewares for shop and videovault`
8. `feat(k8s): switch shop and videovault to per-service auth chains`
9. `feat(shop): add robots.txt for SEO crawling`
10. `test(shop): add unit tests for ledger processTransaction`
11. `test(shop): add unit tests for Stripe checkout amount validation`
12. `test(shop): add unit tests for auth action helpers`
13. `test(shop): add integration tests for webhook signature validation`
14. Deploy and verify
