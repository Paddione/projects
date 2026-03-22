import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Mock avatarService — return null for SVG path so component falls back to getAvatarEmoji.
// Using plain functions (not vi.fn()) because resetMocks:true in jest config
// clears mock implementations between tests.
vi.mock('../../services/avatarService', () => {
  const emojis: Record<string, string> = {
    student: '👨‍🎓',
    professor: '👨‍🏫',
    librarian: '👩‍💼',
    researcher: '👨‍🔬',
    dean: '👩‍⚖️',
    graduate: '🎓',
    lab_assistant: '👨‍🔬',
    teaching_assistant: '👩‍🏫',
  };
  return {
    avatarService: {
      getAvatarSvgPath: () => null,
      getAvatarEmoji: (character: string) => emojis[character] || '🎓',
      initialize: () => {},
      setActiveAvatarOverride: () => {},
    }
  };
});

import { PerkUnlockNotification } from '../PerkUnlockNotification';
import { PerkUnlockNotification as PerkUnlockNotificationType } from '../../stores/gameStore';

// Mock timers
vi.useFakeTimers();

describe('PerkUnlockNotification', () => {
  const mockOnClose = vi.fn();

  const mockNotification: PerkUnlockNotificationType = {
    playerId: 'test-player',
    username: 'testuser',
    character: 'professor',
    unlockedPerks: [
      {
        id: 1,
        user_id: 1,
        perk_id: 1,
        is_unlocked: true,
        is_active: false,
        configuration: {},
        perk: {
          id: 1,
          name: 'starter_badge',
          category: 'cosmetic',
          type: 'badge',
          level_required: 5,
          title: 'Starter Badge',
          description: 'Your first achievement badge',
          is_active: true,
        }
      },
      {
        id: 2,
        user_id: 1,
        perk_id: 2,
        is_unlocked: true,
        is_active: false,
        configuration: {},
        perk: {
          id: 2,
          name: 'custom_avatar',
          category: 'cosmetic',
          type: 'avatar',
          level_required: 10,
          title: 'Avatar Collection',
          description: 'Unlock new character avatars',
          is_active: true,
        }
      }
    ]
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
  });

  it('should render notification with correct content', () => {
    render(<PerkUnlockNotification notification={mockNotification} onClose={mockOnClose} />);

    expect(screen.getByText('New Perks Unlocked!')).toBeInTheDocument();
    expect(screen.getByText('testuser')).toBeInTheDocument();
    expect(screen.getByText('Starter Badge')).toBeInTheDocument();
    expect(screen.getByText('Avatar Collection')).toBeInTheDocument();
    expect(screen.getByText('Visit the Perks Manager to activate your new perks!')).toBeInTheDocument();
  });

  it('should display correct character emoji for professor', () => {
    render(<PerkUnlockNotification notification={mockNotification} onClose={mockOnClose} />);

    // Professor emoji should be present
    const spans = document.querySelectorAll('span');
    const professorSpan = Array.from(spans).find(span => span.textContent === '👨‍🏫');
    expect(professorSpan).toBeTruthy();
  });

  it('should display correct character emoji for different characters', () => {
    const studentNotification = {
      ...mockNotification,
      character: 'student' as const
    };

    const { rerender } = render(<PerkUnlockNotification notification={studentNotification} onClose={mockOnClose} />);
    let spans = document.querySelectorAll('span');
    let studentSpan = Array.from(spans).find(span => span.textContent === '👨‍🎓');
    expect(studentSpan).toBeTruthy();

    const librarianNotification = {
      ...mockNotification,
      character: 'librarian' as const
    };

    rerender(<PerkUnlockNotification notification={librarianNotification} onClose={mockOnClose} />);
    spans = document.querySelectorAll('span');
    let librarianSpan = Array.from(spans).find(span => span.textContent === '👩‍💼');
    expect(librarianSpan).toBeTruthy();
  });

  it('should show perk icons based on category', () => {
    render(<PerkUnlockNotification notification={mockNotification} onClose={mockOnClose} />);

    // Should show cosmetic icon (✨) for cosmetic perk category (since both perks are cosmetic)
    const perkIcons = document.querySelectorAll('span');
    const hasCosmericIcon = Array.from(perkIcons).some(icon => icon.textContent === '✨');
    expect(hasCosmericIcon).toBe(true);
  });

  it('should display perk details correctly', () => {
    render(<PerkUnlockNotification notification={mockNotification} onClose={mockOnClose} />);

    // Check first perk details
    expect(screen.getByText('Starter Badge')).toBeInTheDocument();
    expect(screen.getByText('Level 5 • cosmetic')).toBeInTheDocument();

    // Check second perk details  
    expect(screen.getByText('Avatar Collection')).toBeInTheDocument();
    expect(screen.getByText('Level 10 • cosmetic')).toBeInTheDocument();
  });

  it('should handle perks with missing perk data', () => {
    const notificationWithMissingPerk: PerkUnlockNotificationType = {
      ...mockNotification,
      unlockedPerks: [
        {
          id: 3,
          user_id: 1,
          perk_id: 3,
          is_unlocked: true,
          is_active: false,
          configuration: {},
          // No perk data
        }
      ]
    };

    render(<PerkUnlockNotification notification={notificationWithMissingPerk} onClose={mockOnClose} />);

    expect(screen.getByText('Unknown Perk')).toBeInTheDocument();
    expect(screen.getByText('Level 0 • Cosmetic')).toBeInTheDocument();
  });

  it('should close notification when close button is clicked', () => {
    render(<PerkUnlockNotification notification={mockNotification} onClose={mockOnClose} />);

    const closeButton = screen.getByText('×');
    fireEvent.click(closeButton);

    // Should call onClose after animation delay
    vi.advanceTimersByTime(500);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should auto-close after 6 seconds', () => {
    render(<PerkUnlockNotification notification={mockNotification} onClose={mockOnClose} />);

    // Should not be closed initially
    expect(mockOnClose).not.toHaveBeenCalled();

    // Fast forward 6 seconds (auto-close timer)
    vi.advanceTimersByTime(6000);

    // Should start fade out animation
    vi.advanceTimersByTime(500);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should show confetti animation', () => {
    render(<PerkUnlockNotification notification={mockNotification} onClose={mockOnClose} />);

    // Should have confetti elements
    const confettiElements = document.querySelectorAll('div[style*="confettiFall"]');
    expect(confettiElements.length).toBe(25); // 25 confetti pieces
  });

  it('should apply correct styling for visibility animation', () => {
    const { container } = render(<PerkUnlockNotification notification={mockNotification} onClose={mockOnClose} />);

    // Should start with transform translateX(0) when visible
    const notification = container.firstChild as HTMLElement;
    expect(notification).toHaveStyle('transform: translateX(0)');
  });

  it('should handle multiple perks with proper scrolling', () => {
    const manyPerksNotification: PerkUnlockNotificationType = {
      ...mockNotification,
      unlockedPerks: [
        ...mockNotification.unlockedPerks,
        {
          id: 3,
          user_id: 1,
          perk_id: 3,
          is_unlocked: true,
          is_active: false,
          configuration: {},
          perk: {
            id: 3,
            name: 'theme_perk',
            category: 'cosmetic',
            type: 'theme',
            level_required: 15,
            title: 'Custom Theme',
            description: 'Personalize your interface',
            is_active: true,
          }
        }
      ]
    };

    render(<PerkUnlockNotification notification={manyPerksNotification} onClose={mockOnClose} />);

    // Should show all perks
    expect(screen.getByText('Starter Badge')).toBeInTheDocument();
    expect(screen.getByText('Avatar Collection')).toBeInTheDocument();
    expect(screen.getByText('Custom Theme')).toBeInTheDocument();

    // Container should have scroll styling
    const perksList = document.querySelector('div[style*="120px"]');
    expect(perksList).toBeTruthy();
    expect(perksList).toHaveAttribute('style', expect.stringContaining('max-height: 120px'));
    expect(perksList).toHaveAttribute('style', expect.stringContaining('overflow-y: auto'));
  });

  it('should show appropriate perk icons for different categories', () => {
    const variousPerksNotification: PerkUnlockNotificationType = {
      ...mockNotification,
      unlockedPerks: [
        {
          id: 1,
          user_id: 1,
          perk_id: 1,
          is_unlocked: true,
          is_active: false,
          configuration: {},
          perk: {
            id: 1,
            name: 'theme_perk',
            category: 'theme',
            type: 'theme',
            level_required: 10,
            title: 'Custom Theme',
            description: 'Theme perk',
            is_active: true,
          }
        },
        {
          id: 2,
          user_id: 1,
          perk_id: 2,
          is_unlocked: true,
          is_active: false,
          configuration: {},
          perk: {
            id: 2,
            name: 'booster_perk',
            category: 'booster',
            type: 'booster',
            level_required: 15,
            title: 'Speed Booster',
            description: 'Booster perk',
            is_active: true,
          }
        }
      ]
    };

    render(<PerkUnlockNotification notification={variousPerksNotification} onClose={mockOnClose} />);

    const perkIcons = document.querySelectorAll('span');

    // Should show theme icon (🎨)
    const hasThemeIcon = Array.from(perkIcons).some(icon => icon.textContent === '🎨');
    expect(hasThemeIcon).toBe(true);

    // Should show booster icon (⚡)
    const hasBoosterIcon = Array.from(perkIcons).some(icon => icon.textContent === '⚡');
    expect(hasBoosterIcon).toBe(true);
  });

  it('should clean up timers on unmount', () => {
    const { unmount } = render(<PerkUnlockNotification notification={mockNotification} onClose={mockOnClose} />);

    // Get number of pending timers
    const pendingTimersBefore = vi.getTimerCount();

    unmount();

    // Should clean up timers
    const pendingTimersAfter = vi.getTimerCount();
    expect(pendingTimersAfter).toBeLessThanOrEqual(pendingTimersBefore);
  });
});