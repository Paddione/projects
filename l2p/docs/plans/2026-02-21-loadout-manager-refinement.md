# Loadout Manager Refinement Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the broken PerksManager UI (filter cards + perk grid + modal) with inline slot selectors that let users equip/configure perks directly per slot.

**Architecture:** Each of the 9 loadout slots becomes a row with a `<select>` dropdown for perk selection and inline config options that appear below. Selecting a config option auto-activates the perk. No modal, no perk grid, no filter tabs. Two-column layout: slot selectors (left) + compact loadout summary (right).

**Tech Stack:** React 18, existing apiService methods (`getUserPerks`, `activatePerk`, `deactivatePerk`), existing localization via `useLocalization()` hook, existing CSS custom properties.

---

### Task 1: Add new localization keys

**Files:**
- Modify: `l2p/frontend/src/services/localization.ts` (EN block ~line 413, DE block ~line 1073)

**Step 1: Add English keys after `'perk.perks': 'perks'` (line 413)**

Add these keys inside `enTranslations`:
```typescript
  'perk.loadoutHeader': 'Your Loadout',
  'perk.loadoutHeaderDesc': 'Equip and configure perks for each slot.',
  'perk.slotLocked': 'Unlock at Level {level}',
  'perk.clearSlot': '— Clear slot —',
  'perk.choosePerk': '— Choose a perk —',
  'perk.equipping': 'Equipping...',
  'perk.equipped': 'Equipped',
  'perk.slotsActive': '{count}/{total} slots active',
```

**Step 2: Add German keys after `'perk.perks': 'Perks'` (line 1073)**

Add these keys inside `deTranslations`:
```typescript
  'perk.loadoutHeader': 'Dein Loadout',
  'perk.loadoutHeaderDesc': 'Rüste Perks für jeden Slot aus und konfiguriere sie.',
  'perk.slotLocked': 'Freischaltbar ab Level {level}',
  'perk.clearSlot': '— Slot leeren —',
  'perk.choosePerk': '— Perk auswählen —',
  'perk.equipping': 'Wird ausgerüstet...',
  'perk.equipped': 'Ausgerüstet',
  'perk.slotsActive': '{count}/{total} Slots aktiv',
```

**Step 3: Verify no syntax errors**

Run: `cd /home/patrick/projects/l2p/frontend && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to localization.ts

**Step 4: Commit**

```bash
git add l2p/frontend/src/services/localization.ts
git commit -m "feat(l2p): add loadout manager localization keys"
```

---

### Task 2: Rewrite PerksManager component

This is the core task. Replace the entire render section of PerksManager.tsx while keeping the data-fetching and activation logic.

**Files:**
- Modify: `l2p/frontend/src/components/PerksManager.tsx` (full rewrite)

**Step 1: Rewrite PerksManager.tsx**

Keep these from the existing file (lines 1-9, 10-67, 77-201, 203-316, 511-554, 882-928, 931-965):
- All imports
- All interfaces (`Perk`, `UserPerk`, `UserLoadout`, `PerksData`, `PerkSlot`)
- `PERK_SLOTS` constant
- All `*_OPTIONS` constants (AVATAR through TITLE)
- State: `perksData`, `loading`, `error`, `retryCount`, `isFetching` — keep
- State: remove `selectedBadge`, `activeFilter`, `selectedPerk`, `isDetailsOpen`, `configSelection`, `actionLoading`
- State: add `slotSelections` (Record<string, number | ''>), `slotConfigs` (Record<string, Record<string, string>>), `slotLoading` (Record<string, boolean>), `slotErrors` (Record<string, string | null>)
- `fetchUserPerks()` — keep exactly as-is
- `activatePerk()` — keep but add per-slot loading/error
- `deactivatePerk()` — keep but add per-slot loading/error
- `getConfigPayload()` — keep but read from `slotConfigs[slotType]` instead of `configSelection`
- `getCurrentAvatarEmoji()` — keep
- Loading/error/noData early returns — keep

Remove these functions entirely:
- `initializeBadgeSelection()`
- `canUsePerk()`, `isActivePerk()`, `getAllPerks()`, `getUnlockedPerks()`, `getLockedPerks()`, `getActivePerksList()`
- `filteredPerks` useMemo, `getFilterCount()`
- `getBadgeOptionsForPerk()`
- `handlePerkCardClick()`, `closeDetails()`, `handleActivateSelectedPerk()`, `handleDeactivateSelectedPerk()`
- `renderOptionGrid()`, `renderPerkConfiguration()`, `renderPerkCard()`
- `handleBadgeSelection()`, `renderSimpleBadgeSelector()`, `findCurrentBadgeInfo()`
- `getDefaultConfiguration()`, `formatLabel()`

Replace the JSX return (lines 980-1186) with the new layout described below.

The complete new component structure:

```tsx
import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useLocalization } from '../hooks/useLocalization';
import { themeService } from '../services/themeService';
import { avatarService } from '../services/avatarService';
import { apiService } from '../services/apiService';
import './PerksManager.css';

// Keep all existing interfaces: Perk, UserPerk, UserLoadout, PerksData, PerkFilter, PerkSlot
// Keep PERK_SLOTS constant
// Keep all *_OPTIONS constants (AVATAR_OPTIONS through TITLE_OPTIONS)

const PerksManager: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const { t } = useLocalization();

  // Data fetching state (kept from original)
  const [perksData, setPerksData] = useState<PerksData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isFetching, setIsFetching] = useState(false);

  // New: per-slot interaction state
  const [slotSelections, setSlotSelections] = useState<Record<string, number | ''>>({});
  const [slotConfigs, setSlotConfigs] = useState<Record<string, Record<string, string>>>({});
  const [slotLoading, setSlotLoading] = useState<Record<string, boolean>>({});
  const [slotErrors, setSlotErrors] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (user) fetchUserPerks();
  }, [user]);

  // Initialize slot selections from loadout when data loads
  useEffect(() => {
    if (!perksData) return;
    const selections: Record<string, number | ''> = {};
    const configs: Record<string, Record<string, string>> = {};
    for (const slot of PERK_SLOTS) {
      const activePerk = perksData.activePerks.find(p => p.perk?.type === slot.type);
      if (activePerk && activePerk.perk) {
        selections[slot.type] = activePerk.perk.id;
        configs[slot.type] = extractConfigForSlot(activePerk);
      }
    }
    setSlotSelections(selections);
    setSlotConfigs(configs);
  }, [perksData]);

  if (!user) return <div></div>;

  // fetchUserPerks — KEEP EXACTLY AS-IS (lines 239-281)

  // --- Helpers for the new slot-based UI ---

  /** Get all unlocked perks available for a given slot type */
  const getPerksForSlot = (slotType: string): UserPerk[] => {
    if (!perksData) return [];
    const userLevel = user?.level ?? 0;
    return perksData.perks.filter(p =>
      p.perk?.type === slotType && p.is_unlocked && userLevel >= p.perk.level_required
    );
  };

  /** Get the minimum level needed to unlock any perk in this slot */
  const getMinLevelForSlot = (slotType: string): number | null => {
    if (!perksData) return null;
    const slotPerks = perksData.perks.filter(p => p.perk?.type === slotType);
    if (slotPerks.length === 0) return null;
    return Math.min(...slotPerks.map(p => p.perk?.level_required ?? 999));
  };

  /** Check if a slot is fully locked (no unlocked perks) */
  const isSlotLocked = (slotType: string): boolean => {
    return getPerksForSlot(slotType).length === 0;
  };

  /** Extract current config values from an active UserPerk into a flat Record */
  const extractConfigForSlot = (userPerk: UserPerk): Record<string, string> => {
    const config = userPerk.configuration || {};
    const perkName = userPerk.perk?.name || '';
    const perkType = userPerk.perk?.type || '';

    switch (perkType) {
      case 'avatar': return { avatar: config.selected_avatar || 'student' };
      case 'theme': return { theme: config.theme_name || 'default' };
      case 'badge': return { badgeStyle: config.badge_style || config.color || 'classic' };
      case 'helper':
        if (perkName === 'answer_previews') return { highlight_style: config.highlight_style || 'border' };
        if (perkName === 'smart_hints') return { hint_level: config.hint_level || 'moderate' };
        return {};
      case 'display':
        if (perkName === 'quick_stats') return { position: config.position || 'top-right' };
        if (perkName === 'enhanced_timers') return { visual_style: config.visual_style || 'progress' };
        if (perkName === 'focus_mode') {
          const mode = config.zen_mode && config.blur_background ? 'both' : config.zen_mode ? 'zen' : 'blur';
          return { focus_mode: mode };
        }
        return {};
      case 'emote':
        if (perkName === 'chat_emotes_basic') return { emote_set: config.emote_set || 'classic' };
        if (perkName === 'chat_emotes_premium') return { size: config.size || 'medium' };
        return {};
      case 'sound':
        if (perkName === 'audio_reactions') return { reaction_level: config.reaction_level || 'moderate' };
        return { pack: config.pack || 'retro' };
      case 'multiplier':
        if (perkName === 'experience_boost') return { duration: config.duration || 'unlimited' };
        if (perkName === 'streak_protector') return { activation: config.activation || 'automatic' };
        if (perkName === 'time_extension') return { extra_seconds: String(config.extra_seconds || 10) };
        return {};
      case 'title':
        if (perkName === 'master_scholar') return { display_style: config.display_style || 'glow' };
        if (perkName === 'quiz_legend') return { aura_effect: String(config.aura_effect ?? true) };
        if (perkName === 'knowledge_keeper') return { exclusive_lobby: String(config.exclusive_lobby ?? true) };
        return {};
      default: return {};
    }
  };

  /** Build activation payload from slotConfigs (reuses existing getConfigPayload logic) */
  const getConfigPayload = (perkType: string, perkName: string, config: Record<string, string>) => {
    switch (perkType) {
      case 'avatar': return { selected_avatar: config['avatar'] || 'student' };
      case 'theme': return { theme_name: config['theme'] || 'default' };
      case 'badge': return { badge_style: config['badgeStyle'] || 'classic' };
      case 'helper':
        if (perkName === 'answer_previews') return { highlight_style: config['highlight_style'] || 'border' };
        if (perkName === 'smart_hints') return { hint_level: config['hint_level'] || 'moderate' };
        return {};
      case 'display':
        if (perkName === 'quick_stats') return { position: config['position'] || 'top-right' };
        if (perkName === 'enhanced_timers') return { visual_style: config['visual_style'] || 'progress' };
        if (perkName === 'focus_mode') {
          const mode = config['focus_mode'] || 'blur';
          return { blur_background: mode === 'blur' || mode === 'both', zen_mode: mode === 'zen' || mode === 'both' };
        }
        return {};
      case 'emote':
        if (perkName === 'chat_emotes_basic') return { emote_set: config['emote_set'] || 'classic' };
        if (perkName === 'chat_emotes_premium') return { animated: true, size: config['size'] || 'medium' };
        return {};
      case 'sound':
        if (perkName === 'audio_reactions') return { reaction_level: config['reaction_level'] || 'moderate' };
        return { pack: config['pack'] || 'retro' };
      case 'multiplier':
        if (perkName === 'experience_boost') return { duration: config['duration'] || 'unlimited' };
        if (perkName === 'streak_protector') return { activation: config['activation'] || 'automatic' };
        if (perkName === 'time_extension') return { extra_seconds: Number(config['extra_seconds'] || 10) };
        return {};
      case 'title':
        if (perkName === 'master_scholar') return { display_style: config['display_style'] || 'glow' };
        if (perkName === 'quiz_legend') return { aura_effect: config['aura_effect'] === 'true' };
        if (perkName === 'knowledge_keeper') return { exclusive_lobby: config['exclusive_lobby'] === 'true' };
        return {};
      default: return {};
    }
  };

  /** Determine which config options to show for a selected perk */
  const getConfigOptionsForPerk = (userPerk: UserPerk): {
    options: Array<{ id: string; label: string; emoji: string; description: string }>;
    configKey: string;
    title: string;
  } | null => {
    if (!userPerk.perk) return null;
    const perkName = userPerk.perk.name;

    switch (userPerk.perk.type) {
      case 'avatar':
        return { options: AVATAR_OPTIONS.map(o => ({ ...o, description: '' })), configKey: 'avatar', title: t('perk.selectAvatar') };
      case 'theme':
        return { options: THEME_OPTIONS.map(o => ({ id: o.id, label: o.label, emoji: '', description: '' })), configKey: 'theme', title: t('perk.selectTheme') };
      case 'badge': {
        const badgeOpts = userPerk.perk.name === 'scholar_badge'
          ? BADGE_STYLE_OPTIONS.filter(o => ['silver', 'gold', 'platinum'].includes(o.id))
          : BADGE_STYLE_OPTIONS.filter(o => ['classic', 'modern', 'minimal'].includes(o.id));
        return { options: badgeOpts.map(o => ({ id: o.id, label: o.label, emoji: '', description: '' })), configKey: 'badgeStyle', title: t('perk.selectBadgeColor') };
      }
      case 'helper': {
        const opts = HELPER_OPTIONS[perkName];
        if (!opts) return null;
        const configKey = perkName === 'answer_previews' ? 'highlight_style' : 'hint_level';
        const title = perkName === 'answer_previews' ? t('perk.selectHighlightStyle') : t('perk.selectHintDetail');
        return { options: opts, configKey, title };
      }
      case 'display': {
        const opts = DISPLAY_OPTIONS[perkName];
        if (!opts) return null;
        const configKey = perkName === 'quick_stats' ? 'position' : perkName === 'enhanced_timers' ? 'visual_style' : 'focus_mode';
        const title = perkName === 'quick_stats' ? t('perk.selectDashboardPosition') : perkName === 'enhanced_timers' ? t('perk.selectTimerStyle') : t('perk.selectFocusMode');
        return { options: opts, configKey, title };
      }
      case 'emote': {
        const opts = EMOTE_OPTIONS[perkName];
        if (!opts) return null;
        const configKey = perkName === 'chat_emotes_basic' ? 'emote_set' : 'size';
        const title = perkName === 'chat_emotes_basic' ? t('perk.selectEmoteSet') : t('perk.selectEmoteSize');
        return { options: opts, configKey, title };
      }
      case 'sound': {
        const opts = SOUND_OPTIONS[perkName];
        if (!opts) return null;
        const configKey = perkName === 'audio_reactions' ? 'reaction_level' : 'pack';
        const title = perkName === 'audio_reactions' ? t('perk.selectReactionLevel') : t('perk.selectSoundPack');
        return { options: opts, configKey, title };
      }
      case 'multiplier': {
        const opts = MULTIPLIER_OPTIONS[perkName];
        if (!opts) return null;
        const configKey = perkName === 'experience_boost' ? 'duration' : perkName === 'streak_protector' ? 'activation' : 'extra_seconds';
        const title = perkName === 'experience_boost' ? t('perk.selectBoostDuration') : perkName === 'streak_protector' ? t('perk.selectActivationMode') : t('perk.selectExtraTime');
        return { options: opts, configKey, title };
      }
      case 'title': {
        const opts = TITLE_OPTIONS[perkName];
        if (!opts) return null;
        const configKey = perkName === 'master_scholar' ? 'display_style' : perkName === 'quiz_legend' ? 'aura_effect' : 'exclusive_lobby';
        const title = perkName === 'master_scholar' ? t('perk.selectDisplayStyle') : perkName === 'quiz_legend' ? t('perk.auraEffect') : t('perk.vipLobbyAccess');
        return { options: opts, configKey, title };
      }
      default: return null;
    }
  };

  // --- Slot interaction handlers ---

  const handleSlotPerkChange = async (slotType: string, perkIdStr: string) => {
    if (perkIdStr === '') {
      // Clear slot — deactivate current perk
      const currentPerkId = slotSelections[slotType];
      if (currentPerkId) {
        setSlotLoading(prev => ({ ...prev, [slotType]: true }));
        setSlotErrors(prev => ({ ...prev, [slotType]: null }));
        try {
          const response = await apiService.deactivatePerk(Number(currentPerkId));
          if (response.success) {
            await fetchUserPerks();
          } else {
            setSlotErrors(prev => ({ ...prev, [slotType]: response.error || 'Failed' }));
          }
        } catch {
          setSlotErrors(prev => ({ ...prev, [slotType]: 'Failed to clear slot' }));
        } finally {
          setSlotLoading(prev => ({ ...prev, [slotType]: false }));
        }
      }
      setSlotSelections(prev => ({ ...prev, [slotType]: '' }));
      setSlotConfigs(prev => { const next = { ...prev }; delete next[slotType]; return next; });
      return;
    }

    const perkId = Number(perkIdStr);
    setSlotSelections(prev => ({ ...prev, [slotType]: perkId }));

    // Find the perk to check if it needs configuration
    const userPerk = perksData?.perks.find(p => p.perk?.id === perkId);
    if (!userPerk?.perk) return;

    const configInfo = getConfigOptionsForPerk(userPerk);
    if (!configInfo || configInfo.options.length === 0) {
      // No config needed — activate immediately
      await activateSlotPerk(slotType, perkId, userPerk.perk.name, {});
    }
    // If config needed, the inline config UI will appear and user picks an option
  };

  const handleConfigSelect = async (slotType: string, configKey: string, value: string) => {
    const newConfig = { ...slotConfigs[slotType], [configKey]: value };
    setSlotConfigs(prev => ({ ...prev, [slotType]: newConfig }));

    // Auto-activate with selected config
    const perkId = slotSelections[slotType];
    if (!perkId) return;
    const userPerk = perksData?.perks.find(p => p.perk?.id === perkId);
    if (!userPerk?.perk) return;

    await activateSlotPerk(slotType, Number(perkId), userPerk.perk.name, newConfig);
  };

  const activateSlotPerk = async (slotType: string, perkId: number, perkName: string, config: Record<string, string>) => {
    setSlotLoading(prev => ({ ...prev, [slotType]: true }));
    setSlotErrors(prev => ({ ...prev, [slotType]: null }));
    try {
      const payload = getConfigPayload(slotType, perkName, config);
      const response = await apiService.activatePerk(perkId, payload);
      if (response.success) {
        await fetchUserPerks();
        // Side effects
        if (slotType === 'theme' && payload.theme_name) themeService.setTheme(payload.theme_name);
        if (slotType === 'avatar' && payload.selected_avatar) avatarService.setActiveAvatarOverride(payload.selected_avatar);
      } else {
        setSlotErrors(prev => ({ ...prev, [slotType]: response.error || 'Failed to equip' }));
      }
    } catch {
      setSlotErrors(prev => ({ ...prev, [slotType]: 'Failed to equip perk' }));
    } finally {
      setSlotLoading(prev => ({ ...prev, [slotType]: false }));
    }
  };

  // --- Get summary info for sidebar ---
  const getSlotEquippedName = (slotType: string): string | null => {
    const loadout = perksData?.loadout;
    if (!loadout) return null;
    if (slotType === 'avatar' && loadout.active_avatar && loadout.active_avatar !== 'student') return loadout.active_avatar;
    if (slotType === 'theme' && loadout.active_theme && loadout.active_theme !== 'default') return loadout.active_theme;
    if (slotType === 'badge' && loadout.active_badge) return loadout.active_badge;
    if (slotType === 'title' && loadout.active_title) return loadout.active_title;
    const cosmeticPerks = loadout.active_cosmetic_perks || {};
    if (cosmeticPerks[slotType]) {
      const matchingPerk = perksData?.perks.find(p => p.perk_id === cosmeticPerks[slotType].perk_id);
      return matchingPerk?.perk?.title || null;
    }
    return null;
  };

  const getCurrentAvatarEmoji = () => {
    // KEEP EXISTING (lines 916-929)
  };

  const activeSlotCount = PERK_SLOTS.filter(s => getSlotEquippedName(s.type)).length;

  // --- Loading / Error / No Data early returns (KEEP EXISTING lines 931-965) ---

  // --- RENDER ---
  return (
    <div className="perks-manager">
      <div className="perks-header">
        <h2>{t('perk.loadoutHeader')}</h2>
        <p>{t('perk.loadoutHeaderDesc')}</p>
      </div>

      <div className="perks-layout">
        {/* LEFT: Slot selectors */}
        <div className="perks-main">
          <div className="slot-selectors">
            {PERK_SLOTS.map(slot => {
              const available = getPerksForSlot(slot.type);
              const locked = isSlotLocked(slot.type);
              const minLevel = getMinLevelForSlot(slot.type);
              const selectedPerkId = slotSelections[slot.type];
              const selectedUserPerk = selectedPerkId ? perksData?.perks.find(p => p.perk?.id === selectedPerkId) : null;
              const configInfo = selectedUserPerk ? getConfigOptionsForPerk(selectedUserPerk) : null;
              const currentConfig = slotConfigs[slot.type] || {};
              const isLoading = slotLoading[slot.type] || false;
              const slotError = slotErrors[slot.type] || null;

              return (
                <div key={slot.id} className={`slot-row ${locked ? 'locked' : ''} ${isLoading ? 'loading' : ''}`}>
                  <div className="slot-row-header">
                    <span className="slot-row-icon">{slot.icon}</span>
                    <span className="slot-row-label">{t(`perk.slot.${slot.type}`)}</span>
                    {isLoading && <span className="slot-spinner" />}
                    {!isLoading && selectedPerkId && !locked && (
                      <span className="slot-equipped-badge">{t('perk.equipped')}</span>
                    )}
                  </div>

                  {locked ? (
                    <div className="slot-locked-msg">
                      🔒 {t('perk.slotLocked').replace('{level}', String(minLevel || '?'))}
                    </div>
                  ) : (
                    <>
                      <select
                        className="slot-select"
                        value={selectedPerkId || ''}
                        onChange={e => handleSlotPerkChange(slot.type, e.target.value)}
                        disabled={isLoading}
                      >
                        <option value="">{selectedPerkId ? t('perk.clearSlot') : t('perk.choosePerk')}</option>
                        {available.map(up => (
                          <option key={up.perk!.id} value={up.perk!.id}>
                            {up.perk!.title}
                          </option>
                        ))}
                      </select>

                      {/* Inline config options */}
                      {configInfo && configInfo.options.length > 0 && selectedPerkId && (
                        <div className="slot-config">
                          <div className="slot-config-label">{configInfo.title}</div>
                          <div className="slot-config-options">
                            {configInfo.options.map(opt => (
                              <button
                                type="button"
                                key={opt.id}
                                className={`slot-config-btn ${currentConfig[configInfo.configKey] === opt.id ? 'selected' : ''}`}
                                onClick={() => handleConfigSelect(slot.type, configInfo.configKey, opt.id)}
                                disabled={isLoading}
                              >
                                {opt.emoji && <span className="cfg-emoji">{opt.emoji}</span>}
                                <span className="cfg-label">{opt.label}</span>
                                {opt.description && <span className="cfg-desc">{opt.description}</span>}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {slotError && <div className="slot-error">{slotError}</div>}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT: Loadout summary sidebar */}
        <aside className="perks-overview" aria-label="Loadout overview">
          <div className="overview-card">
            <h3>{t('perk.currentLoadout')}</h3>
            <div className="loadout-summary">
              {PERK_SLOTS.map(slot => {
                const name = getSlotEquippedName(slot.type);
                return (
                  <div key={slot.id} className={`summary-row ${name ? 'active' : 'empty'}`}>
                    <span className="summary-icon">{slot.icon}</span>
                    <span className="summary-label">{t(`perk.slot.${slot.type}`)}</span>
                    <span className="summary-value">{name || '—'}</span>
                  </div>
                );
              })}
            </div>
            <div className="summary-footer">
              {t('perk.slotsActive').replace('{count}', String(activeSlotCount)).replace('{total}', '9')}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default PerksManager;
```

**Step 2: Typecheck**

Run: `cd /home/patrick/projects/l2p/frontend && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors in PerksManager.tsx

**Step 3: Commit**

```bash
git add l2p/frontend/src/components/PerksManager.tsx
git commit -m "feat(l2p): rewrite loadout manager with inline slot selectors"
```

---

### Task 3: Rewrite PerksManager.css

**Files:**
- Modify: `l2p/frontend/src/components/PerksManager.css` (full rewrite)

**Step 1: Replace PerksManager.css**

Keep: `.perks-manager`, `.perks-manager.loading`, `.perks-manager.error`, `.loading-spinner`, `@keyframes spin`, `.perks-header`, `.perks-layout`, `.perks-main`, `.perks-overview`, `.overview-card`.

Remove: All filter tab styles, perk card styles, perk details modal styles, badge selector styles, column layout styles, config option grid styles (will be replaced).

Add new styles for:

```css
/* Slot Selectors */
.slot-selectors {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.slot-row {
  background: var(--color-surface, #f8fafc);
  border: 2px solid var(--color-border, #e2e8f0);
  border-radius: 12px;
  padding: 16px;
  transition: all 0.2s ease;
}

.slot-row:hover:not(.locked) {
  border-color: var(--color-primary-light, #93c5fd);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.06);
}

.slot-row.locked {
  opacity: 0.6;
}

.slot-row.loading {
  opacity: 0.7;
  pointer-events: none;
}

.slot-row-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.slot-row-icon {
  font-size: 1.5rem;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-background, white);
  border-radius: 8px;
  flex-shrink: 0;
}

.slot-row-label {
  font-weight: 700;
  font-size: 1rem;
  color: var(--color-text-primary, #1e293b);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.slot-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid #e2e8f0;
  border-top: 2px solid var(--color-primary, #3b82f6);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-left: auto;
}

.slot-equipped-badge {
  margin-left: auto;
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  background: var(--color-success, #10b981);
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
}

.slot-locked-msg {
  color: var(--color-text-secondary, #64748b);
  font-size: 0.9rem;
  padding: 4px 0;
}

.slot-select {
  width: 100%;
  padding: 10px 14px;
  border: 2px solid var(--color-border, #e2e8f0);
  border-radius: 8px;
  background: var(--color-background, white);
  color: var(--color-text-primary, #1e293b);
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: border-color 0.2s;
  appearance: auto;
}

.slot-select:hover {
  border-color: var(--color-primary-light, #93c5fd);
}

.slot-select:focus {
  outline: none;
  border-color: var(--color-primary, #3b82f6);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
}

.slot-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Inline config options */
.slot-config {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border, #e2e8f0);
}

.slot-config-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-secondary, #64748b);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.slot-config-options {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.slot-config-btn {
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
}

.slot-config-btn:hover {
  border-color: var(--color-primary, #3b82f6);
  background: var(--color-primary-bg, #eff6ff);
}

.slot-config-btn.selected {
  border-color: var(--color-primary, #3b82f6);
  background: var(--color-primary-bg, #eff6ff);
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
}

.slot-config-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cfg-emoji {
  font-size: 1.3rem;
}

.cfg-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-primary, #1e293b);
}

.cfg-desc {
  font-size: 0.65rem;
  color: var(--color-text-secondary, #64748b);
  line-height: 1.2;
}

.slot-error {
  margin-top: 8px;
  padding: 6px 10px;
  background: var(--color-error-bg, #fef2f2);
  color: var(--color-error, #ef4444);
  border-radius: 6px;
  font-size: 0.8rem;
}

/* Loadout summary sidebar */
.loadout-summary {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.summary-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--color-background, white);
  border: 1px solid var(--color-border, #e2e8f0);
}

.summary-row.active {
  border-left: 3px solid var(--color-primary, #3b82f6);
}

.summary-row.empty {
  opacity: 0.5;
}

.summary-icon {
  font-size: 1rem;
  flex-shrink: 0;
}

.summary-label {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-secondary, #64748b);
  text-transform: uppercase;
  min-width: 60px;
}

.summary-value {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-primary, #1e293b);
  margin-left: auto;
  text-transform: capitalize;
}

.summary-footer {
  text-align: center;
  margin-top: 12px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-secondary, #64748b);
  padding: 8px;
  background: var(--color-surface, #f1f5f9);
  border-radius: 8px;
}

/* Responsive */
@media (max-width: 1200px) {
  .perks-layout {
    grid-template-columns: 1fr;
  }
  .perks-overview {
    position: static;
  }
}

@media (max-width: 768px) {
  .perks-manager {
    padding: 15px;
  }
  .slot-config-options {
    flex-direction: column;
  }
  .slot-config-btn {
    flex-direction: row;
    min-width: unset;
    gap: 8px;
  }
}
```

**Step 2: Verify build**

Run: `cd /home/patrick/projects/l2p/frontend && npx vite build 2>&1 | tail -5`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add l2p/frontend/src/components/PerksManager.css
git commit -m "feat(l2p): restyle loadout manager for inline slot selectors"
```

---

### Task 4: Update PerksManager tests

**Files:**
- Modify: `l2p/frontend/src/components/__tests__/PerksManager.test.tsx`

**Step 1: Update tests to match new UI structure**

The existing tests check for filter tabs (`role="tab"`), perk card titles in a grid, and "Current Loadout" text. Update to match the new slot-selector layout:

```tsx
import React from 'react'
import { render, screen, within } from '@testing-library/react'
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

jest.mock('../../stores/authStore')
const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>

describe('PerksManager', () => {
  const mockUser = {
    id: '1',
    username: 'testuser',
    email: 'test@example.com',
    level: 12,
    experience: 2400,
  }

  const mockPerksPayload = {
    perks: [
      {
        id: 1, user_id: 1, perk_id: 1, is_unlocked: true, is_active: false, configuration: {},
        perk: { id: 1, name: 'starter_badge', category: 'cosmetic', type: 'badge', level_required: 1, title: 'Starter Badge', description: 'Celebrate the beginning', is_active: true }
      },
      {
        id: 2, user_id: 1, perk_id: 2, is_unlocked: true, is_active: true, configuration: { theme_name: 'dark' },
        perk: { id: 2, name: 'ui_themes_basic', category: 'cosmetic', type: 'theme', level_required: 3, title: 'Basic Themes', description: 'Switch themes', is_active: true }
      },
      {
        id: 3, user_id: 1, perk_id: 3, is_unlocked: false, is_active: false, configuration: {},
        perk: { id: 3, name: 'custom_avatars', category: 'cosmetic', type: 'avatar', level_required: 20, title: 'Custom Avatars', description: 'New avatars', is_active: true }
      },
    ],
    activePerks: [
      { id: 2, user_id: 1, perk_id: 2, is_unlocked: true, is_active: true, configuration: { theme_name: 'dark' },
        perk: { id: 2, name: 'ui_themes_basic', category: 'cosmetic', type: 'theme', level_required: 3, title: 'Basic Themes', description: 'Switch themes', is_active: true } }
    ],
    loadout: {
      user_id: 1, active_avatar: 'student', active_badge: null, active_theme: 'dark',
      active_title: null, perks_config: {}, active_perks: [], active_cosmetic_perks: {}
    }
  }

  beforeEach(() => {
    jest.clearAllMocks()
    const mockStoreState = {
      user: mockUser, token: 'test-token', isAuthenticated: true,
      login: jest.fn(), logout: jest.fn(), register: jest.fn(), refreshToken: jest.fn(),
      setUser: jest.fn(), setToken: jest.fn(), clearAuth: jest.fn(), setLoading: jest.fn(), setError: jest.fn()
    }
    mockUseAuthStore.mockImplementation((selector: any) => {
      if (typeof selector === 'function') return selector(mockStoreState)
      return mockStoreState
    })
    ;(apiService.getUserPerks as jest.Mock).mockResolvedValue({ success: true, data: mockPerksPayload })
  })

  it('shows loading indicator before data resolves', () => {
    render(<PerksManager />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
  })

  it('renders slot selectors when data loads', async () => {
    render(<PerksManager />)
    // Wait for data
    expect(await screen.findByText('Your Loadout')).toBeInTheDocument()
    expect(apiService.getUserPerks).toHaveBeenCalledTimes(1)
    // All 9 slot labels should appear
    expect(screen.getByText('Avatar')).toBeInTheDocument()
    expect(screen.getByText('Theme')).toBeInTheDocument()
    expect(screen.getByText('Badge')).toBeInTheDocument()
    // Sidebar shows all slots
    expect(screen.getByText('Current Loadout')).toBeInTheDocument()
  })

  it('shows locked state for slots above user level', async () => {
    render(<PerksManager />)
    await screen.findByText('Your Loadout')
    // Avatar slot is locked (level 20 required, user is level 12)
    expect(screen.getByText(/Unlock at Level 20/i)).toBeInTheDocument()
  })

  it('shows dropdown with available perks for unlocked slots', async () => {
    render(<PerksManager />)
    await screen.findByText('Your Loadout')
    // Badge slot should have a select with Starter Badge
    const selects = screen.getAllByRole('combobox')
    const badgeSelect = selects.find(s => {
      const options = within(s).queryAllByRole('option')
      return options.some(o => o.textContent === 'Starter Badge')
    })
    expect(badgeSelect).toBeTruthy()
  })

  it('handles API errors gracefully', async () => {
    ;(apiService.getUserPerks as jest.Mock).mockResolvedValueOnce({ success: false, error: 'Failed to fetch perks' })
    render(<PerksManager />)
    expect(await screen.findByText('Unable to Load Perks')).toBeInTheDocument()
    expect(screen.getByText('Retry Now')).toBeInTheDocument()
  })

  it('renders nothing when user is not authenticated', () => {
    const noAuth = {
      user: null, token: null, isAuthenticated: false, isLoading: false, error: null,
      login: jest.fn(), logout: jest.fn(), register: jest.fn(),
      setUser: jest.fn(), setToken: jest.fn(), clearAuth: jest.fn(), setLoading: jest.fn(), setError: jest.fn()
    }
    mockUseAuthStore.mockImplementation((selector: any) => {
      if (typeof selector === 'function') return selector(noAuth)
      return noAuth
    })
    const { container } = render(<PerksManager />)
    expect(apiService.getUserPerks).not.toHaveBeenCalled()
    expect(container.firstChild?.textContent).toBe('')
  })
})
```

**Step 2: Run tests**

Run: `cd /home/patrick/projects/l2p/frontend && NODE_ENV=test npx jest src/components/__tests__/PerksManager.test.tsx --verbose 2>&1 | tail -20`
Expected: All tests pass

**Step 3: Commit**

```bash
git add l2p/frontend/src/components/__tests__/PerksManager.test.tsx
git commit -m "test(l2p): update PerksManager tests for inline slot selectors"
```

---

### Task 5: Remove PixelBadges.css import if unused

**Files:**
- Check: `l2p/frontend/src/components/PerksManager.tsx` line 8

**Step 1: Check if PixelBadges.css is imported elsewhere**

Run: `grep -r "PixelBadges" l2p/frontend/src/ --include="*.tsx" --include="*.ts"`

If only imported in PerksManager.tsx and no longer used (the old badge card rendering used badge CSS classes), remove the import line. If used elsewhere, keep it.

**Step 2: Commit if changed**

```bash
git add l2p/frontend/src/components/PerksManager.tsx
git commit -m "chore(l2p): remove unused PixelBadges.css import"
```

---

### Task 6: Manual verification

**Step 1: Start dev server**

Run: `cd /home/patrick/projects/l2p && npm run dev:frontend`

**Step 2: Verify in browser**

Open http://localhost:3000, log in, go to Profile, open the Perks Manager. Verify:
- All 9 slots are visible as rows
- Unlocked slots have working dropdowns
- Locked slots show level requirements
- Selecting a perk shows inline config options
- Selecting a config option auto-equips the perk
- Sidebar updates to show equipped perks
- "Clear slot" option works to deactivate

**Step 3: Final commit (squash if needed)**

```bash
git add -A
git commit -m "feat(l2p): complete loadout manager refinement with inline slot selectors"
```
