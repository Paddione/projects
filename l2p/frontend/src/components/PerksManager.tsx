import React, { useState, useEffect, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
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
  perks_config: any;
  active_perks: UserPerk[];
}

interface PerksData {
  perks: UserPerk[];
  activePerks: UserPerk[];
  loadout: UserLoadout;
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

const PerksManager: React.FC = () => {
  const user = useAuthStore(state => state.user);
  const token = useAuthStore(state => state.token);
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

  console.log('PerksManager: Rendering with user:', !!user, 'token:', !!token, 'user level:', user?.level);

  useEffect(() => {
    console.log('PerksManager: useEffect triggered, user:', !!user, 'token:', !!token);
    if (token && user) {
      console.log('PerksManager: Calling fetchUserPerks');
      fetchUserPerks();
    }
  }, [token, user]);

  useEffect(() => {
    if (perksData) {
      initializeBadgeSelection();
    }
  }, [perksData]);

  // Don't render if user is not authenticated
  if (!user || !token) {
    console.log('PerksManager: User not authenticated, returning empty div');
    return <div></div>;
  }

  const fetchUserPerks = async () => {
    // Prevent multiple concurrent fetches
    if (isFetching) {
      console.log('PerksManager: Already fetching, skipping...');
      return;
    }

    try {
      console.log('PerksManager: fetchUserPerks starting');
      setIsFetching(true);
      setLoading(true);
      setError(null); // Clear previous errors

      const response = await apiService.getUserPerks();
      console.log('PerksManager: getUserPerks response:', response);

      if (response.success && response.data) {
        console.log('PerksManager: Setting perks data:', response.data);
        setPerksData(response.data);
        setRetryCount(0); // Reset retry count on success

        // Initialize services with user's perks
        if (response.data.perks) {
          themeService.initialize(response.data.perks);
          // Use `character` from User (selectedCharacter does not exist on type User)
          avatarService.initialize(user?.character || 'student', response.data.perks);
        }
      } else {
        console.error('PerksManager: Failed to load perks:', response.error);
        setError(response.error || 'Failed to load perks');
      }
    } catch (err) {
      console.error('PerksManager: Error in fetchUserPerks:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load perks';
      setError(errorMessage);

      // Auto-retry with exponential backoff (max 3 retries)
      if (retryCount < 3) {
        const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 8000);
        console.log(`PerksManager: Retrying in ${backoffDelay}ms (attempt ${retryCount + 1}/3)`);
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
        avatar: config.selected_avatar || perksData?.loadout.active_avatar || AVATAR_OPTIONS[0]?.id || 'student',
      });
    } else if (userPerk.perk.type === 'theme') {
      setConfigSelection({
        theme: config.theme_name || perksData?.loadout.active_theme || THEME_OPTIONS[0]?.id || 'default',
      });
    } else if (userPerk.perk.type === 'badge') {
      setConfigSelection({
        badgeStyle: config.badge_style || config.color || 'classic',
      });
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

  const getConfigPayload = (perkType: string) => {
    switch (perkType) {
      case 'avatar':
        return { selected_avatar: configSelection['avatar'] || AVATAR_OPTIONS[0]?.id || 'student' };
      case 'theme':
        return { theme_name: configSelection['theme'] || THEME_OPTIONS[0]?.id || 'default' };
      case 'badge':
        return { badge_style: configSelection['badgeStyle'] || 'classic' };
      default:
        return {};
    }
  };

  const handleActivateSelectedPerk = async () => {
    if (!selectedPerk?.perk) return;
    setActionLoading(true);
    try {
      await activatePerk(selectedPerk.perk.id, getConfigPayload(selectedPerk.perk.type));
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

  const renderPerkConfiguration = (userPerk: UserPerk) => {
    if (!userPerk.perk) return null;
    switch (userPerk.perk.type) {
      case 'avatar':
        return (
          <div className="perk-config">
            <h4>Select Avatar:</h4>
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
            <h4>Select Theme:</h4>
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
            <h4>Select Badge Color:</h4>
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
      default:
        return (
          <div className="perk-info-note">
            <p>This perk does not require extra configuration.</p>
            <p>Activate it to enhance your current loadout.</p>
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
          <div className="perk-level">Level {perk.level_required}</div>
        </div>

        <div className="perk-category">
          <span className="perk-slot-badge">
            {PERK_SLOTS.find(s => s.type === perk.type)?.icon} {PERK_SLOTS.find(s => s.type === perk.type)?.label}
          </span>
          {' '}• {perk.category}
        </div>
        <p className="perk-description">{perk.description}</p>

        <div className="perk-status">
          {isLocked && (
            <span className="status locked">🔒 Locked</span>
          )}
          {!isLocked && !userPerk.is_unlocked && (
            <span className="status unlockable">⚡ Can Unlock</span>
          )}
          {userPerk.is_unlocked && !isActive && perk.type !== 'badge' && canUse && (
            <span className="status unlocked">✨ Available</span>
          )}
          {userPerk.is_unlocked && !isActive && perk.type !== 'badge' && !canUse && (
            <span className="status locked">🔒 Level {perk.level_required} Req.</span>
          )}
          {userPerk.is_unlocked && !isActive && perk.type === 'badge' && (
            <span className="status unlocked">🏆 Available</span>
          )}
          {isActive && (
            <span className="status active">🎯 Active</span>
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
          <span>No badges unlocked</span>
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
          <option value="">No Badge</option>
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

    const currentAvatar = universityAvatars.find(a => a.id === perksData?.loadout.active_avatar);
    return currentAvatar?.emoji || '👨‍🎓';
  };

  if (loading) {
    return (
      <div className="perks-manager loading">
        <div className="loading-spinner"></div>
        <p>Loading your perks...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="perks-manager error">
        <div className="error-icon">⚠️</div>
        <h3>Unable to Load Perks</h3>
        <p>{error}</p>
        {retryCount > 0 && retryCount < 3 && (
          <p className="retry-info">Retrying automatically... (Attempt {retryCount + 1}/3)</p>
        )}
        {retryCount >= 3 && (
          <p className="retry-info">Automatic retries exhausted. Please try again manually.</p>
        )}
        <button onClick={() => {
          setRetryCount(0);
          setError(null);
          fetchUserPerks();
        }} disabled={isFetching}>
          {isFetching ? 'Retrying...' : 'Retry Now'}
        </button>
      </div>
    );
  }

  if (!perksData) {
    return <div className="perks-manager">No perks data available</div>;
  }

  const formatLabel = (value?: string) => {
    if (!value) return 'Not set';
    return value.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
  };

  const loadout = perksData.loadout;
  const activeBadge = perksData.activePerks.find(p => p.perk?.type === 'badge');
  const badgeStyle = activeBadge?.configuration?.badge_style || activeBadge?.configuration?.color || '';
  const loadoutAvatar = formatLabel(loadout?.active_avatar || 'student');
  const loadoutTheme = formatLabel(loadout?.active_theme || 'default');
  const loadoutBadge = activeBadge?.perk ? formatLabel(badgeStyle || activeBadge.perk.title) : 'No badge selected';
  const activePerksList = getActivePerksList();

  return (
    <div className="perks-manager">
      <div className="perks-header">
        <h2>🎨 Perks & Customization</h2>
        <p>Unlock and customize your gaming experience!</p>
      </div>

      <div className="perks-layout">
        <div className="perks-main">
          <div className="perk-slots-container">
            <h3>Your Loadout Slots</h3>
            <p className="slots-subtitle">Tap a slot to view and change its active perk</p>
            <div className="perk-slots-grid">
              {PERK_SLOTS.map(slot => {
                const activePerk = perksData.activePerks.find(p => p.perk?.type === slot.type);
                const isSelected = activeFilter === slot.id;
                const slotStatus = isSelected ? 'Picked' : activePerk ? 'Active' : 'Empty';

                return (
                  <div
                    key={slot.id}
                    className={`perk-slot-card ${activePerk ? 'occupied' : 'empty'} ${isSelected ? 'selected' : ''}`}
                    onClick={() => setActiveFilter(slot.id)}
                  >
                    <div className="slot-icon">{slot.icon}</div>
                    <div className="slot-info">
                      <div className="slot-label">{slot.label}</div>
                      <div className="slot-active-name" title={activePerk?.perk?.title || 'None'}>
                        {activePerk?.perk?.title || 'None selected'}
                      </div>
                    </div>
                    <div className={`slot-indicator ${activePerk ? '' : 'empty'} ${isSelected ? 'selected' : ''}`}>
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
                  {tab.label}
                  <span className="tab-count">({getFilterCount(tab.key)})</span>
                </button>
              ))}
            </div>

            {PERK_SLOTS.find(s => s.id === activeFilter) && (
              <div className="active-slot-filter-indicator">
                Filtering by Slot: <strong>{PERK_SLOTS.find(s => s.id === activeFilter)?.label}</strong>
                <button className="clear-filter-btn" onClick={() => setActiveFilter('all')}>View All</button>
              </div>
            )}
          </div>

          <div className="perks-grid">
            {filteredPerks.length > 0 ? (
              filteredPerks.map(renderPerkCard)
            ) : (
              <div className="no-perks">
                <p>No perks available for this filter.</p>
                <p>Try selecting a different tab.</p>
              </div>
            )}
          </div>
        </div>

        <aside className="perks-overview" aria-label="Loadout overview">
          <div className="overview-card current-loadout">
            <h3>Current Loadout</h3>
            <div className="loadout-display">
              <div className="loadout-item">
                <span>Avatar:</span>
                <span>{loadoutAvatar}</span>
              </div>
              <div className="loadout-item">
                <span>Theme:</span>
                <span>{loadoutTheme}</span>
              </div>
              <div className="loadout-item">
                <span>Badge:</span>
                <span>{loadoutBadge}</span>
              </div>
              <div className="loadout-item">
                <span>Active:</span>
                <span>{activePerksList.length} perks</span>
              </div>
            </div>
          </div>

          <div className="overview-card badge-selection-wrapper">
            <div className="badge-selection-section">
              <h3>🏆 Badge Selection</h3>
              <div className="badge-selection-display">
                {renderSimpleBadgeSelector()}
              </div>
            </div>
          </div>

          <div className="overview-card active-perks-overview">
            <h3>Active Perks Overview</h3>
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
                        {slotInfo ? slotInfo.label : formatLabel(activePerk.perk?.type)} • Level {activePerk.perk?.level_required ?? '?'}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="empty-overview">Pick a perk from the slots to see it listed here.</p>
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
                <p><strong>Type:</strong> {selectedPerk.perk.type}</p>
                <p><strong>Category:</strong> {selectedPerk.perk.category}</p>
                <p><strong>Required Level:</strong> {selectedPerk.perk.level_required}</p>
                <p><strong>Description:</strong> {selectedPerk.perk.description}</p>
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
                    {actionLoading ? 'Working...' : 'Deactivate'}
                  </button>
                )}
                {!isActivePerk(selectedPerk.perk.id) && canUsePerk(selectedPerk) && (
                  <button
                    type="button"
                    className="activate-btn"
                    onClick={handleActivateSelectedPerk}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Activating...' : 'Activate Perk'}
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
