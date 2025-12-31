import React from 'react'
import { describe, it, expect, beforeEach, jest } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import { LobbyView } from '../LobbyView'
import { useGameStore } from '../../stores/gameStore'
import { socketService } from '../../services/socketService'

jest.mock('../../stores/gameStore')

jest.mock('../../services/socketService', () => ({
  socketService: {
    setReady: jest.fn(),
    startGame: jest.fn(),
    updateQuestionSets: jest.fn(),
  },
}))

jest.mock('../../services/navigationService', () => ({
  navigationService: {
    navigateToQuestionSets: jest.fn(),
  },
}))

jest.mock('../../services/apiService', () => ({
  apiService: {
    getCurrentUser: jest.fn(),
  },
}))

jest.mock('../PlayerGrid', () => ({
  PlayerGrid: () => <div data-testid="player-grid" />,
}))

jest.mock('../QuestionSetSelector', () => ({
  QuestionSetSelector: () => <div data-testid="question-set-selector" />,
}))

const baseStoreState = {
  lobbyCode: 'ABC123',
  isHost: false,
  players: [
    { id: 'player1', isReady: false },
    { id: 'player2', isReady: false },
  ],
  error: null,
  questionSetInfo: null,
}

describe('LobbyView', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(useGameStore).mockReturnValue(baseStoreState as any)
  })

  it('renders lobby metadata and sections', () => {
    render(<LobbyView />)

    expect(screen.getByText('Lobby Code')).toBeInTheDocument()
    expect(screen.getByText('ABC123')).toBeInTheDocument()
    expect(screen.getByText('Challengers')).toBeInTheDocument()
    expect(screen.getByText('Game Configuration')).toBeInTheDocument()
  })

  it('toggles ready state via socket service', async () => {
    const user = userEvent.setup()
    render(<LobbyView />)

    await user.click(screen.getByRole('button', { name: 'Get Ready' }))

    expect(socketService.setReady).toHaveBeenCalledWith(true)
  })

  it('shows host controls and starts game when enabled', async () => {
    const user = userEvent.setup()
    jest.mocked(useGameStore).mockReturnValue({
      ...baseStoreState,
      isHost: true,
      players: [
        { id: 'player1', isReady: true },
        { id: 'player2', isReady: false },
      ],
    } as any)

    render(<LobbyView />)

    const startButton = screen.getByRole('button', { name: /start/i })
    expect(startButton).toBeEnabled()

    await user.click(startButton)

    expect(socketService.startGame).toHaveBeenCalled()
  })

  it('hides host start controls for non-hosts', () => {
    render(<LobbyView />)

    expect(screen.queryByRole('button', { name: /start/i })).not.toBeInTheDocument()
  })

  it('copies the lobby code when clicked', async () => {
    const user = userEvent.setup()
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.assign(navigator, {
      clipboard: { writeText },
    })

    render(<LobbyView />)

    const codeBadge = screen.getByText('Lobby Code').closest('div')
    expect(codeBadge).not.toBeNull()

    await user.click(codeBadge as HTMLElement)

    expect(writeText).toHaveBeenCalledWith('ABC123')
  })
})
