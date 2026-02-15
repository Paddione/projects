import React from 'react'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { useGameStore } from '../../stores/gameStore'
import { useAuthStore } from '../../stores/authStore'

// Mock socketService to capture the answer-received handler
const mockOn = jest.fn()
const mockOff = jest.fn()
jest.mock('../../services/socketService', () => ({
  socketService: {
    isConnected: jest.fn(() => true),
    connect: jest.fn(),
    on: (...args: any[]) => mockOn(...args),
    off: (...args: any[]) => mockOff(...args),
    submitAnswer: jest.fn(),
  }
}))

// Mock react-router-dom hooks used in GamePage
jest.mock('react-router-dom', () => ({
  useParams: () => ({ lobbyId: 'ABC123' }),
  useNavigate: () => jest.fn(),
}))

import { GamePage } from '../GamePage'

describe('GamePage scoreDelta animation', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.clearAllMocks()
    useGameStore.getState().resetGame()
    useAuthStore.getState().clearAuth()

    // Seed auth user and game state
    useAuthStore.getState().setUser({ id: '1', username: 'me', email: 'me@example.com' })
    useGameStore.getState().setGameStarted(true)
    useGameStore.getState().setPlayers([
      { id: '1', username: 'me', character: 'student', isHost: true, score: 0, multiplier: 1, correctAnswers: 0 } as any
    ])
    useGameStore.getState().setCurrentQuestion({
      id: 'q1', text: 'What?', answers: ['A', 'B'], correctAnswer: 0, timeLimit: 60, answerType: 'multiple_choice'
    })
    useGameStore.getState().setQuestionIndex(0)
    useGameStore.getState().setTotalQuestions(1)
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('shows +scoreDelta when answer-received fires for current user', () => {
    render(<GamePage />)

    // The component registers an answer-received handler; capture it
    const call = mockOn.mock.calls.find(c => c[0] === 'answer-received')
    expect(call).toBeTruthy()
    const handler = call[1]

    // Fire event with positive scoreDelta
    handler({ playerId: '1', hasAnswered: true, scoreDelta: 150 })

    // The +150 badge should appear (renders in both mobile bar + desktop pane)
    const badges = screen.getAllByText('+150')
    expect(badges.length).toBeGreaterThanOrEqual(1)

    // Advance timers to clear the badge
    jest.advanceTimersByTime(2000)
  })
})

