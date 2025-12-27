import { HallOfFameRepository, HallOfFameEntry, CreateHallOfFameData } from '../repositories/HallOfFameRepository.js';
import { GameSessionRepository } from '../repositories/GameSessionRepository.js';
import { QuestionRepository } from '../repositories/QuestionRepository.js';
import { TtlCache } from '../utils/cache.js';

export interface LeaderboardEntry extends HallOfFameEntry {
  rank: number;
  medal?: 'gold' | 'silver' | 'bronze' | undefined;
}

export interface HallOfFameSubmission {
  sessionId: number;
  username: string;
  characterName?: string;
  score: number;
  accuracy: number;
  maxMultiplier: number;
  questionSetId: number;
  questionSetName: string;
}

export interface LeaderboardResponse {
  questionSetId: number;
  questionSetName: string;
  entries: LeaderboardEntry[];
  totalEntries: number;
}

export class HallOfFameService {
  private hallOfFameRepository: HallOfFameRepository;
  private gameSessionRepository: GameSessionRepository;
  private questionRepository: QuestionRepository;

  // Caches
  private leaderboardCache = new TtlCache<string, LeaderboardResponse>('hof:leaderboard');
  private allLeaderboardsCache = new TtlCache<string, Record<string, LeaderboardResponse>>('hof:all');
  private recentCache = new TtlCache<string, LeaderboardEntry[]>('hof:recent');
  private statsCache = new TtlCache<string, { totalEntries: number; uniquePlayers: number; averageScore: number; highestScore: number; averageAccuracy: number; }>('hof:stats');
  private userBestCache = new TtlCache<string, LeaderboardEntry[]>('hof:userBest');
  private userRankCache = new TtlCache<string, number | null>('hof:userRank');

  constructor() {
    this.hallOfFameRepository = new HallOfFameRepository();
    this.gameSessionRepository = new GameSessionRepository();
    this.questionRepository = new QuestionRepository();
  }

  /**
   * Submit a score to the Hall of Fame
   */
  async submitScore(submission: HallOfFameSubmission): Promise<HallOfFameEntry> {
    try {
      // Validate the game session exists and is completed
      const session = await this.gameSessionRepository.findGameSessionById(submission.sessionId);
      if (!session) {
        throw new Error('Game session not found');
      }

      // Check if score is eligible for Hall of Fame
      const isEligible = await this.hallOfFameRepository.isScoreEligibleForHallOfFame(
        submission.score,
        submission.questionSetId
      );

      if (!isEligible) {
        throw new Error('Score is not high enough to qualify for Hall of Fame');
      }

      // Create Hall of Fame entry
      const entryData: CreateHallOfFameData = {
        username: submission.username,
        score: submission.score,
        accuracy: submission.accuracy,
        max_multiplier: submission.maxMultiplier,
        question_set_name: submission.questionSetName,
        question_set_id: submission.questionSetId,
        session_id: submission.sessionId,
        ...(submission.characterName && { character_name: submission.characterName })
      };

      const entry = await this.hallOfFameRepository.createEntry(entryData);

      // Invalidate caches affected by this write
      this.leaderboardCache.clear(); // different limits unknown; clear namespace
      this.allLeaderboardsCache.clear();
      this.recentCache.clear();
      this.statsCache.clear();
      this.userBestCache.invalidate(submission.username);
      this.userRankCache.invalidate(`${submission.username}:${submission.questionSetId}`);

      return entry;
    } catch (error) {
      console.error('Error submitting score to Hall of Fame:', error);
      throw error;
    }
  }

  /**
   * Get leaderboard for a specific question set
   */
  async getQuestionSetLeaderboard(questionSetId: number, limit: number = 10): Promise<LeaderboardResponse> {
    const cacheKey = `${questionSetId}:${limit}`;
    return this.leaderboardCache.getOrRefresh(
      cacheKey,
      { ttlMs: 30_000, staleWhileRevalidateMs: 60_000 },
      async () => {
        const entries = await this.hallOfFameRepository.getQuestionSetLeaderboard(questionSetId, limit);
        const questionSet = await this.questionRepository.findQuestionSetById(questionSetId);
        // Add medal information
        const entriesWithMedals: LeaderboardEntry[] = entries.map((entry: HallOfFameEntry & { rank: number }) => ({
          ...entry,
          medal: this.getMedalType(entry.rank)
        }));
        return {
          questionSetId,
          questionSetName: questionSet?.name || 'Unknown Question Set',
          entries: entriesWithMedals,
          totalEntries: await this.hallOfFameRepository.getEntryCountForQuestionSet(questionSetId)
        };
      }
    );
  }

  /**
   * Get all leaderboards for all question sets
   */
  async getAllLeaderboards(): Promise<Record<string, LeaderboardResponse>> {
    return this.allLeaderboardsCache.getOrRefresh(
      'all',
      { ttlMs: 30_000, staleWhileRevalidateMs: 60_000 },
      async () => {
        const leaderboards = await this.hallOfFameRepository.getAllQuestionSetLeaderboards();
        const questionSets = await this.questionRepository.findAllQuestionSets();
        const result: Record<string, LeaderboardResponse> = {};
        for (const [questionSetName, entries] of Object.entries(leaderboards)) {
          const questionSet = questionSets.find((qs: any) => qs.name === questionSetName);
          const entriesWithMedals: LeaderboardEntry[] = (entries as any[]).map((entry: any) => ({
            ...entry,
            medal: this.getMedalType(entry.rank)
          }));
          result[questionSetName] = {
            questionSetId: (questionSet as any)?.id || 0,
            questionSetName,
            entries: entriesWithMedals,
            totalEntries: entries.length
          };
        }
        return result;
      }
    );
  }

  /**
   * Get user's best scores across all question sets
   */
  async getUserBestScores(username: string): Promise<LeaderboardEntry[]> {
    return this.userBestCache.getOrRefresh(
      username,
      { ttlMs: 30_000, staleWhileRevalidateMs: 60_000 },
      async () => {
        const entries = await this.hallOfFameRepository.getUserBestScores(username);
        return entries.map((entry: HallOfFameEntry) => ({
          ...entry,
          rank: 0, // Individual user entries don't have ranks
          medal: undefined
        }));
      }
    );
  }

  /**
   * Get user's rank in a specific question set
   */
  async getUserRankInQuestionSet(username: string, questionSetId: number): Promise<number | null> {
    const key = `${username}:${questionSetId}`;
    return this.userRankCache.getOrRefresh(
      key,
      { ttlMs: 30_000, staleWhileRevalidateMs: 60_000 },
      async () => {
        return await this.hallOfFameRepository.getUserRankInQuestionSet(username, questionSetId);
      }
    );
  }

  /**
   * Get recent Hall of Fame entries
   */
  async getRecentEntries(limit: number = 20): Promise<LeaderboardEntry[]> {
    return this.recentCache.getOrRefresh(
      String(limit),
      { ttlMs: 30_000, staleWhileRevalidateMs: 60_000 },
      async () => {
        const entries = await this.hallOfFameRepository.getRecentEntries(limit);
        return entries.map((entry: HallOfFameEntry) => ({
          ...entry,
          rank: 0, // Recent entries don't have ranks
          medal: undefined
        }));
      }
    );
  }

  /**
   * Get Hall of Fame statistics
   */
  async getStatistics(): Promise<{
    totalEntries: number;
    uniquePlayers: number;
    averageScore: number;
    highestScore: number;
    averageAccuracy: number;
  }> {
    return this.statsCache.getOrRefresh(
      'stats',
      { ttlMs: 60_000, staleWhileRevalidateMs: 120_000 },
      async () => {
        return await this.hallOfFameRepository.getStatistics();
      }
    );
  }

  /**
   * Search Hall of Fame entries
   */
  async searchEntries(searchTerm: string, limit: number = 50): Promise<LeaderboardEntry[]> {
    // Search results are dynamic; keep a short TTL
    const key = `${searchTerm}:${limit}`;
    return this.recentCache.getOrRefresh(
      `search:${key}`,
      { ttlMs: 15_000, staleWhileRevalidateMs: 30_000 },
      async () => {
        const entries = await this.hallOfFameRepository.searchEntries(searchTerm, limit);
        return entries.map((entry: HallOfFameEntry) => ({
          ...entry,
          rank: 0, // Search results don't have ranks
          medal: undefined
        }));
      }
    );
  }

  /**
   * Validate if a game session is eligible for Hall of Fame submission
   */
  async validateEligibility(sessionId: number): Promise<{
    isEligible: boolean;
    reason?: string;
    completionRate: number;
    totalQuestions: number;
    completedQuestions: number;
  }> {
    try {
      const session = await this.gameSessionRepository.findGameSessionById(sessionId);
      if (!session) {
        return {
          isEligible: false,
          reason: 'Game session not found',
          completionRate: 0,
          totalQuestions: 0,
          completedQuestions: 0
        };
      }

      // For now, we'll assume the session is completed if it exists
      // In a real implementation, you'd check the session status
      const totalQuestions = session.total_questions || 0;
      const completedQuestions = session.total_questions || 0; // Simplified for now
      const completionRate = totalQuestions > 0 ? completedQuestions / totalQuestions : 0;

      // Must complete at least 80% of questions to qualify
      if (completionRate < 0.8) {
        return {
          isEligible: false,
          reason: 'Must complete at least 80% of questions',
          completionRate,
          totalQuestions,
          completedQuestions
        };
      }

      // Check if score is high enough
      const isScoreEligible = await this.hallOfFameRepository.isScoreEligibleForHallOfFame(
        0, // We'll need to get the actual score from the session
        session.question_set_id || 0
      );

      if (!isScoreEligible) {
        return {
          isEligible: false,
          reason: 'Score is not high enough to qualify for Hall of Fame',
          completionRate,
          totalQuestions,
          completedQuestions
        };
      }

      return {
        isEligible: true,
        completionRate,
        totalQuestions,
        completedQuestions
      };
    } catch (error) {
      console.error('Error validating Hall of Fame eligibility:', error);
      throw error;
    }
  }

  /**
   * Get medal type based on rank
   */
  private getMedalType(rank: number): 'gold' | 'silver' | 'bronze' | undefined {
    switch (rank) {
      case 1: return 'gold';
      case 2: return 'silver';
      case 3: return 'bronze';
      default: return undefined;
    }
  }
} 