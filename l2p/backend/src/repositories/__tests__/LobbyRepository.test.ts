import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { LobbyRepository, Lobby, CreateLobbyData, UpdateLobbyData } from '../LobbyRepository';
import { BaseRepository } from '../BaseRepository';
import { DatabaseService } from '../../services/DatabaseService.js';
import { createMockQueryResult } from '../../__tests__/test-utils/mockData';

// Mock DatabaseService
jest.mock('../../services/DatabaseService.js');
// DatabaseService has a private constructor; only mock the static getInstance safely
const MockedDatabaseService = DatabaseService as unknown as { getInstance: jest.MockedFunction<() => any> };

// Mock the BaseRepository
jest.mock('../BaseRepository');

describe('LobbyRepository', () => {
  let lobbyRepository: LobbyRepository;
  let mockDb: jest.Mocked<DatabaseService>;

  // Test data
  const mockLobby: Lobby = {
    id: 1,
    code: 'ABC123',
    host_id: 1,
    status: 'waiting',
    question_count: 10,
    current_question: 0,
    created_at: new Date('2023-01-01T00:00:00Z'),
    settings: {
      questionSetIds: [1, 2],
      timeLimit: 60,
      allowReplay: true
    },
    players: [
      {
        id: 'user_1',
        username: 'testuser',
        character: 'wizard',
        characterLevel: 5,
        isReady: false,
        isHost: true,
        score: 0,
        multiplier: 1,
        correctAnswers: 0,
        isConnected: true,
        joinedAt: new Date('2023-01-01T00:05:00Z')
      }
    ]
  };

  const mockCreateLobbyData: CreateLobbyData = {
    code: 'DEF456',
    host_id: 2,
    question_count: 15,
    settings: {
      questionSetIds: [3, 4],
      timeLimit: 45,
      allowReplay: false
    }
  };

  const mockUpdateLobbyData: UpdateLobbyData = {
    status: 'playing',
    question_count: 20,
    current_question: 5,
    started_at: new Date('2023-01-01T01:00:00Z'),
    settings: {
      questionSetIds: [1, 3, 5],
      timeLimit: 90,
      allowReplay: true
    }
  };

  const mockPlayer = {
    id: 'user_2',
    username: 'newplayer',
    character: 'student',
    characterLevel: 1,
    isReady: false,
    isHost: false,
    score: 0,
    multiplier: 1,
    correctAnswers: 0,
    isConnected: true,
    joinedAt: new Date('2023-01-01T00:10:00Z')
  };

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock database instance
    mockDb = {
      query: jest.fn(),
      close: jest.fn(),
      testConnection: jest.fn(),
      isHealthy: jest.fn(),
      getConnection: jest.fn(),
      getPool: jest.fn(),
      getDb: jest.fn(),
    } as any;

    // Mock the getInstance method to return our mock
    MockedDatabaseService.getInstance.mockReturnValue(mockDb);

    lobbyRepository = new LobbyRepository();

    // Ensure the repository's db property is set to our mock
    (lobbyRepository as any).db = mockDb;
    
    // Also mock the getDb method to return our mock
    jest.spyOn(lobbyRepository as any, 'getDb').mockReturnValue(mockDb);

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
    jest.restoreAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize LobbyRepository correctly', () => {
      expect(lobbyRepository).toBeInstanceOf(LobbyRepository);
      expect(lobbyRepository).toBeInstanceOf(BaseRepository);
    });

    it('should have correct table name', () => {
      expect((lobbyRepository as any).tableName).toBe('lobbies');
    });
  });

  describe('Basic CRUD Operations', () => {
    describe('findLobbyById', () => {
      it('should find lobby by ID successfully', async () => {
        const mockFindById = ((BaseRepository.prototype as any).findById as jest.Mock);
        (mockFindById as any).mockResolvedValue(mockLobby);

        const result = await lobbyRepository.findLobbyById(1);

        expect(mockFindById).toHaveBeenCalledWith('lobbies', 1);
        expect(result).toEqual(mockLobby);
      });

      it('should return null when lobby not found', async () => {
        const mockFindById = ((BaseRepository.prototype as any).findById as jest.Mock);
        (mockFindById as any).mockResolvedValue(null);

        const result = await lobbyRepository.findLobbyById(999);

        expect(mockFindById).toHaveBeenCalledWith('lobbies', 999);
        expect(result).toBeNull();
      });

      it('should handle database errors', async () => {
        const mockFindById = ((BaseRepository.prototype as any).findById as jest.Mock);
        (mockFindById as any).mockRejectedValue(new Error('Database connection failed'));

        await expect(lobbyRepository.findLobbyById(1)).rejects.toThrow('Database connection failed');
      });
    });

    describe('createLobby', () => {
      it('should create lobby with provided data', async () => {
        const mockCreate = jest.spyOn(BaseRepository.prototype as any, 'create');
        mockCreate.mockResolvedValue(mockLobby);

        const result = await lobbyRepository.createLobby(mockCreateLobbyData);

        const expectedData = {
          ...mockCreateLobbyData,
          players: []
        };

        expect(mockCreate).toHaveBeenCalledWith('lobbies', expectedData);
        expect(result).toEqual(mockLobby);
      });

      it('should create lobby with default values when optional fields missing', async () => {
        const mockCreate = jest.spyOn(BaseRepository.prototype as any, 'create');
        mockCreate.mockResolvedValue(mockLobby);

        const minimalLobbyData: CreateLobbyData = {
          code: 'MIN123',
          host_id: 1
        };

        const expectedData = {
          ...minimalLobbyData,
          question_count: 10,
          settings: {},
          players: []
        };

        await lobbyRepository.createLobby(minimalLobbyData);

        expect(mockCreate).toHaveBeenCalledWith('lobbies', expectedData);
      });

      it('should handle duplicate lobby code error', async () => {
        const mockCreate = jest.spyOn(BaseRepository.prototype as any, 'create');
        mockCreate.mockRejectedValue(new Error('duplicate key value violates unique constraint "lobbies_code_key"'));

        await expect(lobbyRepository.createLobby(mockCreateLobbyData)).rejects.toThrow('duplicate key');
      });

      it('should handle foreign key constraint errors', async () => {
        const mockCreate = jest.spyOn(BaseRepository.prototype as any, 'create');
        mockCreate.mockRejectedValue(new Error('violates foreign key constraint "lobbies_host_id_fkey"'));

        await expect(lobbyRepository.createLobby(mockCreateLobbyData)).rejects.toThrow('foreign key constraint');
      });
    });

    describe('updateLobby', () => {
      it('should update lobby successfully', async () => {
        const mockUpdate = ((BaseRepository.prototype as any).update as jest.Mock);
        const updatedLobby = { ...mockLobby, ...mockUpdateLobbyData };
        (mockUpdate as any).mockResolvedValue(updatedLobby);

        const result = await lobbyRepository.updateLobby(1, mockUpdateLobbyData);

        expect(mockUpdate).toHaveBeenCalledWith('lobbies', 1, mockUpdateLobbyData);
        expect(result).toEqual(updatedLobby);
      });

      it('should return null when lobby not found for update', async () => {
        const mockUpdate = ((BaseRepository.prototype as any).update as jest.Mock);
        (mockUpdate as any).mockResolvedValue(null);

        const result = await lobbyRepository.updateLobby(999, mockUpdateLobbyData);

        expect(mockUpdate).toHaveBeenCalledWith('lobbies', 999, mockUpdateLobbyData);
        expect(result).toBeNull();
      });

      it('should handle partial updates', async () => {
        const mockUpdate = ((BaseRepository.prototype as any).update as jest.Mock);
        const partialUpdate = { status: 'playing' as const };
        const updatedLobby = { ...mockLobby, status: 'playing' as const };
        (mockUpdate as any).mockResolvedValue(updatedLobby);

        const result = await lobbyRepository.updateLobby(1, partialUpdate);

        expect(mockUpdate).toHaveBeenCalledWith('lobbies', 1, partialUpdate);
        expect(result).toEqual(updatedLobby);
      });
    });

    describe('deleteLobby', () => {
      it('should delete lobby successfully', async () => {
        const mockDelete = ((BaseRepository.prototype as any).delete as jest.Mock);
        (mockDelete as any).mockResolvedValue(true);

        const result = await lobbyRepository.deleteLobby(1);

        expect(mockDelete).toHaveBeenCalledWith('lobbies', 1);
        expect(result).toBe(true);
      });

      it('should return false when lobby not found for deletion', async () => {
        const mockDelete = ((BaseRepository.prototype as any).delete as jest.Mock);
        (mockDelete as any).mockResolvedValue(false);

        const result = await lobbyRepository.deleteLobby(999);

        expect(mockDelete).toHaveBeenCalledWith('lobbies', 999);
        expect(result).toBe(false);
      });

      it('should handle deletion errors', async () => {
        const mockDelete = ((BaseRepository.prototype as any).delete as jest.Mock);
        (mockDelete as any).mockRejectedValue(new Error('Foreign key constraint violation'));

        await expect(lobbyRepository.deleteLobby(1)).rejects.toThrow('Foreign key constraint violation');
      });
    });
  });

  describe('Lobby Finding and Search Operations', () => {
    describe('findByCode', () => {
      it('should find lobby by code successfully', async () => {
        mockDb.query.mockResolvedValue(createMockQueryResult([mockLobby]));

        const result = await lobbyRepository.findByCode('ABC123');

        expect(mockDb.query).toHaveBeenCalledWith(
          'SELECT * FROM lobbies WHERE code = $1',
          ['ABC123']
        );
        expect(result).toEqual(mockLobby);
      });

      it('should return null when lobby code not found', async () => {
        mockDb.query.mockResolvedValue(createMockQueryResult([]));

        const result = await lobbyRepository.findByCode('NONEXISTENT');

        expect(mockDb.query).toHaveBeenCalledWith(
          'SELECT * FROM lobbies WHERE code = $1',
          ['NONEXISTENT']
        );
        expect(result).toBeNull();
      });

      it('should handle case-sensitive code search', async () => {
        mockDb.query.mockResolvedValue(createMockQueryResult([]));

        await lobbyRepository.findByCode('abc123');

        expect(mockDb.query).toHaveBeenCalledWith(
          'SELECT * FROM lobbies WHERE code = $1',
          ['abc123']
        );
      });
    });

    describe('findActiveLobbies', () => {
      it('should find active lobbies without limit', async () => {
        const activeLobbies = [mockLobby];
        mockDb.query.mockResolvedValue(createMockQueryResult(activeLobbies));

        const result = await lobbyRepository.findActiveLobbies();

        expect(mockDb.query).toHaveBeenCalledWith(
          'SELECT * FROM lobbies WHERE status IN ($1, $2) ORDER BY created_at DESC',
          ['waiting', 'starting']
        );
        expect(result).toEqual(activeLobbies);
      });

      it('should find active lobbies with limit', async () => {
        const activeLobbies = [mockLobby];
        mockDb.query.mockResolvedValue(createMockQueryResult(activeLobbies));

        const result = await lobbyRepository.findActiveLobbies(5);

        expect(mockDb.query).toHaveBeenCalledWith(
          'SELECT * FROM lobbies WHERE status IN ($1, $2) ORDER BY created_at DESC LIMIT $3',
          ['waiting', 'starting', 5]
        );
        expect(result).toEqual(activeLobbies);
      });

      it('should return empty array when no active lobbies', async () => {
        mockDb.query.mockResolvedValue(createMockQueryResult([]));

        const result = await lobbyRepository.findActiveLobbies();

        expect(result).toEqual([]);
      });
    });

    describe('findLobbiesByHost', () => {
      it('should find lobbies by host ID', async () => {
        const hostLobbies = [mockLobby];
        mockDb.query.mockResolvedValue(createMockQueryResult(hostLobbies));

        const result = await lobbyRepository.findLobbiesByHost(1);

        expect(mockDb.query).toHaveBeenCalledWith(
          'SELECT * FROM lobbies WHERE host_id = $1 OR auth_user_id = $1 ORDER BY created_at DESC',
          [1]
        );
        expect(result).toEqual(hostLobbies);
      });

      it('should return empty array when host has no lobbies', async () => {
        mockDb.query.mockResolvedValue(createMockQueryResult([]));

        const result = await lobbyRepository.findLobbiesByHost(999);

        expect(result).toEqual([]);
      });
    });
  });

  describe('Lobby Status Management', () => {
    describe('updateLobbyStatus', () => {
      it('should update lobby status to playing and set started_at', async () => {
        const mockUpdate = jest.spyOn(lobbyRepository, 'updateLobby');
        const playingLobby = { ...mockLobby, status: 'playing' as const, started_at: expect.any(Date) };
        mockUpdate.mockResolvedValue(playingLobby);

        const result = await lobbyRepository.updateLobbyStatus(1, 'playing');

        expect(mockUpdate).toHaveBeenCalledWith(1, {
          status: 'playing',
          started_at: expect.any(Date)
        });
        expect(result).toEqual(playingLobby);
      });

      it('should update lobby status to ended and set ended_at', async () => {
        const mockUpdate = jest.spyOn(lobbyRepository, 'updateLobby');
        const endedLobby = { ...mockLobby, status: 'ended' as const, ended_at: expect.any(Date) };
        mockUpdate.mockResolvedValue(endedLobby);

        const result = await lobbyRepository.updateLobbyStatus(1, 'ended');

        expect(mockUpdate).toHaveBeenCalledWith(1, {
          status: 'ended',
          ended_at: expect.any(Date)
        });
        expect(result).toEqual(endedLobby);
      });

      it('should update lobby status to waiting without timestamp', async () => {
        const mockUpdate = jest.spyOn(lobbyRepository, 'updateLobby');
        const waitingLobby = { ...mockLobby, status: 'waiting' as const };
        mockUpdate.mockResolvedValue(waitingLobby);

        const result = await lobbyRepository.updateLobbyStatus(1, 'waiting');

        expect(mockUpdate).toHaveBeenCalledWith(1, {
          status: 'waiting'
        });
        expect(result).toEqual(waitingLobby);
      });

      it('should update lobby status to starting without timestamp', async () => {
        const mockUpdate = jest.spyOn(lobbyRepository, 'updateLobby');
        const startingLobby = { ...mockLobby, status: 'starting' as const };
        mockUpdate.mockResolvedValue(startingLobby);

        const result = await lobbyRepository.updateLobbyStatus(1, 'starting');

        expect(mockUpdate).toHaveBeenCalledWith(1, {
          status: 'starting'
        });
        expect(result).toEqual(startingLobby);
      });

      it('should return null when lobby not found for status update', async () => {
        const mockUpdate = jest.spyOn(lobbyRepository, 'updateLobby');
        (mockUpdate as any).mockResolvedValue(null);

        const result = await lobbyRepository.updateLobbyStatus(999, 'playing');

        expect(result).toBeNull();
      });
    });
  });

  describe('Player Management Operations', () => {
    describe('addPlayerToLobby', () => {
      it('should add player to lobby successfully', async () => {
        const mockFindById = jest.spyOn(lobbyRepository, 'findLobbyById');
        const mockUpdate = jest.spyOn(lobbyRepository, 'updateLobby');

        mockFindById.mockResolvedValue(mockLobby);
        const updatedLobby = {
          ...mockLobby,
          players: [...mockLobby.players, mockPlayer]
        };
        (mockUpdate as any).mockResolvedValue(updatedLobby);

        const result = await lobbyRepository.addPlayerToLobby(1, mockPlayer);

        expect(mockFindById).toHaveBeenCalledWith(1);
        expect(mockUpdate).toHaveBeenCalledWith(1, {
          players: [...mockLobby.players, mockPlayer]
        });
        expect(result).toEqual(updatedLobby);
      });

      it('should handle lobby with no existing players', async () => {
        const mockFindById = jest.spyOn(lobbyRepository, 'findLobbyById');
        const mockUpdate = jest.spyOn(lobbyRepository, 'updateLobby');

        const emptyLobby = { ...mockLobby, players: [] };
        mockFindById.mockResolvedValue(emptyLobby);
        const updatedLobby = { ...emptyLobby, players: [mockPlayer] };
        (mockUpdate as any).mockResolvedValue(updatedLobby);

        const result = await lobbyRepository.addPlayerToLobby(1, mockPlayer);

        expect(mockUpdate).toHaveBeenCalledWith(1, {
          players: [mockPlayer]
        });
        expect(result).toEqual(updatedLobby);
      });

      it('should handle lobby with null players array', async () => {
        const mockFindById = jest.spyOn(lobbyRepository, 'findLobbyById');
        const mockUpdate = jest.spyOn(lobbyRepository, 'updateLobby');

        const lobbyWithNullPlayers = { ...mockLobby, players: null as any };
        mockFindById.mockResolvedValue(lobbyWithNullPlayers);
        const updatedLobby = { ...lobbyWithNullPlayers, players: [mockPlayer] };
        (mockUpdate as any).mockResolvedValue(updatedLobby);

        const result = await lobbyRepository.addPlayerToLobby(1, mockPlayer);

        expect(mockUpdate).toHaveBeenCalledWith(1, {
          players: [mockPlayer]
        });
        expect(result).toEqual(updatedLobby);
      });

      it('should return null when lobby not found', async () => {
        const mockFindById = jest.spyOn(lobbyRepository, 'findLobbyById');
        (mockFindById as any).mockResolvedValue(null);

        const result = await lobbyRepository.addPlayerToLobby(999, mockPlayer);

        expect(mockFindById).toHaveBeenCalledWith(999);
        expect(result).toBeNull();
      });
    });

    describe('removePlayerFromLobby', () => {
      it('should remove player from lobby successfully', async () => {
        const mockFindById = jest.spyOn(lobbyRepository, 'findLobbyById');
        const mockUpdate = jest.spyOn(lobbyRepository, 'updateLobby');

        const lobbyWithMultiplePlayers = {
          ...mockLobby,
          players: [mockLobby.players[0], mockPlayer]
        };

        mockFindById.mockResolvedValue(lobbyWithMultiplePlayers);
        const updatedLobby = {
          ...lobbyWithMultiplePlayers,
          players: [mockLobby.players[0]] // Remove mockPlayer (user_2)
        };
        (mockUpdate as any).mockResolvedValue(updatedLobby);

        const result = await lobbyRepository.removePlayerFromLobby(1, 'user_2');

        expect(mockFindById).toHaveBeenCalledWith(1);
        expect(mockUpdate).toHaveBeenCalledWith(1, {
          players: [mockLobby.players[0]]
        });
        expect(result).toEqual(updatedLobby);
      });

      it('should handle removing non-existent player', async () => {
        const mockFindById = jest.spyOn(lobbyRepository, 'findLobbyById');
        const mockUpdate = jest.spyOn(lobbyRepository, 'updateLobby');

        mockFindById.mockResolvedValue(mockLobby);
        (mockUpdate as any).mockResolvedValue(mockLobby); // No change since player doesn't exist

        const result = await lobbyRepository.removePlayerFromLobby(1, 'non_existent');

        expect(mockUpdate).toHaveBeenCalledWith(1, {
          players: mockLobby.players // No change
        });
        expect(result).toEqual(mockLobby);
      });

      it('should handle lobby with null players array', async () => {
        const mockFindById = jest.spyOn(lobbyRepository, 'findLobbyById');
        const mockUpdate = jest.spyOn(lobbyRepository, 'updateLobby');

        const lobbyWithNullPlayers = { ...mockLobby, players: null as any };
        mockFindById.mockResolvedValue(lobbyWithNullPlayers);
        const updatedLobby = { ...lobbyWithNullPlayers, players: [] };
        (mockUpdate as any).mockResolvedValue(updatedLobby);

        const result = await lobbyRepository.removePlayerFromLobby(1, 'user_1');

        expect(mockUpdate).toHaveBeenCalledWith(1, {
          players: []
        });
        expect(result).toEqual(updatedLobby);
      });

      it('should return null when lobby not found', async () => {
        const mockFindById = jest.spyOn(lobbyRepository, 'findLobbyById');
        (mockFindById as any).mockResolvedValue(null);

        const result = await lobbyRepository.removePlayerFromLobby(999, 'user_1');

        expect(mockFindById).toHaveBeenCalledWith(999);
        expect(result).toBeNull();
      });
    });

    describe('updatePlayerInLobby', () => {
      it('should update player in lobby successfully', async () => {
        const mockFindById = jest.spyOn(lobbyRepository, 'findLobbyById');
        const mockUpdate = jest.spyOn(lobbyRepository, 'updateLobby');

        mockFindById.mockResolvedValue(mockLobby);
        const playerUpdate = { isReady: true, score: 100 };
        const updatedPlayer = { ...mockLobby.players[0], ...playerUpdate };
        const updatedLobby = {
          ...mockLobby,
          players: [updatedPlayer]
        };
        (mockUpdate as any).mockResolvedValue(updatedLobby);

        const result = await lobbyRepository.updatePlayerInLobby(1, 'user_1', playerUpdate);

        expect(mockFindById).toHaveBeenCalledWith(1);
        expect(mockUpdate).toHaveBeenCalledWith(1, {
          players: [updatedPlayer]
        });
        expect(result).toEqual(updatedLobby);
      });

      it('should handle updating non-existent player', async () => {
        const mockFindById = jest.spyOn(lobbyRepository, 'findLobbyById');
        const mockUpdate = jest.spyOn(lobbyRepository, 'updateLobby');

        mockFindById.mockResolvedValue(mockLobby);
        (mockUpdate as any).mockResolvedValue(mockLobby); // No change since player doesn't exist

        const result = await lobbyRepository.updatePlayerInLobby(1, 'non_existent', { score: 100 });

        expect(mockUpdate).toHaveBeenCalledWith(1, {
          players: mockLobby.players // No change
        });
        expect(result).toEqual(mockLobby);
      });

      it('should handle lobby with null players array', async () => {
        const mockFindById = jest.spyOn(lobbyRepository, 'findLobbyById');
        const mockUpdate = jest.spyOn(lobbyRepository, 'updateLobby');

        const lobbyWithNullPlayers = { ...mockLobby, players: null as any };
        mockFindById.mockResolvedValue(lobbyWithNullPlayers);
        const updatedLobby = { ...lobbyWithNullPlayers, players: [] };
        (mockUpdate as any).mockResolvedValue(updatedLobby);

        const result = await lobbyRepository.updatePlayerInLobby(1, 'user_1', { score: 100 });

        expect(mockUpdate).toHaveBeenCalledWith(1, {
          players: []
        });
        expect(result).toEqual(updatedLobby);
      });

      it('should return null when lobby not found', async () => {
        const mockFindById = jest.spyOn(lobbyRepository, 'findLobbyById');
        (mockFindById as any).mockResolvedValue(null);

        const result = await lobbyRepository.updatePlayerInLobby(999, 'user_1', { score: 100 });

        expect(mockFindById).toHaveBeenCalledWith(999);
        expect(result).toBeNull();
      });

      it('should handle partial player updates', async () => {
        const mockFindById = jest.spyOn(lobbyRepository, 'findLobbyById');
        const mockUpdate = jest.spyOn(lobbyRepository, 'updateLobby');

        mockFindById.mockResolvedValue(mockLobby);
        const partialUpdate = { isReady: true };
        const updatedPlayer = { ...mockLobby.players[0], isReady: true };
        const updatedLobby = {
          ...mockLobby,
          players: [updatedPlayer]
        };
        (mockUpdate as any).mockResolvedValue(updatedLobby);

        const result = await lobbyRepository.updatePlayerInLobby(1, 'user_1', partialUpdate);

        expect(result?.players[0]).toEqual(expect.objectContaining({
          ...mockLobby.players[0],
          isReady: true
        }));
      });
    });
  });

  describe('Utility and Statistical Operations', () => {
    describe('codeExists', () => {
      it('should return true when lobby code exists', async () => {
        const mockExists = jest.spyOn(BaseRepository.prototype as any, 'exists');
        mockExists.mockResolvedValue(true);

        const result = await lobbyRepository.codeExists('ABC123');

        expect(mockExists).toHaveBeenCalledWith('lobbies', 'code', 'ABC123');
        expect(result).toBe(true);
      });

      it('should return false when lobby code does not exist', async () => {
        const mockExists = jest.spyOn(BaseRepository.prototype as any, 'exists');
        mockExists.mockResolvedValue(false);

        const result = await lobbyRepository.codeExists('NONEXISTENT');

        expect(mockExists).toHaveBeenCalledWith('lobbies', 'code', 'NONEXISTENT');
        expect(result).toBe(false);
      });
    });

    describe('getLobbyCount', () => {
      it('should return total lobby count', async () => {
        (((BaseRepository.prototype as any).count as jest.Mock) as any).mockResolvedValue(25);

        const result = await lobbyRepository.getLobbyCount();

        expect((BaseRepository.prototype as any).count).toHaveBeenCalledWith('lobbies');
        expect(result).toBe(25);
      });

      it('should return zero when no lobbies', async () => {
        (((BaseRepository.prototype as any).count as jest.Mock) as any).mockResolvedValue(0);

        const result = await lobbyRepository.getLobbyCount();

        expect(result).toBe(0);
      });
    });

    describe('getActiveLobbyCount', () => {
      it('should return active lobby count', async () => {
        (((BaseRepository.prototype as any).count as jest.Mock) as any).mockResolvedValue(15);

        const result = await lobbyRepository.getActiveLobbyCount();

        expect((BaseRepository.prototype as any).count).toHaveBeenCalledWith('lobbies', 'status IN ($1, $2)', ['waiting', 'starting']);
        expect(result).toBe(15);
      });
    });

    describe('cleanupOldLobbies', () => {
      it('should cleanup old lobbies with default hours', async () => {
        mockDb.query.mockResolvedValue(createMockQueryResult(Array(5).fill({})));

        const result = await lobbyRepository.cleanupOldLobbies();

        expect(mockDb.query).toHaveBeenCalledWith(
          `DELETE FROM lobbies 
       WHERE created_at < NOW() - INTERVAL '24 hours' 
       AND status = 'ended'`
        );
        expect(result).toBe(5);
      });

      it('should cleanup old lobbies with custom hours', async () => {
        mockDb.query.mockResolvedValue(createMockQueryResult(Array(3).fill({})));

        const result = await lobbyRepository.cleanupOldLobbies(48);

        expect(mockDb.query).toHaveBeenCalledWith(
          `DELETE FROM lobbies 
       WHERE created_at < NOW() - INTERVAL '48 hours' 
       AND status = 'ended'`
        );
        expect(result).toBe(3);
      });

      it('should return 0 when no old lobbies to cleanup', async () => {
        mockDb.query.mockResolvedValue(createMockQueryResult([]));

        const result = await lobbyRepository.cleanupOldLobbies();

        expect(result).toBe(0);
      });

      it('should handle null rowCount', async () => {
        mockDb.query.mockResolvedValue(createMockQueryResult([]));

        const result = await lobbyRepository.cleanupOldLobbies();

        expect(result).toBe(0);
      });
    });

    describe('cleanupInactiveLobbies', () => {
      it('should delete inactive lobbies older than specified minutes', async () => {
        mockDb.query.mockResolvedValue(createMockQueryResult(Array(3).fill({})));

        const result = await lobbyRepository.cleanupInactiveLobbies(10);

        expect(result).toBe(3);
        expect(mockDb.query).toHaveBeenCalledWith(
          `DELETE FROM lobbies 
       WHERE created_at < NOW() - INTERVAL '10 minutes' 
       AND status IN ('waiting', 'starting')`
        );
      });

      it('should use default 10 minutes when no parameter provided', async () => {
        mockDb.query.mockResolvedValue(createMockQueryResult(Array(2).fill({})));

        const result = await lobbyRepository.cleanupInactiveLobbies();

        expect(result).toBe(2);
        expect(mockDb.query).toHaveBeenCalledWith(
          `DELETE FROM lobbies 
       WHERE created_at < NOW() - INTERVAL '10 minutes' 
       AND status IN ('waiting', 'starting')`
        );
      });

      it('should return 0 when no lobbies are deleted', async () => {
        mockDb.query.mockResolvedValue(createMockQueryResult([]));

        const result = await lobbyRepository.cleanupInactiveLobbies(15);

        expect(result).toBe(0);
        expect(mockDb.query).toHaveBeenCalledWith(
          `DELETE FROM lobbies 
       WHERE created_at < NOW() - INTERVAL '15 minutes' 
       AND status IN ('waiting', 'starting')`
        );
      });

      it('should handle database errors gracefully', async () => {
        const dbError = new Error('Database connection failed');
        mockDb.query.mockRejectedValue(dbError);

        await expect(lobbyRepository.cleanupInactiveLobbies(10)).rejects.toThrow('Database connection failed');
      });

      it('should only delete lobbies in waiting or starting status', async () => {
        mockDb.query.mockResolvedValue(createMockQueryResult(Array(1).fill({})));

        await lobbyRepository.cleanupInactiveLobbies(20);

        // Verify the query only targets inactive statuses
        expect(mockDb.query).toHaveBeenCalledWith(
          expect.stringContaining("status IN ('waiting', 'starting')")
        );
      });

      it('should not delete lobbies that are currently playing or ended', async () => {
        mockDb.query.mockResolvedValue({ rowCount: 0 });

        await lobbyRepository.cleanupInactiveLobbies(10);

        // The query should exclude 'playing' and 'ended' statuses
        const queryCall = mockDb.query.mock.calls[0][0];
        expect(queryCall).not.toContain("'playing'");
        expect(queryCall).not.toContain("'ended'");
      });
    });
  });

  describe('integration between cleanup methods', () => {
    it('should handle both cleanup methods independently', async () => {
      // Mock results for both cleanup methods
      mockDb.query
        .mockResolvedValueOnce(createMockQueryResult(Array(2).fill({}))) // cleanupInactiveLobbies
        .mockResolvedValueOnce(createMockQueryResult(Array(3).fill({}))); // cleanupOldLobbies

      const inactiveResult = await lobbyRepository.cleanupInactiveLobbies(10);
      const oldResult = await lobbyRepository.cleanupOldLobbies(24);

      expect(inactiveResult).toBe(2);
      expect(oldResult).toBe(3);
      expect(mockDb.query).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database connection errors gracefully', async () => {
      mockDb.query.mockRejectedValue(new Error('Connection timeout'));

      await expect(lobbyRepository.findByCode('ABC123')).rejects.toThrow('Connection timeout');
      await expect(lobbyRepository.findActiveLobbies()).rejects.toThrow('Connection timeout');
    });

    it('should handle malformed JSON in settings', async () => {
      const mockUpdate = ((BaseRepository.prototype as any).update as jest.Mock);
      const malformedSettings = { invalidJson: 'test' };
      (mockUpdate as any).mockResolvedValue(mockLobby);

      await lobbyRepository.updateLobby(1, { settings: malformedSettings });

      expect(mockUpdate).toHaveBeenCalledWith('lobbies', 1, { settings: malformedSettings });
    });

    it('should handle empty lobby code', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await lobbyRepository.findByCode('');

      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM lobbies WHERE code = $1',
        ['']
      );
      expect(result).toBeNull();
    });

    it('should handle very long lobby codes', async () => {
      const longCode = 'A'.repeat(1000);
      mockDb.query.mockResolvedValue({ rows: [] });

      await lobbyRepository.findByCode(longCode);

      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM lobbies WHERE code = $1',
        [longCode]
      );
    });

    it('should handle negative lobby IDs', async () => {
      const mockFindById = ((BaseRepository.prototype as any).findById as jest.Mock);
      (mockFindById as any).mockResolvedValue(null);

      const result = await lobbyRepository.findLobbyById(-1);

      expect(mockFindById).toHaveBeenCalledWith('lobbies', -1);
      expect(result).toBeNull();
    });

    it('should handle zero limit in findActiveLobbies', async () => {
      mockDb.query.mockResolvedValue({ rows: [] });

      const result = await lobbyRepository.findActiveLobbies(0);

      // Zero is treated as falsy, so no LIMIT clause is added
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM lobbies WHERE status IN ($1, $2) ORDER BY created_at DESC',
        ['waiting', 'starting']
      );
      expect(result).toEqual([]);
    });

    it('should handle null settings gracefully', async () => {
      const mockUpdate = ((BaseRepository.prototype as any).update as jest.Mock);
      (mockUpdate as any).mockResolvedValue(mockLobby);

      await lobbyRepository.updateLobby(1, { settings: null as any });

      expect(mockUpdate).toHaveBeenCalledWith('lobbies', 1, { settings: null });
    });

    it('should handle negative cleanup hours', async () => {
      mockDb.query.mockResolvedValue({ rowCount: 0 });

      const result = await lobbyRepository.cleanupOldLobbies(-5);

      expect(mockDb.query).toHaveBeenCalledWith(
        `DELETE FROM lobbies 
       WHERE created_at < NOW() - INTERVAL '-5 hours' 
       AND status = 'ended'`
      );
      expect(result).toBe(0);
    });
  });

  describe('Performance and Optimization', () => {
    it('should handle large result sets efficiently', async () => {
      const largeLobbyArray = Array(1000).fill(mockLobby);
      mockDb.query.mockResolvedValue(createMockQueryResult(largeLobbyArray));

      const result = await lobbyRepository.findActiveLobbies(1000);

      expect(result).toHaveLength(1000);
      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM lobbies WHERE status IN ($1, $2) ORDER BY created_at DESC LIMIT $3',
        ['waiting', 'starting', 1000]
      );
    });

    it('should handle concurrent database operations', async () => {
      mockDb.query.mockResolvedValue({ rows: [mockLobby] });

      const promises = [
        lobbyRepository.findByCode('ABC123'),
        lobbyRepository.findByCode('DEF456'),
        lobbyRepository.findByCode('GHI789')
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(3);
      expect(mockDb.query).toHaveBeenCalledTimes(3);
    });

    it('should handle large player arrays efficiently', async () => {
      const largePlayers = Array(100).fill(mockPlayer);
      const mockFindById = jest.spyOn(lobbyRepository, 'findLobbyById');
      const mockUpdate = jest.spyOn(lobbyRepository, 'updateLobby');

      const lobbyWithManyPlayers = { ...mockLobby, players: largePlayers };
      mockFindById.mockResolvedValue(lobbyWithManyPlayers);

      // Mock the result to have the new player added
      const updatedLobby = { ...lobbyWithManyPlayers, players: [...largePlayers, mockPlayer] };
      mockUpdate.mockResolvedValue(updatedLobby);

      const result = await lobbyRepository.addPlayerToLobby(1, mockPlayer);

      expect(result?.players).toHaveLength(101);
    });
  });

  describe('Data Validation and Constraints', () => {
    it('should handle special characters in lobby codes', async () => {
      const specialCode = 'AB@#$%';
      mockDb.query.mockResolvedValue({ rows: [] });

      await lobbyRepository.findByCode(specialCode);

      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM lobbies WHERE code = $1',
        [specialCode]
      );
    });

    it('should handle unicode characters in lobby codes', async () => {
      const unicodeCode = 'ロビー123';
      mockDb.query.mockResolvedValue({ rows: [] });

      await lobbyRepository.findByCode(unicodeCode);

      expect(mockDb.query).toHaveBeenCalledWith(
        'SELECT * FROM lobbies WHERE code = $1',
        [unicodeCode]
      );
    });

    it('should handle all lobby statuses', async () => {
      const statuses: Array<Lobby['status']> = ['waiting', 'starting', 'playing', 'ended'];
      const mockUpdate = jest.spyOn(lobbyRepository, 'updateLobby');

      for (const status of statuses) {
        mockUpdate.mockResolvedValue({ ...mockLobby, status });
        await lobbyRepository.updateLobbyStatus(1, status);
      }

      expect(mockUpdate).toHaveBeenCalledTimes(4);
    });

    it('should handle complex settings objects', async () => {
      const complexSettings = {
        questionSetIds: [1, 2, 3, 4, 5],
        timeLimit: 120,
        allowReplay: false,
        customRules: {
          bonusPoints: true,
          penaltyPoints: false,
          streakMultiplier: 2.5
        },
        metadata: {
          createdBy: 'admin',
          version: '1.0',
          tags: ['quiz', 'multiplayer', 'education']
        }
      };

      const mockUpdate = ((BaseRepository.prototype as any).update as jest.Mock);
      (mockUpdate as any).mockResolvedValue({ ...mockLobby, settings: complexSettings });

      const result = await lobbyRepository.updateLobby(1, { settings: complexSettings });

      expect(mockUpdate).toHaveBeenCalledWith('lobbies', 1, { settings: complexSettings });
      expect(result?.settings).toEqual(complexSettings);
    });

    it('should handle edge case player counts', async () => {
      const mockFindById = jest.spyOn(lobbyRepository, 'findLobbyById');
      const mockUpdate = jest.spyOn(lobbyRepository, 'updateLobby');

      // Test with maximum players (8)
      const maxPlayers = Array(8).fill(null).map((_, i) => ({
        ...mockPlayer,
        id: `user_${i}`,
        username: `player${i}`
      }));

      const fullLobby = { ...mockLobby, players: maxPlayers };
      mockFindById.mockResolvedValue(fullLobby);

      // Mock the result with updated player score
      const updatedPlayers = maxPlayers.map((player, index) =>
        index === 0 ? { ...player, score: 500 } : player
      );
      const updatedLobby = { ...fullLobby, players: updatedPlayers };
      mockUpdate.mockResolvedValue(updatedLobby);

      const result = await lobbyRepository.updatePlayerInLobby(1, 'user_0', { score: 500 });

      expect(result?.players).toHaveLength(8);
      expect(result?.players[0].score).toBe(500);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle lobby lifecycle transitions', async () => {
      const mockUpdate = jest.spyOn(lobbyRepository, 'updateLobby');

      // Simulate complete lobby lifecycle
      const transitions = [
        { status: 'waiting' as const, expectedFields: ['status'] },
        { status: 'starting' as const, expectedFields: ['status'] },
        { status: 'playing' as const, expectedFields: ['status', 'started_at'] },
        { status: 'ended' as const, expectedFields: ['status', 'ended_at'] }
      ];

      for (const transition of transitions) {
        const updatedLobby = { ...mockLobby, status: transition.status };
        (mockUpdate as any).mockResolvedValue(updatedLobby);

        await lobbyRepository.updateLobbyStatus(1, transition.status);

        const lastCall = mockUpdate.mock.calls[mockUpdate.mock.calls.length - 1];
        const updateData = lastCall[1];

        transition.expectedFields.forEach(field => {
          expect(updateData).toHaveProperty(field);
        });
      }
    });

    it('should handle multiple player operations in sequence', async () => {
      const mockFindById = jest.spyOn(lobbyRepository, 'findLobbyById');
      const mockUpdate = jest.spyOn(lobbyRepository, 'updateLobby');

      // Start with empty lobby
      let currentLobby = { ...mockLobby, players: [] };

      // Add multiple players
      const playersToAdd = [
        { id: 'p1', username: 'player1' } as any,
        { id: 'p2', username: 'player2' } as any,
        { id: 'p3', username: 'player3' } as any
      ];

      for (const player of playersToAdd) {
        (mockFindById as any).mockResolvedValue(currentLobby);
        currentLobby = { ...currentLobby, players: [...currentLobby.players, player] };
        (mockUpdate as any).mockResolvedValue(currentLobby);

        await lobbyRepository.addPlayerToLobby(1, player);
      }

      expect(mockFindById).toHaveBeenCalledTimes(3);
      expect(mockUpdate).toHaveBeenCalledTimes(3);
      expect(currentLobby.players).toHaveLength(3);
    });
  });
}); 
