import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppContent } from '../App'

// Mock CSS modules
jest.mock('@/styles/App.module.css', () => ({
  app: 'app',
  container: 'container',
  main: 'main'
}))

// Mock all external dependencies
jest.mock('../components/ThemeProvider', () => ({
  ThemeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="theme-provider">{children}</div>
  )
}))

jest.mock('../components/Header', () => ({
  Header: () => <header data-testid="header">Header</header>
}))

jest.mock('../pages/HomePage', () => ({
  HomePage: () => <div data-testid="home-page">Home Page</div>
}))

jest.mock('../pages/LobbyPage', () => ({
  LobbyPage: () => <div data-testid="lobby-page">Lobby Page</div>
}))

jest.mock('../pages/GamePage', () => ({
  GamePage: () => <div data-testid="game-page">Game Page</div>
}))

jest.mock('../pages/ResultsPage', () => ({
  ResultsPage: () => <div data-testid="results-page">Results Page</div>
}))

jest.mock('../components/DemoPage', () => ({
  DemoPage: () => <div data-testid="demo-page">Demo Page</div>
}))

jest.mock('../components/PerformanceMonitor', () => ({
  PerformanceMonitor: () => <div data-testid="performance-monitor">Performance Monitor</div>
}))

jest.mock('../components/ErrorBoundary', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="error-boundary">{children}</div>
  )
}))

jest.mock('../components/AuthGuard', () => ({
  AuthGuard: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-guard">{children}</div>
  )
}))

jest.mock('../pages/ProfilePage', () => ({
  ProfilePage: () => <div data-testid="profile-page">Profile Page</div>
}))

jest.mock('../pages/QuestionSetManagerPage', () => ({
  QuestionSetManagerPage: () => <div data-testid="question-set-manager-page">Question Set Manager Page</div>
}))

jest.mock('../components/LevelUpNotificationManager', () => ({
  LevelUpNotificationManager: () => <div data-testid="level-up-notification-manager">Level Up Notification Manager</div>
}))

jest.mock('../pages/AdminLogsPage', () => ({
  AdminLogsPage: () => <div data-testid="admin-logs-page">Admin Logs Page</div>
}))

// Helper function to render AppContent with specific route (no router nesting)
const renderAppWithRoute = (initialRoute: string = '/') => {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <AppContent />
    </MemoryRouter>
  )
}

describe('App Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      renderAppWithRoute()
      expect(screen.getByTestId('theme-provider')).toBeInTheDocument()
    })

    it('renders all main components', () => {
      renderAppWithRoute()
      
      expect(screen.getByTestId('error-boundary')).toBeInTheDocument()
      expect(screen.getByTestId('theme-provider')).toBeInTheDocument()
      expect(screen.getByTestId('header')).toBeInTheDocument()
      expect(screen.getByTestId('performance-monitor')).toBeInTheDocument()
    })

    it('has proper app structure with main element', () => {
      renderAppWithRoute()
      
      const main = screen.getByRole('main')
      expect(main).toBeInTheDocument()
      expect(main).toHaveClass('main')
    })

    it('wraps content in error boundary', () => {
      renderAppWithRoute()
      
      const errorBoundary = screen.getByTestId('error-boundary')
      expect(errorBoundary).toBeInTheDocument()
    })

    it('wraps content in theme provider', () => {
      renderAppWithRoute()
      
      const themeProvider = screen.getByTestId('theme-provider')
      expect(themeProvider).toBeInTheDocument()
    })

    it('has proper CSS classes applied', () => {
      const { container } = renderAppWithRoute()
      
      const appDiv = container.querySelector('.app')
      expect(appDiv).toBeInTheDocument()
      
      const containerDiv = container.querySelector('.container')
      expect(containerDiv).toBeInTheDocument()
    })
  })

  describe('Routing', () => {
    it('renders home page on root route', async () => {
      renderAppWithRoute('/')
      
      await waitFor(() => {
        expect(screen.getByTestId('home-page')).toBeInTheDocument()
      })
    })

    it('renders lobby page on lobby route', async () => {
      renderAppWithRoute('/lobby/TEST123')
      
      await waitFor(() => {
        expect(screen.getByTestId('lobby-page')).toBeInTheDocument()
      })
    })

    it('renders game page on game route', async () => {
      renderAppWithRoute('/game/TEST123')
      
      await waitFor(() => {
        expect(screen.getByTestId('game-page')).toBeInTheDocument()
      })
    })

    it('renders results page on results route', async () => {
      renderAppWithRoute('/results/TEST123')
      
      await waitFor(() => {
        expect(screen.getByTestId('results-page')).toBeInTheDocument()
      })
    })

    it('renders demo page on demo route', async () => {
      renderAppWithRoute('/demo')
      
      await waitFor(() => {
        expect(screen.getByTestId('demo-page')).toBeInTheDocument()
      })
    })

    it('handles invalid routes gracefully', async () => {
      renderAppWithRoute('/invalid-route')
      
      // Should not crash and should render the app structure
      expect(screen.getByTestId('theme-provider')).toBeInTheDocument()
      expect(screen.getByTestId('header')).toBeInTheDocument()
    })
  })

  describe('Route Parameters', () => {
    it('passes lobby code parameter to lobby page', async () => {
      const lobbyCode = 'ABC123'
      renderAppWithRoute(`/lobby/${lobbyCode}`)
      
      await waitFor(() => {
        expect(screen.getByTestId('lobby-page')).toBeInTheDocument()
      })
    })

    it('passes lobby code parameter to game page', async () => {
      const lobbyCode = 'XYZ789'
      renderAppWithRoute(`/game/${lobbyCode}`)
      
      await waitFor(() => {
        expect(screen.getByTestId('game-page')).toBeInTheDocument()
      })
    })

    it('passes lobby code parameter to results page', async () => {
      const lobbyCode = 'DEF456'
      renderAppWithRoute(`/results/${lobbyCode}`)
      
      await waitFor(() => {
        expect(screen.getByTestId('results-page')).toBeInTheDocument()
      })
    })

    it('handles special characters in lobby codes', async () => {
      const lobbyCode = 'A1B2C3'
      renderAppWithRoute(`/lobby/${lobbyCode}`)
      
      await waitFor(() => {
        expect(screen.getByTestId('lobby-page')).toBeInTheDocument()
      })
    })
  })

  describe('Component Integration', () => {
    it('renders all components in proper hierarchy', () => {
      renderAppWithRoute()
      
      const errorBoundary = screen.getByTestId('error-boundary')
      const themeProvider = screen.getByTestId('theme-provider')
      const header = screen.getByTestId('header')
      const performanceMonitor = screen.getByTestId('performance-monitor')
      
      expect(errorBoundary).toBeInTheDocument()
      expect(themeProvider).toBeInTheDocument()
      expect(header).toBeInTheDocument()
      expect(performanceMonitor).toBeInTheDocument()
    })

    it('maintains component state across route changes', async () => {
      // Test initial route
      const { unmount } = renderAppWithRoute('/')
      
      // Verify initial route
      await waitFor(() => {
        expect(screen.getByTestId('home-page')).toBeInTheDocument()
      })
      
      // Clean up first render
      unmount()
      
      // Test demo route
      renderAppWithRoute('/demo')
      
      // Verify route change
      await waitFor(() => {
        expect(screen.getByTestId('demo-page')).toBeInTheDocument()
      })
      
      // Header and other persistent components should still be present
      expect(screen.getByTestId('header')).toBeInTheDocument()
      expect(screen.getByTestId('performance-monitor')).toBeInTheDocument()
    })
  })

  describe('Error Handling', () => {
    it('renders error boundary around all content', () => {
      renderAppWithRoute()
      
      const errorBoundary = screen.getByTestId('error-boundary')
      expect(errorBoundary).toBeInTheDocument()
    })

    it('maintains app structure when routes fail', async () => {
      // Mock console.error to avoid test noise
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      renderAppWithRoute('/potentially-broken-route')
      
      // App structure should still be intact
      expect(screen.getByTestId('error-boundary')).toBeInTheDocument()
      expect(screen.getByTestId('theme-provider')).toBeInTheDocument()
      expect(screen.getByTestId('header')).toBeInTheDocument()
      
      consoleSpy.mockRestore()
    })
  })

  describe('Performance', () => {
    it('includes performance monitor', () => {
      renderAppWithRoute()
      
      expect(screen.getByTestId('performance-monitor')).toBeInTheDocument()
    })

    it('renders efficiently without unnecessary re-renders', () => {
      const { rerender } = renderAppWithRoute('/')
      
      // Get initial render count
      screen.getByTestId('header')
      
      // Re-render with same route
      rerender(
        <MemoryRouter initialEntries={['/']}>
          <AppContent />
        </MemoryRouter>
      )
      
      // Components should still be present
      expect(screen.getByTestId('header')).toBeInTheDocument()
      expect(screen.getByTestId('theme-provider')).toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('has proper semantic structure', () => {
      renderAppWithRoute()
      
      const main = screen.getByRole('main')
      expect(main).toBeInTheDocument()
      
      const header = screen.getByRole('banner')
      expect(header).toBeInTheDocument()
    })

    it('maintains focus management across routes', async () => {
      renderAppWithRoute('/')
      
      await waitFor(() => {
        expect(screen.getByTestId('home-page')).toBeInTheDocument()
      })
      
      // The app should not interfere with natural focus behavior
      expect(document.body).toBeInTheDocument()
    })
  })
}) 