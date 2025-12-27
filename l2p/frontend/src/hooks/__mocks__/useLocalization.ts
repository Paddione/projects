import { jest } from '@jest/globals'

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
  getSupportedLanguages: jest.fn(),
  getLanguageName: jest.fn(),
  getLanguageFlag: jest.fn()
}

export { mockUseLocalization }
const useLocalization = jest.fn(() => mockUseLocalization)

export default useLocalization
export { useLocalization }
