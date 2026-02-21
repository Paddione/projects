# Loadout Manager Refinement Design

## Problem

The PerksManager component has all 9 loadout slot types implemented in the backend, but the frontend UX is broken: the only slot with a direct selection mechanism is the badge dropdown. All other slots require a 3-step indirect flow (click slot filter card → find perk in grid → open modal → configure → activate). Users see a complex UI but can only meaningfully interact with the badge dropdown.

## Design

Replace the current 3-part layout (slot filter cards + perk grid + sidebar) with a focused 2-column layout where each slot has an inline selector.

### Layout

**Left column — Slot Selectors**: Each of the 9 slots is a row with:
- Slot icon + label
- Dropdown to select a perk (or locked indicator if user level is too low)
- Inline config options that appear below when a perk is selected
- Auto-activation on config selection (no separate "Activate" button)

**Right column — Loadout Summary**: Compact sidebar showing all 9 slots at a glance with what's equipped. Replaces the old 3-card sidebar (partial loadout + badge dropdown + active perks list).

### Interaction Flow

1. User sees all 9 slots listed vertically
2. Unlocked slots have a dropdown showing available perks for that type
3. Selecting a perk from dropdown → config options appear inline below the slot
4. Selecting a config option → auto-calls `activatePerk(perkId, config)` → sidebar updates
5. "Clear" option in dropdown deactivates the slot
6. Locked slots show "Level X required" with no interaction

### What Gets Removed
- Filter tabs (All/Unlocked/Active/Cosmetic/Locked)
- Perk card grid and `renderPerkCard()`
- Perk details modal (`isDetailsOpen`, `selectedPerk` state)
- Standalone badge dropdown section (`renderSimpleBadgeSelector()`)
- `selectedBadge`, `activeFilter` state variables
- `filteredPerks` memo, `getFilterCount()`, `getLockedPerks()`, etc.

### What Gets Kept
- All config option constants (`AVATAR_OPTIONS`, `THEME_OPTIONS`, `BADGE_STYLE_OPTIONS`, `HELPER_OPTIONS`, `DISPLAY_OPTIONS`, `EMOTE_OPTIONS`, `SOUND_OPTIONS`, `MULTIPLIER_OPTIONS`, `TITLE_OPTIONS`)
- `fetchUserPerks()` + exponential backoff retry logic
- `activatePerk()` / `deactivatePerk()` API calls
- Theme and avatar service side effects on activation
- `canUsePerk()` level check logic
- Loading/error/empty states for initial data fetch
- `PERK_SLOTS` array defining the 9 slot types

### New Behavior
- Two-stage inline selection: perk dropdown → config options appear → auto-activate on pick
- Per-slot loading state during activation (small spinner)
- Per-slot error display on activation failure
- Locked slots show minimum required level from available perks of that type

### Files Changed
- `l2p/frontend/src/components/PerksManager.tsx` — full rewrite of render logic
- `l2p/frontend/src/components/PerksManager.css` — updated styles for slot rows + inline config

### Files Unchanged
- Backend routes, services, repositories — no API changes needed
- `apiService.ts` perk methods — same endpoints used
- `ProfilePage.tsx` — still renders `<PerksManager />` the same way
- Localization keys — reuse existing `perk.slot.*`, `perk.select*` keys
