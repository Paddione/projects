# Character Gating via Respect Currency — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate all non-student characters behind a 500 Respect purchase, unified across L2P and Arena.

**Architecture:** Auth service is the single source of truth for character ownership via its existing `shop_catalog` + `inventory` + `RespectService.purchaseItem()`. Both L2P and Arena query auth for owned characters and use the existing `POST /api/catalog/purchase` endpoint for purchases.

**Tech Stack:** Auth (Express/Drizzle), L2P backend (Express/Jest), L2P frontend (React/Zustand), Arena backend (Express/Socket.io), Arena frontend (React/PixiJS)

**Spec:** `docs/superpowers/specs/2026-03-21-character-gating-design.md`

---

## File Structure

### Auth Service
| File | Action | Responsibility |
|------|--------|---------------|
| `auth/src/types/platform.ts` | Modify | Add `'character'` to itemType, `'migration'` to acquisitionSource |
| `auth/src/services/ProfileService.ts` | Modify | Add ownership check in `updateCharacter()`, update type casts |
| `auth/src/routes/catalog.ts` | Modify | Add `GET /api/catalog/characters`, add rate limiting to purchase |
| `auth/migrations/007_seed_character_catalog.sql` | Create | Seed 7 character catalog entries |
| `auth/migrations/008_grandfather_character_ownership.sql` | Create | Grant inventory to existing non-student players |

### L2P Backend
| File | Action | Responsibility |
|------|--------|---------------|
| `l2p/backend/src/services/CharacterService.ts` | Modify | Remove level gating, add ownership annotation |
| `l2p/backend/src/routes/characters.ts` | Modify | Ownership check on select, error handling |

### L2P Frontend
| File | Action | Responsibility |
|------|--------|---------------|
| `l2p/frontend/src/stores/characterStore.ts` | Modify | Add ownedCharacters, purchaseCharacter action |
| `l2p/frontend/src/components/CharacterSelector.tsx` | Modify | Locked UI, purchase modal, balance display |

### Arena Backend
| File | Action | Responsibility |
|------|--------|---------------|
| `arena/backend/src/services/SocketService.ts` | Modify | Ownership validation on join-lobby |
| `arena/backend/src/app.ts` | Modify | Ownership validation on POST /api/players |

### Arena Frontend
| File | Action | Responsibility |
|------|--------|---------------|
| `arena/frontend/src/components/CharacterPicker3D.tsx` | Modify | Add 3 chars, locked UI, purchase flow |
| `arena/frontend/src/components/CharacterPicker.tsx` | Modify | Same locked UI for fallback picker |
| `arena/frontend/src/components/Lobby.tsx` | Modify | Guard stale localStorage selection |

---

## Task 1: Auth — Type System + Catalog Seed

**Files:**
- Modify: `auth/src/types/platform.ts:18,20`
- Create: `auth/migrations/007_seed_character_catalog.sql`

- [ ] **Step 1: Extend InventoryItem.itemType union**

In `auth/src/types/platform.ts`, line 18:

```typescript
// Before
itemType: 'skin' | 'emote' | 'title' | 'border' | 'power_up';
// After
itemType: 'skin' | 'emote' | 'title' | 'border' | 'power_up' | 'character';
```

- [ ] **Step 2: Extend acquisitionSource union**

Same file, line 20:

```typescript
// Before
acquisitionSource: 'respect_purchase' | 'stripe' | 'achievement' | 'level_unlock';
// After
acquisitionSource: 'respect_purchase' | 'stripe' | 'achievement' | 'level_unlock' | 'migration';
```

- [ ] **Step 3: Update ProfileService type casts**

In `auth/src/services/ProfileService.ts`, update the `getProfileWithLoadout()` method's inventory mapping (lines 142-144):

```typescript
// Line 142 — add 'character'
itemType: row.item_type as 'skin' | 'emote' | 'title' | 'border' | 'power_up' | 'character',
// Line 144 — add 'migration'
acquisitionSource: row.acquisition_source as 'respect_purchase' | 'stripe' | 'achievement' | 'level_unlock' | 'migration',
```

- [ ] **Step 4: Create catalog seed migration**

Create `auth/migrations/007_seed_character_catalog.sql`:

```sql
-- Seed purchasable characters into shop catalog (500 Respect each)
-- Student is free (not in catalog)
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

- [ ] **Step 5: Run migration locally**

```bash
cd auth && kubectl exec -it deploy/postgres -n korczewski-infra -- psql -U auth_user -d auth_db -f -
# Or if running locally:
# psql -U auth_user -d auth_db -f migrations/007_seed_character_catalog.sql
```

Verify: `SELECT * FROM auth.shop_catalog WHERE item_type = 'character';` → 7 rows

- [ ] **Step 6: Commit**

```bash
git add auth/src/types/platform.ts auth/src/services/ProfileService.ts auth/migrations/007_seed_character_catalog.sql
git commit -m "feat(auth): add character type to inventory + seed catalog with 7 purchasable characters"
```

---

## Task 2: Auth — Ownership Check in ProfileService.updateCharacter

**Files:**
- Modify: `auth/src/services/ProfileService.ts:52-67`

- [ ] **Step 1: Add `and` to drizzle-orm import**

At top of `ProfileService.ts`, `inventory` is already imported (line 2). Add `and` to the drizzle-orm import (line 5):

```typescript
import { eq, sql, and } from 'drizzle-orm';
```

- [ ] **Step 2: Add ownership validation to updateCharacter**

Replace the `updateCharacter` method (lines 52-67):

```typescript
async updateCharacter(userId: number, character: string, gender: string): Promise<ProfileRecord> {
  // Ensure profile exists
  await this.getOrCreateProfile(userId);

  // Ownership check: student is always free, others require purchase
  if (character !== 'student') {
    const owned = await db
      .select({ id: inventory.id })
      .from(inventory)
      .where(and(
        eq(inventory.user_id, userId),
        eq(inventory.item_id, `character_${character}`),
      ))
      .limit(1);

    if (owned.length === 0) {
      throw new Error('Character not purchased');
    }
  }

  const [updated] = await db
    .update(profiles)
    .set({
      selected_character: character,
      selected_gender: gender,
      updated_at: new Date(),
    })
    .where(eq(profiles.user_id, userId))
    .returning();

  return updated;
}
```

- [ ] **Step 3: Commit**

```bash
git add auth/src/services/ProfileService.ts
git commit -m "feat(auth): add character ownership check to ProfileService.updateCharacter"
```

---

## Task 3: Auth — GET /api/catalog/characters Endpoint

**Files:**
- Modify: `auth/src/routes/catalog.ts`

- [ ] **Step 1: Add imports**

At top of `catalog.ts`, add:

```typescript
import { inventory, profiles } from '../db/schema.js';
import { ProfileService } from '../services/ProfileService.js';
```

- [ ] **Step 2: Add the characters endpoint**

Add before `export default router;`:

```typescript
/**
 * GET /api/catalog/characters
 * Get character catalog + user's owned characters + balance.
 * Requires authentication (unlike GET /api/catalog which is public).
 */
router.get('/catalog/characters', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const userId = req.user.userId;

    // Ensure profile exists
    const profileService = new ProfileService();
    const profile = await profileService.getOrCreateProfile(userId);

    // Get character catalog items
    const characters = await db
      .select()
      .from(shopCatalog)
      .where(and(eq(shopCatalog.active, true), eq(shopCatalog.item_type, 'character')));

    // Get user's owned character item_ids
    const ownedRows = await db
      .select({ item_id: inventory.item_id })
      .from(inventory)
      .where(and(eq(inventory.user_id, userId), eq(inventory.item_type, 'character')));

    res.status(200).json({
      characters: characters.map((c) => ({
        itemId: c.item_id,
        name: c.name,
        description: c.description,
        respectCost: c.respect_cost,
      })),
      ownedCharacterIds: ownedRows.map((r) => r.item_id),
      respectBalance: profile.respect_balance,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch character catalog' });
  }
});
```

- [ ] **Step 3: Add rate limiting to purchase route**

Add import at top:

```typescript
import rateLimit from 'express-rate-limit';
```

Add limiter before the purchase route:

```typescript
const purchaseLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many purchase attempts, try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});
```

Update the purchase route line to include the limiter:

```typescript
router.post('/catalog/purchase', authenticate, purchaseLimiter, async (req: Request, res: Response) => {
```

- [ ] **Step 4: Verify auth service builds**

```bash
cd auth && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add auth/src/routes/catalog.ts
git commit -m "feat(auth): add GET /api/catalog/characters endpoint + rate limit purchases"
```

---

## Task 4: Auth — Grandfather Migration

**Files:**
- Create: `auth/migrations/008_grandfather_character_ownership.sql`

- [ ] **Step 1: Create grandfather migration**

```sql
-- Grant inventory entries for players who currently have a non-student character selected.
-- Uses 'migration' acquisition_source to distinguish from purchases.
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

- [ ] **Step 2: Run migration**

```bash
# Verify what will be affected first:
# SELECT user_id, selected_character FROM auth.profiles WHERE selected_character != 'student';
# Then run the migration
```

- [ ] **Step 3: Commit**

```bash
git add auth/migrations/008_grandfather_character_ownership.sql
git commit -m "feat(auth): grandfather existing non-student character selections into inventory"
```

---

## Task 5: L2P Backend — Remove Level Gating, Add Ownership Check

**Files:**
- Modify: `l2p/backend/src/services/CharacterService.ts:38-95,121-123,187-273`
- Modify: `l2p/backend/src/routes/characters.ts:153-240`

- [ ] **Step 1: Remove unlockLevel from character definitions**

In `CharacterService.ts`, set all `unlockLevel` to `1`:

```typescript
private readonly characters: Character[] = [
  { id: 'professor', name: 'Professor', emoji: '👨‍🏫', description: 'Wise and knowledgeable academic', unlockLevel: 1 },
  { id: 'student', name: 'Student', emoji: '👨‍🎓', description: 'Eager learner ready for challenges', unlockLevel: 1 },
  { id: 'librarian', name: 'Librarian', emoji: '👩‍💼', description: 'Organized keeper of knowledge', unlockLevel: 1 },
  { id: 'researcher', name: 'Researcher', emoji: '👨‍🔬', description: 'Curious explorer of new ideas', unlockLevel: 1 },
  { id: 'dean', name: 'Dean', emoji: '👩‍⚖️', description: 'Distinguished academic leader', unlockLevel: 1 },
  { id: 'graduate', name: 'Graduate', emoji: '🎓', description: 'Accomplished scholar', unlockLevel: 1 },
  { id: 'lab_assistant', name: 'Lab Assistant', emoji: '👨‍🔬', description: 'Hands-on experimenter', unlockLevel: 1 },
  { id: 'teaching_assistant', name: 'Teaching Assistant', emoji: '👩‍🏫', description: 'Supportive mentor and guide', unlockLevel: 1 },
];
```

- [ ] **Step 2: Replace level check with ownership check in updateCharacter**

In the `updateCharacter` method (line 187+), replace the level checks in the game profile path (line 231) and legacy path (line 265) with ownership checks. The auth service path (line 195) already delegates to auth's `ProfileService.updateCharacter` which now has the ownership check.

For the game profile fallback path (~line 230-233), replace:
```typescript
// OLD: if (character.unlockLevel > profile.characterLevel) {
//   throw new Error(`Character requires level ${character.unlockLevel} to unlock`);
// }

// NEW: ownership check — auth unavailable, so only allow student
if (characterId !== 'student') {
  throw new Error('Cannot verify character ownership');
}
```

Apply the same change for the legacy user fallback path (~line 264-267):
```typescript
if (characterId !== 'student') {
  throw new Error('Cannot verify character ownership');
}
```

- [ ] **Step 3: Update getAvailableCharacters to accept ownership list**

Change the method signature and logic (line 121):

```typescript
/**
 * Get all characters annotated with ownership state.
 * Student is always owned. Others require inventory entry.
 */
getAvailableCharacters(ownedCharacterIds: string[] = []): (Character & { owned: boolean; respectCost: number })[] {
  return this.characters.map(char => ({
    ...char,
    owned: char.id === 'student' || ownedCharacterIds.includes(char.id),
    respectCost: char.id === 'student' ? 0 : 500,
  }));
}
```

- [ ] **Step 4: Update GET /api/characters/available route to fetch inventory**

In `routes/characters.ts` (lines 63-105), modify the `/available` handler to fetch the user's auth inventory and pass owned IDs to `getAvailableCharacters`. Use `fetchUserProfile` from authClient:

```typescript
// After getting authToken and userInfo, fetch inventory from auth
let ownedIds: string[] = [];
try {
  const profileRes = await fetchUserProfile(authToken);
  if (profileRes) {
    ownedIds = (profileRes.inventory || [])
      .filter((item: any) => item.itemType === 'character' || item.item_type === 'character')
      .map((item: any) => (item.itemId || item.item_id || '').replace('character_', ''));
  }
} catch {
  // Auth unreachable — only student owned
}

const annotatedCharacters = characterService.getAvailableCharacters(ownedIds);
```

Update the response to include the annotated characters with ownership info.

- [ ] **Step 5: Update error handling in routes/characters.ts**

In the select route error handler (~line 215), **replace** the old `'Character requires level'` handler (which is now dead code) with the new ownership error handlers:

```typescript
// REMOVE this old handler:
// if (error.message.includes('Character requires level')) { ... }

// ADD these new handlers:
if (error.message.includes('Cannot verify character ownership')) {
  res.status(503).json({
    success: false,
    error: 'Service unavailable',
    message: 'Cannot verify character ownership. Try again later.'
  });
  return;
}

if (error.message.includes('Character not purchased')) {
  res.status(403).json({
    success: false,
    error: 'Character locked',
    message: 'Character not purchased'
  });
  return;
}
```

- [ ] **Step 6: Verify L2P backend builds**

```bash
cd l2p/backend && npx tsc --noEmit
```

- [ ] **Step 7: Run existing tests**

```bash
cd l2p && NODE_OPTIONS=--experimental-vm-modules npx jest --forceExit --detectOpenHandles 2>&1 | tail -20
```

- [ ] **Step 8: Commit**

```bash
git add l2p/backend/src/services/CharacterService.ts l2p/backend/src/routes/characters.ts
git commit -m "feat(l2p): replace level-based character gating with Respect ownership check"
```

---

## Task 6: L2P Frontend — Character Store + Purchase Action

**Files:**
- Modify: `l2p/frontend/src/stores/characterStore.ts`

- [ ] **Step 1: Add ownedCharacters state and purchaseCharacter action**

Add to the `CharacterState` interface:

```typescript
ownedCharacters: string[]  // bare character IDs (e.g., 'professor')
respectBalance: number
purchaseCharacter: (characterId: string) => Promise<{ success: boolean; error?: string }>
```

Add initial values:

```typescript
ownedCharacters: ['student'],
respectBalance: 0,
```

- [ ] **Step 2: Modify loadCharacterProfile to fetch ownership**

In the `loadCharacterProfile` action, after loading the profile, also fetch character catalog from auth:

```typescript
// After existing profile load, fetch ownership from auth
try {
  const authUrl = (window as any).__IMPORT_META_ENV__?.VITE_AUTH_SERVICE_URL || import.meta.env.VITE_AUTH_SERVICE_URL || '';
  if (authUrl) {
    const catalogRes = await fetch(`${authUrl}/api/catalog/characters`, { credentials: 'include' });
    if (catalogRes.ok) {
      const catalog = await catalogRes.json();
      const owned = ['student', ...catalog.ownedCharacterIds.map((id: string) => id.replace('character_', ''))];
      set({ ownedCharacters: owned, respectBalance: catalog.respectBalance });
    }
  }
} catch (e) {
  console.warn('Failed to fetch character ownership, defaulting to student only');
  set({ ownedCharacters: ['student'], respectBalance: 0 });
}
```

- [ ] **Step 3: Add purchaseCharacter action**

```typescript
purchaseCharacter: async (characterId: string) => {
  try {
    const authUrl = (window as any).__IMPORT_META_ENV__?.VITE_AUTH_SERVICE_URL || import.meta.env.VITE_AUTH_SERVICE_URL || '';
    const res = await fetch(`${authUrl}/api/catalog/purchase`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: `character_${characterId}` }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      set((state) => ({
        ownedCharacters: [...state.ownedCharacters, characterId],
        respectBalance: data.newBalance,
      }));
      return { success: true };
    }
    return { success: false, error: data.error || 'Purchase failed' };
  } catch {
    return { success: false, error: 'Network error' };
  }
},
```

- [ ] **Step 4: Add selector hooks**

```typescript
export const useOwnedCharacters = () => useCharacterStore(state => state.ownedCharacters)
export const useRespectBalance = () => useCharacterStore(state => state.respectBalance)
```

- [ ] **Step 5: Commit**

```bash
git add l2p/frontend/src/stores/characterStore.ts
git commit -m "feat(l2p): add character ownership state and purchase action to characterStore"
```

---

## Task 7: L2P Frontend — CharacterSelector Locked UI + Purchase Modal

**Files:**
- Modify: `l2p/frontend/src/components/CharacterSelector.tsx`

- [ ] **Step 1: Import ownership hooks and add state**

```typescript
import { useCharacterStore, useAvailableCharacters, useCharacterLoading, useCharacterUpdating, useOwnedCharacters, useRespectBalance } from '../stores/characterStore'
import { useState } from 'react'
```

Inside the component, add:

```typescript
const ownedCharacters = useOwnedCharacters()
const respectBalance = useRespectBalance()
const { purchaseCharacter, loadCharacterProfile } = useCharacterStore()
const [purchaseTarget, setPurchaseTarget] = useState<string | null>(null)
const [purchaseError, setPurchaseError] = useState<string | null>(null)
```

- [ ] **Step 2: Change character grid to show ALL characters (not just available)**

Replace `availableCharacters.map(...)` with a map over all `characters` from the store. Add a `characters` import:

```typescript
const { loadCharacters, updateCharacter, characters } = useCharacterStore(state => ({
  loadCharacters: state.loadCharacters,
  updateCharacter: state.updateCharacter,
  characters: state.characters,
}))
```

Use `characters` (all 8) instead of `availableCharacters` in the grid map.

- [ ] **Step 3: Update handleCharacterSelect for locked characters**

```typescript
const handleCharacterSelect = async (characterId: string) => {
  if (!ownedCharacters.includes(characterId)) {
    // Show purchase confirmation
    setPurchaseTarget(characterId)
    setPurchaseError(null)
    return
  }
  if (skipServerUpdate) {
    onCharacterSelect(characterId)
    return
  }
  const success = await updateCharacter(characterId)
  if (success) {
    onCharacterSelect(characterId)
  }
}
```

- [ ] **Step 4: Add locked styling to character buttons**

In the button's className logic, add a locked state:

```typescript
const isOwned = ownedCharacters.includes(character.id)
const isSelected = selectedCharacter === character.id

<button
  key={character.id}
  className={`${styles.characterButton} ${isSelected ? `${styles.selected} selected` : ''} ${!isOwned ? styles.locked : ''}`.trim()}
  onClick={() => handleCharacterSelect(character.id)}
  type="button"
  title={isOwned ? character.description : `Purchase for 500 Respect`}
  disabled={isUpdating && !skipServerUpdate}
  data-testid={`character-${character.id}`}
  style={!isOwned ? { opacity: 0.5, position: 'relative' } : undefined}
>
  {/* existing content */}
  {!isOwned && (
    <span style={{ fontSize: '0.7rem', color: '#ffd700' }}>🔒 500 ⭐</span>
  )}
</button>
```

- [ ] **Step 5: Add purchase confirmation modal**

Add after the character grid:

```typescript
{purchaseTarget && (() => {
  const char = characters.find(c => c.id === purchaseTarget)
  return (
    <div className={styles.modal} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{ background: '#1a1a2e', border: '1px solid #2a2a4a', borderRadius: '12px', padding: '24px', maxWidth: '320px', textAlign: 'center' }}>
        <h3 style={{ margin: '0 0 8px' }}>{char?.emoji} {char?.name}</h3>
        <p style={{ color: '#888', margin: '0 0 16px' }}>Purchase for 500 Respect?</p>
        <p style={{ color: '#ffd700', margin: '0 0 16px' }}>Your balance: {respectBalance} ⭐</p>
        {purchaseError && <p style={{ color: '#ff4444', margin: '0 0 12px' }}>{purchaseError}</p>}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button
            onClick={async () => {
              const result = await purchaseCharacter(purchaseTarget)
              if (result.success) {
                setPurchaseTarget(null)
                await updateCharacter(purchaseTarget)
                onCharacterSelect(purchaseTarget)
                await loadCharacterProfile()
              } else {
                setPurchaseError(result.error || 'Purchase failed')
              }
            }}
            disabled={respectBalance < 500}
            style={{ padding: '8px 20px', background: respectBalance >= 500 ? '#00f2ff' : '#333', color: respectBalance >= 500 ? '#000' : '#666', border: 'none', borderRadius: '6px', cursor: respectBalance >= 500 ? 'pointer' : 'not-allowed', fontWeight: 600 }}
          >
            Buy
          </button>
          <button
            onClick={() => { setPurchaseTarget(null); setPurchaseError(null) }}
            style={{ padding: '8px 20px', background: '#333', color: '#ccc', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
})()}
```

- [ ] **Step 6: Add balance display in header**

Add after the label/description area:

```typescript
{respectBalance > 0 && (
  <span style={{ float: 'right', color: '#ffd700', fontSize: '0.85rem' }}>
    {respectBalance} ⭐
  </span>
)}
```

- [ ] **Step 7: Commit**

```bash
git add l2p/frontend/src/components/CharacterSelector.tsx
git commit -m "feat(l2p): add locked character UI with in-picker purchase modal"
```

---

## Task 8: Arena Frontend — Add 3 Characters + Locked UI

**Files:**
- Modify: `arena/frontend/src/components/CharacterPicker3D.tsx`
- Modify: `arena/frontend/src/components/CharacterPicker.tsx`

- [ ] **Step 1: Add 3 new characters to CHARACTERS array in CharacterPicker3D.tsx**

```typescript
const CHARACTERS = [
    { id: 'student',              name: 'Student',     color: '#00f2ff' },
    { id: 'researcher',           name: 'Researcher',  color: '#3eff8b' },
    { id: 'professor',            name: 'Professor',   color: '#bc13fe' },
    { id: 'dean',                 name: 'Dean',        color: '#ffd700' },
    { id: 'librarian',            name: 'Librarian',   color: '#ff6b9d' },
    { id: 'graduate',             name: 'Graduate',    color: '#ff8c42' },
    { id: 'lab_assistant',        name: 'Lab Asst.',   color: '#42f5d1' },
    { id: 'teaching_assistant',   name: 'TA',          color: '#f542e0' },
];
```

- [ ] **Step 2: Add ownership state via props**

Update the component props:

```typescript
interface CharacterPicker3DProps {
    selectedCharacter: string;
    selectedGender: 'male' | 'female';
    onSelect: (character: string, gender: 'male' | 'female') => void;
    ownedCharacters?: string[];
    respectBalance?: number;
    onPurchase?: (characterId: string) => Promise<boolean>;
}
```

- [ ] **Step 3: Add locked state to character buttons**

In the map over CHARACTERS, add locked visual treatment:

```typescript
{CHARACTERS.map((c) => {
    const isSelected = selectedCharacter === c.id;
    const isOwned = !ownedCharacters || ownedCharacters.includes(c.id);

    return (
        <button
            key={c.id}
            onClick={() => {
                if (!isOwned && onPurchase) {
                    if (confirm(`Purchase ${c.name} for 500 Respect? (Balance: ${respectBalance ?? 0})`)) {
                        onPurchase(c.id);
                    }
                    return;
                }
                onSelect(c.id, selectedGender);
            }}
            style={{
                padding: '6px',
                background: isSelected ? `${c.color}22` : '#0a0a14',
                border: `2px solid ${isSelected ? c.color : '#2a2a4a'}`,
                borderRadius: '8px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'all 0.15s ease',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                opacity: isOwned ? 1 : 0.4,
                position: 'relative' as const,
            }}
        >
            {/* existing img + span */}
            {!isOwned && (
                <span style={{ fontSize: '0.6rem', color: '#ffd700' }}>🔒 500</span>
            )}
        </button>
    );
})}
```

- [ ] **Step 4: Update grid to accommodate 8 characters**

Change grid from 5 columns to 4:

```typescript
gridTemplateColumns: 'repeat(4, 1fr)',
```

- [ ] **Step 5: Update loadSavedCharacter to validate against ownership**

This is handled in Lobby.tsx (Task 9), not here.

- [ ] **Step 6: Apply same changes to CharacterPicker.tsx (fallback picker)**

Add the same 3 characters and locked state logic to the fallback `CharacterPicker.tsx`.

- [ ] **Step 7: Commit**

```bash
git add arena/frontend/src/components/CharacterPicker3D.tsx arena/frontend/src/components/CharacterPicker.tsx
git commit -m "feat(arena): add 3 new characters + locked UI with purchase flow to character pickers"
```

---

## Task 9: Arena — Lobby Ownership Guard + Backend Validation

**Files:**
- Modify: `arena/frontend/src/components/Lobby.tsx`
- Modify: `arena/backend/src/services/SocketService.ts`

- [ ] **Step 1: Lobby.tsx — Fetch owned characters + pass to picker**

Import the auth service URL helper (Arena already has `apiService.getAuthServiceUrl()`):

```typescript
import { getAuthServiceUrl } from '../services/apiService';
```

Add state for ownership and fetch from auth on mount. **IMPORTANT:** Arena frontend is at `arena.korczewski.de` but auth is at `auth.korczewski.de` — must use the auth service URL, not relative paths:

```typescript
const [ownedCharacters, setOwnedCharacters] = useState<string[]>(['student']);
const [respectBalance, setRespectBalance] = useState(0);

useEffect(() => {
    const authUrl = getAuthServiceUrl();
    if (!authUrl) return;
    fetch(`${authUrl}/api/catalog/characters`, { credentials: 'include' })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
            if (data) {
                setOwnedCharacters(['student', ...data.ownedCharacterIds.map((id: string) => id.replace('character_', ''))]);
                setRespectBalance(data.respectBalance);
            }
        })
        .catch(() => { /* keep default student-only */ });
}, []);
```

- [ ] **Step 2: Guard stale localStorage selection**

After fetching ownership, check if saved character is valid:

```typescript
useEffect(() => {
    if (ownedCharacters.length > 1 && !ownedCharacters.includes(selectedCharacter)) {
        setSelectedCharacter('student');
    }
}, [ownedCharacters, selectedCharacter]);
```

- [ ] **Step 3: Add purchase handler and pass props to CharacterPicker**

```typescript
const handlePurchase = async (characterId: string): Promise<boolean> => {
    try {
        const authUrl = getAuthServiceUrl();
        if (!authUrl) return false;
        const res = await fetch(`${authUrl}/api/catalog/purchase`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ itemId: `character_${characterId}` }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
            setOwnedCharacters(prev => [...prev, characterId]);
            setRespectBalance(data.newBalance);
            setSelectedCharacter(characterId);
            return true;
        }
        return false;
    } catch { return false; }
};
```

Pass to picker: `<CharacterPicker ... ownedCharacters={ownedCharacters} respectBalance={respectBalance} onPurchase={handlePurchase} />`

- [ ] **Step 4: SocketService.ts — Validate character on join-lobby**

In the `join-lobby` handler in `SocketService.ts`, after fetching the auth profile (which includes inventory), add an ownership check:

```typescript
// After profile fetch, extract owned characters
const ownedCharacterIds = (profile?.inventory || [])
    .filter((item: any) => item.itemType === 'character' || item.item_type === 'character')
    .map((item: any) => (item.itemId || item.item_id || '').replace('character_', ''));

// Validate requested character
const baseCharacter = request.character?.replace('_f', '') || 'student';
if (baseCharacter !== 'student' && !ownedCharacterIds.includes(baseCharacter)) {
    console.warn(`[SocketService] Player ${request.id} attempted unowned character ${baseCharacter}, falling back to student`);
    request.character = request.gender === 'female' ? 'student_f' : 'student';
}
```

- [ ] **Step 5: Apply same ownership check to private match join handler**

SocketService has a **second** lobby join code path for private/escrow matches (~lines 407-463) that also fetches the auth profile and uses the character. Apply the identical ownership extraction + validation logic there:

```typescript
// Same pattern as step 4 — after profile fetch in the private match handler:
const ownedCharacterIds = (profile?.inventory || [])
    .filter((item: any) => item.itemType === 'character' || item.item_type === 'character')
    .map((item: any) => (item.itemId || item.item_id || '').replace('character_', ''));

const baseCharacter = request.character?.replace('_f', '') || 'student';
if (baseCharacter !== 'student' && !ownedCharacterIds.includes(baseCharacter)) {
    request.character = request.gender === 'female' ? 'student_f' : 'student';
}
```

- [ ] **Step 6: Commit**

```bash
git add arena/frontend/src/components/Lobby.tsx arena/backend/src/services/SocketService.ts
git commit -m "feat(arena): add character ownership guard in lobby + backend validation on join"
```

---

## Task 10: Arena Backend — POST /api/players Ownership Validation

**Files:**
- Modify: `arena/backend/src/app.ts`

- [ ] **Step 1: Add ownership check to POST /api/players**

In `app.ts`, find the `POST /api/players` handler that saves `selectedCharacter`. Before writing to the database, validate ownership by checking the auth profile:

```typescript
// When selectedCharacter is provided and is not 'student':
const baseChar = (selectedCharacter || 'student').replace('_f', '');
if (baseChar !== 'student') {
    // Fetch auth profile to check inventory
    try {
        const profileRes = await fetch(`${AUTH_SERVICE_URL}/api/profile`, {
            headers: { Cookie: req.headers.cookie || '' },
        });
        if (profileRes.ok) {
            const profile = await profileRes.json();
            const ownedIds = (profile.inventory || [])
                .filter((item: any) => item.itemType === 'character')
                .map((item: any) => item.itemId.replace('character_', ''));
            if (!ownedIds.includes(baseChar)) {
                return res.status(403).json({ error: 'Character not purchased' });
            }
        } else {
            // Auth unreachable — only allow student
            return res.status(503).json({ error: 'Cannot verify character ownership' });
        }
    } catch {
        return res.status(503).json({ error: 'Cannot verify character ownership' });
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add arena/backend/src/app.ts
git commit -m "feat(arena): validate character ownership on POST /api/players"
```

---

## Task 11: Build Verification + Deploy

- [ ] **Step 1: Typecheck all modified services**

```bash
cd auth && npx tsc --noEmit
cd ../l2p && npm run typecheck
cd ../arena && npm run typecheck
```

All must pass with 0 errors.

- [ ] **Step 2: Run L2P tests**

```bash
cd l2p && npm run test:unit 2>&1 | tail -5
```

- [ ] **Step 3: Run Arena tests**

```bash
cd arena && npm test 2>&1 | tail -5
```

- [ ] **Step 4: Run auth tests if they exist**

```bash
cd auth && npm test 2>&1 | tail -5
```

- [ ] **Step 5: Deploy**

```bash
../../k8s/scripts/deploy/deploy-all.sh
```

- [ ] **Step 6: Verify deployment**

```bash
../../k8s/scripts/utils/deploy-tracker.sh status
```

- [ ] **Step 7: Run migrations on production database**

```bash
# Apply catalog seed
kubectl exec -it deploy/postgres -n korczewski-infra -- psql -U auth_user -d auth_db < auth/migrations/007_seed_character_catalog.sql

# Apply grandfather migration
kubectl exec -it deploy/postgres -n korczewski-infra -- psql -U auth_user -d auth_db < auth/migrations/008_grandfather_character_ownership.sql

# Verify
kubectl exec -it deploy/postgres -n korczewski-infra -- psql -U auth_user -d auth_db -c "SELECT count(*) FROM auth.shop_catalog WHERE item_type = 'character';"
# Expected: 7
```
