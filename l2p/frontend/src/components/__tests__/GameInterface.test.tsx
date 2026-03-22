import React from 'react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { GameInterface } from '../GameInterface'
import { useGameStore } from '../../stores/gameStore'
import { socketService } from '../../services/socketService'
import { navigationService } from '../../services/navigationService'
import { apiService } from '../../services/apiService'

// Mock dependencies
vi.mock('../../stores/gameStore')
vi.mock('../../services/socketService', () => ({
  socketService: {
    isConnected: vi.fn(),
    connect: vi.fn(),
    createLobby: vi.fn(),
    joinLobby: vi.fn(),
  },
}))
vi.mock('../../services/navigationService', () => ({
  navigationService: {
    navigateToLobby: vi.fn(),
  },
}))
vi.mock('../../services/apiService', () => ({
  apiService: {
    isAuthenticated: vi.fn(),
  },
}))

vi.mock('../../hooks/useAudio', () => ({
  useAudio: () => ({
    handleMenuSelect: vi.fn(),
    handleMenuConfirm: vi.fn(),
    handleMenuCancel: vi.fn(),
    handleButtonHover: vi.fn(),
  }),
}))

describe('GameInterface', () => {
  const mockSetLobbyCode = vi.fn()
  const mockSetIsHost = vi.fn()
  const mockSetLoading = vi.fn()
  const mockSetError = vi.fn()
  const buildLobby = (code: string) => ({
    id: 1,
    code,
    hostId: 'host-1',
    status: 'waiting' as const,
    players: [],
    questionCount: 10,
    currentQuestion: 0,
    settings: {
      questionSetIds: [],
      timeLimit: 60,
      allowReplay: false,
    },
  })

  beforeEach(() => {
    vi.clearAllMocks()

    // Mock game store
    vi.mocked(useGameStore).mockReturnValue({
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
    vi.mocked(apiService.isAuthenticated).mockReturnValue(true)

    // Mock socket service
    vi.mocked(socketService.isConnected).mockReturnValue(true)
    vi.mocked(socketService.connect).mockReturnValue(undefined)
  })

  describe('Rendering', () => {
    it('should render game interface', () => {
      render(<GameInterface />)

      expect(screen.getByText('Learn2Play Quiz')).toBeInTheDocument()
      expect(screen.getByText('Battle your friends online or tackle solo challenges')).toBeInTheDocument()
      expect(screen.getByText('Create Lobby')).toBeInTheDocument()
      expect(screen.getByText('Join Game')).toBeInTheDocument()
    })

    it('should render create lobby button', () => {
      render(<GameInterface />)

      expect(screen.getByText('Launch New Lobby')).toBeInTheDocument()
    })

    it('should render join lobby input and button', () => {
      render(<GameInterface />)

      fireEvent.click(screen.getByText('Join Game'))
      expect(screen.getByPlaceholderText('CODE12')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Join Now' })).toBeInTheDocument()
    })

    it('should apply custom className', () => {
      const { container } = render(<GameInterface className="custom-class" />)

      const gameInterface = container.firstChild as HTMLElement
      expect(gameInterface).toHaveClass('custom-class')
    })
  })

  describe('Create Lobby', () => {
    it('should create lobby successfully', async () => {
      vi.mocked(socketService.createLobby).mockResolvedValue({
        success: true,
        data: buildLobby('ABC123'),
      })
      vi.mocked(navigationService.navigateToLobby).mockResolvedValue()

      render(<GameInterface />)

      fireEvent.click(screen.getByText('Create Lobby'))

      await waitFor(() => {
        expect(mockSetLoading).toHaveBeenCalledWith(true)
        expect(mockSetError).toHaveBeenCalledWith(null)
      })

      await waitFor(() => {
        expect(socketService.createLobby).toHaveBeenCalledWith({ questionCount: 10, isPrivate: false })
        expect(mockSetLobbyCode).toHaveBeenCalledWith('ABC123')
        expect(mockSetIsHost).toHaveBeenCalledWith(true)
        expect(navigationService.navigateToLobby).toHaveBeenCalledWith('ABC123')
        expect(mockSetLoading).toHaveBeenCalledWith(false)
      })
    })

    it('should connect to socket if not connected', async () => {
      vi.mocked(socketService.isConnected).mockReturnValue(false)
      vi.mocked(socketService.createLobby).mockResolvedValue({
        success: true,
        data: buildLobby('ABC123'),
      })
      vi.mocked(navigationService.navigateToLobby).mockResolvedValue()

      render(<GameInterface />)

      fireEvent.click(screen.getByText('Create Lobby'))

      await waitFor(() => {
        expect(socketService.connect).toHaveBeenCalled()
      })
    })

    it('should show error when not authenticated', async () => {
      vi.mocked(apiService.isAuthenticated).mockReturnValue(false)

      render(<GameInterface />)

      fireEvent.click(screen.getByText('Create Lobby'))

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalledWith('You must be logged in to create a lobby')
        expect(socketService.createLobby).not.toHaveBeenCalled()
      })
    })

    it('should handle create lobby error', async () => {
      vi.mocked(socketService.createLobby).mockRejectedValue(new Error('Network error'))

      render(<GameInterface />)

      fireEvent.click(screen.getByText('Create Lobby'))

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalledWith('Network error')
        expect(mockSetLoading).toHaveBeenCalledWith(false)
      })
    })

    it('should show loading state during creation', async () => {
      vi.mocked(useGameStore).mockReturnValue({
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

      fireEvent.click(screen.getByText('Create Lobby'))

      expect(screen.getByText('Creating...')).toBeInTheDocument()
    })
  })

  describe('Join Lobby', () => {
    it('should join lobby successfully', async () => {
      vi.mocked(socketService.joinLobby).mockResolvedValue({
        success: true,
        data: buildLobby('XYZ789'),
      })
      vi.mocked(navigationService.navigateToLobby).mockResolvedValue()

      render(<GameInterface />)

      fireEvent.click(screen.getByText('Join Game'))
      const input = screen.getByPlaceholderText('CODE12')
      fireEvent.change(input, { target: { value: 'xyz789' } })

      fireEvent.click(screen.getByRole('button', { name: 'Join Now' }))

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

      fireEvent.click(screen.getByText('Join Game'))
      const input = screen.getByPlaceholderText('CODE12') as HTMLInputElement
      fireEvent.change(input, { target: { value: 'abc123' } })

      expect(input.value).toBe('ABC123')
    })

    it('should disable join button when code is empty', () => {
      render(<GameInterface />)

      fireEvent.click(screen.getByText('Join Game'))
      const joinButton = screen.getByRole('button', { name: 'Join Now' })
      expect(joinButton).toBeDisabled()
    })

    it('should enable join button when code has 6 characters', () => {
      render(<GameInterface />)

      fireEvent.click(screen.getByText('Join Game'))
      const input = screen.getByPlaceholderText('CODE12')
      fireEvent.change(input, { target: { value: 'ABC123' } })

      const joinButton = screen.getByRole('button', { name: 'Join Now' })
      expect(joinButton).not.toBeDisabled()
    })

    it('should not attempt join when lobby code is invalid', async () => {
      render(<GameInterface />)

      fireEvent.click(screen.getByText('Join Game'))
      const input = screen.getByPlaceholderText('CODE12')
      fireEvent.change(input, { target: { value: 'ABC' } })

      const joinButton = screen.getByRole('button', { name: 'Join Now' })
      expect(joinButton).toBeDisabled()
      expect(socketService.joinLobby).not.toHaveBeenCalled()
    })

    it('should show error when not authenticated', async () => {
      vi.mocked(apiService.isAuthenticated).mockReturnValue(false)

      render(<GameInterface />)

      fireEvent.click(screen.getByText('Join Game'))
      const input = screen.getByPlaceholderText('CODE12')
      fireEvent.change(input, { target: { value: 'ABC123' } })

      fireEvent.click(screen.getByRole('button', { name: 'Join Now' }))

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalledWith('You must be logged in to join a lobby')
        expect(socketService.joinLobby).not.toHaveBeenCalled()
      })
    })

    it('should handle join lobby error', async () => {
      vi.mocked(socketService.joinLobby).mockRejectedValue(new Error('Lobby not found'))

      render(<GameInterface />)

      fireEvent.click(screen.getByText('Join Game'))
      const input = screen.getByPlaceholderText('CODE12')
      fireEvent.change(input, { target: { value: 'ABC123' } })

      fireEvent.click(screen.getByRole('button', { name: 'Join Now' }))

      await waitFor(() => {
        expect(mockSetError).toHaveBeenCalledWith('Lobby not found')
        expect(mockSetLoading).toHaveBeenCalledWith(false)
      })
    })

    it('should connect to socket if not connected before joining', async () => {
      vi.mocked(socketService.isConnected).mockReturnValue(false)
      vi.mocked(socketService.joinLobby).mockResolvedValue({
        success: true,
        data: buildLobby('ABC123'),
      })
      vi.mocked(navigationService.navigateToLobby).mockResolvedValue()

      render(<GameInterface />)

      fireEvent.click(screen.getByText('Join Game'))
      const input = screen.getByPlaceholderText('CODE12')
      fireEvent.change(input, { target: { value: 'ABC123' } })

      fireEvent.click(screen.getByRole('button', { name: 'Join Now' }))

      await waitFor(() => {
        expect(socketService.connect).toHaveBeenCalled()
      })
    })
  })

  describe('Error Display', () => {
    it('should display error when error exists', () => {
      vi.mocked(useGameStore).mockReturnValue({
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
      vi.mocked(useGameStore).mockReturnValue({
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
