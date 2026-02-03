import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { Player } from '../types'
import { performanceOptimizer } from '../services/performanceOptimizer'

export interface Question {
  id: string
  text: string
  answers: string[]
  correctAnswer: number
  timeLimit: number
}

export interface QuestionSetInfo {
  selectedSets: Array<{ id: number; name: string; questionCount: number }>
  totalQuestions: number
  selectedQuestionCount: number
  maxQuestionCount: number
}

export interface UserPerk {
  id: number
  user_id: number
  perk_id: number
  is_unlocked: boolean
  is_active: boolean
  configuration: any
  perk?: {
    id: number
    name: string
    category: string
    type: string
    level_required: number
    title: string
    description: string
    is_active: boolean
  }
}

export interface GameResult {
  id: string
  username: string
  character: string
  characterLevel?: number
  finalScore: number
  correctAnswers: number
  multiplier: number
  experienceAwarded: number
  levelUp: boolean
  newLevel: number
  oldLevel: number
  newlyUnlockedPerks?: UserPerk[]
}

export interface LevelUpNotification {
  playerId: string
  username: string
  character: string
  oldLevel: number
  newLevel: number
  experienceAwarded: number
}

export interface PerkUnlockNotification {
  playerId: string
  username: string
  character: string
  unlockedPerks: UserPerk[]
}

type AnswerStatus = 'correct' | 'wrong' | 'pending'

export interface GameState {
  // Lobby state
  lobbyCode: string | null
  isHost: boolean
  players: Player[]
  maxPlayers: number
  questionSetInfo: QuestionSetInfo | null

  // Game session state
  gameStarted: boolean
  isSyncing: boolean
  syncCountdown: number
  currentQuestion: Question | null
  questionIndex: number
  totalQuestions: number
  timeRemaining: number
  gameEnded: boolean

  // Game results and experience
  gameResults: GameResult[]
  levelUpNotifications: LevelUpNotification[]
  perkUnlockNotifications: PerkUnlockNotification[]

  // UI state
  isLoading: boolean
  error: string | null

  // Per-round UI status
  playerAnswerStatus: Record<string, AnswerStatus | undefined>

  // Actions
  setLobbyCode: (code: string | null) => void
  setIsHost: (isHost: boolean) => void
  setPlayers: (players: Player[]) => void
  addPlayer: (player: Player) => void
  removePlayer: (playerId: string) => void
  updatePlayer: (playerId: string, updates: Partial<Player>) => void
  setQuestionSetInfo: (info: QuestionSetInfo | null) => void
  setGameStarted: (started: boolean) => void
  setIsSyncing: (isSyncing: boolean) => void
  setSyncCountdown: (countdown: number) => void
  setCurrentQuestion: (question: Question | null) => void
  setQuestionIndex: (index: number) => void
  setTotalQuestions: (total: number) => void
  setTimeRemaining: (time: number) => void
  setGameEnded: (ended: boolean) => void
  setGameResults: (results: GameResult[]) => void
  addLevelUpNotification: (notification: LevelUpNotification) => void
  removeLevelUpNotification: (index: number) => void
  clearLevelUpNotifications: () => void
  addPerkUnlockNotification: (notification: PerkUnlockNotification) => void
  removePerkUnlockNotification: (index: number) => void
  clearPerkUnlockNotifications: () => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  resetGame: () => void

  // Per-round actions
  setPlayerAnswerStatus: (playerId: string, status: AnswerStatus | undefined) => void
  resetPlayerAnswerStatus: () => void
}

const initialState = {
  lobbyCode: null,
  isHost: false,
  players: [],
  maxPlayers: 8,
  questionSetInfo: null,
  gameStarted: false,
  isSyncing: false,
  syncCountdown: 0,
  currentQuestion: null,
  questionIndex: 0,
  totalQuestions: 0,
  timeRemaining: 60,
  gameEnded: false,
  gameResults: [],
  levelUpNotifications: [],
  perkUnlockNotifications: [],
  isLoading: false,
  error: null,
  playerAnswerStatus: {} as Record<string, AnswerStatus | undefined>,
}

export const useGameStore = create<GameState>()(
  devtools(
    (set) => ({
      ...initialState,

      setLobbyCode: (code) => set({ lobbyCode: code }),
      setIsHost: (isHost) => set({ isHost }),
      setPlayers: (players) => set({ players }),
      addPlayer: (player) => set((state) => ({
        players: [...state.players, player]
      })),
      removePlayer: (playerId) => set((state) => ({
        players: state.players.filter(p => p.id !== playerId)
      })),
      updatePlayer: (playerId, updates) => set((state) => ({
        players: state.players.map(p =>
          p.id === playerId ? { ...p, ...updates } : p
        )
      })),
      setQuestionSetInfo: (info) => set({ questionSetInfo: info }),
      setGameStarted: (started) => set({ gameStarted: started }),
      setIsSyncing: (isSyncing) => set({ isSyncing }),
      setSyncCountdown: (countdown) => set({ syncCountdown: countdown }),
      setCurrentQuestion: (question) => set({ currentQuestion: question }),
      setQuestionIndex: (index) => set({ questionIndex: index }),
      setTotalQuestions: (total) => set({ totalQuestions: total }),
      setTimeRemaining: (time) => {
        // Throttle time updates to prevent excessive re-renders
        const throttledUpdate = performanceOptimizer.throttle(
          'time-remaining-update',
          () => {
            set({ timeRemaining: time })
          },
          100
        ) // Update every 100ms max

        if (typeof throttledUpdate === 'function') {
          throttledUpdate()
        } else {
          // Fallback in case a mocked throttle returns a non-function
          set({ timeRemaining: time })
        }
      },
      setGameEnded: (ended) => set({ gameEnded: ended }),
      setGameResults: (results) => set({ gameResults: results }),
      addLevelUpNotification: (notification) => set((state) => ({
        levelUpNotifications: [...state.levelUpNotifications, notification]
      })),
      removeLevelUpNotification: (index) => set((state) => ({
        levelUpNotifications: state.levelUpNotifications.filter((_, i) => i !== index)
      })),
      clearLevelUpNotifications: () => set({ levelUpNotifications: [] }),
      addPerkUnlockNotification: (notification) => set((state) => ({
        perkUnlockNotifications: [...state.perkUnlockNotifications, notification]
      })),
      removePerkUnlockNotification: (index) => set((state) => ({
        perkUnlockNotifications: state.perkUnlockNotifications.filter((_, i) => i !== index)
      })),
      clearPerkUnlockNotifications: () => set({ perkUnlockNotifications: [] }),
      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      resetGame: () => set(initialState),

      setPlayerAnswerStatus: (playerId, status) => set((state) => ({
        playerAnswerStatus: { ...state.playerAnswerStatus, [playerId]: status }
      })),
      resetPlayerAnswerStatus: () => set({ playerAnswerStatus: {} }),
    }),
    {
      name: 'game-store',
    }
  )
) 