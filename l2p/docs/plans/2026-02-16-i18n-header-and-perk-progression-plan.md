# i18n Header Toggle & Fixed Perk Progression — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a DE/EN language toggle to the header, replace the draft-based perk system with fixed per-level progression, and ensure cosmetic perks remain configurable from the PerksManager loadout UI.

**Architecture:** Three independent workstreams: (1) Frontend-only i18n header toggle using existing `useLocalization` hook, (2) DB migration + backend service changes to switch from draft-based to level-based perk unlocking, (3) Frontend cleanup to remove draft UI and update PerksManager for level-based unlocks.

**Tech Stack:** React 18, TypeScript, Express, PostgreSQL, Drizzle ORM, Socket.io, Zustand, custom LocalizationService

---

## Task 1: Add Language Toggle to Header

**Files:**
- Modify: `l2p/frontend/src/components/Header.tsx`

**Step 1: Add useLocalization import and toggle button**

In `Header.tsx`, import `useLocalization` and add a compact language toggle button between the volume controls and logout button.

```tsx
// Add import at top
import { useLocalization } from '../hooks/useLocalization'

// Inside the Header component, after useAudio destructuring:
const { currentLanguage, setLanguage, t, getLanguageFlag } = useLocalization()

const toggleLanguage = () => {
  setLanguage(currentLanguage === 'en' ? 'de' : 'en')
}
```

Add the toggle button inside `headerControls` div, between the volume controls div and the logout button:

```tsx
{/* Language Toggle */}
<button
  onClick={toggleLanguage}
  className={`${styles.button} ${styles.buttonOutline}`}
  title={currentLanguage === 'en' ? 'Deutsch' : 'English'}
  data-testid="language-toggle"
>
  {getLanguageFlag(currentLanguage === 'en' ? 'de' : 'en')}
</button>
```

**Step 2: Translate hardcoded nav text**

Replace hardcoded English strings in the nav links:

```tsx
// Replace "Home" with:
{t('nav.home')}
// Replace "Profile" with:
{t('nav.play', 'Profile')}
// Replace "Question Sets" with:
{t('help.questionSets', 'Question Sets')}
// Replace "Admin" with:
Admin
// (Admin stays English — it's a proper noun for the panel)
```

Add new translation keys to `localization.ts` for any missing nav items (Profile, Question Sets are not in the current keys). Add:
- `'nav.profile': 'Profile'` / `'nav.profile': 'Profil'`
- `'nav.questionSets': 'Question Sets'` / `'nav.questionSets': 'Fragensets'`

**Step 3: Run dev server and verify**

Run: `cd l2p && npm run dev:frontend`
Expected: Header shows flag toggle, clicking it switches all translated text instantly.

**Step 4: Commit**

```bash
git add l2p/frontend/src/components/Header.tsx l2p/frontend/src/services/localization.ts
git commit -m "feat(l2p): add language toggle to header navbar"
```

---

## Task 2: Fix Dual Language Persistence

**Files:**
- Modify: `l2p/frontend/src/stores/settingsStore.ts`

**Step 1: Remove language from settingsStore**

The `localizationService` singleton + localStorage `'language'` key is the source of truth. Remove the redundant `language` field from settingsStore to prevent desync.

In `settingsStore.ts`:
- Remove `language: Language` from `SettingsState` interface
- Remove `setLanguage` and `toggleLanguage` actions from interface and implementation
- Remove `language` from `initialState`
- Remove `language` from `partialize` (persistence config)
- Keep the `Language` type export (other files may import it)

The `SettingsState` interface becomes:

```typescript
export interface SettingsState {
  theme: Theme
  autoScroll: boolean
  showAnimations: boolean
  setTheme: (theme: Theme) => void
  setAutoScroll: (enabled: boolean) => void
  setShowAnimations: (enabled: boolean) => void
  toggleTheme: () => void
}
```

**Step 2: Fix any imports of language from settingsStore**

Search for `useSettingsStore.*language` and `settingsStore.*language` across the frontend and update any consumers to use `useLocalization()` instead.

Run: `grep -rn "settingsStore\|useSettingsStore" l2p/frontend/src/ --include="*.tsx" --include="*.ts" | grep -i "lang"`

Update each consumer to import from `useLocalization` hook instead.

**Step 3: Commit**

```bash
git add l2p/frontend/src/stores/settingsStore.ts
# plus any files that imported language from settingsStore
git commit -m "fix(l2p): remove duplicate language state from settingsStore"
```

---

## Task 3: Database Migration — Add level_required to Gameplay Perks

**Files:**
- Create: `l2p/backend/migrations/20260216_120000_fixed_perk_progression.sql`

**Step 1: Write the migration**

```sql
-- Migration: Replace draft-based perks with fixed per-level progression
-- Created: 2026-02-16
-- Purpose: Add level_required back to gameplay perks for deterministic unlocking

-- ============================================
-- PHASE 1: Re-add level_required column
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'perks' AND column_name = 'level_required') THEN
        ALTER TABLE perks ADD COLUMN level_required INTEGER DEFAULT 0;
    END IF;
END $$;

-- ============================================
-- PHASE 2: Assign fixed levels to all 40 gameplay perks
-- Category rotation: time -> info -> scoring -> recovery -> xp
-- Tier escalation: Tier 1 (L1-15), Tier 2 (L16-30), Tier 3 (L31-40)
-- ============================================

-- Level 1-5: Tier 1, one from each category
UPDATE perks SET level_required = 1 WHERE name = 'time_cushion';
UPDATE perks SET level_required = 2 WHERE name = 'category_reveal';
UPDATE perks SET level_required = 3 WHERE name = 'score_boost';
UPDATE perks SET level_required = 4 WHERE name = 'safety_net';
UPDATE perks SET level_required = 5 WHERE name = 'xp_boost_light';

-- Level 6-10: Tier 1
UPDATE perks SET level_required = 6 WHERE name = 'slow_burn';
UPDATE perks SET level_required = 7 WHERE name = 'difficulty_sense';
UPDATE perks SET level_required = 8 WHERE name = 'speed_demon';
UPDATE perks SET level_required = 9 WHERE name = 'partial_credit';
UPDATE perks SET level_required = 10 WHERE name = 'study_bonus';

-- Level 11-15: Tier 1
UPDATE perks SET level_required = 11 WHERE name = 'early_bird';
UPDATE perks SET level_required = 12 WHERE name = 'fifty_fifty';
UPDATE perks SET level_required = 13 WHERE name = 'streak_master';
UPDATE perks SET level_required = 14 WHERE name = 'bounce_back';
UPDATE perks SET level_required = 15 WHERE name = 'completion_reward';

-- Level 16-20: Tier 2
UPDATE perks SET level_required = 16 WHERE name = 'time_warp';
UPDATE perks SET level_required = 17 WHERE name = 'knowledge_map';
UPDATE perks SET level_required = 18 WHERE name = 'combo_builder';
UPDATE perks SET level_required = 19 WHERE name = 'resilient';
UPDATE perks SET level_required = 20 WHERE name = 'xp_boost_medium';

-- Level 21-25: Tier 2
UPDATE perks SET level_required = 21 WHERE name = 'zen_mode';
UPDATE perks SET level_required = 22 WHERE name = 'hint_master';
UPDATE perks SET level_required = 23 WHERE name = 'perfectionist';
UPDATE perks SET level_required = 24 WHERE name = 'comeback_king';
UPDATE perks SET level_required = 25 WHERE name = 'accuracy_xp';

-- Level 26-30: Tier 2 + Tier 1
UPDATE perks SET level_required = 26 WHERE name = 'flash_answer';
UPDATE perks SET level_required = 27 WHERE name = 'double_eliminate';
UPDATE perks SET level_required = 28 WHERE name = 'closer';
UPDATE perks SET level_required = 29 WHERE name = 'double_safety';
UPDATE perks SET level_required = 30 WHERE name = 'streak_xp';

-- Level 31-35: Tier 3
UPDATE perks SET level_required = 31 WHERE name = 'time_lord';
UPDATE perks SET level_required = 32 WHERE name = 'answer_stats';
UPDATE perks SET level_required = 33 WHERE name = 'mega_streak';
UPDATE perks SET level_required = 34 WHERE name = 'iron_will';
UPDATE perks SET level_required = 35 WHERE name = 'xp_boost_major';

-- Level 36-40: Tier 3
UPDATE perks SET level_required = 36 WHERE name = 'temporal_anchor';
UPDATE perks SET level_required = 37 WHERE name = 'oracle_vision';
UPDATE perks SET level_required = 38 WHERE name = 'grand_scorer';
UPDATE perks SET level_required = 39 WHERE name = 'phoenix';
UPDATE perks SET level_required = 40 WHERE name = 'mastery_xp';

-- Create index for level-based lookups
CREATE INDEX IF NOT EXISTS idx_perks_level_required ON perks(level_required);

-- Verify: all 40 gameplay perks should have level_required > 0
DO $$
DECLARE
    count INTEGER;
BEGIN
    SELECT COUNT(*) INTO count FROM perks WHERE type = 'gameplay' AND level_required = 0;
    IF count > 0 THEN
        RAISE WARNING '% gameplay perks still have level_required = 0', count;
    END IF;
END $$;
```

**Step 2: Run the migration**

Run: `cd l2p/backend && npm run db:migrate`
Expected: Migration applies successfully. All 40 gameplay perks have `level_required` set.

**Step 3: Commit**

```bash
git add l2p/backend/migrations/20260216_120000_fixed_perk_progression.sql
git commit -m "feat(l2p): add fixed level_required to gameplay perks migration"
```

---

## Task 4: Update PerkDraftService for Level-Based Unlocking

**Files:**
- Modify: `l2p/backend/src/services/PerkDraftService.ts`

**Step 1: Simplify getActiveGameplayPerks to use level_required**

Replace the draft-based query with a level-based query. The method now returns all gameplay perks where the user's level >= the perk's level_required.

```typescript
/**
 * Get active gameplay perks for a user (level-based: all perks where level_required <= user level)
 */
async getActiveGameplayPerks(userId: number): Promise<DraftPerk[]> {
  const result = await this.db.query(`
    SELECT p.id, p.name, p.category, p.type, p.effect_type, p.effect_config, p.tier, p.title, p.description
    FROM perks p
    WHERE p.type = 'gameplay' AND p.is_active = true
    AND p.level_required <= (
      SELECT COALESCE(
        (SELECT character_level FROM user_game_profiles WHERE auth_user_id = $1),
        (SELECT character_level FROM users WHERE id = $1),
        0
      )
    )
    ORDER BY p.level_required ASC
  `, [userId]);
  return result.rows as DraftPerk[];
}
```

**Step 2: Add getNewlyUnlockedPerks method**

```typescript
/**
 * Get perks unlocked between oldLevel and newLevel
 */
async getNewlyUnlockedPerks(oldLevel: number, newLevel: number): Promise<DraftPerk[]> {
  const result = await this.db.query(`
    SELECT id, name, category, type, effect_type, effect_config, tier, title, description
    FROM perks
    WHERE type = 'gameplay' AND is_active = true
    AND level_required > $1 AND level_required <= $2
    ORDER BY level_required ASC
  `, [oldLevel, newLevel]);
  return result.rows as DraftPerk[];
}
```

**Step 3: Remove draft-specific methods**

Remove (or mark deprecated) these methods:
- `generateDraftOffer()`
- `pickPerk()`
- `dumpOffer()`
- `resetDrafts()`
- `getPendingDraftLevels()`
- `getAvailablePool()`
- `getDraftHistory()`
- `getSkillTreeData()`
- `needsRedraft()`
- `clearRedraftFlag()`
- `getPerksByIds()`

Keep `getAllGameplayPerks()` as-is (still useful).

**Step 4: Commit**

```bash
git add l2p/backend/src/services/PerkDraftService.ts
git commit -m "feat(l2p): simplify PerkDraftService to level-based unlocking"
```

---

## Task 5: Update CharacterService — Remove Draft Generation on Level-Up

**Files:**
- Modify: `l2p/backend/src/services/CharacterService.ts`

**Step 1: Replace draft generation with level-based unlock notification**

In `awardExperience()`, replace the draft generation blocks (both OAuth and legacy paths) with:

```typescript
// Return newly unlocked gameplay perks (level-based, no drafts)
let newlyUnlockedPerks: any[] = [];
let pendingDrafts: any[] = []; // Keep empty for backward compat
if (levelUp) {
  try {
    const perkDraftService = PerkDraftService.getInstance();
    newlyUnlockedPerks = await perkDraftService.getNewlyUnlockedPerks(oldLevel, newLevel);
  } catch (error) {
    console.warn('Failed to get newly unlocked perks:', error);
  }
}
```

Do this for BOTH the OAuth path (lines ~300-316) and the legacy path (lines ~351-365).

**Step 2: Remove the DraftOffer import if no longer used**

Check if `DraftOffer` type is imported and used elsewhere. If not, remove the import.

**Step 3: Commit**

```bash
git add l2p/backend/src/services/CharacterService.ts
git commit -m "feat(l2p): remove draft generation from level-up flow"
```

---

## Task 6: Update GameService — Remove Draft Offers from Game Results

**Files:**
- Modify: `l2p/backend/src/services/GameService.ts`

**Step 1: Replace draft generation in endGame results**

In the game-end results loop (~lines 934-976), replace the draft generation block with level-based unlock:

```typescript
// Get newly unlocked perks for this player (level-based)
let newlyUnlockedPerks: any[] = [];
if (userId && experienceResult?.levelUp) {
  try {
    const perkDraftService = PerkDraftService.getInstance();
    newlyUnlockedPerks = await perkDraftService.getNewlyUnlockedPerks(
      experienceResult.oldLevel,
      experienceResult.newLevel
    );
  } catch (e) {
    console.warn(`[GameService] Failed to get unlocked perks for player ${player.id}:`, e);
  }
}
```

Replace `pendingDrafts` with `newlyUnlockedPerks` in the results push. Remove the `perk:draft-available` socket emission.

**Step 2: Update the getActiveGameplayPerks call in startGame**

The `getActiveGameplayPerks()` call at ~line 422 already works with the new level-based implementation (no changes needed there).

**Step 3: Commit**

```bash
git add l2p/backend/src/services/GameService.ts
git commit -m "feat(l2p): replace draft offers with level-based unlocks in game results"
```

---

## Task 7: Update PerksManager Backend — Level-Based getUserPerks

**Files:**
- Modify: `l2p/backend/src/services/PerksManager.ts`

**Step 1: Rewrite getUserPerks for level-based unlocking**

Replace the draft-based `getUserPerks()` with level-based logic:

```typescript
async getUserPerks(userId: number): Promise<UserPerk[]> {
  // Get user level
  const userLevelResult = await this.db.query(`
    SELECT COALESCE(
      (SELECT character_level FROM user_game_profiles WHERE auth_user_id = $1),
      (SELECT character_level FROM users WHERE id = $1),
      0
    ) AS level
  `, [userId]);
  const userLevel = (userLevelResult.rows[0]?.['level'] as number) || 0;

  const query = `
    SELECT
      p.id                AS perk_master_id,
      p.name              AS perk_name,
      p.category          AS perk_category,
      p.type              AS perk_type,
      p.tier              AS perk_tier,
      p.title             AS perk_title,
      p.description       AS perk_description,
      p.effect_type       AS perk_effect_type,
      p.effect_config     AS perk_effect_config,
      p.asset_data        AS perk_asset_data,
      p.level_required    AS perk_level_required,
      p.created_at        AS perk_created_at,
      p.updated_at        AS perk_updated_at
    FROM perks p
    WHERE p.is_active = true
    ORDER BY p.level_required ASC, p.category ASC
  `;

  const result = await this.db.query(query, []);
  return result.rows.map(row => {
    const perkId = row['perk_master_id'] as number;
    const levelRequired = (row['perk_level_required'] as number) || 0;
    const isUnlocked = userLevel >= levelRequired;

    return {
      id: perkId,
      user_id: userId,
      perk_id: perkId,
      is_unlocked: isUnlocked,
      is_active: isUnlocked,
      configuration: row['perk_effect_config'] ?? {},
      updated_at: (row['perk_updated_at'] as Date) ?? new Date(),
      perk: {
        id: perkId,
        name: row['perk_name'] as string,
        category: row['perk_category'] as string,
        type: row['perk_type'] as string,
        level_required: levelRequired,
        title: row['perk_title'] as string,
        description: row['perk_description'] as string,
        asset_data: row['perk_asset_data'],
        is_active: true,
        created_at: (row['perk_created_at'] as Date) ?? new Date(),
        updated_at: (row['perk_updated_at'] as Date) ?? new Date(),
      },
    } as UserPerk;
  });
}
```

**Step 2: Update activatePerk to check level instead of drafts**

Replace the draft check in `activatePerk()`:

```typescript
async activatePerk(userId: number, perkId: number, configuration: any = {}): Promise<boolean> {
  // Check if perk is unlocked via level (user level >= perk level_required)
  const unlockQuery = `
    SELECT p.id, p.type, p.level_required FROM perks p
    WHERE p.id = $1 AND p.is_active = true
    AND p.level_required <= (
      SELECT COALESCE(
        (SELECT character_level FROM user_game_profiles WHERE auth_user_id = $2),
        (SELECT character_level FROM users WHERE id = $2),
        0
      )
    )
  `;
  const unlockResult = await this.db.query(unlockQuery, [perkId, userId]);

  if (unlockResult.rows.length === 0) {
    return false;
  }

  const perkType = unlockResult.rows[0]!['type'];
  await this.updateUserActiveSettings(userId, perkId, perkType, configuration);
  return true;
}
```

**Step 3: Update deactivatePerk similarly**

Replace the draft check:

```typescript
async deactivatePerk(userId: number, perkId: number): Promise<boolean> {
  // Verify perk exists and is unlocked by level
  const perkQuery = `SELECT type FROM perks WHERE id = $1 AND is_active = true`;
  const perkResult = await this.db.query(perkQuery, [perkId]);

  if (perkResult.rows.length === 0) {
    return false;
  }

  const perkType = perkResult.rows[0]!['type'];
  const defaults = this.getDefaultConfigurationForPerk(perkType);
  await this.updateUserActiveSettings(userId, perkId, perkType, defaults);
  return true;
}
```

**Step 4: Update getActivePerks to use level-based query**

```typescript
async getActivePerks(userId: number): Promise<UserPerk[]> {
  const query = `
    SELECT p.*, p.level_required
    FROM perks p
    WHERE p.type = 'gameplay' AND p.is_active = true
    AND p.level_required <= (
      SELECT COALESCE(
        (SELECT character_level FROM user_game_profiles WHERE auth_user_id = $1),
        (SELECT character_level FROM users WHERE id = $1),
        0
      )
    )
    ORDER BY p.level_required ASC
  `;

  const result = await this.db.query(query, [userId]);
  return result.rows.map((row: any) => ({
    id: row.id,
    user_id: userId,
    perk_id: row.id,
    is_unlocked: true,
    is_active: true,
    configuration: row.effect_config || {},
    updated_at: row.updated_at || new Date(),
    perk: {
      id: row.id,
      name: row.name,
      category: row.category,
      type: row.type,
      level_required: row.level_required || 0,
      title: row.title || row.name,
      description: row.description,
      asset_data: row.asset_data,
      is_active: true,
      created_at: row.created_at || new Date(),
      updated_at: row.updated_at || new Date(),
    }
  })) as UserPerk[];
}
```

**Step 5: Commit**

```bash
git add l2p/backend/src/services/PerksManager.ts
git commit -m "feat(l2p): switch PerksManager to level-based perk unlocking"
```

---

## Task 8: Remove Draft Socket Events

**Files:**
- Modify: `l2p/backend/src/services/SocketService.ts`

**Step 1: Remove perk:pick and perk:dump event listeners**

In the `setupSocketHandlers()` method, remove the `socket.on('perk:pick', ...)` and `socket.on('perk:dump', ...)` blocks (~lines 234-248).

**Step 2: Remove handlePerkPick and handlePerkDump methods**

Delete the `handlePerkPick()` method (~lines 682-699) and `handlePerkDump()` method (~lines 701-725).

**Step 3: Remove perkDraftService dependency if no longer used**

Check if `this.perkDraftService` is still used anywhere else in SocketService. If not, remove the import, the property declaration, and the constructor assignment.

**Step 4: Commit**

```bash
git add l2p/backend/src/services/SocketService.ts
git commit -m "feat(l2p): remove draft socket events (perk:pick, perk:dump)"
```

---

## Task 9: Simplify Draft Routes

**Files:**
- Modify: `l2p/backend/src/routes/perkDraft.ts`

**Step 1: Remove draft-specific routes**

Remove these routes:
- `POST /pick` — no more draft picking
- `POST /dump` — no more dump
- `POST /reset` — no more respec
- `GET /pending` — no more pending drafts
- `GET /needs-redraft` — no more migration flag
- `POST /clear-redraft` — no more migration flag
- `GET /skill-tree` — no more skill tree
- `GET /history` — no more draft history
- `GET /pool` — no more available pool

**Step 2: Keep useful routes, update them**

Keep:
- `GET /active` — returns all active gameplay perks (now level-based)

The route stays the same but the service method behind it now returns level-based results.

**Step 3: Commit**

```bash
git add l2p/backend/src/routes/perkDraft.ts
git commit -m "feat(l2p): remove draft API routes, keep /active for level-based perks"
```

---

## Task 10: Frontend — Remove PerkDraftPanel, SkillTree, perkDraftStore

**Files:**
- Delete: `l2p/frontend/src/components/PerkDraftPanel.tsx`
- Delete: `l2p/frontend/src/components/SkillTree.tsx`
- Delete: `l2p/frontend/src/stores/perkDraftStore.ts`
- Delete: `l2p/frontend/src/styles/PerkDraftPanel.module.css`
- Delete: `l2p/frontend/src/styles/SkillTree.module.css`
- Modify: `l2p/frontend/src/pages/ResultsPage.tsx`
- Modify: `l2p/frontend/src/pages/ProfilePage.tsx`

**Step 1: Remove PerkDraftPanel from ResultsPage**

In `ResultsPage.tsx`:
- Remove `import { usePerkDraftStore }`
- Remove `import { PerkDraftPanel }`
- Remove the `pendingDrafts, currentDraftIndex, draftComplete, pickPerk, dumpOffer, clearDrafts, isLoading: draftLoading` destructuring
- Remove `hasPendingDrafts` computed variable
- Remove the `{animationDone && hasPendingDrafts && ...}` JSX block that renders `PerkDraftPanel`
- Remove `handleDraftComplete` callback

**Step 2: Remove SkillTree from ProfilePage**

In `ProfilePage.tsx`:
- Remove `import { SkillTree }`
- Remove `showSkillTree` state
- Remove the Skill Tree toggle button
- Remove the `{showSkillTree && ...}` JSX block

**Step 3: Delete the component files**

Delete `PerkDraftPanel.tsx`, `SkillTree.tsx`, `perkDraftStore.ts`, and their CSS modules.

**Step 4: Commit**

```bash
git add -A l2p/frontend/src/
git commit -m "feat(l2p): remove draft UI (PerkDraftPanel, SkillTree, perkDraftStore)"
```

---

## Task 11: Update Localization — Remove Draft Keys, Add New Ones

**Files:**
- Modify: `l2p/frontend/src/services/localization.ts`

**Step 1: Remove draft and skill tree translation keys**

Remove all `draft.*` keys (7 keys) and `skillTree.*` keys (9 keys) from both `enTranslations` and `deTranslations`.

**Step 2: Add nav translation keys for header**

Add to `enTranslations`:
```typescript
'nav.profile': 'Profile',
'nav.questionSets': 'Question Sets',
```

Add to `deTranslations`:
```typescript
'nav.profile': 'Profil',
'nav.questionSets': 'Fragensets',
```

**Step 3: Update help text for perk system**

Replace the draft-specific help text:

```typescript
// English
'help.perks.draft': 'New gameplay perks unlock automatically as you level up.',
'help.perks.dump': 'Every 5 levels introduces more powerful tier 2 and tier 3 perks.',
'help.perks.reset': 'All unlocked perks are active in gameplay — no manual selection needed.',

// German
'help.perks.draft': 'Neue Gameplay-Perks werden automatisch beim Levelaufstieg freigeschaltet.',
'help.perks.dump': 'Alle 5 Level werden mächtigere Tier-2- und Tier-3-Perks eingeführt.',
'help.perks.reset': 'Alle freigeschalteten Perks sind im Spiel aktiv — keine manuelle Auswahl nötig.',
```

**Step 4: Commit**

```bash
git add l2p/frontend/src/services/localization.ts
git commit -m "feat(l2p): update i18n keys for fixed perk progression"
```

---

## Task 12: Update PerksManager Frontend — Level-Based Display

**Files:**
- Modify: `l2p/frontend/src/components/PerksManager.tsx`

**Step 1: Update canUsePerk to use level_required from perk data**

The `canUsePerk` method already checks `userLevel >= perk.level_required && perk.is_unlocked`. Since the backend now computes `is_unlocked` from level, this should work out of the box.

Verify the perk card status badges show correctly:
- Locked: `userLevel < perk.level_required` → shows "🔒 Locked (Level X)"
- Unlocked gameplay: auto-active, no activate button needed
- Unlocked cosmetic: shows activate/deactivate with config options

**Step 2: Remove console.log debugging statements**

Clean up the `console.log('PerksManager: ...')` statements scattered throughout the component (lines 113, 116, 119, 122, 148, 153, 157, 168). These were for debugging the auth issue.

**Step 3: Commit**

```bash
git add l2p/frontend/src/components/PerksManager.tsx
git commit -m "feat(l2p): clean up PerksManager for level-based perk display"
```

---

## Task 13: Typecheck and Test

**Files:** None (verification only)

**Step 1: Run typecheck**

Run: `cd l2p && npm run typecheck`
Expected: No type errors. Fix any that appear from removed imports/types.

**Step 2: Run backend unit tests**

Run: `cd l2p/backend && NODE_OPTIONS=--experimental-vm-modules npx jest --forceExit`
Expected: Tests pass. Some draft-related tests may need updating or removal.

**Step 3: Run frontend unit tests**

Run: `cd l2p/frontend && NODE_ENV=test npx jest`
Expected: Tests pass. Tests importing deleted components will fail and need removal.

**Step 4: Fix any test failures**

- Remove test files for deleted components (PerkDraftPanel, SkillTree, perkDraftStore)
- Update tests for CharacterService, PerksManager, PerkDraftService to match new behavior
- Update ResultsPage tests to not reference PerkDraftPanel
- Update ProfilePage tests to not reference SkillTree

**Step 5: Commit**

```bash
git add -A l2p/
git commit -m "test(l2p): fix tests for level-based perk progression"
```

---

## Task 14: Final Integration Commit

**Step 1: Run full test suite**

Run: `cd l2p && npm run typecheck && npm run test:unit`
Expected: All green.

**Step 2: Final commit if any remaining fixes**

```bash
git add -A l2p/
git commit -m "feat(l2p): complete i18n header toggle + fixed perk progression"
```

---

## Summary of Changes

| Area | Files Changed | What |
|------|--------------|------|
| i18n Header | `Header.tsx`, `localization.ts`, `settingsStore.ts` | Language toggle in navbar, fix dual persistence |
| DB Migration | `20260216_120000_fixed_perk_progression.sql` | Add level_required to 40 gameplay perks |
| Backend Services | `PerkDraftService.ts`, `CharacterService.ts`, `GameService.ts`, `PerksManager.ts`, `SocketService.ts` | Level-based unlocking, remove draft logic |
| Backend Routes | `perkDraft.ts` | Remove draft routes, keep /active |
| Frontend Delete | `PerkDraftPanel.tsx`, `SkillTree.tsx`, `perkDraftStore.ts`, CSS modules | Remove draft UI |
| Frontend Update | `ResultsPage.tsx`, `ProfilePage.tsx`, `PerksManager.tsx` | Remove draft references |
| i18n Keys | `localization.ts` | Remove draft keys, add nav keys, update help text |
