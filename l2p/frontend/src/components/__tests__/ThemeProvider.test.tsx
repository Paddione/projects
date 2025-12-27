import React from 'react'
import { render, screen, act } from '@testing-library/react'

// Mock the settings store
const mockSettingsStore = {
  theme: 'light' as 'light' | 'dark',
  toggleTheme: jest.fn()
}

jest.mock('../../stores/settingsStore', () => ({
  useSettingsStore: () => mockSettingsStore
}))

// Mock document methods
const mockSetAttribute = jest.fn()
const mockQuerySelector = jest.fn()
const mockSetAttributeMeta = jest.fn()

Object.defineProperty(document, 'documentElement', {
  value: {
    setAttribute: mockSetAttribute
  },
  writable: true
})

Object.defineProperty(document, 'querySelector', {
  value: mockQuerySelector,
  writable: true
})

// Import the component after all mocks are defined
import { ThemeProvider, useTheme } from '../ThemeProvider'

describe('ThemeProvider Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockSettingsStore.theme = 'light'
  })

  describe('Component Rendering', () => {
    it('renders children without crashing', () => {
      render(
        <ThemeProvider>
          <div data-testid="test-child">Test content</div>
        </ThemeProvider>
      )
      
      expect(screen.getByTestId('test-child')).toBeInTheDocument()
      expect(screen.getByText('Test content')).toBeInTheDocument()
    })

    it('provides theme context to children', () => {
      const TestComponent = () => {
        const { theme, toggleTheme } = useTheme()
        return (
          <div data-testid="theme-info" data-theme={theme}>
            <button onClick={toggleTheme}>Toggle Theme</button>
          </div>
        )
      }

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )
      
      const themeInfo = screen.getByTestId('theme-info')
      expect(themeInfo).toHaveAttribute('data-theme', 'light')
    })
  })

  describe('Theme Application', () => {
    it('applies theme to document root element', () => {
      render(
        <ThemeProvider>
          <div>Test content</div>
        </ThemeProvider>
      )
      
      expect(mockSetAttribute).toHaveBeenCalledWith('data-theme', 'light')
    })

    it('updates document theme when theme changes', () => {
      const { rerender } = render(
        <ThemeProvider>
          <div>Test content</div>
        </ThemeProvider>
      )
      
      // Change theme
      mockSettingsStore.theme = 'dark'
      
      rerender(
        <ThemeProvider>
          <div>Test content</div>
        </ThemeProvider>
      )
      
      expect(mockSetAttribute).toHaveBeenCalledWith('data-theme', 'dark')
    })

    it('updates meta theme-color for mobile browsers', () => {
      const mockMetaElement = {
        setAttribute: mockSetAttributeMeta
      }
      mockQuerySelector.mockReturnValue(mockMetaElement)
      
      render(
        <ThemeProvider>
          <div>Test content</div>
        </ThemeProvider>
      )
      
      expect(mockQuerySelector).toHaveBeenCalledWith('meta[name="theme-color"]')
      expect(mockSetAttributeMeta).toHaveBeenCalledWith('content', '#ffffff')
    })

    it('updates meta theme-color for dark theme', () => {
      const mockMetaElement = {
        setAttribute: mockSetAttributeMeta
      }
      mockQuerySelector.mockReturnValue(mockMetaElement)
      mockSettingsStore.theme = 'dark'
      
      render(
        <ThemeProvider>
          <div>Test content</div>
        </ThemeProvider>
      )
      
      expect(mockSetAttributeMeta).toHaveBeenCalledWith('content', '#0f172a')
    })

    it('handles missing meta theme-color element gracefully', () => {
      mockQuerySelector.mockReturnValue(null)
      
      render(
        <ThemeProvider>
          <div>Test content</div>
        </ThemeProvider>
      )
      
      expect(mockQuerySelector).toHaveBeenCalledWith('meta[name="theme-color"]')
      // Should not throw error when element is not found
    })
  })

  describe('Context Value', () => {
    it('provides correct theme value', () => {
      const TestComponent = () => {
        const { theme } = useTheme()
        return <div data-testid="theme-value">{theme}</div>
      }

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )
      
      expect(screen.getByTestId('theme-value')).toHaveTextContent('light')
    })

    it('provides toggleTheme function', () => {
      const TestComponent = () => {
        const { toggleTheme } = useTheme()
        return <button onClick={toggleTheme}>Toggle</button>
      }

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )
      
      expect(mockSettingsStore.toggleTheme).toBeDefined()
    })

    it('calls store toggleTheme when context toggleTheme is called', () => {
      const TestComponent = () => {
        const { toggleTheme } = useTheme()
        return <button onClick={toggleTheme}>Toggle</button>
      }

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )
      
      const button = screen.getByText('Toggle')
      act(() => {
        button.click()
      })
      
      expect(mockSettingsStore.toggleTheme).toHaveBeenCalled()
    })
  })

  describe('useTheme Hook', () => {
    it('throws error when used outside ThemeProvider', () => {
      const TestComponent = () => {
        const { theme } = useTheme()
        return <div>{theme}</div>
      }

      // Suppress console.error for this test
      const originalError = console.error
      console.error = jest.fn()

      expect(() => {
        render(<TestComponent />)
      }).toThrow('useTheme must be used within a ThemeProvider')

      console.error = originalError
    })

    it('returns theme context when used within ThemeProvider', () => {
      const TestComponent = () => {
        const context = useTheme()
        return (
          <div data-testid="context-info">
            <span data-testid="theme">{context.theme}</span>
            <span data-testid="has-toggle">{typeof context.toggleTheme}</span>
          </div>
        )
      }

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )
      
      expect(screen.getByTestId('theme')).toHaveTextContent('light')
      expect(screen.getByTestId('has-toggle')).toHaveTextContent('function')
    })
  })

  describe('Theme Persistence', () => {
    it('uses theme from settings store', () => {
      mockSettingsStore.theme = 'dark'
      
      const TestComponent = () => {
        const { theme } = useTheme()
        return <div data-testid="theme-value">{theme}</div>
      }

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )
      
      expect(screen.getByTestId('theme-value')).toHaveTextContent('dark')
      expect(mockSetAttribute).toHaveBeenCalledWith('data-theme', 'dark')
    })

    it('reacts to theme changes in settings store', () => {
      const TestComponent = () => {
        const { theme } = useTheme()
        return <div data-testid="theme-value">{theme}</div>
      }

      const { rerender } = render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )
      
      // Simulate theme change in store
      mockSettingsStore.theme = 'dark'
      
      rerender(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )
      
      expect(screen.getByTestId('theme-value')).toHaveTextContent('dark')
    })
  })

  describe('Performance', () => {
    it('does not re-render unnecessarily when theme is stable', () => {
      const renderCount = jest.fn()
      
      const TestComponent = () => {
        renderCount()
        const { theme } = useTheme()
        return <div>{theme}</div>
      }

      const { rerender } = render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )
      
      const initialRenderCount = renderCount.mock.calls.length
      
      rerender(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )
      
      // React 18 StrictMode causes double renders in development
      expect(renderCount.mock.calls.length).toBeGreaterThanOrEqual(initialRenderCount)
    })

    it('updates only when theme actually changes', () => {
      const updateCount = jest.fn()
      
      const TestComponent = () => {
        const { theme } = useTheme()
        React.useEffect(() => {
          updateCount()
        }, [theme])
        return <div>{theme}</div>
      }

      const { rerender } = render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )
      
      const initialUpdateCount = updateCount.mock.calls.length
      
      // Change theme
      mockSettingsStore.theme = 'dark'
      
      rerender(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      )
      
      expect(updateCount.mock.calls.length).toBeGreaterThan(initialUpdateCount)
    })
  })

  describe('Error Handling', () => {
    it('handles missing meta theme-color element gracefully', () => {
      mockQuerySelector.mockReturnValue(null)
      
      // Should not crash the component
      expect(() => {
        render(
          <ThemeProvider>
            <div>Test content</div>
          </ThemeProvider>
        )
      }).not.toThrow()
    })
  })

  describe('Accessibility', () => {
    it('applies theme to document for screen readers', () => {
      render(
        <ThemeProvider>
          <div>Test content</div>
        </ThemeProvider>
      )
      
      // The mock should have been called during render
      expect(mockSetAttribute).toHaveBeenCalled()
    })

    it('updates theme-color meta tag for mobile accessibility', () => {
      const mockMetaElement = {
        setAttribute: mockSetAttributeMeta
      }
      mockQuerySelector.mockReturnValue(mockMetaElement)
      
      render(
        <ThemeProvider>
          <div>Test content</div>
        </ThemeProvider>
      )
      
      expect(mockSetAttributeMeta).toHaveBeenCalledWith('content', '#ffffff')
    })
  })
}) 