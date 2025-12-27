import { renderHook, act } from '@testing-library/react'
import { useLocalization } from '../useLocalization'

// Mock the localization service module
jest.mock('../../services/localization', () => {
  const mockGetCurrentLanguage = jest.fn()
  const mockSetLanguage = jest.fn()
  const mockTranslate = jest.fn()
  const mockGetSupportedLanguages = jest.fn()
  const mockGetLanguageName = jest.fn()
  const mockGetLanguageFlag = jest.fn()

  return {
    localizationService: {
      getCurrentLanguage: mockGetCurrentLanguage,
      setLanguage: mockSetLanguage,
      t: mockTranslate,
      translate: mockTranslate,
      getSupportedLanguages: mockGetSupportedLanguages,
      getLanguageName: mockGetLanguageName,
      getLanguageFlag: mockGetLanguageFlag
    }
  }
})

// Import the mocked module to get access to the mock functions
import { localizationService } from '../../services/localization'
const mockLocalizationService = localizationService as jest.Mocked<typeof localizationService>

describe('useLocalization Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    
    // Set up default mock implementations
    mockLocalizationService.getCurrentLanguage.mockReturnValue('en')
    mockLocalizationService.setLanguage.mockImplementation(() => {})
    mockLocalizationService.t.mockImplementation((key: string, fallback?: string) => {
      const translations: Record<string, Record<string, string>> = {
        en: {
          'nav.home': 'Home',
          'game.start': 'Start Game',
          'welcome': 'Welcome'
        },
        de: {
          'nav.home': 'Startseite',
          'game.start': 'Spiel starten',
          'welcome': 'Willkommen'
        }
      }
      
      const currentLang = 'en' // Simplified for testing
      return translations[currentLang]?.[key] || fallback || key
    })
    mockLocalizationService.getSupportedLanguages.mockReturnValue(['en', 'de'])
    mockLocalizationService.getLanguageName.mockImplementation((lang: string) => lang === 'en' ? 'English' : 'Deutsch')
    mockLocalizationService.getLanguageFlag.mockImplementation((lang: string) => lang === 'en' ? '🇺🇸' : '🇩🇪')
  })

  it('initializes without errors', () => {
    const { result } = renderHook(() => useLocalization())
    
    expect(result.current).toBeDefined()
  })

  it('provides current language', () => {
    const { result } = renderHook(() => useLocalization())
    
    expect(result.current.currentLanguage).toBe('en')
    expect(mockLocalizationService.getCurrentLanguage).toHaveBeenCalled()
  })

  it('provides supported languages', () => {
    const { result } = renderHook(() => useLocalization())
    
    const languages = result.current.getSupportedLanguages()
    expect(languages).toEqual(['en', 'de'])
    expect(mockLocalizationService.getSupportedLanguages).toHaveBeenCalled()
  })

  it('provides translation function', () => {
    const { result } = renderHook(() => useLocalization())
    
    const translation = result.current.t('welcome')
    expect(translation).toBe('Welcome')
    expect(mockLocalizationService.t).toHaveBeenCalledWith('welcome', undefined)
  })

  it('handles translation with fallback', () => {
    const { result } = renderHook(() => useLocalization())
    
    const translation = result.current.t('missing.key', 'Default Text')
    expect(translation).toBe('Default Text')
    expect(mockLocalizationService.t).toHaveBeenCalledWith('missing.key', 'Default Text')
  })

  it('provides language setter', () => {
    const { result } = renderHook(() => useLocalization())
    
    act(() => {
      result.current.setLanguage('de')
    })
    
    expect(mockLocalizationService.setLanguage).toHaveBeenCalledWith('de')
  })

  it('returns fallback for missing translations', () => {
    const { result } = renderHook(() => useLocalization())
    
    const translation = result.current.t('missing.key')
    expect(translation).toBe('missing.key')
    expect(mockLocalizationService.t).toHaveBeenCalledWith('missing.key', undefined)
  })

  it('provides language name helper', () => {
    const { result } = renderHook(() => useLocalization())
    
    const englishName = result.current.getLanguageName('en')
    const germanName = result.current.getLanguageName('de')
    
    expect(englishName).toBe('English')
    expect(germanName).toBe('Deutsch')
    expect(mockLocalizationService.getLanguageName).toHaveBeenCalledWith('en')
    expect(mockLocalizationService.getLanguageName).toHaveBeenCalledWith('de')
  })

  it('provides language flag helper', () => {
    const { result } = renderHook(() => useLocalization())
    
    const englishFlag = result.current.getLanguageFlag('en')
    const germanFlag = result.current.getLanguageFlag('de')
    
    expect(englishFlag).toBe('🇺🇸')
    expect(germanFlag).toBe('🇩🇪')
    expect(mockLocalizationService.getLanguageFlag).toHaveBeenCalledWith('en')
    expect(mockLocalizationService.getLanguageFlag).toHaveBeenCalledWith('de')
  })

  it('handles language change events', () => {
    const { result } = renderHook(() => useLocalization())
    
    // Test setting language triggers service call
    act(() => {
      result.current.setLanguage('de')
    })
    
    expect(mockLocalizationService.setLanguage).toHaveBeenCalledWith('de')
  })

  it('provides stable function references', () => {
    const { result, rerender } = renderHook(() => useLocalization())
    
    const firstRenderCallbacks = {
      setLanguage: result.current.setLanguage,
      t: result.current.t,
      getSupportedLanguages: result.current.getSupportedLanguages
    }
    
    rerender()
    
    expect(result.current.setLanguage).toBe(firstRenderCallbacks.setLanguage)
    expect(result.current.t).toBe(firstRenderCallbacks.t)
    expect(result.current.getSupportedLanguages).toBe(firstRenderCallbacks.getSupportedLanguages)
  })
}) 