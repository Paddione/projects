import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useLocalization } from '../hooks/useLocalization';
import { themeService } from '../services/themeService';
import { avatarService } from '../services/avatarService';
import { apiService } from '../services/apiService';
import './PerksManager.css';
import './PixelBadges.css';

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

type PerkFilter = 'all' | 'unlocked' | 'active' | 'cosmetic' | 'locked' | 'avatar' | 'theme' | 'badge' | 'helper' | 'display' | 'emote' | 'sound' | 'multiplier' | 'title';

interface PerkSlot {
  id: PerkFilter;
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

const FILTER_TABS: Array<{ key: PerkFilter; label: string }> = [
  { key: 'all', label: 'All Perks' },
  { key: 'unlocked', label: 'Unlocked' },
  { key: 'active', label: 'Active' },
  { key: 'cosmetic', label: 'Cosmetic' },
  { key: 'locked', label: 'Locked' },
];

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
  const token = useAuthStore(state => state.token);
  const { t } = useLocalization();
  const [perksData, setPerksData] = useState<PerksData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBadge, setSelectedBadge] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<PerkFilter>('all');
  const [selectedPerk, setSelectedPerk] = useState<UserPerk | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [configSelection, setConfigSelection] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isFetching, setIsFetching] = useState(false);

  useEffect(() => {
    // Only fetch if user is present (token may be absent in session-cookie auth)
    if (user) {
      fetchUserPerks();
    }
  }, [user]);

  useEffect(() => {
    if (perksData) {
      initializeBadgeSelection();
    }
  }, [perksData]);

  // Don't render if user is not authenticated (must come after all hooks)
  // Note: only check `user` — token may be absent in session-cookie auth
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
      setError(null); // Clear previous errors

      const response = await apiService.getUserPerks();

      if (response.success && response.data) {
        setPerksData(response.data);
        setRetryCount(0); // Reset retry count on success

        // Initialize services with user's perks
        if (response.data.perks) {
          themeService.initialize(response.data.perks);
          // Use `character` from User (selectedCharacter does not exist on type User)
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

  const initializeBadgeSelection = () => {
    if (!perksData) return;

    const activeBadge = perksData.activePerks.find(p => p.perk?.type === 'badge');
    if (activeBadge && activeBadge.perk) {
      const config = activeBadge.configuration || {};
      const style = config.badge_style || config.color || 'classic';
      setSelectedBadge(`${activeBadge.perk.id}-${style}`);
    }
  };

  const activatePerk = async (perkId: number, configuration: any = {}) => {
    try {
      const response = await apiService.activatePerk(perkId, configuration);

      if (response.success) {
        await fetchUserPerks(); // Refresh data

        // Apply theme immediately if it's a theme perk
        if (configuration?.theme_name) {
          themeService.setTheme(configuration.theme_name);
        }

        // Apply avatar override if it's an avatar perk
        if (configuration?.selected_avatar) {
          avatarService.setActiveAvatarOverride(configuration.selected_avatar);
        }
      } else {
        setError(response.error || 'Failed to activate perk');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to activate perk');
    }
  };

  const deactivatePerk = async (perkId: number) => {
    try {
      const response = await apiService.deactivatePerk(perkId);

      if (response.success) {
        await fetchUserPerks(); // Refresh data
      } else {
        setError(response.error || 'Failed to deactivate perk');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate perk');
    }
  };

  const canUsePerk = (perk: UserPerk): boolean => {
    if (!user || !perk.perk) return false;
    const userLevel = user.level ?? 0;
    return userLevel >= perk.perk.level_required && perk.is_unlocked;
  };

  const isActivePerk = (perkId: number): boolean => {
    return perksData?.activePerks.some(p => p.perk_id === perkId) || false;
  };

  const getAllPerks = () => {
    if (!perksData) return [];
    return perksData.perks;
  };

  const getUnlockedPerks = () => {
    if (!perksData) return [];
    return perksData.perks.filter(p => p.is_unlocked);
  };

  const getLockedPerks = () => {
    if (!perksData) return [];
    const userLevel = user?.level ?? 0;
    return perksData.perks.filter(p => {
      return !p.is_unlocked && !!p.perk && userLevel < p.perk.level_required;
    });
  };

  const getActivePerksList = () => {
    if (!perksData) return [];
    return perksData.perks.filter(p => p.perk && isActivePerk(p.perk.id));
  };

  const filteredPerks = useMemo(() => {
    if (!perksData) return [];

    // Check if it's a category filter from PERK_SLOTS
    const slotFilter = PERK_SLOTS.find(s => s.id === activeFilter);
    if (slotFilter) {
      return perksData.perks.filter(p => p.perk?.type === slotFilter.type);
    }

    switch (activeFilter) {
      case 'unlocked':
        return getUnlockedPerks();
      case 'active':
        return getActivePerksList();
      case 'cosmetic':
        return perksData.perks.filter(
          p => p.perk && (p.perk.category?.toLowerCase() === 'cosmetic' || p.perk.type === 'badge')
        );
      case 'locked':
        return getLockedPerks();
      case 'all':
      default:
        return getAllPerks();
    }
  }, [perksData, activeFilter]);

  const getFilterCount = (filter: PerkFilter) => {
    // Check if it's a category filter from PERK_SLOTS
    const slotFilter = PERK_SLOTS.find(s => s.id === filter);
    if (slotFilter) {
      return perksData?.perks.filter(p => p.perk?.type === slotFilter.type).length || 0;
    }

    switch (filter) {
      case 'unlocked':
        return getUnlockedPerks().length;
      case 'active':
        return getActivePerksList().length;
      case 'cosmetic':
        return perksData?.perks.filter(
          p => p.perk && (p.perk.category?.toLowerCase() === 'cosmetic' || p.perk.type === 'badge')
        ).length || 0;
      case 'locked':
        return getLockedPerks().length;
      case 'all':
      default:
        return getAllPerks().length;
    }
  };

  const getBadgeOptionsForPerk = (userPerk: UserPerk) => {
    if (!userPerk.perk) return BADGE_STYLE_OPTIONS.slice(0, 3);
    if (userPerk.perk.name === 'scholar_badge') {
      return BADGE_STYLE_OPTIONS.filter(option => ['silver', 'gold', 'platinum'].includes(option.id));
    }
    return BADGE_STYLE_OPTIONS.filter(option => ['classic', 'modern', 'minimal'].includes(option.id));
  };

  const handlePerkCardClick = (userPerk: UserPerk) => {
    if (!userPerk.perk || !userPerk.is_unlocked || !canUsePerk(userPerk)) return;
    const config = userPerk.configuration || {};
    if (userPerk.perk.type === 'avatar') {
      setConfigSelection({
        avatar: config.selected_avatar || perksData?.loadout?.active_avatar || AVATAR_OPTIONS[0]?.id || 'student',
      });
    } else if (userPerk.perk.type === 'theme') {
      setConfigSelection({
        theme: config.theme_name || perksData?.loadout?.active_theme || THEME_OPTIONS[0]?.id || 'default',
      });
    } else if (userPerk.perk.type === 'badge') {
      setConfigSelection({
        badgeStyle: config.badge_style || config.color || 'classic',
      });
    } else if (userPerk.perk.type === 'helper') {
      const perkName = userPerk.perk.name;
      if (perkName === 'answer_previews') {
        setConfigSelection({ highlight_style: config.highlight_style || 'border' });
      } else if (perkName === 'smart_hints') {
        setConfigSelection({ hint_level: config.hint_level || 'moderate' });
      } else {
        setConfigSelection({});
      }
    } else if (userPerk.perk.type === 'display') {
      const perkName = userPerk.perk.name;
      if (perkName === 'quick_stats') {
        setConfigSelection({ position: config.position || 'top-right' });
      } else if (perkName === 'enhanced_timers') {
        setConfigSelection({ visual_style: config.visual_style || 'progress' });
      } else if (perkName === 'focus_mode') {
        const mode = config.zen_mode && config.blur_background ? 'both' : config.zen_mode ? 'zen' : 'blur';
        setConfigSelection({ focus_mode: mode });
      } else {
        setConfigSelection({});
      }
    } else if (userPerk.perk.type === 'emote') {
      const perkName = userPerk.perk.name;
      if (perkName === 'chat_emotes_basic') {
        setConfigSelection({ emote_set: config.emote_set || 'classic' });
      } else if (perkName === 'chat_emotes_premium') {
        setConfigSelection({ size: config.size || 'medium' });
      } else {
        setConfigSelection({});
      }
    } else if (userPerk.perk.type === 'sound') {
      const perkName = userPerk.perk.name;
      if (perkName === 'audio_reactions') {
        setConfigSelection({ reaction_level: config.reaction_level || 'moderate' });
      } else {
        setConfigSelection({ pack: config.pack || 'retro' });
      }
    } else if (userPerk.perk.type === 'multiplier') {
      const perkName = userPerk.perk.name;
      if (perkName === 'experience_boost') {
        setConfigSelection({ duration: config.duration || 'unlimited' });
      } else if (perkName === 'streak_protector') {
        setConfigSelection({ activation: config.activation || 'automatic' });
      } else if (perkName === 'time_extension') {
        setConfigSelection({ extra_seconds: String(config.extra_seconds || 10) });
      } else {
        setConfigSelection({});
      }
    } else if (userPerk.perk.type === 'title') {
      const perkName = userPerk.perk.name;
      if (perkName === 'master_scholar') {
        setConfigSelection({ display_style: config.display_style || 'glow' });
      } else if (perkName === 'quiz_legend') {
        setConfigSelection({ aura_effect: String(config.aura_effect ?? true) });
      } else if (perkName === 'knowledge_keeper') {
        setConfigSelection({ exclusive_lobby: String(config.exclusive_lobby ?? true) });
      } else {
        setConfigSelection({});
      }
    } else {
      setConfigSelection({});
    }
    setSelectedPerk(userPerk);
    setIsDetailsOpen(true);
  };

  const closeDetails = () => {
    setIsDetailsOpen(false);
    setSelectedPerk(null);
    setConfigSelection({});
    setActionLoading(false);
  };

  const getConfigPayload = (perkType: string, perkName?: string) => {
    switch (perkType) {
      case 'avatar':
        return { selected_avatar: configSelection['avatar'] || AVATAR_OPTIONS[0]?.id || 'student' };
      case 'theme':
        return { theme_name: configSelection['theme'] || THEME_OPTIONS[0]?.id || 'default' };
      case 'badge':
        return { badge_style: configSelection['badgeStyle'] || 'classic' };
      case 'helper':
        if (perkName === 'answer_previews') return { highlight_style: configSelection['highlight_style'] || 'border' };
        if (perkName === 'smart_hints') return { hint_level: configSelection['hint_level'] || 'moderate' };
        return {};
      case 'display':
        if (perkName === 'quick_stats') return { position: configSelection['position'] || 'top-right' };
        if (perkName === 'enhanced_timers') return { visual_style: configSelection['visual_style'] || 'progress' };
        if (perkName === 'focus_mode') {
          const mode = configSelection['focus_mode'] || 'blur';
          return {
            blur_background: mode === 'blur' || mode === 'both',
            zen_mode: mode === 'zen' || mode === 'both',
          };
        }
        return {};
      case 'emote':
        if (perkName === 'chat_emotes_basic') return { emote_set: configSelection['emote_set'] || 'classic' };
        if (perkName === 'chat_emotes_premium') return { animated: true, size: configSelection['size'] || 'medium' };
        return {};
      case 'sound':
        if (perkName === 'audio_reactions') return { reaction_level: configSelection['reaction_level'] || 'moderate' };
        return { pack: configSelection['pack'] || 'retro' };
      case 'multiplier':
        if (perkName === 'experience_boost') return { duration: configSelection['duration'] || 'unlimited' };
        if (perkName === 'streak_protector') return { activation: configSelection['activation'] || 'automatic' };
        if (perkName === 'time_extension') return { extra_seconds: Number(configSelection['extra_seconds'] || 10) };
        return {};
      case 'title':
        if (perkName === 'master_scholar') return { display_style: configSelection['display_style'] || 'glow' };
        if (perkName === 'quiz_legend') return { aura_effect: configSelection['aura_effect'] === 'true' };
        if (perkName === 'knowledge_keeper') return { exclusive_lobby: configSelection['exclusive_lobby'] === 'true' };
        return {};
      default:
        return {};
    }
  };

  const handleActivateSelectedPerk = async () => {
    if (!selectedPerk?.perk) return;
    setActionLoading(true);
    try {
      await activatePerk(selectedPerk.perk.id, getConfigPayload(selectedPerk.perk.type, selectedPerk.perk.name));
      closeDetails();
    } catch (err) {
      console.error('Failed to activate perk:', err);
      setActionLoading(false);
    }
  };

  const handleDeactivateSelectedPerk = async () => {
    if (!selectedPerk?.perk) return;
    setActionLoading(true);
    try {
      await deactivatePerk(selectedPerk.perk.id);
      closeDetails();
    } catch (err) {
      console.error('Failed to deactivate perk:', err);
      setActionLoading(false);
    }
  };

  const renderOptionGrid = (
    options: Array<{ id: string; label: string; emoji: string; description: string }>,
    configKey: string,
    title: string,
  ) => (
    <div className="perk-config">
      <h4>{title}</h4>
      <div className="config-option-grid">
        {options.map(option => (
          <button
            type="button"
            key={option.id}
            className={`config-option ${configSelection[configKey] === option.id ? 'selected' : ''}`}
            onClick={() => setConfigSelection(prev => ({ ...prev, [configKey]: option.id }))}
          >
            <span className="config-option-emoji">{option.emoji}</span>
            <span className="config-option-label">{option.label}</span>
            <span className="config-option-desc">{option.description}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const renderPerkConfiguration = (userPerk: UserPerk) => {
    if (!userPerk.perk) return null;
    const perkName = userPerk.perk.name;

    switch (userPerk.perk.type) {
      case 'avatar':
        return (
          <div className="perk-config">
            <h4>{t('perk.selectAvatar')}</h4>
            <div className="avatar-grid">
              {AVATAR_OPTIONS.map(option => (
                <button
                  type="button"
                  key={option.id}
                  className={`avatar-option ${configSelection['avatar'] === option.id ? 'selected' : ''}`}
                  onClick={() => setConfigSelection(prev => ({ ...prev, avatar: option.id }))}
                >
                  <span className="avatar-emoji">{option.emoji}</span>
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        );
      case 'theme':
        return (
          <div className="perk-config">
            <h4>{t('perk.selectTheme')}</h4>
            <div className="theme-grid">
              {THEME_OPTIONS.map(option => (
                <button
                  type="button"
                  key={option.id}
                  className={`theme-option ${configSelection['theme'] === option.id ? 'selected' : ''}`}
                  onClick={() => setConfigSelection(prev => ({ ...prev, theme: option.id }))}
                >
                  <div className={`theme-swatch ${option.previewClass}`} />
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        );
      case 'badge':
        return (
          <div className="perk-config">
            <h4>{t('perk.selectBadgeColor')}</h4>
            <div className="badge-colors">
              {getBadgeOptionsForPerk(userPerk).map(option => (
                <button
                  type="button"
                  key={option.id}
                  className={`badge-option ${option.className} ${configSelection['badgeStyle'] === option.id ? 'selected' : ''}`}
                  onClick={() => setConfigSelection(prev => ({ ...prev, badgeStyle: option.id }))}
                >
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </div>
        );
      case 'helper': {
        const options = HELPER_OPTIONS[perkName];
        if (!options) return null;
        const configKey = perkName === 'answer_previews' ? 'highlight_style' : 'hint_level';
        const title = perkName === 'answer_previews' ? t('perk.selectHighlightStyle') : t('perk.selectHintDetail');
        return renderOptionGrid(options, configKey, title);
      }
      case 'display': {
        const options = DISPLAY_OPTIONS[perkName];
        if (!options) return null;
        const configKey = perkName === 'quick_stats' ? 'position'
          : perkName === 'enhanced_timers' ? 'visual_style'
          : 'focus_mode';
        const title = perkName === 'quick_stats' ? t('perk.selectDashboardPosition')
          : perkName === 'enhanced_timers' ? t('perk.selectTimerStyle')
          : t('perk.selectFocusMode');
        return renderOptionGrid(options, configKey, title);
      }
      case 'emote': {
        const options = EMOTE_OPTIONS[perkName];
        if (!options) return null;
        const configKey = perkName === 'chat_emotes_basic' ? 'emote_set' : 'size';
        const title = perkName === 'chat_emotes_basic' ? t('perk.selectEmoteSet') : t('perk.selectEmoteSize');
        return renderOptionGrid(options, configKey, title);
      }
      case 'sound': {
        const options = SOUND_OPTIONS[perkName];
        if (!options) return null;
        const configKey = perkName === 'audio_reactions' ? 'reaction_level' : 'pack';
        const title = perkName === 'audio_reactions' ? t('perk.selectReactionLevel') : t('perk.selectSoundPack');
        return renderOptionGrid(options, configKey, title);
      }
      case 'multiplier': {
        const options = MULTIPLIER_OPTIONS[perkName];
        if (!options) return null;
        const configKey = perkName === 'experience_boost' ? 'duration'
          : perkName === 'streak_protector' ? 'activation'
          : 'extra_seconds';
        const title = perkName === 'experience_boost' ? t('perk.selectBoostDuration')
          : perkName === 'streak_protector' ? t('perk.selectActivationMode')
          : t('perk.selectExtraTime');
        return renderOptionGrid(options, configKey, title);
      }
      case 'title': {
        const options = TITLE_OPTIONS[perkName];
        if (!options) return null;
        const configKey = perkName === 'master_scholar' ? 'display_style'
          : perkName === 'quiz_legend' ? 'aura_effect'
          : 'exclusive_lobby';
        const title = perkName === 'master_scholar' ? t('perk.selectDisplayStyle')
          : perkName === 'quiz_legend' ? t('perk.auraEffect')
          : t('perk.vipLobbyAccess');
        return renderOptionGrid(options, configKey, title);
      }
      default:
        return (
          <div className="perk-info-note">
            <p>{t('perk.noConfigNeeded')}</p>
            <p>{t('perk.activateToEnhance')}</p>
          </div>
        );
    }
  };

  const renderPerkCard = (userPerk: UserPerk) => {
    const perk = userPerk.perk;
    if (!perk) return null;

    const canUse = canUsePerk(userPerk);
    const isActive = isActivePerk(perk.id);
    const userLevel = user?.level ?? 0;
    const isLocked = !userPerk.is_unlocked && userLevel < perk.level_required;
    const isClickable = userPerk.is_unlocked && canUse;

    return (
      <div
        key={perk.id}
        className={`perk-card ${isActive ? 'active' : ''} ${canUse ? 'available' : 'unavailable'} ${isLocked ? 'locked' : ''}`}
        onClick={() => isClickable && handlePerkCardClick(userPerk)}
        role={isClickable ? 'button' : undefined}
        tabIndex={isClickable ? 0 : -1}
        onKeyDown={(event) => {
          if (isClickable && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault();
            handlePerkCardClick(userPerk);
          }
        }}
      >
        <div className="perk-header">
          <h3 className="perk-title">{perk.title}</h3>
          <div className="perk-level">{t('perk.level')} {perk.level_required}</div>
        </div>

        <div className="perk-category">
          <span className="perk-slot-badge">
            {PERK_SLOTS.find(s => s.type === perk.type)?.icon} {PERK_SLOTS.find(s => s.type === perk.type) ? t(`perk.slot.${perk.type}`) : perk.type}
          </span>
          {' '}• {perk.category}
        </div>
        <p className="perk-description">{perk.description}</p>

        <div className="perk-status">
          {isLocked && (
            <span className="status locked">{'🔒 ' + t('perk.status.locked')}</span>
          )}
          {!isLocked && !userPerk.is_unlocked && (
            <span className="status unlockable">{'⚡ ' + t('perk.status.canUnlock')}</span>
          )}
          {userPerk.is_unlocked && !isActive && perk.type !== 'badge' && canUse && (
            <span className="status unlocked">{'✨ ' + t('perk.status.available')}</span>
          )}
          {userPerk.is_unlocked && !isActive && perk.type !== 'badge' && !canUse && (
            <span className="status locked">{'🔒 ' + t('perk.level') + ' ' + perk.level_required + ' Req.'}</span>
          )}
          {userPerk.is_unlocked && !isActive && perk.type === 'badge' && (
            <span className="status unlocked">{'🏆 ' + t('perk.status.available')}</span>
          )}
          {isActive && (
            <span className="status active">{'🎯 ' + t('perk.status.active')}</span>
          )}
        </div>
      </div>
    );
  };

  const handleBadgeSelection = async (value: string) => {
    setSelectedBadge(value);

    if (!value) {
      // Deactivate current badge
      const activeBadge = perksData?.activePerks.find(p => p.perk?.type === 'badge');
      if (activeBadge) {
        await deactivatePerk(activeBadge.perk_id);
        await fetchUserPerks(); // Refresh data
      }
      return;
    }

    const [perkIdStr, style] = value.split('-');
    const perkId = parseInt(perkIdStr || '0');

    try {
      const response = await apiService.activatePerk(perkId, { badge_style: style });
      if (response.success) {
        await fetchUserPerks(); // Refresh data
      }
    } catch (error) {
      console.error('Failed to activate badge:', error);
    }
  };

  const renderSimpleBadgeSelector = () => {
    const unlockedBadges: Array<{ perk: any, options: Array<{ value: string, label: string, cssClass: string }> }> = [];

    // Check for Bronze Badge
    const bronzeBadge = perksData?.perks.find(p => p.perk?.name === 'starter_badge' && p.is_unlocked);
    if (bronzeBadge) {
      unlockedBadges.push({
        perk: bronzeBadge.perk,
        options: [
          { value: 'classic', label: 'Bronze Classic', cssClass: 'badge-bronze-classic' },
          { value: 'modern', label: 'Bronze Modern', cssClass: 'badge-bronze-modern' },
          { value: 'minimal', label: 'Bronze Minimal', cssClass: 'badge-bronze-minimal' }
        ]
      });
    }

    // Check for Scholar Badge
    const scholarBadge = perksData?.perks.find(p => p.perk?.name === 'scholar_badge' && p.is_unlocked);
    if (scholarBadge) {
      unlockedBadges.push({
        perk: scholarBadge.perk,
        options: [
          { value: 'silver', label: 'Scholar Silver', cssClass: 'badge-scholar-silver' },
          { value: 'gold', label: 'Scholar Gold', cssClass: 'badge-scholar-gold' },
          { value: 'platinum', label: 'Scholar Platinum', cssClass: 'badge-scholar-platinum' }
        ]
      });
    }

    if (unlockedBadges.length === 0) {
      return (
        <div className="badge-selector-item">
          <div className="avatar-with-badge">
            <span className="avatar-emoji">{getCurrentAvatarEmoji()}</span>
          </div>
          <span>{t('perk.noBadgesUnlocked')}</span>
        </div>
      );
    }

    // Find current badge info
    const currentBadgeInfo = findCurrentBadgeInfo(unlockedBadges);

    return (
      <div className="badge-selector-item">
        <div className={`avatar-with-badge ${currentBadgeInfo.cssClass}`}>
          <span className="avatar-emoji">{getCurrentAvatarEmoji()}</span>
        </div>
        <select
          value={selectedBadge}
          onChange={(e) => handleBadgeSelection(e.target.value)}
          className="badge-selector"
        >
          <option value="">{t('perk.noBadge')}</option>
          {unlockedBadges.flatMap(badge =>
            badge.options.map(option => (
              <option key={`${badge.perk.id}-${option.value}`} value={`${badge.perk.id}-${option.value}`}>
                {option.label}
              </option>
            ))
          )}
        </select>
      </div>
    );
  };

  const getDefaultConfiguration = (perkType: string) => {
    switch (perkType) {
      case 'avatar':
        return { selected_avatar: 'student' };
      case 'theme':
        return { theme_name: 'default' };
      default:
        return {};
    }
  };

  const findCurrentBadgeInfo = (unlockedBadges: Array<{ perk: any, options: Array<{ value: string, label: string, cssClass: string }> }>) => {
    const activeBadge = perksData?.activePerks.find(p => p.perk?.type === 'badge');
    if (!activeBadge) {
      return { value: '', cssClass: '', label: 'None' };
    }

    for (const badge of unlockedBadges) {
      if (badge.perk.id === activeBadge.perk_id) {
        const config = activeBadge.configuration || {};
        const style = config.badge_style || config.color || 'classic';
        const option = badge.options.find(o => o.value === style);
        return {
          value: `${badge.perk.id}-${style}`,
          cssClass: option?.cssClass || '',
          label: option?.label || 'Unknown'
        };
      }
    }

    return { value: '', cssClass: '', label: 'None' };
  };

  const getCurrentAvatarEmoji = () => {
    const universityAvatars = [
      { id: 'student', emoji: '👨‍🎓' },
      { id: 'professor', emoji: '👨‍🏫' },
      { id: 'librarian', emoji: '👩‍💼' },
      { id: 'researcher', emoji: '👨‍🔬' },
      { id: 'dean', emoji: '👩‍⚖️' },
      { id: 'graduate', emoji: '🎓' },
      { id: 'lab_assistant', emoji: '👨‍🔬' },
      { id: 'teaching_assistant', emoji: '👩‍🏫' }
    ];

    const currentAvatar = universityAvatars.find(a => a.id === perksData?.loadout?.active_avatar);
    return currentAvatar?.emoji || '👨‍🎓';
  };

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

  const formatLabel = (value?: string) => {
    if (!value) return t('perk.notSet');
    return value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
  };

  const loadout = perksData.loadout;
  const activeBadge = perksData.activePerks.find(p => p.perk?.type === 'badge');
  const badgeStyle = activeBadge?.configuration?.badge_style || activeBadge?.configuration?.color || '';
  const loadoutAvatar = formatLabel(loadout?.active_avatar || 'student');
  const loadoutTheme = formatLabel(loadout?.active_theme || 'default');
  const loadoutBadge = activeBadge?.perk ? formatLabel(badgeStyle || activeBadge.perk.title) : t('perk.noneSelected');
  const activePerksList = getActivePerksList();

  return (
    <div className="perks-manager">
      <div className="perks-header">
        <h2>{'🎨 ' + t('perk.header')}</h2>
        <p>{t('perk.headerDesc')}</p>
      </div>

      <div className="perks-layout">
        <div className="perks-main">
          <div className="perk-slots-container">
            <h3>{t('perk.loadoutSlots')}</h3>
            <p className="slots-subtitle">{t('perk.slotsSubtitle')}</p>
            <div className="perk-slots-grid">
              {PERK_SLOTS.map(slot => {
                // Determine active perk for this slot from loadout data
                const loadout = perksData.loadout;
                const cosmeticPerks = loadout?.active_cosmetic_perks || {};
                let slotActiveName: string | null = null;
                let slotActivePerkId: number | null = null;

                // Check dedicated columns for avatar/badge/theme
                if (slot.type === 'avatar' && loadout?.active_avatar && loadout.active_avatar !== 'student') {
                  slotActiveName = loadout.active_avatar;
                } else if (slot.type === 'theme' && loadout?.active_theme && loadout.active_theme !== 'default') {
                  slotActiveName = loadout.active_theme;
                } else if (slot.type === 'badge' && loadout?.active_badge) {
                  slotActiveName = loadout.active_badge;
                } else if (slot.type === 'title' && loadout?.active_title) {
                  slotActiveName = loadout.active_title;
                }

                // Check perks_config for other slot types
                if (!slotActiveName && cosmeticPerks[slot.type]) {
                  slotActivePerkId = cosmeticPerks[slot.type].perk_id;
                  // Find the perk name from the full perks list
                  const matchingPerk = perksData.perks.find(p => p.perk_id === slotActivePerkId);
                  slotActiveName = matchingPerk?.perk?.title || `Perk #${slotActivePerkId}`;
                }

                const hasActive = !!slotActiveName;
                const isSelected = activeFilter === slot.id;
                const slotStatus = isSelected ? t('perk.slotState.picked') : hasActive ? t('perk.slotState.active') : t('perk.slotState.empty');

                return (
                  <div
                    key={slot.id}
                    className={`perk-slot-card ${hasActive ? 'occupied' : 'empty'} ${isSelected ? 'selected' : ''}`}
                    onClick={() => setActiveFilter(slot.id)}
                  >
                    <div className="slot-icon">{slot.icon}</div>
                    <div className="slot-info">
                      <div className="slot-label">{t(`perk.slot.${slot.type}`)}</div>
                      <div className="slot-active-name" title={slotActiveName || 'None'}>
                        {slotActiveName || t('perk.noneSelected')}
                      </div>
                    </div>
                    <div className={`slot-indicator ${hasActive ? '' : 'empty'} ${isSelected ? 'selected' : ''}`}>
                      {slotStatus}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="perks-filters-header">
            <div className="perks-filters" role="tablist" aria-label="Perk filters">
              {FILTER_TABS.map(tab => (
                <button
                  type="button"
                  key={tab.key}
                  className={`filter-tab ${activeFilter === tab.key ? 'active' : ''}`}
                  onClick={() => setActiveFilter(tab.key)}
                  role="tab"
                  aria-selected={activeFilter === tab.key}
                >
                  {t(`perk.filter.${tab.key}`)}
                  <span className="tab-count">({getFilterCount(tab.key)})</span>
                </button>
              ))}
            </div>

            {PERK_SLOTS.find(s => s.id === activeFilter) && (
              <div className="active-slot-filter-indicator">
                {t('perk.filterBySlot')} <strong>{PERK_SLOTS.find(s => s.id === activeFilter) ? t(`perk.slot.${PERK_SLOTS.find(s => s.id === activeFilter)?.type}`) : ''}</strong>
                <button className="clear-filter-btn" onClick={() => setActiveFilter('all')}>{t('perk.viewAll')}</button>
              </div>
            )}
          </div>

          <div className="perks-grid">
            {filteredPerks.length > 0 ? (
              filteredPerks.map(renderPerkCard)
            ) : (
              <div className="no-perks">
                <p>{t('perk.noPerksForFilter')}</p>
                <p>{t('perk.tryDifferentTab')}</p>
              </div>
            )}
          </div>
        </div>

        <aside className="perks-overview" aria-label="Loadout overview">
          <div className="overview-card current-loadout">
            <h3>{t('perk.currentLoadout')}</h3>
            <div className="loadout-display">
              <div className="loadout-item">
                <span>{t('perk.slot.avatar')}:</span>
                <span>{loadoutAvatar}</span>
              </div>
              <div className="loadout-item">
                <span>{t('perk.slot.theme')}:</span>
                <span>{loadoutTheme}</span>
              </div>
              <div className="loadout-item">
                <span>{t('perk.slot.badge')}:</span>
                <span>{loadoutBadge}</span>
              </div>
              <div className="loadout-item">
                <span>{t('perk.status.active')}:</span>
                <span>{activePerksList.length} {t('perk.perks')}</span>
              </div>
            </div>
          </div>

          <div className="overview-card badge-selection-wrapper">
            <div className="badge-selection-section">
              <h3>{'🏆 ' + t('perk.badgeSelection')}</h3>
              <div className="badge-selection-display">
                {renderSimpleBadgeSelector()}
              </div>
            </div>
          </div>

          <div className="overview-card active-perks-overview">
            <h3>{t('perk.activePerksOverview')}</h3>
            {activePerksList.length > 0 ? (
              <ul className="active-perks-list">
                {activePerksList.map(activePerk => {
                  const slotInfo = PERK_SLOTS.find(s => s.type === activePerk.perk?.type);
                  return (
                    <li key={activePerk.perk?.id || activePerk.id} className="active-perk-item">
                      <div className="active-perk-name">
                        {slotInfo && <span className="active-perk-icon">{slotInfo.icon}</span>}
                        {activePerk.perk?.title || 'Unknown Perk'}
                      </div>
                      <div className="active-perk-meta">
                        {slotInfo ? t(`perk.slot.${slotInfo.type}`) : formatLabel(activePerk.perk?.type)} • {t('perk.level')} {activePerk.perk?.level_required ?? '?'}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="empty-overview">{t('perk.emptyOverview')}</p>
            )}
          </div>
        </aside>
      </div>

      {isDetailsOpen && selectedPerk?.perk && (
        <div className="perk-details-overlay" role="dialog" aria-modal="true">
          <div className="perk-details">
            <div className="perk-details-header">
              <h2>{selectedPerk.perk.title}</h2>
              <button type="button" className="close-btn" onClick={closeDetails} aria-label="Close">
                ×
              </button>
            </div>
            <div className="perk-details-content">
              <div className="perk-info">
                <p><strong>{t('perk.typeLabel')}</strong> {selectedPerk.perk.type}</p>
                <p><strong>{t('perk.categoryLabel')}</strong> {selectedPerk.perk.category}</p>
                <p><strong>{t('perk.requiredLevel')}</strong> {selectedPerk.perk.level_required}</p>
                <p><strong>{t('perk.descriptionLabel')}</strong> {selectedPerk.perk.description}</p>
              </div>

              {renderPerkConfiguration(selectedPerk)}

              <div className="perk-actions">
                {isActivePerk(selectedPerk.perk.id) && (
                  <button
                    type="button"
                    className="deactivate-btn"
                    onClick={handleDeactivateSelectedPerk}
                    disabled={actionLoading}
                  >
                    {actionLoading ? t('perk.working') : t('perk.deactivate')}
                  </button>
                )}
                {!isActivePerk(selectedPerk.perk.id) && canUsePerk(selectedPerk) && (
                  <button
                    type="button"
                    className="activate-btn"
                    onClick={handleActivateSelectedPerk}
                    disabled={actionLoading}
                  >
                    {actionLoading ? t('perk.activating') : t('perk.activate')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PerksManager;
