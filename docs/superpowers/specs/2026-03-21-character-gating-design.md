# Character Gating via Respect Currency

**Date:** 2026-03-21
**Status:** Approved
**Scope:** Auth, L2P (backend + frontend), Arena (backend + frontend), Migration

## Problem

All characters in both L2P and Arena are freely available (L2P gates by XP level, Arena has no gating). We want only the Student character to be free, with all others purchasable using Respect currency (500 Respect each). This creates a cross-game progression incentive and gives the Respect economy more purpose.

## Decisions

| Aspect | Decision |
|--------|----------|
| Free character | Student — always available, never in catalog |
| Gating mechanism | Respect purchase only (500 each), replaces L2P's level-based unlocking |
| Roster | Unified 8 characters across L2P and Arena |
| Source of truth | Auth service `inventory` table (`item_type: 'character'`) |
| Purchase flow | In-picker confirmation → auth `POST /api/shop/purchase` → atomic debit + inventory |
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
│         │     POST /api/shop/purchase           │          │
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
5. On confirm → `POST /api/shop/purchase { itemId: 'character_<id>' }`
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

## Service Changes

### 1. Auth Service

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

**New route — `GET /api/catalog/characters`:**

Returns character catalog entries + user's owned character IDs (from inventory where `item_type = 'character'`). Requires authentication.

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

**New route — `POST /api/shop/purchase`:**

User-facing purchase endpoint. Authenticates via session/JWT. Delegates to `RespectService.purchaseItem()`.

Request: `{ itemId: "character_professor" }`
Response: `{ success: true, item: {...}, newBalance: 750 }` or error

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
- Replace level check with ownership check
- If character is not `student` and not in user's auth inventory → 403 "Character not purchased"

### 3. Arena Backend

**`LobbyService.ts` — `join-lobby` handler:**
- After fetching auth profile (already done for character selection), check inventory
- If requested character is not `student` and not in inventory → emit `join-error`, use `student` as fallback

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
- Purchase via auth `POST /api/shop/purchase`

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
  'level_unlock'
FROM auth.profiles p
WHERE p.selected_character != 'student'
  AND p.selected_character IS NOT NULL
ON CONFLICT (user_id, item_id) DO NOTHING;
```

**L2P migration (if auth profiles lag behind L2P profiles):**
- Query L2P `user_game_profiles` for `selected_character != 'student'`
- For each, ensure auth inventory has the corresponding character entry
- This handles the case where a user selected a character in L2P but the auth profile hasn't synced

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
- **Create:** `auth/src/routes/catalog.ts` (new `GET /api/catalog/characters` route)
- **Create:** `auth/src/routes/shop.ts` (new `POST /api/shop/purchase` route)
- **Modify:** `auth/src/services/ProfileService.ts` (add ownership check in `updateCharacter`)
- **Modify:** `auth/src/app.ts` or route index (register new routes)

### L2P Backend
- **Modify:** `l2p/backend/src/services/CharacterService.ts` (remove level gating, add ownership annotation)
- **Modify:** `l2p/backend/src/routes/characters.ts` (ownership check on select, inventory-aware available endpoint)

### Arena Backend
- **Modify:** `arena/backend/src/services/LobbyService.ts` (ownership validation on join)
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
