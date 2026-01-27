import { useGameStore } from '../../stores/gameStore'
import { performanceOptimizer } from '../performanceOptimizer'
import { Socket } from 'socket.io-client'

// Mock socket.io-client to control server events
jest.mock('socket.io-client')

// Mock navigation to verify redirects without side effects
jest.mock('../navigationService', () => ({
  navigationService: {
    navigateToGame: jest.fn(),
    navigateToResults: jest.fn(),
    navigateToHome: jest.fn()
  }
}))

import { socketService } from '../socketService'
import { navigationService } from '../navigationService'
import { io } from 'socket.io-client'

// Get the mocked io function
const mockIo = io as jest.MockedFunction<typeof io>

describe('SocketService event handlers', () => {
  let mockSocket: Record<string, unknown> & {
    serverEmit: jest.Mock;
    on: jest.Mock;
    off: jest.Mock;
    emit: jest.Mock;
    disconnect: jest.Mock;
    connected: boolean;
  }

  beforeEach(() => {
    jest.clearAllMocks()
    // Skip fake timers to avoid performance property issues

    // Create a fresh mock socket for each test
    mockSocket = {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
      disconnect: jest.fn(),
      connected: true,
      serverEmit: jest.fn((event: string, data?: Record<string, unknown>) => {
        // Find the handler and call it
        const calls = mockSocket.on.mock.calls
        const handler = calls.find((call: Record<string, unknown>) => call[0] === event)
        if (handler && handler[1]) {
          handler[1](data)
        }
      })
    }

    // Make the mocked io function return our mock socket
    mockIo.mockReturnValue(mockSocket as any)

    // Ensure performance optimizer does not block new connections across tests
    performanceOptimizer.cleanup()
    // Reset store to a clean state
    useGameStore.getState().resetGame()
    // Ensure no leftover connection
    socketService.disconnect()
      // Reset the global connection flag
      ; (socketService.constructor as any).globalConnectionInProgress = false

    // Make throttling execute immediately for deterministic tests
    jest.spyOn(performanceOptimizer, 'throttle').mockImplementation((_key: string, fn: (...args: unknown[]) => unknown) => {
      return (...args: unknown[]) => fn(...args)
    })
  })

  afterEach(() => {
    // Cleanup after tests
  })

  const connectAndGetMockSocket = () => {
    // Create a new socketService instance for each test to avoid state pollution
    const testSocketService = new (socketService.constructor as any)()

    // Mock the io function to return our mock socket
    mockIo.mockReturnValue(mockSocket as any)

    // Connect using the test instance
    testSocketService.connect('http://test-server')

      // Manually set the socket property
      ; (testSocketService as any).socket = mockSocket

    const socket = (testSocketService as any).socket
    expect(socket).toBeTruthy()
    return { socket, socketService: testSocketService }
  }

  it('handles join-success by setting players and lobby code', () => {
    const { socket } = connectAndGetMockSocket()

    socket.serverEmit('join-success', {
      lobby: { code: 'ABC123', players: [{ id: '1', username: 'Alice', character: 'student' }] },
      message: 'ok'
    })

    const state = useGameStore.getState()
    expect(state.lobbyCode).toBe('ABC123')
    expect(state.players).toEqual([{ id: '1', username: 'Alice', character: 'student' } as Record<string, unknown>])
  })

  it('handles lobby-updated by updating players when provided', () => {
    const { socket } = connectAndGetMockSocket()

    socket.serverEmit('lobby-updated', {
      lobby: { players: [{ id: '2', username: 'Bob', character: 'professor' }] },
      event: 'player-joined'
    })

    expect(useGameStore.getState().players).toEqual([{ id: '2', username: 'Bob', character: 'professor' } as Record<string, unknown>])
  })

  it('handles question-set-info by setting questionSetInfo', () => {
    const { socket } = connectAndGetMockSocket()

    socket.serverEmit('question-set-info', {
      questionSetInfo: {
        selectedSets: [{ id: 1, name: 'General', questionCount: 10 }],
        totalQuestions: 10,
        selectedQuestionCount: 10,
        maxQuestionCount: 20
      }
    })

    expect(useGameStore.getState().questionSetInfo).toMatchObject({ totalQuestions: 10 })
  })

  it('handles question-sets-update-error by setting error', () => {
    const { socket } = connectAndGetMockSocket()

    socket.serverEmit('question-sets-update-error', { type: 'UPDATE_FAILED', message: 'bad' })

    expect(useGameStore.getState().error).toBe('bad')
  })

  it('handles game-started by setting state and navigating', async () => {
    const { socket } = connectAndGetMockSocket()

    // Pretend we are in a lobby to trigger navigation
    useGameStore.getState().setLobbyCode('ABC123')

    socket.serverEmit('game-started', {
      gameState: {
        currentQuestion: { id: 'q1', text: 'T?', answers: ['a'], correctAnswer: 0, timeLimit: 30 },
        timeRemaining: 25
      },
      message: 'start'
    })

    // Wait for async dynamic import to settle
    await new Promise(resolve => setTimeout(resolve, 50))

    const state = useGameStore.getState()
    expect(state.gameStarted).toBe(true)
    // The currentQuestion is not set by game-started event, only by question-started
    expect(state.timeRemaining).toBe(25)
    expect(navigationService.navigateToGame).toHaveBeenCalledWith('ABC123', true)
  })

  it('handles question-started by updating question-related state', () => {
    const { socket } = connectAndGetMockSocket()

    socket.serverEmit('question-started', {
      question: { id: 'q2', text: 'Q2?', answers: ['x', 'y'], correctAnswer: 1, timeLimit: 20 },
      questionIndex: 3,
      totalQuestions: 10,
      timeRemaining: 19
    })

    const state = useGameStore.getState()
    expect(state.currentQuestion?.id).toBe('q2')
    expect(state.questionIndex).toBe(3)
    expect(state.totalQuestions).toBe(10)
    expect(state.timeRemaining).toBe(19)
  })

  it('handles time-update by updating timeRemaining (throttled)', () => {
    const { socket } = connectAndGetMockSocket()

    socket.serverEmit('time-update', { timeRemaining: 15 })

    expect(useGameStore.getState().timeRemaining).toBe(15)
  })

  it('handles game-ended by setting results and navigating', async () => {
    const { socket } = connectAndGetMockSocket()

    useGameStore.getState().setLobbyCode('ABC123')

    socket.serverEmit('game-ended', {
      results: [
        { id: 'r1', username: 'A', character: 'student', finalScore: 10, correctAnswers: 1, multiplier: 1, experienceAwarded: 5, levelUp: false, newLevel: 1, oldLevel: 1 }
      ],
      gameSessionId: 42,
      questionSetIds: [1]
    })

    // Wait for async handler (dynamic import + await) to settle
    await new Promise(resolve => setTimeout(resolve, 50))

    const state = useGameStore.getState()
    expect(state.gameEnded).toBe(true)
    expect(state.gameResults.length).toBe(1)
    expect(navigationService.navigateToResults).toHaveBeenCalledWith('ABC123', true)
  })

  it('handles player-level-up by appending a notification', () => {
    const { socket } = connectAndGetMockSocket()

    socket.serverEmit('player-level-up', {
      playerId: '1', username: 'Alice', character: 'student', oldLevel: 1, newLevel: 2, experienceAwarded: 100
    })

    expect(useGameStore.getState().levelUpNotifications).toHaveLength(1)
  })

  it('handles answer-received with preferred fields and updates player', () => {
    const { socket } = connectAndGetMockSocket()

    // Seed a player in the store
    useGameStore.getState().setPlayers([
      { id: '1', username: 'Alice', character: 'student', isHost: true, score: 0, multiplier: 1, correctAnswers: 0 } as any
    ])

    socket.serverEmit('answer-received', {
      playerId: '1',
      hasAnswered: true,
      isCorrect: true,
      newScore: 150,
      newMultiplier: 2,
      scoreDelta: 150,
      currentStreak: 1
    } as any)

    const player = useGameStore.getState().players[0] as any
    expect(player.score).toBe(150)
    expect(player.multiplier).toBe(2)
    expect(player.correctAnswers).toBe(1)
    expect(player.currentStreak).toBe(1)
  })

  it('computes fallback scoreDelta and applies legacy score fields', () => {
    const { socket } = connectAndGetMockSocket()

    // Seed a player in the store with score 100
    useGameStore.getState().setPlayers([
      { id: '1', username: 'Alice', character: 'student', isHost: true, score: 100, multiplier: 1, correctAnswers: 0 } as any
    ])

    // Emit only legacy fields (score/multiplier) without newScore/newMultiplier/scoreDelta
    socket.serverEmit('answer-received', {
      playerId: '1',
      hasAnswered: true,
      isCorrect: true,
      score: 160,
      multiplier: 2,
      currentStreak: 1
    } as any)

    const player = useGameStore.getState().players[0] as any
    expect(player.score).toBe(160)
    expect(player.multiplier).toBe(2)
    expect(player.correctAnswers).toBe(1)
    expect(player.currentStreak).toBe(1)
  })

  it('handles error by setting store error', () => {
    const { socket } = connectAndGetMockSocket()

    socket.serverEmit('error', { message: 'boom' })

    expect(useGameStore.getState().error).toBe('boom')
  })

  it('handles lobby-deleted by navigating to home', async () => {
    const { socket } = connectAndGetMockSocket()

    socket.serverEmit('lobby-deleted', {
      message: 'Lobby has been deleted',
      reason: 'host-left'
    })

    // Wait for async dynamic import to settle
    await new Promise(resolve => setTimeout(resolve, 50))

    // Verify that navigateToHome was called
    expect(navigationService.navigateToHome).toHaveBeenCalled()
  })

  it('handles lobby-updated with player-left event', () => {
    const { socket } = connectAndGetMockSocket()

    socket.serverEmit('lobby-updated', {
      lobby: {
        players: [
          { id: '1', username: 'Alice', character: 'student', isHost: true },
          { id: '2', username: 'Bob', character: 'professor', isHost: false }
        ]
      },
      event: 'player-left',
      playerId: '3'
    })

    const state = useGameStore.getState()
    expect(state.players).toHaveLength(2)
    expect(state.players[0].username).toBe('Alice')
    expect(state.players[1].username).toBe('Bob')
  })

  it('handles lobby-updated with other events', () => {
    const { socket } = connectAndGetMockSocket()

    socket.serverEmit('lobby-updated', {
      lobby: {
        players: [
          { id: '1', username: 'Alice', character: 'student', isHost: true },
          { id: '2', username: 'Bob', character: 'professor', isHost: false }
        ]
      },
      event: 'player-joined',
      playerId: '2'
    })

    const state = useGameStore.getState()
    expect(state.players).toHaveLength(2)
    expect(state.players[0].username).toBe('Alice')
    expect(state.players[1].username).toBe('Bob')
  })
})
