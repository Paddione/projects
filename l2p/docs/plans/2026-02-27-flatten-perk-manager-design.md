# Flatten Perk Manager Design

## Problem

The PerksManager has a 2-step selection flow per slot: pick a perk from a dropdown, then pick a config option from buttons. For cosmetic slots, the "perk" is just a level-gated container for config options (e.g., "Avatar Collection I" gates access to Scientist/Explorer/Artist). Users think "I want the Scientist avatar," not "I want Avatar Collection I, configured as Scientist." The perk-as-container is an implementation detail leaking into the UX.

## Design

Flatten the 2-step flow into a single button grid per slot. Each button represents one final option (perkId + configValue combined). Clicking it calls `activatePerk` directly.

### Data Model

```ts
interface FlatOption {
  perkId: number;
  perkName: string;
  optionId: string;
  label: string;
  emoji: string;
  description: string;
  locked: boolean;
  levelRequired: number;
}
```

Built by iterating all perks of a slot type and expanding their config options via the existing `*_OPTIONS` constants.

### UI Change

**Before**: `<select>` dropdown per slot + config buttons appearing after selection.

**After**: Flat button grid per slot showing all options (unlocked + locked). Locked options show lock icon + "Lv X" badge and are non-interactive.

### State Simplification

| Before | After |
|--------|-------|
| `slotSelections: Record<string, number \| ''>` | `slotSelection: Record<string, { perkId: number; optionId: string }>` |
| `slotConfigs: Record<string, Record<string, string>>` | (merged into slotSelection) |
| `handleSlotPerkChange` + `handleConfigSelect` (2 handlers) | `handleOptionSelect` (1 handler) |
| `getConfigOptionsForPerk` (switch on type+name) | `getFlatOptionsForSlot` (merge all perks) |

### Removed Code

- `<select>` dropdown and `handleSlotPerkChange`
- `handleConfigSelect` (separate config step)
- `getConfigOptionsForPerk` (replaced by `getFlatOptionsForSlot`)
- `slotConfigs` state variable

### Preserved Code

- `fetchUserPerks`, retry logic, loading/error states
- `activateSlotPerk`, `getConfigPayload` (same API contract)
- `extractConfigForSlot` (reads loadout for current selection)
- Theme/avatar side effects on activation
- Loadout summary sidebar
- All `*_OPTIONS` constants (labels, emojis, descriptions)
- `PERK_SLOTS` array

### Clear Slot

A "clear" button (or deselect action) per slot replaces the `<select>` empty option. Calls `deactivatePerk` on the currently active perk for that slot.

### Backend

No changes. `POST /api/perks/activate/:perkId` with config payload works as-is.

### Tests

New tests:
1. Flat grid renders all options (unlocked + locked) per slot
2. Locked options show lock icon and level requirement
3. Clicking unlocked option calls `activatePerk` with correct perkId + config
4. Clicking locked option does nothing
5. Currently active option shows selected state
6. Clearing a slot deactivates the perk
7. Per-slot loading/error states
8. Unauthenticated user renders nothing

### Files Changed

- `l2p/frontend/src/components/PerksManager.tsx` — refactor render + handlers
- `l2p/frontend/src/components/PerksManager.css` — grid styles for flat options
- `l2p/frontend/src/components/__tests__/PerksManager.test.tsx` — rewrite for new UI
