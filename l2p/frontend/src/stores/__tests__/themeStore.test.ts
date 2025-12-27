import { useThemeStore, type ThemeState, type Theme } from '../themeStore'

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

// Mock matchMedia for system theme detection
const matchMediaMock = jest.fn()
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: matchMediaMock
})

// Mock document methods
const documentMock = {
  documentElement: {
    setAttribute: jest.fn(),
    getAttribute: jest.fn()
  },
  querySelector: jest.fn(),
  querySelectorAll: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn()
}
Object.defineProperty(window, 'document', {
  value: documentMock
})

describe('ThemeStore', () => {
  let store: ThemeState
  let mockMetaThemeColor: Record<string, unknown>

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()
    
    // Reset localStorage
    localStorageMock.getItem.mockReturnValue(null)
    
    // Setup mock meta theme-color element
    mockMetaThemeColor = {
      setAttribute: jest.fn()
    }
    documentMock.querySelector.mockReturnValue(mockMetaThemeColor)
    
    // Setup default matchMedia mock
    matchMediaMock.mockReturnValue({
      matches: false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    })
    
    // Mock window properties that might be accessed
    Object.defineProperty(window, 'addEventListener', {
      value: jest.fn(),
      writable: true
    })
    
    Object.defineProperty(window, 'removeEventListener', {
      value: jest.fn(),
      writable: true
    })
    
    // Get fresh store state
    store = useThemeStore.getState()
  })

  afterEach(() => {
    // Clean up store state
    useThemeStore.setState({
      theme: 'auto',
      isDark: false
    })
  })

  describe('Initial State', () => {
    it('should have correct initial values', () => {
      expect(store.theme).toBe('auto')
      expect(store.isDark).toBe(false)
    })
  })

  describe('Theme Management', () => {
    it('should set theme to light', () => {
      store.setTheme('light')
      const state = useThemeStore.getState()
      expect(state.theme).toBe('light')
      expect(state.isDark).toBe(false)
    })

    it('should set theme to dark', () => {
      store.setTheme('dark')
      const state = useThemeStore.getState()
      expect(state.theme).toBe('dark')
      expect(state.isDark).toBe(true)
    })

    it('should set theme to auto', () => {
      store.setTheme('auto')
      const state = useThemeStore.getState()
      expect(state.theme).toBe('auto')
    })

    it('should toggle theme from light to dark', () => {
      store.setTheme('light')
      store.toggleTheme()
      const state = useThemeStore.getState()
      expect(state.theme).toBe('dark')
      expect(state.isDark).toBe(true)
    })

    it('should toggle theme from dark to light', () => {
      store.setTheme('dark')
      store.toggleTheme()
      const state = useThemeStore.getState()
      expect(state.theme).toBe('light')
      expect(state.isDark).toBe(false)
    })

    it('should handle multiple theme toggles', () => {
      store.setTheme('light')
      
      store.toggleTheme() // light -> dark
      expect(useThemeStore.getState().theme).toBe('dark')
      expect(useThemeStore.getState().isDark).toBe(true)
      
      store.toggleTheme() // dark -> light
      expect(useThemeStore.getState().theme).toBe('light')
      expect(useThemeStore.getState().isDark).toBe(false)
      
      store.toggleTheme() // light -> dark
      expect(useThemeStore.getState().theme).toBe('dark')
      expect(useThemeStore.getState().isDark).toBe(true)
    })
  })

  describe('System Theme Detection', () => {
    it('should detect light system theme', () => {
      matchMediaMock.mockReturnValue({
        matches: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      })
      
      const systemTheme = store.getSystemTheme()
      expect(systemTheme).toBe('light')
    })

    it('should detect dark system theme', () => {
      matchMediaMock.mockReturnValue({
        matches: true,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      })
      
      const systemTheme = store.getSystemTheme()
      expect(systemTheme).toBe('dark')
    })

    it('should handle auto theme with light system preference', () => {
      matchMediaMock.mockReturnValue({
        matches: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      })
      
      store.setTheme('auto')
      const state = useThemeStore.getState()
      expect(state.theme).toBe('auto')
      expect(state.isDark).toBe(false)
    })

    it('should handle auto theme with dark system preference', () => {
      matchMediaMock.mockReturnValue({
        matches: true,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      })
      
      store.setTheme('auto')
      const state = useThemeStore.getState()
      expect(state.theme).toBe('auto')
      expect(state.isDark).toBe(true)
    })
  })

  describe('DOM Manipulation', () => {
    it('should set data-theme attribute on document root for light theme', () => {
      store.setTheme('light')
      
      expect(documentMock.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'light')
    })

    it('should set data-theme attribute on document root for dark theme', () => {
      store.setTheme('dark')
      
      expect(documentMock.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark')
    })

    it('should set data-theme attribute for auto theme based on system preference', () => {
      matchMediaMock.mockReturnValue({
        matches: true, // Dark system theme
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      })
      
      store.setTheme('auto')
      
      expect(documentMock.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark')
    })

    it('should update meta theme-color for light theme', () => {
      store.setTheme('light')
      
      expect(mockMetaThemeColor.setAttribute).toHaveBeenCalledWith('content', '#ffffff')
    })

    it('should update meta theme-color for dark theme', () => {
      store.setTheme('dark')
      
      expect(mockMetaThemeColor.setAttribute).toHaveBeenCalledWith('content', '#0f172a')
    })

    it('should update meta theme-color for auto theme with light system preference', () => {
      matchMediaMock.mockReturnValue({
        matches: false, // Light system theme
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      })
      
      store.setTheme('auto')
      
      expect(mockMetaThemeColor.setAttribute).toHaveBeenCalledWith('content', '#ffffff')
    })

    it('should update meta theme-color for auto theme with dark system preference', () => {
      matchMediaMock.mockReturnValue({
        matches: true, // Dark system theme
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      })
      
      store.setTheme('auto')
      
      expect(mockMetaThemeColor.setAttribute).toHaveBeenCalledWith('content', '#0f172a')
    })
  })

  describe('Theme Persistence', () => {
    it('should maintain theme state across operations', () => {
      store.setTheme('dark')
      store.setTheme('light')
      store.setTheme('auto')
      
      const state = useThemeStore.getState()
      expect(state.theme).toBe('auto')
    })

    it('should handle mixed theme operations', () => {
      store.setTheme('light')
      store.toggleTheme() // light -> dark
      store.setTheme('auto')
      
      const state = useThemeStore.getState()
      expect(state.theme).toBe('auto')
    })
  })

  describe('State Synchronization', () => {
    it('should sync isDark state with theme changes', () => {
      store.setTheme('light')
      expect(useThemeStore.getState().isDark).toBe(false)
      
      store.setTheme('dark')
      expect(useThemeStore.getState().isDark).toBe(true)
      
      store.setTheme('light')
      expect(useThemeStore.getState().isDark).toBe(false)
    })

    it('should sync isDark state with auto theme and system preference', () => {
      matchMediaMock.mockReturnValue({
        matches: false, // Light system theme
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      })
      
      store.setTheme('auto')
      expect(useThemeStore.getState().isDark).toBe(false)
      
      matchMediaMock.mockReturnValue({
        matches: true, // Dark system theme
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      })
      
      store.setTheme('auto')
      expect(useThemeStore.getState().isDark).toBe(true)
    })
  })

  describe('Error Handling', () => {
    it('should handle missing meta theme-color element', () => {
      documentMock.querySelector.mockReturnValue(null)
      
      expect(() => store.setTheme('light')).not.toThrow()
      expect(() => store.setTheme('dark')).not.toThrow()
      expect(() => store.setTheme('auto')).not.toThrow()
    })
  })

  describe('Edge Cases', () => {
    it('should handle setting the same theme multiple times', () => {
      store.setTheme('light')
      store.setTheme('light') // Set same theme again
      expect(useThemeStore.getState().theme).toBe('light')
      expect(useThemeStore.getState().isDark).toBe(false)
    })

    it('should handle rapid theme changes', () => {
      store.setTheme('light')
      store.setTheme('dark')
      store.setTheme('auto')
      store.setTheme('light')
      store.setTheme('dark')
      
      const state = useThemeStore.getState()
      expect(state.theme).toBe('dark')
      expect(state.isDark).toBe(true)
    })

    it('should handle rapid toggles', () => {
      store.setTheme('light')
      store.toggleTheme() // light -> dark
      store.toggleTheme() // dark -> light
      store.toggleTheme() // light -> dark
      store.toggleTheme() // dark -> light
      
      const state = useThemeStore.getState()
      expect(state.theme).toBe('light')
      expect(state.isDark).toBe(false)
    })
  })

  describe('Type Safety', () => {
    it('should maintain type safety for theme values', () => {
      const lightTheme: Theme = 'light'
      store.setTheme(lightTheme)
      expect(useThemeStore.getState().theme).toBe(lightTheme)
      
      const darkTheme: Theme = 'dark'
      store.setTheme(darkTheme)
      expect(useThemeStore.getState().theme).toBe(darkTheme)
      
      const autoTheme: Theme = 'auto'
      store.setTheme(autoTheme)
      expect(useThemeStore.getState().theme).toBe(autoTheme)
    })
  })

  describe('Store Actions', () => {
    it('should have all required actions', () => {
      expect(typeof store.setTheme).toBe('function')
      expect(typeof store.toggleTheme).toBe('function')
      expect(typeof store.getSystemTheme).toBe('function')
    })

    it('should execute actions without throwing errors', () => {
      expect(() => store.setTheme('light')).not.toThrow()
      expect(() => store.setTheme('dark')).not.toThrow()
      expect(() => store.setTheme('auto')).not.toThrow()
      expect(() => store.toggleTheme()).not.toThrow()
      expect(() => store.getSystemTheme()).not.toThrow()
    })
  })

  describe('System Theme Change Handling', () => {
    it('should handle system theme changes when using auto theme', () => {
      // Mock the event listener
      const mockAddEventListener = jest.fn()
      matchMediaMock.mockReturnValue({
        matches: false, // Start with light system theme
        addEventListener: mockAddEventListener,
        removeEventListener: jest.fn()
      })
      
      store.setTheme('auto')
      expect(useThemeStore.getState().isDark).toBe(false)
      
      // Simulate system theme change to dark
      matchMediaMock.mockReturnValue({
        matches: true, // Now dark system theme
        addEventListener: mockAddEventListener,
        removeEventListener: jest.fn()
      })
      
      // The store should handle this automatically, but we can test the getSystemTheme function
      expect(store.getSystemTheme()).toBe('dark')
    })
  })

  describe('Meta Theme Color Updates', () => {
    it('should update meta theme-color for all theme combinations', () => {
      // Test light theme
      store.setTheme('light')
      expect(mockMetaThemeColor.setAttribute).toHaveBeenCalledWith('content', '#ffffff')
      
      // Test dark theme
      store.setTheme('dark')
      expect(mockMetaThemeColor.setAttribute).toHaveBeenCalledWith('content', '#0f172a')
      
      // Test auto theme with light system preference
      matchMediaMock.mockReturnValue({
        matches: false,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      })
      store.setTheme('auto')
      expect(mockMetaThemeColor.setAttribute).toHaveBeenCalledWith('content', '#ffffff')
      
      // Test auto theme with dark system preference
      matchMediaMock.mockReturnValue({
        matches: true,
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      })
      store.setTheme('auto')
      expect(mockMetaThemeColor.setAttribute).toHaveBeenCalledWith('content', '#0f172a')
    })
  })
}) 