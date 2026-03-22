import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useCharacterStore, useAvailableCharacters, useCharacterLoading, useCharacterUpdating } from '../../stores/characterStore';

// Mock the character store
vi.mock('../../stores/characterStore', () => ({
  useCharacterStore: vi.fn(),
  useAvailableCharacters: vi.fn(),
  useCharacterLoading: vi.fn(),
  useCharacterUpdating: vi.fn(),
  useOwnedCharacters: vi.fn(() => ['1', '2', '3']),
  useRespectBalance: vi.fn(() => 0),
}));

// Mock useLocalization used by CharacterSelector with needed translations
vi.mock('../../hooks/useLocalization', () => ({
  useLocalization: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'character.loading': 'Loading characters...',
        'character.chooseTitle': 'Choose Your Character',
        'character.chooseDescription': 'Select a university-themed character to represent you in the game',
        'character.updating': 'Updating character...',
      }
      return translations[key] ?? key
    },
  }),
}));

// Mock the auth store
vi.mock('../../stores/authStore', () => ({
  useAuthStore: vi.fn()
}));

// Mock the theme store
vi.mock('../../stores/themeStore', () => ({
  useThemeStore: vi.fn(() => ({
    theme: 'dark'
  }))
}));

// Mock the settings store
vi.mock('../../stores/settingsStore', () => ({
  useSettingsStore: vi.fn(() => ({
    language: 'en'
  }))
}));

// Mock the audio store
vi.mock('../../stores/audioStore', () => ({
  useAudioStore: vi.fn(() => ({
    playSound: vi.fn()
  }))
}));

// Mock the avatar service to return null/undefined so it falls back to character.emoji
vi.mock('../../services/avatarService', () => ({
  avatarService: {
    getAvatarEmoji: vi.fn(() => null), // Return null to fall back to character.emoji
    getAvatarSvgPath: vi.fn(() => null), // Return null to fall back to emoji display
    initialize: vi.fn(),
    setActiveAvatarOverride: vi.fn()
  }
}));

// Import the component after all mocks are defined
import { CharacterSelector } from '../CharacterSelector';

const mockUseCharacterStore = useCharacterStore as vi.MockedFunction<typeof useCharacterStore>;
const mockUseAvailableCharacters = useAvailableCharacters as vi.MockedFunction<typeof useAvailableCharacters>;
const mockUseCharacterLoading = useCharacterLoading as vi.MockedFunction<typeof useCharacterLoading>;
const mockUseCharacterUpdating = useCharacterUpdating as vi.MockedFunction<typeof useCharacterUpdating>;

describe('CharacterSelector Component', () => {
  const mockUpdateCharacter = vi.fn();

  const mockCharacters = [
    {
      id: '1',
      name: 'Student',
      emoji: '🎓',
      description: 'A dedicated student with high intelligence',
      unlockLevel: 1
    },
    {
      id: '2',
      name: 'Professor',
      emoji: '👨‍🏫',
      description: 'A wise professor with vast knowledge',
      unlockLevel: 5
    },
    {
      id: '3',
      name: 'Researcher',
      emoji: '🔬',
      description: 'A curious researcher with analytical skills',
      unlockLevel: 10
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCharacterStore.mockReturnValue({
      loadCharacters: vi.fn(),
      updateCharacter: mockUpdateCharacter,
      characters: mockCharacters,
      purchaseCharacter: vi.fn(),
      loadCharacterProfile: vi.fn(),
    });
    
    mockUseAvailableCharacters.mockReturnValue(mockCharacters);
    mockUseCharacterLoading.mockReturnValue(false);
    mockUseCharacterUpdating.mockReturnValue(false);
  });

  const renderCharacterSelector = (props = {}) => {
    const defaultProps = {
      selectedCharacter: '1',
      onCharacterSelect: vi.fn(),
      ...props
    }
    return render(<CharacterSelector {...defaultProps} />)
  }

  describe('Character Display', () => {
    it('should display all available characters', () => {
      renderCharacterSelector();

      expect(screen.getByTitle('A dedicated student with high intelligence')).toBeInTheDocument();
      expect(screen.getByTitle('A wise professor with vast knowledge')).toBeInTheDocument();
      expect(screen.getByTitle('A curious researcher with analytical skills')).toBeInTheDocument();
    });

    it('should display character descriptions', () => {
      renderCharacterSelector();

      expect(screen.getByTitle('A dedicated student with high intelligence')).toBeInTheDocument();
      expect(screen.getByTitle('A wise professor with vast knowledge')).toBeInTheDocument();
      expect(screen.getByTitle('A curious researcher with analytical skills')).toBeInTheDocument();
    });

    it('should display character emojis', () => {
      renderCharacterSelector();

      expect(screen.getByText('🎓')).toBeInTheDocument();
      expect(screen.getByText('👨‍🏫')).toBeInTheDocument();
      expect(screen.getByText('🔬')).toBeInTheDocument();
    });

    it('should highlight the currently selected character', () => {
      renderCharacterSelector({ selectedCharacter: '1' });

      const selectedCharacter = screen.getByTestId('character-1');
      expect(selectedCharacter).toHaveClass('selected');
    });

    it('should show character levels when showLevels is true', () => {
      renderCharacterSelector({ showLevels: true });

      expect(screen.getByText('Choose Your Character')).toBeInTheDocument();
    });
  });

  describe('Character Selection Interactions', () => {
    it('should call updateCharacter when a character is clicked', () => {
      renderCharacterSelector();

      const professorCharacter = screen.getByTitle('A wise professor with vast knowledge').closest('button');
      fireEvent.click(professorCharacter!);

      expect(mockUpdateCharacter).toHaveBeenCalledWith('2');
    });

    it('should call onCharacterSelect when character is selected', async () => {
      mockUpdateCharacter.mockResolvedValue(true);
      const mockOnCharacterSelect = vi.fn();

      renderCharacterSelector({ onCharacterSelect: mockOnCharacterSelect });

      const studentCharacter = screen.getByTitle('A dedicated student with high intelligence').closest('button');
      fireEvent.click(studentCharacter!);

      await waitFor(() => {
        expect(mockOnCharacterSelect).toHaveBeenCalledWith('1');
      });
    });
  });

  describe('Loading States', () => {
    it('should show loading state when characters are being fetched', () => {
      mockUseCharacterLoading.mockReturnValue(true);

      renderCharacterSelector();

      expect(screen.getByText('Loading characters...')).toBeInTheDocument();
    });

    it('should show updating state when character is being updated', () => {
      mockUseCharacterUpdating.mockReturnValue(true);

      renderCharacterSelector();

      expect(screen.getByText('Updating character...')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle character update failure', async () => {
      mockUpdateCharacter.mockResolvedValue(false);
      const mockOnCharacterSelect = vi.fn();

      renderCharacterSelector({ onCharacterSelect: mockOnCharacterSelect });

      const studentCharacter = screen.getByTitle('A dedicated student with high intelligence').closest('button');
      fireEvent.click(studentCharacter!);

      await waitFor(() => {
        expect(mockOnCharacterSelect).not.toHaveBeenCalled();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      renderCharacterSelector();

      expect(screen.getByText('Choose Your Character')).toBeInTheDocument();
      expect(screen.getByText('Select a university-themed character to represent you in the game')).toBeInTheDocument();
    });

    it('should be keyboard navigable', () => {
      renderCharacterSelector();

      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
      
      buttons.forEach(button => {
        expect(button).toHaveAttribute('type', 'button');
      });
    });
  });

  describe('Responsive Design', () => {
    it('should render with custom className', () => {
      renderCharacterSelector({ className: 'custom-class' });

      const container = screen.getByText('Choose Your Character').closest('div');
      expect(container).toHaveClass('custom-class');
    });
  });
}); 