import { Server } from 'socket.io';
import { GameSessionRepository, CreateGameSessionData } from '../repositories/GameSessionRepository.js';
import { QuestionService } from './QuestionService.js';
import { ScoringService } from './ScoringService.js';
import { RequestLogger } from '../middleware/logging.js';
import { LobbyService } from './LobbyService.js';
import { CharacterService } from './CharacterService.js';
import { PerkDraftService, DraftPerk } from './PerkDraftService.js';
import { PerkEffectEngine, GameplayModifiers, ScoreContext } from './PerkEffectEngine.js';
import { PerksManager } from './PerksManager.js';
import type { AnswerType, AnswerMetadata, EstimationMetadata, OrderingMetadata, MatchingMetadata, FillInBlankMetadata } from '../types/question.js';

export type GameMode = 'arcade' | 'practice' | 'fastest_finger' | 'survival' | 'wager' | 'duel';

export interface GameState {
  lobbyCode: string;
  gameSessionId: number;
  currentQuestionIndex: number;
  totalQuestions: number;
  timeRemaining: number;
  isActive: boolean;
  gameMode: GameMode;
  players: GamePlayer[];
  currentQuestion?: QuestionData | undefined;
  questionStartTime?: number | undefined;
  selectedQuestionSetIds: number[];
  questions: QuestionData[];

  // Fastest Finger mode
  firstCorrectPlayerId?: string | null;

  // Survival mode
  playerLives?: Map<string, number>;
  eliminatedPlayers?: Set<string>;

  // Wager mode
  wagerPhaseActive?: boolean;
  playerWagers?: Map<string, number>;
  wagerTimer?: NodeJS.Timeout | undefined;

  // Duel mode
  duelQueue?: string[];
  currentDuelPair?: [string, string];
  duelWins?: Map<string, number>;
}

export interface CosmeticEffects {
  helper?: { perk_id: number; perk_name?: string; configuration: any };
  display?: { perk_id: number; perk_name?: string; configuration: any };
  emote?: { perk_id: number; perk_name?: string; configuration: any };
  sound?: { perk_id: number; perk_name?: string; configuration: any };
  multiplier?: { perk_id: number; perk_name?: string; configuration: any };
}

export interface GamePlayer {
  id: string;
  username: string;
  character: string;
  characterLevel?: number;
  title?: string; // Active cosmetic title (e.g., "Master Scholar")
  isHost: boolean;
  score: number;
  multiplier: number;
  correctAnswers: number;
  wrongAnswers: number;
  currentStreak: number; // Track consecutive correct answers for streak sounds
  lastWrongStreak: number; // Track consecutive wrong answers for phoenix perk
  hasAnsweredCurrentQuestion: boolean;
  currentAnswer?: string | undefined;
  answerTime?: number | undefined;
  isConnected: boolean;
  perkModifiers?: GameplayModifiers;
  cosmeticEffects?: CosmeticEffects;
  freeWrongsUsed: number;

  // Survival mode
  lives?: number;
  isEliminated?: boolean;

  // Wager mode
  currentWager?: number;

  // Duel mode
  isDueling?: boolean;
  isSpectating?: boolean;
}

export interface QuestionData {
  id: number;
  question: string;
  answers: string[];
  correctAnswer: string;
  questionSetId: number;
  language: string;
  explanation?: string | undefined;
  answerType: AnswerType;
  hint?: string | undefined;
  answerMetadata?: AnswerMetadata | undefined;
  difficulty?: number | undefined;
  category?: string | undefined;
}

export class GameService {
  public io: Server;
  private lobbyService: LobbyService;
  private questionService: QuestionService;
  private scoringService: ScoringService;
  private characterService: CharacterService;
  private perkDraftService: PerkDraftService;
  private gameSessionRepository: GameSessionRepository;
  private activeGames: Map<string, GameState> = new Map();
  private gameTimers: Map<string, NodeJS.Timeout> = new Map();
  private nextQuestionTimers: Map<string, NodeJS.Timeout> = new Map();
  private disconnectGraceTimers: Map<string, NodeJS.Timeout> = new Map();
  private answerLocks: Set<string> = new Set();
  private isTestEnvironment: boolean;

  private getIo() {
    if (typeof this.io === 'undefined' || this.io === null) {
      return null;
    }
    return this.io;
  }

  /**
   * Clear all timers for a lobby
   * @param lobbyCode The lobby code
   */
  private clearTimers(lobbyCode: string): void {
    // Clear the main game timer
    const gameTimer = this.gameTimers.get(lobbyCode);
    if (gameTimer) {
      clearInterval(gameTimer);
      this.gameTimers.delete(lobbyCode);
    }

    // Clear the next question timer
    const nextQuestionTimer = this.nextQuestionTimers.get(lobbyCode);
    if (nextQuestionTimer) {
      clearTimeout(nextQuestionTimer);
      this.nextQuestionTimers.delete(lobbyCode);
    }
  }

  /**
   * Clear only the active per-question countdown timer
   */
  private clearGameTimer(lobbyCode: string): void {
    const gameTimer = this.gameTimers.get(lobbyCode);
    if (gameTimer) {
      clearInterval(gameTimer);
      this.gameTimers.delete(lobbyCode);
    }
  }

  /**
   * Start the timer for the current question
   * @param lobbyCode The lobby code
   */
  private startQuestionTimer(lobbyCode: string): void {
    const gameState = this.activeGames.get(lobbyCode);
    if (!gameState) return;

    // Clear any existing timer
    this.clearTimers(lobbyCode);

    // Start a new interval to update the timer
    const timer = setInterval(() => {
      if (gameState.timeRemaining <= 0) {
        clearInterval(timer);
        this.gameTimers.delete(lobbyCode);
        this.endQuestion(lobbyCode).catch(error => {
          if (!this.isTestEnvironment) {
            console.error(`Error ending question for lobby ${lobbyCode}:`, error);
          }
        });
        return;
      }

      gameState.timeRemaining--;

      // Emit time update to all clients
      this.getIo()?.to(lobbyCode)?.emit('time-update', {
        timeRemaining: gameState.timeRemaining
      });

      // Check for time warnings
      if (gameState.timeRemaining === 10 || gameState.timeRemaining === 5) {
        this.getIo()?.to(lobbyCode)?.emit('time-warning', {
          timeRemaining: gameState.timeRemaining
        });
      }
    }, 1000);

    // Store the timer so we can clear it later
    this.gameTimers.set(lobbyCode, timer);

    // In test environment, we don't want the timer to keep the process alive
    if (this.isTestEnvironment && timer.unref) {
      timer.unref();
    }
  }

  /**
   * Start the next question in the game
   * @param lobbyCode The lobby code
   */
  async startNextQuestion(lobbyCode: string): Promise<void> {
    const gameState = this.activeGames.get(lobbyCode);
    if (!gameState) {
      // In test environment or when called from timer, just return if game not found
      if (this.isTestEnvironment) {
        return;
      }
      throw new Error(`Game not found for lobby: ${lobbyCode}`);
    }

    // Clear any existing timers
    this.clearTimers(lobbyCode);

    // Check if we've reached the end of the game
    if (gameState.currentQuestionIndex >= gameState.questions.length - 1) {
      await this.endGameSession(lobbyCode);
      return;
    }

    // Move to the next question
    gameState.currentQuestionIndex++;
    const noTimerModes: GameMode[] = ['practice'];
    const shortTimerModes: GameMode[] = ['duel'];
    if (noTimerModes.includes(gameState.gameMode)) {
      gameState.timeRemaining = 0;
    } else if (shortTimerModes.includes(gameState.gameMode)) {
      gameState.timeRemaining = 30;
    } else {
      gameState.timeRemaining = 60;
    }

    // Get the current question
    const currentQuestion = gameState.questions[gameState.currentQuestionIndex];
    if (!currentQuestion) {
      throw new Error(`Question not found at index ${gameState.currentQuestionIndex}`);
    }

    // Shuffle answer options so correct answer position is randomized
    if (currentQuestion.answers && currentQuestion.answers.length > 1) {
      currentQuestion.answers = [...currentQuestion.answers].sort(() => Math.random() - 0.5);
    }

    // Update the game state
    gameState.currentQuestion = currentQuestion;
    gameState.questionStartTime = Date.now();

    // Reset player states for the new question
    gameState.players.forEach(player => {
      // Survival: skip eliminated players (auto-mark as answered)
      if (gameState.gameMode === 'survival' && player.isEliminated) {
        player.hasAnsweredCurrentQuestion = true;
        player.currentAnswer = undefined;
        player.answerTime = undefined;
        return;
      }
      player.hasAnsweredCurrentQuestion = false;
      player.currentAnswer = undefined;
      player.answerTime = undefined;
    });

    // Fastest Finger: reset first correct tracker
    if (gameState.gameMode === 'fastest_finger') {
      gameState.firstCorrectPlayerId = null;
    }

    // Survival: check if game should end (<=1 alive)
    if (gameState.gameMode === 'survival') {
      const alivePlayers = gameState.players.filter(p => !p.isEliminated);
      if (alivePlayers.length <= 1) {
        const winner = alivePlayers[0];
        if (winner) {
          this.getIo()?.to(lobbyCode)?.emit('survival-winner', {
            winnerId: winner.id,
            username: winner.username,
          });
        }
        await this.endGameSession(lobbyCode);
        return;
      }
    }

    // Build per-player INFO perk effects for the question-started payload
    const playerPerkEffects: Record<string, Record<string, boolean>> = {};
    for (const player of gameState.players) {
      if (player.perkModifiers) {
        const effects = PerkEffectEngine.extractInfoEffects(player.perkModifiers);
        if (Object.keys(effects).length > 0) {
          playerPerkEffects[player.id] = effects;
        }
      }
    }
    const perkEffectsPayload = Object.keys(playerPerkEffects).length > 0
      ? { playerPerkEffects }
      : {};

    // Duel: only duelists receive the question
    if (gameState.gameMode === 'duel') {
      // Mark non-duelists as already answered (spectators)
      const pair = gameState.currentDuelPair;
      gameState.players.forEach(player => {
        if (!pair || (player.id !== pair[0] && player.id !== pair[1])) {
          player.hasAnsweredCurrentQuestion = true;
          player.isDueling = false;
          player.isSpectating = true;
        } else {
          player.isDueling = true;
          player.isSpectating = false;
        }
      });
      this.getIo()?.to(lobbyCode)?.emit('duel-question-started', {
        question: currentQuestion,
        duelists: pair ? [pair[0], pair[1]] : [],
        questionIndex: gameState.currentQuestionIndex,
        totalQuestions: gameState.totalQuestions,
        timeRemaining: gameState.timeRemaining,
        ...perkEffectsPayload,
      });
    } else {
      // Emit the next question to all players (send full object; use 0-based index)
      this.getIo()?.to(lobbyCode)?.emit('question-started', {
        question: currentQuestion,
        questionIndex: gameState.currentQuestionIndex,
        totalQuestions: gameState.totalQuestions,
        timeRemaining: gameState.timeRemaining,
        gameMode: gameState.gameMode,
        ...perkEffectsPayload,
      });
    }

    // Start timer for all modes except practice (which has no timer)
    if (gameState.gameMode !== 'practice') {
      this.startQuestionTimer(lobbyCode);
    }
  }

  constructor(io: Server) {
    this.io = io;
    this.lobbyService = new LobbyService();
    this.questionService = new QuestionService();
    this.scoringService = new ScoringService();
    this.characterService = new CharacterService();
    this.perkDraftService = PerkDraftService.getInstance();
    this.gameSessionRepository = new GameSessionRepository();
    this.isTestEnvironment = process.env['NODE_ENV'] === 'test' || process.env['TEST_ENVIRONMENT'] === 'local';
  }

  /**
   * Start a new game session
   */
  async startGameSession(lobbyCode: string, hostId: number): Promise<GameState> {
    try {
      // Get lobby information
      const lobby = await this.lobbyService.getLobbyByCode(lobbyCode);
      if (!lobby) {
        throw new Error('Lobby not found');
      }

      // Verify host permission (check both host_id and auth_user_id)
      if (lobby.host_id !== hostId && lobby.auth_user_id !== hostId) {
        throw new Error('Only the host can start the game');
      }

      // Check if game is already active
      if (this.activeGames.has(lobbyCode)) {
        throw new Error('Game is already in progress');
      }

      // Mark lobby as playing immediately so clients can navigate
      try {
        await this.lobbyService.updateLobbyStatus(lobbyCode, 'playing');
      } catch (e) {
        // Non-fatal: continue to start the game; clients rely primarily on socket events
        console.warn('Failed to update lobby status to playing:', e);
      }

      // Get question set information from lobby settings
      const questionSetInfo = await this.lobbyService.getLobbyQuestionSetInfo(lobbyCode);

      // Allow start without explicit selection by falling back to a default set
      let selectedQuestionSetIds: number[] = [];
      let totalQuestions: number;

      if (!questionSetInfo) {
        // Get the first available question set from database instead of hardcoding ID 1
        const availableQuestionSets = await this.questionService.getAllQuestionSets();
        if (availableQuestionSets.length > 0) {
          selectedQuestionSetIds = [availableQuestionSets[0]!.id];
          totalQuestions = 10;
        } else {
          throw new Error('No question sets available in database');
        }
      } else {
        selectedQuestionSetIds = (questionSetInfo.selectedSets || []).map(set => set.id);
        totalQuestions = questionSetInfo.selectedQuestionCount;
        if (selectedQuestionSetIds.length === 0) {
          // Get the first available question set from database instead of hardcoding ID 1
          const availableQuestionSets = await this.questionService.getAllQuestionSets();
          if (availableQuestionSets.length > 0) {
            selectedQuestionSetIds = [availableQuestionSets[0]!.id];
          }
        }
      }

      // Load all questions for the selected sets
      let questions = await this.questionService.getRandomQuestions({
        questionSetIds: selectedQuestionSetIds,
        count: totalQuestions
      });

      // If no questions available in selected sets, try fallback
      if (!questions || questions.length === 0) {
        console.warn(`No questions available in selected sets: ${selectedQuestionSetIds.join(', ')}. Using fallback questions.`);
        // Try to get questions from default question set as fallback
        const fallbackQuestions = await this.questionService.getRandomQuestions({
          questionSetIds: [1], // Default fallback question set
          count: totalQuestions
        });

        if (!fallbackQuestions || fallbackQuestions.length === 0) {
          // If still no questions, create hardcoded fallback questions
          const hardcodedFallbackQuestions = this.createFallbackQuestions(totalQuestions);
          questions = hardcodedFallbackQuestions.map((q: QuestionData) => ({
            id: q.id,
            question_set_id: q.questionSetId,
            question_text: q.question,
            answers: q.answers.map((answer, index) => ({
              id: index,
              question_id: q.id,
              text: answer,
              correct: answer === q.correctAnswer,
              created_at: new Date()
            })),
            difficulty: 1,
            created_at: new Date(),
            ...(q.explanation && {
              explanation: q.explanation
            })
          }));
        } else {
          questions = fallbackQuestions;
        }
      }

      // Build question set ID → category map for INFO perks
      const questionSetCategoryMap = new Map<number, string>();
      try {
        const allQuestionSets = await this.questionService.getAllQuestionSets();
        for (const qs of allQuestionSets) {
          if (qs.category) {
            questionSetCategoryMap.set(qs.id, qs.category);
          }
        }
      } catch (e) {
        // Non-fatal: category info is a perk bonus, not essential
        console.warn('Failed to load question set categories for INFO perks:', e);
      }

      // Convert questions to German-only format
      const localizedQuestions: QuestionData[] = questions.map((q: any) => {
        // Get question text (now always a German string)
        const questionText = q.question_text;

        // Handle answers - extract text and find correct answer
        const answerList: string[] = [];
        let correctAnswerText = '';

        if (Array.isArray(q.answers)) {
          q.answers.forEach((answer: any) => {
            const answerText = answer.text || '';
            if (answerText) {
              answerList.push(answerText);
              // Check if this is the correct answer
              if (answer.correct === true) {
                correctAnswerText = answerText;
              }
            }
          });
        }

        return {
          id: q.id,
          question: questionText,
          answers: answerList,
          correctAnswer: correctAnswerText || (answerList[0] || ''),
          questionSetId: q.question_set_id || 1,
          language: 'de',
          explanation: q.explanation,
          answerType: q.answer_type || 'multiple_choice',
          hint: q.hint || undefined,
          answerMetadata: q.answer_metadata || undefined,
          difficulty: q.difficulty || undefined,
          category: questionSetCategoryMap.get(q.question_set_id) || undefined,
        };
      });

      // Create game session in database
      const gameSessionData: CreateGameSessionData = {
        lobby_id: lobby.id,
        total_questions: totalQuestions,
        session_data: {
          ...lobby.settings,
          selectedQuestionSetIds,
          questions: localizedQuestions.map(q => ({
            id: q.id,
            questionSetId: q.questionSetId
          }))
        }
      };

      // Add question_set_id if available
      if (selectedQuestionSetIds.length > 0) {
        (gameSessionData as CreateGameSessionData & { question_set_id?: number }).question_set_id = selectedQuestionSetIds[0]!;
      }

      const gameSession = await this.gameSessionRepository.createGameSession(gameSessionData);

      // Read game mode from lobby settings (defaults to arcade)
      const validGameModes: GameMode[] = ['arcade', 'practice', 'fastest_finger', 'survival', 'wager', 'duel'];
      const rawMode = (lobby.settings as any)?.gameMode;
      const gameMode: GameMode = validGameModes.includes(rawMode) ? rawMode : 'arcade';

      // Initialize game state
      const gameState: GameState = {
        lobbyCode,
        gameSessionId: gameSession.id as number,
        currentQuestionIndex: -1,
        totalQuestions,
        timeRemaining: 60,
        isActive: true,
        gameMode,
        selectedQuestionSetIds,
        questions: localizedQuestions,
        players: lobby.players.map(player => ({
          id: player.id,
          username: player.username,
          character: player.character,
          characterLevel: player.characterLevel || 1,
          isHost: player.isHost,
          score: 0,
          multiplier: 1,
          correctAnswers: 0,
          wrongAnswers: 0,
          currentStreak: 0,
          lastWrongStreak: 0,
          hasAnsweredCurrentQuestion: false,
          isConnected: player.isConnected,
          freeWrongsUsed: 0,
        }))
      };

      // Mode-specific initialization
      if (gameMode === 'survival') {
        gameState.playerLives = new Map();
        gameState.eliminatedPlayers = new Set();
        for (const player of gameState.players) {
          gameState.playerLives.set(player.id, 3);
          player.lives = 3;
          player.isEliminated = false;
        }
      }
      if (gameMode === 'wager') {
        gameState.playerWagers = new Map();
        // Give all players starting score of 100
        for (const player of gameState.players) {
          player.score = 100;
        }
      }
      if (gameMode === 'duel') {
        // Shuffle players into queue
        const shuffled = [...gameState.players].sort(() => Math.random() - 0.5);
        gameState.duelQueue = shuffled.map(p => p.id);
        gameState.duelWins = new Map();
        for (const player of gameState.players) {
          gameState.duelWins!.set(player.id, 0);
          player.isDueling = false;
          player.isSpectating = true;
        }
        // Set first duel pair
        if (gameState.duelQueue.length >= 2) {
          gameState.currentDuelPair = [gameState.duelQueue[0]!, gameState.duelQueue[1]!];
          const p1 = gameState.players.find(p => p.id === gameState.duelQueue![0]);
          const p2 = gameState.players.find(p => p.id === gameState.duelQueue![1]);
          if (p1) { p1.isDueling = true; p1.isSpectating = false; }
          if (p2) { p2.isDueling = true; p2.isSpectating = false; }
        }
      }
      if (gameMode === 'fastest_finger') {
        gameState.firstCorrectPlayerId = null;
      }

      // Store active game
      this.activeGames.set(lobbyCode, gameState);

      // Load perk modifiers and cosmetic data for each player
      const perksManager = PerksManager.getInstance();
      for (const player of gameState.players) {
        try {
          const numericId = parseInt(player.id, 10);
          if (!isNaN(numericId)) {
            // Load gameplay perks
            const activePerks = await this.perkDraftService.getActiveGameplayPerks(numericId);

            // Also load cosmetic perks with game effects (multiplier + helper slots)
            const cosmeticGameEffectIds = await perksManager.getActiveCosmeticGameEffectPerkIds(numericId);
            if (cosmeticGameEffectIds.length > 0) {
              const cosmeticPerks = await this.perkDraftService.getPerksByIds(cosmeticGameEffectIds);
              activePerks.push(...cosmeticPerks);
            }

            if (activePerks.length > 0) {
              player.perkModifiers = PerkEffectEngine.buildModifiers(activePerks);
            }

            // Load player title from loadout
            const loadout = await perksManager.getUserLoadout(numericId);
            if (loadout?.active_title) {
              player.title = loadout.active_title;
            }

            // Load cosmetic visual effect configs (helper, display, emote, sound)
            const cosmeticConfigs = await perksManager.getCosmeticEffectConfigs(numericId);
            if (Object.keys(cosmeticConfigs).length > 0) {
              player.cosmeticEffects = cosmeticConfigs as CosmeticEffects;
            }
          }
        } catch (e) {
          // Non-fatal: player plays without perk modifiers
          console.warn(`[GameService] Failed to load perks for player ${player.id}:`, e);
        }
      }

      // Update lobby status to indicate the game is starting (synchronization phase)
      await (this as any).lobbyService.updateLobbyStatus(lobbyCode, 'starting');

      // Start the game with a 5-second synchronization countdown
      let syncCountdown = 5;

      // Emit initial sync event
      if (this.io && typeof this.io.to === 'function') {
        this.io?.to(lobbyCode)?.emit('game-syncing', {
          countdown: syncCountdown,
          message: 'Synchronisiere Spieler...'
        });
      }

      const syncTimer = setInterval(async () => {
        syncCountdown--;

        if (syncCountdown <= 0) {
          clearInterval(syncTimer);

          try {
            // Update lobby status to 'playing' now that synchronization is over
            await (this as any).lobbyService.updateLobbyStatus(lobbyCode, 'playing');

            // Start the first question after synchronization
            await this.startNextQuestion(lobbyCode);
          } catch (error) {
            if (!this.isTestEnvironment) {
              console.error(`Error in sync timer for lobby ${lobbyCode}:`, error);
            }
          }
        } else {
          // Emit sync update
          this.io?.to(lobbyCode)?.emit('game-syncing', {
            countdown: syncCountdown,
            message: 'Synchronisiere Spieler...'
          });
        }
      }, 1000);

      // Prevent sync timer from keeping the event loop alive in tests
      if (this.isTestEnvironment && syncTimer.unref) {
        syncTimer.unref();
      }

      RequestLogger.logGameEvent('game-started', lobbyCode, undefined, {
        gameSessionId: gameSession.id,
        questionSetIds: selectedQuestionSetIds,
        totalQuestions
      });

      // Return the updated game state from the map after starting the first question
      return this.activeGames.get(lobbyCode) || gameState;
    } catch (error) {
      console.error('Error starting game session:', error);
      throw error;
    }
  }


  /**
   * Start the 60-second timer for the current question
   */


  /**
   * End the current question and calculate results
   * @param lobbyCode The lobby code
   */
  private async endQuestion(lobbyCode: string): Promise<void> {
    const gameState = this.activeGames.get(lobbyCode);
    if (!gameState || !gameState.currentQuestion) return;

    try {
      // Calculate and emit results
      const results = this.calculateQuestionResults(gameState);
      // Legacy/internal event
      if (this.io) {
        this.getIo()?.to(lobbyCode)?.emit('question-results', results);
      }
      // Frontend expects 'question-ended' with a flat results array of players
      const endedPayload = {
        results: gameState.players.map(p => ({ id: p.id, score: p.score, multiplier: p.multiplier })),
        correctAnswer: gameState.currentQuestion.correctAnswer,
        questionIndex: gameState.currentQuestionIndex,
        totalQuestions: gameState.totalQuestions
      };
      if (this.io) {
        this.getIo()?.to(lobbyCode)?.emit('question-ended', endedPayload);
      }

      // Player scores are already updated in calculateQuestionResults

      // Survival: check if only 1 player alive → end game
      if (gameState.gameMode === 'survival') {
        const alivePlayers = gameState.players.filter(p => !p.isEliminated);
        if (alivePlayers.length <= 1) {
          const winner = alivePlayers[0];
          if (winner) {
            this.getIo()?.to(lobbyCode)?.emit('survival-winner', {
              winnerId: winner.id,
              username: winner.username,
            });
          }
          await this.endGameSession(lobbyCode);
          return;
        }
      }

      // Determine if game should continue or end
      const isLastQuestion = gameState.currentQuestionIndex >= gameState.questions.length - 1 ||
        gameState.currentQuestionIndex >= gameState.totalQuestions - 1;

      if (isLastQuestion) {
        // Duel: emit final result
        if (gameState.gameMode === 'duel' && gameState.duelWins) {
          let bestId = '';
          let bestWins = -1;
          for (const [id, wins] of gameState.duelWins) {
            if (wins > bestWins) { bestWins = wins; bestId = id; }
          }
          const winner = gameState.players.find(p => p.id === bestId);
          this.getIo()?.to(lobbyCode)?.emit('duel-ended', {
            winnerId: bestId,
            username: winner?.username || '',
            finalWins: bestWins,
          });
        }
        // End the game session
        await this.endGameSession(lobbyCode);
      } else {
        // Schedule next question
        const nextQuestionTimer = setTimeout(() => {
          this.startNextQuestion(lobbyCode).catch(error => {
            // Handle errors gracefully in timer callbacks
            if (!this.isTestEnvironment) {
              console.error(`Error starting next question for lobby ${lobbyCode}:`, error);
            }
          });
        }, 5000); // 5 second delay before next question

        this.nextQuestionTimers.set(lobbyCode, nextQuestionTimer);

        // Prevent timer from keeping the event loop alive in tests
        if (this.isTestEnvironment) {
          (nextQuestionTimer as NodeJS.Timeout).unref();
        }
      }

      // Clear only the running countdown timer; keep the scheduled next-question timer
      this.clearGameTimer(lobbyCode);
    } catch (error) {
      console.error(`Error in endQuestion for lobby ${lobbyCode}:`, error);
      if (!this.isTestEnvironment) {
        throw error;
      }
    }
  }

  /**
   * Calculate results for the current question
   */
  private calculateQuestionResults(gameState: GameState): any {
    const results = {
      questionIndex: gameState.currentQuestionIndex,
      correctAnswer: gameState.currentQuestion?.correctAnswer,
      playerResults: [] as Array<{
        playerId: string;
        isCorrect: boolean;
        score: number;
        streak: number;
      }>,
      leaderboard: [] as Array<{
        playerId: string;
        username: string;
        score: number;
        position: number;
      }>
    };

    // Calculate individual results
    gameState.players.forEach(player => {
      // Determine if the player answered correctly this round
      const hasAnswered = !!player.hasAnsweredCurrentQuestion;
      const isCorrect = hasAnswered && player.currentAnswer === gameState.currentQuestion?.correctAnswer;

      // player.answerTime is already stored in seconds at submit time; use it directly
      const timeElapsed = typeof player.answerTime === 'number' ? player.answerTime : 60;

      // Compute a non-mutating summary for this question (for result payloads)
      const scoreCalculation = isCorrect
        ? this.scoringService.calculateScore(timeElapsed, player.multiplier, isCorrect, player.currentStreak || 0)
        : { pointsEarned: 0, newMultiplier: 1, streakCount: 0, timeElapsed, multiplier: player.multiplier, isCorrect };

      // Important: Do not add points or increment counters here; submitAnswer already applied
      // Ensure players who did not answer get their streak/multiplier reset
      if (!hasAnswered) {
        player.currentStreak = 0;
        player.multiplier = 1;
      }

      results.playerResults.push({
        playerId: player.id,
        isCorrect,
        // Keep per-question delta informational only; avoid double-counting by not mutating score
        score: scoreCalculation.pointsEarned,
        streak: hasAnswered ? player.currentStreak : 0
      });
    });

    // Sort players by score for leaderboard
    const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score);
    results.leaderboard = sortedPlayers.map((player, index) => ({
      playerId: player.id,
      username: player.username,
      score: player.score,
      position: index + 1
    }));

    return results;
  }

  /**
   * Update player scores based on question results
   */
  private updatePlayerScores(gameState: GameState, results: any): void {
    gameState.players.forEach(player => {
      const playerResult = results.playerResults.find((p: any) => p.playerId === player.id);
      if (!playerResult) return;

      // Update player's score and streak
      player.score += playerResult.score;
      player.currentStreak = playerResult.isCorrect ? player.currentStreak + 1 : 0;
    });
  }

  /**
   * End the game session and clean up
   */
  private async endGameSession(lobbyCode: string): Promise<void> {
    const gameState = this.activeGames.get(lobbyCode);
    if (!gameState) return;

    try {
      // Save game results to database (non-fatal — continue even if this fails)
      try {
        await this.gameSessionRepository.endGameSession(gameState.gameSessionId, {
          scores: gameState.players.map(p => ({
            playerId: p.id,
            score: p.score,
            correctAnswers: p.correctAnswers
          }))
        });
      } catch (dbError) {
        console.error(`[GameService] Failed to save game session ${gameState.gameSessionId} to DB:`, dbError);
      }

      // Save player results and calculate experience — this also emits game-ended
      await this.savePlayerResults(gameState);

      // Emit game over event (legacy, for any listeners)
      this.getIo()?.to(lobbyCode)?.emit('game-over', {
        leaderboard: gameState.players
          .map(p => ({
            playerId: p.id,
            username: p.username,
            score: p.score,
            correctAnswers: p.correctAnswers
          }))
          .sort((a, b) => b.score - a.score)
      });
    } catch (error) {
      if (!this.isTestEnvironment) {
        console.error('Error ending game session:', error);
      }
    } finally {
      // Clean up
      this.clearTimers(lobbyCode);
      this.activeGames.delete(lobbyCode);

      // Delete the lobby — game is over, the session is fully persisted
      try {
        await this.lobbyService.deleteLobbyByCode(lobbyCode);
      } catch (error) {
        console.warn('Failed to delete lobby after game end:', error);
      }
    }
  }

  async submitAnswer(lobbyCode: string, playerId: string, answer: string, wagerPercent?: number): Promise<void> {
    // Atomic lock to prevent concurrent double-submissions for the same player
    const lockKey = `${lobbyCode}:${playerId}`;
    if (this.answerLocks.has(lockKey)) {
      throw new Error('Answer submission already in progress');
    }
    this.answerLocks.add(lockKey);

    try {
      return await this._submitAnswerInner(lobbyCode, playerId, answer, wagerPercent);
    } finally {
      this.answerLocks.delete(lockKey);
    }
  }

  /**
   * Check a player's answer against the correct answer, supporting all answer types.
   * Returns whether the answer is correct and a partial score (0.0 to 1.0).
   */
  private checkAnswer(
    answer: string,
    question: QuestionData
  ): { isCorrect: boolean; partialScore: number } {
    const answerType = question.answerType || 'multiple_choice';

    switch (answerType) {
      case 'multiple_choice':
      case 'true_false':
        return {
          isCorrect: answer === question.correctAnswer,
          partialScore: answer === question.correctAnswer ? 1.0 : 0.0,
        };

      case 'free_text':
      case 'fill_in_blank':
        {
          const isCorrect =
            answer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();
          return { isCorrect, partialScore: isCorrect ? 1.0 : 0.0 };
        }

      case 'estimation':
        {
          const meta = question.answerMetadata as EstimationMetadata | undefined;
          if (!meta || typeof meta.correct_value !== 'number' || typeof meta.tolerance !== 'number' || meta.tolerance <= 0) {
            // Fallback: exact string match if metadata is missing/invalid
            const exact = answer.trim() === question.correctAnswer.trim();
            return { isCorrect: exact, partialScore: exact ? 1.0 : 0.0 };
          }

          const numericAnswer = parseFloat(answer);
          if (isNaN(numericAnswer)) {
            return { isCorrect: false, partialScore: 0.0 };
          }

          const distance = Math.abs(numericAnswer - meta.correct_value);
          const effectiveTolerance = meta.tolerance_type === 'percentage'
            ? Math.abs(meta.correct_value) * (meta.tolerance / 100)
            : meta.tolerance;

          if (effectiveTolerance <= 0) {
            const exact = distance === 0;
            return { isCorrect: exact, partialScore: exact ? 1.0 : 0.0 };
          }

          const partialScore = Math.max(0, 1 - distance / effectiveTolerance);
          return { isCorrect: partialScore > 0, partialScore };
        }

      case 'ordering':
        {
          const meta = question.answerMetadata as OrderingMetadata | undefined;
          if (!meta || !Array.isArray(meta.correct_order) || meta.correct_order.length === 0) {
            // Fallback: exact string match
            const exact = answer === question.correctAnswer;
            return { isCorrect: exact, partialScore: exact ? 1.0 : 0.0 };
          }

          let playerOrder: number[];
          try {
            playerOrder = JSON.parse(answer);
            if (!Array.isArray(playerOrder)) {
              return { isCorrect: false, partialScore: 0.0 };
            }
          } catch {
            return { isCorrect: false, partialScore: 0.0 };
          }

          const total = meta.correct_order.length;
          if (playerOrder.length !== total) {
            return { isCorrect: false, partialScore: 0.0 };
          }

          let correctPositions = 0;
          for (let i = 0; i < total; i++) {
            if (playerOrder[i] === meta.correct_order[i]) {
              correctPositions++;
            }
          }

          const partialScore = correctPositions / total;
          return { isCorrect: partialScore > 0, partialScore };
        }

      case 'matching':
        {
          const meta = question.answerMetadata as MatchingMetadata | undefined;
          if (!meta || !Array.isArray(meta.pairs) || meta.pairs.length === 0) {
            // Fallback: exact string match
            const exact = answer === question.correctAnswer;
            return { isCorrect: exact, partialScore: exact ? 1.0 : 0.0 };
          }

          let playerPairs: Array<{ left: string; right: string }>;
          try {
            playerPairs = JSON.parse(answer);
            if (!Array.isArray(playerPairs)) {
              return { isCorrect: false, partialScore: 0.0 };
            }
          } catch {
            return { isCorrect: false, partialScore: 0.0 };
          }

          const total = meta.pairs.length;
          let correctMatches = 0;

          for (const playerPair of playerPairs) {
            if (!playerPair || typeof playerPair.left !== 'string' || typeof playerPair.right !== 'string') {
              continue;
            }
            const isMatch = meta.pairs.some(
              correctPair =>
                correctPair.left === playerPair.left && correctPair.right === playerPair.right
            );
            if (isMatch) {
              correctMatches++;
            }
          }

          const partialScore = correctMatches / total;
          return { isCorrect: partialScore > 0, partialScore };
        }

      default:
        // Unknown type: fallback to exact match
        return {
          isCorrect: answer === question.correctAnswer,
          partialScore: answer === question.correctAnswer ? 1.0 : 0.0,
        };
    }
  }

  private async _submitAnswerInner(lobbyCode: string, playerId: string, answer: string, wagerPercent?: number): Promise<void> {
    const gameState = this.activeGames.get(lobbyCode);
    if (!gameState) {
      throw new Error('Game not active');
    }

    if (!gameState.currentQuestion) {
      throw new Error('No active question');
    }

    const player = gameState.players.find(p => p.id === playerId);
    if (!player) {
      throw new Error('Player not found');
    }

    // Check if player already answered
    if (player.hasAnsweredCurrentQuestion) {
      throw new Error('Player has already answered this question');
    }

    // Duel: reject answers from non-duelists
    if (gameState.gameMode === 'duel') {
      const pair = gameState.currentDuelPair;
      if (!pair || (playerId !== pair[0] && playerId !== pair[1])) {
        throw new Error('Only active duelists can answer');
      }
    }

    // Survival: reject answers from eliminated players
    if (gameState.gameMode === 'survival' && player.isEliminated) {
      throw new Error('Eliminated players cannot answer');
    }

    // Calculate time elapsed
    const timeElapsed = gameState.questionStartTime ?
      Math.floor((Date.now() - gameState.questionStartTime) / 1000) : 0;

    // Record the answer
    player.currentAnswer = answer;
    player.answerTime = timeElapsed;
    player.hasAnsweredCurrentQuestion = true;

    // Check answer correctness using type-aware logic
    const { isCorrect, partialScore } = this.checkAnswer(answer, gameState.currentQuestion);

    // Practice mode: skip scoring entirely
    const isPractice = gameState.gameMode === 'practice';

    // Build score context for perk effects
    const scoreContext: ScoreContext | undefined = (!isPractice && player.perkModifiers) ? {
      questionIndex: gameState.currentQuestionIndex,
      totalQuestions: gameState.totalQuestions,
      playerAccuracy: player.correctAnswers / Math.max(1, player.correctAnswers + player.wrongAnswers),
      wrongAnswersUsed: player.freeWrongsUsed,
      lastWrongStreak: player.lastWrongStreak,
      isLastWrong: player.lastWrongStreak > 0,
    } : undefined;

    // Calculate score using ScoringService (skip in practice mode)
    let scoreCalculation;
    if (isPractice) {
      scoreCalculation = { pointsEarned: 0, newMultiplier: 1, streakCount: 0, timeElapsed, multiplier: player.multiplier, isCorrect };
    } else if (partialScore > 0 && partialScore < 1.0) {
      // Partial score: use calculatePartialScore for estimation, ordering, matching
      scoreCalculation = this.scoringService.calculatePartialScore(
        timeElapsed,
        player.multiplier,
        partialScore,
        player.currentStreak || 0,
        player.perkModifiers,
        scoreContext
      );
    } else {
      // Full correct or fully wrong: use standard calculateScore
      scoreCalculation = this.scoringService.calculateScore(
        timeElapsed,
        player.multiplier,
        isCorrect,
        player.currentStreak || 0,
        player.perkModifiers,
        scoreContext
      );
    }

    // Update player stats
    if (isCorrect) {
      // For partial scores (0 < partialScore < 1), count as correct answer but with reduced score
      player.correctAnswers++;
      if (!isPractice) {
        player.score += scoreCalculation.pointsEarned;
      }
      player.lastWrongStreak = 0;
    } else {
      player.wrongAnswers++;
      player.lastWrongStreak++;
      if (!isPractice) {
        // Track free wrong answers used
        if (player.perkModifiers && player.perkModifiers.freeWrongAnswers > 0 &&
            player.freeWrongsUsed < player.perkModifiers.freeWrongAnswers) {
          player.freeWrongsUsed++;
        }
        // Still add partial credit points if any
        if (scoreCalculation.pointsEarned > 0) {
          player.score += scoreCalculation.pointsEarned;
        }
      }
    }

    // Update streak and multiplier (skip in practice)
    if (!isPractice) {
      player.currentStreak = scoreCalculation.streakCount;
      player.multiplier = scoreCalculation.newMultiplier;
    }

    // === MODE-SPECIFIC HOOKS ===

    // Fastest Finger: first correct player gets points, rest get 0
    let isFirstCorrect = false;
    if (gameState.gameMode === 'fastest_finger' && isCorrect) {
      if (gameState.firstCorrectPlayerId === null || gameState.firstCorrectPlayerId === undefined) {
        gameState.firstCorrectPlayerId = playerId;
        isFirstCorrect = true;
      } else {
        // Someone else was first — zero out points for this player
        player.score -= scoreCalculation.pointsEarned; // Undo the score addition above
      }
    }

    // Survival: lose life on wrong answer
    if (gameState.gameMode === 'survival' && !isCorrect && !isPractice) {
      const currentLives = gameState.playerLives?.get(playerId) ?? 3;
      const newLives = currentLives - 1;
      gameState.playerLives?.set(playerId, newLives);
      player.lives = newLives;

      this.getIo()?.to(lobbyCode)?.emit('lives-updated', {
        playerId,
        livesRemaining: newLives,
      });

      if (newLives <= 0) {
        player.isEliminated = true;
        gameState.eliminatedPlayers?.add(playerId);
        this.getIo()?.to(lobbyCode)?.emit('player-eliminated', {
          playerId,
          username: player.username,
          eliminatedAtQuestion: gameState.currentQuestionIndex,
        });
      }
    }

    // Wager: apply wager to score (replaces normal scoring)
    if (gameState.gameMode === 'wager' && !isPractice) {
      const wagerPct = Math.max(0, Math.min(100, wagerPercent ?? 25));
      const wagerAmount = Math.floor(player.score * (wagerPct / 100));
      // Undo normal scoring — wager mode replaces it
      player.score -= scoreCalculation.pointsEarned;
      if (isCorrect) {
        player.score += wagerAmount;
      } else {
        player.score = Math.max(0, player.score - wagerAmount);
      }
      // Store for payload
      player.currentWager = wagerAmount;
    }

    // === END MODE-SPECIFIC HOOKS ===

    // Log the answer submission
    RequestLogger.logGameEvent('answer-submitted', lobbyCode, undefined, {
      playerId,
      isCorrect,
      timeElapsed
    });

    // Build answer-received payload
    const answerPayload: Record<string, unknown> = {
      playerId: player.id,
      username: player.username,
      hasAnswered: true,
      isCorrect,
      // Legacy fields
      score: player.score,
      multiplier: player.multiplier,
      // Explicit fields used by frontend for smoother updates
      newScore: player.score,
      newMultiplier: player.multiplier,
      scoreDelta: isPractice ? 0 : (isCorrect ? scoreCalculation.pointsEarned : 0),
      streak: player.currentStreak,
    };

    // Mode-specific payload additions
    if (gameState.gameMode === 'fastest_finger') {
      answerPayload['isFirstCorrect'] = isFirstCorrect;
    }
    if (gameState.gameMode === 'survival' && player.lives !== undefined) {
      answerPayload['livesRemaining'] = player.lives;
    }
    if (gameState.gameMode === 'wager') {
      answerPayload['wagerAmount'] = player.currentWager ?? 0;
      answerPayload['scoreDelta'] = isCorrect ? (player.currentWager ?? 0) : -(player.currentWager ?? 0);
    }

    // Practice mode: on wrong answer, include hint + correct answer + waitForContinue
    if (isPractice && !isCorrect) {
      answerPayload['waitForContinue'] = true;
      answerPayload['correctAnswer'] = gameState.currentQuestion.correctAnswer;
      if (gameState.currentQuestion.hint) {
        answerPayload['hint'] = gameState.currentQuestion.hint;
      }
    }

    // Emit answer received event
    this.getIo()?.to(lobbyCode)?.emit('answer-received', answerPayload);

    // In practice mode with wrong answer, do NOT auto-advance — wait for practice-continue
    if (isPractice && !isCorrect) {
      return;
    }

    // Check if all players have answered
    const allPlayersAnswered = gameState.players.every(p => p.hasAnsweredCurrentQuestion);
    if (allPlayersAnswered) {
      // Duel: determine round winner
      if (gameState.gameMode === 'duel' && gameState.currentDuelPair) {
        this.resolveDuelRound(lobbyCode);
      }
      await this.endQuestion(lobbyCode);
    }
  }

  /**
   * Handle wager submission from a player.
   */
  async handleWagerSubmit(lobbyCode: string, playerId: string, wagerPercent: number): Promise<void> {
    const gameState = this.activeGames.get(lobbyCode);
    if (!gameState || !gameState.wagerPhaseActive) {
      throw new Error('No active wager phase');
    }

    const player = gameState.players.find(p => p.id === playerId);
    if (!player) throw new Error('Player not found');

    // Clamp wager to 0-100%
    const clamped = Math.max(0, Math.min(100, wagerPercent));
    const wagerAmount = Math.floor(player.score * (clamped / 100));
    player.currentWager = wagerAmount;
    gameState.playerWagers?.set(playerId, wagerAmount);

    this.getIo()?.to(lobbyCode)?.emit('wager-submitted', {
      playerId,
      wagerAmount,
    });

    // Check if all players have wagered
    const allWagered = gameState.players.every(p =>
      gameState.playerWagers?.has(p.id)
    );
    if (allWagered) {
      this.resolveWagerPhase(lobbyCode);
    }
  }

  /**
   * Resolve the wager phase and deliver the question.
   */
  private resolveWagerPhase(lobbyCode: string): void {
    const gameState = this.activeGames.get(lobbyCode);
    if (!gameState) return;

    // Clear wager timer
    if (gameState.wagerTimer) {
      clearTimeout(gameState.wagerTimer);
      gameState.wagerTimer = undefined;
    }

    // Default players who didn't wager to 0
    for (const player of gameState.players) {
      if (!gameState.playerWagers?.has(player.id)) {
        player.currentWager = 0;
        gameState.playerWagers?.set(player.id, 0);
      }
    }

    gameState.wagerPhaseActive = false;

    // Now emit the question
    const currentQuestion = gameState.currentQuestion;
    if (!currentQuestion) return;

    // Build per-player INFO perk effects for wager mode emission
    const wagerPerkEffects: Record<string, Record<string, boolean>> = {};
    for (const player of gameState.players) {
      if (player.perkModifiers) {
        const effects = PerkEffectEngine.extractInfoEffects(player.perkModifiers);
        if (Object.keys(effects).length > 0) {
          wagerPerkEffects[player.id] = effects;
        }
      }
    }

    this.getIo()?.to(lobbyCode)?.emit('question-started', {
      question: currentQuestion,
      questionIndex: gameState.currentQuestionIndex,
      totalQuestions: gameState.totalQuestions,
      timeRemaining: gameState.timeRemaining,
      gameMode: gameState.gameMode,
      ...(Object.keys(wagerPerkEffects).length > 0 && { playerPerkEffects: wagerPerkEffects }),
    });

    // Start the question timer
    this.startQuestionTimer(lobbyCode);
  }

  /**
   * Resolve a duel round: determine winner, rotate queue.
   */
  private resolveDuelRound(lobbyCode: string): void {
    const gameState = this.activeGames.get(lobbyCode);
    if (!gameState || !gameState.currentDuelPair || !gameState.duelQueue) return;

    const [id1, id2] = gameState.currentDuelPair;
    const p1 = gameState.players.find(p => p.id === id1);
    const p2 = gameState.players.find(p => p.id === id2);

    if (!p1 || !p2) return;

    // Determine winner: correct beats wrong, both correct → faster wins, both wrong → draw
    const p1Correct = p1.currentAnswer !== undefined &&
      this.checkAnswer(p1.currentAnswer, gameState.currentQuestion!).isCorrect;
    const p2Correct = p2.currentAnswer !== undefined &&
      this.checkAnswer(p2.currentAnswer, gameState.currentQuestion!).isCorrect;

    let winnerId: string | null = null;
    let loserId: string | null = null;

    if (p1Correct && !p2Correct) {
      winnerId = id1; loserId = id2;
    } else if (!p1Correct && p2Correct) {
      winnerId = id2; loserId = id1;
    } else if (p1Correct && p2Correct) {
      // Both correct: faster wins
      const t1 = p1.answerTime ?? Infinity;
      const t2 = p2.answerTime ?? Infinity;
      if (t1 < t2) { winnerId = id1; loserId = id2; }
      else if (t2 < t1) { winnerId = id2; loserId = id1; }
      // else: exact tie → draw (no rotation)
    }
    // Both wrong or tie → draw, no queue change

    if (winnerId && loserId) {
      // Increment duel wins
      const currentWins = gameState.duelWins?.get(winnerId) ?? 0;
      gameState.duelWins?.set(winnerId, currentWins + 1);

      // Rotate queue: loser goes to back, next challenger comes up
      const loserIdx = gameState.duelQueue.indexOf(loserId);
      if (loserIdx !== -1) {
        gameState.duelQueue.splice(loserIdx, 1);
        gameState.duelQueue.push(loserId);
      }

      // Set new duel pair: winner stays, next in queue challenges
      const nextChallenger = gameState.duelQueue.find(id => id !== winnerId);
      if (nextChallenger) {
        gameState.currentDuelPair = [winnerId, nextChallenger];
      }

      this.getIo()?.to(lobbyCode)?.emit('duel-result', {
        winnerId,
        loserId,
        nextDuelPair: gameState.currentDuelPair ? [...gameState.currentDuelPair] : [],
      });
    }
    // Draw: no rotation, pair stays the same
  }

  /**
   * Clean up all timers and active games (useful for testing and shutdown)
   */
  cleanup(): void {
    // Clear all game timers
    this.gameTimers.forEach((timer: NodeJS.Timeout) => {
      clearInterval(timer);
    });
    this.gameTimers.clear();

    // Clear all next question timers
    this.nextQuestionTimers.forEach((timer: NodeJS.Timeout) => {
      clearTimeout(timer);
    });
    this.nextQuestionTimers.clear();

    // Clear all disconnect grace timers
    this.disconnectGraceTimers.forEach((timer: NodeJS.Timeout) => {
      clearTimeout(timer);
    });
    this.disconnectGraceTimers.clear();

    // Clear answer locks
    this.answerLocks.clear();

    // Clear active games
    this.activeGames.clear();
  }

  /**
   * Save player results to the database
   * @param gameState The current game state
   */
  private async savePlayerResults(gameState: GameState): Promise<void> {
    const experienceResults: any[] = [];

    for (const player of gameState.players) {
      try {
        // Use player.id as userId if it's numeric (standard for both OAuth/authUserId and legacy/userId),
        // otherwise fallback to finding by username (mostly for robustness).
        let userId: number | undefined;
        const numericId = parseInt(player.id, 10);

        if (!isNaN(numericId)) {
          userId = numericId;
        } else {
          try {
            const { UserRepository } = await import('../repositories/UserRepository.js');
            const userRepo = new UserRepository();
            const user = await userRepo.findByUsername(player.username);
            userId = user?.id;
          } catch (e) {
            console.warn(`[GameService] Could not find user by username ${player.username}:`, e);
          }
        }

        // Apply end-game score bonuses (perfectionist perk)
        if (player.perkModifiers) {
          player.score = PerkEffectEngine.applyEndGameBonuses(player.score, player.perkModifiers, {
            correctAnswers: player.correctAnswers,
            totalQuestions: gameState.totalQuestions,
          });
        }

        // Award experience points if we have a valid userId (skip in practice mode)
        // Apply XP modifiers from perks
        let experienceResult = null;
        let modifiedXP = gameState.gameMode === 'practice' ? 0 : player.score;
        if (userId && gameState.gameMode !== 'practice') {
          try {
            if (player.perkModifiers) {
              modifiedXP = PerkEffectEngine.calculateModifiedXP(player.score, player.perkModifiers, {
                accuracy: player.correctAnswers / Math.max(1, gameState.totalQuestions),
                isPerfect: player.correctAnswers === gameState.totalQuestions,
                uniqueSetCount: gameState.selectedQuestionSetIds.length,
                maxStreak: player.currentStreak,
              });
            }
            experienceResult = await this.characterService.awardExperience(userId, modifiedXP);
          } catch (xpError) {
            console.error(`[GameService] Failed to award XP for player ${player.id} (userId=${userId}):`, xpError);
          }
        }

        try {
          await this.scoringService.savePlayerResult(gameState.gameSessionId, {
            ...(userId && { userId }),
            username: player.username,
            characterName: player.character,
            finalScore: player.score,
            correctAnswers: player.correctAnswers,
            totalQuestions: gameState.totalQuestions,
            maxMultiplier: player.multiplier,
            answerDetails: [], // Will be populated with actual answer details
            skipExperienceAward: true
          });
        } catch (saveError) {
          console.error(`[GameService] Failed to save result for player ${player.id}:`, saveError);
        }

        // Get newly unlocked perks for this player (level-based)
        let newlyUnlockedPerks: any[] = [];
        if (userId && experienceResult?.levelUp) {
          try {
            newlyUnlockedPerks = await this.perkDraftService.getNewlyUnlockedPerks(
              experienceResult.oldLevel,
              experienceResult.newLevel
            );
          } catch (e) {
            console.warn(`[GameService] Failed to get unlocked perks for player ${player.id}:`, e);
          }
        }

        // Always push an entry so every player appears in final results with XP
        experienceResults.push({
          playerId: player.id,
          characterName: player.character,
          experienceAwarded: modifiedXP,
          ...(experienceResult || {}),
          // Ensure levelUp/newLevel are always present
          levelUp: experienceResult?.levelUp || false,
          newLevel: experienceResult?.newLevel || player.characterLevel || 1,
          oldLevel: experienceResult?.oldLevel || player.characterLevel || 1,
          newlyUnlockedPerks: newlyUnlockedPerks.length > 0 ? newlyUnlockedPerks : (experienceResult?.newlyUnlockedPerks || []),
        });
      } catch (error) {
        console.error(`[GameService] Error processing player ${player.id} results:`, error);
        // Still push a basic entry so the player appears in final results
        experienceResults.push({
          playerId: player.id,
          characterName: player.character,
          experienceAwarded: player.score,
          levelUp: false,
          newLevel: player.characterLevel || 1,
          oldLevel: player.characterLevel || 1,
          newlyUnlockedPerks: []
        });
      }
    }

    // Prepare final results with experience information
    const finalResults = gameState.players
      .map((player: GamePlayer) => {
        const experienceResult = experienceResults.find(er => er.playerId === player.id);
        return {
          id: player.id,
          username: player.username,
          character: player.character,
          characterLevel: player.characterLevel,
          finalScore: player.score,
          correctAnswers: player.correctAnswers,
          multiplier: player.multiplier,
          experienceAwarded: experienceResult?.experienceAwarded || player.score,
          levelUp: experienceResult?.levelUp || false,
          newLevel: experienceResult?.newLevel || player.characterLevel || 1,
          oldLevel: experienceResult?.oldLevel || player.characterLevel || 1,
          newlyUnlockedPerks: experienceResult?.newlyUnlockedPerks || [],
        };
      })
      .sort((a, b) => b.finalScore - a.finalScore);

    // Broadcast game end with experience and level-up information
    this.getIo()?.to(gameState.lobbyCode)?.emit('game-ended', {
      results: finalResults,
      gameSessionId: gameState.gameSessionId,
      questionSetIds: gameState.selectedQuestionSetIds
    });

    // Send individual level-up notifications
    for (const result of finalResults) {
      if (result.levelUp) {
        this.getIo()?.to(gameState.lobbyCode)?.emit('player-level-up', {
          playerId: result.id,
          username: result.username,
          character: result.character,
          oldLevel: result.oldLevel,
          newLevel: result.newLevel,
          experienceAwarded: result.experienceAwarded
        });
      }
    }

    // Lobby cleanup (activeGames removal + lobby deletion) is handled by endGameSession's finally block

    RequestLogger.logGameEvent('game-ended', gameState.lobbyCode, undefined, {
      gameSessionId: gameState.gameSessionId,
      questionSetIds: gameState.selectedQuestionSetIds,
      finalResults: finalResults.map(r => ({
        playerId: r.id,
        score: r.finalScore,
        experienceAwarded: r.experienceAwarded,
        levelUp: r.levelUp
      }))
    });
  }

  /**
   * Get current game state
   */
  getGameState(lobbyCode: string): GameState | undefined {
    return this.activeGames.get(lobbyCode);
  }

  /**
   * Check if a game is active for a lobby
   */
  isGameActive(lobbyCode: string): boolean {
    const gameState = this.activeGames.get(lobbyCode);
    return gameState?.isActive || false;
  }

  /**
   * Get all active games
   */
  getActiveGames(): Map<string, GameState> {
    return new Map(this.activeGames);
  }


  /**
   * Handle question set validation before game start
   */
  async validateQuestionSetsForGame(lobbyCode: string): Promise<{
    isValid: boolean;
    totalQuestions: number;
    questionSets: Array<{ id: number; name: string; questionCount: number }>;
    errors: string[];
  }> {
    const lobby = await this.lobbyService.getLobbyByCode(lobbyCode);
    if (!lobby) {
      return {
        isValid: false,
        totalQuestions: 0,
        questionSets: [],
        errors: ['Lobby not found']
      };
    }

    const settings = lobby.settings as { questionSetIds?: number[] };
    const questionSetIds = settings?.questionSetIds || [];

    return await this.lobbyService.validateQuestionSetSelection(questionSetIds);
  }

  /**
   * Create fallback questions when no questions are available
   * @param count Number of fallback questions to create
   * @returns Array of fallback questions
   */
  private createFallbackQuestions(count: number): QuestionData[] {
    const fallbackQuestions: QuestionData[] = [];

    // German fallback questions
    const germanFallbackData = [
      {
        question: 'Was ist die Hauptstadt von Deutschland?',
        answers: ['Berlin', 'München', 'Hamburg', 'Köln'],
        correctAnswer: 'Berlin'
      },
      {
        question: 'Welcher Planet ist der Sonne am nächsten?',
        answers: ['Venus', 'Merkur', 'Erde', 'Mars'],
        correctAnswer: 'Merkur'
      },
      {
        question: 'Wie viele Kontinente gibt es?',
        answers: ['5', '6', '7', '8'],
        correctAnswer: '7'
      },
      {
        question: 'Was ist H2O?',
        answers: ['Wasser', 'Sauerstoff', 'Wasserstoff', 'Kohlendioxid'],
        correctAnswer: 'Wasser'
      },
      {
        question: 'Wer schrieb "Faust"?',
        answers: ['Goethe', 'Schiller', 'Heine', 'Brecht'],
        correctAnswer: 'Goethe'
      },
      {
        question: 'Wie viele Sekunden hat eine Minute?',
        answers: ['50', '60', '70', '100'],
        correctAnswer: '60'
      },
      {
        question: 'Welche Farbe entsteht aus Rot und Blau?',
        answers: ['Grün', 'Gelb', 'Lila', 'Orange'],
        correctAnswer: 'Lila'
      },
      {
        question: 'In welchem Jahr fiel die Berliner Mauer?',
        answers: ['1987', '1988', '1989', '1990'],
        correctAnswer: '1989'
      },
      {
        question: 'Wie viele Seiten hat ein Dreieck?',
        answers: ['2', '3', '4', '5'],
        correctAnswer: '3'
      },
      {
        question: 'Was ist die größte Stadt in Deutschland?',
        answers: ['Berlin', 'Hamburg', 'München', 'Köln'],
        correctAnswer: 'Berlin'
      }
    ];

    for (let i = 0; i < count; i++) {
      const questionData = germanFallbackData[i % germanFallbackData.length];
      if (!questionData) continue; // Safety check, though this should never happen

      fallbackQuestions.push({
        id: -i - 1, // Negative ID to indicate fallback question
        question: questionData.question,
        answers: questionData.answers,
        correctAnswer: questionData.correctAnswer,
        questionSetId: 1,
        language: 'de',
        explanation: 'Dies ist eine Ersatzfrage',
        answerType: 'multiple_choice',
      });
    }

    return fallbackQuestions;
  }

  /**
   * Handle player disconnect with grace period.
   * Broadcasts disconnect status to remaining players immediately,
   * but waits 30 seconds before considering the player fully disconnected
   * (giving them a chance to reconnect).
   */
  async handlePlayerDisconnect(lobbyCode: string, playerId: string): Promise<void> {
    const gameState = this.activeGames.get(lobbyCode);
    if (!gameState) {
      return;
    }

    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return;

    // Broadcast disconnect status to remaining players immediately
    this.getIo()?.to(lobbyCode)?.emit('player-disconnected', {
      playerId,
      username: player.username,
      message: `${player.username} hat die Verbindung verloren...`
    });

    // Start grace period — don't mark fully disconnected yet
    const graceKey = `${lobbyCode}:${playerId}`;
    // Clear any existing grace timer for this player
    const existing = this.disconnectGraceTimers.get(graceKey);
    if (existing) {
      clearTimeout(existing);
    }

    const graceTimer = setTimeout(async () => {
      this.disconnectGraceTimers.delete(graceKey);

      // Re-check game state (may have ended during grace period)
      const currentGameState = this.activeGames.get(lobbyCode);
      if (!currentGameState) return;

      const currentPlayer = currentGameState.players.find(p => p.id === playerId);
      if (!currentPlayer || currentPlayer.isConnected) return; // Player reconnected

      // Grace period expired — mark as fully disconnected
      currentPlayer.isConnected = false;
      try {
        await this.lobbyService.updatePlayerConnection(lobbyCode, playerId, false);
      } catch (e) {
        console.warn('Failed to update player connection after grace period:', e);
      }

      // Notify remaining players that grace period expired
      this.getIo()?.to(lobbyCode)?.emit('player-disconnect-confirmed', {
        playerId,
        username: currentPlayer.username,
        message: `${currentPlayer.username} ist endgültig getrennt`
      });

      // Check if all players are disconnected
      const allDisconnected = currentGameState.players.every(p => !p.isConnected);
      if (allDisconnected) {
        await this.endGameSession(lobbyCode);
      }
    }, 30000); // 30 second grace period

    this.disconnectGraceTimers.set(graceKey, graceTimer);

    // Don't keep process alive in tests
    if (this.isTestEnvironment && graceTimer.unref) {
      graceTimer.unref();
    }

    // Temporarily mark as disconnected (for UI purposes) but don't update DB yet
    player.isConnected = false;
  }

  /**
   * Handle player reconnection — cancel grace timer and restore connected status.
   */
  async handlePlayerReconnect(lobbyCode: string, playerId: string): Promise<void> {
    const gameState = this.activeGames.get(lobbyCode);
    if (!gameState) return;

    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return;

    // Cancel grace timer if active
    const graceKey = `${lobbyCode}:${playerId}`;
    const graceTimer = this.disconnectGraceTimers.get(graceKey);
    if (graceTimer) {
      clearTimeout(graceTimer);
      this.disconnectGraceTimers.delete(graceKey);
    }

    // Restore connected status
    player.isConnected = true;
    try {
      await this.lobbyService.updatePlayerConnection(lobbyCode, playerId, true);
    } catch (e) {
      console.warn('Failed to update player reconnection status:', e);
    }

    // Broadcast reconnection to remaining players
    this.getIo()?.to(lobbyCode)?.emit('player-reconnected', {
      playerId,
      username: player.username,
      message: `${player.username} ist wieder verbunden`
    });
  }

  /**
   * Handle practice-continue event: mark player as continued and advance when all ready.
   */
  async handlePracticeContinue(lobbyCode: string, playerId: string): Promise<void> {
    const gameState = this.activeGames.get(lobbyCode);
    if (!gameState || gameState.gameMode !== 'practice') return;

    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return;

    // Mark the player as having "answered" (continued past the wrong answer)
    player.hasAnsweredCurrentQuestion = true;

    // Check if all players have now continued
    const allContinued = gameState.players.every(p => p.hasAnsweredCurrentQuestion);
    if (allContinued) {
      await this.endQuestion(lobbyCode);
    }
  }

  /**
   * Public wrapper for ending the current question
   */
  async endCurrentQuestion(lobbyCode: string): Promise<void> {
    await this.endQuestion(lobbyCode);
  }

  /**
   * Public wrapper for getting fallback questions
   */
  async getFallbackQuestions(count: number): Promise<QuestionData[]> {
    // Get fallback questions from the question service using the default question set
    const questions = await this.questionService.getRandomQuestions({
      questionSetIds: [1], // Default fallback question set
      count
    });

    // Convert to the expected format
    return questions.map(q => ({
      id: q.id,
      question: typeof q.question_text === 'string' ? q.question_text : (q.question_text as any).de || (q.question_text as any).en || 'Question',
      answers: q.answers.map(a => a.text),
      correctAnswer: q.answers.find(a => a.correct)?.text || '',
      questionSetId: q.question_set_id,
      language: 'de',
      answerType: (q as any).answer_type || 'multiple_choice',
      hint: (q as any).hint || undefined,
    }));
  }
} 
