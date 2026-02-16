# Design: i18n Header Toggle & Fixed Perk Progression

**Date**: 2026-02-16
**Status**: Approved

## Overview

Three changes to L2P:
1. Language toggle (DE/EN) in the header navbar for instant switching
2. Replace draft-based perk system with fixed per-level perk progression
3. Keep cosmetic perks configurable from PerksManager with level-based auto-unlock

## Section 1: Language Toggle in Header

### Current State
- `LocalizationService` with 298 EN/DE translation keys exists
- `useLocalization()` hook dispatches `languageChanged` custom events for reactivity
- `LanguageSelector` component exists but is only in Settings Modal
- Dual persistence issue: localStorage `language` key vs Zustand `settingsStore`

### Changes
- **`Header.tsx`**: Add compact flag toggle button (DE/EN) between volume and logout
- **Header nav text**: Use `t()` translations for "Home", "Profile", "Question Sets", etc.
- **Fix dual persistence**: Remove `language` from `settingsStore` (localizationService is source of truth)

## Section 2: Fixed Perk Progression

### Current State
- 40 gameplay perks (`type='gameplay'`) in `perks` table, no `level_required` column
- Draft system: 3 random perks offered per level-up, user picks 1 or dumps all 3
- `user_perk_drafts` table tracks choices
- `PerkDraftPanel.tsx` shows 3-choice UI, `SkillTree.tsx` shows history

### Design
Re-add `level_required` to gameplay perks. Each level (1-40) unlocks exactly 1 perk.
Category rotation (time -> info -> scoring -> recovery -> xp) with tier escalation.

#### Fixed Perk-per-Level Mapping

| Level | Perk Name | Category | Tier |
|-------|-----------|----------|------|
| 1 | Time Cushion | time | 1 |
| 2 | Category Reveal | info | 1 |
| 3 | Score Boost | scoring | 1 |
| 4 | Safety Net | recovery | 1 |
| 5 | XP Boost I | xp | 1 |
| 6 | Slow Burn | time | 1 |
| 7 | Difficulty Sense | info | 1 |
| 8 | Speed Demon | scoring | 1 |
| 9 | Partial Credit | recovery | 1 |
| 10 | Study Bonus | xp | 1 |
| 11 | Early Bird | time | 1 |
| 12 | Fifty-Fifty Lite | info | 1 |
| 13 | Streak Master | scoring | 1 |
| 14 | Bounce Back | recovery | 1 |
| 15 | Completion Reward | xp | 1 |
| 16 | Time Warp | time | 2 |
| 17 | Knowledge Map | info | 2 |
| 18 | Combo Builder | scoring | 2 |
| 19 | Resilient | recovery | 2 |
| 20 | XP Boost II | xp | 2 |
| 21 | Zen Mode | time | 2 |
| 22 | Hint Master | info | 2 |
| 23 | Perfectionist | scoring | 2 |
| 24 | Comeback King | recovery | 2 |
| 25 | Accuracy Bonus | xp | 2 |
| 26 | Flash Answer | time | 2 |
| 27 | Double Eliminate | info | 2 |
| 28 | The Closer | scoring | 2 |
| 29 | Double Safety | recovery | 2 |
| 30 | Streak XP | xp | 1 |
| 31 | Time Lord | time | 3 |
| 32 | Answer Statistics | info | 1 |
| 33 | Mega Streak | scoring | 3 |
| 34 | Iron Will | recovery | 3 |
| 35 | XP Boost III | xp | 3 |
| 36 | Temporal Anchor | time | 3 |
| 37 | Oracle Vision | info | 3 |
| 38 | Grand Scorer | scoring | 3 |
| 39 | Phoenix | recovery | 3 |
| 40 | Mastery XP | xp | 3 |

### DB Changes
- Add `level_required` column back to `perks` table
- Update all 40 gameplay perks with fixed level assignments
- Keep `user_perk_drafts` table (existing data stays; reads switch to level-based)

### Backend Changes
- `CharacterService.awardExperience()`: Return newly unlocked perks on level-up (no draft generation)
- `PerkDraftService`: Simplify `getActiveGameplayPerks()` to query by level; remove draft/pick/dump methods
- Remove `perk:pick`, `perk:dump` socket events
- Remove `/api/perks/draft/pick`, `/dump`, `/reset` routes

### Frontend Changes
- Delete `PerkDraftPanel.tsx`, `SkillTree.tsx`
- Simplify or delete `perkDraftStore.ts`
- Level-up notification: show "You unlocked [perk name]!"
- Remove `draft.*` and `skillTree.*` translation keys

## Section 3: Cosmetic Perks (Minimal Change)

### Current State
- PerksManager already shows cosmetic perks with activate/deactivate/config
- Cosmetic perks have `level_required` in `perks` table

### Changes
- Backend `getUserPerks()`: Compute `is_unlocked` as `userLevel >= level_required`
- Frontend PerksManager: No major changes; remove any draft state references
