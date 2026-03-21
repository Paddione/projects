# Character Gating via Respect Currency

**Date:** 2026-03-21
**Status:** Approved
**Scope:** Auth, L2P (backend + frontend), Arena (backend + frontend), Migration

## Problem

L2P has 8 university-themed characters gated by XP level; Arena has 5 of the same characters (student, researcher, professor, dean, librarian) with no gating at all. We want only the Student character to be free, with all others purchasable using Respect currency (500 Respect each). The 3 characters currently exclusive to L2P (graduate, lab_assistant, teaching_assistant) will be added to Arena's roster with placeholder art. This creates a cross-game progression incentive and gives the Respect economy more purpose.

## Decisions

| Aspect | Decision |
|--------|----------|
| Free character | Student — always available, never in catalog |
| Gating mechanism | Respect purchase only (500 each), replaces L2P's level-based unlocking |
| Roster | Unified 8 characters across L2P and Arena |
| Source of truth | Auth service `inventory` table (`item_type: 'character'`) |
| Purchase flow | In-picker confirmation → auth `POST /api/catalog/purchase` (existing endpoint) → atomic debit + inventory |
| Locked UX | Greyed out with lock icon + "500 ⭐" price badge; click opens purchase confirmation |
| Existing players | Grandfather currently-selected character only (not all level-unlockable ones) |
| New Arena characters | graduate, lab_assistant, teaching_assistant added with placeholder art |

## Character Roster (Unified)

| ID | Name | Free? | Respect Cost |
|----|------|-------|-------------|
| `student` | Student | Yes | — |
| `professor` | Professor | No | 500 |
| `librarian` | Librarian | No | 500 |
| `researcher` | Researcher | No | 500 |
| `dean` | Dean | No | 500 |
| `graduate` | Graduate | No | 500 |
| `lab_assistant` | Lab Assistant | No | 500 |
| `teaching_assistant` | Teaching Assistant | No | 500 |

## Architecture

### Source of Truth: Auth Service

The auth service's existing `shop_catalog` + `inventory` + `RespectService` infrastructure handles all ownership and purchase logic. Both L2P and Arena query auth for character ownership state.

```
┌─────────┐     GET /api/catalog/characters      ┌──────────┐
│  L2P    │ ──────────────────────────────────▶   │   Auth   │
│ Frontend│                                       │  Service │
│         │ ◀────────────────────────────────── │          │
│         │   { characters[], owned[], balance }  │          │
│         │                                       │          │
│         │     POST /api/catalog/purchase          │          │
│         │ ──────────────────────────────────▶   │          │
│         │   { itemId: 'character_dean' }        │          │
│         │ ◀────────────────────────────────── │          │
│         │   { success, newBalance }             │          │
└─────────┘                                       └──────────┘

┌─────────┐     (same endpoints)                  ┌──────────┐
│  Arena  │ ──────────────────────────────────▶   │   Auth   │
│ Frontend│ ◀────────────────────────────────── │  Service │
└─────────┘                                       └──────────┘
```

### Purchase Flow (Detailed)

1. Player opens character picker (L2P or Arena)
2. Frontend calls `GET /api/catalog/characters` → returns all 7 purchasable characters + user's owned character IDs + Respect balance
3. UI renders: owned = normal, unowned = greyed + lock + "500 ⭐"
4. Player clicks locked character → confirmation modal: "Purchase [Name] for 500 Respect? (Balance: X)"
5. On confirm → `POST /api/catalog/purchase { itemId: 'character_<id>' }`
6. Auth service `RespectService.purchaseItem()`:
   - Validates item exists in `shop_catalog` and is active
   - Validates user doesn't already own it (409 if duplicate)
   - Validates level requirement (null for characters, so always passes)
   - Atomic transaction: lock profile row → check balance → debit → insert inventory → log transaction
7. Returns `{ success: true, item, newBalance }` or error (402 insufficient, 409 already owned)
8. Frontend: on success → add to owned list, auto-select character, update balance display
9. Frontend: on 402 → show "You need X more Respect" message

### Ownership Validation on Character Selection

**Auth service (`PUT /api/profile/character`):**
```
if character != 'student':
  check inventory for item_id = 'character_' + character
  if not found → 403 "Character not purchased"
update profiles.selected_character
```

**L2P backend (`PUT /api/characters/select`):**
```
if character != 'student':
  call auth service or check cached inventory
  if not owned → 403 "Character not purchased"
update user's selected_character
```

**Arena backend (`join-lobby` socket event):**
```
if character != 'student':
  check auth profile inventory
  if not owned → emit 'join-error', fall back to 'student'
store character in lobby state
```

## Type System Changes

The `InventoryItem.itemType` union in `auth/src/types/platform.ts` must be extended to include `'character'`:

```typescript
// Before
itemType: 'skin' | 'emote' | 'title' | 'border' | 'power_up';

// After
itemType: 'skin' | 'emote' | 'title' | 'border' | 'power_up' | 'character';
```

Also extend `InventoryItem.acquisitionSource` to include `'migration'`:

```typescript
// Before
acquisitionSource: 'respect_purchase' | 'stripe' | 'achievement' | 'level_unlock';

// After
acquisitionSource: 'respect_purchase' | 'stripe' | 'achievement' | 'level_unlock' | 'migration';
```

The cast in `ProfileService.getProfileWithLoadout()` (line 142) must also include `'character'` and `'migration'` in the respective unions.

## Auth Service Unavailability (Fallback Behavior)

When L2P or Arena cannot reach the auth service during character selection or catalog fetch:

- **Character picker (frontend):** Show only `student` as available. Display a banner: "Unable to load character inventory. Try again later." No purchases possible.
- **Character selection (L2P backend):** L2P's `CharacterService.updateCharacter()` has 3 code paths — (1) auth service via `authFetch`, (2) local `user_game_profiles`, (3) legacy `users` table. **All three paths** must enforce the ownership check. If auth is unreachable, allow selection of `student` only; reject all other characters with 503 "Cannot verify character ownership."
- **Lobby join (Arena backend):** If auth profile fetch fails, fall back to `student`. Do not allow unverified character selection.

This is a deliberate trade-off: brief unavailability restricts character choice rather than allowing potential bypasses.

## Rate Limiting

`POST /api/catalog/purchase` should have rate limiting (10 req/min per user) added if not already present, consistent with the project's standard pattern.

## ID Convention

Catalog item IDs use the `character_` prefix (e.g., `character_professor`). Game-side character IDs are bare (e.g., `professor`). The mapping is:

- **Catalog/inventory side:** `character_<id>` — used in `shop_catalog.item_id`, `inventory.item_id`, purchase requests, `ownedCharacterIds` response
- **Game side:** bare `<id>` — used in character pickers, `selected_character` columns, lobby state, sprite references

**Frontends must strip the `character_` prefix** when comparing catalog ownership against the game character roster. Helper: `ownedIds.map(id => id.replace('character_', ''))`.

**Backends add the prefix** when checking ownership: `inventory.item_id = 'character_' + selectedCharacter`.

## Gender and Character Ownership

Purchasing a character unlocks **all gender variants**. The `gender` field on `shop_catalog` is irrelevant for character items (set to NULL). Gender selection remains a separate toggle (male/female) in both L2P and Arena character pickers — it is not gated by purchase. Arena's `_f` suffix convention (e.g., `student_f`) is a display-layer concern, not an ownership concern.

## Cross-Tab / Cross-Game Sync

If a player purchases a character in L2P and has Arena open in another tab, Arena won't know about the purchase until the next `GET /api/catalog/characters` call (on mount or character picker open). No real-time sync needed — character pickers are not long-lived views, and a page refresh or re-opening the picker will fetch fresh data.

## Service Changes

### 1. Auth Service

**Type changes — `auth/src/types/platform.ts`:**
- Add `'character'` to `InventoryItem.itemType` union
- Update cast in `ProfileService.getProfileWithLoadout()` line 142

**Database — Seed `shop_catalog`:**

New migration adds 7 character entries:

```sql
INSERT INTO auth.shop_catalog (item_id, item_type, name, description, respect_cost, unlock_level, active)
VALUES
  ('character_professor', 'character', 'Professor', 'Wise and knowledgeable academic', 500, NULL, true),
  ('character_librarian', 'character', 'Librarian', 'Organized keeper of knowledge', 500, NULL, true),
  ('character_researcher', 'character', 'Researcher', 'Curious explorer of new ideas', 500, NULL, true),
  ('character_dean', 'character', 'Dean', 'Distinguished academic leader', 500, NULL, true),
  ('character_graduate', 'character', 'Graduate', 'Accomplished scholar', 500, NULL, true),
  ('character_lab_assistant', 'character', 'Lab Assistant', 'Hands-on experimenter', 500, NULL, true),
  ('character_teaching_assistant', 'character', 'Teaching Assistant', 'Supportive mentor and guide', 500, NULL, true)
ON CONFLICT (item_id) DO NOTHING;
```

**New route — `GET /api/catalog/characters` (added to existing `auth/src/routes/catalog.ts`):**

Returns character catalog entries + user's owned character IDs (from inventory where `item_type = 'character'`). Note: the existing `GET /api/catalog` is public (no auth), but this route requires `authenticate` middleware explicitly applied to the route handler (not the router globally). If the user has no profile yet, auto-creates one via `getOrCreateProfile()` and returns empty `ownedCharacterIds` with 0 balance.

Response shape:
```json
{
  "characters": [
    { "itemId": "character_professor", "name": "Professor", "description": "...", "respectCost": 500 },
    ...
  ],
  "ownedCharacterIds": ["character_researcher", "character_dean"],
  "respectBalance": 1250
}
```

**Existing route — `POST /api/catalog/purchase` (in `auth/src/routes/catalog.ts`):**

This endpoint already exists and delegates to `RespectService.purchaseItem()`. No new purchase route needed — both L2P and Arena frontends call this existing endpoint. Add rate limiting (10 req/min per user) to this route if not already present.

**Modify `ProfileService.updateCharacter()`:**

Add ownership check before updating `selected_character`. If `character !== 'student'`, query `inventory` for matching `character_<id>` row. Return 403 if not found.

### 2. L2P Backend

**`CharacterService.ts`:**
- Remove `unlockLevel` from character definitions (or set all to 1)
- `getAvailableCharacters()` now accepts `ownedCharacterIds: string[]` parameter
- Returns all characters annotated with `{ ...char, owned: boolean, respectCost: 500 }`
- `student` is always `owned: true`

**`GET /api/characters/available` route:**
- Fetch user's inventory from auth service (or from cached profile data)
- Pass owned character IDs to `getAvailableCharacters()`
- Return full roster with ownership state

**`PUT /api/characters/select` route:**
- Replace level check with ownership check across **all three code paths** in `CharacterService.updateCharacter()`: (1) auth service via `authFetch`, (2) local `user_game_profiles`, (3) legacy `users` table
- If character is not `student` and not in user's auth inventory → 403 "Character not purchased"
- If auth service is unreachable → 503 "Cannot verify character ownership" (except for `student`)

### 3. Arena Backend

**`SocketService.ts` — `join-lobby` handler (NOT `LobbyService.ts`):**
- The socket handler that processes `join-lobby` events and fetches auth profiles lives in `SocketService.ts` (lines 134-149, 406-421)
- After fetching auth profile (already done for character selection), check inventory
- If requested character is not `student` and not in inventory → emit `join-error`, use `student` as fallback
- If auth profile fetch fails → use `student` as fallback

**`app.ts` — `POST /api/players`:**
- When saving `selectedCharacter`, validate ownership same as lobby join

**Character roster:**
- Add `graduate`, `lab_assistant`, `teaching_assistant` to Arena's character constants

### 4. L2P Frontend

**`characterStore.ts`:**
- Add `ownedCharacters: string[]` state
- Add `purchaseCharacter(characterId: string)` action → POST to auth purchase endpoint
- Modify `loadCharacterProfile()` to populate `ownedCharacters` from profile inventory

**`CharacterSelector.tsx`:**
- Render all 8 characters in grid
- Owned: current styling
- Unowned: greyed out, lock icon overlay, "500 ⭐" price badge
- Click locked → confirmation modal with balance display
- Purchase success → auto-select, refresh inventory
- Purchase failure (402) → "You need X more Respect" message

**Balance display:**
- Add small "⭐ X" badge in character selector header showing current Respect balance

### 5. Arena Frontend

**`CharacterPicker3D.tsx` / `CharacterPicker.tsx`:**
- Add 3 new characters (graduate, lab_assistant, teaching_assistant) with placeholder thumbnails
- Fetch owned characters from auth profile
- Same locked/unlocked pattern as L2P: greyed + lock + price, click to purchase
- Purchase via auth `POST /api/catalog/purchase`

**`Lobby.tsx`:**
- On mount, if saved localStorage character is not owned and not `student` → reset to `student`

**Balance display:**
- Show `RespectBalance` component near character picker

## Migration: Existing Players

### Strategy: Grandfather Currently-Selected Character

Players who currently have a non-student character selected keep it for free. Characters they could have unlocked by level but never selected are NOT granted.

**Auth migration script:**
```sql
-- Grant inventory entries for currently-selected characters
INSERT INTO auth.inventory (user_id, item_id, item_type, acquisition_source)
SELECT
  p.user_id,
  'character_' || p.selected_character,
  'character',
  'migration'
FROM auth.profiles p
WHERE p.selected_character != 'student'
  AND p.selected_character IS NOT NULL
ON CONFLICT (user_id, item_id) DO NOTHING;
```

**L2P migration (if auth profiles lag behind L2P profiles):**

L2P connects to `l2p_db`, not `auth_db`, so this cannot be a direct SQL cross-DB query. Instead, implement as a one-time Node.js migration script that:

1. Reads L2P `user_game_profiles` for rows where `selected_character != 'student'`
2. For each row, maps `auth_user_id` to the auth service
3. Calls auth's `POST /api/internal/respect/grant-item` (or direct DB insert if run with auth DB access) to insert inventory entries
4. Logs results for audit

Alternatively, run both SQL migrations if the script has access to both databases (e.g., run from a pod with both connection strings). The auth-side migration covers most users; the L2P migration is a safety net for any unsynced profiles.

### Rationale

- Fair: players keep what they're actively using
- Conservative: doesn't flood inventories with characters they never chose
- Simple: one SQL statement per data source, idempotent via `ON CONFLICT`

## Testing Strategy

### Auth Service
- Unit test: `purchaseItem()` for character type — success, insufficient balance, already owned
- Unit test: `updateCharacter()` rejects unowned non-student characters
- Integration test: `GET /api/catalog/characters` returns correct ownership state
- Integration test: full purchase flow (debit + inventory + transaction log)

### L2P Backend
- Unit test: `getAvailableCharacters()` with various ownership lists
- Unit test: `PUT /api/characters/select` rejects unowned characters
- Integration test: character selection with auth inventory check

### Arena Backend
- Unit test: lobby join rejects unowned character, falls back to student
- Integration test: character ownership validation via auth profile

### L2P Frontend
- Component test: `CharacterSelector` renders locked/unlocked states correctly
- Component test: purchase confirmation modal shows balance and handles success/error
- Component test: clicking locked character triggers purchase flow, not selection

### Arena Frontend
- Component test: `CharacterPicker3D` shows lock icons for unowned characters
- Component test: purchase flow works in character picker

### E2E
- Full flow: new user sees only student unlocked → buys Respect → purchases character → selects it → appears in game
- Cross-game: purchase character in L2P picker → character is available in Arena

## Files to Create/Modify

### Auth Service
- **Create:** `auth/src/migrations/YYYYMMDD_seed_character_catalog.sql`
- **Modify:** `auth/src/routes/catalog.ts` (add `GET /api/catalog/characters` route, add rate limiting to purchase route)
- **Modify:** `auth/src/types/platform.ts` (add `'character'` to `InventoryItem.itemType`, add `'migration'` to `acquisitionSource`)
- **Modify:** `auth/src/services/ProfileService.ts` (add ownership check in `updateCharacter`, update type casts on line 142)

### L2P Backend
- **Modify:** `l2p/backend/src/services/CharacterService.ts` (remove level gating, add ownership annotation)
- **Modify:** `l2p/backend/src/routes/characters.ts` (ownership check on select, inventory-aware available endpoint)

### Arena Backend
- **Modify:** `arena/backend/src/services/SocketService.ts` (ownership validation on `join-lobby` socket event)
- **Modify:** `arena/backend/src/app.ts` (ownership validation on player profile update)

### L2P Frontend
- **Modify:** `l2p/frontend/src/stores/characterStore.ts` (ownedCharacters state, purchaseCharacter action)
- **Modify:** `l2p/frontend/src/components/CharacterSelector.tsx` (locked UI, purchase modal, balance display)

### Arena Frontend
- **Modify:** `arena/frontend/src/components/CharacterPicker3D.tsx` (3 new characters, locked UI, purchase flow)
- **Modify:** `arena/frontend/src/components/CharacterPicker.tsx` (same changes for fallback picker)
- **Modify:** `arena/frontend/src/components/Lobby.tsx` (guard stale selection)

### Migration
- **Create:** `auth/src/migrations/YYYYMMDD_grandfather_character_ownership.sql`
- **Create:** `l2p/backend/scripts/migrate-character-ownership.ts` (optional: L2P→auth inventory sync script)

## Known Pre-Existing Issue

`RespectService.debitRespect()` (line 79) logs transactions with type `'respect_earned'` even for debits. This is a pre-existing bug — `purchaseItem()` correctly uses `'item_purchase'`, so character purchases are not affected. This spec does not introduce any direct `debitRespect()` calls.
