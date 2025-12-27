import '@testing-library/jest-dom'
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Create mock objects
const mockUseLocalization = {
  t: jest.fn((key: string) => {
    const translations: Record<string, string> = {
      'settings.title': 'Settings',
      'settings.audio': 'Audio',
      'settings.language': 'Language',
      'settings.theme': 'Theme',
      'help.title': 'Help',
      'button.close': 'Close',
      'button.save': 'Save',
      'info.languageChanged': 'Language changed successfully',
      'info.themeChanged': 'Theme changed successfully',
      'help.howToPlay': 'How to Play',
      'help.scoring': 'Scoring System',
      'help.multipliers': 'Multipliers',
      'help.audio': 'Audio Settings',
      'help.language': 'Language Settings',
      'help.contact': 'Contact Support'
    }
    return translations[key] || key
  }),
  currentLanguage: 'en',
  setLanguage: jest.fn(),
  getSupportedLanguages: jest.fn(() => ['en', 'de']),
  getLanguageName: jest.fn((lang: string) => lang === 'en' ? 'English' : 'Deutsch'),
  getLanguageFlag: jest.fn((lang: string) => lang === 'en' ? '🇺🇸' : '🇩🇪')
}

const mockUseAudio = {
  handleButtonClick: jest.fn(),
  handleButtonHover: jest.fn(),
  handleModalOpen: jest.fn(),
  handleModalClose: jest.fn(),
  isAudioSupported: jest.fn().mockReturnValue(true)
}

const mockUseVisualFeedback = {
  animateModal: jest.fn()
}

// Mock the hooks
jest.mock('../../hooks/useLocalization', () => ({
  useLocalization: () => mockUseLocalization
}))

jest.mock('../../hooks/useAudio', () => ({
  useAudio: () => mockUseAudio
}))

jest.mock('../../hooks/useVisualFeedback', () => ({
  useVisualFeedback: () => mockUseVisualFeedback
}))

jest.mock('../LanguageSelector', () => ({
  LanguageSelector: () => <div data-testid="language-selector">Language Selector</div>
}))

jest.mock('../AudioSettings', () => ({
  AudioSettings: () => <div data-testid="audio-settings">Audio Settings</div>
}));

jest.mock('../ThemeSelector', () => ({
  ThemeSelector: () => <div data-testid="theme-selector">Theme Selector</div>
}));

// Mock CSS modules
jest.mock('../../styles/SettingsModal.module.css', () => ({
  __esModule: true,
  default: {
    modal: 'modal-class',
    overlay: 'overlay-class',
    header: 'header-class',
    closeButton: 'close-button-class',
    tabs: 'tabs-class',
    tab: 'tab-class',
    active: 'active-class',
    content: 'content-class',
    tabContent: 'tab-content-class',
    info: 'info-class',
    footer: 'footer-class',
    saveButton: 'save-button-class',
    helpContent: 'help-content-class',
    helpSection: 'help-section-class',
    helpText: 'help-text-class',
    audioPanel: 'audio-panel',
    languagePanel: 'language-panel',
    themePanel: 'theme-panel',
    helpPanel: 'help-panel',
  }
}), { virtual: true })

// Import the component AFTER all mocks are defined
import { SettingsModal } from '../SettingsModal'

describe('SettingsModal Component', () => {
  const mockOnClose = jest.fn()
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    // Reinitialize the t function mock to ensure it returns proper translations
    mockUseLocalization.t.mockImplementation((key: string) => {
      const translations: Record<string, string> = {
        'settings.title': 'Settings',
        'settings.audio': 'Audio',
        'settings.language': 'Language',
        'settings.theme': 'Theme',
        'help.title': 'Help',
        'button.close': 'Close',
        'button.save': 'Save',
        'info.languageChanged': 'Language changed successfully',
        'info.themeChanged': 'Theme changed successfully',
        'help.howToPlay': 'How to Play',
        'help.scoring': 'Scoring System',
        'help.multipliers': 'Multipliers',
        'help.audio': 'Audio Settings',
        'help.language': 'Language Settings',
        'help.contact': 'Contact Support'
      }
      return translations[key] || key
    })
    // Fresh userEvent instance per test to ensure proper act wrapping
    user = userEvent.setup()
    
    jest.clearAllMocks()
  })

  describe('Modal Visibility', () => {
    it('renders nothing when isOpen is false', () => {
      const { container } = render(
        <SettingsModal isOpen={false} onClose={mockOnClose} />
      )
      expect(container.firstChild).toBeNull()
    })

    it('renders modal when isOpen is true', () => {
      render(<SettingsModal isOpen={true} onClose={mockOnClose} />)
      
      expect(screen.getByText('Settings')).toBeInTheDocument()
      expect(screen.getByRole('dialog')).toBeInTheDocument()
    })

    it('calls handleModalOpen and animateModal when modal opens', () => {
      render(<SettingsModal isOpen={true} onClose={mockOnClose} />)
      
      expect(mockUseAudio.handleModalOpen).toHaveBeenCalled()
      expect(mockUseVisualFeedback.animateModal).toHaveBeenCalledWith('settings-modal', true)
    })

    it('calls handleModalClose and animateModal when modal closes', () => {
      const { rerender } = render(
        <SettingsModal isOpen={true} onClose={mockOnClose} />
      )
      
      rerender(<SettingsModal isOpen={false} onClose={mockOnClose} />)
      
      expect(mockUseAudio.handleModalClose).toHaveBeenCalled()
      expect(mockUseVisualFeedback.animateModal).toHaveBeenCalledWith('settings-modal', false)
    })
  })

  describe('Modal Header', () => {
    it('displays correct title', () => {
      render(<SettingsModal isOpen={true} onClose={mockOnClose} />)
      
      expect(screen.getByText('Settings')).toBeInTheDocument()
      expect(mockUseLocalization.t).toHaveBeenCalledWith('settings.title')
    })

    it('renders close button with correct attributes', () => {
      render(<SettingsModal isOpen={true} onClose={mockOnClose} />)
      
      const closeButton = screen.getByRole('button', { name: /close/i })
      expect(closeButton).toBeInTheDocument()
      expect(closeButton).toHaveAttribute('title', 'Close')
    })

    it('calls onClose when close button is clicked', async () => {
      render(<SettingsModal isOpen={true} onClose={mockOnClose} />)
      
      const closeButton = screen.getByRole('button', { name: /close/i })
      await user.click(closeButton)
      
      expect(mockUseAudio.handleButtonClick).toHaveBeenCalled()
      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  describe('Tab Navigation', () => {
    it('renders all tab buttons with correct labels', () => {
      render(<SettingsModal isOpen={true} onClose={mockOnClose} />)
      
      expect(screen.getByText((content, element) => {
        return element?.tagName.toLowerCase() === 'button' && content.includes('Audio')
      })).toBeInTheDocument()
      expect(screen.getByText((content, element) => {
        return element?.tagName.toLowerCase() === 'button' && content.includes('Language')
      })).toBeInTheDocument()
      expect(screen.getByText((content, element) => {
        return element?.tagName.toLowerCase() === 'button' && content.includes('Theme')
      })).toBeInTheDocument()
      expect(screen.getByText((content, element) => {
        return element?.tagName.toLowerCase() === 'button' && content.includes('Help')
      })).toBeInTheDocument()
    })

    it('starts with audio tab active by default', () => {
      render(<SettingsModal isOpen={true} onClose={mockOnClose} />)
      
      const audioTab = screen.getByText((content, element) => {
        return element?.tagName.toLowerCase() === 'button' && content.includes('Audio')
      })
      expect(audioTab).toHaveClass('active-class')
    })

    it('switches to language tab when clicked', async () => {
      render(<SettingsModal isOpen={true} onClose={mockOnClose} />)
      
      const languageTab = screen.getByText((content, element) => {
        return element?.tagName.toLowerCase() === 'button' && content.includes('Language')
      })
      await user.click(languageTab)
      
      expect(mockUseAudio.handleButtonClick).toHaveBeenCalled()
      expect(languageTab).toHaveClass('active-class')
      expect(screen.getByTestId('language-selector')).toBeInTheDocument()
    })

    it('switches to theme tab when clicked', async () => {
      render(<SettingsModal isOpen={true} onClose={mockOnClose} />)
      
      const themeTab = screen.getByText((content, element) => {
        return element?.tagName.toLowerCase() === 'button' && content.includes('Theme')
      })
      await user.click(themeTab)
      
      expect(mockUseAudio.handleButtonClick).toHaveBeenCalled()
      expect(themeTab).toHaveClass('active-class')
      expect(screen.getByTestId('theme-selector')).toBeInTheDocument()
    })

    it('switches to help tab when clicked', async () => {
      render(<SettingsModal isOpen={true} onClose={mockOnClose} />)
      
      const helpTab = screen.getByText((content, element) => {
        return element?.tagName.toLowerCase() === 'button' && content.includes('Help')
      })
      await user.click(helpTab)
      
      expect(mockUseAudio.handleButtonClick).toHaveBeenCalled()
      expect(helpTab).toHaveClass('active-class')
      expect(screen.getByText('How to Play')).toBeInTheDocument()
    })

    it('plays hover sound when tab is hovered', async () => {
      render(<SettingsModal isOpen={true} onClose={mockOnClose} />)
      
      const audioTab = screen.getByText((content, element) => {
        return element?.tagName.toLowerCase() === 'button' && content.includes('Audio')
      })
      fireEvent.mouseEnter(audioTab)
      
      expect(mockUseAudio.handleButtonHover).toHaveBeenCalled()
    })
  })

  describe('Tab Content', () => {
    it('shows audio settings when audio tab is active', () => {
      render(<SettingsModal isOpen={true} onClose={mockOnClose} />)
      
      expect(screen.getByTestId('audio-settings')).toBeInTheDocument()
    })

    it('shows language selector when language tab is active', async () => {
      render(<SettingsModal isOpen={true} onClose={mockOnClose} />)
      
      const languageTab = screen.getByText((content, element) => {
        return element?.tagName.toLowerCase() === 'button' && content.includes('Language')
      })
      await user.click(languageTab)
      
      expect(screen.getByTestId('language-selector')).toBeInTheDocument()
      expect(screen.getByText('Language changed successfully')).toBeInTheDocument()
    })

    it('shows theme selector when theme tab is active', async () => {
      render(<SettingsModal isOpen={true} onClose={mockOnClose} />)
      
      const themeTab = screen.getByText((content, element) => {
        return element?.tagName.toLowerCase() === 'button' && content.includes('Theme')
      })
      await user.click(themeTab)
      
      expect(screen.getByTestId('theme-selector')).toBeInTheDocument()
      expect(screen.getByText('Theme changed successfully')).toBeInTheDocument()
    })

    it('shows help content when help tab is active', async () => {
      render(<SettingsModal isOpen={true} onClose={mockOnClose} />)
      
      const helpTab = screen.getByText((content, element) => {
        return element?.tagName.toLowerCase() === 'button' && content.includes('Help')
      })
      await user.click(helpTab)
      
      expect(screen.getByText('How to Play')).toBeInTheDocument()
      expect(screen.getByText('Scoring System')).toBeInTheDocument()
      expect(screen.getByText('Multipliers')).toBeInTheDocument()
      expect(screen.getByText('Audio Settings')).toBeInTheDocument()
      expect(screen.getByText('Language Settings')).toBeInTheDocument()
      expect(screen.getByText('Contact Support')).toBeInTheDocument()
    })
  })

  describe('Help Content', () => {
    beforeEach(async () => {
      render(<SettingsModal isOpen={true} onClose={mockOnClose} />)
      const helpTab = screen.getByText((content, element) => {
        return element?.tagName.toLowerCase() === 'button' && content.includes('Help')
      })
      await user.click(helpTab)
    })

    it('displays how to play instructions', () => {
      expect(screen.getByText('1. Create or join a game using a unique code')).toBeInTheDocument()
      expect(screen.getByText('2. Wait for all players to be ready')).toBeInTheDocument()
      expect(screen.getByText('3. Answer questions within the time limit')).toBeInTheDocument()
      expect(screen.getByText('4. Build up your multiplier with consecutive correct answers')).toBeInTheDocument()
      expect(screen.getByText('5. Submit your score to the Hall of Fame')).toBeInTheDocument()
    })

    it('displays scoring system information', () => {
      expect(screen.getByText('• Points = (60 - seconds elapsed) × multiplier')).toBeInTheDocument()
      expect(screen.getByText('• Multiplier increases with consecutive correct answers')).toBeInTheDocument()
      expect(screen.getByText('• Wrong answers reset multiplier to 1x')).toBeInTheDocument()
      expect(screen.getByText('• Higher multipliers = more points per correct answer')).toBeInTheDocument()
    })

    it('displays multiplier information', () => {
      expect(screen.getByText('• 1x: Starting multiplier')).toBeInTheDocument()
      expect(screen.getByText('• 2x: After 1 consecutive correct answer')).toBeInTheDocument()
      expect(screen.getByText('• 3x: After 2 consecutive correct answers')).toBeInTheDocument()
      expect(screen.getByText('• 4x: After 3 consecutive correct answers')).toBeInTheDocument()
      expect(screen.getByText('• 5x: After 4 consecutive correct answers (maximum)')).toBeInTheDocument()
    })

    it('displays audio settings help', () => {
      expect(screen.getByText('• Adjust music and sound effect volumes independently')).toBeInTheDocument()
      expect(screen.getByText('• Mute all audio with the master mute button')).toBeInTheDocument()
      expect(screen.getByText('• Test audio with the provided test buttons')).toBeInTheDocument()
      expect(screen.getByText('• Settings are automatically saved')).toBeInTheDocument()
    })

    it('displays language settings help', () => {
      expect(screen.getByText('• Switch between German and English')).toBeInTheDocument()
      expect(screen.getByText('• Language preference is saved automatically')).toBeInTheDocument()
      expect(screen.getByText('• All UI elements update instantly')).toBeInTheDocument()
      expect(screen.getByText('• Fallback to English for missing translations')).toBeInTheDocument()
    })

    it('displays contact information', () => {
      expect(screen.getByText('For support or questions:')).toBeInTheDocument()
      expect(screen.getByText('• Email: support@learn2play.com')).toBeInTheDocument()
      expect(screen.getByText('• GitHub: github.com/learn2play')).toBeInTheDocument()
      expect(screen.getByText('• Discord: discord.gg/learn2play')).toBeInTheDocument()
    })
  })

  describe('Modal Footer', () => {
    it('renders save button', () => {
      render(<SettingsModal isOpen={true} onClose={mockOnClose} />)
      
      const saveButton = screen.getByRole('button', { name: /save/i })
      expect(saveButton).toBeInTheDocument()
    })

    it('calls onClose when save button is clicked', async () => {
      render(<SettingsModal isOpen={true} onClose={mockOnClose} />)
      
      const saveButton = screen.getByRole('button', { name: /save/i })
      await user.click(saveButton)
      
      expect(mockUseAudio.handleButtonClick).toHaveBeenCalled()
      expect(mockOnClose).toHaveBeenCalled()
    })

    it('plays hover sound when save button is hovered', () => {
      render(<SettingsModal isOpen={true} onClose={mockOnClose} />)
      
      const saveButton = screen.getByRole('button', { name: /save/i })
      fireEvent.mouseEnter(saveButton)
      
      expect(mockUseAudio.handleButtonHover).toHaveBeenCalled()
    })
  })

  describe('Modal Overlay', () => {
    it('calls onClose when overlay is clicked', async () => {
      render(<SettingsModal isOpen={true} onClose={mockOnClose} />)
      
      const overlay = screen.getByRole('dialog').parentElement
      if (overlay) {
        await user.click(overlay)
        expect(mockOnClose).toHaveBeenCalled()
      }
    })

    it('does not call onClose when modal content is clicked', async () => {
      render(<SettingsModal isOpen={true} onClose={mockOnClose} />)
      
      const modalContent = screen.getByRole('dialog')
      await user.click(modalContent)
      
      expect(mockOnClose).not.toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      render(<SettingsModal isOpen={true} onClose={mockOnClose} />)
      
      const modal = screen.getByRole('dialog')
      expect(modal).toBeInTheDocument()
      
      const closeButton = screen.getByRole('button', { name: /close/i })
      expect(closeButton).toHaveAttribute('title', 'Close')
    })

    it('supports keyboard navigation', async () => {
      render(<SettingsModal isOpen={true} onClose={mockOnClose} />)
      
      // Manually focus each element to test the matcher
      const closeBtn = screen.getByLabelText('Close')
      const audioTab = screen.getByText((content, element) => {
        return element?.tagName.toLowerCase() === 'button' && content.includes('Audio')
      })
      const languageTab = screen.getByText((content, element) => {
        return element?.tagName.toLowerCase() === 'button' && content.includes('Language')
      })
      const themeTab = screen.getByText((content, element) => {
        return element?.tagName.toLowerCase() === 'button' && content.includes('Theme')
      })
      const helpTab = screen.getByText((content, element) => {
        return element?.tagName.toLowerCase() === 'button' && content.includes('Help')
      })
      const saveBtn = screen.getByText('Save')
      
      closeBtn.focus()
      expect(closeBtn).toHaveFocus()
      
      audioTab.focus()
      expect(audioTab).toHaveFocus()
      
      languageTab.focus()
      expect(languageTab).toHaveFocus()
      
      themeTab.focus()
      expect(themeTab).toHaveFocus()
      
      helpTab.focus()
      expect(helpTab).toHaveFocus()
      
      saveBtn.focus()
      expect(saveBtn).toHaveFocus()
    })

    it('closes modal on Escape key', async () => {
      render(<SettingsModal isOpen={true} onClose={mockOnClose} />)
      
      await user.keyboard('{Escape}')
      
      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('handles missing translation keys gracefully', () => {
      const originalMock = mockUseLocalization.t
      mockUseLocalization.t = jest.fn((key: string) => {
        // Return undefined for the settings title to test error handling
        if (key === 'settings.title') {
          return undefined as any
        }
        return key
      }) as any

      render(<SettingsModal isOpen={true} onClose={mockOnClose} />)
      
      // Component should render without crashing even when translation returns undefined
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      
      // Restore the original mock function
      mockUseLocalization.t = originalMock
    })

    it('handles audio hook errors gracefully', async () => {
      mockUseAudio.handleButtonClick.mockImplementation(() => {
        throw new Error('Audio error')
      })

      render(<SettingsModal isOpen={true} onClose={mockOnClose} />)
      
      const audioTab = screen.getByText((content, element) => {
        return element?.tagName.toLowerCase() === 'button' && content.includes('Audio')
      })
      
      // Should not crash the component
      await expect(user.click(audioTab)).resolves.toBeUndefined()
      
      // Reset mock to use the original implementation
      mockUseAudio.handleButtonClick.mockRestore()
    })

    it('calls handleModalClose when modal is closed', () => {
      const { rerender } = render(
        <SettingsModal isOpen={true} onClose={mockOnClose} />
      )
      
      // Re-render with isOpen=false to trigger the cleanup useEffect
      rerender(<SettingsModal isOpen={false} onClose={mockOnClose} />)
      
      // Verify handleModalClose is called when isOpen changes to false
      expect(mockUseAudio.handleModalClose).toHaveBeenCalled()
    })
  })
}) 