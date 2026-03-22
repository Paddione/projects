import { jest } from 'vitest'

const mockUseLocalization = {
  t: vi.fn((key: string) => {
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
  setLanguage: vi.fn(),
  getSupportedLanguages: vi.fn(),
  getLanguageName: vi.fn(),
  getLanguageFlag: vi.fn()
}

export { mockUseLocalization }
const useLocalization = vi.fn(() => mockUseLocalization)

export default useLocalization
export { useLocalization }
