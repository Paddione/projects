# Shared Platform Economy & Cross-Game Integration

**Date:** 2026-03-16
**Status:** Approved
**Scope:** Auth, L2P, Arena, Shop, Assetgenerator

---

## Overview

Unify L2P (quiz) and Arena (battle royale) into a shared platform with common character identity, economy ("Respect" currency), cosmetics, emotes, power-ups, and a cross-game deathmatch mode. The auth service becomes the platform identity + economy layer. The shop service handles real-money → Respect conversion via Stripe.

---

## Architecture

### Core Principle

The **auth service** is the single source of truth for player identity, profile, loadout, inventory, and Respect balance. L2P and Arena are thin game clients that read/write shared profile data via auth APIs.

### Service Responsibilities

| Service | Role |
|---------|------|
| **Auth** | Identity, profiles, loadouts, inventory, shop catalog, Respect economy, match escrow |
| **L2P** | Quiz gameplay, post-quiz deathmatch offer, in-game store UI, emote display |
| **Arena** | Deathmatch gameplay, character selector + 3D viewer, emote system, power-up effects |
| **Shop** | Stripe integration, Respect pack purchases, webhook → auth credit |
| **Assetgenerator** | Generate all character models, skins, sprite assets |

### Auth Service Schema Additions

> **Note:** Auth uses `pgSchema('auth')` (Drizzle). All new tables live in the `auth` schema.
> The existing `users.selected_character`, `users.character_level`, and `users.experience_points` columns are **deprecated** — `profiles` is the new canonical source. Phase 1 migration copies values from `users` → `profiles`, then game services read from `profiles` only. The `users` columns remain but are no longer written to.

```sql
-- Player profile (one per user)
CREATE TABLE auth.profiles (
  user_id INTEGER PRIMARY KEY REFERENCES auth.users(id),
  display_name VARCHAR(50),
  selected_character VARCHAR(50) DEFAULT 'student',
  selected_gender VARCHAR(10) DEFAULT 'male' CHECK (selected_gender IN ('male', 'female')),
  selected_power_up VARCHAR(50),
  respect_balance INTEGER DEFAULT 0,
  xp_total INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Owned items
CREATE TABLE auth.inventory (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES auth.users(id),
  item_id VARCHAR(100) NOT NULL,
  item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('skin', 'emote', 'title', 'border', 'power_up')),
  acquired_at TIMESTAMPTZ DEFAULT NOW(),
  acquisition_source VARCHAR(30) NOT NULL CHECK (acquisition_source IN ('respect_purchase', 'stripe', 'achievement', 'level_unlock')),
  UNIQUE(user_id, item_id)
);
CREATE INDEX idx_inventory_user_id ON auth.inventory(user_id);

-- Equipped items
CREATE TABLE auth.loadouts (
  user_id INTEGER PRIMARY KEY REFERENCES auth.users(id),
  equipped_skin VARCHAR(100),
  equipped_emote_1 VARCHAR(100),
  equipped_emote_2 VARCHAR(100),
  equipped_emote_3 VARCHAR(100),
  equipped_emote_4 VARCHAR(100),
  equipped_title VARCHAR(100),
  equipped_border VARCHAR(100),
  equipped_power_up VARCHAR(50),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchasable items
CREATE TABLE auth.shop_catalog (
  item_id VARCHAR(100) PRIMARY KEY,
  item_type VARCHAR(20) NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  respect_cost INTEGER NOT NULL,
  unlock_level INTEGER,
  gender VARCHAR(10),
  character VARCHAR(50),
  preview_asset_url VARCHAR(255),
  active BOOLEAN DEFAULT true
);

-- All economy transactions (audit log)
CREATE TABLE auth.transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES auth.users(id),
  type VARCHAR(30) NOT NULL CHECK (type IN ('respect_purchase', 'item_purchase', 'xp_bet', 'respect_earned', 'xp_refund')),
  currency VARCHAR(10) NOT NULL DEFAULT 'respect' CHECK (currency IN ('respect', 'xp')),
  amount INTEGER NOT NULL,
  item_id VARCHAR(100),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_transactions_user_id ON auth.transactions(user_id);

-- Match escrow (for cross-game deathmatch bets)
CREATE TABLE auth.match_escrow (
  id SERIAL PRIMARY KEY,
  token VARCHAR(64) UNIQUE NOT NULL,
  player_ids INTEGER[] NOT NULL,
  escrowed_xp JSONB NOT NULL,          -- { "userId": xpAmount, ... }
  match_config JSONB,                   -- { map, timeLimit, etc. }
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'settled', 'refunded')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  settled_at TIMESTAMPTZ
);
```

### Auth API Additions

```
GET    /api/profile              — own profile + loadout + inventory
PUT    /api/profile/character    — set character + gender
PUT    /api/profile/loadout      — update equipped items + power-up
GET    /api/catalog              — browse shop catalog (filterable by type)
POST   /api/catalog/purchase     — spend Respect on item
POST   /api/respect/credit       — internal: credit Respect (from Stripe or game rewards)
POST   /api/respect/debit        — internal: debit Respect
POST   /api/match/escrow         — lock XP for deathmatch bet
POST   /api/match/settle         — resolve bet: transfer XP + award Respect
GET    /api/profile/:userId      — public: another player's visible profile
```

### Service-to-Service Authentication

Internal endpoints (`/api/respect/credit`, `/api/respect/debit`, `/api/match/escrow`, `/api/match/settle`) are protected by a shared API key. All services are in the same k8s cluster.

```
Header: X-Internal-API-Key: <shared secret from INTERNAL_API_KEY env var>
Middleware: rejects requests without valid key (401)
Key stored in: k8s secret (korczewski-secrets), injected as env var to auth + shop + l2p + arena
```

Public-facing endpoints (`/api/profile`, `/api/catalog`, etc.) use the existing JWT/session auth.

### Shop → Auth User Resolution

When a player buys Respect in the Shop, the auth user ID is embedded in Stripe checkout metadata:

```
1. Player clicks "Buy 500 Respect" in Shop
2. Shop creates Stripe checkout session with metadata: { auth_user_id: <id from session> }
3. Player completes Stripe payment
4. Stripe webhook fires → Shop reads metadata.auth_user_id
5. Shop calls POST /api/respect/credit { userId: auth_user_id, amount: 500 }
   with X-Internal-API-Key header
```

The Shop knows the auth user ID because the player is logged in via the shared auth service (cookie/JWT).

### API Contracts

**POST /api/catalog/purchase**
```
Request:  { item_id: string }
Response: { success: true, item: InventoryItem, new_balance: number }
Errors:   409 (already owned), 403 (level too low), 402 (insufficient Respect)
Behavior: Single DB transaction — debit respect_balance, insert inventory row,
          log transaction. Validates item exists in owned inventory before equipping.
```

**PUT /api/profile/loadout**
```
Request:  { equipped_skin?, equipped_emote_1..4?, equipped_title?, equipped_border?, equipped_power_up? }
Response: { success: true, loadout: Loadout }
Errors:   400 (item not owned — validates all IDs exist in user's inventory)
```

### Power-Up Data Flow

On game start, Arena/L2P fetches each player's equipped power-up from auth `GET /api/profile/:userId`. The power-up ID is stored in server-side game state. Effect application is **server-authoritative** — clients display effects but the server enforces the actual gameplay modifiers.

### Migration Strategy

- L2P `user_game_profiles` → auth `profiles` (character, level, XP)
- L2P cosmetic perks (scientist, ninja, etc.) → auth `inventory` as legacy items
- Arena `players.selected_character` → reads from auth profile
- Both games drop local character/profile storage, call auth APIs

---

## Character System

### 10 Base Characters (5 × 2 genders)

| Character | Male ID | Female ID | Unlock Level |
|-----------|---------|-----------|-------------|
| Student | `student_m` | `student_f` | Free |
| Researcher | `researcher_m` | `researcher_f` | 10 |
| Professor | `professor_m` | `professor_f` | 20 |
| Dean | `dean_m` | `dean_f` | 30 |
| Librarian | `librarian_m` | `librarian_f` | 40 |

### Asset Pipeline per Variant

1. **Concept** — gendered prompt via Assetgenerator
2. **3D Model** — GLB via TripoSR/Meshy (vertex colors)
3. **Render** — Blender: 6 poses × 8 directions = 48 frames
4. **Pack** — into single `characters.png` atlas (all 10 variants)

Naming: `student_m-stand-N.png`, `student_f-gun-SE.png`

### Arena Integration

- `manifest.json` — `_m` and `_f` entries per character
- `AssetService.getAnimation(charId, pose, direction)` — charId = `student_m` or `student_f`
- `CHARACTER_COLORS` — keyed by base character (both genders share color)
- Lobby join: `{ character: 'student', gender: 'female' }` → sprite ID `student_f`
- Update `ArenaPlayer` and `PlayerState` types to include `gender: 'male' | 'female'`
- Update `join-lobby` socket event payload and `LobbyService.createLobby`/`joinLobby` to persist gender in JSONB

### L2P Integration

- `avatarService.ts` — resolve to `/icons/characters/student_f.svg` or rendered PNG
- Character definitions stay 5 base characters; gender is separate profile field
- `CharacterDisplay.tsx` — show gendered avatar from profile

### 3D Model Viewer

Port Assetgenerator's Three.js viewer to React for Arena lobby:
- Three.js r170 + GLTFLoader + OrbitControls
- Vertex color support (TripoSR models)
- Auto-orientation (Z-up → Y-up)
- Appears when selecting character in lobby
- Gender toggle switches model in real-time
- GLB models loaded on demand from auth/CDN (~1-5MB each)

---

## Power-Ups

5 universal power-ups, equip 1 in loadout. Same power-up, different effect per game.

| Power-Up | Cost | Arena Effect | L2P Effect |
|----------|------|-------------|------------|
| Shield | 0 (free) | +25 starting armor | Block 1 wrong answer XP penalty |
| Haste | 500 | +10% move speed | +5s time per question |
| Vampiric | 1000 | Heal 15% on kill | Steal 10% XP from lowest scorer |
| Lucky | 750 | Better loot spawn rates | 1 free 50/50 hint |
| Fury | 1500 | +15% damage first 30s | 2× XP first 3 questions |

Shield is free so every player has at least one option. Values are tunable — stored in `shop_catalog`, not hardcoded.

---

## Cosmetics

### Skins (per character, per gender)

- 2 skin variants per character at launch
- 5 characters × 2 genders × 2 skins = 20 new model variants
- Examples: "Neon" collection (cyan glow), "Formal" collection (suit/dress)
- Cost: 2000-5000 Respect
- Full Assetgenerator pipeline per skin (concept → model → render → pack)
- Shipped incrementally in collections

### Titles (text under username)

10 at launch:

| Title | Cost | Unlock |
|-------|------|--------|
| Scholar | 500 | Purchase |
| Bookworm | 500 | Purchase |
| Speedrunner | 750 | Purchase |
| Veteran | 1000 | Purchase |
| Quiz Master | — | Achievement: 100 quiz wins |
| Last One Standing | — | Achievement: 50 Arena wins |
| Sharpshooter | — | Achievement: 30 kills without missing |
| Untouchable | — | Achievement: win Arena without damage |
| Champion | — | Achievement: win 10 deathmatches |
| Legend | — | Achievement: reach level 50 |

### Borders/Frames (around avatar)

| Border | Cost |
|--------|------|
| Default | Free |
| Bronze | 300 |
| Silver | 750 |
| Gold | 1500 |
| Diamond | 3000 |
| Flame | 2000 |

CSS/SVG overlay — no asset pipeline needed.

### Emotes (4 equip slots)

8 at launch:

| Emote | Cost |
|-------|------|
| Wave | Free |
| GG | Free |
| Thumbs Up | 250 |
| Clap | 250 |
| Shrug | 500 |
| Taunt | 500 |
| Dance | 750 |
| Facepalm | 750 |

- Arena: speech bubble icon above character sprite (2s duration)
- L2P: emoji/icon next to player name in lobby + between questions

### Emote Controls

```
Default keybindings:
  1 — Emote slot 1 (default: Wave)
  2 — Emote slot 2 (default: GG)
  3 — Emote slot 3 (empty)
  4 — Emote slot 4 (empty)
  T — Hold for emote wheel (all owned emotes)

Configurable in: Settings → Keybindings
Stored in: localStorage (per device) + synced to auth profile preferences
```

---

## Respect Economy

### Single Currency

Respect is the only currency. Earned by playing, or bought with real money.

### Earning Sources

| Source | Amount |
|--------|--------|
| Win Arena deathmatch (from L2P) | 50 |
| Win public Arena match | 25 |
| Level up | 10 × new level |
| Buy with Stripe | $1 ≈ 100 Respect |

### Stripe Respect Packs (Shop Service)

| Pack | Respect | Price |
|------|---------|-------|
| Starter | 500 | $4.99 |
| Popular | 1200 | $9.99 |
| Premium | 3000 | $19.99 |
| Ultimate | 7500 | $44.99 |

Flow: Shop checkout → Stripe webhook → Shop calls auth `POST /api/respect/credit`

### Shop Service Changes

- Remove old product catalog and currency
- Add 4 Respect pack Stripe products
- Frontend: Respect pack cards with Stripe checkout
- Backend: webhook handler credits auth service

---

## Cross-Game Deathmatch

### Flow

1. Quiz round ends in L2P
2. "Deathmatch Challenge!" modal: shows earned XP, bet = all of it
3. Players accept or decline
4. L2P calls auth `POST /api/match/escrow` — locks each player's earned XP
5. Auth creates match token: player IDs, escrowed XP, match config, 5min expiry
6. Players redirected to `arena.korczewski.de/match/{token}`
7. Arena auto-joins players into private lobby with their loadouts
8. Deathmatch plays (existing Arena game logic)
9. Match ends → Arena calls auth `POST /api/match/settle`
10. Winner: gets all escrowed XP + flat Respect reward
11. Losers: XP lost (was bet)
12. Results screen → "Return to L2P" button

### Match Token

- Token is a 64-char random hex string (opaque ID), stored in `auth.match_escrow` table
- Arena validates by calling auth `GET /api/match/escrow/:token` — returns player IDs, config, and status
- Token is single-use: status transitions `pending` → `active` (when Arena confirms start) → `settled`/`refunded`
- Auth rejects tokens that are expired, already used, or in wrong status

### Safety

- Escrowed XP held in `match_escrow` + `transactions` table (type: `xp_bet`, currency: `xp`)
- Token expires in 5 min → cron/scheduled job auto-refunds `pending` escrows past `expires_at`
- Arena server crash → auto-refund (no settle call received within timeout)
- Minimum 2 accepting players required
- Single-use tokens (prevent replay)

---

## Implementation Phases

### Phase 1: Foundation (Auth + Shared Profile)

1. Auth DB migration: profiles, inventory, loadouts, shop_catalog, transactions
2. Auth API: profile CRUD, loadout, catalog, Respect credit/debit
3. Migrate L2P user_game_profiles → auth profiles
4. Migrate L2P cosmetic perks → auth inventory
5. L2P reads character/profile from auth API
6. Arena reads character from auth API
7. Deploy: auth → L2P → Arena

### Phase 2: Character Assets (GPU Worker + Gender Variants)

1. Start GPU worker on RTX 5070 Ti machine
2. Generate 5 female character concepts
3. Generate 5 female 3D models
4. Render all 10 variants (480 frames total)
5. Pack updated characters.png atlas
6. Update Arena manifest.json with _m/_f entries
7. Generate L2P avatar images (front-facing renders)
8. Deploy: Arena + L2P

### Phase 3: Arena Character Selector + 3D Viewer

1. Lobby character picker grid (5 chars × 2 genders)
2. Port Three.js viewer to React component
3. 3D model preview panel in lobby
4. Gender toggle
5. Lobby join sends { character, gender }
6. Deploy: Arena

### Phase 4: Cosmetics, Emotes & Power-Ups

1. Seed shop_catalog with launch items
2. In-game store UI (L2P + Arena)
3. Emote system: speech bubbles (Arena), emoji display (L2P)
4. Emote wheel (T) + hotkey slots (1-4)
5. Keybinding settings with configurable hotkeys
6. Loadout screen: equip power-up, skin, emotes, title, border
7. Power-up effects in Arena (armor, speed, heal, loot, damage)
8. Power-up effects in L2P (time, block, steal, hint, XP boost)
9. Deploy: auth → L2P → Arena

### Phase 5: Shop + Respect Economy

1. Strip old shop products/currency
2. Add 4 Respect pack Stripe products
3. Shop UI: Respect pack cards + Stripe checkout
4. Stripe webhook → auth POST /api/respect/credit
5. Respect balance in L2P + Arena headers
6. Level-up Respect rewards
7. Arena match-win Respect rewards
8. Deploy: shop → auth → L2P → Arena

### Phase 6: Cross-Game Deathmatch

1. Auth API: match escrow + settle
2. L2P: post-quiz "Deathmatch Challenge" modal
3. Match token generation + redirect
4. Arena: /match/:token private lobby route
5. Auto-join from token with loadouts
6. Match-end settle call
7. Results screen + "Return to L2P"
8. Escrow safety: timeout refund, crash recovery
9. Deploy: auth → L2P → Arena

### Phase 7: Skins (Ongoing)

1. Design 2 skin variants per character (20 models)
2. Assetgenerator pipeline per skin
3. Add to catalog, pack atlases
4. Deploy as collections

---

## Open Questions (for future design sessions)

- Matchmaking rules for deathmatch (level-based? random?)
- Anti-cheat for power-up effects (server-authoritative validation)
- Respect inflation controls (daily earn caps? seasonal resets?)
- Mobile/touch emote wheel UX
- Skin preview in shop before purchase (reuse 3D viewer?)
