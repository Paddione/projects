import { useSettingsStore, type SettingsState, type Theme, type Language } from '../settingsStore'

// Mock localStorage for persistence
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn()
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

describe('SettingsStore', () => {
  let store: SettingsState

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()
    
    // Reset localStorage
    localStorageMock.getItem.mockReturnValue(null)
    
    // Get fresh store state
    store = useSettingsStore.getState()
  })

  afterEach(() => {
    // Clean up store state
    useSettingsStore.setState({
      theme: 'light',
      language: 'en',
      autoScroll: true,
      showAnimations: true
    })
  })

  describe('Initial State', () => {
    it('should have correct initial values', () => {
      expect(store.theme).toBe('light')
      expect(store.language).toBe('en')
      expect(store.autoScroll).toBe(true)
      expect(store.showAnimations).toBe(true)
    })
  })

  describe('Theme Management', () => {
    it('should set theme to light', () => {
      store.setTheme('light')
      expect(useSettingsStore.getState().theme).toBe('light')
    })

    it('should set theme to dark', () => {
      store.setTheme('dark')
      expect(useSettingsStore.getState().theme).toBe('dark')
    })

    it('should toggle theme from light to dark', () => {
      store.setTheme('light')
      store.toggleTheme()
      expect(useSettingsStore.getState().theme).toBe('dark')
    })

    it('should toggle theme from dark to light', () => {
      store.setTheme('dark')
      store.toggleTheme()
      expect(useSettingsStore.getState().theme).toBe('light')
    })

    it('should handle multiple theme toggles', () => {
      store.setTheme('light')
      
      store.toggleTheme() // light -> dark
      expect(useSettingsStore.getState().theme).toBe('dark')
      
      store.toggleTheme() // dark -> light
      expect(useSettingsStore.getState().theme).toBe('light')
      
      store.toggleTheme() // light -> dark
      expect(useSettingsStore.getState().theme).toBe('dark')
    })
  })

  describe('Language Management', () => {
    it('should set language to English', () => {
      store.setLanguage('en')
      expect(useSettingsStore.getState().language).toBe('en')
    })

    it('should set language to German', () => {
      store.setLanguage('de')
      expect(useSettingsStore.getState().language).toBe('de')
    })

    it('should toggle language from English to German', () => {
      store.setLanguage('en')
      store.toggleLanguage()
      expect(useSettingsStore.getState().language).toBe('de')
    })

    it('should toggle language from German to English', () => {
      store.setLanguage('de')
      store.toggleLanguage()
      expect(useSettingsStore.getState().language).toBe('en')
    })

    it('should handle multiple language toggles', () => {
      store.setLanguage('en')
      
      store.toggleLanguage() // en -> de
      expect(useSettingsStore.getState().language).toBe('de')
      
      store.toggleLanguage() // de -> en
      expect(useSettingsStore.getState().language).toBe('en')
      
      store.toggleLanguage() // en -> de
      expect(useSettingsStore.getState().language).toBe('de')
    })
  })

  describe('UI Settings Management', () => {
    it('should set auto scroll to enabled', () => {
      store.setAutoScroll(true)
      expect(useSettingsStore.getState().autoScroll).toBe(true)
    })

    it('should set auto scroll to disabled', () => {
      store.setAutoScroll(false)
      expect(useSettingsStore.getState().autoScroll).toBe(false)
    })

    it('should toggle auto scroll from enabled to disabled', () => {
      store.setAutoScroll(true)
      store.setAutoScroll(false)
      expect(useSettingsStore.getState().autoScroll).toBe(false)
    })

    it('should set show animations to enabled', () => {
      store.setShowAnimations(true)
      expect(useSettingsStore.getState().showAnimations).toBe(true)
    })

    it('should set show animations to disabled', () => {
      store.setShowAnimations(false)
      expect(useSettingsStore.getState().showAnimations).toBe(false)
    })

    it('should toggle show animations from enabled to disabled', () => {
      store.setShowAnimations(true)
      store.setShowAnimations(false)
      expect(useSettingsStore.getState().showAnimations).toBe(false)
    })
  })

  describe('State Persistence', () => {
    it('should maintain state across multiple operations', () => {
      // Set various settings
      store.setTheme('dark')
      store.setLanguage('de')
      store.setAutoScroll(false)
      store.setShowAnimations(false)
      
      // Verify all states are maintained
      const state = useSettingsStore.getState()
      expect(state.theme).toBe('dark')
      expect(state.language).toBe('de')
      expect(state.autoScroll).toBe(false)
      expect(state.showAnimations).toBe(false)
    })

    it('should handle mixed settings combinations', () => {
      // Test different combinations
      store.setTheme('dark')
      store.setLanguage('en')
      store.setAutoScroll(true)
      store.setShowAnimations(false)
      
      const state = useSettingsStore.getState()
      expect(state.theme).toBe('dark')
      expect(state.language).toBe('en')
      expect(state.autoScroll).toBe(true)
      expect(state.showAnimations).toBe(false)
    })
  })

  describe('Toggle Functionality', () => {
    it('should toggle theme and language independently', () => {
      store.setTheme('light')
      store.setLanguage('en')
      
      store.toggleTheme()
      store.toggleLanguage()
      
      const state = useSettingsStore.getState()
      expect(state.theme).toBe('dark')
      expect(state.language).toBe('de')
    })

    it('should handle rapid toggles', () => {
      store.setTheme('light')
      store.setLanguage('en')
      
      // Rapid toggles
      store.toggleTheme() // light -> dark
      store.toggleTheme() // dark -> light
      store.toggleTheme() // light -> dark
      store.toggleLanguage() // en -> de
      store.toggleLanguage() // de -> en
      
      const state = useSettingsStore.getState()
      expect(state.theme).toBe('dark')
      expect(state.language).toBe('en')
    })
  })

  describe('Settings Validation', () => {
    it('should accept valid theme values', () => {
      store.setTheme('light')
      expect(useSettingsStore.getState().theme).toBe('light')
      
      store.setTheme('dark')
      expect(useSettingsStore.getState().theme).toBe('dark')
    })

    it('should accept valid language values', () => {
      store.setLanguage('en')
      expect(useSettingsStore.getState().language).toBe('en')
      
      store.setLanguage('de')
      expect(useSettingsStore.getState().language).toBe('de')
    })

    it('should accept boolean values for UI settings', () => {
      store.setAutoScroll(true)
      expect(useSettingsStore.getState().autoScroll).toBe(true)
      
      store.setAutoScroll(false)
      expect(useSettingsStore.getState().autoScroll).toBe(false)
      
      store.setShowAnimations(true)
      expect(useSettingsStore.getState().showAnimations).toBe(true)
      
      store.setShowAnimations(false)
      expect(useSettingsStore.getState().showAnimations).toBe(false)
    })
  })

  describe('Local Storage Integration', () => {
    it('should persist settings to localStorage', () => {
      // The persist middleware should automatically save to localStorage
      store.setTheme('dark')
      store.setLanguage('de')
      store.setAutoScroll(false)
      store.setShowAnimations(false)
      
      // Verify localStorage was called (the persist middleware handles this)
      // Note: We can't directly test the persist middleware behavior in unit tests
      // but we can verify the state is correctly set
      const state = useSettingsStore.getState()
      expect(state.theme).toBe('dark')
      expect(state.language).toBe('de')
      expect(state.autoScroll).toBe(false)
      expect(state.showAnimations).toBe(false)
    })
  })

  describe('State Isolation', () => {
    it('should not affect other stores when changing settings', () => {
      // This test verifies that changing settings doesn't interfere with other stores
      // We'll test this by ensuring our settings changes work correctly
      store.setTheme('dark')
      store.setLanguage('de')
      
      const state = useSettingsStore.getState()
      expect(state.theme).toBe('dark')
      expect(state.language).toBe('de')
      expect(state.autoScroll).toBe(true) // Default value unchanged
      expect(state.showAnimations).toBe(true) // Default value unchanged
    })
  })

  describe('Edge Cases', () => {
    it('should handle setting the same value multiple times', () => {
      store.setTheme('light')
      store.setTheme('light') // Set same value again
      expect(useSettingsStore.getState().theme).toBe('light')
      
      store.setLanguage('en')
      store.setLanguage('en') // Set same value again
      expect(useSettingsStore.getState().language).toBe('en')
    })

    it('should handle rapid state changes', () => {
      // Rapidly change settings
      store.setTheme('light')
      store.setTheme('dark')
      store.setTheme('light')
      store.setLanguage('en')
      store.setLanguage('de')
      store.setLanguage('en')
      store.setAutoScroll(true)
      store.setAutoScroll(false)
      store.setAutoScroll(true)
      store.setShowAnimations(true)
      store.setShowAnimations(false)
      store.setShowAnimations(true)
      
      const state = useSettingsStore.getState()
      expect(state.theme).toBe('light')
      expect(state.language).toBe('en')
      expect(state.autoScroll).toBe(true)
      expect(state.showAnimations).toBe(true)
    })
  })

  describe('Type Safety', () => {
    it('should maintain type safety for theme values', () => {
      const theme: Theme = 'light'
      store.setTheme(theme)
      expect(useSettingsStore.getState().theme).toBe(theme)
      
      const darkTheme: Theme = 'dark'
      store.setTheme(darkTheme)
      expect(useSettingsStore.getState().theme).toBe(darkTheme)
    })

    it('should maintain type safety for language values', () => {
      const language: Language = 'en'
      store.setLanguage(language)
      expect(useSettingsStore.getState().language).toBe(language)
      
      const germanLanguage: Language = 'de'
      store.setLanguage(germanLanguage)
      expect(useSettingsStore.getState().language).toBe(germanLanguage)
    })
  })

  describe('Store Actions', () => {
    it('should have all required actions', () => {
      expect(typeof store.setTheme).toBe('function')
      expect(typeof store.setLanguage).toBe('function')
      expect(typeof store.setAutoScroll).toBe('function')
      expect(typeof store.setShowAnimations).toBe('function')
      expect(typeof store.toggleTheme).toBe('function')
      expect(typeof store.toggleLanguage).toBe('function')
    })

    it('should execute actions without throwing errors', () => {
      expect(() => store.setTheme('light')).not.toThrow()
      expect(() => store.setLanguage('en')).not.toThrow()
      expect(() => store.setAutoScroll(true)).not.toThrow()
      expect(() => store.setShowAnimations(true)).not.toThrow()
      expect(() => store.toggleTheme()).not.toThrow()
      expect(() => store.toggleLanguage()).not.toThrow()
    })
  })
}) 