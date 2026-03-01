import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useLocalization } from '../hooks/useLocalization';
import { themeService } from '../services/themeService';
import { avatarService } from '../services/avatarService';
import { apiService } from '../services/apiService';
import './PerksManager.css';

interface Perk {
  id: number;
  name: string;
  category: string;
  type: string;
  level_required: number;
  title: string;
  description: string;
  is_active: boolean;
  config_schema?: Record<string, any>;
}

interface UserPerk {
  id: number;
  user_id: number;
  perk_id: number;
  is_unlocked: boolean;
  is_active: boolean;
  configuration: any;
  perk?: Perk;
}

interface UserLoadout {
  user_id: number;
  active_avatar: string;
  active_badge?: string;
  active_theme: string;
  active_title?: string;
  perks_config: any;
  active_perks: UserPerk[];
  active_cosmetic_perks: Record<string, { perk_id: number; configuration: any }>;
}

interface PerksData {
  perks: UserPerk[];
  activePerks: UserPerk[];
  loadout: UserLoadout | null;
}

interface PerkSlot {
  id: string;
  label: string;
  icon: string;
  type: string;
}

const PERK_SLOTS: PerkSlot[] = [
  { id: 'avatar', label: 'Avatar', icon: '👤', type: 'avatar' },
  { id: 'theme', label: 'Theme', icon: '🎨', type: 'theme' },
  { id: 'badge', label: 'Badge', icon: '🏆', type: 'badge' },
  { id: 'helper', label: 'Helper', icon: '🛠️', type: 'helper' },
  { id: 'display', label: 'Interface', icon: '📊', type: 'display' },
  { id: 'emote', label: 'Social', icon: '💬', type: 'emote' },
  { id: 'multiplier', label: 'Booster', icon: '⚡', type: 'multiplier' },
  { id: 'title', label: 'Title', icon: '🏷️', type: 'title' },
];

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

// Display labels and emojis for schema-driven option IDs
const OPTION_LABELS: Record<string, { label: string; emoji: string }> = {
  // Avatars
  scientist: { label: 'Scientist', emoji: '🔬' },
  explorer: { label: 'Explorer', emoji: '🧭' },
  artist: { label: 'Artist', emoji: '🎨' },
  detective: { label: 'Detective', emoji: '🔍' },
  chef: { label: 'Chef', emoji: '👨‍🍳' },
  astronaut: { label: 'Astronaut', emoji: '🚀' },
  wizard: { label: 'Wizard', emoji: '🧙' },
  ninja: { label: 'Ninja', emoji: '🥷' },
  dragon: { label: 'Dragon', emoji: '🐉' },
  // Themes
  ocean: { label: 'Ocean Blue', emoji: '🌊' },
  forest: { label: 'Forest', emoji: '🌲' },
  sunset: { label: 'Sunset', emoji: '🌅' },
  neon: { label: 'Neon', emoji: '💡' },
  galaxy: { label: 'Galaxy', emoji: '🌌' },
  vintage: { label: 'Vintage', emoji: '📜' },
  // Badges
  bronze: { label: 'Bronze', emoji: '🥉' },
  silver: { label: 'Silver', emoji: '🥈' },
  gold: { label: 'Gold', emoji: '🥇' },
  classic: { label: 'Classic', emoji: '🏛️' },
  modern: { label: 'Modern', emoji: '✨' },
  glow: { label: 'Glow', emoji: '✨' },
  pulse: { label: 'Pulse', emoji: '💫' },
  sparkle: { label: 'Sparkle', emoji: '⭐' },
  // Helpers
  border: { label: 'Border Highlight', emoji: '🔲' },
  background: { label: 'Background Fill', emoji: '🎨' },
  shadow: { label: 'Glow Shadow', emoji: '✨' },
  subtle: { label: 'Subtle', emoji: '💡' },
  moderate: { label: 'Moderate', emoji: '📖' },
  detailed: { label: 'Detailed', emoji: '📚' },
  // Display
  'top-left': { label: 'Top Left', emoji: '↖️' },
  'top-right': { label: 'Top Right', emoji: '↗️' },
  'bottom-left': { label: 'Bottom Left', emoji: '↙️' },
  'bottom-right': { label: 'Bottom Right', emoji: '↘️' },
  progress: { label: 'Progress Bar', emoji: '📊' },
  digital: { label: 'Digital Clock', emoji: '🔢' },
  analog: { label: 'Analog Dial', emoji: '🕐' },
  // Emotes
  academic: { label: 'Academic', emoji: '🤓' },
  gaming: { label: 'Gaming', emoji: '🔥' },
  small: { label: 'Small', emoji: '🚀' },
  medium: { label: 'Medium', emoji: '💫' },
  large: { label: 'Large', emoji: '🌟' },
  // Multiplier
  game: { label: 'Per Game', emoji: '🎮' },
  session: { label: 'Per Session', emoji: '⏱️' },
  unlimited: { label: 'Always On', emoji: '♾️' },
  automatic: { label: 'Automatic', emoji: '🛡️' },
  manual: { label: 'Manual', emoji: '🎯' },
  // Title
  badge: { label: 'Badge Display', emoji: '🏅' },
};

// Perks with non-standard schemas (boolean/range/composite) that need hardcoded options
const SPECIAL_PERK_OPTIONS: Record<string, { options: Array<{ id: string; label: string; emoji: string; description: string }>; configKey: string }> = {
  focus_mode: {
    options: [
      { id: 'blur', label: 'Blur Background', emoji: '🌫️', description: 'Soft background blur during questions' },
      { id: 'zen', label: 'Zen Mode', emoji: '🧘', description: 'Minimal UI, maximum focus' },
      { id: 'both', label: 'Full Focus', emoji: '🎯', description: 'Blur + Zen combined' },
    ],
    configKey: 'focus_mode',
  },
  quiz_legend: {
    options: [
      { id: 'true', label: 'Aura On', emoji: '🌟', description: 'Legendary aura effect visible' },
      { id: 'false', label: 'Aura Off', emoji: '👤', description: 'Title without aura effect' },
    ],
    configKey: 'aura_effect',
  },
  knowledge_keeper: {
    options: [
      { id: 'true', label: 'VIP Lobby', emoji: '👑', description: 'Access exclusive VIP lobbies' },
      { id: 'false', label: 'Standard', emoji: '🎓', description: 'Title without VIP access' },
    ],
    configKey: 'exclusive_lobby',
  },
  time_extension: {
    options: [
      { id: '5', label: '+5 Seconds', emoji: '⏱️', description: 'Small but helpful boost' },
      { id: '10', label: '+10 Seconds', emoji: '⏰', description: 'Balanced extra time' },
      { id: '15', label: '+15 Seconds', emoji: '🕐', description: 'Maximum thinking time' },
    ],
    configKey: 'extra_seconds',
  },
};

const PerksManager: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const { t } = useLocalization();

  // Data fetching state (kept from original)
  const [perksData, setPerksData] = useState<PerksData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isFetching, setIsFetching] = useState(false);

  // Per-slot interaction state (flat model: one selection per slot)
  const [slotSelection, setSlotSelection] = useState<Record<string, { perkId: number; optionId: string; configKey: string }>>({});
  const [slotLoading, setSlotLoading] = useState<Record<string, boolean>>({});
  const [slotErrors, setSlotErrors] = useState<Record<string, string | null>>({});

  useEffect(() => {
    if (user) fetchUserPerks();
  }, [user]);

  // Initialize slot selections from loadout when data loads
  useEffect(() => {
    if (!perksData) return;
    const selections: Record<string, { perkId: number; optionId: string; configKey: string }> = {};
    for (const slot of PERK_SLOTS) {
      const activePerk = perksData.activePerks.find(p => p.perk?.type === slot.type);
      if (activePerk?.perk) {
        const config = extractConfigForSlot(activePerk);
        const configResult = getOptionsForPerk(activePerk.perk);
        if (configResult) {
          const optionId = config[configResult.configKey] || '';
          selections[slot.type] = { perkId: activePerk.perk.id, optionId, configKey: configResult.configKey };
        }
      }
    }
    setSlotSelection(selections);
  }, [perksData]);

  // Don't render if user is not authenticated (must come after all hooks)
  if (!user) {
    return <div></div>;
  }

  const fetchUserPerks = async () => {
    // Prevent multiple concurrent fetches
    if (isFetching) {
      return;
    }

    try {
      setIsFetching(true);
      setLoading(true);
      setError(null);

      const response = await apiService.getUserPerks();

      if (response.success && response.data) {
        setPerksData(response.data);
        setRetryCount(0);

        // Initialize services with user's perks
        if (response.data.perks) {
          themeService.initialize(response.data.perks);
          avatarService.initialize(user?.character || 'student', response.data.perks);
        }
      } else {
        setError(response.error || 'Failed to load perks');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load perks';
      setError(errorMessage);

      // Auto-retry with exponential backoff (max 3 retries)
      if (retryCount < 3) {
        const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 8000);
        setTimeout(() => {
          setRetryCount(prev => prev + 1);
          fetchUserPerks();
        }, backoffDelay);
      }
    } finally {
      setLoading(false);
      setIsFetching(false);
    }
  };

  // --- Helpers ---

  /** Get the minimum level needed to unlock any perk in this slot */
  const getMinLevelForSlot = (slotType: string): number | null => {
    if (!perksData) return null;
    const slotPerks = perksData.perks.filter(p => p.perk?.type === slotType);
    if (slotPerks.length === 0) return null;
    return Math.min(...slotPerks.map(p => p.perk?.level_required ?? 999));
  };

  /** Extract current config values from an active UserPerk into a flat Record */
  const extractConfigForSlot = (userPerk: UserPerk): Record<string, string> => {
    const config = userPerk.configuration || {};
    const perkName = userPerk.perk?.name || '';

    // Special-case perks with non-standard schemas
    if (perkName === 'focus_mode') {
      const mode = config.zen_mode && config.blur_background ? 'both' : config.zen_mode ? 'zen' : 'blur';
      return { focus_mode: mode };
    }
    if (perkName === 'quiz_legend') return { aura_effect: String(config.aura_effect ?? true) };
    if (perkName === 'knowledge_keeper') return { exclusive_lobby: String(config.exclusive_lobby ?? true) };
    if (perkName === 'time_extension') return { extra_seconds: String(config.extra_seconds ?? 10) };

    // Standard: find the primary enum key from config_schema
    const schema = userPerk.perk?.config_schema;
    if (schema) {
      const enumEntry = Object.entries(schema).find(([, v]) => (v as any).type === 'enum');
      if (enumEntry) {
        const [key, field] = enumEntry;
        return { [key]: config[key] || (field as any).default || '' };
      }
    }

    return {};
  };

  /** Look up config options for a perk — reads from config_schema, falls back to special cases */
  const getOptionsForPerk = (perk: Perk): {
    options: Array<{ id: string; label: string; emoji: string; description: string }>;
    configKey: string;
  } | null => {
    // Check for special-case perks with non-standard schemas (boolean/range/composite)
    const special = SPECIAL_PERK_OPTIONS[perk.name];
    if (special) return special;

    // Schema-driven: find the first enum field and generate options from it
    const schema = perk.config_schema;
    if (schema) {
      const enumEntry = Object.entries(schema).find(([, v]) => (v as any).type === 'enum');
      if (enumEntry) {
        const [configKey, field] = enumEntry;
        const schemaOptions: string[] = (field as any).options || [];
        const options = schemaOptions.map(id => {
          const meta = OPTION_LABELS[id];
          return { id, label: meta?.label || id.charAt(0).toUpperCase() + id.slice(1), emoji: meta?.emoji || '', description: '' };
        });
        return { options, configKey };
      }
    }

    return null;
  };

  /** Build a flat list of all options across all perks for a slot type */
  const getFlatOptionsForSlot = (slotType: string): FlatOption[] => {
    if (!perksData) return [];
    const slotPerks = perksData.perks.filter(p => p.perk?.type === slotType);
    const options: FlatOption[] = [];

    for (const up of slotPerks) {
      if (!up.perk) continue;
      const perkName = up.perk.name;
      const locked = !up.is_unlocked;
      const levelRequired = up.perk.level_required;
      const perkId = up.perk.id;

      const configResult = getOptionsForPerk(up.perk);
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

  /** Build activation payload from config key + option ID */
  const getConfigPayload = (perkName: string, configKey: string, optionId: string) => {
    // Special cases for non-standard schemas
    if (perkName === 'focus_mode') {
      return { blur_background: optionId === 'blur' || optionId === 'both', zen_mode: optionId === 'zen' || optionId === 'both' };
    }
    if (perkName === 'quiz_legend') return { aura_effect: optionId === 'true' };
    if (perkName === 'knowledge_keeper') return { exclusive_lobby: optionId === 'true' };
    if (perkName === 'time_extension') return { extra_seconds: Number(optionId) };
    if (perkName === 'chat_emotes_premium') return { [configKey]: optionId, animated: true };

    // Standard: schema key maps directly to the option value
    return { [configKey]: optionId };
  };

  // --- Slot interaction handlers ---

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

    await activateSlotPerk(slotType, option.perkId, option.perkName, option.configKey, option.optionId);
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

  const activateSlotPerk = async (slotType: string, perkId: number, perkName: string, configKey: string, optionId: string) => {
    setSlotLoading(prev => ({ ...prev, [slotType]: true }));
    setSlotErrors(prev => ({ ...prev, [slotType]: null }));
    try {
      const payload = getConfigPayload(perkName, configKey, optionId);
      const response = await apiService.activatePerk(perkId, payload);
      if (response.success) {
        await fetchUserPerks();
        // Side effects
        if (slotType === 'theme' && (payload as any).theme_name) themeService.setTheme((payload as any).theme_name);
        if (slotType === 'avatar' && (payload as any).selected_avatar) avatarService.setActiveAvatarOverride((payload as any).selected_avatar);
      } else {
        setSlotErrors(prev => ({ ...prev, [slotType]: response.error || 'Failed to equip' }));
      }
    } catch {
      setSlotErrors(prev => ({ ...prev, [slotType]: 'Failed to equip perk' }));
    } finally {
      setSlotLoading(prev => ({ ...prev, [slotType]: false }));
    }
  };

  // --- Get friendly display name for sidebar ---
  const getOptionLabel = (optionId: string): string => {
    const meta = OPTION_LABELS[optionId];
    return meta?.label || optionId.charAt(0).toUpperCase() + optionId.slice(1);
  };

  const getSlotEquippedName = (slotType: string): string | null => {
    // First check if there's a current selection in state (most accurate)
    const sel = slotSelection[slotType];
    if (sel) return getOptionLabel(sel.optionId);

    // Fall back to loadout data
    const loadout = perksData?.loadout;
    if (!loadout) return null;
    if (slotType === 'avatar' && loadout.active_avatar && loadout.active_avatar !== 'student') return getOptionLabel(loadout.active_avatar);
    if (slotType === 'theme' && loadout.active_theme && loadout.active_theme !== 'default') return getOptionLabel(loadout.active_theme);
    if (slotType === 'badge' && loadout.active_badge) return getOptionLabel(loadout.active_badge);
    if (slotType === 'title' && loadout.active_title) return getOptionLabel(loadout.active_title);
    const cosmeticPerks = loadout.active_cosmetic_perks || {};
    if (cosmeticPerks[slotType]) {
      const matchingPerk = perksData?.perks.find(p => p.perk_id === cosmeticPerks[slotType].perk_id);
      return matchingPerk?.perk?.title || null;
    }
    return null;
  };

  const activeSlotCount = PERK_SLOTS.filter(s => getSlotEquippedName(s.type)).length;

  // --- Loading / Error / No Data early returns ---

  if (loading) {
    return (
      <div className="perks-manager loading">
        <div className="loading-spinner"></div>
        <p>{t('perk.loading')}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="perks-manager error">
        <div className="error-icon">⚠️</div>
        <h3>{t('perk.unableToLoad')}</h3>
        <p>{error}</p>
        {retryCount > 0 && retryCount < 3 && (
          <p className="retry-info">{t('perk.retrying')} ({t('perk.attempt')} {retryCount + 1}/3)</p>
        )}
        {retryCount >= 3 && (
          <p className="retry-info">{t('perk.retryExhausted')}</p>
        )}
        <button onClick={() => {
          setRetryCount(0);
          setError(null);
          fetchUserPerks();
        }} disabled={isFetching}>
          {isFetching ? t('perk.retryingNow') : t('perk.retryNow')}
        </button>
      </div>
    );
  }

  if (!perksData) {
    return <div className="perks-manager">{t('perk.noData')}</div>;
  }

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
