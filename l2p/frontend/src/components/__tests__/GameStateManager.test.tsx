import React from 'react'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { render, waitFor } from '@testing-library/react'
import { GameStateManager } from '../GameStateManager'
import { useGameStore } from '../../stores/gameStore'
import { socketService } from '../../services/socketService'
import { navigationService } from '../../services/navigationService'

// Mock dependencies
jest.mock('../../stores/gameStore')
jest.mock('../../services/socketService', () => ({
  socketService: {
    connect: jest.fn(),
    disconnect: jest.fn(),
  },
}))
jest.mock('../../services/navigationService', () => ({
  navigationService: {
    validateCurrentRoute: jest.fn(),
    handleGameStateChange: jest.fn(),
    destroy: jest.fn(),
  },
}))

describe('GameStateManager', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Mock game store
    jest.mocked(useGameStore).mockReturnValue({
      lobbyCode: null,
      gameStarted: false,
      gameEnded: false,
    } as any)

    // Mock socket service
    jest.mocked(socketService.connect).mockReturnValue(undefined)
    jest.mocked(socketService.disconnect).mockReturnValue(undefined)

    // Mock navigation service
    jest.mocked(navigationService.validateCurrentRoute).mockResolvedValue()
    jest.mocked(navigationService.handleGameStateChange).mockResolvedValue()
    jest.mocked(navigationService.destroy).mockReturnValue(undefined)

    // Reset window location
    window.history.replaceState({}, '', '/')

    // Clear event listeners
    window.removeEventListener('beforeunload', expect.any(Function) as any)
  })

  describe('Initialization', () => {
    it('should render without errors', () => {
      const { container } = render(<GameStateManager />)

      // Should render null (no visible elements)
      expect(container.firstChild).toBeNull()
    })

    it('should not connect without a socket URL', async () => {
      render(<GameStateManager />)

      await waitFor(() => {
        expect(navigationService.validateCurrentRoute).toHaveBeenCalled()
      })
      expect(socketService.connect).not.toHaveBeenCalled()
    })

    it('should validate current route on mount', async () => {
      render(<GameStateManager />)

      await waitFor(() => {
        expect(navigationService.validateCurrentRoute).toHaveBeenCalled()
      })
    })

    it('should add beforeunload event listener', async () => {
      const addEventListenerSpy = jest.spyOn(window, 'addEventListener')

      render(<GameStateManager />)

      await waitFor(() => {
        expect(addEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))
      })

      addEventListenerSpy.mockRestore()
    })

    it('should use socket URL from ENV if available', async () => {
      (window as any).ENV = { VITE_SOCKET_URL: 'ws://test.com' }

      render(<GameStateManager />)

      await waitFor(() => {
        expect(socketService.connect).toHaveBeenCalledWith('ws://test.com')
      })

      delete (window as any).ENV
    })
  })

  describe('Cleanup', () => {
    it('should disconnect socket on unmount', () => {
      const { unmount } = render(<GameStateManager />)

      unmount()

      expect(socketService.disconnect).toHaveBeenCalled()
    })

    it('should destroy navigation service on unmount', () => {
      const { unmount } = render(<GameStateManager />)

      unmount()

      expect(navigationService.destroy).toHaveBeenCalled()
    })

    it('should remove beforeunload event listener on unmount', () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener')

      const { unmount } = render(<GameStateManager />)

      unmount()

      expect(removeEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))

      removeEventListenerSpy.mockRestore()
    })
  })

  describe('Game state changes', () => {
    it('should handle game state change when gameStarted changes', () => {
      jest.mocked(useGameStore).mockReturnValue({
        lobbyCode: 'ABC123',
        gameStarted: true,
        gameEnded: false,
      } as any)

      render(<GameStateManager />)

      expect(navigationService.handleGameStateChange).toHaveBeenCalled()
    })

    it('should handle game state change when gameEnded changes', () => {
      jest.mocked(useGameStore).mockReturnValue({
        lobbyCode: 'ABC123',
        gameStarted: false,
        gameEnded: true,
      } as any)

      render(<GameStateManager />)

      expect(navigationService.handleGameStateChange).toHaveBeenCalled()
    })

    it('should validate route when lobbyCode is set', () => {
      jest.mocked(useGameStore).mockReturnValue({
        lobbyCode: 'ABC123',
        gameStarted: false,
        gameEnded: false,
      } as any)

      render(<GameStateManager />)

      expect(navigationService.validateCurrentRoute).toHaveBeenCalled()
    })
  })

  describe('Beforeunload handler', () => {
    it('should warn user when leaving game page', async () => {
      window.history.replaceState({}, '', '/game/ABC123')

      const addEventListenerSpy = jest.spyOn(window, 'addEventListener')
      render(<GameStateManager />)

      await waitFor(() => {
        expect(addEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))
      })

      const event = new Event('beforeunload') as BeforeUnloadEvent
      event.preventDefault = jest.fn()

      window.dispatchEvent(event)

      // The handler sets returnValue which triggers browser confirmation
      expect(event.preventDefault).toHaveBeenCalled()
      addEventListenerSpy.mockRestore()
    })

    it('should warn user when leaving lobby page', async () => {
      window.history.replaceState({}, '', '/lobby/ABC123')

      const addEventListenerSpy = jest.spyOn(window, 'addEventListener')
      render(<GameStateManager />)

      await waitFor(() => {
        expect(addEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))
      })

      const event = new Event('beforeunload') as BeforeUnloadEvent
      event.preventDefault = jest.fn()

      window.dispatchEvent(event)

      expect(event.preventDefault).toHaveBeenCalled()
      addEventListenerSpy.mockRestore()
    })

    it('should not warn user when leaving other pages', async () => {
      window.history.replaceState({}, '', '/')

      const addEventListenerSpy = jest.spyOn(window, 'addEventListener')
      render(<GameStateManager />)

      await waitFor(() => {
        expect(addEventListenerSpy).toHaveBeenCalledWith('beforeunload', expect.any(Function))
      })

      const event = new Event('beforeunload') as BeforeUnloadEvent
      event.preventDefault = jest.fn()

      window.dispatchEvent(event)

      // For non-game/lobby pages, preventDefault should not be called
      // (This behavior depends on the actual implementation)
      expect(event.preventDefault).not.toHaveBeenCalled()
      addEventListenerSpy.mockRestore()
    })
  })

  describe('Initialization guard', () => {
    it('should only initialize once on multiple renders', async () => {
      ; (window as any).ENV = { VITE_SOCKET_URL: 'ws://test.com' }
      const { rerender } = render(<GameStateManager />)

      const firstCallCount = jest.mocked(socketService.connect).mock.calls.length

      rerender(<GameStateManager />)
      rerender(<GameStateManager />)

      const finalCallCount = jest.mocked(socketService.connect).mock.calls.length

      // Should only connect once despite multiple renders
      expect(finalCallCount).toBe(firstCallCount)
      delete (window as any).ENV
    })
  })

  describe('Error handling', () => {
    it('should handle socket connection errors gracefully', async () => {
      ; (window as any).ENV = { VITE_SOCKET_URL: 'ws://test.com' }
      jest.mocked(socketService.connect).mockImplementation(() => {
        throw new Error('Connection failed')
      })

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)

      expect(() => render(<GameStateManager />)).not.toThrow()

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to initialize services:', expect.any(Error))
      })

      consoleErrorSpy.mockRestore()
      delete (window as any).ENV
    })

    it('should handle navigation validation errors gracefully', () => {
      jest.mocked(navigationService.validateCurrentRoute).mockRejectedValue(new Error('Validation failed'))

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)

      expect(() => render(<GameStateManager />)).not.toThrow()

      consoleErrorSpy.mockRestore()
    })
  })
})
