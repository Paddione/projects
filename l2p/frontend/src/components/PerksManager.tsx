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
  { id: 'sound', label: 'Audio', icon: '🔊', type: 'sound' },
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

const AVATAR_OPTIONS = [
  { id: 'student', label: 'Scholarly Student', emoji: '👨‍🎓' },
  { id: 'professor', label: 'Wise Professor', emoji: '👩‍🏫' },
  { id: 'librarian', label: 'Master Librarian', emoji: '📚' },
  { id: 'researcher', label: 'Lab Researcher', emoji: '🧪' },
];

const THEME_OPTIONS = [
  { id: 'default', label: 'Default', previewClass: 'theme-default' },
  { id: 'dark', label: 'Dark Mode', previewClass: 'theme-dark' },
  { id: 'blue', label: 'Ocean Blue', previewClass: 'theme-blue' },
  { id: 'green', label: 'Emerald', previewClass: 'theme-green' },
  { id: 'purple', label: 'Neon Violet', previewClass: 'theme-purple' },
];

const BADGE_STYLE_OPTIONS = [
  { id: 'classic', label: 'Bronze Classic', className: 'badge-bronze-classic' },
  { id: 'modern', label: 'Bronze Modern', className: 'badge-bronze-modern' },
  { id: 'minimal', label: 'Bronze Minimal', className: 'badge-bronze-minimal' },
  { id: 'silver', label: 'Scholar Silver', className: 'badge-scholar-silver' },
  { id: 'gold', label: 'Scholar Gold', className: 'badge-scholar-gold' },
  { id: 'platinum', label: 'Scholar Platinum', className: 'badge-scholar-platinum' },
];

// ===== HELPER OPTIONS =====
const HELPER_OPTIONS: Record<string, Array<{ id: string; label: string; emoji: string; description: string }>> = {
  answer_previews: [
    { id: 'border', label: 'Border Highlight', emoji: '🔲', description: 'Colored border around selected answer' },
    { id: 'background', label: 'Background Fill', emoji: '🎨', description: 'Subtle background color on selection' },
    { id: 'shadow', label: 'Glow Shadow', emoji: '✨', description: 'Glowing shadow effect on selection' },
  ],
  smart_hints: [
    { id: 'subtle', label: 'Subtle', emoji: '💡', description: 'Brief, minimal hints' },
    { id: 'moderate', label: 'Moderate', emoji: '📖', description: 'Balanced hint detail' },
    { id: 'detailed', label: 'Detailed', emoji: '📚', description: 'Full explanations and context' },
  ],
};

// ===== DISPLAY OPTIONS =====
const DISPLAY_OPTIONS: Record<string, Array<{ id: string; label: string; emoji: string; description: string }>> = {
  quick_stats: [
    { id: 'top-left', label: 'Top Left', emoji: '↖️', description: 'Stats in top-left corner' },
    { id: 'top-right', label: 'Top Right', emoji: '↗️', description: 'Stats in top-right corner' },
    { id: 'bottom-left', label: 'Bottom Left', emoji: '↙️', description: 'Stats in bottom-left corner' },
    { id: 'bottom-right', label: 'Bottom Right', emoji: '↘️', description: 'Stats in bottom-right corner' },
  ],
  enhanced_timers: [
    { id: 'progress', label: 'Progress Bar', emoji: '📊', description: 'Animated bar countdown' },
    { id: 'digital', label: 'Digital Clock', emoji: '🔢', description: 'Numeric countdown display' },
    { id: 'analog', label: 'Analog Dial', emoji: '🕐', description: 'Circular dial countdown' },
  ],
  focus_mode: [
    { id: 'blur', label: 'Blur Background', emoji: '🌫️', description: 'Soft background blur during questions' },
    { id: 'zen', label: 'Zen Mode', emoji: '🧘', description: 'Minimal UI, maximum focus' },
    { id: 'both', label: 'Full Focus', emoji: '🎯', description: 'Blur + Zen combined' },
  ],
};

// ===== EMOTE OPTIONS =====
const EMOTE_OPTIONS: Record<string, Array<{ id: string; label: string; emoji: string; description: string }>> = {
  chat_emotes_basic: [
    { id: 'classic', label: 'Classic', emoji: '😀', description: 'Standard fun emotes' },
    { id: 'academic', label: 'Academic', emoji: '🤓', description: 'Study and learning themed' },
    { id: 'gaming', label: 'Gaming', emoji: '🔥', description: 'Competitive gaming reactions' },
  ],
  chat_emotes_premium: [
    { id: 'small', label: 'Small', emoji: '🚀', description: 'Compact animated emotes' },
    { id: 'medium', label: 'Medium', emoji: '💫', description: 'Standard animated emotes' },
    { id: 'large', label: 'Large', emoji: '🌟', description: 'Full-size animated emotes' },
  ],
};

// ===== SOUND OPTIONS =====
const SOUND_OPTIONS: Record<string, Array<{ id: string; label: string; emoji: string; description: string }>> = {
  sound_packs_basic: [
    { id: 'retro', label: 'Retro 8-bit', emoji: '🕹️', description: 'Classic arcade sounds' },
    { id: 'nature', label: 'Nature', emoji: '🌿', description: 'Organic, soothing tones' },
    { id: 'electronic', label: 'Electronic', emoji: '🎹', description: 'Modern synth sounds' },
  ],
  sound_packs_premium: [
    { id: 'orchestral', label: 'Orchestral', emoji: '🎻', description: 'Classical orchestra themes' },
    { id: 'synthwave', label: 'Synthwave', emoji: '🌆', description: 'Retro-future vibes' },
    { id: 'ambient', label: 'Ambient', emoji: '🎧', description: 'Calm, zen soundscapes' },
  ],
  audio_reactions: [
    { id: 'subtle', label: 'Subtle', emoji: '🔈', description: 'Soft feedback sounds' },
    { id: 'moderate', label: 'Moderate', emoji: '🔉', description: 'Balanced audio feedback' },
    { id: 'enthusiastic', label: 'Enthusiastic', emoji: '🔊', description: 'Energetic reactions and fanfares' },
  ],
};

// ===== MULTIPLIER OPTIONS =====
const MULTIPLIER_OPTIONS: Record<string, Array<{ id: string; label: string; emoji: string; description: string }>> = {
  experience_boost: [
    { id: 'game', label: 'Per Game', emoji: '🎮', description: 'Boost lasts one game' },
    { id: 'session', label: 'Per Session', emoji: '⏱️', description: 'Boost lasts entire session' },
    { id: 'unlimited', label: 'Always On', emoji: '♾️', description: 'Permanent XP boost' },
  ],
  streak_protector: [
    { id: 'automatic', label: 'Automatic', emoji: '🛡️', description: 'Activates on first wrong answer' },
    { id: 'manual', label: 'Manual', emoji: '🎯', description: 'Save it for when you need it' },
  ],
  time_extension: [
    { id: '5', label: '+5 Seconds', emoji: '⏱️', description: 'Small but helpful boost' },
    { id: '10', label: '+10 Seconds', emoji: '⏰', description: 'Balanced extra time' },
    { id: '15', label: '+15 Seconds', emoji: '🕐', description: 'Maximum thinking time' },
  ],
};

// ===== TITLE OPTIONS =====
const TITLE_OPTIONS: Record<string, Array<{ id: string; label: string; emoji: string; description: string }>> = {
  master_scholar: [
    { id: 'badge', label: 'Badge Display', emoji: '🏅', description: 'Title shown as a badge icon' },
    { id: 'border', label: 'Name Border', emoji: '📛', description: 'Decorative border around your name' },
    { id: 'glow', label: 'Golden Glow', emoji: '✨', description: 'Glowing aura around your name' },
  ],
  quiz_legend: [
    { id: 'true', label: 'Aura On', emoji: '🌟', description: 'Legendary aura effect visible' },
    { id: 'false', label: 'Aura Off', emoji: '👤', description: 'Title without aura effect' },
  ],
  knowledge_keeper: [
    { id: 'true', label: 'VIP Lobby', emoji: '👑', description: 'Access exclusive VIP lobbies' },
    { id: 'false', label: 'Standard', emoji: '🎓', description: 'Title without VIP access' },
  ],
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
        const configResult = getOptionsForPerk(activePerk.perk.type, activePerk.perk.name);
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

  /** Build activation payload from slotConfigs */
  const getConfigPayload =(perkType: string, perkName: string, config: Record<string, string>) => {
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

  const activateSlotPerk = async (slotType: string, perkId: number, perkName: string, config: Record<string, string>) => {
    setSlotLoading(prev => ({ ...prev, [slotType]: true }));
    setSlotErrors(prev => ({ ...prev, [slotType]: null }));
    try {
      const payload = getConfigPayload(slotType, perkName, config);
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
