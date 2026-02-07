import { io, Socket } from 'socket.io-client'
import { useGameStore } from '../stores/gameStore'
import { performanceOptimizer } from './performanceOptimizer'
import { audioManager } from './audioManager'
import { useAuthStore } from '../stores/authStore'
import { useCharacterStore } from '../stores/characterStore'
// import { navigationService } from './navigationService'
import { apiService } from './apiService'

export interface SocketEvents {
  // Connection events
  connect: () => void
  disconnect: (reason: string) => void
  connect_error: (error: Error) => void
  // Custom server confirmation on connection
  connected: (data: { socketId: string; timestamp: number }) => void

  // Lobby events (backend-compatible)
  'join-success': (data: { lobby: Record<string, unknown>; message: string }) => void
  'join-error': (data: { type: string; message: string }) => void
  'lobby-updated': (data: { lobby: Record<string, unknown>; event: string; player?: Record<string, unknown>; playerId?: string; isReady?: boolean }) => void
  'lobby-deleted': (data: { message: string; reason: string }) => void
  'leave-success': (data: { message: string }) => void
  'leave-error': (data: { type: string; message: string }) => void

  // Question set events
  'question-sets-updated': (data: { lobby: Record<string, unknown>; updatedBy: string }) => void
  'question-sets-update-success': (data: { message: string; lobby: Record<string, unknown> }) => void
  'question-sets-update-error': (data: { type: string; message: string }) => void
  'question-set-info': (data: { questionSetInfo: Record<string, unknown> }) => void
  'question-set-info-error': (data: { type: string; message: string }) => void

  // Game events
  'game-syncing': (data: { countdown: number; message: string }) => void
  'game-started': (data: { gameState: Record<string, unknown>; message: string }) => void
  'question-started': (data: { question: Record<string, unknown>; questionIndex: number; totalQuestions: number; timeRemaining: number }) => void
  'answer-received': (data: {
    playerId: string;
    username?: string;
    hasAnswered: boolean;
    isCorrect?: boolean;
    timeElapsed?: number;
    // Legacy fields provided by server
    score?: number;
    multiplier?: number;
    // Preferred fields
    newScore?: number;
    newMultiplier?: number;
    scoreDelta?: number;
    currentStreak?: number;
    streak?: number; // Backend sends this field
  }) => void
  'question-ended': (data: { results: Record<string, unknown>[]; correctAnswer: string; questionIndex: number; totalQuestions: number }) => void
  'time-update': (data: { timeRemaining: number }) => void
  'game-ended': (data: { results: Record<string, unknown>[]; gameSessionId: number; questionSetIds: number[] }) => void
  'player-level-up': (data: { playerId: string; username: string; character: string; oldLevel: number; newLevel: number; experienceAwarded: number }) => void
  'player-perk-unlocks': (data: { playerId: string; username: string; character: string; unlockedPerks: any[] }) => void

  // Perk draft events
  'perk:draft-available': (data: { userId: number; pendingDrafts: any[] }) => void
  'perk:draft-result': (data: { success: boolean; action: string; level: number; perkId?: number; error?: string }) => void
  'perk:pool-exhausted': (data: { message: string }) => void

  // Error events
  'error': (data: { message: string }) => void
}

export class SocketService {
  private socket: Socket | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private isConnecting = false
  private connectionId: string = ''

  static globalConnectionInProgress = false

  constructor() {
    // Don't setup event handlers in constructor - wait for connection
  }

  private setupEventHandlers() {
    if (!this.socket) {
      console.warn('Cannot setup event handlers: socket is null')
      return
    }

    console.log('Setting up socket event handlers...')

    // Connection event handlers
    this.socket.on('connect', () => {
      try {
        console.log('✅ Connected to server successfully')
        console.log('Socket ID:', this.socket?.id)
        this.reconnectAttempts = 0
        this.isConnecting = false
        SocketService.globalConnectionInProgress = false
        useGameStore.getState().setError(null)
      } catch (err) {
        console.error('Error in connect handler:', err)
      }
    })

    this.socket.on('disconnect', (reason: string) => {
      try {
        console.log('❌ Disconnected from server:', reason)
        this.isConnecting = false
        SocketService.globalConnectionInProgress = false

        if (reason === 'io server disconnect') {
          // Server initiated disconnect, don't reconnect
          console.log('Server initiated disconnect, not attempting reconnect')
          return
        }

        console.log('Client-side disconnect, attempting reconnect...')
        this.attemptReconnect()
      } catch (err) {
        console.error('Error in disconnect handler:', err)
      }
    })

    this.socket.on('connect_error', (error: Error) => {
      try {
        console.error('❌ Connection error:', error)
        console.error('Error details:', {
          message: error.message,
          type: error.constructor.name,
          stack: error.stack
        })
        this.isConnecting = false
        SocketService.globalConnectionInProgress = false
        useGameStore.getState().setError('Connection failed. Retrying...')
        this.attemptReconnect()
      } catch (err) {
        console.error('Error in connect_error handler:', err)
      }
    })

    // Optional: server-side connected confirmation
    this.socket.on('connected', (data) => {
      try {
        console.log('Server acknowledged connection:', data)
      } catch (err) {
        console.error('Error in connected handler:', err)
      }
    })

    // Lobby event handlers
    this.socket.on('join-success', (data) => {
      try {
        console.log('Joined lobby (socket):', data)
        const { setPlayers, setLobbyCode } = useGameStore.getState()
        setPlayers(data.lobby.players)
        setLobbyCode(data.lobby.code)
      } catch (err) {
        console.error('Error in join-success handler:', err)
      }
    })

    this.socket.on('lobby-updated', (data) => {
      try {
        console.log('Lobby updated:', data)
        const { setPlayers, setError } = useGameStore.getState()
        if (data?.lobby?.players) {
          setPlayers(data.lobby.players)

          // If a player left, show a notification
          if (data.event === 'player-left') {
            console.log(`Player ${data.playerId} left the lobby`)
            // You could add a toast notification here if desired
          }
        }
      } catch (err) {
        console.error('Error in lobby-updated handler:', err)
      }
    })

    this.socket.on('lobby-deleted', (data) => {
      try {
        console.log('Lobby deleted:', data)
        // Navigate all players back to home screen
        // Use dynamic import to avoid circular dependency
        import('./navigationService').then(({ navigationService }) => {
          navigationService.navigateToHome()
        })
      } catch (err) {
        console.error('Error in lobby-deleted handler:', err)
      }
    })

    // Question set event handlers
    this.socket.on('question-sets-updated', (data) => {
      try {
        console.log('Question sets updated:', data)
        const { setPlayers } = useGameStore.getState()
        if (data?.lobby?.players) {
          setPlayers(data.lobby.players)
        }
      } catch (err) {
        console.error('Error in question-sets-updated handler:', err)
      }
    })

    this.socket.on('question-sets-update-success', (data) => {
      try {
        console.log('Question sets update success:', data)
        // Success notification could be shown here
      } catch (err) {
        console.error('Error in question-sets-update-success handler:', err)
      }
    })

    this.socket.on('question-sets-update-error', (data) => {
      console.error('Question sets update error:', data)
      useGameStore.getState().setError(data.message)
    })

    this.socket.on('question-set-info', (data) => {
      console.log('Question set info received:', data)
      const { setQuestionSetInfo } = useGameStore.getState()
      setQuestionSetInfo(data.questionSetInfo)
    })

    this.socket.on('question-set-info-error', (data) => {
      console.error('Question set info error:', data)
      useGameStore.getState().setError(data.message)
    })

    // Game event handlers
    this.socket.on('game-started', (data) => {
      try {
        console.log('Game started:', data)
        const {
          setGameStarted,
          setTimeRemaining,
          setPlayers,
          setTotalQuestions,
          lobbyCode: currentLobbyCode
        } = useGameStore.getState()

        setGameStarted(true)

        // Update store with state from server
        if (data?.gameState) {
          if (data.gameState.players) {
            setPlayers(data.gameState.players)
          }
          if (typeof data.gameState.totalQuestions === 'number') {
            setTotalQuestions(data.gameState.totalQuestions)
          }
          if (typeof data.gameState.timeRemaining === 'number') {
            setTimeRemaining(data.gameState.timeRemaining)
          }
        }

        // Navigate to game page (skip validation since this is triggered by server game-started event)
        // Use dynamic import to avoid circular dependency
        // Prioritize lobbyCode from payload if available
        const codeToUse = data?.lobbyCode || currentLobbyCode
        if (codeToUse) {
          import('./navigationService').then(({ navigationService }) => {
            navigationService.navigateToGame(codeToUse, true)
          })
        }
      } catch (err) {
        console.error('Error in game-started handler:', err)
        useGameStore.getState().setError('Failed to start game. Please try again.')
      }
    })

    this.socket.on('game-syncing', (data) => {
      try {
        console.log('Game syncing:', data)
        const { setIsSyncing, setSyncCountdown } = useGameStore.getState()
        setIsSyncing(true)
        setSyncCountdown(data.countdown)
      } catch (err) {
        console.error('Error in game-syncing handler:', err)
      }
    })

    this.socket.on('question-started', (data) => {
      try {
        console.log('New question started:', data)

        // Debug the question data structure
        console.log('Question data debug:', {
          questionIndex: data.questionIndex,
          fullData: data,
          questionObject: data.question,
          questionField: data.question?.question,
          answersField: data.question?.answers,
          allQuestionKeys: data.question ? Object.keys(data.question) : 'no question object'
        })

        const { setCurrentQuestion, setQuestionIndex, setTotalQuestions, setTimeRemaining, resetPlayerAnswerStatus, setPlayers, setIsSyncing } = useGameStore.getState()

        // Question has started, so we are no longer syncing
        setIsSyncing(false)

        // Validate that we have question data
        if (!data.question) {
          console.error('No question data received in question-started event')
          return
        }

        // Transform backend question format to frontend format
        const answers = (data.question?.answers || []) as string[]
        const correctAnswerText: string = data.question?.correctAnswer || ''
        const correctAnswerIndex = answers.findIndex((answer: string) => answer === correctAnswerText)

        // Extract question text - backend sends it in the 'question' field
        // Try multiple possible field names to ensure we get the question text
        const questionText = data.question.question ||
          data.question.text ||
          data.question.questionText ||
          `Frage ${data.questionIndex + 1} (Text nicht verfügbar)`

        console.log(`[Question ${data.questionIndex + 1}] Question data:`, {
          questionText,
          answers,
          correctAnswerText,
          correctAnswerIndex,
          fullQuestionObject: data.question
        })

        const frontendQuestion = {
          id: data.question?.id || String(Date.now()),
          text: questionText,
          answers: answers,
          correctAnswer: correctAnswerIndex >= 0 ? correctAnswerIndex : 0, // Map answer text to index
          timeLimit: 60
        }

        console.log('Frontend question transformed:', {
          originalBackend: data.question,
          transformedFrontend: frontendQuestion,
          correctAnswerMapping: `"${correctAnswerText}" -> index ${correctAnswerIndex}`
        })

        console.log(`[Frontend] Received questionIndex: ${data.questionIndex}, will display as: ${data.questionIndex + 1}/${data.totalQuestions}`);
        console.log(`[Frontend] Setting question in store:`, frontendQuestion);

        // Ensure question text is not empty before setting
        if (!frontendQuestion.text || frontendQuestion.text.includes('Text nicht verfügbar')) {
          console.error('Question text is missing or invalid:', {
            originalQuestion: data.question?.question,
            textField: data.question?.text,
            finalText: frontendQuestion.text,
            fullQuestionObject: data.question
          })
        }

        setCurrentQuestion(frontendQuestion)
        setQuestionIndex(data.questionIndex)
        setTotalQuestions(data.totalQuestions)
        setTimeRemaining(data.timeRemaining)
        resetPlayerAnswerStatus()

        // Force immediate store update and verify
        const storeState = useGameStore.getState()
        console.log('Store state immediately after question update:', {
          currentQuestion: storeState.currentQuestion,
          questionText: storeState.currentQuestion?.text,
          questionIndex: storeState.questionIndex
        })

        // Additional verification after a brief delay
        setTimeout(() => {
          const currentState = useGameStore.getState()
          console.log('Store state after question update (delayed check):', {
            currentQuestion: currentState.currentQuestion,
            questionText: currentState.currentQuestion?.text,
            questionIndex: currentState.questionIndex
          })

          // If question text is still missing, force another update
          if (!currentState.currentQuestion?.text || currentState.currentQuestion.text.includes('wird geladen')) {
            console.warn('Question text still missing, forcing another update...')
            setCurrentQuestion({
              ...frontendQuestion,
              text: questionText // Use the extracted question text directly
            })
          }
        }, 50)

        // Update players with current scores from server
        if (data.players && Array.isArray(data.players)) {
          console.log('Updating players with server data:', data.players)
          setPlayers(data.players)
        }
      } catch (err) {
        console.error('Error in question-started handler:', err)
        useGameStore.getState().setError('Failed to load question. Please wait for the next one.')
      }
    })

    this.socket.on('answer-received', (data) => {
      try {
        console.log('Answer received:', data)
        const { setPlayerAnswerStatus, updatePlayer, players } = useGameStore.getState()
        const { user } = useAuthStore.getState()

        if (data.playerId) {
          // Update answer status if provided
          if (typeof data.isCorrect === 'boolean') {
            setPlayerAnswerStatus(data.playerId, data.isCorrect ? 'correct' : 'wrong')
          }

          // Check if this is the current user's answer
          const isCurrentUser = String(data.playerId) === String(user?.id)

          // Update player with complete score information from backend
          const target = players.find(p => p.id === data.playerId)
          if (target) {
            const updates: Partial<typeof target> = {}
            // Compute fallback scoreDelta if not provided
            if (typeof data.scoreDelta !== 'number') {
              const incomingScore = typeof data.newScore === 'number' ? data.newScore
                : (typeof data.score === 'number' ? data.score : undefined)
              if (typeof incomingScore === 'number') {
                const delta = incomingScore - (typeof target.score === 'number' ? target.score : 0)
                if (delta > 0) {
                  ; (data as any).scoreDelta = delta
                }
              }
            }

            if (typeof data.newScore === 'number') {
              updates.score = data.newScore
            }
            if (typeof data.newMultiplier === 'number') {
              updates.multiplier = data.newMultiplier
            }
            // Legacy fallbacks
            if (updates.score === undefined && typeof data.score === 'number') {
              updates.score = data.score
            }
            if (updates.multiplier === undefined && typeof data.multiplier === 'number') {
              updates.multiplier = data.multiplier
            }
            if (data.isCorrect) {
              updates.correctAnswers = (target.correctAnswers || 0) + 1
            }
            // Handle streak updates - backend sends 'streak', frontend uses 'currentStreak'
            if (typeof data.streak === 'number') {
              updates.currentStreak = data.streak
            } else if (typeof data.currentStreak === 'number') {
              updates.currentStreak = data.currentStreak
            } else if (data.isCorrect) {
              // If server doesn't provide streak but answer is correct, increment local streak
              updates.currentStreak = (target.currentStreak || 0) + 1
            } else if (data.isCorrect === false) {
              // Reset streak on wrong answer
              updates.currentStreak = 0
            }

            console.log('Updating player with server data:', { playerId: data.playerId, updates })
            updatePlayer(target.id, updates)

            // Play authoritative audio feedback for all players
            // Use the updated streak value from the updates object
            try {
              if (typeof data.isCorrect === 'boolean') {
                if (data.isCorrect) {
                  // Use the streak from updates (which has the most current value)
                  let streak = updates.currentStreak || 1

                  audioManager.playCorrectAnswer(streak)
                } else {
                  audioManager.playWrongAnswer()
                }
              }
            } catch (e) {
              console.warn('Audio feedback failed:', e)
            }
          }
        }
      } catch (err) {
        console.error('Error in answer-received handler:', err)
        useGameStore.getState().setError('Failed to process answer update.')
      }
    })

    this.socket.on('question-ended', (data) => {
      try {
        console.log('Question ended:', data)
        // Update all player scores based on results from server
        const { updatePlayer, players } = useGameStore.getState()

        if (data.results && Array.isArray(data.results)) {
          data.results.forEach((result: Record<string, unknown>) => {
            const existingPlayer = players.find(p => p.id === String(result['id']))
            if (existingPlayer && typeof result['score'] === 'number') {
              updatePlayer(String(result['id']), {
                score: result['score'] as number,
                multiplier: typeof result['multiplier'] === 'number' ? (result['multiplier'] as number) : existingPlayer.multiplier,
                correctAnswers: existingPlayer.correctAnswers // Don't override until we get authoritative data
              })
            }
          })
        }
        // Keep badges visible until next question; no reset here
      } catch (err) {
        console.error('Error in question-ended handler:', err)
      }
    })

    this.socket.on('time-update', (data) => {
      try {
        // Throttle timer updates to avoid excessive re-renders
        const update = performanceOptimizer.throttle(
          'time-remaining-update',
          () => {
            useGameStore.getState().setTimeRemaining(data.timeRemaining)
          },
          100
        )
        if (typeof update === 'function') {
          update()
        }
      } catch (err) {
        console.error('Error in time-update handler:', err)
      }
    })

    this.socket.on('game-ended', async (data) => {
      try {
        console.log('Game ended:', data)
        const { setGameEnded, setGameResults, lobbyCode } = useGameStore.getState()
        setGameEnded(true)

        // Play post-game sound
        try {
          audioManager.playGameEnd()
        } catch (e) {
          console.warn('Failed to play game end sound:', e)
        }

        // Normalize results to ensure experienceAwarded is populated
        const normalizedResults = Array.isArray(data.results)
          ? data.results.map((r: any) => ({
            ...r,
            experienceAwarded: typeof r.experienceAwarded === 'number'
              ? r.experienceAwarded
              : (typeof r.experience === 'number' ? r.experience
                : (typeof r.xp === 'number' ? r.xp
                  : (typeof r.experience_points === 'number' ? r.experience_points : 0)))
          }))
          : []

        setGameResults(normalizedResults as any)

        // Award experience to the current user based on results, if available
        try {
          const auth = useAuthStore.getState()
          const myUsername = auth.user?.username
          const myId = auth.user?.id
          const myResult = Array.isArray(normalizedResults)
            ? (normalizedResults as any[]).find((r: any) => String(r.username) === String(myUsername) || String(r.id) === String(myId))
            : null
          const xp = myResult && typeof myResult.experienceAwarded === 'number' ? myResult.experienceAwarded : 0
          if (xp > 0) {
            // Award experience and, if needed, reflect it in the results list
            const res = await useCharacterStore.getState().awardExperience(xp)
            if (res && (!myResult.experienceAwarded || myResult.experienceAwarded === 0)) {
              const patched = (normalizedResults as any[]).map((r: any) =>
                (String(r.username) === String(myUsername) || String(r.id) === String(myId))
                  ? { ...r, experienceAwarded: xp }
                  : r
              )
              setGameResults(patched as any)
            }
          }
        } catch (e) {
          console.warn('Failed to award experience after game end:', e)
        }

        // Process perk unlock notifications (legacy)
        const { addPerkUnlockNotification } = useGameStore.getState()
        const playersWithPerks = normalizedResults.filter((result: any) =>
          result.newlyUnlockedPerks && result.newlyUnlockedPerks.length > 0
        )

        playersWithPerks.forEach((result: any) => {
          addPerkUnlockNotification({
            playerId: result.id,
            username: result.username,
            character: result.character,
            unlockedPerks: result.newlyUnlockedPerks
          })
        })

        // Process pending perk drafts for current user
        try {
          const auth = useAuthStore.getState()
          const myId = auth.user?.id
          const myUsername = auth.user?.username
          const myResult = (normalizedResults as any[]).find((r: any) =>
            String(r.id) === String(myId) || String(r.username) === String(myUsername)
          )
          if (myResult?.pendingDrafts && myResult.pendingDrafts.length > 0) {
            import('../stores/perkDraftStore').then(({ usePerkDraftStore }) => {
              usePerkDraftStore.getState().setPendingDrafts(myResult.pendingDrafts)
            })
          }
        } catch (e) {
          console.warn('Failed to process pending drafts from game results:', e)
        }

        // Navigate to results page — skip validation since the lobby gets
        // deleted after game end and the API check would fail
        // Use dynamic import to avoid circular dependency
        import('./navigationService').then(({ navigationService }) => {
          if (lobbyCode) {
            navigationService.navigateToResults(lobbyCode, true)
          }
        })
      } catch (err) {
        console.error('Error in game-ended handler:', err)
        useGameStore.getState().setError('Failed to process game results.')
      }
    })

    this.socket.on('player-level-up', (data) => {
      try {
        console.log('Player level up:', data)
        const { addLevelUpNotification } = useGameStore.getState()
        addLevelUpNotification({
          playerId: data.playerId,
          username: data.username,
          character: data.character,
          oldLevel: data.oldLevel,
          newLevel: data.newLevel,
          experienceAwarded: data.experienceAwarded
        })
      } catch (err) {
        console.error('Error in player-level-up handler:', err)
      }
    })

    // Real-time perk unlock notifications (may arrive before game-end)
    this.socket.on('player-perk-unlocks', (data) => {
      try {
        console.log('Player perk unlocks:', data)
        const { addPerkUnlockNotification } = useGameStore.getState()
        addPerkUnlockNotification({
          playerId: data.playerId,
          username: data.username,
          character: data.character,
          unlockedPerks: Array.isArray(data.unlockedPerks) ? data.unlockedPerks : []
        })
      } catch (err) {
        console.error('Error in player-perk-unlocks handler:', err)
      }
    })

    // Perk draft events
    this.socket.on('perk:draft-available' as any, (data: any) => {
      try {
        console.log('Perk draft available:', data)
        const auth = useAuthStore.getState()
        if (data.userId && String(data.userId) === String(auth.user?.id)) {
          import('../stores/perkDraftStore').then(({ usePerkDraftStore }) => {
            usePerkDraftStore.getState().setPendingDrafts(data.pendingDrafts || [])
          })
        }
      } catch (err) {
        console.error('Error in perk:draft-available handler:', err)
      }
    })

    this.socket.on('perk:draft-result' as any, (data: any) => {
      try {
        console.log('Perk draft result:', data)
      } catch (err) {
        console.error('Error in perk:draft-result handler:', err)
      }
    })

    this.socket.on('perk:pool-exhausted' as any, (data: any) => {
      try {
        console.log('Perk pool exhausted:', data)
      } catch (err) {
        console.error('Error in perk:pool-exhausted handler:', err)
      }
    })

    // Error event handler
    this.socket.on('error', (data) => {
      console.error('Server error:', data)
      useGameStore.getState().setError(data.message)
    })
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached')
      useGameStore.getState().setError('Connection lost. Please refresh the page.')
      return
    }

    if (this.isConnecting) {
      console.log('⏳ Already attempting to reconnect...')
      return
    }

    this.reconnectAttempts++
    this.isConnecting = true

    // Exponential backoff with jitter
    const baseDelay = Math.min(10000, this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1))
    const jitter = Math.random() * 1000 // Add jitter to prevent thundering herd
    const delay = baseDelay + jitter

    console.log(`🔄 Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${Math.round(delay)}ms`)

    setTimeout(() => {
      if (this.reconnectAttempts <= this.maxReconnectAttempts) {
        this.connect()
      }
    }, delay)
  }

  connect(url?: string) {
    if (this.socket?.connected) {
      console.log('Already connected')
      return
    }

    if (this.isConnecting || SocketService.globalConnectionInProgress) {
      console.log('Connection already in progress, skipping...')
      return
    }

    // Clean up any existing socket before creating a new one
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }

    // Prepare a connection ID for optional registration with the optimizer
    this.connectionId = `socket-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const canRegister = performanceOptimizer.canCreateConnection(this.connectionId)

    // Mark as connecting so UI/state can reflect pending connection
    this.isConnecting = true
    SocketService.globalConnectionInProgress = true

    // Add a timeout to reset the global flag in case connection hangs
    setTimeout(() => {
      if (this.isConnecting) {
        console.warn('Connection timeout, resetting global flag')
        this.isConnecting = false
        SocketService.globalConnectionInProgress = false
      }
    }, 10000) // 10 second timeout

    // Resolve environment URL using process.env or fallback
    const envUrl: string | undefined =
      (typeof process !== 'undefined' && (process.env?.VITE_SOCKET_URL as string | undefined)) ||
      undefined

    // Prefer provided URL or env var; otherwise, use current origin (handles https/wss in prod)
    const serverUrl = url || envUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001')

    console.log('Connecting to socket server:', serverUrl)
    console.log('Environment VITE_SOCKET_URL:', envUrl)

    try {
      // Create socket using io function with improved configuration
      this.socket = io(serverUrl, {
        transports: ['polling', 'websocket'], // Start with polling, upgrade to websocket
        timeout: 60000, // Increased timeout for better stability
        reconnection: false, // We handle reconnection manually
        forceNew: false, // Allow connection reuse for better performance
        upgrade: true,
        rememberUpgrade: true, // Remember successful upgrades
        autoConnect: true,
        withCredentials: true, // Include credentials for CORS
        auth: {
          token: this.getAuthToken() // Include auth token if available
        }
      })

      // Setup event handlers immediately after socket creation
      this.setupEventHandlers()

      console.log('Socket created successfully, waiting for connection...')

    } catch (error) {
      console.error('Failed to create socket connection:', error)
      this.isConnecting = false
      useGameStore.getState().setError('Failed to establish connection')
      return
    }

    // Register the connection only if allowed by the optimizer
    if (canRegister) {
      performanceOptimizer.registerConnection(this.connectionId)
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
    }

    // Unregister the connection
    if (this.connectionId) {
      performanceOptimizer.unregisterConnection(this.connectionId)
      this.connectionId = ''
    }
  }

  // Wait until the socket is connected or timeout occurs
  private waitForConnection(timeoutMs: number = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket?.connected) {
        resolve()
        return
      }

      const start = Date.now()

      const check = () => {
        if (this.socket?.connected) {
          resolve()
          return
        }
        if (Date.now() - start >= timeoutMs) {
          reject(new Error('WebSocket connection timed out'))
          return
        }
        // Try again on next tick
        setTimeout(check, 50)
      }

      check()
    })
  }

  /** Public access to waitForConnection for components that need to join rooms */
  waitForConnectionPublic(timeoutMs: number = 5000): Promise<void> {
    return this.waitForConnection(timeoutMs)
  }

  emit(event: string, data?: Record<string, unknown>) {
    if (this.socket?.connected) {
      console.log('📤 Emitting socket event:', event, data)
      this.socket.emit(event, data)
    } else {
      console.warn('⚠️ Socket not connected, cannot emit:', event, 'Connection status:', this.getConnectionStatus())
      console.warn('Socket state:', {
        exists: !!this.socket,
        connected: this.socket?.connected,
        connecting: this.isConnecting,
        id: this.socket?.id
      })
      // Try to reconnect if not already connecting
      if (!this.isConnecting) {
        console.log('🔄 Attempting to reconnect...')
        this.connect()
      }
    }
  }

  on<T extends keyof SocketEvents>(event: T, callback: SocketEvents[T]) {
    if (this.socket) {
      this.socket.on(event, callback as any)
    }
  }

  off<T extends keyof SocketEvents>(event: T, callback?: SocketEvents[T]) {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback as any)
      } else {
        this.socket.off(event)
      }
    }
  }

  // Lobby methods
  async joinLobby(lobbyCode: string) {
    try {
      // First try API call
      const response = await apiService.joinLobby({
        lobbyCode
      })

      if (!response.success) {
        throw new Error(response.error || 'Failed to join lobby')
      }

      // Then emit socket event for real-time updates and room join
      if (!this.isConnected()) {
        console.log('Socket not connected, connecting...')
        this.connect()
      }
      try {
        console.log('Waiting for socket connection...')
        await this.waitForConnection()
        const user = apiService.getCurrentUser()
        const player = {
          id: String(user?.id || ''),
          username: String(user?.username || 'guest'),
          character: (user as Record<string, unknown>)?.['character'] || 'student',
          isHost: false,
        }
        console.log('Emitting join-lobby event with player:', player)
        this.emit('join-lobby', { lobbyCode, player })
      } catch (e) {
        console.warn('Proceeding without socket emit due to connection issue:', e)
      }

      return response
    } catch (error) {
      console.error('Failed to join lobby:', error)
      useGameStore.getState().setError(error instanceof Error ? error.message : 'Failed to join lobby')
      throw error
    }
  }

  async createLobby(settings: { questionCount: number; questionSetKey?: string; isPrivate?: boolean }) {
    try {
      // First try API call
      const response = await apiService.createLobby({
        questionCount: settings.questionCount,
        settings: {
          ...(settings.questionSetKey ? { selectedQuestionSet: settings.questionSetKey } : {}),
          ...(settings.isPrivate !== undefined ? { visibility: settings.isPrivate ? 'private' : 'public' } : {}),
        }
      })

      if (!response.success) {
        throw new Error(response.error || 'Failed to create lobby')
      }

      // Ensure socket connection and join the room as host for real-time updates
      // Note: The API already added the host player, so the backend will detect this
      // as a duplicate join and just add us to the socket room without broadcasting
      if (!this.isConnected()) {
        this.connect()
      }
      try {
        await this.waitForConnection()
        const user = apiService.getCurrentUser()
        const player = {
          id: String(user?.id || ''),
          username: String(user?.username || 'host'),
          character: (user as Record<string, unknown>)?.['character'] || 'student',
          isHost: true,
        }
        if (response.data?.code) {
          this.emit('join-lobby', { lobbyCode: response.data.code, player })
        }
      } catch (e) {
        console.warn('Proceeding without socket emit due to connection issue:', e)
      }

      return response
    } catch (error) {
      console.error('Failed to create lobby:', error)
      useGameStore.getState().setError(error instanceof Error ? error.message : 'Failed to create lobby')
      throw error
    }
  }

  setReady(isReady: boolean) {
    const { lobbyCode } = useGameStore.getState()
    const user = apiService.getCurrentUser()
    if (!lobbyCode || !user?.id) {
      console.warn('Missing lobby code or user for ready event')
      return
    }
    console.log('Emitting player-ready event:', { lobbyCode, playerId: String(user?.id || ''), isReady })
    this.emit('player-ready', { lobbyCode, playerId: String(user?.id || ''), isReady })
  }

  startGame() {
    const { lobbyCode } = useGameStore.getState()
    const user = apiService.getCurrentUser()
    if (!lobbyCode || !user?.id) {
      console.warn('Missing lobby code or host user for start event')
      return
    }
    this.emit('start-game', { lobbyCode, hostId: String(user?.id || '') })
  }

  // Game methods
  submitAnswer(answerIndex: number) {
    const { lobbyCode, currentQuestion } = useGameStore.getState()
    const user = apiService.getCurrentUser()
    if (!lobbyCode || !user?.id) {
      console.warn('Missing lobby code or user for submit answer')
      return
    }

    // Convert answer index to answer text for backend compatibility
    const answerText = currentQuestion?.answers?.[answerIndex] || String(answerIndex)
    console.log('Submitting answer:', { answerIndex, answerText, questionAnswers: currentQuestion?.answers })

    this.emit('submit-answer', {
      lobbyCode,
      playerId: String(user?.id || ''),
      answer: answerText,  // Send answer text, not index
      timeElapsed: 0
    })
  }

  // Question set management methods
  updateQuestionSets(lobbyCode: string, hostId: string, questionSetIds: number[], questionCount: number) {
    this.emit('update-question-sets', {
      lobbyCode,
      hostId,
      questionSetIds,
      questionCount
    })
  }

  getQuestionSetInfo(lobbyCode: string) {
    this.emit('get-question-set-info', { lobbyCode })
  }

  // Lobby management methods
  leaveLobby(lobbyCode: string, playerId: string) {
    this.emit('leave-lobby', { lobbyCode, playerId })
  }

  // Perk draft methods
  perkPick(level: number, perkId: number) {
    this.emit('perk:pick', { level, perkId })
  }

  perkDump(level: number) {
    this.emit('perk:dump', { level })
  }

  // Utility methods
  isConnected(): boolean {
    return this.socket?.connected || false
  }

  getConnectionStatus(): 'connected' | 'connecting' | 'disconnected' {
    if (this.socket?.connected) return 'connected'
    if (this.isConnecting) return 'connecting'
    return 'disconnected'
  }

  private getAuthToken(): string | undefined {
    try {
      // Get token from localStorage or apiService
      const token = localStorage.getItem('auth_token') || apiService.getToken()
      return token || undefined
    } catch (error) {
      console.warn('Failed to get auth token:', error)
      return undefined
    }
  }
}

// Export singleton instance
export const socketService = new SocketService() 
