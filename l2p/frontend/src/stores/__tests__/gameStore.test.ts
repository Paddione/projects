
import { useGameStore, type GameState, type Question, type QuestionSetInfo, type GameResult, type LevelUpNotification } from '../gameStore'
import { Player } from '../../types'

// Mock localStorage for persistence
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn()
}
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
})

describe('GameStore', () => {
  let store: GameState

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks()
    
    // Reset localStorage
    localStorageMock.getItem.mockReturnValue(null)
    
    // Get fresh store state
    store = useGameStore.getState()
    
    // Reset store to initial state
    store.resetGame()
  })

  afterEach(() => {
    // Clean up store state
    useGameStore.setState({
      lobbyCode: null,
      isHost: false,
      players: [],
      maxPlayers: 8,
      questionSetInfo: null,
      gameStarted: false,
      currentQuestion: null,
      questionIndex: 0,
      totalQuestions: 0,
      timeRemaining: 60,
      gameEnded: false,
      gameResults: [],
      levelUpNotifications: [],
      isLoading: false,
      error: null
    })
  })

  describe('Initial State', () => {
    it('should have correct initial values', () => {
      expect(store.lobbyCode).toBe(null)
      expect(store.isHost).toBe(false)
      expect(store.players).toEqual([])
      expect(store.maxPlayers).toBe(8)
      expect(store.questionSetInfo).toBe(null)
      expect(store.gameStarted).toBe(false)
      expect(store.currentQuestion).toBe(null)
      expect(store.questionIndex).toBe(0)
      expect(store.totalQuestions).toBe(0)
      expect(store.timeRemaining).toBe(60)
      expect(store.gameEnded).toBe(false)
      expect(store.gameResults).toEqual([])
      expect(store.levelUpNotifications).toEqual([])
      expect(store.isLoading).toBe(false)
      expect(store.error).toBe(null)
    })
  })

  describe('Lobby Management', () => {
    it('should set lobby code', () => {
      const lobbyCode = 'ABC123'
      store.setLobbyCode(lobbyCode)
      expect(useGameStore.getState().lobbyCode).toBe(lobbyCode)
    })

    it('should set host status', () => {
      store.setIsHost(true)
      expect(useGameStore.getState().isHost).toBe(true)
    })

    it('should set question set info', () => {
      const questionSetInfo: QuestionSetInfo = {
        selectedSets: [
          { id: 1, name: 'General Knowledge', questionCount: 10 },
          { id: 2, name: 'Science', questionCount: 5 }
        ],
        totalQuestions: 15,
        selectedQuestionCount: 10,
        maxQuestionCount: 20
      }
      
      store.setQuestionSetInfo(questionSetInfo)
      expect(useGameStore.getState().questionSetInfo).toEqual(questionSetInfo)
    })

    it('should clear question set info when set to null', () => {
      // First set some info
      const questionSetInfo: QuestionSetInfo = {
        selectedSets: [{ id: 1, name: 'Test', questionCount: 5 }],
        totalQuestions: 5,
        selectedQuestionCount: 5,
        maxQuestionCount: 10
      }
      store.setQuestionSetInfo(questionSetInfo)
      expect(useGameStore.getState().questionSetInfo).toEqual(questionSetInfo)
      
      // Then clear it
      store.setQuestionSetInfo(null)
      expect(useGameStore.getState().questionSetInfo).toBe(null)
    })
  })

  describe('Player Management', () => {
    const mockPlayer1: Player = {
      id: '1',
      username: 'Player1',
      character: 'wizard',
      characterLevel: 5,
      isReady: true,
      isHost: true,
      score: 100,
      multiplier: 2,
      correctAnswers: 3,
      currentStreak: 2,
      isConnected: true,
    }

    const mockPlayer2: Player = {
      id: '2',
      username: 'Player2',
      character: 'student',
      characterLevel: 1,
      isReady: false,
      isHost: false,
      score: 50,
      multiplier: 1,
      correctAnswers: 1,
      currentStreak: 0,
      isConnected: true,
    }

    it('should set players array', () => {
      const players = [mockPlayer1, mockPlayer2]
      store.setPlayers(players)
      expect(useGameStore.getState().players).toEqual(players)
    })

    it('should add a player', () => {
      store.addPlayer(mockPlayer1)
      const state = useGameStore.getState()
      expect(state.players).toContain(mockPlayer1)
      expect(state.players).toHaveLength(1)
    })

    it('should add multiple players', () => {
      store.addPlayer(mockPlayer1)
      store.addPlayer(mockPlayer2)
      const state = useGameStore.getState()
      expect(state.players).toContain(mockPlayer1)
      expect(state.players).toContain(mockPlayer2)
      expect(state.players).toHaveLength(2)
    })

    it('should remove a player', () => {
      store.addPlayer(mockPlayer1)
      store.addPlayer(mockPlayer2)
      store.removePlayer('1')
      
      const state = useGameStore.getState()
      expect(state.players).not.toContain(mockPlayer1)
      expect(state.players).toContain(mockPlayer2)
      expect(state.players).toHaveLength(1)
    })

    it('should update a player', () => {
      store.addPlayer(mockPlayer1)
      store.updatePlayer('1', { isReady: true, score: 150 })
      
      const state = useGameStore.getState()
      const updatedPlayer = state.players.find(p => p.id === '1')
      expect(updatedPlayer?.isReady).toBe(true)
      expect(updatedPlayer?.score).toBe(150)
      expect(updatedPlayer?.username).toBe('Player1') // Other properties unchanged
    })

    it('should not update non-existent player', () => {
      store.addPlayer(mockPlayer1)
      store.updatePlayer('999', { isReady: true })
      
      const state = useGameStore.getState()
      expect(state.players).toEqual([mockPlayer1]) // No changes
    })
  })

  describe('Game Session State', () => {
    it('should set game started status', () => {
      store.setGameStarted(true)
      expect(useGameStore.getState().gameStarted).toBe(true)
    })

    it('should set current question', () => {
      const question: Question = {
        id: 'q1',
        text: 'What is 2 + 2?',
        answers: ['3', '4', '5', '6'],
        correctAnswer: 1,
        timeLimit: 60
      }
      
      store.setCurrentQuestion(question)
      expect(useGameStore.getState().currentQuestion).toEqual(question)
    })

    it('should clear current question when set to null', () => {
      const question: Question = {
        id: 'q1',
        text: 'Test question',
        answers: ['A', 'B', 'C', 'D'],
        correctAnswer: 0,
        timeLimit: 60
      }
      
      store.setCurrentQuestion(question)
      expect(useGameStore.getState().currentQuestion).toEqual(question)
      
      store.setCurrentQuestion(null)
      expect(useGameStore.getState().currentQuestion).toBe(null)
    })

    it('should set question index', () => {
      store.setQuestionIndex(5)
      expect(useGameStore.getState().questionIndex).toBe(5)
    })

    it('should set total questions', () => {
      store.setTotalQuestions(20)
      expect(useGameStore.getState().totalQuestions).toBe(20)
    })

    it('should set time remaining', () => {
      store.setTimeRemaining(45)

      expect(useGameStore.getState().timeRemaining).toBe(45)
    })

    it('should set game ended status', () => {
      store.setGameEnded(true)
      expect(useGameStore.getState().gameEnded).toBe(true)
    })
  })

  describe('Game Results', () => {
    it('should set game results', () => {
      const results: GameResult[] = [
        {
          id: '1',
          username: 'Player1',
          character: 'wizard',
          characterLevel: 5,
          finalScore: 1500,
          correctAnswers: 8,
          multiplier: 3,
          experienceAwarded: 100,
          levelUp: true,
          newLevel: 6,
          oldLevel: 5
        },
        {
          id: '2',
          username: 'Player2',
          character: 'knight',
          characterLevel: 3,
          finalScore: 1200,
          correctAnswers: 7,
          multiplier: 2,
          experienceAwarded: 80,
          levelUp: false,
          newLevel: 3,
          oldLevel: 3
        }
      ]
      
      store.setGameResults(results)
      expect(useGameStore.getState().gameResults).toEqual(results)
    })

    it('should clear game results when set to empty array', () => {
      const results: GameResult[] = [
        {
          id: '1',
          username: 'Player1',
          character: 'wizard',
          finalScore: 1000,
          correctAnswers: 5,
          multiplier: 1,
          experienceAwarded: 50,
          levelUp: false,
          newLevel: 1,
          oldLevel: 1
        }
      ]
      
      store.setGameResults(results)
      expect(useGameStore.getState().gameResults).toEqual(results)
      
      store.setGameResults([])
      expect(useGameStore.getState().gameResults).toEqual([])
    })
  })

  describe('Level Up Notifications', () => {
    it('should add level up notification', () => {
      const notification: LevelUpNotification = {
        playerId: '1',
        username: 'Player1',
        character: 'wizard',
        oldLevel: 5,
        newLevel: 6,
        experienceAwarded: 100
      }
      
      store.addLevelUpNotification(notification)
      const state = useGameStore.getState()
      expect(state.levelUpNotifications).toContain(notification)
      expect(state.levelUpNotifications).toHaveLength(1)
    })

    it('should add multiple level up notifications', () => {
      const notification1: LevelUpNotification = {
        playerId: '1',
        username: 'Player1',
        character: 'wizard',
        oldLevel: 5,
        newLevel: 6,
        experienceAwarded: 100
      }
      
      const notification2: LevelUpNotification = {
        playerId: '2',
        username: 'Player2',
        character: 'knight',
        oldLevel: 3,
        newLevel: 4,
        experienceAwarded: 80
      }
      
      store.addLevelUpNotification(notification1)
      store.addLevelUpNotification(notification2)
      
      const state = useGameStore.getState()
      expect(state.levelUpNotifications).toContain(notification1)
      expect(state.levelUpNotifications).toContain(notification2)
      expect(state.levelUpNotifications).toHaveLength(2)
    })

    it('should remove level up notification by index', () => {
      const notification1: LevelUpNotification = {
        playerId: '1',
        username: 'Player1',
        character: 'wizard',
        oldLevel: 5,
        newLevel: 6,
        experienceAwarded: 100
      }
      
      const notification2: LevelUpNotification = {
        playerId: '2',
        username: 'Player2',
        character: 'knight',
        oldLevel: 3,
        newLevel: 4,
        experienceAwarded: 80
      }
      
      store.addLevelUpNotification(notification1)
      store.addLevelUpNotification(notification2)
      
      store.removeLevelUpNotification(0) // Remove first notification
      
      const state = useGameStore.getState()
      expect(state.levelUpNotifications).not.toContain(notification1)
      expect(state.levelUpNotifications).toContain(notification2)
      expect(state.levelUpNotifications).toHaveLength(1)
    })

    it('should clear all level up notifications', () => {
      const notification1: LevelUpNotification = {
        playerId: '1',
        username: 'Player1',
        character: 'wizard',
        oldLevel: 5,
        newLevel: 6,
        experienceAwarded: 100
      }
      
      const notification2: LevelUpNotification = {
        playerId: '2',
        username: 'Player2',
        character: 'knight',
        oldLevel: 3,
        newLevel: 4,
        experienceAwarded: 80
      }
      
      store.addLevelUpNotification(notification1)
      store.addLevelUpNotification(notification2)
      
      store.clearLevelUpNotifications()
      
      const state = useGameStore.getState()
      expect(state.levelUpNotifications).toEqual([])
    })
  })

  describe('UI State Management', () => {
    it('should set loading state', () => {
      store.setLoading(true)
      expect(useGameStore.getState().isLoading).toBe(true)
      
      store.setLoading(false)
      expect(useGameStore.getState().isLoading).toBe(false)
    })

    it('should set error message', () => {
      const errorMessage = 'Connection failed'
      store.setError(errorMessage)
      expect(useGameStore.getState().error).toBe(errorMessage)
    })

    it('should clear error message when set to null', () => {
      store.setError('Some error')
      expect(useGameStore.getState().error).toBe('Some error')
      
      store.setError(null)
      expect(useGameStore.getState().error).toBe(null)
    })
  })

  describe('Game Reset', () => {
    it('should reset game to initial state', () => {
      // Set various states
      store.setLobbyCode('ABC123')
      store.setIsHost(true)
      store.addPlayer({
        id: '1',
        username: 'Player1',
        character: 'wizard',
        isReady: false,
        isHost: false,
        score: 0,
        multiplier: 1,
        correctAnswers: 0,
        currentStreak: 0,
        isConnected: true
      })
      store.setGameStarted(true)
      store.setCurrentQuestion({
        id: 'q1',
        text: 'Test question',
        answers: ['A', 'B', 'C', 'D'],
        correctAnswer: 0,
        timeLimit: 60
      })
      store.setQuestionIndex(5)
      store.setTotalQuestions(20)
      store.setTimeRemaining(30)
      store.setGameEnded(true)
      store.setGameResults([{
        id: '1',
        username: 'Player1',
        character: 'wizard',
        finalScore: 1000,
        correctAnswers: 5,
        multiplier: 1,
        experienceAwarded: 50,
        levelUp: false,
        newLevel: 1,
        oldLevel: 1
      }])
      store.addLevelUpNotification({
        playerId: '1',
        username: 'Player1',
        character: 'wizard',
        oldLevel: 5,
        newLevel: 6,
        experienceAwarded: 100
      })
      store.setLoading(true)
      store.setError('Test error')
      
      // Reset game
      store.resetGame()
      
      // Verify all states are reset
      const state = useGameStore.getState()
      expect(state.lobbyCode).toBe(null)
      expect(state.isHost).toBe(false)
      expect(state.players).toEqual([])
      expect(state.maxPlayers).toBe(8)
      expect(state.questionSetInfo).toBe(null)
      expect(state.gameStarted).toBe(false)
      expect(state.currentQuestion).toBe(null)
      expect(state.questionIndex).toBe(0)
      expect(state.totalQuestions).toBe(0)
      expect(state.timeRemaining).toBe(60)
      expect(state.gameEnded).toBe(false)
      expect(state.gameResults).toEqual([])
      expect(state.levelUpNotifications).toEqual([])
      expect(state.isLoading).toBe(false)
      expect(state.error).toBe(null)
    })
  })

  describe('Time Remaining Updates', () => {
    it('should set time remaining directly', () => {
      store.setTimeRemaining(45)

      expect(useGameStore.getState().timeRemaining).toBe(45)
    })

    it('should update time remaining to new value', () => {
      store.setTimeRemaining(30)

      expect(useGameStore.getState().timeRemaining).toBe(30)
    })
  })

  describe('State Persistence', () => {
    it('should maintain state across multiple operations', () => {
      // Set up a complex game state
      store.setLobbyCode('XYZ789')
      store.setIsHost(true)
      store.addPlayer({
        id: '1',
        username: 'Player1',
        character: 'wizard',
        isReady: true,
        isHost: true,
        score: 100,
        multiplier: 2,
        correctAnswers: 3,
        currentStreak: 0,
        isConnected: true
      })
      store.addPlayer({
        id: '2',
        username: 'Player2',
        character: 'knight',
        isReady: false,
        isHost: false,
        score: 50,
        multiplier: 1,
        correctAnswers: 1,
        currentStreak: 0,
        isConnected: true
      })
      store.setQuestionSetInfo({
        selectedSets: [{ id: 1, name: 'General Knowledge', questionCount: 10 }],
        totalQuestions: 10,
        selectedQuestionCount: 10,
        maxQuestionCount: 20
      })
      store.setGameStarted(true)
      store.setCurrentQuestion({
        id: 'q1',
        text: 'What is the capital of France?',
        answers: ['London', 'Paris', 'Berlin', 'Madrid'],
        correctAnswer: 1,
        timeLimit: 60
      })
      store.setQuestionIndex(3)
      store.setTotalQuestions(10)
      store.setTimeRemaining(45)
      
      // Verify all states are maintained
      const state = useGameStore.getState()
      expect(state.lobbyCode).toBe('XYZ789')
      expect(state.isHost).toBe(true)
      expect(state.players).toHaveLength(2)
      expect(state.players[0].username).toBe('Player1')
      expect(state.players[1].username).toBe('Player2')
      expect(state.questionSetInfo?.selectedSets).toHaveLength(1)
      expect(state.gameStarted).toBe(true)
      expect(state.currentQuestion?.text).toBe('What is the capital of France?')
      expect(state.questionIndex).toBe(3)
      expect(state.totalQuestions).toBe(10)
      expect(state.timeRemaining).toBe(45)
    })
  })

  describe('Error Handling', () => {
    it('should handle empty player arrays', () => {
      store.setPlayers([])
      expect(useGameStore.getState().players).toEqual([])
    })

    it('should handle removing non-existent player', () => {
      store.addPlayer({
        id: '1',
        username: 'Player1',
        character: 'wizard',
        isReady: false,
        isHost: false,
        score: 0,
        multiplier: 1,
        correctAnswers: 0,
        currentStreak: 0,
        isConnected: true
      })
      
      store.removePlayer('999') // Non-existent player
      
      const state = useGameStore.getState()
      expect(state.players).toHaveLength(1) // No change
    })

    it('should handle negative question index', () => {
      store.setQuestionIndex(-1)
      expect(useGameStore.getState().questionIndex).toBe(-1)
    })

    it('should handle negative time remaining', () => {
      store.setTimeRemaining(-10)
      expect(useGameStore.getState().timeRemaining).toBe(-10)
    })

    it('should handle very large values', () => {
      store.setQuestionIndex(999999)
      store.setTotalQuestions(999999)
      store.setTimeRemaining(999999)
      
      const state = useGameStore.getState()
      expect(state.questionIndex).toBe(999999)
      expect(state.totalQuestions).toBe(999999)
      expect(state.timeRemaining).toBe(999999)
    })
  })
}) 