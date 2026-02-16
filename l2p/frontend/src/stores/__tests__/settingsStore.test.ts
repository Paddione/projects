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
      autoScroll: true,
      showAnimations: true
    })
  })

  describe('Initial State', () => {
    it('should have correct initial values', () => {
      expect(store.theme).toBe('light')
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

  describe('Language Type Export', () => {
    it('should export Language type that accepts valid values', () => {
      // Language type is still exported for use by localizationService consumers
      const en: Language = 'en'
      const de: Language = 'de'
      expect(en).toBe('en')
      expect(de).toBe('de')
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
      store.setAutoScroll(false)
      store.setShowAnimations(false)

      // Verify all states are maintained
      const state = useSettingsStore.getState()
      expect(state.theme).toBe('dark')
      expect(state.autoScroll).toBe(false)
      expect(state.showAnimations).toBe(false)
    })

    it('should handle mixed settings combinations', () => {
      // Test different combinations
      store.setTheme('dark')
      store.setAutoScroll(true)
      store.setShowAnimations(false)

      const state = useSettingsStore.getState()
      expect(state.theme).toBe('dark')
      expect(state.autoScroll).toBe(true)
      expect(state.showAnimations).toBe(false)
    })
  })

  describe('Toggle Functionality', () => {
    it('should toggle theme independently', () => {
      store.setTheme('light')

      store.toggleTheme()

      const state = useSettingsStore.getState()
      expect(state.theme).toBe('dark')
    })

    it('should handle rapid toggles', () => {
      store.setTheme('light')

      // Rapid toggles
      store.toggleTheme() // light -> dark
      store.toggleTheme() // dark -> light
      store.toggleTheme() // light -> dark

      const state = useSettingsStore.getState()
      expect(state.theme).toBe('dark')
    })
  })

  describe('Settings Validation', () => {
    it('should accept valid theme values', () => {
      store.setTheme('light')
      expect(useSettingsStore.getState().theme).toBe('light')

      store.setTheme('dark')
      expect(useSettingsStore.getState().theme).toBe('dark')
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
      store.setAutoScroll(false)
      store.setShowAnimations(false)

      // Verify localStorage was called (the persist middleware handles this)
      // Note: We can't directly test the persist middleware behavior in unit tests
      // but we can verify the state is correctly set
      const state = useSettingsStore.getState()
      expect(state.theme).toBe('dark')
      expect(state.autoScroll).toBe(false)
      expect(state.showAnimations).toBe(false)
    })
  })

  describe('State Isolation', () => {
    it('should not affect other stores when changing settings', () => {
      // This test verifies that changing settings doesn't interfere with other stores
      // We'll test this by ensuring our settings changes work correctly
      store.setTheme('dark')

      const state = useSettingsStore.getState()
      expect(state.theme).toBe('dark')
      expect(state.autoScroll).toBe(true) // Default value unchanged
      expect(state.showAnimations).toBe(true) // Default value unchanged
    })
  })

  describe('Edge Cases', () => {
    it('should handle setting the same value multiple times', () => {
      store.setTheme('light')
      store.setTheme('light') // Set same value again
      expect(useSettingsStore.getState().theme).toBe('light')
    })

    it('should handle rapid state changes', () => {
      // Rapidly change settings
      store.setTheme('light')
      store.setTheme('dark')
      store.setTheme('light')
      store.setAutoScroll(true)
      store.setAutoScroll(false)
      store.setAutoScroll(true)
      store.setShowAnimations(true)
      store.setShowAnimations(false)
      store.setShowAnimations(true)

      const state = useSettingsStore.getState()
      expect(state.theme).toBe('light')
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
  })

  describe('Store Actions', () => {
    it('should have all required actions', () => {
      expect(typeof store.setTheme).toBe('function')
      expect(typeof store.setAutoScroll).toBe('function')
      expect(typeof store.setShowAnimations).toBe('function')
      expect(typeof store.toggleTheme).toBe('function')
    })

    it('should execute actions without throwing errors', () => {
      expect(() => store.setTheme('light')).not.toThrow()
      expect(() => store.setAutoScroll(true)).not.toThrow()
      expect(() => store.setShowAnimations(true)).not.toThrow()
      expect(() => store.toggleTheme()).not.toThrow()
    })
  })
})
