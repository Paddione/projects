import { GameSessionRepository, CreatePlayerResultData, PlayerResult } from '../repositories/GameSessionRepository.js';
import { CharacterService } from './CharacterService.js';
import { RequestLogger } from '../middleware/logging.js';

export interface ScoreCalculation {
  timeElapsed: number;
  multiplier: number;
  isCorrect: boolean;
  pointsEarned: number;
  newMultiplier: number;
  streakCount: number;
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
   * Calculate score for a player's answer
   */
  calculateScore(timeElapsed: number, currentMultiplier: number, isCorrect: boolean, currentStreak: number): ScoreCalculation {
    let pointsEarned = 0;
    let newMultiplier = currentMultiplier;
    let newStreak = currentStreak;

    if (isCorrect) {
      // Calculate points: (60 - seconds_elapsed) × multiplier
      const timeBonus = Math.max(0, 60 - timeElapsed);
      pointsEarned = timeBonus * currentMultiplier;

      // Increase streak and multiplier
      newStreak = currentStreak + 1;
      newMultiplier = Math.min(5, Math.floor(newStreak / 2) + 1); // 1x, 2x, 3x, 4x, 5x
    } else {
      // Reset multiplier and streak for incorrect answer
      pointsEarned = 0;
      newMultiplier = 1;
      newStreak = 0;
    }

    return {
      timeElapsed,
      multiplier: currentMultiplier,
      isCorrect,
      pointsEarned,
      newMultiplier,
      streakCount: newStreak
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