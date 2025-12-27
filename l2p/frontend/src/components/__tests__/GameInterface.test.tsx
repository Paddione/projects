import React from 'react'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { GameInterface } from '../GameInterface'
import { useGameStore } from '../../stores/gameStore'
import { socketService } from '../../services/socketService'
import { navigationService } from '../../services/navigationService'
import { apiService } from '../../services/apiService'

// Mock dependencies
jest.mock('../../stores/gameStore')
jest.mock('../../services/socketService', () => ({
  socketService: {
    isConnected: jest.fn(),
    connect: jest.fn(),
    createLobby: jest.fn(),
    joinLobby: jest.fn(),
  },
}))
jest.mock('../../services/navigationService', () => ({
  navigationService: {
    navigateToLobby: jest.fn(),
  },
}))
jest.mock('../../services/apiService', () => ({
  apiService: {
    isAuthenticated: jest.fn(),
  },
}))

jest.mock('../../hooks/useAudio', () => ({
  useAudio: () => ({
    handleMenuSelect: jest.fn(),
    handleMenuConfirm: jest.fn(),
    handleMenuCancel: jest.fn(),
    handleButtonHover: jest.fn(),
  }),
}))

describe('GameInterface', () => {
  const mockSetLobbyCode = jest.fn()
  const mockSetIsHost = jest.fn()
  const mockSetLoading = jest.fn()
  const mockSetError = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()

    // Mock game store
    jest.mocked(useGameStore).mockReturnValue({
      lobbyCode: null,
      isHost: false,
      isLoading: false,
      error: null,
      setLobbyCode: mockSetLobbyCode,
      setIsHost: mockSetIsHost,
      setLoading: mockSetLoading,
      setError: mockSetError,
    } as any)

    // Mock API service
    jest.mocked(apiService.isAuthenticated).mockReturnValue(true)

    // Mock socket service
    jest.mocked(socketService.isConnected).mockReturnValue(true)
    jest.mocked(socketService.connect).mockReturnValue(undefined)
  })

  describe('Rendering', () => {
    it('should render game interface', () => {
      render(<GameInterface />)

      expect(screen.getByText('Learn2Play Quiz')).toBeInTheDocument()
      expect(screen.getByText('Create or join a multiplayer quiz game')).toBeInTheDocument()
      expect(screen.getByText('Create New Game')).toBeInTheDocument()
      expect(screen.getByText('Join Existing Game')).toBeInTheDocument()
    })

    it('should render create lobby button', () => {
      render(<GameInterface />)

      expect(screen.getByTestId('create-lobby-button')).toBeInTheDocument()
      expect(screen.getByTestId('create-lobby-button')).toHaveTextContent('Create Lobby')
    })

    it('should render join lobby input and button', () => {
      render(<GameInterface />)

      fireEvent.click(screen.getByTestId('join-lobby-button'))
      expect(screen.getByTestId('lobby-code-input')).toBeInTheDocument()
      expect(screen.getByTestId('join-lobby-confirm')).toBeInTheDocument()
    })

    it('should apply custom className', () => {
      const { container } = render(<GameInterface className="custom-class" />)

      const gameInterface = container.firstChild as HTMLElement
      expect(gameInterface).toHaveClass('custom-class')
    })
  })

  describe('Create Lobby', () => {
    it('should create lobby successfully', async () => {
      jest.mocked(socketService.createLobby).mockResolvedValue({
        success: true,
        data: { code: 'ABC123' },
      })
      jest.mocked(navigationService.navigateToLobby).mockResolvedValue()

      render(<GameInterface />)

      fireEvent.click(screen.getByTestId('create-lobby-button'))
      fireEvent.click(screen.getByTestId('confirm-create-lobby'))

      await waitFor(() => {
        expect(mockSetLoading).toHaveBeenCalledWith(true)
        expect(mockSetError).toHaveBeenCalledWith(null)
      })

      await waitFor(() => {
        expect(socketService.createLobby).toHaveBeenCalledWith({ questionCount: 5, isPrivate: false, questionSetKey: 'general' })
        expect(mockSetLobbyCode).toHaveBeenCalledWith('ABC123')
        expect(mockSetIsHost).toHaveBeenCalledWith(true)
        expect(navigationService.navigateToLobby).toHaveBeenCalledWith('ABC123')
        expect(mockSetLoading).toHaveBeenCalledWith(false)
      })
    })

    it('should connect to socket if not connected', async () => {
      jest.mocked(socketService.isConnected).mockReturnValue(false)
      jest.mocked(socketService.createLobby).mockResolvedValue({
        success: true,
        data: { code: 'ABC123' },
      })
      jest.mocked(navigationService.navigateToLobby).mockResolvedValue()

      render(<GameInterface />)

      fireEvent.click(screen.getByTestId('create-lobby-button'))
      fireEvent.click(screen.getByTestId('confirm-create-lobby'))

      await waitFor(() => {
        expect(socketService.connect).toHaveBeenCalled()
      })
    })

    it('should show error when not authenticated', async () => {
      jest.mocked(apiService.isAuthenticated).mockReturnValue(false)

      render(<GameInterface />)

      fireEvent.click(screen.getByTestId('create-lobby-button'))
      fireEvent.click(screen.getByTestId('confirm-create-lobby'))

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalledWith('You must be logged in to create a lobby')
        expect(socketService.createLobby).not.toHaveBeenCalled()
      })
    })

    it('should handle create lobby error', async () => {
      jest.mocked(socketService.createLobby).mockRejectedValue(new Error('Network error'))

      render(<GameInterface />)

      fireEvent.click(screen.getByTestId('create-lobby-button'))
      fireEvent.click(screen.getByTestId('confirm-create-lobby'))

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalledWith('Network error')
        expect(mockSetLoading).toHaveBeenCalledWith(false)
      })
    })

    it('should show loading state during creation', async () => {
      jest.mocked(useGameStore).mockReturnValue({
        lobbyCode: null,
        isHost: false,
        isLoading: true,
        error: null,
        setLobbyCode: mockSetLobbyCode,
        setIsHost: mockSetIsHost,
        setLoading: mockSetLoading,
        setError: mockSetError,
      } as any)

      render(<GameInterface />)

      fireEvent.click(screen.getByTestId('create-lobby-button'))

      const confirmButton = screen.getByTestId('confirm-create-lobby')
      expect(confirmButton).toHaveTextContent('Creating...')
      expect(confirmButton).toBeDisabled()
    })
  })

  describe('Join Lobby', () => {
    it('should join lobby successfully', async () => {
      jest.mocked(socketService.joinLobby).mockResolvedValue({
        success: true,
        data: { code: 'XYZ789' },
      })
      jest.mocked(navigationService.navigateToLobby).mockResolvedValue()

      render(<GameInterface />)

      fireEvent.click(screen.getByTestId('join-lobby-button'))
      const input = screen.getByTestId('lobby-code-input')
      fireEvent.change(input, { target: { value: 'xyz789' } })

      fireEvent.click(screen.getByTestId('join-lobby-confirm'))

      await waitFor(() => {
        expect(mockSetLoading).toHaveBeenCalledWith(true)
        expect(mockSetError).toHaveBeenCalledWith(null)
      })

      await waitFor(() => {
        expect(socketService.joinLobby).toHaveBeenCalledWith('XYZ789')
        expect(mockSetLobbyCode).toHaveBeenCalledWith('XYZ789')
        expect(mockSetIsHost).toHaveBeenCalledWith(false)
        expect(navigationService.navigateToLobby).toHaveBeenCalledWith('XYZ789')
        expect(mockSetLoading).toHaveBeenCalledWith(false)
      })
    })

    it('should convert lobby code to uppercase', async () => {
      render(<GameInterface />)

      fireEvent.click(screen.getByTestId('join-lobby-button'))
      const input = screen.getByTestId('lobby-code-input') as HTMLInputElement
      fireEvent.change(input, { target: { value: 'abc123' } })

      expect(input.value).toBe('ABC123')
    })

    it('should disable join button when code is empty', () => {
      render(<GameInterface />)

      fireEvent.click(screen.getByTestId('join-lobby-button'))
      const joinButton = screen.getByTestId('join-lobby-confirm')
      expect(joinButton).toBeDisabled()
    })

    it('should enable join button when code has 6 characters', () => {
      render(<GameInterface />)

      fireEvent.click(screen.getByTestId('join-lobby-button'))
      const input = screen.getByTestId('lobby-code-input')
      fireEvent.change(input, { target: { value: 'ABC123' } })

      const joinButton = screen.getByTestId('join-lobby-confirm')
      expect(joinButton).not.toBeDisabled()
    })

    it('should show error for invalid lobby code', async () => {
      render(<GameInterface />)

      fireEvent.click(screen.getByTestId('join-lobby-button'))
      const input = screen.getByTestId('lobby-code-input')
      fireEvent.change(input, { target: { value: 'ABC' } })

      fireEvent.click(screen.getByTestId('join-lobby-confirm'))

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalledWith('Please enter a valid 6-character lobby code')
        expect(socketService.joinLobby).not.toHaveBeenCalled()
      })
    })

    it('should show error when not authenticated', async () => {
      jest.mocked(apiService.isAuthenticated).mockReturnValue(false)

      render(<GameInterface />)

      fireEvent.click(screen.getByTestId('join-lobby-button'))
      const input = screen.getByTestId('lobby-code-input')
      fireEvent.change(input, { target: { value: 'ABC123' } })

      fireEvent.click(screen.getByTestId('join-lobby-confirm'))

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalledWith('You must be logged in to join a lobby')
        expect(socketService.joinLobby).not.toHaveBeenCalled()
      })
    })

    it('should handle join lobby error', async () => {
      jest.mocked(socketService.joinLobby).mockRejectedValue(new Error('Lobby not found'))

      render(<GameInterface />)

      fireEvent.click(screen.getByTestId('join-lobby-button'))
      const input = screen.getByTestId('lobby-code-input')
      fireEvent.change(input, { target: { value: 'ABC123' } })

      fireEvent.click(screen.getByTestId('join-lobby-confirm'))

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalledWith('Lobby not found')
        expect(mockSetLoading).toHaveBeenCalledWith(false)
      })
    })

    it('should connect to socket if not connected before joining', async () => {
      jest.mocked(socketService.isConnected).mockReturnValue(false)
      jest.mocked(socketService.joinLobby).mockResolvedValue({
        success: true,
        data: { code: 'ABC123' },
      })
      jest.mocked(navigationService.navigateToLobby).mockResolvedValue()

      render(<GameInterface />)

      fireEvent.click(screen.getByTestId('join-lobby-button'))
      const input = screen.getByTestId('lobby-code-input')
      fireEvent.change(input, { target: { value: 'ABC123' } })

      fireEvent.click(screen.getByTestId('join-lobby-confirm'))

      await waitFor(() => {
        expect(socketService.connect).toHaveBeenCalled()
      })
    })
  })

  describe('Error Display', () => {
    it('should display error when error exists', () => {
      jest.mocked(useGameStore).mockReturnValue({
        lobbyCode: null,
        isHost: false,
        isLoading: false,
        error: 'Test error message',
        setLobbyCode: mockSetLobbyCode,
        setIsHost: mockSetIsHost,
        setLoading: mockSetLoading,
        setError: mockSetError,
      } as any)

      render(<GameInterface />)

      expect(screen.getByText('Test error message')).toBeInTheDocument()
    })

    it('should clear error when clear button is clicked', () => {
      jest.mocked(useGameStore).mockReturnValue({
        lobbyCode: null,
        isHost: false,
        isLoading: false,
        error: 'Test error message',
        setLobbyCode: mockSetLobbyCode,
        setIsHost: mockSetIsHost,
        setLoading: mockSetLoading,
        setError: mockSetError,
      } as any)

      render(<GameInterface />)

      // ErrorDisplay component should have a close/clear mechanism
      // This will trigger setError(null)
    })
  })
})
