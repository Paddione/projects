import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { LobbyView } from '../LobbyView'
import { useGameStore } from '../../stores/gameStore'
import { socketService } from '../../services/socketService'

// Mock the dependencies
jest.mock('../../stores/gameStore')
jest.mock('../../services/socketService', () => ({
    socketService: {
        setReady: jest.fn(),
        updateQuestionSets: jest.fn(),
        startGame: jest.fn(),
    }
}))
jest.mock('../../services/apiService', () => ({
    apiService: {
        getCurrentUser: jest.fn().mockReturnValue({ id: 'user-1' }),
    }
}))
jest.mock('../../services/navigationService', () => ({
    navigationService: {
        navigateToQuestionSets: jest.fn(),
    }
}))

// Mock QuestionSetSelector to keep it simple
jest.mock('../QuestionSetSelector', () => ({
    QuestionSetSelector: () => <div data-testid="question-set-selector">Selector Mock</div>
}))

// Mock PlayerGrid
jest.mock('../PlayerGrid', () => ({
    PlayerGrid: () => <div data-testid="player-grid">Player Grid Mock</div>
}))

describe('LobbyView Improved', () => {
    const mockPlayers = [
        { id: '1', username: 'Host', isHost: true, isReady: true, character: 'wizard', score: 0, multiplier: 1, correctAnswers: 0, currentStreak: 0, isConnected: true },
        { id: '2', username: 'Player 2', isHost: false, isReady: false, character: 'knight', score: 0, multiplier: 1, correctAnswers: 0, currentStreak: 0, isConnected: true }
    ]

    beforeEach(() => {
        (useGameStore as unknown as jest.Mock).mockReturnValue({
            lobbyCode: 'LOBBY-123',
            isHost: true,
            players: mockPlayers,
            error: null,
            questionSetInfo: {
                selectedSets: [{ id: 1, name: 'Default Set', questionCount: 10 }],
                selectedQuestionCount: 5
            }
        })
    })

    it('renders the improved lobby layout', () => {
        render(<LobbyView />)
        expect(screen.getByText('LOBBY-123')).toBeInTheDocument()
        expect(screen.getByText('Challengers')).toBeInTheDocument()
        expect(screen.getByText('Game Configuration')).toBeInTheDocument()
        expect(screen.getByTestId('question-set-selector')).toBeInTheDocument()
    })

    it('shows host specific badges and controls', () => {
        render(<LobbyView />)
        expect(screen.getByText('👑 Master of Ceremony')).toBeInTheDocument()
        // Since mock players have one not-ready player, it should say "Start Anyway"
        expect(screen.getByText('Start Anyway')).toBeInTheDocument()
    })

    it('handles ready toggle', () => {
        render(<LobbyView />)
        const readyBtn = screen.getByText('Get Ready')
        fireEvent.click(readyBtn)
        expect(socketService.setReady).toHaveBeenCalled()
    })

    it('allows starting the game when host', () => {
        render(<LobbyView />)
        // Use a more specific button selector
        const startBtn = screen.getByText('Start Anyway')
        fireEvent.click(startBtn)
        expect(socketService.updateQuestionSets).toHaveBeenCalled()
    })
})
