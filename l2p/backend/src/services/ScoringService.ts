import { GameSessionRepository, CreatePlayerResultData, PlayerResult } from '../repositories/GameSessionRepository.js';
import { CharacterService } from './CharacterService.js';
import { RequestLogger } from '../middleware/logging.js';
import { GameplayModifiers, ScoreContext, PerkEffectEngine } from './PerkEffectEngine.js';

export interface ScoreCalculation {
  timeElapsed: number;
  multiplier: number;
  isCorrect: boolean;
  pointsEarned: number;
  newMultiplier: number;
  streakCount: number;
  bonusPoints: number;
}

export interface PlayerStatistics {
  totalGames: number;
  totalScore: number;
  averageScore: number;
  averageAccuracy: number;
  maxMultiplier: number;
  bestScore: number;
  totalCorrectAnswers: number;
  totalQuestions: number;
  currentStreak: number;
  bestStreak: number;
}

export class ScoringService {
  private gameSessionRepository: GameSessionRepository;
  private characterService: CharacterService;

  constructor() {
    this.gameSessionRepository = new GameSessionRepository();
    this.characterService = new CharacterService();
  }

  /**
   * Calculate score for a player's answer.
   * When `modifiers` is provided, perk effects are applied.
   * When absent, formula is identical to the original (backward compatible).
   */
  calculateScore(
    timeElapsed: number,
    currentMultiplier: number,
    isCorrect: boolean,
    currentStreak: number,
    modifiers?: GameplayModifiers,
    context?: ScoreContext
  ): ScoreCalculation {
    let pointsEarned = 0;
    let bonusPoints = 0;
    let newMultiplier = currentMultiplier;
    let newStreak = currentStreak;

    const maxStreak = modifiers?.maxStreakMultiplier ?? 5;
    const growthRate = modifiers?.streakGrowthRate ?? 1.0;

    if (isCorrect) {
      // Apply time perk bonuses to effective time
      let effectiveTimeElapsed = timeElapsed;
      if (modifiers) {
        effectiveTimeElapsed = Math.max(0, timeElapsed - modifiers.bonusSeconds);
        effectiveTimeElapsed *= modifiers.timerSpeedMultiplier;
      }

      // Base formula: (60 - effective_seconds) × multiplier
      const timeBonus = Math.max(0, 60 - effectiveTimeElapsed);
      pointsEarned = timeBonus * currentMultiplier;

      // Apply speed bonus multiplier
      if (modifiers && modifiers.speedBonusMultiplier !== 1.0) {
        pointsEarned = Math.round(pointsEarned * modifiers.speedBonusMultiplier);
      }

      // Apply base score multiplier
      if (modifiers && modifiers.baseScoreMultiplier !== 1.0) {
        pointsEarned = Math.round(pointsEarned * modifiers.baseScoreMultiplier);
      }

      // Speed threshold bonus (Early Bird / Flash Answer)
      if (modifiers && modifiers.speedThresholdSeconds > 0 && timeElapsed <= modifiers.speedThresholdSeconds) {
        bonusPoints += modifiers.speedBonusPoints;
      }

      // Closer bonus (last N questions)
      if (modifiers && context && modifiers.closerBonusPercentage > 0) {
        const isCloserQuestion = context.questionIndex >= (context.totalQuestions - modifiers.lastQuestionsCount);
        if (isCloserQuestion) {
          bonusPoints += Math.round(pointsEarned * modifiers.closerBonusPercentage);
        }
      }

      // Bounce back bonus (first correct after wrong)
      if (modifiers && context && context.isLastWrong && modifiers.bounceBackBonus > 0) {
        bonusPoints += modifiers.bounceBackBonus;
      }

      // Phoenix bonus (correct after consecutive wrong streak)
      if (modifiers && context && modifiers.phoenixThreshold > 0 &&
          context.lastWrongStreak >= modifiers.phoenixThreshold) {
        pointsEarned = Math.round(pointsEarned * modifiers.phoenixMultiplier);
      }

      // Comeback bonus
      if (modifiers && context && modifiers.comebackThreshold > 0 &&
          context.playerAccuracy < modifiers.comebackThreshold) {
        pointsEarned = Math.round(pointsEarned * modifiers.comebackMultiplier);
      }

      pointsEarned += bonusPoints;

      // Increase streak and multiplier (with growth rate modifier)
      newStreak = currentStreak + 1;
      const effectiveStreak = Math.floor(newStreak * growthRate);
      newMultiplier = Math.min(maxStreak, Math.floor(effectiveStreak / 2) + 1);
    } else {
      // Check for free wrong answers (recovery perk)
      if (modifiers && context && modifiers.freeWrongAnswers > 0 &&
          context.wrongAnswersUsed < modifiers.freeWrongAnswers) {
        // Don't reset streak, but no points earned
        newStreak = currentStreak;
        newMultiplier = currentMultiplier;
      } else {
        // Reset multiplier and streak for incorrect answer
        newMultiplier = modifiers?.baseMultiplier ?? 1;
        newStreak = 0;
      }

      // Partial credit on wrong answers
      if (modifiers && modifiers.partialCreditRate > 0) {
        const timeBonus = Math.max(0, 60 - timeElapsed);
        pointsEarned = Math.round(timeBonus * currentMultiplier * modifiers.partialCreditRate);
      }
    }

    return {
      timeElapsed,
      multiplier: currentMultiplier,
      isCorrect,
      pointsEarned,
      newMultiplier,
      streakCount: newStreak,
      bonusPoints,
    };
  }

  /**
   * Calculate score for a partial answer (e.g., estimation, ordering, matching).
   * Calls calculateScore with isCorrect=true to get the full-credit score,
   * then multiplies pointsEarned by partialScore.
   * If partialScore < 1.0, streak resets to 0 and multiplier resets to base.
   */
  calculatePartialScore(
    timeElapsed: number,
    currentMultiplier: number,
    partialScore: number,
    currentStreak: number,
    modifiers?: GameplayModifiers,
    context?: ScoreContext
  ): ScoreCalculation {
    // Get full-credit calculation
    const fullCredit = this.calculateScore(
      timeElapsed,
      currentMultiplier,
      true, // treat as correct for base calculation
      currentStreak,
      modifiers,
      context
    );

    // Scale points by partial score
    const scaledPoints = Math.round(fullCredit.pointsEarned * partialScore);

    if (partialScore >= 1.0) {
      // Perfect answer: keep streak and multiplier from full calculation
      return { ...fullCredit, pointsEarned: scaledPoints };
    }

    // Partial answer: reset streak and multiplier
    const baseMultiplier = modifiers?.baseMultiplier ?? 1;
    return {
      ...fullCredit,
      pointsEarned: scaledPoints,
      newMultiplier: baseMultiplier,
      streakCount: 0,
      isCorrect: true, // still counts as correct for stat tracking
    };
  }

  /**
   * Save player result to database and award experience
   */
  async savePlayerResult(sessionId: number, playerData: {
    userId?: number;
    username: string;
    characterName?: string;
    finalScore: number;
    correctAnswers: number;
    totalQuestions: number;
    maxMultiplier: number;
    completionTime?: number;
    answerDetails: Array<{
      questionId: number;
      selectedAnswer: string;
      isCorrect: boolean;
      timeElapsed: number;
      pointsEarned: number;
      multiplierUsed: number;
    }>;
    skipExperienceAward?: boolean;
  }): Promise<{
    experienceAwarded: number;
    levelUp: boolean;
    newLevel: number;
    oldLevel: number;
  } | null> {
    try {
      const playerResultData: CreatePlayerResultData = {
        session_id: sessionId,
        username: playerData.username,
        final_score: playerData.finalScore,
        correct_answers: playerData.correctAnswers,
        total_questions: playerData.totalQuestions,
        max_multiplier: playerData.maxMultiplier,
        answer_details: playerData.answerDetails,
        ...(playerData.userId && { user_id: playerData.userId }),
        ...(playerData.characterName && { character_name: playerData.characterName }),
        ...(playerData.completionTime && { completion_time: playerData.completionTime })
      };

      await this.gameSessionRepository.createPlayerResult(playerResultData);

      // Award experience points (1:1 conversion from score) unless skipped
      let experienceResult = null;
      if (playerData.userId && !playerData.skipExperienceAward) {
        try {
          experienceResult = await this.characterService.awardExperience(playerData.userId, playerData.finalScore);
        } catch (error) {
          console.error('Error awarding experience:', error);
          // Don't fail the entire operation if experience awarding fails
        }
      }

      RequestLogger.logGameEvent('score-saved', undefined, playerData.userId, {
        sessionId,
        username: playerData.username,
        finalScore: playerData.finalScore,
        experienceAwarded: playerData.finalScore
      });

      return experienceResult ? {
        experienceAwarded: playerData.finalScore,
        levelUp: experienceResult.levelUp,
        newLevel: experienceResult.newLevel,
        oldLevel: experienceResult.oldLevel
      } : null;
    } catch (error) {
      console.error('Error saving player result:', error);
      throw error;
    }
  }

  /**
   * Get player statistics
   */
  async getPlayerStatistics(userId: number): Promise<PlayerStatistics> {
    try {
      const stats = await this.gameSessionRepository.getPlayerStats(userId);

      return {
        totalGames: stats.totalGames,
        totalScore: stats.totalScore,
        averageScore: stats.averageScore,
        averageAccuracy: stats.averageAccuracy,
        maxMultiplier: stats.maxMultiplier,
        bestScore: stats.bestScore,
        totalCorrectAnswers: 0, // Will be calculated from answer details
        totalQuestions: 0, // Will be calculated from answer details
        currentStreak: 0, // Will be calculated from recent games
        bestStreak: 0 // Will be calculated from all games
      };
    } catch (error) {
      console.error('Error getting player statistics:', error);
      throw error;
    }
  }

  /**
   * Get leaderboard for a question set
   */
  async getLeaderboard(questionSetId: number, limit: number = 10): Promise<Array<{
    rank: number;
    username: string;
    characterName?: string;
    finalScore: number;
    correctAnswers: number;
    maxMultiplier: number;
    accuracy: number;
    completionTime?: number;
  }>> {
    try {
      // Get all player results - for now, get all results and filter by question set
      const allResults = await this.gameSessionRepository.getTopPlayersByScore(100);

      // Filter and sort by score
      const validResults = allResults
        .filter((result: any) => result.final_score > 0) // Only completed games
        .sort((a: any, b: any) => b.final_score - a.final_score)
        .slice(0, limit);

      // Calculate ranks and additional data
      return validResults.map((result: any, index: number) => ({
        rank: index + 1,
        username: result.username,
        characterName: result.character_name,
        finalScore: result.final_score,
        correctAnswers: result.correct_answers,
        maxMultiplier: result.max_multiplier,
        accuracy: result.total_questions > 0 ? (result.correct_answers / result.total_questions) * 100 : 0,
        completionTime: result.completion_time
      }));
    } catch (error) {
      console.error('Error getting leaderboard:', error);
      throw error;
    }
  }

  /**
   * Validate if a game session qualifies for Hall of Fame
   */
  validateHallOfFameEligibility(gameSessionId: number, totalQuestions: number, completedQuestions: number): boolean {
    // Must complete at least 80% of questions to qualify
    const completionRate = completedQuestions / totalQuestions;
    return completionRate >= 0.8;
  }

  /**
   * Calculate accuracy percentage
   */
  calculateAccuracy(correctAnswers: number, totalQuestions: number): number {
    if (totalQuestions === 0) return 0;
    return Math.round((correctAnswers / totalQuestions) * 100);
  }

  /**
   * Get medal type based on rank
   */
  getMedalType(rank: number): 'gold' | 'silver' | 'bronze' | null {
    switch (rank) {
      case 1: return 'gold';
      case 2: return 'silver';
      case 3: return 'bronze';
      default: return null;
    }
  }

  /**
   * Calculate streak bonus
   */
  calculateStreakBonus(streakCount: number): number {
    // Bonus points for maintaining streaks
    if (streakCount >= 5) return 50;
    if (streakCount >= 3) return 25;
    if (streakCount >= 2) return 10;
    return 0;
  }

  /**
   * Get performance rating based on score and accuracy
   */
  getPerformanceRating(score: number, accuracy: number, maxMultiplier: number): string {
    if (accuracy >= 90 && maxMultiplier >= 4) return 'Perfect';
    if (accuracy >= 80 && maxMultiplier >= 3) return 'Excellent';
    if (accuracy >= 70 && maxMultiplier >= 2) return 'Good';
    if (accuracy >= 60) return 'Fair';
    return 'Poor';
  }
} 