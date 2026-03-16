# Phase 1: Shared Platform Foundation — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the auth service to be the platform identity + economy layer, then migrate L2P and Arena to read profiles from auth instead of local storage.

**Architecture:** Auth service gets 6 new tables (profiles, inventory, loadouts, shop_catalog, transactions, match_escrow) in the `auth` schema. New REST endpoints for profile CRUD, loadout management, catalog browsing, and Respect economy. L2P's CharacterService and Arena's lobby join flow are updated to call auth APIs instead of querying local tables. Internal service-to-service calls use a shared API key.

**Tech Stack:** Express, Drizzle ORM (pgSchema 'auth'), Zod validation, Jest (ESM) for auth/l2p, Vitest for arena, existing JWT/session auth

**Note:** Internal API routes use `/api/internal/*` prefix (deviation from spec's `/api/respect/*` and `/api/match/*`). This provides clearer separation between public and service-to-service endpoints. L2P/Arena clients use `authFetchInternal('/api/internal/...')` paths.

**Spec:** `docs/superpowers/specs/2026-03-16-shared-platform-economy-design.md`

---

## File Structure

### Auth Service — New Files
```
auth/src/
├── db/schema.ts                          # MODIFY: Add 6 new tables
├── services/
│   ├── ProfileService.ts                 # CREATE: Profile CRUD, level calculation
│   └── RespectService.ts                 # CREATE: Respect credit/debit, item purchases, transactions
├── routes/
│   ├── profile.ts                        # CREATE: Profile + loadout endpoints
│   ├── catalog.ts                        # CREATE: Shop catalog + purchase endpoints
│   └── internal.ts                       # CREATE: Internal credit/debit/escrow endpoints
├── middleware/
│   └── internalAuth.ts                   # CREATE: X-Internal-API-Key validation
├── types/
│   └── platform.ts                       # CREATE: Profile, Inventory, Loadout, etc. types
├── test/
│   ├── profile.test.ts                   # CREATE: ProfileService tests
│   ├── respect.test.ts                   # CREATE: RespectService tests
│   ├── internal-auth.test.ts             # CREATE: Internal auth middleware tests
│   ├── profile-routes.test.ts            # CREATE: Profile route integration tests
│   ├── catalog-routes.test.ts            # CREATE: Catalog route integration tests
│   └── internal-routes.test.ts           # CREATE: Internal route integration tests
└── server.ts                             # MODIFY: Mount new routes
auth/migrations/
└── 005_add_platform_tables.sql           # CREATE: New table DDL
```

### L2P Backend — Modified Files
```
l2p/backend/src/
├── services/CharacterService.ts          # MODIFY: Call auth API instead of local DB queries
├── routes/characters.ts                  # MODIFY: Pass auth token to CharacterService
└── config/authClient.ts                  # CREATE: HTTP client for auth service calls
```

> **Note:** `GameProfileService.ts` and `middleware/auth.ts` are not modified in Phase 1. The auth middleware already populates `req.user` via JWT; CharacterService is the only consumer of profile data that changes. `GameProfileService.getOrCreateProfile()` calls will be replaced inside CharacterService methods.

### Arena Backend — Modified Files
```
arena/backend/src/
├── services/SocketService.ts             # MODIFY: Fetch profile from auth on lobby join
├── services/LobbyService.ts             # MODIFY: Accept character from auth profile
├── types/game.ts                        # MODIFY: Add gender to PlayerState, ArenaPlayer
└── config/authClient.ts                  # CREATE: HTTP client for auth service calls
```

---

## Chunk 1: Auth Schema & Migration

### Task 1: Define Platform Types

**Files:**
- Create: `auth/src/types/platform.ts`

- [ ] **Step 1: Create platform type definitions**

```typescript
// auth/src/types/platform.ts
export interface Profile {
  userId: number;
  displayName: string | null;
  selectedCharacter: string;
  selectedGender: string;
  selectedPowerUp: string | null;
  respectBalance: number;
  xpTotal: number;
  level: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface InventoryItem {
  id: number;
  userId: number;
  itemId: string;
  itemType: 'skin' | 'emote' | 'title' | 'border' | 'power_up';
  acquiredAt: Date;
  acquisitionSource: 'respect_purchase' | 'stripe' | 'achievement' | 'level_unlock';
}

export interface Loadout {
  userId: number;
  equippedSkin: string | null;
  equippedEmote1: string | null;
  equippedEmote2: string | null;
  equippedEmote3: string | null;
  equippedEmote4: string | null;
  equippedTitle: string | null;
  equippedBorder: string | null;
  equippedPowerUp: string | null;
  updatedAt: Date;
}

export interface CatalogItem {
  itemId: string;
  itemType: string;
  name: string;
  description: string | null;
  respectCost: number;
  unlockLevel: number | null;
  gender: string | null;
  character: string | null;
  previewAssetUrl: string | null;
  active: boolean;
}

export interface Transaction {
  id: number;
  userId: number;
  type: 'respect_purchase' | 'item_purchase' | 'xp_bet' | 'respect_earned' | 'xp_refund';
  currency: 'respect' | 'xp';
  amount: number;
  itemId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
}

export interface MatchEscrow {
  id: number;
  token: string;
  playerIds: number[];
  escrowedXp: Record<string, number>;
  matchConfig: Record<string, unknown> | null;
  status: 'pending' | 'active' | 'settled' | 'refunded';
  expiresAt: Date;
  createdAt: Date;
  settledAt: Date | null;
}

export interface ProfileWithLoadout extends Profile {
  loadout: Loadout;
  inventory: InventoryItem[];
}

export interface PurchaseResult {
  success: boolean;
  item: InventoryItem;
  newBalance: number;
}
```

- [ ] **Step 2: Verify types compile**

Run: `cd /home/patrick/projects/auth && npx tsc --noEmit`
Expected: No errors from platform.ts

- [ ] **Step 3: Commit**

```bash
git add auth/src/types/platform.ts
git commit -m "feat(auth): add platform type definitions for profiles, inventory, loadouts"
```

---

### Task 2: Add Drizzle Schema Tables

**Files:**
- Modify: `auth/src/db/schema.ts` (after line 233, before type exports)

- [ ] **Step 1: Write failing test for schema export**

```typescript
// auth/src/test/schema.test.ts
import { profiles, inventory, loadouts, shopCatalog, transactions, matchEscrow } from '../db/schema.js';

describe('Platform Schema', () => {
  it('should export all platform tables', () => {
    expect(profiles).toBeDefined();
    expect(inventory).toBeDefined();
    expect(loadouts).toBeDefined();
    expect(shopCatalog).toBeDefined();
    expect(transactions).toBeDefined();
    expect(matchEscrow).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/patrick/projects/auth && NODE_OPTIONS=--experimental-vm-modules npx jest src/test/schema.test.ts -v`
Expected: FAIL — cannot find `profiles` export

- [ ] **Step 3: Add tables to schema.ts**

Add after the existing `accessRequests` table and before type exports in `auth/src/db/schema.ts`:

```typescript
// ─── Platform: Profiles ──────────────────────────────────
export const profiles = authSchema.table('profiles', {
  userId: integer('user_id').primaryKey().references(() => users.id),
  displayName: varchar('display_name', { length: 50 }),
  selectedCharacter: varchar('selected_character', { length: 50 }).default('student').notNull(),
  selectedGender: varchar('selected_gender', { length: 10 }).default('male').notNull(),
  selectedPowerUp: varchar('selected_power_up', { length: 50 }),
  respectBalance: integer('respect_balance').default(0).notNull(),
  xpTotal: integer('xp_total').default(0).notNull(),
  level: integer('level').default(1).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Platform: Inventory ─────────────────────────────────
export const inventory = authSchema.table('inventory', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  itemId: varchar('item_id', { length: 100 }).notNull(),
  itemType: varchar('item_type', { length: 20 }).notNull(),
  acquiredAt: timestamp('acquired_at', { withTimezone: true }).defaultNow().notNull(),
  acquisitionSource: varchar('acquisition_source', { length: 30 }).notNull(),
}, (table) => ({
  userIdIdx: index('idx_inventory_user_id').on(table.userId),
  uniqueUserItem: uniqueIndex('idx_inventory_user_item').on(table.userId, table.itemId),
}));

// ─── Platform: Loadouts ──────────────────────────────────
export const loadouts = authSchema.table('loadouts', {
  userId: integer('user_id').primaryKey().references(() => users.id),
  equippedSkin: varchar('equipped_skin', { length: 100 }),
  equippedEmote1: varchar('equipped_emote_1', { length: 100 }),
  equippedEmote2: varchar('equipped_emote_2', { length: 100 }),
  equippedEmote3: varchar('equipped_emote_3', { length: 100 }),
  equippedEmote4: varchar('equipped_emote_4', { length: 100 }),
  equippedTitle: varchar('equipped_title', { length: 100 }),
  equippedBorder: varchar('equipped_border', { length: 100 }),
  equippedPowerUp: varchar('equipped_power_up', { length: 50 }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── Platform: Shop Catalog ──────────────────────────────
export const shopCatalog = authSchema.table('shop_catalog', {
  itemId: varchar('item_id', { length: 100 }).primaryKey(),
  itemType: varchar('item_type', { length: 20 }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  respectCost: integer('respect_cost').notNull(),
  unlockLevel: integer('unlock_level'),
  gender: varchar('gender', { length: 10 }),
  character: varchar('character', { length: 50 }),
  previewAssetUrl: varchar('preview_asset_url', { length: 255 }),
  active: boolean('active').default(true).notNull(),
});

// ─── Platform: Transactions ──────────────────────────────
export const transactions = authSchema.table('transactions', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id).notNull(),
  type: varchar('type', { length: 30 }).notNull(),
  currency: varchar('currency', { length: 10 }).default('respect').notNull(),
  amount: integer('amount').notNull(),
  itemId: varchar('item_id', { length: 100 }),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('idx_transactions_user_id').on(table.userId),
}));

// ─── Platform: Match Escrow ──────────────────────────────
export const matchEscrow = authSchema.table('match_escrow', {
  id: serial('id').primaryKey(),
  token: varchar('token', { length: 64 }).unique().notNull(),
  playerIds: integer('player_ids').array().notNull(),
  escrowedXp: jsonb('escrowed_xp').notNull(),
  matchConfig: jsonb('match_config'),
  status: varchar('status', { length: 20 }).default('pending').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  settledAt: timestamp('settled_at', { withTimezone: true }),
});
```

Also add the necessary imports at top of schema.ts: `index`, `uniqueIndex`, `text`, `boolean`, `jsonb` from `drizzle-orm/pg-core`.

Add type exports at end of file:
```typescript
export type ProfileRecord = typeof profiles.$inferSelect;
export type ProfileInsert = typeof profiles.$inferInsert;
export type InventoryRecord = typeof inventory.$inferSelect;
export type InventoryInsert = typeof inventory.$inferInsert;
export type LoadoutRecord = typeof loadouts.$inferSelect;
export type LoadoutInsert = typeof loadouts.$inferInsert;
export type CatalogRecord = typeof shopCatalog.$inferSelect;
export type TransactionRecord = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type EscrowRecord = typeof matchEscrow.$inferSelect;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/patrick/projects/auth && NODE_OPTIONS=--experimental-vm-modules npx jest src/test/schema.test.ts -v`
Expected: PASS

- [ ] **Step 5: Run full typecheck**

Run: `cd /home/patrick/projects/auth && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add auth/src/db/schema.ts auth/src/test/schema.test.ts
git commit -m "feat(auth): add platform schema tables (profiles, inventory, loadouts, catalog, transactions, escrow)"
```

---

### Task 3: Write Migration Script

**Files:**
- Create: `auth/migrations/005_add_platform_tables.sql`
- Modify: `auth/migrations/run-migrations.ts`

- [ ] **Step 1: Create SQL migration file**

```sql
-- 005_add_platform_tables.sql
-- Platform economy tables for shared profile, inventory, and Respect currency

CREATE TABLE IF NOT EXISTS auth.profiles (
  user_id INTEGER PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name VARCHAR(50),
  selected_character VARCHAR(50) NOT NULL DEFAULT 'student',
  selected_gender VARCHAR(10) NOT NULL DEFAULT 'male' CHECK (selected_gender IN ('male', 'female')),
  selected_power_up VARCHAR(50),
  respect_balance INTEGER NOT NULL DEFAULT 0,
  xp_total INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth.inventory (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id VARCHAR(100) NOT NULL,
  item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('skin', 'emote', 'title', 'border', 'power_up')),
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acquisition_source VARCHAR(30) NOT NULL CHECK (acquisition_source IN ('respect_purchase', 'stripe', 'achievement', 'level_unlock')),
  UNIQUE(user_id, item_id)
);
CREATE INDEX IF NOT EXISTS idx_inventory_user_id ON auth.inventory(user_id);

CREATE TABLE IF NOT EXISTS auth.loadouts (
  user_id INTEGER PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  equipped_skin VARCHAR(100),
  equipped_emote_1 VARCHAR(100),
  equipped_emote_2 VARCHAR(100),
  equipped_emote_3 VARCHAR(100),
  equipped_emote_4 VARCHAR(100),
  equipped_title VARCHAR(100),
  equipped_border VARCHAR(100),
  equipped_power_up VARCHAR(50),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS auth.shop_catalog (
  item_id VARCHAR(100) PRIMARY KEY,
  item_type VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  respect_cost INTEGER NOT NULL,
  unlock_level INTEGER,
  gender VARCHAR(10),
  character VARCHAR(50),
  preview_asset_url VARCHAR(255),
  active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS auth.transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL CHECK (type IN ('respect_purchase', 'item_purchase', 'xp_bet', 'respect_earned', 'xp_refund')),
  currency VARCHAR(10) NOT NULL DEFAULT 'respect' CHECK (currency IN ('respect', 'xp')),
  amount INTEGER NOT NULL,
  item_id VARCHAR(100),
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON auth.transactions(user_id);

CREATE TABLE IF NOT EXISTS auth.match_escrow (
  id SERIAL PRIMARY KEY,
  token VARCHAR(64) UNIQUE NOT NULL,
  player_ids INTEGER[] NOT NULL,
  escrowed_xp JSONB NOT NULL,
  match_config JSONB,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'settled', 'refunded')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  settled_at TIMESTAMPTZ
);

-- Seed default catalog items (free power-up + free emotes)
INSERT INTO auth.shop_catalog (item_id, item_type, name, description, respect_cost, unlock_level) VALUES
  ('power_shield', 'power_up', 'Shield', 'Arena: +25 starting armor. L2P: Block one wrong answer penalty.', 0, NULL),
  ('power_haste', 'power_up', 'Haste', 'Arena: +10% move speed. L2P: +5s time per question.', 500, NULL),
  ('power_vampiric', 'power_up', 'Vampiric', 'Arena: Heal 15% on kill. L2P: Steal 10% XP from lowest scorer.', 1000, NULL),
  ('power_lucky', 'power_up', 'Lucky', 'Arena: Better loot spawns. L2P: One free 50/50 hint.', 750, NULL),
  ('power_fury', 'power_up', 'Fury', 'Arena: +15% damage first 30s. L2P: 2x XP first 3 questions.', 1500, NULL),
  ('emote_wave', 'emote', 'Wave', 'A friendly wave.', 0, NULL),
  ('emote_gg', 'emote', 'GG', 'Good game!', 0, NULL),
  ('emote_thumbsup', 'emote', 'Thumbs Up', 'Thumbs up!', 250, NULL),
  ('emote_clap', 'emote', 'Clap', 'Applause.', 250, NULL),
  ('emote_shrug', 'emote', 'Shrug', 'Who knows?', 500, NULL),
  ('emote_taunt', 'emote', 'Taunt', 'Come at me!', 500, NULL),
  ('emote_dance', 'emote', 'Dance', 'Dance moves.', 750, NULL),
  ('emote_facepalm', 'emote', 'Facepalm', 'Oh no...', 750, NULL),
  ('border_default', 'border', 'Default', 'Standard border.', 0, NULL),
  ('border_bronze', 'border', 'Bronze', 'Bronze frame.', 300, NULL),
  ('border_silver', 'border', 'Silver', 'Silver frame.', 750, NULL),
  ('border_gold', 'border', 'Gold', 'Gold frame.', 1500, NULL),
  ('border_diamond', 'border', 'Diamond', 'Diamond frame.', 3000, NULL),
  ('border_flame', 'border', 'Flame', 'Burning frame.', 2000, NULL)
ON CONFLICT (item_id) DO NOTHING;

-- Migrate existing users: create profile row for each user
INSERT INTO auth.profiles (user_id, display_name, selected_character, xp_total, level)
SELECT id, name, COALESCE(selected_character, 'student'), COALESCE(experience_points, 0),
  COALESCE(character_level, 1)
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Create empty loadout for each user
INSERT INTO auth.loadouts (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Grant free items to all existing users
INSERT INTO auth.inventory (user_id, item_id, item_type, acquisition_source)
SELECT u.id, i.item_id, i.item_type, 'level_unlock'
FROM auth.users u
CROSS JOIN auth.shop_catalog i
WHERE i.respect_cost = 0
ON CONFLICT (user_id, item_id) DO NOTHING;
```

- [ ] **Step 2: Add migration to run-migrations.ts**

Add a new migration check in `auth/migrations/run-migrations.ts` after the existing migrations:

```typescript
// Check for platform tables
const profilesExists = await sql`SELECT to_regclass('auth.profiles')`;
if (!profilesExists[0].to_regclass) {
  console.log('Running migration 005: Platform tables...');
  const migration005 = readFileSync(join(migrationsDir, '005_add_platform_tables.sql'), 'utf8');
  await sql.unsafe(migration005);
  console.log('Migration 005 complete.');
} else {
  console.log('Migration 005: Platform tables already exist, skipping.');
}
```

- [ ] **Step 3: Test migration locally**

Run: `cd /home/patrick/projects/auth && npm run db:migrate`
Expected: "Running migration 005: Platform tables..." or "already exist, skipping."

- [ ] **Step 4: Verify tables exist**

Run: `cd /home/patrick/projects/auth && npx tsx -e "import postgres from 'postgres'; const sql = postgres(process.env.DATABASE_URL || process.env.AUTH_DATABASE_URL); const r = await sql\`SELECT table_name FROM information_schema.tables WHERE table_schema = 'auth' ORDER BY table_name\`; console.log(r.map(t => t.table_name)); await sql.end()"`
Expected: List includes profiles, inventory, loadouts, shop_catalog, transactions, match_escrow

- [ ] **Step 5: Commit**

```bash
git add auth/migrations/005_add_platform_tables.sql auth/migrations/run-migrations.ts
git commit -m "feat(auth): add migration 005 for platform tables with catalog seed data"
```

---

## Chunk 2: Auth Services & Internal Auth

### Task 4: Internal Auth Middleware

**Files:**
- Create: `auth/src/middleware/internalAuth.ts`
- Create: `auth/src/test/internal-auth.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// auth/src/test/internal-auth.test.ts
import { describe, it, expect, beforeAll } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { internalAuth } from '../middleware/internalAuth.js';

describe('internalAuth middleware', () => {
  const app = express();
  app.use(express.json());

  app.get('/test', internalAuth, (_req, res) => {
    res.json({ ok: true });
  });

  it('should reject requests without API key', async () => {
    const res = await request(app).get('/test');
    expect(res.status).toBe(401);
  });

  it('should reject requests with wrong API key', async () => {
    const res = await request(app).get('/test').set('X-Internal-API-Key', 'wrong');
    expect(res.status).toBe(401);
  });

  it('should accept requests with valid API key', async () => {
    const res = await request(app).get('/test').set('X-Internal-API-Key', process.env.INTERNAL_API_KEY || 'test-internal-key');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/patrick/projects/auth && INTERNAL_API_KEY=test-internal-key NODE_OPTIONS=--experimental-vm-modules npx jest src/test/internal-auth.test.ts -v`
Expected: FAIL — cannot find `internalAuth`

- [ ] **Step 3: Implement middleware**

```typescript
// auth/src/middleware/internalAuth.ts
import { Request, Response, NextFunction } from 'express';

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || '';

export function internalAuth(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers['x-internal-api-key'] as string;
  if (!INTERNAL_API_KEY || key !== INTERNAL_API_KEY) {
    res.status(401).json({ error: 'Invalid or missing internal API key' });
    return;
  }
  next();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/patrick/projects/auth && INTERNAL_API_KEY=test-internal-key NODE_OPTIONS=--experimental-vm-modules npx jest src/test/internal-auth.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add auth/src/middleware/internalAuth.ts auth/src/test/internal-auth.test.ts
git commit -m "feat(auth): add internal API key middleware for service-to-service auth"
```

---

### Task 5: ProfileService

**Files:**
- Create: `auth/src/services/ProfileService.ts`
- Create: `auth/src/test/profile.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// auth/src/test/profile.test.ts
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ProfileService } from '../services/ProfileService.js';
import { createTestUser, deleteTestUser } from './test-utils.js';

describe('ProfileService', () => {
  const profileService = new ProfileService();
  let testUserId: number;

  beforeEach(async () => {
    const user = await createTestUser();
    testUserId = user.id;
  });

  afterEach(async () => {
    await deleteTestUser(testUserId);
  });

  describe('getOrCreateProfile', () => {
    it('should create a profile if none exists', async () => {
      const profile = await profileService.getOrCreateProfile(testUserId);
      expect(profile.userId).toBe(testUserId);
      expect(profile.selectedCharacter).toBe('student');
      expect(profile.selectedGender).toBe('male');
      expect(profile.respectBalance).toBe(0);
      expect(profile.level).toBe(1);
    });

    it('should return existing profile on second call', async () => {
      await profileService.getOrCreateProfile(testUserId);
      const profile = await profileService.getOrCreateProfile(testUserId);
      expect(profile.selectedCharacter).toBe('student');
    });
  });

  describe('updateCharacter', () => {
    it('should update character and gender', async () => {
      await profileService.getOrCreateProfile(testUserId);
      const updated = await profileService.updateCharacter(testUserId, 'professor', 'female');
      expect(updated.selectedCharacter).toBe('professor');
      expect(updated.selectedGender).toBe('female');
    });
  });

  describe('updateLoadout', () => {
    it('should update equipped power-up', async () => {
      await profileService.getOrCreateProfile(testUserId);
      const loadout = await profileService.updateLoadout(testUserId, { equippedPowerUp: 'power_shield' });
      expect(loadout.equippedPowerUp).toBe('power_shield');
    });
  });

  describe('getProfileWithLoadout', () => {
    it('should return profile with loadout and inventory', async () => {
      await profileService.getOrCreateProfile(testUserId);
      const full = await profileService.getProfileWithLoadout(testUserId);
      expect(full.loadout).toBeDefined();
      expect(full.inventory).toBeDefined();
      expect(Array.isArray(full.inventory)).toBe(true);
    });
  });

  describe('calculateLevel', () => {
    it('should return level 1 for 0 XP', () => {
      expect(ProfileService.calculateLevel(0)).toBe(1);
    });

    it('should increase level with XP', () => {
      expect(ProfileService.calculateLevel(10000)).toBeGreaterThan(1);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/patrick/projects/auth && NODE_OPTIONS=--experimental-vm-modules npx jest src/test/profile.test.ts -v`
Expected: FAIL — cannot find `ProfileService`

- [ ] **Step 3: Implement ProfileService**

Create `auth/src/services/ProfileService.ts` with methods:
- `getOrCreateProfile(userId)` — INSERT ON CONFLICT DO NOTHING, then SELECT
- `updateCharacter(userId, character, gender)` — UPDATE profiles SET selected_character, selected_gender
- `updateLoadout(userId, updates)` — UPSERT loadouts
- `getProfileWithLoadout(userId)` — JOIN profiles + loadouts + inventory
- `awardXp(userId, amount)` — UPDATE xp_total, recalculate level
- `static calculateLevel(xpTotal)` — exponential formula (matching L2P's)

Use the existing `getDb()` pattern from `auth/src/config/database.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/patrick/projects/auth && NODE_OPTIONS=--experimental-vm-modules npx jest src/test/profile.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add auth/src/services/ProfileService.ts auth/src/test/profile.test.ts
git commit -m "feat(auth): add ProfileService for profile CRUD, loadout management, XP/level"
```

---

### Task 6: RespectService

**Files:**
- Create: `auth/src/services/RespectService.ts`
- Create: `auth/src/test/respect.test.ts`

- [ ] **Step 1: Write failing tests**

Tests for: `creditRespect(userId, amount, source)`, `debitRespect(userId, amount, reason)`, `getBalance(userId)`, `purchaseItem(userId, itemId)`.

Key test cases:
- Credit increases balance + creates transaction record
- Debit decreases balance + creates transaction record
- Debit with insufficient balance returns error (402)
- Purchase checks ownership (409 if owned), level requirement (403), balance (402)
- Successful purchase: debits respect, adds to inventory, logs transaction

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/patrick/projects/auth && NODE_OPTIONS=--experimental-vm-modules npx jest src/test/respect.test.ts -v`
Expected: FAIL

- [ ] **Step 3: Implement RespectService**

Key methods:
- `creditRespect(userId, amount, metadata?)` — atomic: UPDATE profiles.respect_balance + INSERT transaction
- `debitRespect(userId, amount, metadata?)` — check balance >= amount, then atomic update + log
- `purchaseItem(userId, itemId)` — validates: item exists, not owned, level met, balance sufficient. Single DB transaction: debit + insert inventory + log transaction
- `getBalance(userId)` — SELECT respect_balance FROM profiles

All balance-changing operations must be atomic (single SQL transaction).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/patrick/projects/auth && NODE_OPTIONS=--experimental-vm-modules npx jest src/test/respect.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add auth/src/services/RespectService.ts auth/src/test/respect.test.ts
git commit -m "feat(auth): add RespectService for Respect economy (credit, debit, purchase)"
```

---

### Task 7: Profile Routes

**Files:**
- Create: `auth/src/routes/profile.ts`
- Create: `auth/src/test/profile-routes.test.ts`
- Modify: `auth/src/server.ts`

- [ ] **Step 1: Write failing route tests**

```typescript
// auth/src/test/profile-routes.test.ts
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../server.js';
import { createTestUser, deleteTestUser } from './test-utils.js';

describe('Profile Routes', () => {
  let testUser: any;
  let token: string;

  beforeAll(async () => {
    testUser = await createTestUser();
    // Login to get token
    const loginRes = await request(app).post('/api/auth/login')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ usernameOrEmail: testUser.username, password: testUser.password });
    token = loginRes.body.accessToken || loginRes.headers['set-cookie']?.[0];
  });

  afterAll(async () => { await deleteTestUser(testUser.id); });

  it('GET /api/profile should return profile with loadout', async () => {
    const res = await request(app).get('/api/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.selectedCharacter).toBe('student');
    expect(res.body.loadout).toBeDefined();
  });

  it('PUT /api/profile/character should update character and gender', async () => {
    const res = await request(app).put('/api/profile/character')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ character: 'professor', gender: 'female' });
    expect(res.status).toBe(200);
    expect(res.body.selectedCharacter).toBe('professor');
    expect(res.body.selectedGender).toBe('female');
  });

  it('PUT /api/profile/loadout should update equipped items', async () => {
    const res = await request(app).put('/api/profile/loadout')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ equippedPowerUp: 'power_shield' });
    expect(res.status).toBe(200);
    expect(res.body.equippedPowerUp).toBe('power_shield');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/patrick/projects/auth && NODE_OPTIONS=--experimental-vm-modules npx jest src/test/profile-routes.test.ts -v`
Expected: FAIL — route not found

- [ ] **Step 3: Implement profile routes**

Create `auth/src/routes/profile.ts` with:
- `GET /api/profile` — `authenticate` middleware, calls `profileService.getProfileWithLoadout(req.user.userId)`
- `PUT /api/profile/character` — `authenticate` middleware, Zod validates `{ character: z.string(), gender: z.enum(['male', 'female']) }`, calls `profileService.updateCharacter()`
- `PUT /api/profile/loadout` — `authenticate` middleware, Zod validates optional equipped fields, validates all items owned, calls `profileService.updateLoadout()`
- `GET /api/profile/:userId` — `authenticate` middleware, returns public profile subset

Mount in `auth/src/server.ts`: `app.use('/api', profileRoutes);`

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /home/patrick/projects/auth && NODE_OPTIONS=--experimental-vm-modules npx jest src/test/profile-routes.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add auth/src/routes/profile.ts auth/src/test/profile-routes.test.ts auth/src/server.ts
git commit -m "feat(auth): add profile API routes (GET profile, PUT character, PUT loadout)"
```

---

### Task 8: Catalog Routes

**Files:**
- Create: `auth/src/routes/catalog.ts`
- Create: `auth/src/test/catalog-routes.test.ts`
- Modify: `auth/src/server.ts`

- [ ] **Step 1: Write failing route tests**

Tests for:
- `GET /api/catalog` — returns seeded items (power-ups, emotes, borders)
- `GET /api/catalog?type=emote` — filters by item_type
- `POST /api/catalog/purchase` with insufficient Respect → 402
- `POST /api/catalog/purchase` for already owned item → 409
- `POST /api/catalog/purchase` successful → 200 + new balance

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /home/patrick/projects/auth && NODE_OPTIONS=--experimental-vm-modules npx jest src/test/catalog-routes.test.ts -v`
Expected: FAIL

- [ ] **Step 3: Implement catalog routes**

Create `auth/src/routes/catalog.ts` with:
- `GET /api/catalog` — public (no auth required), query param `?type=emote` filters
- `POST /api/catalog/purchase` — `authenticate` middleware, calls `respectService.purchaseItem(userId, itemId)`

Mount in `auth/src/server.ts`: `app.use('/api', catalogRoutes);`

- [ ] **Step 4: Run test to verify it passes**

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add auth/src/routes/catalog.ts auth/src/test/catalog-routes.test.ts auth/src/server.ts
git commit -m "feat(auth): add catalog API routes (browse catalog, purchase items)"
```

---

### Task 9: Internal Routes

**Files:**
- Create: `auth/src/routes/internal.ts`
- Create: `auth/src/test/internal-routes.test.ts`
- Modify: `auth/src/server.ts`

- [ ] **Step 1: Write failing route tests**

Tests for:
- `POST /api/internal/respect/credit` without API key → 401
- `POST /api/internal/respect/credit` with valid key → credits Respect
- `POST /api/internal/respect/debit` with valid key → debits Respect
- `POST /api/internal/xp/award` with valid key → awards XP, recalculates level

- [ ] **Step 2: Run test to verify it fails**

Expected: FAIL

- [ ] **Step 3: Implement internal routes**

Create `auth/src/routes/internal.ts` with `internalAuth` middleware on all endpoints:
- `POST /api/internal/respect/credit` — `{ userId, amount, metadata? }` → `respectService.creditRespect()`
- `POST /api/internal/respect/debit` — `{ userId, amount, metadata? }` → `respectService.debitRespect()`
- `POST /api/internal/xp/award` — `{ userId, amount }` → `profileService.awardXp()`
- `POST /api/internal/match/escrow` — `{ playerIds, escrowedXp, matchConfig }` → creates escrow row
- `POST /api/internal/match/settle` — `{ token, winnerId }` → settles escrow
- `GET /api/internal/match/escrow/:token` — returns escrow data for Arena validation

Mount in `auth/src/server.ts`: `app.use('/api', internalRoutes);`

- [ ] **Step 4: Run test to verify it passes**

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add auth/src/routes/internal.ts auth/src/test/internal-routes.test.ts auth/src/server.ts
git commit -m "feat(auth): add internal API routes (respect credit/debit, XP award, match escrow)"
```

---

## Chunk 3: L2P & Arena Migration

### Task 10: Auth Client Utility

**Files:**
- Create: `l2p/backend/src/config/authClient.ts`
- Create: `arena/backend/src/config/authClient.ts`

- [ ] **Step 1: Create shared auth client pattern**

Both L2P and Arena need an HTTP client to call auth service APIs. Create in each project:

```typescript
// l2p/backend/src/config/authClient.ts (same pattern for arena)
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:5500';
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || '';

export async function authFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const url = `${AUTH_SERVICE_URL}${path}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  return fetch(url, { ...options, headers });
}

export async function authFetchInternal(path: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Internal-API-Key': INTERNAL_API_KEY,
    ...(options.headers as Record<string, string> || {}),
  };
  return authFetch(path, { ...options, headers });
}

export async function fetchUserProfile(authToken: string): Promise<any> {
  const res = await authFetch('/api/profile', {
    headers: { 'Authorization': `Bearer ${authToken}` },
  });
  if (!res.ok) return null;
  return res.json();
}
```

- [ ] **Step 2: Commit**

```bash
git add l2p/backend/src/config/authClient.ts arena/backend/src/config/authClient.ts
git commit -m "feat(l2p,arena): add auth service HTTP client utility"
```

---

### Task 11: L2P Backend — getUserCharacterInfo Migration

**Files:**
- Modify: `l2p/backend/src/services/CharacterService.ts` (lines 373-432)

- [ ] **Step 1: Add auth token parameter to getUserCharacterInfo**

Change signature from `getUserCharacterInfo(userId)` to `getUserCharacterInfo(userId, authToken?)`. When `authToken` is provided, call `fetchUserProfile(authToken)` from `authClient.ts` instead of `gameProfileService.getOrCreateProfile()`.

- [ ] **Step 2: Update character routes to pass token**

In `l2p/backend/src/routes/characters.ts`, extract token from request and pass it:
```typescript
const authToken = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.accessToken;
const info = await characterService.getUserCharacterInfo(userId, authToken);
```
Apply to: `GET /api/characters/available` (line 63), `GET /api/characters/profile` (line 110).

- [ ] **Step 3: Run L2P tests**

Run: `cd /home/patrick/projects/l2p/backend && NODE_OPTIONS=--experimental-vm-modules npx jest --forceExit --detectOpenHandles`
Expected: PASS (falls back to local DB when auth service unreachable)

- [ ] **Step 4: Commit**

```bash
git add l2p/backend/src/services/CharacterService.ts l2p/backend/src/routes/characters.ts
git commit -m "refactor(l2p): getUserCharacterInfo reads profile from auth service"
```

---

### Task 12: L2P Backend — updateCharacter Migration

**Files:**
- Modify: `l2p/backend/src/services/CharacterService.ts` (lines 186-241)

- [ ] **Step 1: Replace updateCharacter DB query with auth API call**

Change `updateCharacter(userId, characterId)` to call auth service `PUT /api/profile/character` with `{ character: characterId, gender: 'male' }` (gender defaults to current; full gender support comes in Phase 3). Pass auth token forwarded from route.

- [ ] **Step 2: Update PUT /api/characters/select route**

In `characters.ts` (line 151), pass auth token to `updateCharacter()`.

- [ ] **Step 3: Run L2P tests**

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add l2p/backend/src/services/CharacterService.ts l2p/backend/src/routes/characters.ts
git commit -m "refactor(l2p): updateCharacter proxies to auth service API"
```

---

### Task 13: L2P Backend — awardExperience Migration

**Files:**
- Modify: `l2p/backend/src/services/CharacterService.ts` (lines 247-367)

- [ ] **Step 1: Replace awardExperience DB queries with auth API calls**

Change `awardExperience(userId, xp)` to:
1. Call auth service `POST /api/internal/xp/award` with `{ userId, amount: xp }` (awards XP, not Respect — uses `authFetchInternal` with API key)
2. Remove dual-write to `user_game_profiles` + `users` tables (lines 266-282)
3. Return the updated profile from auth service response

- [ ] **Step 2: Update POST /api/characters/experience/award route**

Pass internal API key instead of auth token (this is server-to-server).

- [ ] **Step 3: Run L2P tests**

Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add l2p/backend/src/services/CharacterService.ts l2p/backend/src/routes/characters.ts
git commit -m "refactor(l2p): awardExperience proxies XP to auth service internal API"
```

---

### Task 14: Arena Backend — Lobby Join Migration

**Files:**
- Modify: `arena/backend/src/services/SocketService.ts`
- Modify: `arena/backend/src/services/LobbyService.ts`
- Modify: `arena/backend/src/types/game.ts`

- [ ] **Step 1: Add gender to types**

In `arena/backend/src/types/game.ts`:
- Add `gender: 'male' | 'female'` to `PlayerState` (after line 14)
- Add `gender: 'male' | 'female'` to `ArenaPlayer` (after line 201)

- [ ] **Step 2: Update SocketService join-lobby handler**

In `SocketService.ts` lines 123-156, replace client-trusted character with auth-validated profile:

```typescript
// Instead of: data.player?.character || 'student'
// Fetch from auth service:
const profile = await fetchUserProfile(socket.data.token);
const character = profile?.selectedCharacter || 'student';
const gender = profile?.selectedGender || 'male';
```

- [ ] **Step 3: Update LobbyService to pass gender**

In `LobbyService.ts` line 78, accept `gender` from the join request alongside character.

- [ ] **Step 4: Run Arena backend tests**

Run: `cd /home/patrick/projects/arena/backend && npx vitest run`
Expected: Tests pass

- [ ] **Step 5: Commit**

```bash
git add arena/backend/src/types/game.ts arena/backend/src/services/SocketService.ts arena/backend/src/services/LobbyService.ts
git commit -m "refactor(arena): read character/gender from auth service on lobby join"
```

---

## Chunk 4: Integration Testing & Deploy

### Task 15: Migrate L2P Cosmetic Perks to Auth Inventory

**Files:**
- Create: `auth/migrations/006_migrate_l2p_cosmetic_perks.sql`
- Modify: `auth/migrations/run-migrations.ts`

> **Note:** This migrates existing L2P cosmetic perk unlocks (scientist, ninja, dragon, etc.) from `l2p_db.user_perk_drafts` into `auth.inventory` as legacy items. Requires cross-database access or a migration script run from a client with access to both databases.

- [ ] **Step 1: Create migration script**

Write a SQL migration (or Node script via `tsx`) that:
1. Queries `l2p_db.user_perk_drafts` for rows where `chosen_perk_id IS NOT NULL` and `perk_type = 'cosmetic'`
2. Maps L2P perk IDs to auth catalog `item_id` format (e.g., `avatar_scientist`, `avatar_ninja`)
3. Inserts into `auth.inventory` with `acquisition_source = 'level_unlock'`
4. Uses `ON CONFLICT DO NOTHING` for idempotency

- [ ] **Step 2: Add catalog entries for legacy cosmetic items**

Add L2P cosmetic perks to `auth.shop_catalog` seed data (scientist, explorer, artist, detective, chef, astronaut, wizard, ninja, dragon) — these are cosmetic avatars, `item_type = 'skin'`, `respect_cost = 0` (already earned).

- [ ] **Step 3: Run migration**

Run: `cd /home/patrick/projects/auth && npm run db:migrate`
Expected: Migration 006 completes

- [ ] **Step 4: Commit**

```bash
git add auth/migrations/006_migrate_l2p_cosmetic_perks.sql auth/migrations/run-migrations.ts
git commit -m "feat(auth): migrate L2P cosmetic perks to auth inventory (migration 006)"
```

---

### Task 16: End-to-End Integration Test

- [ ] **Step 1: Start auth service locally with migration**

```bash
cd /home/patrick/projects/auth && npm run db:migrate && npm run dev
```

- [ ] **Step 2: Verify profile API works**

```bash
# Register a test user and get token
TOKEN=$(curl -s -X POST http://localhost:5500/api/auth/register \
  -H 'Content-Type: application/json' \
  -H 'X-Requested-With: XMLHttpRequest' \
  -d '{"username":"testplatform","email":"testplatform@test.local","password":"TestPass123!"}' \
  -c - | grep accessToken | awk '{print $NF}')

# Get profile (should auto-create)
curl -s http://localhost:5500/api/profile -H "Authorization: Bearer $TOKEN" | jq .

# Update character
curl -s -X PUT http://localhost:5500/api/profile/character \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'X-Requested-With: XMLHttpRequest' \
  -d '{"character":"professor","gender":"female"}' | jq .

# Browse catalog
curl -s http://localhost:5500/api/catalog | jq .

# Purchase item
curl -s -X POST http://localhost:5500/api/catalog/purchase \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'X-Requested-With: XMLHttpRequest' \
  -d '{"itemId":"emote_thumbsup"}' | jq .
```

- [ ] **Step 3: Verify internal API works**

```bash
curl -s -X POST http://localhost:5500/api/internal/respect/credit \
  -H 'Content-Type: application/json' \
  -H 'X-Internal-API-Key: <your-key>' \
  -d '{"userId":1,"amount":1000}' | jq .
```

- [ ] **Step 4: Run all test suites**

```bash
cd /home/patrick/projects/auth && NODE_OPTIONS=--experimental-vm-modules npx jest -v
cd /home/patrick/projects/l2p/backend && NODE_OPTIONS=--experimental-vm-modules npx jest --forceExit --detectOpenHandles
cd /home/patrick/projects/arena/backend && npx vitest run
```

- [ ] **Step 5: Commit any test fixes**

---

### Task 17: Deploy

- [ ] **Step 1: Push to git**

```bash
git push
```

- [ ] **Step 2: Create INTERNAL_API_KEY secret in k8s (BEFORE deploying services)**

```bash
# Generate key
INTERNAL_KEY=$(openssl rand -hex 32)
# Create k8s secret — all services reference this
kubectl -n korczewski-services create secret generic internal-api-key \
  --from-literal=INTERNAL_API_KEY=$INTERNAL_KEY \
  --dry-run=client -o yaml | kubectl apply -f -
echo "INTERNAL_API_KEY=$INTERNAL_KEY" # Save this for local testing
```

> **Important:** This must be done BEFORE deploying auth, because the `internalAuth` middleware requires `INTERNAL_API_KEY` to be set. Update each service's deployment manifest to mount this secret as an env var.

- [ ] **Step 3: Deploy auth service first**

```bash
./k8s/scripts/deploy/deploy-auth.sh
```

- [ ] **Step 4: Deploy L2P**

```bash
./k8s/scripts/deploy/deploy-l2p.sh
```

- [ ] **Step 5: Deploy Arena**

```bash
./k8s/scripts/deploy/deploy-arena.sh
```

- [ ] **Step 6: Verify deploy tracker**

```bash
./k8s/scripts/utils/deploy-tracker.sh status
```
Expected: auth, l2p, arena all up to date

- [ ] **Step 7: Smoke test production**

```bash
# Auth catalog endpoint (public, no auth needed)
curl -s https://auth.korczewski.de/api/catalog | jq '.[0:3] | .[].itemId'

# Verify L2P still works
curl -s https://l2p.korczewski.de/api/characters | jq '.[0].name'

# Verify Arena still works
curl -s https://arena.korczewski.de/health | jq .
```

---

## Notes

- **Test cleanup:** The migration SQL uses `ON DELETE CASCADE` on all FK references to `auth.users(id)`. This means `deleteTestUser(id)` automatically cascades to profiles, inventory, loadouts, and transactions — no changes needed to `test-utils.ts`.
- **Fallback strategy:** L2P CharacterService methods should gracefully fall back to local DB queries if auth service is unreachable (try/catch around auth API calls). This prevents total breakage during auth service downtime.
- **XP vs Respect are separate currencies:** `POST /api/internal/xp/award` awards XP (updates `profiles.xp_total`). `POST /api/internal/respect/credit` credits Respect (updates `profiles.respect_balance`). The `transactions.currency` column distinguishes them in the audit log.

## Phase 1 Complete Checklist

- [ ] Auth types: platform.ts with Profile, Inventory, Loadout, etc.
- [ ] Auth schema: 6 new tables in `auth` pgSchema
- [ ] Auth migration 005: seeds catalog + migrates existing users
- [ ] Auth migration 006: migrates L2P cosmetic perks to inventory
- [ ] Auth middleware: internalAuth (X-Internal-API-Key)
- [ ] Auth services: ProfileService, RespectService
- [ ] Auth routes: /api/profile (3 endpoints, with tests)
- [ ] Auth routes: /api/catalog (2 endpoints, with tests)
- [ ] Auth routes: /api/internal/* (6 endpoints, with tests)
- [ ] L2P authClient: HTTP client for auth service
- [ ] L2P: getUserCharacterInfo reads from auth API
- [ ] L2P: updateCharacter proxies to auth API
- [ ] L2P: awardExperience proxies XP to auth internal API
- [ ] L2P cosmetic perks migrated to auth inventory
- [ ] Arena authClient: HTTP client for auth service
- [ ] Arena: Lobby join reads character/gender from auth API
- [ ] Arena types: gender field added to PlayerState, ArenaPlayer
- [ ] All tests pass (auth Jest, L2P Jest, Arena Vitest)
- [ ] INTERNAL_API_KEY secret created in k8s
- [ ] Deployed in order: auth → L2P → Arena
- [ ] Deploy tracker up to date

---

## Next Plans

After Phase 1 ships, create separate plans for:
- **Phase 2:** Character Assets (GPU worker + 5 female character models)
- **Phase 3:** Arena Character Selector + 3D Viewer
- **Phase 4:** Cosmetics, Emotes & Power-Ups
- **Phase 5:** Shop + Respect Economy
- **Phase 6:** Cross-Game Deathmatch
- **Phase 7:** Skins (ongoing)
