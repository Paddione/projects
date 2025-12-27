import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ScoringService, ScoreCalculation, PlayerStatistics } from '../ScoringService';
import { GameSessionRepository, CreatePlayerResultData, PlayerResult } from '../../repositories/GameSessionRepository';
import { CharacterService } from '../CharacterService';
import { User } from '../../repositories/UserRepository';

// Mock the dependencies
jest.mock('../../repositories/GameSessionRepository');
jest.mock('../CharacterService');
jest.mock('../../middleware/logging', () => ({
  RequestLogger: {
    logGameEvent: jest.fn()
  }
}));

describe('ScoringService', () => {
  let scoringService: ScoringService;
  let mockGameSessionRepository: jest.Mocked<GameSessionRepository>;
  let mockCharacterService: jest.Mocked<CharacterService>;

  // Test data
  const mockPlayerResult: PlayerResult = {
    id: 1,
    session_id: 123,
    user_id: 456,
    username: 'testuser',
    character_name: 'student',
    final_score: 1500,
    correct_answers: 8,
    total_questions: 10,
    max_multiplier: 4,
    completion_time: 300,
    answer_details: [
      {
        questionId: 1,
        selectedAnswer: 'A',
        isCorrect: true,
        timeElapsed: 25,
        pointsEarned: 140,
        multiplierUsed: 2
      }
    ]
  };

  const mockPlayerStats = {
    totalGames: 5,
    totalScore: 2500,
    averageScore: 500,
    averageAccuracy: 85.5,
    maxMultiplier: 5,
    bestScore: 800
  };

  const mockTopPlayers = [
    {
      id: 1,
      session_id: 123,
      user_id: 456,
      username: 'player1',
      character_name: 'professor',
      final_score: 2000,
      correct_answers: 10,
      total_questions: 10,
      max_multiplier: 5,
      completion_time: 250,
      answer_details: []
    },
    {
      id: 2,
      session_id: 124,
      user_id: 457,
      username: 'player2',
      character_name: 'student',
      final_score: 1800,
      correct_answers: 9,
      total_questions: 10,
      max_multiplier: 4,
      completion_time: 280,
      answer_details: []
    }
  ];

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Setup mocks
    mockGameSessionRepository = new GameSessionRepository() as jest.Mocked<GameSessionRepository>;
    // Ensure commonly used repository methods are jest.fn for ESM auto-mock
    (mockGameSessionRepository as any).getPlayerStats = jest.fn();
    (mockGameSessionRepository as any).getTopPlayersByScore = jest.fn();
    (mockGameSessionRepository as any).createPlayerResult = jest.fn();
    mockCharacterService = new CharacterService() as jest.Mocked<CharacterService>;
    (mockCharacterService as any).awardExperience = jest.fn();

    // Create ScoringService instance
    scoringService = new ScoringService();
    
    // Replace the private instances with our mocks
    (scoringService as any).gameSessionRepository = mockGameSessionRepository;
    (scoringService as any).characterService = mockCharacterService;
  });

  describe('calculateScore', () => {
    it('should calculate correct score for fast correct answer with multiplier', () => {
      const result = scoringService.calculateScore(10, 2, true, 3);

      expect(result).toEqual({
        timeElapsed: 10,
        multiplier: 2,
        isCorrect: true,
        pointsEarned: 100, // (60 - 10) * 2
        newMultiplier: 3, // Math.min(5, Math.floor(4/2) + 1)
        streakCount: 4
      });
    });

    it('should calculate correct score for slow correct answer', () => {
      const result = scoringService.calculateScore(55, 1, true, 0);

      expect(result).toEqual({
        timeElapsed: 55,
        multiplier: 1,
        isCorrect: true,
        pointsEarned: 5, // (60 - 55) * 1
        newMultiplier: 1, // Math.min(5, Math.floor(1/2) + 1)
        streakCount: 1
      });
    });

    it('should handle time elapsed greater than 60 seconds', () => {
      const result = scoringService.calculateScore(65, 3, true, 5);

      expect(result).toEqual({
        timeElapsed: 65,
        multiplier: 3,
        isCorrect: true,
        pointsEarned: 0, // Math.max(0, 60 - 65) * 3
        newMultiplier: 4, // Math.min(5, Math.floor(6/2) + 1)
        streakCount: 6
      });
    });

    it('should reset multiplier and streak for incorrect answer', () => {
      const result = scoringService.calculateScore(30, 4, false, 7);

      expect(result).toEqual({
        timeElapsed: 30,
        multiplier: 4,
        isCorrect: false,
        pointsEarned: 0,
        newMultiplier: 1,
        streakCount: 0
      });
    });

    it('should cap multiplier at 5x', () => {
      const result = scoringService.calculateScore(20, 5, true, 10);

      expect(result).toEqual({
        timeElapsed: 20,
        multiplier: 5,
        isCorrect: true,
        pointsEarned: 200, // (60 - 20) * 5
        newMultiplier: 5, // Capped at 5
        streakCount: 11
      });
    });

    it('should handle edge case with zero time elapsed', () => {
      const result = scoringService.calculateScore(0, 1, true, 0);

      expect(result).toEqual({
        timeElapsed: 0,
        multiplier: 1,
        isCorrect: true,
        pointsEarned: 60, // (60 - 0) * 1
        newMultiplier: 1,
        streakCount: 1
      });
    });

    it('should handle negative time elapsed', () => {
      const result = scoringService.calculateScore(-5, 2, true, 1);

      expect(result).toEqual({
        timeElapsed: -5,
        multiplier: 2,
        isCorrect: true,
        pointsEarned: 130, // (60 - (-5)) * 2
        newMultiplier: 2, // Math.min(5, Math.floor(2/2) + 1)
        streakCount: 2
      });
    });
  });

  describe('savePlayerResult', () => {
      const mockPlayerData = {
    userId: 456,
    username: 'testuser',
    characterName: 'student',
    finalScore: 1500,
    correctAnswers: 8,
    totalQuestions: 10,
    maxMultiplier: 4,
    completionTime: 300,
    answerDetails: [
      {
        questionId: 1,
        selectedAnswer: 'A',
        isCorrect: true,
        timeElapsed: 25,
        pointsEarned: 140,
        multiplierUsed: 2
      }
    ]
  };

  const mockUser: User = {
    id: 456,
    username: 'testuser',
    email: 'test@example.com',
    password_hash: 'hashed_password',
    email_verified: true,
    selected_character: 'student',
    character_level: 2,
    experience_points: 500,
    created_at: new Date('2024-01-01'),
    is_active: true,
    is_admin: false,
    preferences: {
      language: 'en',
      theme: 'light'
    }
  };

    it('should save player result and award experience successfully', async () => {
      const mockExperienceResult = {
        user: mockUser,
        levelUp: true,
        newLevel: 3,
        oldLevel: 2,
        progress: { currentLevel: 3, progress: 0.5, expInLevel: 500, expForNextLevel: 1000 }
      };

      mockGameSessionRepository.createPlayerResult.mockResolvedValue(mockPlayerResult);
      mockCharacterService.awardExperience.mockResolvedValue(mockExperienceResult);

      const result = await scoringService.savePlayerResult(123, mockPlayerData);

      expect(mockGameSessionRepository.createPlayerResult).toHaveBeenCalledWith({
        session_id: 123,
        user_id: 456,
        username: 'testuser',
        character_name: 'student',
        final_score: 1500,
        correct_answers: 8,
        total_questions: 10,
        max_multiplier: 4,
        completion_time: 300,
        answer_details: mockPlayerData.answerDetails
      });

      expect(mockCharacterService.awardExperience).toHaveBeenCalledWith(456, 1500);
      expect(result).toEqual({
        experienceAwarded: 1500,
        levelUp: true,
        newLevel: 3,
        oldLevel: 2
      });
    });

    it('should handle player result without userId', async () => {
      const { userId, ...playerDataWithoutUserId } = mockPlayerData;

      mockGameSessionRepository.createPlayerResult.mockResolvedValue(mockPlayerResult);

      const result = await scoringService.savePlayerResult(123, playerDataWithoutUserId);

      expect(mockGameSessionRepository.createPlayerResult).toHaveBeenCalledWith({
        session_id: 123,
        username: 'testuser',
        character_name: 'student',
        final_score: 1500,
        correct_answers: 8,
        total_questions: 10,
        max_multiplier: 4,
        completion_time: 300,
        answer_details: mockPlayerData.answerDetails
      });

      expect(mockCharacterService.awardExperience).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should handle experience awarding failure gracefully', async () => {
      mockGameSessionRepository.createPlayerResult.mockResolvedValue(mockPlayerResult);
      mockCharacterService.awardExperience.mockRejectedValue(new Error('Experience service error'));

      const result = await scoringService.savePlayerResult(123, mockPlayerData);

      expect(mockGameSessionRepository.createPlayerResult).toHaveBeenCalled();
      expect(mockCharacterService.awardExperience).toHaveBeenCalledWith(456, 1500);
      expect(result).toBeNull();
    });

    it('should handle repository error', async () => {
      mockGameSessionRepository.createPlayerResult.mockRejectedValue(new Error('Database error'));

      await expect(scoringService.savePlayerResult(123, mockPlayerData)).rejects.toThrow('Database error');
    });

    it('should handle optional fields correctly', async () => {
      const minimalPlayerData = {
        username: 'testuser',
        finalScore: 1000,
        correctAnswers: 5,
        totalQuestions: 10,
        maxMultiplier: 2,
        answerDetails: []
      };

      mockGameSessionRepository.createPlayerResult.mockResolvedValue(mockPlayerResult);

      await scoringService.savePlayerResult(123, minimalPlayerData);

      expect(mockGameSessionRepository.createPlayerResult).toHaveBeenCalledWith({
        session_id: 123,
        username: 'testuser',
        final_score: 1000,
        correct_answers: 5,
        total_questions: 10,
        max_multiplier: 2,
        answer_details: []
      });
    });
  });

  describe('getPlayerStatistics', () => {
    it('should return player statistics successfully', async () => {
      mockGameSessionRepository.getPlayerStats.mockResolvedValue(mockPlayerStats);

      const result = await scoringService.getPlayerStatistics(456);

      expect(mockGameSessionRepository.getPlayerStats).toHaveBeenCalledWith(456);
      expect(result).toEqual({
        totalGames: 5,
        totalScore: 2500,
        averageScore: 500,
        averageAccuracy: 85.5,
        maxMultiplier: 5,
        bestScore: 800,
        totalCorrectAnswers: 0,
        totalQuestions: 0,
        currentStreak: 0,
        bestStreak: 0
      });
    });

    it('should handle repository error', async () => {
      mockGameSessionRepository.getPlayerStats.mockRejectedValue(new Error('Database error'));

      await expect(scoringService.getPlayerStatistics(456)).rejects.toThrow('Database error');
    });
  });

  describe('getLeaderboard', () => {
    it('should return leaderboard with default limit', async () => {
      mockGameSessionRepository.getTopPlayersByScore.mockResolvedValue(mockTopPlayers);

      const result = await scoringService.getLeaderboard(1);

      expect(mockGameSessionRepository.getTopPlayersByScore).toHaveBeenCalledWith(100);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        rank: 1,
        username: 'player1',
        characterName: 'professor',
        finalScore: 2000,
        correctAnswers: 10,
        maxMultiplier: 5,
        accuracy: 100,
        completionTime: 250
      });
      expect(result[1]).toEqual({
        rank: 2,
        username: 'player2',
        characterName: 'student',
        finalScore: 1800,
        correctAnswers: 9,
        maxMultiplier: 4,
        accuracy: 90,
        completionTime: 280
      });
    });

    it('should return leaderboard with custom limit', async () => {
      mockGameSessionRepository.getTopPlayersByScore.mockResolvedValue(mockTopPlayers);

      const result = await scoringService.getLeaderboard(1, 5);

      expect(mockGameSessionRepository.getTopPlayersByScore).toHaveBeenCalledWith(100);
      expect(result).toHaveLength(2); // Only 2 players in mock data
    });

    it('should filter out zero scores', async () => {
      const playersWithZeroScore: PlayerResult[] = [
        { ...mockTopPlayers[0]!, final_score: 0 },
        mockTopPlayers[1]!
      ];
      mockGameSessionRepository.getTopPlayersByScore.mockResolvedValue(playersWithZeroScore);

      const result = await scoringService.getLeaderboard(1);

      expect(result).toHaveLength(1);
      expect(result[0]?.username).toBe('player2');
    });

    it('should handle empty results', async () => {
      mockGameSessionRepository.getTopPlayersByScore.mockResolvedValue([]);

      const result = await scoringService.getLeaderboard(1);

      expect(result).toEqual([]);
    });

    it('should handle repository error', async () => {
      mockGameSessionRepository.getTopPlayersByScore.mockRejectedValue(new Error('Database error'));

      await expect(scoringService.getLeaderboard(1)).rejects.toThrow('Database error');
    });

    it('should calculate accuracy correctly for zero questions', () => {
      const playersWithZeroQuestions: PlayerResult[] = [
        { ...mockTopPlayers[0]!, total_questions: 0 }
      ];
      mockGameSessionRepository.getTopPlayersByScore.mockResolvedValue(playersWithZeroQuestions);

      return scoringService.getLeaderboard(1).then((result: Array<{ accuracy: number }>) => {
        expect(result[0]?.accuracy).toBe(0);
      });
    });
  });

  describe('validateHallOfFameEligibility', () => {
    it('should return true for 80% completion rate', () => {
      const result = scoringService.validateHallOfFameEligibility(1, 10, 8);
      expect(result).toBe(true);
    });

    it('should return true for 100% completion rate', () => {
      const result = scoringService.validateHallOfFameEligibility(1, 10, 10);
      expect(result).toBe(true);
    });

    it('should return false for less than 80% completion rate', () => {
      const result = scoringService.validateHallOfFameEligibility(1, 10, 7);
      expect(result).toBe(false);
    });

    it('should return false for 0% completion rate', () => {
      const result = scoringService.validateHallOfFameEligibility(1, 10, 0);
      expect(result).toBe(false);
    });

    it('should handle edge case with zero total questions', () => {
      const result = scoringService.validateHallOfFameEligibility(1, 0, 0);
      expect(result).toBe(false); // 0/0 = NaN, which is falsy
    });
  });

  describe('calculateAccuracy', () => {
    it('should calculate accuracy correctly', () => {
      const result = scoringService.calculateAccuracy(8, 10);
      expect(result).toBe(80);
    });

    it('should return 0 for zero total questions', () => {
      const result = scoringService.calculateAccuracy(5, 0);
      expect(result).toBe(0);
    });

    it('should round accuracy to nearest integer', () => {
      const result = scoringService.calculateAccuracy(7, 9);
      expect(result).toBe(78); // 7/9 * 100 = 77.77... rounded to 78
    });

    it('should handle 100% accuracy', () => {
      const result = scoringService.calculateAccuracy(10, 10);
      expect(result).toBe(100);
    });

    it('should handle 0% accuracy', () => {
      const result = scoringService.calculateAccuracy(0, 10);
      expect(result).toBe(0);
    });
  });

  describe('getMedalType', () => {
    it('should return gold for first place', () => {
      const result = scoringService.getMedalType(1);
      expect(result).toBe('gold');
    });

    it('should return silver for second place', () => {
      const result = scoringService.getMedalType(2);
      expect(result).toBe('silver');
    });

    it('should return bronze for third place', () => {
      const result = scoringService.getMedalType(3);
      expect(result).toBe('bronze');
    });

    it('should return null for other ranks', () => {
      expect(scoringService.getMedalType(4)).toBeNull();
      expect(scoringService.getMedalType(10)).toBeNull();
      expect(scoringService.getMedalType(0)).toBeNull();
    });
  });

  describe('calculateStreakBonus', () => {
    it('should return 50 for streak of 5 or more', () => {
      expect(scoringService.calculateStreakBonus(5)).toBe(50);
      expect(scoringService.calculateStreakBonus(10)).toBe(50);
    });

    it('should return 25 for streak of 3 or 4', () => {
      expect(scoringService.calculateStreakBonus(3)).toBe(25);
      expect(scoringService.calculateStreakBonus(4)).toBe(25);
    });

    it('should return 10 for streak of 2', () => {
      expect(scoringService.calculateStreakBonus(2)).toBe(10);
    });

    it('should return 0 for streak of 1 or less', () => {
      expect(scoringService.calculateStreakBonus(1)).toBe(0);
      expect(scoringService.calculateStreakBonus(0)).toBe(0);
    });
  });

  describe('getPerformanceRating', () => {
    it('should return Perfect for high accuracy and multiplier', () => {
      const result = scoringService.getPerformanceRating(1000, 95, 4);
      expect(result).toBe('Perfect');
    });

    it('should return Excellent for good accuracy and multiplier', () => {
      const result = scoringService.getPerformanceRating(800, 85, 3);
      expect(result).toBe('Excellent');
    });

    it('should return Good for decent accuracy and multiplier', () => {
      const result = scoringService.getPerformanceRating(600, 75, 2);
      expect(result).toBe('Good');
    });

    it('should return Fair for moderate accuracy', () => {
      const result = scoringService.getPerformanceRating(400, 65, 1);
      expect(result).toBe('Fair');
    });

    it('should return Poor for low accuracy', () => {
      const result = scoringService.getPerformanceRating(200, 50, 1);
      expect(result).toBe('Poor');
    });

    it('should handle edge cases', () => {
      expect(scoringService.getPerformanceRating(1000, 89, 4)).toBe('Excellent');
      expect(scoringService.getPerformanceRating(1000, 79, 3)).toBe('Good');
      expect(scoringService.getPerformanceRating(1000, 59, 2)).toBe('Poor');
    });
  });

  describe('Error Handling', () => {
    it('should handle negative values in calculateScore gracefully', () => {
      const result = scoringService.calculateScore(-10, -1, true, -5);
      
      expect(result.timeElapsed).toBe(-10);
      expect(result.multiplier).toBe(-1);
      // With negative time elapsed, points can be negative due to the calculation
      expect(result.pointsEarned).toBe(-70); // (60 - (-10)) * (-1) = 70 * (-1) = -70
      // With negative streak, multiplier calculation can result in negative values
      expect(result.newMultiplier).toBe(-1); // Math.min(5, Math.floor(-4/2) + 1) = Math.min(5, -1) = -1
      expect(result.streakCount).toBe(-4); // -5 + 1 = -4
    });

    it('should handle very large values in calculateScore', () => {
      const result = scoringService.calculateScore(1000, 10, true, 100);
      
      expect(result.pointsEarned).toBe(0); // Time bonus would be negative
      expect(result.newMultiplier).toBe(5); // Capped at 5
      expect(result.streakCount).toBe(101);
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete game flow scenario', async () => {
      // Simulate a player answering questions correctly with increasing streak
      const answers = [
        { timeElapsed: 30, currentMultiplier: 1, isCorrect: true, currentStreak: 0 },
        { timeElapsed: 25, currentMultiplier: 2, isCorrect: true, currentStreak: 1 },
        { timeElapsed: 20, currentMultiplier: 3, isCorrect: true, currentStreak: 2 },
        { timeElapsed: 15, currentMultiplier: 4, isCorrect: false, currentStreak: 3 },
        { timeElapsed: 35, currentMultiplier: 1, isCorrect: true, currentStreak: 0 }
      ];

      let currentMultiplier = 1;
      let currentStreak = 0;
      let totalScore = 0;

      for (const answer of answers) {
        const result = scoringService.calculateScore(
          answer.timeElapsed,
          currentMultiplier,
          answer.isCorrect,
          currentStreak
        );
        
        totalScore += result.pointsEarned;
        currentMultiplier = result.newMultiplier;
        currentStreak = result.streakCount;
      }

      expect(totalScore).toBeGreaterThan(0);
      expect(currentMultiplier).toBe(1); // Reset after incorrect answer
      expect(currentStreak).toBe(1); // Reset after incorrect answer
    });

    it('should handle player result with experience awarding', async () => {
      const mockExperienceResult = {
        user: {
          id: 456,
          username: 'testuser',
          email: 'test@example.com',
          password_hash: 'hashed_password',
          email_verified: true,
          selected_character: 'student',
          character_level: 2,
          experience_points: 500,
          created_at: new Date('2024-01-01'),
          is_active: true,
          is_admin: false,
          preferences: {
            language: 'en' as const,
            theme: 'light' as const
          }
        },
        levelUp: false,
        newLevel: 2,
        oldLevel: 2,
        progress: { currentLevel: 2, progress: 0.7, expInLevel: 700, expForNextLevel: 1000 }
      };

      mockGameSessionRepository.createPlayerResult.mockResolvedValue(mockPlayerResult);
      mockCharacterService.awardExperience.mockResolvedValue(mockExperienceResult);

      const playerData = {
        userId: 456,
        username: 'testuser',
        finalScore: 800,
        correctAnswers: 6,
        totalQuestions: 10,
        maxMultiplier: 3,
        answerDetails: []
      };

      const result = await scoringService.savePlayerResult(123, playerData);

      expect(result).toEqual({
        experienceAwarded: 800,
        levelUp: false,
        newLevel: 2,
        oldLevel: 2
      });
    });
  });
}); 