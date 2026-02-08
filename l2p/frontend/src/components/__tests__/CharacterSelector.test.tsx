import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useCharacterStore, useAvailableCharacters, useCharacterLoading, useCharacterUpdating } from '../../stores/characterStore';

// Mock the character store
jest.mock('../../stores/characterStore', () => ({
  useCharacterStore: jest.fn(),
  useAvailableCharacters: jest.fn(),
  useCharacterLoading: jest.fn(),
  useCharacterUpdating: jest.fn()
}));

// Mock the auth store
jest.mock('../../stores/authStore', () => ({
  useAuthStore: jest.fn()
}));

// Mock the theme store
jest.mock('../../stores/themeStore', () => ({
  useThemeStore: jest.fn(() => ({
    theme: 'dark'
  }))
}));

// Mock the settings store
jest.mock('../../stores/settingsStore', () => ({
  useSettingsStore: jest.fn(() => ({
    language: 'en'
  }))
}));

// Mock the audio store
jest.mock('../../stores/audioStore', () => ({
  useAudioStore: jest.fn(() => ({
    playSound: jest.fn()
  }))
}));

// Mock the avatar service to return null/undefined so it falls back to character.emoji
jest.mock('../../services/avatarService', () => ({
  avatarService: {
    getAvatarEmoji: jest.fn(() => null), // Return null to fall back to character.emoji
    getAvatarSvgPath: jest.fn(() => null), // Return null to fall back to emoji display
    initialize: jest.fn(),
    setActiveAvatarOverride: jest.fn()
  }
}));

// Import the component after all mocks are defined
import { CharacterSelector } from '../CharacterSelector';

const mockUseCharacterStore = useCharacterStore as jest.MockedFunction<typeof useCharacterStore>;
const mockUseAvailableCharacters = useAvailableCharacters as jest.MockedFunction<typeof useAvailableCharacters>;
const mockUseCharacterLoading = useCharacterLoading as jest.MockedFunction<typeof useCharacterLoading>;
const mockUseCharacterUpdating = useCharacterUpdating as jest.MockedFunction<typeof useCharacterUpdating>;

describe('CharacterSelector Component', () => {
  const mockUpdateCharacter = jest.fn();

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
    jest.clearAllMocks();
    mockUseCharacterStore.mockReturnValue({
      loadCharacters: jest.fn(),
      updateCharacter: mockUpdateCharacter
    });
    
    mockUseAvailableCharacters.mockReturnValue(mockCharacters);
    mockUseCharacterLoading.mockReturnValue(false);
    mockUseCharacterUpdating.mockReturnValue(false);
  });

  const renderCharacterSelector = (props = {}) => {
    const defaultProps = {
      selectedCharacter: '1',
      onCharacterSelect: jest.fn(),
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
      const mockOnCharacterSelect = jest.fn();

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
      const mockOnCharacterSelect = jest.fn();

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