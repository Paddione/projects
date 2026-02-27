# Flatten Perk Manager Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the 2-step perk selection flow (dropdown + config buttons) with a single flat button grid per slot, so users pick their final option in one click.

**Architecture:** The `PerksManager.tsx` component currently uses a `<select>` dropdown per slot to pick a perk, then shows config buttons. We flatten this by building a `FlatOption[]` per slot that merges all perks' config options into one list. Each button carries both `perkId` and `configValue`, calling `activatePerk` directly on click. Backend unchanged.

**Tech Stack:** React 18, TypeScript, Jest + React Testing Library, CSS

---

### Task 1: Write Tests for Flat Option Grid

**Files:**
- Rewrite: `l2p/frontend/src/components/__tests__/PerksManager.test.tsx`

**Context:** The existing test file has 6 tests for the old dropdown-based UI. We rewrite it with comprehensive tests for the new flat grid. The component uses `apiService.getUserPerks()` which returns `{ perks, activePerks, loadout }`. The mock data must include multiple perks per slot type to test the flattening.

**Step 1: Write the new test file**

Replace `l2p/frontend/src/components/__tests__/PerksManager.test.tsx` with:

```tsx
import React from 'react'
import { render, screen, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import PerksManager from '../PerksManager'
import { useAuthStore } from '../../stores/authStore'
import { apiService } from '../../services/apiService'

jest.mock('../../services/apiService', () => ({
  apiService: {
    getUserPerks: jest.fn(),
    activatePerk: jest.fn(),
    deactivatePerk: jest.fn(),
  }
}))

jest.mock('../../services/themeService', () => ({
  themeService: { initialize: jest.fn(), setTheme: jest.fn() }
}))

jest.mock('../../services/avatarService', () => ({
  avatarService: { initialize: jest.fn(), setActiveAvatarOverride: jest.fn() }
}))

jest.mock('../../stores/authStore')
const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>

// --- Mock Data ---

const mockUser = {
  id: '1',
  username: 'testuser',
  email: 'test@example.com',
  level: 12,
  experience: 2400,
}

/** Two avatar perks: Collection I (level 3, unlocked) and Collection II (level 12, unlocked) + Legendary (level 25, locked) */
const mockPerksPayload = {
  perks: [
    // --- Badge (level 2 = unlocked) ---
    {
      id: 1, user_id: 1, perk_id: 1, is_unlocked: true, is_active: false, configuration: {},
      perk: { id: 1, name: 'starter_badge', category: 'cosmetic', type: 'badge', level_required: 2, title: 'Starter Badge', description: 'Bronze badge', is_active: true }
    },
    // --- Avatar Collection I (level 3 = unlocked) ---
    {
      id: 2, user_id: 1, perk_id: 2, is_unlocked: true, is_active: false, configuration: {},
      perk: { id: 2, name: 'custom_avatars_basic', category: 'cosmetic', type: 'avatar', level_required: 3, title: 'Avatar Collection I', description: 'Basic avatars', is_active: true }
    },
    // --- Avatar Collection II (level 12 = unlocked) ---
    {
      id: 3, user_id: 1, perk_id: 3, is_unlocked: true, is_active: false, configuration: {},
      perk: { id: 3, name: 'custom_avatars_advanced', category: 'cosmetic', type: 'avatar', level_required: 12, title: 'Avatar Collection II', description: 'Advanced avatars', is_active: true }
    },
    // --- Legendary Avatars (level 25 = LOCKED) ---
    {
      id: 4, user_id: 1, perk_id: 4, is_unlocked: false, is_active: false, configuration: {},
      perk: { id: 4, name: 'legendary_avatars', category: 'cosmetic', type: 'avatar', level_required: 25, title: 'Legendary Avatars', description: 'Elite avatars', is_active: true }
    },
    // --- Theme (level 5 = unlocked) ---
    {
      id: 5, user_id: 1, perk_id: 5, is_unlocked: true, is_active: true, configuration: { theme_name: 'dark' },
      perk: { id: 5, name: 'ui_themes_basic', category: 'cosmetic', type: 'theme', level_required: 5, title: 'Color Themes I', description: 'Basic themes', is_active: true }
    },
    // --- Title (level 30 = LOCKED, all options locked → slot locked) ---
    {
      id: 6, user_id: 1, perk_id: 6, is_unlocked: false, is_active: false, configuration: {},
      perk: { id: 6, name: 'master_scholar', category: 'cosmetic', type: 'title', level_required: 30, title: 'Master Scholar', description: 'Prestigious title', is_active: true }
    },
  ],
  activePerks: [
    {
      id: 5, user_id: 1, perk_id: 5, is_unlocked: true, is_active: true, configuration: { theme_name: 'dark' },
      perk: { id: 5, name: 'ui_themes_basic', category: 'cosmetic', type: 'theme', level_required: 5, title: 'Color Themes I', description: 'Basic themes', is_active: true }
    }
  ],
  loadout: {
    user_id: 1,
    active_avatar: null,
    active_badge: null,
    active_theme: 'dark',
    active_title: null,
    perks_config: {},
    active_perks: [],
    active_cosmetic_perks: {}
  }
}

function setupAuthMock(user: any = mockUser) {
  const mockStoreState = {
    user,
    token: 'test-token',
    isAuthenticated: !!user,
    login: jest.fn(), logout: jest.fn(), register: jest.fn(),
    refreshToken: jest.fn(), setUser: jest.fn(), setToken: jest.fn(),
    clearAuth: jest.fn(), setLoading: jest.fn(), setError: jest.fn()
  }
  mockUseAuthStore.mockImplementation((selector: any) => {
    if (typeof selector === 'function') return selector(mockStoreState)
    return mockStoreState
  })
}

describe('PerksManager', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    setupAuthMock()
    ;(apiService.getUserPerks as jest.Mock).mockResolvedValue({ success: true, data: mockPerksPayload })
    ;(apiService.activatePerk as jest.Mock).mockResolvedValue({ success: true })
    ;(apiService.deactivatePerk as jest.Mock).mockResolvedValue({ success: true })
  })

  // --- Loading & Error States ---

  it('shows loading spinner before data resolves', () => {
    render(<PerksManager />)
    expect(screen.getByText('Loading your perks...')).toBeInTheDocument()
    expect(document.querySelector('.loading-spinner')).toBeInTheDocument()
  })

  it('handles API errors gracefully', async () => {
    ;(apiService.getUserPerks as jest.Mock).mockResolvedValueOnce({ success: false, error: 'Server error' })
    render(<PerksManager />)
    expect(await screen.findByText('Unable to Load Perks')).toBeInTheDocument()
    expect(screen.getByText('Server error')).toBeInTheDocument()
    expect(screen.getByText('Retry Now')).toBeInTheDocument()
  })

  it('handles network errors gracefully', async () => {
    ;(apiService.getUserPerks as jest.Mock).mockRejectedValueOnce(new Error('Network error'))
    render(<PerksManager />)
    expect(await screen.findByText('Unable to Load Perks')).toBeInTheDocument()
    expect(screen.getByText('Network error')).toBeInTheDocument()
  })

  it('renders nothing when unauthenticated', () => {
    setupAuthMock(null)
    const { container } = render(<PerksManager />)
    expect(apiService.getUserPerks).not.toHaveBeenCalled()
    expect(container.firstChild?.textContent).toBe('')
  })

  // --- Flat Grid Rendering ---

  it('renders all 9 slot sections after data loads', async () => {
    render(<PerksManager />)
    await screen.findByText('Your Loadout')
    // Each slot label appears at least in the main area
    for (const label of ['Avatar', 'Theme', 'Badge']) {
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1)
    }
  })

  it('renders flat option buttons for unlocked avatar perks', async () => {
    render(<PerksManager />)
    await screen.findByText('Your Loadout')
    // Avatar Collection I options (level 3, unlocked): student/professor/librarian/researcher mapped to Scholarly Student etc.
    // Avatar Collection II options (level 12, unlocked): detective/chef/astronaut mapped to labels
    // These come from the AVATAR_OPTIONS constant which has: Scholarly Student, Wise Professor, Master Librarian, Lab Researcher
    // AND the advanced options mapped via config_schema from the perk
    // The flat grid should show buttons, not a <select> dropdown
    const selects = screen.queryAllByRole('combobox')
    // No combobox/select elements should exist for slots with options
    // (the old UI used <select>, new UI uses button grid)
    expect(selects.length).toBe(0)
  })

  it('shows locked options with lock indicator and level requirement', async () => {
    render(<PerksManager />)
    await screen.findByText('Your Loadout')
    // Legendary Avatars perk requires level 25, user is level 12
    // Its options should show as locked with "Lv 25"
    expect(screen.getAllByText(/Lv\s*25/i).length).toBeGreaterThanOrEqual(1)
  })

  it('shows fully locked slot when all perks require higher level', async () => {
    render(<PerksManager />)
    await screen.findByText('Your Loadout')
    // Title slot: only perk is master_scholar at level 30, user is level 12
    expect(screen.getByText(/Unlock at Level 30/i)).toBeInTheDocument()
  })

  // --- Selection & Activation ---

  it('calls activatePerk when clicking an unlocked option', async () => {
    const user = userEvent.setup()
    render(<PerksManager />)
    await screen.findByText('Your Loadout')

    // Find and click an avatar option button (e.g., "Scholarly Student")
    const studentBtn = screen.getByRole('button', { name: /Scholarly Student/i })
    await user.click(studentBtn)

    await waitFor(() => {
      expect(apiService.activatePerk).toHaveBeenCalledWith(
        2, // perk ID for custom_avatars_basic
        expect.objectContaining({ selected_avatar: 'student' })
      )
    })
  })

  it('does not call activatePerk when clicking a locked option', async () => {
    const user = userEvent.setup()
    render(<PerksManager />)
    await screen.findByText('Your Loadout')

    // Find a locked option button (Legendary Avatars) — they should be disabled
    const lockedButtons = document.querySelectorAll('.option-btn.locked')
    if (lockedButtons.length > 0) {
      await user.click(lockedButtons[0] as HTMLElement)
    }
    expect(apiService.activatePerk).not.toHaveBeenCalled()
  })

  it('highlights the currently active option', async () => {
    render(<PerksManager />)
    await screen.findByText('Your Loadout')
    // Theme "dark" is active in the loadout (active_theme: 'dark')
    // The Dark Mode button should have the 'selected' class
    const darkBtn = screen.getByRole('button', { name: /Dark Mode/i })
    expect(darkBtn.classList.contains('selected')).toBe(true)
  })

  // --- Clear Slot ---

  it('shows clear button for slots with active perk and calls deactivatePerk', async () => {
    const user = userEvent.setup()
    render(<PerksManager />)
    await screen.findByText('Your Loadout')

    // Theme slot has an active perk — should show a clear button
    const clearBtns = screen.getAllByRole('button', { name: /clear/i })
    expect(clearBtns.length).toBeGreaterThanOrEqual(1)

    // Click the clear button in the theme slot area
    await user.click(clearBtns[0])

    await waitFor(() => {
      expect(apiService.deactivatePerk).toHaveBeenCalled()
    })
  })

  // --- Sidebar ---

  it('shows loadout summary sidebar with active slot values', async () => {
    render(<PerksManager />)
    await screen.findByText('Your Loadout')
    expect(screen.getByText('Current Loadout')).toBeInTheDocument()
    // Theme is active with value 'dark'
    expect(screen.getByText('dark')).toBeInTheDocument()
  })
})
```

**Step 2: Run tests to verify they fail**

Run: `cd l2p/frontend && NODE_ENV=test npx jest src/components/__tests__/PerksManager.test.tsx --no-coverage`

Expected: Most new tests FAIL because the component still renders `<select>` dropdowns, not button grids. The loading/error/unauth tests should still PASS.

**Step 3: Commit failing tests**

```bash
git add l2p/frontend/src/components/__tests__/PerksManager.test.tsx
git commit -m "test(l2p): add failing tests for flattened perk manager grid"
```

---

### Task 2: Refactor PerksManager Component — Data Layer

**Files:**
- Modify: `l2p/frontend/src/components/PerksManager.tsx`

**Context:** Replace the 2-step selection state (`slotSelections` + `slotConfigs`) and handlers (`handleSlotPerkChange` + `handleConfigSelect`) with a flat option model. Keep all existing infrastructure: fetch logic, retry, `activateSlotPerk`, `getConfigPayload`, `extractConfigForSlot`, sidebar, loading/error states. The `*_OPTIONS` constants stay but are consumed differently.

**Step 1: Add the `FlatOption` interface and `getFlatOptionsForSlot` function**

After the `PERK_SLOTS` constant (line 64), add:

```tsx
interface FlatOption {
  perkId: number;
  perkName: string;
  configKey: string;
  optionId: string;
  label: string;
  emoji: string;
  description: string;
  locked: boolean;
  levelRequired: number;
}
```

Inside the component (after the helpers section around line 277), add `getFlatOptionsForSlot`:

```tsx
/** Build a flat list of all options across all perks for a slot type */
const getFlatOptionsForSlot = (slotType: string): FlatOption[] => {
  if (!perksData) return [];
  const userLevel = user?.level ?? 0;
  const slotPerks = perksData.perks.filter(p => p.perk?.type === slotType);
  const options: FlatOption[] = [];

  for (const up of slotPerks) {
    if (!up.perk) continue;
    const perkName = up.perk.name;
    const locked = userLevel < up.perk.level_required;
    const levelRequired = up.perk.level_required;
    const perkId = up.perk.id;

    const configResult = getOptionsForPerk(up.perk.type, perkName);
    if (!configResult) continue;

    for (const opt of configResult.options) {
      options.push({
        perkId,
        perkName,
        configKey: configResult.configKey,
        optionId: opt.id,
        label: opt.label,
        emoji: opt.emoji || '',
        description: opt.description || '',
        locked,
        levelRequired,
      });
    }
  }
  return options;
};
```

**Step 2: Add `getOptionsForPerk` helper (replaces `getConfigOptionsForPerk`)**

This is a pure function that looks up options from the constants without requiring a `UserPerk` object:

```tsx
/** Look up config options for a perk by type and name (pure, no UserPerk needed) */
const getOptionsForPerk = (perkType: string, perkName: string): {
  options: Array<{ id: string; label: string; emoji: string; description: string }>;
  configKey: string;
} | null => {
  switch (perkType) {
    case 'avatar':
      return { options: AVATAR_OPTIONS.map(o => ({ ...o, description: '' })), configKey: 'avatar' };
    case 'theme':
      return { options: THEME_OPTIONS.map(o => ({ id: o.id, label: o.label, emoji: '', description: '' })), configKey: 'theme' };
    case 'badge': {
      const badgeOpts = perkName === 'scholar_badge'
        ? BADGE_STYLE_OPTIONS.filter(o => ['silver', 'gold', 'platinum'].includes(o.id))
        : BADGE_STYLE_OPTIONS.filter(o => ['classic', 'modern', 'minimal'].includes(o.id));
      return { options: badgeOpts.map(o => ({ id: o.id, label: o.label, emoji: '', description: '' })), configKey: 'badgeStyle' };
    }
    case 'helper': {
      const opts = HELPER_OPTIONS[perkName];
      if (!opts) return null;
      const configKey = perkName === 'answer_previews' ? 'highlight_style' : 'hint_level';
      return { options: opts, configKey };
    }
    case 'display': {
      const opts = DISPLAY_OPTIONS[perkName];
      if (!opts) return null;
      const configKey = perkName === 'quick_stats' ? 'position' : perkName === 'enhanced_timers' ? 'visual_style' : 'focus_mode';
      return { options: opts, configKey };
    }
    case 'emote': {
      const opts = EMOTE_OPTIONS[perkName];
      if (!opts) return null;
      const configKey = perkName === 'chat_emotes_basic' ? 'emote_set' : 'size';
      return { options: opts, configKey };
    }
    case 'sound': {
      const opts = SOUND_OPTIONS[perkName];
      if (!opts) return null;
      const configKey = perkName === 'audio_reactions' ? 'reaction_level' : 'pack';
      return { options: opts, configKey };
    }
    case 'multiplier': {
      const opts = MULTIPLIER_OPTIONS[perkName];
      if (!opts) return null;
      const configKey = perkName === 'experience_boost' ? 'duration' : perkName === 'streak_protector' ? 'activation' : 'extra_seconds';
      return { options: opts, configKey };
    }
    case 'title': {
      const opts = TITLE_OPTIONS[perkName];
      if (!opts) return null;
      const configKey = perkName === 'master_scholar' ? 'display_style' : perkName === 'quiz_legend' ? 'aura_effect' : 'exclusive_lobby';
      return { options: opts, configKey };
    }
    default: return null;
  }
};
```

**Step 3: Replace state variables and handlers**

Remove these state variables:
```tsx
// DELETE these:
const [slotSelections, setSlotSelections] = useState<Record<string, number | ''>>({});
const [slotConfigs, setSlotConfigs] = useState<Record<string, Record<string, string>>>({});
```

Replace with:
```tsx
const [slotSelection, setSlotSelection] = useState<Record<string, { perkId: number; optionId: string; configKey: string }>>({});
```

Replace the `useEffect` that initializes from loadout (lines 213-227):
```tsx
useEffect(() => {
  if (!perksData) return;
  const selections: Record<string, { perkId: number; optionId: string; configKey: string }> = {};
  for (const slot of PERK_SLOTS) {
    const activePerk = perksData.activePerks.find(p => p.perk?.type === slot.type);
    if (activePerk?.perk) {
      const config = extractConfigForSlot(activePerk);
      const configResult = getOptionsForPerk(activePerk.perk.type, activePerk.perk.name);
      if (configResult) {
        const optionId = config[configResult.configKey] || '';
        selections[slot.type] = { perkId: activePerk.perk.id, optionId, configKey: configResult.configKey };
      }
    }
  }
  setSlotSelection(selections);
}, [perksData]);
```

Remove `handleSlotPerkChange`, `handleConfigSelect`, and `getConfigOptionsForPerk`. Replace with a single handler:

```tsx
const handleOptionSelect = async (slotType: string, option: FlatOption) => {
  if (option.locked) return;

  // If clicking the already-selected option, do nothing
  const current = slotSelection[slotType];
  if (current && current.perkId === option.perkId && current.optionId === option.optionId) return;

  // If switching from a different perk, deactivate the old one first
  if (current && current.perkId !== option.perkId) {
    try {
      await apiService.deactivatePerk(current.perkId);
    } catch {
      // Best-effort deactivation of old perk
    }
  }

  setSlotSelection(prev => ({
    ...prev,
    [slotType]: { perkId: option.perkId, optionId: option.optionId, configKey: option.configKey }
  }));

  await activateSlotPerk(slotType, option.perkId, option.perkName, { [option.configKey]: option.optionId });
};

const handleClearSlot = async (slotType: string) => {
  const current = slotSelection[slotType];
  if (!current) return;

  setSlotLoading(prev => ({ ...prev, [slotType]: true }));
  setSlotErrors(prev => ({ ...prev, [slotType]: null }));
  try {
    const response = await apiService.deactivatePerk(current.perkId);
    if (response.success) {
      setSlotSelection(prev => { const next = { ...prev }; delete next[slotType]; return next; });
      await fetchUserPerks();
    } else {
      setSlotErrors(prev => ({ ...prev, [slotType]: response.error || 'Failed to clear' }));
    }
  } catch {
    setSlotErrors(prev => ({ ...prev, [slotType]: 'Failed to clear slot' }));
  } finally {
    setSlotLoading(prev => ({ ...prev, [slotType]: false }));
  }
};
```

**Step 4: Run tests to check data layer compiles**

Run: `cd l2p/frontend && NODE_ENV=test npx jest src/components/__tests__/PerksManager.test.tsx --no-coverage`

Expected: Component compiles. Loading/error/unauth tests PASS. Grid tests still FAIL (render not updated yet).

**Step 5: Commit data layer**

```bash
git add l2p/frontend/src/components/PerksManager.tsx
git commit -m "refactor(l2p): flatten perk manager data layer - single selection model"
```

---

### Task 3: Refactor PerksManager Component — Render Layer

**Files:**
- Modify: `l2p/frontend/src/components/PerksManager.tsx` (render section, lines ~582-688)

**Step 1: Replace the slot render section**

Replace the slot selector render (the `{PERK_SLOTS.map(slot => { ... })}` block inside `.perks-main`) with:

```tsx
{PERK_SLOTS.map(slot => {
  const flatOptions = getFlatOptionsForSlot(slot.type);
  const allLocked = flatOptions.length === 0 || flatOptions.every(o => o.locked);
  const minLevel = getMinLevelForSlot(slot.type);
  const currentSel = slotSelection[slot.type];
  const isLoading = slotLoading[slot.type] || false;
  const slotError = slotErrors[slot.type] || null;

  return (
    <div key={slot.id} className={`slot-row ${allLocked ? 'locked' : ''} ${isLoading ? 'loading' : ''}`}>
      <div className="slot-row-header">
        <span className="slot-row-icon">{slot.icon}</span>
        <span className="slot-row-label">{t(`perk.slot.${slot.type}`)}</span>
        {isLoading && <span className="slot-spinner" />}
        {!isLoading && currentSel && !allLocked && (
          <span className="slot-equipped-badge">{t('perk.equipped')}</span>
        )}
        {!isLoading && currentSel && !allLocked && (
          <button
            type="button"
            className="slot-clear-btn"
            onClick={() => handleClearSlot(slot.type)}
            aria-label={`Clear ${slot.label}`}
          >
            {t('perk.clearSlot')}
          </button>
        )}
      </div>

      {allLocked ? (
        <div className="slot-locked-msg">
          {'🔒 ' + t('perk.slotLocked').replace('{level}', String(minLevel || '?'))}
        </div>
      ) : (
        <>
          <div className="option-grid">
            {flatOptions.map(opt => {
              const isSelected = currentSel?.perkId === opt.perkId && currentSel?.optionId === opt.optionId;
              return (
                <button
                  type="button"
                  key={`${opt.perkId}-${opt.optionId}`}
                  className={`option-btn ${isSelected ? 'selected' : ''} ${opt.locked ? 'locked' : ''}`}
                  onClick={() => handleOptionSelect(slot.type, opt)}
                  disabled={isLoading || opt.locked}
                  aria-label={opt.locked ? `${opt.label} (Lv ${opt.levelRequired})` : opt.label}
                  title={opt.description || opt.label}
                >
                  {opt.emoji && <span className="option-emoji">{opt.emoji}</span>}
                  <span className="option-label">{opt.label}</span>
                  {opt.locked && <span className="option-lock">Lv {opt.levelRequired}</span>}
                </button>
              );
            })}
          </div>
          {slotError && <div className="slot-error">{slotError}</div>}
        </>
      )}
    </div>
  );
})}
```

The sidebar (`.perks-overview`) stays unchanged.

**Step 2: Run tests**

Run: `cd l2p/frontend && NODE_ENV=test npx jest src/components/__tests__/PerksManager.test.tsx --no-coverage`

Expected: Most tests PASS. Adjust test expectations if needed (e.g., button names, aria-labels).

**Step 3: Commit render refactor**

```bash
git add l2p/frontend/src/components/PerksManager.tsx
git commit -m "refactor(l2p): flatten perk manager render - button grid replaces dropdown"
```

---

### Task 4: Update CSS for Flat Option Grid

**Files:**
- Modify: `l2p/frontend/src/components/PerksManager.css`

**Step 1: Replace dropdown-specific CSS with grid styles**

Remove `.slot-select` rules (lines 176-203). Add new grid styles:

```css
/* Flat option grid */
.option-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.option-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 14px;
  border: 2px solid var(--color-border, #e2e8f0);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  background: var(--color-background, white);
  text-align: center;
  min-width: 80px;
  position: relative;
}

.option-btn:hover:not(.locked):not(:disabled) {
  border-color: var(--color-primary, #3b82f6);
  background: var(--color-primary-bg, #eff6ff);
}

.option-btn.selected {
  border-color: var(--color-primary, #3b82f6);
  background: var(--color-primary-bg, #eff6ff);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
}

.option-btn.locked {
  opacity: 0.5;
  cursor: not-allowed;
}

.option-emoji {
  font-size: 1.3rem;
}

.option-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-primary, #1e293b);
}

.option-lock {
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--color-text-secondary, #64748b);
  background: var(--color-surface, #f1f5f9);
  padding: 1px 6px;
  border-radius: 4px;
}

/* Clear button in slot header */
.slot-clear-btn {
  margin-left: auto;
  font-size: 0.7rem;
  padding: 2px 8px;
  border: 1px solid var(--color-border, #e2e8f0);
  border-radius: 4px;
  background: transparent;
  color: var(--color-text-secondary, #64748b);
  cursor: pointer;
  transition: all 0.15s;
}

.slot-clear-btn:hover {
  background: var(--color-error-bg, #fef2f2);
  color: var(--color-error, #ef4444);
  border-color: var(--color-error, #ef4444);
}
```

Update mobile responsive rules — replace the `.slot-config-options` / `.slot-config-btn` responsive rules with:

```css
@media (max-width: 768px) {
  .option-grid {
    gap: 6px;
  }

  .option-btn {
    min-width: 60px;
    padding: 8px 10px;
  }
}
```

**Step 2: Run tests to verify nothing broke**

Run: `cd l2p/frontend && NODE_ENV=test npx jest src/components/__tests__/PerksManager.test.tsx --no-coverage`

Expected: All tests still PASS (CSS changes don't affect test logic).

**Step 3: Commit CSS**

```bash
git add l2p/frontend/src/components/PerksManager.css
git commit -m "style(l2p): update perk manager CSS for flat option grid"
```

---

### Task 5: Clean Up Dead Code

**Files:**
- Modify: `l2p/frontend/src/components/PerksManager.tsx`

**Step 1: Remove unused code**

Delete the following now-unused items:
- `getConfigOptionsForPerk` function (replaced by `getOptionsForPerk` + `getFlatOptionsForSlot`)
- Old `handleSlotPerkChange` and `handleConfigSelect` (replaced by `handleOptionSelect` + `handleClearSlot`)
- Any remaining `.slot-config` CSS classes in the file (from old inline config section)
- Old `.slot-select` CSS references if any remain

**Step 2: Run full test suite**

Run: `cd l2p/frontend && NODE_ENV=test npx jest src/components/__tests__/PerksManager.test.tsx --no-coverage`

Expected: All tests PASS.

**Step 3: Run typecheck**

Run: `cd l2p && npm run typecheck`

Expected: No type errors.

**Step 4: Commit cleanup**

```bash
git add l2p/frontend/src/components/PerksManager.tsx l2p/frontend/src/components/PerksManager.css
git commit -m "refactor(l2p): remove dead code from perk manager flattening"
```

---

### Task 6: Final Verification

**Step 1: Run full frontend test suite**

Run: `cd l2p/frontend && NODE_ENV=test npx jest --no-coverage`

Expected: All suites pass.

**Step 2: Run typecheck**

Run: `cd l2p && npm run typecheck`

Expected: Clean.

**Step 3: Final commit (if any fixups needed)**

```bash
git add -A
git commit -m "fix(l2p): address test/type issues from perk manager flattening"
```
