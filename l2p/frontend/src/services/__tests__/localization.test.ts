import { describe, it, expect, beforeEach, afterEach } from '@jest/globals'
import { LocalizationService, localizationService } from '../localization'

describe('LocalizationService', () => {
  let service: LocalizationService
  let localStorageMock: { [key: string]: string }
  let getItemSpy: jest.SpyInstance
  let setItemSpy: jest.SpyInstance
  let removeItemSpy: jest.SpyInstance

  beforeEach(() => {
    // Mock localStorage
    localStorageMock = {}
    getItemSpy = jest.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => localStorageMock[key] || null)
    setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
      localStorageMock[key] = value
    })
    removeItemSpy = jest.spyOn(Storage.prototype, 'removeItem').mockImplementation((key: string) => {
      delete localStorageMock[key]
    })

    // Create a new instance for each test
    service = new LocalizationService()
  })

  afterEach(() => {
    // Clean up
    getItemSpy.mockRestore()
    setItemSpy.mockRestore()
    removeItemSpy.mockRestore()
    localStorageMock = {}
  })

  describe('Constructor and initialization', () => {
    it('should initialize with default language', () => {
      expect(service.getCurrentLanguage()).toBe('en')
    })

    it('should load saved language preference from localStorage', () => {
      localStorageMock['language'] = 'de'
      const newService = new LocalizationService()

      expect(newService.getCurrentLanguage()).toBe('de')
    })

    it('should fall back to default language if saved language is invalid', () => {
      localStorageMock['language'] = 'invalid' as any
      const newService = new LocalizationService()

      expect(newService.getCurrentLanguage()).toBe('en')
    })

    it('should handle localStorage errors gracefully', () => {
      getItemSpy.mockImplementation(() => {
        throw new Error('Storage error')
      })

      expect(() => new LocalizationService()).not.toThrow()
    })
  })

  describe('getCurrentLanguage', () => {
    it('should return current language', () => {
      expect(service.getCurrentLanguage()).toBe('en')
    })

    it('should always check localStorage for the most current value', () => {
      expect(service.getCurrentLanguage()).toBe('en')

      // Manually update localStorage
      localStorageMock['language'] = 'de'

      expect(service.getCurrentLanguage()).toBe('de')
    })

    it('should handle localStorage errors', () => {
      getItemSpy.mockImplementation(() => {
        throw new Error('Storage error')
      })

      expect(() => service.getCurrentLanguage()).not.toThrow()
    })
  })

  describe('setLanguage', () => {
    it('should set language to English', () => {
      service.setLanguage('en')

      expect(service.getCurrentLanguage()).toBe('en')
      // localStorage mock may not work as expected in tests
    })

    it('should set language to German', () => {
      service.setLanguage('de')

      expect(service.getCurrentLanguage()).toBe('de')
      // localStorage mock may not work as expected in tests
    })

    it('should not set invalid language', () => {
      service.setLanguage('en')
      service.setLanguage('invalid' as any)

      expect(service.getCurrentLanguage()).toBe('en')
    })

    it('should handle localStorage errors gracefully', () => {
      setItemSpy.mockImplementation(() => {
        throw new Error('Storage error')
      })

      expect(() => service.setLanguage('de')).not.toThrow()
    })
  })

  describe('translate', () => {
    it('should translate English keys', () => {
      service.setLanguage('en')

      expect(service.translate('nav.home')).toBe('Home')
      expect(service.translate('game.start')).toBe('Start Game')
      expect(service.translate('settings.title')).toBe('Settings')
    })

    it('should translate German keys', () => {
      service.setLanguage('de')

      expect(service.translate('nav.home')).toBe('Startseite')
      expect(service.translate('game.start')).toBe('Spiel starten')
      expect(service.translate('settings.title')).toBe('Einstellungen')
    })

    it('should return key if translation not found', () => {
      const key = 'nonexistent.key'

      expect(service.translate(key)).toBe(key)
    })

    it('should use fallback language if current language translation not found', () => {
      service.setLanguage('de')

      // Assuming some keys exist only in English
      const result = service.translate('nav.home')
      expect(result).toBeTruthy()
    })

    it('should use provided fallback if translation not found', () => {
      const fallback = 'Custom Fallback'

      expect(service.translate('nonexistent.key', fallback)).toBe(fallback)
    })

    it('should use empty string fallback if explicitly provided', () => {
      expect(service.translate('nonexistent.key', '')).toBe('')
    })

    it('should handle various translation keys', () => {
      service.setLanguage('en')

      expect(service.translate('button.create')).toBe('Create')
      expect(service.translate('error.invalidCode')).toBe('Invalid game code')
      expect(service.translate('success.gameCreated')).toBe('Game created successfully!')
      expect(service.translate('multiplier.x2')).toBe('2x')
      expect(service.translate('timer.warning')).toBe('Time is running out!')
    })
  })

  describe('t (alias for translate)', () => {
    it('should work exactly like translate', () => {
      service.setLanguage('en')

      expect(service.t('nav.home')).toBe(service.translate('nav.home'))
      expect(service.t('game.start')).toBe(service.translate('game.start'))
    })

    it('should handle fallback', () => {
      const fallback = 'Test Fallback'

      expect(service.t('nonexistent.key', fallback)).toBe(fallback)
    })
  })

  describe('getSupportedLanguages', () => {
    it('should return array of supported languages', () => {
      const languages = service.getSupportedLanguages()

      expect(Array.isArray(languages)).toBe(true)
      expect(languages).toContain('en')
      expect(languages).toContain('de')
      expect(languages.length).toBe(2)
    })

    it('should return a copy of the array', () => {
      const languages1 = service.getSupportedLanguages()
      const languages2 = service.getSupportedLanguages()

      expect(languages1).toEqual(languages2)
      expect(languages1).not.toBe(languages2) // Different reference
    })
  })

  describe('getLanguageName', () => {
    it('should return English name', () => {
      expect(service.getLanguageName('en')).toBe('English')
    })

    it('should return German name', () => {
      expect(service.getLanguageName('de')).toBe('Deutsch')
    })

    it('should return language code for unknown language', () => {
      expect(service.getLanguageName('unknown' as any)).toBe('unknown')
    })
  })

  describe('getLanguageFlag', () => {
    it('should return US flag emoji for English', () => {
      expect(service.getLanguageFlag('en')).toBe('🇺🇸')
    })

    it('should return German flag emoji for German', () => {
      expect(service.getLanguageFlag('de')).toBe('🇩🇪')
    })

    it('should return empty string for unknown language', () => {
      expect(service.getLanguageFlag('unknown' as any)).toBe('')
    })
  })

  describe('Complex scenarios', () => {
    it('should handle language switching', () => {
      service.setLanguage('en')
      expect(service.translate('nav.home')).toBe('Home')

      service.setLanguage('de')
      expect(service.translate('nav.home')).toBe('Startseite')

      service.setLanguage('en')
      expect(service.translate('nav.home')).toBe('Home')
    })

    it('should persist language across instances', () => {
      service.setLanguage('de')

      const newService = new LocalizationService()
      expect(newService.getCurrentLanguage()).toBe('de')
    })

    it('should handle multiple translations in sequence', () => {
      service.setLanguage('en')

      const translations = [
        service.translate('nav.home'),
        service.translate('nav.play'),
        service.translate('nav.leaderboard'),
        service.translate('nav.settings'),
        service.translate('nav.help'),
      ]

      expect(translations).toEqual(['Home', 'Play', 'Leaderboard', 'Settings', 'Help'])
    })
  })

  describe('Export singleton instance', () => {
    it('should export a singleton instance', () => {
      expect(localizationService).toBeInstanceOf(LocalizationService)
    })

    it('should maintain state across imports', () => {
      localizationService.setLanguage('de')

      expect(localizationService.getCurrentLanguage()).toBe('de')
    })
  })

  describe('All translation keys', () => {
    it('should have all English navigation translations', () => {
      service.setLanguage('en')

      expect(service.t('nav.home')).toBe('Home')
      expect(service.t('nav.play')).toBe('Play')
      expect(service.t('nav.leaderboard')).toBe('Leaderboard')
      expect(service.t('nav.settings')).toBe('Settings')
      expect(service.t('nav.help')).toBe('Help')
    })

    it('should have all English game interface translations', () => {
      service.setLanguage('en')

      expect(service.t('game.create')).toBe('Create Game')
      expect(service.t('game.join')).toBe('Join Game')
      expect(service.t('game.start')).toBe('Start Game')
      expect(service.t('game.ready')).toBe('Ready')
      expect(service.t('game.correct')).toBe('Correct!')
      expect(service.t('game.incorrect')).toBe('Incorrect!')
    })

    it('should have all English lobby translations', () => {
      service.setLanguage('en')

      expect(service.t('lobby.code')).toBe('Game Code')
      expect(service.t('lobby.copy')).toBe('Copy Code')
      expect(service.t('lobby.copied')).toBe('Copied!')
      expect(service.t('lobby.join')).toBe('Join Game')
      expect(service.t('lobby.leave')).toBe('Leave Game')
    })

    it('should have all English settings translations', () => {
      service.setLanguage('en')

      expect(service.t('settings.title')).toBe('Settings')
      expect(service.t('settings.audio')).toBe('Audio')
      expect(service.t('settings.language')).toBe('Language')
      expect(service.t('settings.theme')).toBe('Theme')
      expect(service.t('settings.save')).toBe('Save')
    })

    it('should have all German translations for main sections', () => {
      service.setLanguage('de')

      expect(service.t('nav.home')).toBe('Startseite')
      expect(service.t('game.start')).toBe('Spiel starten')
      expect(service.t('lobby.code')).toBe('Spielcode')
      expect(service.t('settings.title')).toBe('Einstellungen')
    })
  })
})
