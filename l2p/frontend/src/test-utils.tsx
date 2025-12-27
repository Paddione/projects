import React from 'react'
import { render, RenderOptions, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { BrowserRouter } from 'react-router-dom'
import { ThemeProvider } from './components/ThemeProvider'
import userEvent from '@testing-library/user-event'

// Mock the settings store for tests
jest.mock('./stores/settingsStore', () => ({
  useSettingsStore: () => ({
    theme: 'light',
    toggleTheme: jest.fn(),
    settings: {
      language: 'en',
      theme: 'light',
      soundEnabled: true,
      musicEnabled: true,
      notificationsEnabled: true
    },
    updateSettings: jest.fn()
  })
}))

// Mock CSS modules
jest.mock('./styles/AuthForm.module.css', () => ({
  authContainer: 'authContainer',
  authCard: 'authCard',
  header: 'header',
  form: 'form',
  inputGroup: 'inputGroup',
  input: 'input',
  button: 'button',
  primary: 'primary',
  linkButton: 'linkButton',
  switchMode: 'switchMode',
  successMessage: 'successMessage',
  passwordRequirements: 'passwordRequirements',
  valid: 'valid',
  invalid: 'invalid'
}))

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  route?: string
}

function AllTheProviders({ children }: { children: React.ReactNode }) {
  return (
    <BrowserRouter future={{
      v7_startTransition: true,
      v7_relativeSplatPath: true
    }}>
      <ThemeProvider>
        {children}
      </ThemeProvider>
    </BrowserRouter>
  )
}

const customRender = (
  ui: React.ReactElement,
  options: CustomRenderOptions = {}
) => {
  const { route = '/', ...renderOptions } = options

  // Set up the route if provided
  if (route !== '/') {
    window.history.pushState({}, 'Test page', route)
  }

  return render(ui, { wrapper: AllTheProviders, ...renderOptions })
}

// Enhanced userEvent setup with act() wrapping
const customUserEvent = userEvent.setup({
  advanceTimers: (ms) => {
    // Only advance timers if fake timers are in use
    try {
      // Check if fake timers are enabled by checking jest configuration
      if (jest.isMockFunction(setTimeout)) {
        jest.advanceTimersByTime(ms);
      }
    } catch {
      // Silently handle timer access errors in environments without fake timers
    }
  },
})

// Helper function to wrap async operations in act()
const actAsync = async (fn: () => Promise<void>) => {
  const { act } = await import('@testing-library/react')
  await act(async () => {
    await fn()
  })
}

// Helper function for common test patterns
const renderWithProviders = (
  ui: React.ReactElement,
  options: CustomRenderOptions = {}
) => {
  const result = customRender(ui, options)
  return {
    ...result,
    user: customUserEvent,
    actAsync,
    waitFor: (callback: () => void | Promise<void>) => waitFor(callback, { timeout: 5000 })
  }
}

// Re-export everything
export * from '@testing-library/react'

// Override render method
export { customRender as render, renderWithProviders, actAsync, customUserEvent as userEvent } 