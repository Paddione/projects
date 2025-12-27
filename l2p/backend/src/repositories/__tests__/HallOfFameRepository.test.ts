import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import { HallOfFameRepository, HallOfFameEntry, CreateHallOfFameData } from '../HallOfFameRepository';
import { BaseRepository } from '../BaseRepository';

// Mock the BaseRepository
jest.mock('../BaseRepository');

describe('HallOfFameRepository', () => {
  let hallOfFameRepository: HallOfFameRepository;
  let mockDb: any;

  const mockHallOfFameEntry: HallOfFameEntry = {
    id: 1,
    username: 'testuser',
    character_name: 'Warrior',
    score: 1200,
    accuracy: 85.5,
    max_multiplier: 5,
    question_set_name: 'General Knowledge',
    question_set_id: 1,
    completed_at: new Date('2024-01-01T10:30:00Z'),
    session_id: 123
  };

  const mockCreateData: CreateHallOfFameData = {
    username: 'testuser',
    character_name: 'Warrior',
    score: 1200,
    accuracy: 85.5,
    max_multiplier: 5,
    question_set_name: 'General Knowledge',
    question_set_id: 1,
    session_id: 123
  };

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Mock database connection and query methods
    mockDb = {
      query: jest.fn()
    };

    // Set global database service for BaseRepository.getDb() to find
    (globalThis as any).__DB_SERVICE__ = mockDb;

    // Create HallOfFameRepository instance
    hallOfFameRepository = new HallOfFameRepository();
    
    // Ensure the repository's db property is set to our mock
    (hallOfFameRepository as any).db = mockDb;

    // Mock the getDb method directly to ensure it returns our mock
    jest.spyOn(hallOfFameRepository as any, 'getDb').mockReturnValue(mockDb);
    
    // Mock BaseRepository methods
    jest.spyOn(BaseRepository.prototype as any, 'findById').mockImplementation(() => Promise.resolve(null));
    jest.spyOn(BaseRepository.prototype as any, 'create').mockImplementation(() => Promise.resolve({}));
    jest.spyOn(BaseRepository.prototype as any, 'update').mockImplementation(() => Promise.resolve(null));
    jest.spyOn(BaseRepository.prototype as any, 'delete').mockImplementation(() => Promise.resolve(false));
    jest.spyOn(BaseRepository.prototype as any, 'findAll').mockImplementation(() => Promise.resolve([]));
    jest.spyOn(BaseRepository.prototype as any, 'exists').mockImplementation(() => Promise.resolve(false));
    jest.spyOn(BaseRepository.prototype as any, 'count').mockImplementation(() => Promise.resolve(0));
  });

  afterEach(() => {
    // Clean up the global mock after each test
    delete (globalThis as any).__DB_SERVICE__;
  });

  describe('Basic CRUD Operations', () => {
    describe('findEntryById', () => {
      it('should find a hall of fame entry by ID', async () => {
        const mockBaseRepository = BaseRepository as any;
        mockBaseRepository.prototype.findById.mockResolvedValueOnce(mockHallOfFameEntry);

        const result = await hallOfFameRepository.findEntryById(1);

        expect(mockBaseRepository.prototype.findById).toHaveBeenCalledWith('hall_of_fame', 1);
        expect(result).toEqual(mockHallOfFameEntry);
      });

      it('should return null when entry not found', async () => {
        const mockBaseRepository = BaseRepository as any;
        mockBaseRepository.prototype.findById.mockResolvedValueOnce(null);

        const result = await hallOfFameRepository.findEntryById(999);

        expect(result).toBeNull();
      });
    });

    describe('createEntry', () => {
      it('should create a new hall of fame entry', async () => {
        const mockBaseRepository = BaseRepository as any;
        mockBaseRepository.prototype.create.mockResolvedValueOnce(mockHallOfFameEntry);

        const result = await hallOfFameRepository.createEntry(mockCreateData);

        expect(mockBaseRepository.prototype.create).toHaveBeenCalledWith('hall_of_fame', mockCreateData);
        expect(result).toEqual(mockHallOfFameEntry);
      });

      it('should create entry without character name', async () => {
        const dataWithoutCharacter = { ...mockCreateData };
        delete dataWithoutCharacter.character_name;

        const mockBaseRepository = BaseRepository as any;
        mockBaseRepository.prototype.create.mockResolvedValueOnce({ ...mockHallOfFameEntry, character_name: null });

        const result = await hallOfFameRepository.createEntry(dataWithoutCharacter);

        expect(mockBaseRepository.prototype.create).toHaveBeenCalledWith('hall_of_fame', dataWithoutCharacter);
        expect(result.character_name).toBeNull();
      });
    });

    describe('updateEntry', () => {
      it('should update a hall of fame entry', async () => {
        const updateData = { score: 1300, accuracy: 90.0 };

        const mockBaseRepository = BaseRepository as any;
        mockBaseRepository.prototype.update.mockResolvedValueOnce({ ...mockHallOfFameEntry, ...updateData });

        const result = await hallOfFameRepository.updateEntry(1, updateData);

        expect(mockBaseRepository.prototype.update).toHaveBeenCalledWith('hall_of_fame', 1, updateData);
        expect(result).toEqual({ ...mockHallOfFameEntry, ...updateData });
      });

      it('should return null when entry not found for update', async () => {
        const mockBaseRepository = BaseRepository as any;
        mockBaseRepository.prototype.update.mockResolvedValueOnce(null);

        const result = await hallOfFameRepository.updateEntry(999, { score: 1300 });

        expect(result).toBeNull();
      });
    });

    describe('deleteEntry', () => {
      it('should delete a hall of fame entry', async () => {
        const mockBaseRepository = BaseRepository as any;
        mockBaseRepository.prototype.delete.mockResolvedValueOnce(true);

        const result = await hallOfFameRepository.deleteEntry(1);

        expect(mockBaseRepository.prototype.delete).toHaveBeenCalledWith('hall_of_fame', 1);
        expect(result).toBe(true);
      });

      it('should return false when entry not found for deletion', async () => {
        const mockBaseRepository = BaseRepository as any;
        mockBaseRepository.prototype.delete.mockResolvedValueOnce(false);

        const result = await hallOfFameRepository.deleteEntry(999);

        expect(result).toBe(false);
      });
    });
  });

  describe('Leaderboard Operations', () => {
    describe('getTopScores', () => {
      it('should get top scores for all question sets', async () => {
        const topScores = [mockHallOfFameEntry, { ...mockHallOfFameEntry, id: 2, score: 1100 }];

        mockDb.query.mockResolvedValueOnce({
          rows: topScores,
          rowCount: 2
        });

        const result = await hallOfFameRepository.getTopScores();

        expect(mockDb.query).toHaveBeenCalledWith(
          'SELECT * FROM hall_of_fame ORDER BY score DESC, completed_at ASC LIMIT $1',
          [10]
        );
        expect(result).toEqual(topScores);
      });

      it('should get top scores for specific question set', async () => {
        const topScores = [mockHallOfFameEntry];

        mockDb.query.mockResolvedValueOnce({
          rows: topScores,
          rowCount: 1
        });

        const result = await hallOfFameRepository.getTopScores(1, 5);

        expect(mockDb.query).toHaveBeenCalledWith(
          'SELECT * FROM hall_of_fame WHERE question_set_id = $1 ORDER BY score DESC, completed_at ASC LIMIT $2',
          [1, 5]
        );
        expect(result).toEqual(topScores);
      });

      it('should use default limit of 10', async () => {
        mockDb.query.mockResolvedValueOnce({
          rows: [mockHallOfFameEntry],
          rowCount: 1
        });

        await hallOfFameRepository.getTopScores(1);

        expect(mockDb.query).toHaveBeenCalledWith(
          'SELECT * FROM hall_of_fame WHERE question_set_id = $1 ORDER BY score DESC, completed_at ASC LIMIT $2',
          [1, 10]
        );
      });
    });

    describe('getTopScoresByQuestionSet', () => {
      it('should get top scores grouped by question set with rankings', async () => {
        const rankedEntries = [
          { ...mockHallOfFameEntry, rank: 1 },
          { ...mockHallOfFameEntry, id: 2, question_set_id: 2, rank: 1 }
        ];

        mockDb.query.mockResolvedValueOnce({
          rows: rankedEntries,
          rowCount: 2
        });

        const result = await hallOfFameRepository.getTopScoresByQuestionSet(5);

        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('WITH ranked_entries AS'),
          [5]
        );
        expect(result).toEqual(rankedEntries);
      });
    });

    describe('getUserBestScores', () => {
      it('should get best scores for a user across all question sets', async () => {
        const userScores = [
          mockHallOfFameEntry,
          { ...mockHallOfFameEntry, question_set_id: 2, score: 1100 }
        ];

        mockDb.query.mockResolvedValueOnce({
          rows: userScores,
          rowCount: 2
        });

        const result = await hallOfFameRepository.getUserBestScores('testuser');

        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('SELECT DISTINCT ON (question_set_id)'),
          ['testuser']
        );
        expect(result).toEqual(userScores);
      });
    });

    describe('getUserRankInQuestionSet', () => {
      it('should get user rank in specific question set', async () => {
        mockDb.query.mockResolvedValueOnce({
          rows: [{ rank: '3' }],
          rowCount: 1
        });

        const result = await hallOfFameRepository.getUserRankInQuestionSet('testuser', 1);

        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('ROW_NUMBER() OVER'),
          [1, 'testuser']
        );
        expect(result).toBe(3);
      });

      it('should return null when user not found in question set', async () => {
        mockDb.query.mockResolvedValueOnce({
          rows: [],
          rowCount: 0
        });

        const result = await hallOfFameRepository.getUserRankInQuestionSet('nonexistent', 1);

        expect(result).toBeNull();
      });
    });

    describe('getQuestionSetLeaderboard', () => {
      it('should get leaderboard for specific question set with rankings', async () => {
        const leaderboard = [
          { ...mockHallOfFameEntry, rank: 1 },
          { ...mockHallOfFameEntry, id: 2, score: 1100, rank: 2 }
        ];

        mockDb.query.mockResolvedValueOnce({
          rows: leaderboard,
          rowCount: 2
        });

        const result = await hallOfFameRepository.getQuestionSetLeaderboard(1, 5);

        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('ROW_NUMBER() OVER'),
          [1, 5]
        );
        expect(result).toEqual(leaderboard);
      });
    });

    describe('getTopThreeByQuestionSet', () => {
      it('should get top three scores for question set', async () => {
        const topThree = [
          { ...mockHallOfFameEntry, rank: 1 },
          { ...mockHallOfFameEntry, id: 2, score: 1100, rank: 2 },
          { ...mockHallOfFameEntry, id: 3, score: 1000, rank: 3 }
        ];

        mockDb.query.mockResolvedValueOnce({
          rows: topThree,
          rowCount: 3
        });

        const result = await hallOfFameRepository.getTopThreeByQuestionSet(1);

        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('ROW_NUMBER() OVER'),
          [1, 3]
        );
        expect(result).toEqual(topThree);
      });
    });

    describe('getAllQuestionSetLeaderboards', () => {
      it('should get all question set leaderboards', async () => {
        const allLeaderboards = [
          { ...mockHallOfFameEntry, rank: 1 },
          { ...mockHallOfFameEntry, id: 2, question_set_id: 2, question_set_name: 'Science', rank: 1 }
        ];

        mockDb.query.mockResolvedValueOnce({
          rows: allLeaderboards,
          rowCount: 2
        });

        const result = await hallOfFameRepository.getAllQuestionSetLeaderboards();

        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('WITH ranked_entries AS')
        );
        expect(result).toEqual({
          'General Knowledge': [allLeaderboards[0]],
          'Science': [allLeaderboards[1]]
        });
      });
    });
  });

  describe('Statistics and Analytics', () => {
    describe('getStatistics', () => {
      it('should return comprehensive hall of fame statistics', async () => {
        const mockStats = {
          total_entries: '150',
          unique_players: '45',
          average_score: '850.5',
          highest_score: '1500',
          average_accuracy: '78.3'
        };

        mockDb.query.mockResolvedValueOnce({
          rows: [mockStats],
          rowCount: 1
        });

        const result = await hallOfFameRepository.getStatistics();

        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('COUNT(*) as total_entries')
        );
        expect(result).toEqual({
          totalEntries: 150,
          uniquePlayers: 45,
          averageScore: 850.5,
          highestScore: 1500,
          averageAccuracy: 78.3
        });
      });

      it('should handle empty statistics', async () => {
        mockDb.query.mockResolvedValueOnce({
          rows: [{}],
          rowCount: 1
        });

        const result = await hallOfFameRepository.getStatistics();

        expect(result).toEqual({
          totalEntries: 0,
          uniquePlayers: 0,
          averageScore: 0,
          highestScore: 0,
          averageAccuracy: 0
        });
      });
    });

    describe('isScoreEligibleForHallOfFame', () => {
      it('should return true when less than 10 entries exist', async () => {
        // Mock count query to return less than 10
        mockDb.query
          .mockResolvedValueOnce({
            rows: [{ min_score: '800' }],
            rowCount: 1
          })
          .mockResolvedValueOnce({
            rows: [{ count: '5' }],
            rowCount: 1
          });

        const result = await hallOfFameRepository.isScoreEligibleForHallOfFame(900, 1);

        expect(result).toBe(true);
      });

      it('should return true when score is higher than lowest top 10 score', async () => {
        mockDb.query
          .mockResolvedValueOnce({
            rows: [{ min_score: '800' }],
            rowCount: 1
          })
          .mockResolvedValueOnce({
            rows: [{ count: '15' }],
            rowCount: 1
          });

        const result = await hallOfFameRepository.isScoreEligibleForHallOfFame(900, 1);

        expect(result).toBe(true);
      });

      it('should return false when score is lower than lowest top 10 score', async () => {
        // Mock the MIN score query first
        mockDb.query
          .mockResolvedValueOnce({
            rows: [{ min_score: '800' }],
            rowCount: 1
          });
        
        // Mock the count query for getEntryCountForQuestionSet
        jest.spyOn(BaseRepository.prototype as any, 'count').mockResolvedValueOnce(15);

        const result = await hallOfFameRepository.isScoreEligibleForHallOfFame(700, 1);

        expect(result).toBe(false);
      });

      it('should handle empty top scores', async () => {
        mockDb.query
          .mockResolvedValueOnce({
            rows: [{ min_score: null }],
            rowCount: 1
          })
          .mockResolvedValueOnce({
            rows: [{ count: '0' }],
            rowCount: 1
          });

        const result = await hallOfFameRepository.isScoreEligibleForHallOfFame(900, 1);

        expect(result).toBe(true);
      });
    });

    describe('getEntryCountForQuestionSet', () => {
      it('should return count of entries for question set', async () => {
        const mockBaseRepository = BaseRepository as any;
        mockBaseRepository.prototype.count.mockResolvedValueOnce(25);

        const result = await hallOfFameRepository.getEntryCountForQuestionSet(1);

        expect(mockBaseRepository.prototype.count).toHaveBeenCalledWith('hall_of_fame', 'question_set_id = $1', [1]);
        expect(result).toBe(25);
      });
    });

    describe('getEntryCount', () => {
      it('should return total entry count', async () => {
        const mockBaseRepository = BaseRepository as any;
        mockBaseRepository.prototype.count.mockResolvedValueOnce(150);

        const result = await hallOfFameRepository.getEntryCount();

        expect(mockBaseRepository.prototype.count).toHaveBeenCalledWith('hall_of_fame');
        expect(result).toBe(150);
      });
    });
  });

  describe('Search and Filter Operations', () => {
    describe('searchEntries', () => {
      it('should search entries by username, character name, or question set name', async () => {
        const searchResults = [mockHallOfFameEntry, { ...mockHallOfFameEntry, id: 2, username: 'testuser2' }];

        mockDb.query.mockResolvedValueOnce({
          rows: searchResults,
          rowCount: 2
        });

        const result = await hallOfFameRepository.searchEntries('testuser', 20);

        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringMatching(/WHERE username ILIKE \$1\s+OR character_name ILIKE \$1\s+OR question_set_name ILIKE \$1/),
          ['%testuser%', 20]
        );
        expect(result).toEqual(searchResults);
      });

      it('should use default limit of 50', async () => {
        mockDb.query.mockResolvedValueOnce({
          rows: [mockHallOfFameEntry],
          rowCount: 1
        });

        await hallOfFameRepository.searchEntries('test');

        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining('LIMIT $2'),
          ['%test%', 50]
        );
      });
    });

    describe('getRecentEntries', () => {
      it('should get recent entries ordered by completion date', async () => {
        const recentEntries = [
          { ...mockHallOfFameEntry, completed_at: new Date('2024-01-02T10:00:00Z') },
          { ...mockHallOfFameEntry, id: 2, completed_at: new Date('2024-01-01T10:00:00Z') }
        ];

        mockDb.query.mockResolvedValueOnce({
          rows: recentEntries,
          rowCount: 2
        });

        const result = await hallOfFameRepository.getRecentEntries(15);

        expect(mockDb.query).toHaveBeenCalledWith(
          'SELECT * FROM hall_of_fame ORDER BY completed_at DESC LIMIT $1',
          [15]
        );
        expect(result).toEqual(recentEntries);
      });

      it('should use default limit of 20', async () => {
        mockDb.query.mockResolvedValueOnce({
          rows: [mockHallOfFameEntry],
          rowCount: 1
        });

        await hallOfFameRepository.getRecentEntries();

        expect(mockDb.query).toHaveBeenCalledWith(
          'SELECT * FROM hall_of_fame ORDER BY completed_at DESC LIMIT $1',
          [20]
        );
      });
    });
  });

  describe('Maintenance Operations', () => {
    describe('cleanupOldEntries', () => {
      it('should cleanup entries older than specified days', async () => {
        mockDb.query.mockResolvedValueOnce({
          rows: [],
          rowCount: 25
        });

        const result = await hallOfFameRepository.cleanupOldEntries(180);

        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringMatching(/DELETE FROM hall_of_fame\s+WHERE completed_at < NOW\(\) - INTERVAL '180 days'/)
        );
        expect(result).toBe(25);
      });

      it('should use default cleanup period of 365 days', async () => {
        mockDb.query.mockResolvedValueOnce({
          rows: [],
          rowCount: 10
        });

        const result = await hallOfFameRepository.cleanupOldEntries();

        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringMatching(/DELETE FROM hall_of_fame\s+WHERE completed_at < NOW\(\) - INTERVAL '365 days'/)
        );
        expect(result).toBe(10);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors', async () => {
      const mockBaseRepository = BaseRepository as any;
      mockBaseRepository.prototype.findById.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(hallOfFameRepository.findEntryById(1)).rejects.toThrow('Connection failed');
    });

    it('should handle query execution errors', async () => {
      const mockBaseRepository = BaseRepository as any;
      mockBaseRepository.prototype.create.mockRejectedValueOnce(new Error('Query execution failed'));

      await expect(hallOfFameRepository.createEntry(mockCreateData)).rejects.toThrow('Query execution failed');
    });

    it('should handle invalid data gracefully', async () => {
      const mockBaseRepository = BaseRepository as any;
      mockBaseRepository.prototype.create.mockRejectedValueOnce(new Error('Invalid data'));

      await expect(hallOfFameRepository.createEntry({
        ...mockCreateData,
        score: -1,
        accuracy: 150
      })).rejects.toThrow('Invalid data');
    });
  });

  describe('Data Validation', () => {
    it('should validate hall of fame entry data structure', () => {
      expect(mockHallOfFameEntry).toHaveProperty('id');
      expect(mockHallOfFameEntry).toHaveProperty('username');
      expect(mockHallOfFameEntry).toHaveProperty('score');
      expect(mockHallOfFameEntry).toHaveProperty('accuracy');
      expect(mockHallOfFameEntry).toHaveProperty('question_set_name');
      expect(mockHallOfFameEntry).toHaveProperty('completed_at');
    });

    it('should validate create data structure', () => {
      expect(mockCreateData).toHaveProperty('username');
      expect(mockCreateData).toHaveProperty('score');
      expect(mockCreateData).toHaveProperty('accuracy');
      expect(mockCreateData).toHaveProperty('question_set_name');
      expect(mockCreateData).toHaveProperty('question_set_id');
      expect(mockCreateData).toHaveProperty('session_id');
    });

    it('should handle optional character_name field', () => {
      const entryWithoutCharacter = { ...mockHallOfFameEntry };
      delete entryWithoutCharacter.character_name;

      expect(entryWithoutCharacter).not.toHaveProperty('character_name');
      expect(entryWithoutCharacter).toHaveProperty('username');
      expect(entryWithoutCharacter).toHaveProperty('score');
    });
  });

  describe('Performance Considerations', () => {
    it('should use efficient queries for large datasets', async () => {
      mockDb.query.mockResolvedValueOnce({
        rows: Array(1000).fill(mockHallOfFameEntry),
        rowCount: 1000
      });

      const result = await hallOfFameRepository.getTopScores(1, 1000);

      expect(result).toHaveLength(1000);
      expect(mockDb.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT'),
        [1, 1000]
      );
    });

    it('should handle complex ranking queries efficiently', async () => {
      const rankedEntries = Array(50).fill(null).map((_, i) => ({
        ...mockHallOfFameEntry,
        id: i + 1,
        rank: i + 1
      }));

      mockDb.query.mockResolvedValueOnce({
        rows: rankedEntries,
        rowCount: 50
      });

      const result = await hallOfFameRepository.getTopScoresByQuestionSet(50);

      expect(result).toHaveLength(50);
      expect(result[0]).toHaveProperty('rank');
      expect(result[49]).toHaveProperty('rank', 50);
    });
  });
}); 