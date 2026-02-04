import { Server } from 'socket.io';
import { GameSessionRepository, CreateGameSessionData } from '../repositories/GameSessionRepository.js';
import { QuestionService } from './QuestionService.js';
import { ScoringService } from './ScoringService.js';
import { RequestLogger } from '../middleware/logging.js';
import { LobbyService } from './LobbyService.js';
import { CharacterService } from './CharacterService.js';
import { PerkDraftService, DraftOffer } from './PerkDraftService.js';
import { PerkEffectEngine, GameplayModifiers, ScoreContext } from './PerkEffectEngine.js';

export interface GameState {
  lobbyCode: string;
  gameSessionId: number;
  currentQuestionIndex: number;
  totalQuestions: number;
  timeRemaining: number;
  isActive: boolean;
  players: GamePlayer[];
  currentQuestion?: QuestionData | undefined;
  questionStartTime?: number | undefined;
  selectedQuestionSetIds: number[];
  questions: QuestionData[];
}

export interface GamePlayer {
  id: string;
  username: string;
  character: string;
  characterLevel?: number;
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
  freeWrongsUsed: number;
}

export interface QuestionData {
  id: number;
  question: string;
  answers: string[];
  correctAnswer: string;
  questionSetId: number;
  language: string;
  explanation?: string | undefined;
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
      this.getIo()?.to(lobbyCode).emit('time-update', {
        timeRemaining: gameState.timeRemaining
      });

      // Check for time warnings
      if (gameState.timeRemaining === 10 || gameState.timeRemaining === 5) {
        this.getIo()?.to(lobbyCode).emit('time-warning', {
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
    gameState.timeRemaining = 60; // Reset timer for new question

    // Get the current question
    const currentQuestion = gameState.questions[gameState.currentQuestionIndex];
    if (!currentQuestion) {
      throw new Error(`Question not found at index ${gameState.currentQuestionIndex}`);
    }

    // Update the game state
    gameState.currentQuestion = currentQuestion;
    gameState.questionStartTime = Date.now();

    // Reset player states for the new question
    gameState.players.forEach(player => {
      player.hasAnsweredCurrentQuestion = false;
      player.currentAnswer = undefined;
      player.answerTime = undefined;
    });

    // Emit the next question to all players (send full object; use 0-based index)
    this.getIo()?.to(lobbyCode).emit('question-started', {
      question: currentQuestion,
      questionIndex: gameState.currentQuestionIndex,
      totalQuestions: gameState.totalQuestions,
      timeRemaining: gameState.timeRemaining
    });

    // Start the timer for this question
    this.startQuestionTimer(lobbyCode);
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
          explanation: q.explanation
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

      // Initialize game state
      const gameState: GameState = {
        lobbyCode,
        gameSessionId: gameSession.id as number,
        currentQuestionIndex: -1,
        totalQuestions,
        timeRemaining: 60,
        isActive: true,
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

      // Store active game
      this.activeGames.set(lobbyCode, gameState);

      // Load perk modifiers for each player
      for (const player of gameState.players) {
        try {
          const numericId = parseInt(player.id, 10);
          if (!isNaN(numericId)) {
            const activePerks = await this.perkDraftService.getActiveGameplayPerks(numericId);
            if (activePerks.length > 0) {
              player.perkModifiers = PerkEffectEngine.buildModifiers(activePerks);
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
        this.io.to(lobbyCode).emit('game-syncing', {
          countdown: syncCountdown,
          message: 'Synchronisiere Spieler...'
        });
      }

      const syncTimer = setInterval(async () => {
        syncCountdown--;

        if (syncCountdown <= 0) {
          clearInterval(syncTimer);

          // Update lobby status to 'playing' now that synchronization is over
          await (this as any).lobbyService.updateLobbyStatus(lobbyCode, 'playing');

          // Start the first question after synchronization
          await this.startNextQuestion(lobbyCode);
        } else {
          // Emit sync update
          this.io?.to(lobbyCode).emit('game-syncing', {
            countdown: syncCountdown,
            message: 'Synchronisiere Spieler...'
          });
        }
      }, 1000);

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
        this.getIo()?.to(lobbyCode).emit('question-results', results);
      }
      // Frontend expects 'question-ended' with a flat results array of players
      const endedPayload = {
        results: gameState.players.map(p => ({ id: p.id, score: p.score, multiplier: p.multiplier })),
        correctAnswer: gameState.currentQuestion.correctAnswer,
        questionIndex: gameState.currentQuestionIndex,
        totalQuestions: gameState.totalQuestions
      };
      if (this.io) {
        this.getIo()?.to(lobbyCode).emit('question-ended', endedPayload);
      }

      // Player scores are already updated in calculateQuestionResults

      // Determine if game should continue or end
      const isLastQuestion = gameState.currentQuestionIndex >= gameState.questions.length - 1 ||
        gameState.currentQuestionIndex >= gameState.totalQuestions - 1;

      if (isLastQuestion) {
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
      this.getIo()?.to(lobbyCode).emit('game-over', {
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

  async submitAnswer(lobbyCode: string, playerId: string, answer: string): Promise<void> {
    // Atomic lock to prevent concurrent double-submissions for the same player
    const lockKey = `${lobbyCode}:${playerId}`;
    if (this.answerLocks.has(lockKey)) {
      throw new Error('Answer submission already in progress');
    }
    this.answerLocks.add(lockKey);

    try {
      return await this._submitAnswerInner(lobbyCode, playerId, answer);
    } finally {
      this.answerLocks.delete(lockKey);
    }
  }

  private async _submitAnswerInner(lobbyCode: string, playerId: string, answer: string): Promise<void> {
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

    // Calculate time elapsed
    const timeElapsed = gameState.questionStartTime ?
      Math.floor((Date.now() - gameState.questionStartTime) / 1000) : 0;

    // Record the answer
    player.currentAnswer = answer;
    player.answerTime = timeElapsed;
    player.hasAnsweredCurrentQuestion = true;

    // Check if answer is correct
    const isCorrect = answer === gameState.currentQuestion.correctAnswer;

    // Build score context for perk effects
    const scoreContext: ScoreContext | undefined = player.perkModifiers ? {
      questionIndex: gameState.currentQuestionIndex,
      totalQuestions: gameState.totalQuestions,
      playerAccuracy: player.correctAnswers / Math.max(1, player.correctAnswers + player.wrongAnswers),
      wrongAnswersUsed: player.freeWrongsUsed,
      lastWrongStreak: player.lastWrongStreak,
      isLastWrong: player.lastWrongStreak > 0,
    } : undefined;

    // Calculate score using ScoringService (with optional perk modifiers)
    const scoreCalculation = this.scoringService.calculateScore(
      timeElapsed,
      player.multiplier,
      isCorrect,
      player.currentStreak || 0,
      player.perkModifiers,
      scoreContext
    );

    // Update player stats
    if (isCorrect) {
      player.correctAnswers++;
      player.score += scoreCalculation.pointsEarned;
      player.lastWrongStreak = 0;
    } else {
      player.wrongAnswers++;
      player.lastWrongStreak++;
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

    // Update streak and multiplier
    player.currentStreak = scoreCalculation.streakCount;
    player.multiplier = scoreCalculation.newMultiplier;

    // Log the answer submission
    RequestLogger.logGameEvent('answer-submitted', lobbyCode, undefined, {
      playerId,
      isCorrect,
      timeElapsed
    });

    // Emit answer received event (include both legacy and explicit fields)
    this.getIo()?.to(lobbyCode).emit('answer-received', {
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
      scoreDelta: isCorrect ? scoreCalculation.pointsEarned : 0,
      streak: player.currentStreak
    });

    // Check if all players have answered
    const allPlayersAnswered = gameState.players.every(p => p.hasAnsweredCurrentQuestion);
    if (allPlayersAnswered) {
      await this.endQuestion(lobbyCode);
    }
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

        // Award experience points if we have a valid userId
        // Apply XP modifiers from perks
        let experienceResult = null;
        let modifiedXP = player.score;
        if (userId) {
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

        // Get pending draft levels for this player
        let pendingDrafts: DraftOffer[] = [];
        if (userId && experienceResult?.levelUp) {
          try {
            const pendingLevels = await this.perkDraftService.getPendingDraftLevels(
              userId,
              experienceResult.newLevel
            );
            for (const lvl of pendingLevels) {
              const offer = await this.perkDraftService.generateDraftOffer(userId, lvl);
              if (offer.perks.length > 0 && !offer.drafted) {
                pendingDrafts.push(offer);
              }
            }
          } catch (e) {
            console.warn(`[GameService] Failed to generate draft offers for player ${player.id}:`, e);
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
          newlyUnlockedPerks: experienceResult?.newlyUnlockedPerks || [],
          pendingDrafts,
        });

        // Emit draft availability notification if any
        if (pendingDrafts.length > 0) {
          try {
            this.getIo()?.to(gameState.lobbyCode).emit('perk:draft-available', {
              playerId: player.id,
              username: player.username,
              pendingDrafts,
            });
          } catch { }
        }
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
          pendingDrafts: experienceResult?.pendingDrafts || [],
        };
      })
      .sort((a, b) => b.finalScore - a.finalScore);

    // Broadcast game end with experience and level-up information
    this.getIo()?.to(gameState.lobbyCode).emit('game-ended', {
      results: finalResults,
      gameSessionId: gameState.gameSessionId,
      questionSetIds: gameState.selectedQuestionSetIds
    });

    // Send individual level-up notifications
    for (const result of finalResults) {
      if (result.levelUp) {
        this.getIo()?.to(gameState.lobbyCode).emit('player-level-up', {
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
        explanation: 'Dies ist eine Ersatzfrage'
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
    this.getIo()?.to(lobbyCode).emit('player-disconnected', {
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
      this.getIo()?.to(lobbyCode).emit('player-disconnect-confirmed', {
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
    this.getIo()?.to(lobbyCode).emit('player-reconnected', {
      playerId,
      username: player.username,
      message: `${player.username} ist wieder verbunden`
    });
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
      language: 'de'
    }));
  }
} 
