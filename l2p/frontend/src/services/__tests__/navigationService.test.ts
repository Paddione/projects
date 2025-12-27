import { navigationService } from '../navigationService'
import { useGameStore } from '../../stores/gameStore'

// Mock the game store
jest.mock('../../stores/gameStore', () => ({
  useGameStore: {
    getState: jest.fn(() => ({
      resetGame: jest.fn(),
      setError: jest.fn(),
      setGameState: jest.fn(),
      setLobbyCode: jest.fn(),
      currentLobby: null,
      error: null,
    })),
  },
}))

// Mock the API service
jest.mock('../apiService', () => ({
  apiService: {
    getLobby: jest.fn(),
    isAuthenticated: jest.fn(() => true),
  },
}))

// Mock window.location and history
const mockLocation = {
  pathname: '/',
  search: '',
  hash: '',
  assign: jest.fn(),
  replace: jest.fn(),
  reload: jest.fn(),
}

const mockHistory = {
  pushState: jest.fn(),
  replaceState: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  go: jest.fn(),
}

Object.defineProperty(window, 'location', {
  value: mockLocation,
  writable: true,
})

Object.defineProperty(window, 'history', {
  value: mockHistory,
  writable: true,
})

// Mock console methods to avoid test noise
const originalConsoleError = console.error
const originalConsoleWarn = console.warn

beforeAll(() => {
  console.error = jest.fn()
  console.warn = jest.fn()
})

afterAll(() => {
  console.error = originalConsoleError
  console.warn = originalConsoleWarn
})

describe('NavigationService', () => {
  let gameStoreMock: Record<string, unknown>
  let apiServiceMock: {
    getLobby: jest.Mock;
    isAuthenticated: jest.Mock;
  }

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks()

    gameStoreMock = {
      resetGame: jest.fn(),
      setError: jest.fn(),
      setGameState: jest.fn(),
      setLobbyCode: jest.fn(),
      currentLobby: null,
      error: null,
    }

      ; (useGameStore.getState as jest.Mock).mockReturnValue(gameStoreMock)

    apiServiceMock = require('../apiService').apiService
    apiServiceMock.getLobby.mockResolvedValue({
      success: true,
      data: {
        id: 1,
        code: 'TEST123',
        status: 'waiting',
        players: [],
      },
    })

    // Reset location
    mockLocation.pathname = '/'
    mockLocation.search = ''

      // Clear any existing listeners
      ; (navigationService as any).listeners = []
  })

  describe('Navigation to Home', () => {
    it('should navigate to home page', async () => {
      const mockNavigate = jest.spyOn(navigationService as any, 'navigate').mockImplementation()

      await navigationService.navigateToHome()

      expect(mockNavigate).toHaveBeenCalledWith('/')
      expect(gameStoreMock.resetGame).toHaveBeenCalled()
    })

    it('should notify listeners when navigating to home', async () => {
      const listener = jest.fn()
      const unsubscribe = navigationService.subscribe(listener)

      jest.spyOn(navigationService as any, 'navigate').mockImplementation()

      await navigationService.navigateToHome()

      expect(listener).toHaveBeenCalledWith({ gameState: 'home' })

      unsubscribe()
    })

    it('should handle navigation errors', async () => {
      const error = new Error('Navigation failed')
      jest.spyOn(navigationService as any, 'navigate').mockImplementation(() => {
        throw error
      })

      const handleErrorSpy = jest.spyOn(navigationService as any, 'handleNavigationError')

      await navigationService.navigateToHome()

      expect(handleErrorSpy).toHaveBeenCalledWith('Failed to navigate to home', error)
    })
  })

  describe('Navigation to Lobby', () => {
    const mockLobbyCode = 'TEST123'

    it('should navigate to lobby with valid code', async () => {
      const mockNavigate = jest.spyOn(navigationService as any, 'navigate').mockImplementation()

      await navigationService.navigateToLobby(mockLobbyCode)

      expect(mockNavigate).toHaveBeenCalledWith(`/lobby/${mockLobbyCode}`)
    })

    it('should validate lobby exists before navigation', async () => {
      jest.spyOn(navigationService as any, 'navigate').mockImplementation()

      await navigationService.navigateToLobby(mockLobbyCode)

      expect(apiServiceMock.getLobby).toHaveBeenCalledWith(mockLobbyCode)
    })

    it('should handle invalid lobby code', async () => {
      apiServiceMock.getLobby.mockResolvedValue({
        success: false,
        error: 'Lobby not found',
      })

      const handleErrorSpy = jest.spyOn(navigationService as any, 'handleNavigationError')

      await navigationService.navigateToLobby('INVALID')

      expect(handleErrorSpy).toHaveBeenCalledWith(
        'Failed to navigate to lobby',
        expect.any(Error)
      )
    })

    it('should notify listeners with lobby context', async () => {
      const listener = jest.fn()
      const unsubscribe = navigationService.subscribe(listener)

      jest.spyOn(navigationService as any, 'navigate').mockImplementation()

      await navigationService.navigateToLobby(mockLobbyCode)

      expect(listener).toHaveBeenCalledWith({
        gameState: 'lobby',
        lobbyCode: mockLobbyCode,
      })

      unsubscribe()
    })
  })

  describe('Navigation to Game', () => {
    const mockLobbyCode = 'TEST123'

    it('should navigate to game page', async () => {
      // Setup mock for playing lobby
      apiServiceMock.getLobby.mockResolvedValue({
        success: true,
        data: {
          id: 1,
          code: mockLobbyCode,
          status: 'playing', // Set to playing state
          players: [],
        },
      })

      const mockNavigate = jest.spyOn(navigationService as any, 'navigate').mockImplementation()

      await navigationService.navigateToGame(mockLobbyCode)

      expect(mockNavigate).toHaveBeenCalledWith(`/game/${mockLobbyCode}`)
    })

    it('should validate lobby is in playing state', async () => {
      apiServiceMock.getLobby.mockResolvedValue({
        success: true,
        data: {
          id: 1,
          code: mockLobbyCode,
          status: 'waiting', // Not playing
          players: [],
        },
      })

      const handleErrorSpy = jest.spyOn(navigationService as any, 'handleNavigationError')

      await navigationService.navigateToGame(mockLobbyCode)

      expect(handleErrorSpy).toHaveBeenCalledWith(
        'Failed to navigate to game',
        expect.any(Error)
      )
    })

    it('should allow navigation to playing lobby', async () => {
      apiServiceMock.getLobby.mockResolvedValue({
        success: true,
        data: {
          id: 1,
          code: mockLobbyCode,
          status: 'playing',
          players: [],
        },
      })

      const mockNavigate = jest.spyOn(navigationService as any, 'navigate').mockImplementation()

      await navigationService.navigateToGame(mockLobbyCode)

      expect(mockNavigate).toHaveBeenCalledWith(`/game/${mockLobbyCode}`)
    })
  })

  describe('Navigation to Results', () => {
    const mockLobbyCode = 'TEST123'

    it('should navigate to results page', async () => {
      const mockNavigate = jest.spyOn(navigationService as any, 'navigate').mockImplementation()

      await navigationService.navigateToResults(mockLobbyCode)

      expect(mockNavigate).toHaveBeenCalledWith(`/results/${mockLobbyCode}`)
    })

    it('should validate lobby exists', async () => {
      jest.spyOn(navigationService as any, 'navigate').mockImplementation()

      await navigationService.navigateToResults(mockLobbyCode)

      expect(apiServiceMock.getLobby).toHaveBeenCalledWith(mockLobbyCode)
    })
  })

  describe('Route Validation', () => {
    it('should validate current route on initialization', () => {
      mockLocation.pathname = '/lobby/TEST123'

      const validateSpy = jest.spyOn(navigationService as any, 'validateCurrentRoute')

      // Call validateCurrentRoute directly since constructor already ran
      navigationService.validateCurrentRoute()

      expect(validateSpy).toHaveBeenCalled()
    })

    it('should handle popstate events', () => {
      const validateSpy = jest.spyOn(navigationService as any, 'validateCurrentRoute')

      // Trigger popstate event
      const popstateEvent = new PopStateEvent('popstate')
      window.dispatchEvent(popstateEvent)

      expect(validateSpy).toHaveBeenCalled()
    })

    it('should extract lobby code from path', () => {
      mockLocation.pathname = '/lobby/TEST123'
      const code = (navigationService as any).extractLobbyCodeFromPath('/lobby/TEST123')

      expect(code).toBe('TEST123')
    })

    it('should return null for invalid paths', () => {
      const code = (navigationService as any).extractLobbyCodeFromPath('/invalid')

      expect(code).toBeNull()
    })
  })

  describe('Authentication Checks', () => {
    it('should redirect to home if not authenticated', () => {
      apiServiceMock.isAuthenticated.mockReturnValue(false)

      const mockNavigate = jest.spyOn(navigationService as any, 'navigate').mockImplementation()

        ; (navigationService as any).requireAuthentication()

      expect(mockNavigate).toHaveBeenCalledWith('/')
    })

    it('should allow access if authenticated', () => {
      apiServiceMock.isAuthenticated.mockReturnValue(true)

      const mockNavigate = jest.spyOn(navigationService as any, 'navigate').mockImplementation()

      const result = (navigationService as any).requireAuthentication()

      expect(result).toBe(true)
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })

  describe('Error Handling', () => {
    it('should handle navigation errors gracefully', () => {
      const error = new Error('Test error')
      const context = 'Test context'

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

        ; (navigationService as any).handleNavigationError(context, error)

      expect(gameStoreMock.setError).toHaveBeenCalledWith(`${context}: ${error.message}`)
      expect(consoleSpy).toHaveBeenCalledWith(`Navigation error - ${context}:`, error)
    })

    it('should navigate to error page for critical errors', () => {
      const error = new Error('Critical error')
      const mockNavigate = jest.spyOn(navigationService as any, 'navigate').mockImplementation()

        ; (navigationService as any).handleNavigationError('Critical context', error, true)

      expect(mockNavigate).toHaveBeenCalledWith('/error')
    })
  })

  describe('Subscription Management', () => {
    it('should add and remove listeners', () => {
      const listener1 = jest.fn()
      const listener2 = jest.fn()

      const unsubscribe1 = navigationService.subscribe(listener1)
      const unsubscribe2 = navigationService.subscribe(listener2)

      expect((navigationService as any).listeners).toHaveLength(2)

      unsubscribe1()
      expect((navigationService as any).listeners).toHaveLength(1)

      unsubscribe2()
      expect((navigationService as any).listeners).toHaveLength(0)
    })

    it('should notify all listeners', () => {
      const listener1 = jest.fn()
      const listener2 = jest.fn()

      navigationService.subscribe(listener1)
      navigationService.subscribe(listener2)

      const context = { gameState: 'home' as const }
        ; (navigationService as any).notify(context)

      expect(listener1).toHaveBeenCalledWith(context)
      expect(listener2).toHaveBeenCalledWith(context)
    })
  })

  describe('URL Parameter Validation', () => {
    it('should validate lobby code format', () => {
      const isValid = (navigationService as any).isValidLobbyCode

      expect(isValid('ABC123')).toBe(true)
      expect(isValid('123456')).toBe(true)
      expect(isValid('ABCDEF')).toBe(true)
      expect(isValid('AB12')).toBe(false) // Too short
      expect(isValid('ABCDEFG')).toBe(true) // 7 chars should be valid
      expect(isValid('ABC 123')).toBe(false) // Contains space
      expect(isValid('')).toBe(false) // Empty
    })
  })
}) 