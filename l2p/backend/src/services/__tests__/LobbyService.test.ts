import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { LobbyService, CreateLobbyRequest, JoinLobbyRequest, Player, LobbyWithPlayers } from '../LobbyService';
import { LobbyRepository, Lobby } from '../../repositories/LobbyRepository';
import { UserRepository, User } from '../../repositories/UserRepository';
import { QuestionService } from '../QuestionService';
import { GameProfileService } from '../GameProfileService';

// Mock the dependencies
jest.mock('../../repositories/LobbyRepository');
jest.mock('../../repositories/UserRepository');
jest.mock('../QuestionService');
jest.mock('../GameProfileService');

// Provide explicit mock implementations so methods are jest.fn()
const createLobbyRepoMock = () => ({
  findByCode: jest.fn(),
  findLobbyById: jest.fn(),
  codeExists: jest.fn(),
  createLobby: jest.fn(),
  updateLobby: jest.fn(),
  deleteLobby: jest.fn(),
  findActiveLobbies: jest.fn(),
  findLobbiesByHost: jest.fn(),
  updateLobbyStatus: jest.fn(),
  addPlayerToLobby: jest.fn(),
  removePlayerFromLobby: jest.fn(),
  updatePlayerInLobby: jest.fn(),
  getLobbyCount: jest.fn(),
  getActiveLobbyCount: jest.fn(),
  cleanupOldLobbies: jest.fn(),
  cleanupInactiveLobbies: jest.fn(),
});

const createUserRepoMock = () => ({
  findUserById: jest.fn(),
});

const createQuestionServiceMock = () => ({
  getQuestionSetById: jest.fn(),
  getQuestionsBySetId: jest.fn(),
  getAllQuestionSetsWithStats: jest.fn(),
});

const createGameProfileServiceMock = () => ({
  getOrCreateProfile: jest.fn(),
});

// Note: Rather than mocking constructors (which may not be jest.Mock in ESM),
// we build plain mocked objects and inject them into the service under test.

describe('LobbyService', () => {
  let lobbyService: LobbyService;
  let mockLobbyRepository: jest.Mocked<LobbyRepository>;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockQuestionService: jest.Mocked<QuestionService>;
  let mockGameProfileService: jest.Mocked<GameProfileService>;

  // Test data
  const mockUser: User = {
    id: 1,
    username: 'testuser',
    email: 'test@example.com',
    password_hash: 'hashed_password',
    email_verified: true,
    is_admin: false,
    selected_character: 'student',
    character_level: 1,
    experience_points: 0,
    created_at: new Date('2024-01-01'),
    is_active: true,
    preferences: {
      language: 'en',
      theme: 'light'
    }
  };

  const mockPlayer: Player = {
    id: '1',
    username: 'testuser',
    character: 'student',
    characterLevel: 1,
    isReady: false,
    isHost: true,
    score: 0,
    multiplier: 1,
    correctAnswers: 0,
    isConnected: true,
    joinedAt: new Date('2024-01-01T12:00:00.000Z')
  };

  const mockLobby: Lobby = {
    id: 1,
    code: 'ABC123',
    host_id: 1,
    status: 'waiting',
    question_count: 10,
    current_question: 0,
    created_at: new Date('2024-01-01'),
    settings: {
      questionSetIds: [1, 2],
      timeLimit: 60,
      allowReplay: false
    },
    players: [mockPlayer]
  };

  const mockLobbyWithPlayers: LobbyWithPlayers = {
    id: 1,
    code: 'ABC123',
    host_id: 1,
    status: 'waiting',
    question_count: 10,
    current_question: 0,
    created_at: new Date('2024-01-01'),
    settings: {
      questionSetIds: [1, 2],
      timeLimit: 60,
      allowReplay: false
    },
    players: [mockPlayer]
  };

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Setup mocks as plain objects to avoid constructor side effects
    mockLobbyRepository = createLobbyRepoMock() as unknown as jest.Mocked<LobbyRepository>;
    mockUserRepository = createUserRepoMock() as unknown as jest.Mocked<UserRepository>;
    mockQuestionService = createQuestionServiceMock() as unknown as jest.Mocked<QuestionService>;
    mockGameProfileService = createGameProfileServiceMock() as unknown as jest.Mocked<GameProfileService>;

    // Create LobbyService instance
    lobbyService = new LobbyService();

    // Replace the private instances with our mocks
    (lobbyService as any).lobbyRepository = mockLobbyRepository;
    (lobbyService as any).userRepository = mockUserRepository;
    (lobbyService as any).questionService = mockQuestionService;
    (lobbyService as any).gameProfileService = mockGameProfileService;

    // Provide safe default implementations for update methods to avoid throwy branches
    mockLobbyRepository.updateLobby.mockImplementation(async (_id: number, data: Record<string, unknown>) => ({
      ...mockLobby,
      ...data,
    }));
    mockLobbyRepository.updateLobbyStatus.mockImplementation(async (_id: number, status: 'waiting' | 'starting' | 'playing' | 'ended') => ({
      ...mockLobby,
      status,
    }));
    mockLobbyRepository.findLobbyById.mockResolvedValue(null);
  });

  describe('Lobby Creation', () => {
    describe('createLobby', () => {
      const createLobbyRequest: CreateLobbyRequest = {
        hostId: 1,
        questionCount: 15,
        questionSetIds: [1, 2],
        settings: {
          timeLimit: 90,
          allowReplay: true
        }
      };

      it('should create a lobby successfully with valid data', async () => {
        // Arrange
        // GameProfileService throws so createLobby falls back to legacy UserRepository path
        mockGameProfileService.getOrCreateProfile.mockRejectedValue(new Error('No profile'));
        mockUserRepository.findUserById.mockResolvedValue(mockUser);
        mockLobbyRepository.codeExists.mockResolvedValue(false);
        mockLobbyRepository.createLobby.mockResolvedValue(mockLobby);

        // Act
        const result = await lobbyService.createLobby(createLobbyRequest);

        // Assert
        expect(mockUserRepository.findUserById).toHaveBeenCalledWith(1);
        expect(mockLobbyRepository.codeExists).toHaveBeenCalled();
        expect(mockLobbyRepository.createLobby).toHaveBeenCalledWith(
          expect.objectContaining({
            host_id: 1,
            question_count: 15,
            settings: expect.objectContaining({
              questionSetIds: [1, 2],
              timeLimit: 90,
              allowReplay: true
            })
          })
        );
        expect(result).toEqual({
          ...mockLobbyWithPlayers,
          players: expect.arrayContaining([
            expect.objectContaining({
              id: '1',
              username: 'testuser',
              character: 'student',
              characterLevel: 1,
              isReady: false,
              isHost: true,
              score: 0,
              multiplier: 1,
              correctAnswers: 0,
              isConnected: true,
              joinedAt: expect.any(Date)
            })
          ])
        });
      });

      it('should throw error when host user not found', async () => {
        // Arrange
        // GameProfileService throws so createLobby falls back to legacy UserRepository path
        mockGameProfileService.getOrCreateProfile.mockRejectedValue(new Error('No profile'));
        mockUserRepository.findUserById.mockResolvedValue(null);

        // Act & Assert
        await expect(lobbyService.createLobby(createLobbyRequest))
          .rejects.toThrow('Host user not found');

        expect(mockUserRepository.findUserById).toHaveBeenCalledWith(1);
        expect(mockLobbyRepository.createLobby).not.toHaveBeenCalled();
      });

      it('should use default values when optional parameters not provided', async () => {
        // Arrange
        const minimalRequest: CreateLobbyRequest = { hostId: 1 };
        mockGameProfileService.getOrCreateProfile.mockRejectedValue(new Error('No profile'));
        mockUserRepository.findUserById.mockResolvedValue(mockUser);
        mockLobbyRepository.codeExists.mockResolvedValue(false);
        mockLobbyRepository.createLobby.mockResolvedValue(mockLobby);

        // Act
        await lobbyService.createLobby(minimalRequest);

        // Assert
        expect(mockLobbyRepository.createLobby).toHaveBeenCalledWith(
          expect.objectContaining({
            question_count: 10,
            settings: expect.objectContaining({
              questionSetIds: [],
              timeLimit: 60,
              allowReplay: false
            })
          })
        );
      });

      it('should retry code generation when duplicate code exists', async () => {
        // Arrange
        mockGameProfileService.getOrCreateProfile.mockRejectedValue(new Error('No profile'));
        mockUserRepository.findUserById.mockResolvedValue(mockUser);
        mockLobbyRepository.codeExists
          .mockResolvedValueOnce(true)  // First attempt fails
          .mockResolvedValueOnce(false); // Second attempt succeeds
        mockLobbyRepository.createLobby.mockResolvedValue(mockLobby);

        // Act
        await lobbyService.createLobby(createLobbyRequest);

        // Assert
        expect(mockLobbyRepository.codeExists).toHaveBeenCalledTimes(2);
        expect(mockLobbyRepository.createLobby).toHaveBeenCalledTimes(1);
      });

      it('should throw error after maximum code generation attempts', async () => {
        // Arrange
        mockGameProfileService.getOrCreateProfile.mockRejectedValue(new Error('No profile'));
        mockUserRepository.findUserById.mockResolvedValue(mockUser);
        mockLobbyRepository.codeExists.mockResolvedValue(true); // Always return true

        // Act & Assert
        await expect(lobbyService.createLobby(createLobbyRequest))
          .rejects.toThrow('Failed to generate unique lobby code after maximum attempts');

        expect(mockLobbyRepository.codeExists).toHaveBeenCalledTimes(10);
        expect(mockLobbyRepository.createLobby).not.toHaveBeenCalled();
      });
    });

    describe('generateUniqueCode', () => {
      it('should generate a 6-character alphanumeric code', async () => {
        // Arrange
        mockLobbyRepository.codeExists.mockResolvedValue(false);

        // Act
        const code = await (lobbyService as any).generateUniqueCode();

        // Assert
        expect(code).toMatch(/^[A-Z0-9]{6}$/);
        expect(mockLobbyRepository.codeExists).toHaveBeenCalledWith(code);
      });
    });
  });

  describe('Player Management', () => {
    describe('joinLobby', () => {
      const joinRequest: JoinLobbyRequest = {
        lobbyCode: 'ABC123',
        player: {
          id: 'player2',
          username: 'newplayer',
          character: 'teacher',
          characterLevel: 2,
          isReady: false,
          isConnected: true
        }
      };

      it('should add player to lobby successfully', async () => {
        // Arrange
        const lobbyWithNewPlayer = {
          ...mockLobby,
          players: [
            mockPlayer,
            {
              ...joinRequest.player,
              isHost: false,
              score: 0,
              multiplier: 1,
              correctAnswers: 0,
              joinedAt: expect.any(Date)
            }
          ]
        };

        mockLobbyRepository.findByCode.mockResolvedValue(mockLobby);
        mockLobbyRepository.updateLobby.mockResolvedValue(lobbyWithNewPlayer);

        // Act
        const result = await lobbyService.joinLobby(joinRequest);

        // Assert
        expect(mockLobbyRepository.findByCode).toHaveBeenCalledWith('ABC123');
        expect(mockLobbyRepository.updateLobby).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            players: expect.arrayContaining([
              expect.objectContaining({
                id: 'player2',
                username: 'newplayer',
                isHost: false
              })
            ])
          })
        );
        expect(result).toBeDefined();
      });

      it('should throw error when lobby not found', async () => {
        // Arrange
        mockLobbyRepository.findByCode.mockResolvedValue(null);

        // Act & Assert
        await expect(lobbyService.joinLobby(joinRequest))
          .rejects.toThrow('Lobby not found');

        expect(mockLobbyRepository.findByCode).toHaveBeenCalledWith('ABC123');
        expect(mockLobbyRepository.updateLobby).not.toHaveBeenCalled();
      });

      it('should throw error when lobby is full', async () => {
        // Arrange
        const fullLobby = {
          ...mockLobby,
          players: Array(8).fill(mockPlayer) // Max 8 players
        };
        mockLobbyRepository.findByCode.mockResolvedValue(fullLobby);

        // Act & Assert
        await expect(lobbyService.joinLobby(joinRequest))
          .rejects.toThrow('Lobby is full');

        expect(mockLobbyRepository.updateLobby).not.toHaveBeenCalled();
      });

      it('should throw error when player already in lobby', async () => {
        // Arrange
        const existingPlayer = {
          ...joinRequest.player,
          isHost: false,
          score: 0,
          multiplier: 1,
          correctAnswers: 0,
          joinedAt: new Date()
        };
        const lobbyWithExistingPlayer = {
          ...mockLobby,
          players: [mockPlayer, existingPlayer]
        };
        mockLobbyRepository.findByCode.mockResolvedValue(lobbyWithExistingPlayer);

        // Act & Assert
        await expect(lobbyService.joinLobby(joinRequest))
          .rejects.toThrow('Player already in lobby');

        expect(mockLobbyRepository.updateLobby).not.toHaveBeenCalled();
      });

      it('should throw error when lobby is not in waiting status', async () => {
        // Arrange
        const activeLobby = { ...mockLobby, status: 'playing' as const };
        mockLobbyRepository.findByCode.mockResolvedValue(activeLobby);

        // Act & Assert
        await expect(lobbyService.joinLobby(joinRequest))
          .rejects.toThrow('Cannot join lobby that is not in waiting status');

        expect(mockLobbyRepository.updateLobby).not.toHaveBeenCalled();
      });
    });

    describe('leaveLobby', () => {
      it('should remove regular player from lobby when they leave', async () => {
        // Arrange
        const lobbyWithMultiplePlayers = {
          ...mockLobby,
          players: [
            mockPlayer,
            {
              id: 'player2',
              username: 'player2',
              character: 'teacher',
              isReady: false,
              isHost: false,
              score: 0,
              multiplier: 1,
              correctAnswers: 0,
              isConnected: true,
              joinedAt: new Date()
            }
          ]
        };

        const lobbyAfterPlayerLeft = {
          ...mockLobby,
          players: [mockPlayer] // Only host remains
        };

        mockLobbyRepository.findByCode.mockResolvedValue(lobbyWithMultiplePlayers);
        mockLobbyRepository.updateLobby.mockResolvedValue(lobbyAfterPlayerLeft);

        // Act
        const result = await lobbyService.leaveLobby('ABC123', 'player2');

        // Assert
        expect(mockLobbyRepository.findByCode).toHaveBeenCalledWith('ABC123');
        expect(mockLobbyRepository.updateLobby).toHaveBeenCalledWith(1, {
          players: [mockPlayer]
        });
        expect(mockLobbyRepository.deleteLobby).not.toHaveBeenCalled();
        expect(result).toEqual(lobbyAfterPlayerLeft);
      });

      it('should delete lobby when host leaves', async () => {
        // Arrange
        mockLobbyRepository.findByCode.mockResolvedValue(mockLobby);
        mockLobbyRepository.deleteLobby.mockResolvedValue(true);

        // Act
        const result = await lobbyService.leaveLobby('ABC123', '1');

        // Assert
        expect(mockLobbyRepository.deleteLobby).toHaveBeenCalledWith(1);
        expect(mockLobbyRepository.updateLobby).not.toHaveBeenCalled();
        expect(result).toBeNull();
      });

      it('should return null when lobby not found', async () => {
        // Arrange
        mockLobbyRepository.findByCode.mockResolvedValue(null);

        // Act
        const result = await lobbyService.leaveLobby('ABC123', '1');

        // Assert
        expect(result).toBeNull();
        expect(mockLobbyRepository.updateLobby).not.toHaveBeenCalled();
        expect(mockLobbyRepository.deleteLobby).not.toHaveBeenCalled();
      });

      it('should return null when player not found in lobby', async () => {
        // Arrange
        mockLobbyRepository.findByCode.mockResolvedValue(mockLobby);

        // Act
        const result = await lobbyService.leaveLobby('ABC123', 'nonexistent');

        // Assert
        expect(result).toBeNull();
        expect(mockLobbyRepository.updateLobby).not.toHaveBeenCalled();
        expect(mockLobbyRepository.deleteLobby).not.toHaveBeenCalled();
      });

      it('should handle multiple players leaving correctly', async () => {
        // Arrange
        const lobbyWithMultiplePlayers = {
          ...mockLobby,
          players: [
            mockPlayer, // Host
            {
              id: 'player2',
              username: 'player2',
              character: 'teacher',
              isReady: false,
              isHost: false,
              score: 0,
              multiplier: 1,
              correctAnswers: 0,
              isConnected: true,
              joinedAt: new Date()
            },
            {
              id: 'player3',
              username: 'player3',
              character: 'student',
              isReady: true,
              isHost: false,
              score: 0,
              multiplier: 1,
              correctAnswers: 0,
              isConnected: true,
              joinedAt: new Date()
            }
          ]
        };

        // First, player2 leaves
        const lobbyAfterPlayer2Left = {
          ...mockLobby,
          players: [
            mockPlayer, // Host
            {
              id: 'player3',
              username: 'player3',
              character: 'student',
              isReady: true,
              isHost: false,
              score: 0,
              multiplier: 1,
              correctAnswers: 0,
              isConnected: true,
              joinedAt: new Date()
            }
          ]
        };

        mockLobbyRepository.findByCode.mockResolvedValue(lobbyWithMultiplePlayers);
        mockLobbyRepository.updateLobby.mockResolvedValue(lobbyAfterPlayer2Left);

        // Act - player2 leaves
        const result1 = await lobbyService.leaveLobby('ABC123', 'player2');

        // Assert - lobby should be updated, not deleted
        expect(mockLobbyRepository.updateLobby).toHaveBeenCalledWith(1, {
          players: [mockPlayer, lobbyWithMultiplePlayers.players[2]]
        });
        expect(mockLobbyRepository.deleteLobby).not.toHaveBeenCalled();
        expect(result1).toEqual(lobbyAfterPlayer2Left);

        // Now player3 leaves
        const lobbyAfterPlayer3Left = {
          ...mockLobby,
          players: [mockPlayer] // Only host remains
        };

        mockLobbyRepository.findByCode.mockResolvedValue(lobbyAfterPlayer2Left);
        mockLobbyRepository.updateLobby.mockResolvedValue(lobbyAfterPlayer3Left);

        // Act - player3 leaves
        const result2 = await lobbyService.leaveLobby('ABC123', 'player3');

        // Assert - lobby should be updated, not deleted
        expect(mockLobbyRepository.updateLobby).toHaveBeenCalledWith(1, {
          players: [mockPlayer]
        });
        expect(mockLobbyRepository.deleteLobby).not.toHaveBeenCalled();
        expect(result2).toEqual(lobbyAfterPlayer3Left);

        // Finally, host leaves
        mockLobbyRepository.findByCode.mockResolvedValue(lobbyAfterPlayer3Left);
        mockLobbyRepository.deleteLobby.mockResolvedValue(true);

        // Act - host leaves
        const result3 = await lobbyService.leaveLobby('ABC123', '1');

        // Assert - lobby should be deleted
        expect(mockLobbyRepository.deleteLobby).toHaveBeenCalledWith(1);
        expect(result3).toBeNull();
      });
    });

    describe('updatePlayerReady', () => {
      it('should update player ready status successfully', async () => {
        // Arrange
        const updatedPlayer = { ...mockPlayer, isReady: true };
        const lobbyWithUpdatedPlayer = { ...mockLobby, players: [updatedPlayer] };

        mockLobbyRepository.findByCode.mockResolvedValue(mockLobby);
        mockLobbyRepository.updateLobby.mockResolvedValue(lobbyWithUpdatedPlayer);

        // Act
        const result = await lobbyService.updatePlayerReady('ABC123', '1', true);

        // Assert
        expect(mockLobbyRepository.updateLobby).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            players: [expect.objectContaining({ isReady: true })]
          })
        );
        expect(result).toEqual(lobbyWithUpdatedPlayer);
      });

      it('should throw error when lobby not found', async () => {
        // Arrange
        mockLobbyRepository.findByCode.mockResolvedValue(null);

        // Act & Assert
        await expect(lobbyService.updatePlayerReady('ABC123', '1', true))
          .rejects.toThrow('Lobby not found');
      });

      it('should throw error when player not found', async () => {
        // Arrange
        mockLobbyRepository.findByCode.mockResolvedValue(mockLobby);

        // Act & Assert
        await expect(lobbyService.updatePlayerReady('ABC123', 'nonexistent', true))
          .rejects.toThrow('Player not found in lobby');
      });
    });

    describe('updatePlayerConnection', () => {
      it('should update player connection status successfully', async () => {
        // Arrange
        const updatedPlayer = { ...mockPlayer, isConnected: false };
        const lobbyWithUpdatedPlayer = { ...mockLobby, players: [updatedPlayer] };

        mockLobbyRepository.findByCode.mockResolvedValue(mockLobby);
        mockLobbyRepository.updateLobby.mockResolvedValue(lobbyWithUpdatedPlayer);

        // Act
        const result = await lobbyService.updatePlayerConnection('ABC123', '1', false);

        // Assert
        expect(mockLobbyRepository.updateLobby).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            players: [expect.objectContaining({ isConnected: false })]
          })
        );
        expect(result).toEqual(lobbyWithUpdatedPlayer);
      });
    });
  });

  describe('Lobby Retrieval', () => {
    describe('getLobbyByCode', () => {
      it('should return lobby when found', async () => {
        // Arrange
        mockLobbyRepository.findByCode.mockResolvedValue(mockLobby);

        // Act
        const result = await lobbyService.getLobbyByCode('ABC123');

        // Assert
        expect(mockLobbyRepository.findByCode).toHaveBeenCalledWith('ABC123');
        expect(result).toEqual(mockLobbyWithPlayers);
      });

      it('should return null when lobby not found', async () => {
        // Arrange
        mockLobbyRepository.findByCode.mockResolvedValue(null);

        // Act
        const result = await lobbyService.getLobbyByCode('ABC123');

        // Assert
        expect(result).toBeNull();
      });
    });

    describe('getLobbyById', () => {
      it('should return lobby when found', async () => {
        // Arrange
        mockLobbyRepository.findLobbyById.mockResolvedValue(mockLobby);

        // Act
        const result = await lobbyService.getLobbyById(1);

        // Assert
        expect(mockLobbyRepository.findLobbyById).toHaveBeenCalledWith(1);
        expect(result).toEqual(mockLobbyWithPlayers);
      });

      it('should return null when lobby not found', async () => {
        // Arrange
        mockLobbyRepository.findLobbyById.mockResolvedValue(null);

        // Act
        const result = await lobbyService.getLobbyById(1);

        // Assert
        expect(result).toBeNull();
      });
    });

    describe('getActiveLobbies', () => {
      it('should return active lobbies', async () => {
        // Arrange
        const activeLobbies = [mockLobby];
        mockLobbyRepository.findActiveLobbies.mockResolvedValue(activeLobbies);

        // Act
        const result = await lobbyService.getActiveLobbies(10);

        // Assert
        expect(mockLobbyRepository.findActiveLobbies).toHaveBeenCalledWith(10);
        expect(result).toEqual([mockLobbyWithPlayers]);
      });

      it('should return all active lobbies when no limit specified', async () => {
        // Arrange
        const activeLobbies = [mockLobby];
        mockLobbyRepository.findActiveLobbies.mockResolvedValue(activeLobbies);

        // Act
        const result = await lobbyService.getActiveLobbies();

        // Assert
        expect(mockLobbyRepository.findActiveLobbies).toHaveBeenCalledWith(undefined);
        expect(result).toEqual([mockLobbyWithPlayers]);
      });
    });

    describe('getLobbiesByHost', () => {
      it('should return lobbies by host', async () => {
        // Arrange
        const hostLobbies = [mockLobby];
        mockLobbyRepository.findLobbiesByHost.mockResolvedValue(hostLobbies);

        // Act
        const result = await lobbyService.getLobbiesByHost(1);

        // Assert
        expect(mockLobbyRepository.findLobbiesByHost).toHaveBeenCalledWith(1);
        expect(result).toEqual([mockLobbyWithPlayers]);
      });
    });
  });

  describe('Lobby Settings Management', () => {
    describe('updateLobbySettings', () => {
      const newSettings = {
        timeLimit: 120,
        allowReplay: true,
        questionSetIds: [3, 4]
      };

      it('should update lobby settings successfully', async () => {
        // Arrange
        const updatedLobby = { ...mockLobby, settings: newSettings };
        mockLobbyRepository.findByCode.mockResolvedValue(mockLobby);
        mockLobbyRepository.updateLobby.mockResolvedValue(updatedLobby);

        // Act
        const result = await lobbyService.updateLobbySettings('ABC123', 1, newSettings);

        // Assert
        expect(mockLobbyRepository.findByCode).toHaveBeenCalledWith('ABC123');
        expect(mockLobbyRepository.updateLobby).toHaveBeenCalledWith(
          1,
          expect.objectContaining({
            settings: newSettings
          })
        );
        expect(result).toEqual({ ...mockLobbyWithPlayers, settings: newSettings });
      });

      it('should throw error when lobby not found', async () => {
        // Arrange
        mockLobbyRepository.findByCode.mockResolvedValue(null);

        // Act & Assert
        await expect(lobbyService.updateLobbySettings('ABC123', 1, newSettings))
          .rejects.toThrow('Lobby not found');
      });

      it('should throw error when user is not the host', async () => {
        // Arrange
        mockLobbyRepository.findByCode.mockResolvedValue(mockLobby);

        // Act & Assert
        await expect(lobbyService.updateLobbySettings('ABC123', 2, newSettings))
          .rejects.toThrow('Only the host can update lobby settings');
      });

      it('should throw error when lobby is not in waiting status', async () => {
        // Arrange
        const activeLobby = { ...mockLobby, status: 'playing' as const };
        mockLobbyRepository.findByCode.mockResolvedValue(activeLobby);

        // Act & Assert
        await expect(lobbyService.updateLobbySettings('ABC123', 1, newSettings))
          .rejects.toThrow('Cannot update settings for lobby that is not in waiting status');
      });
    });

    describe('validateQuestionSetSelection', () => {
      it('should validate question set selection successfully', async () => {
        // Arrange
        const questionSetIds = [1, 2];

        // Mock individual calls for each question set ID with type casting
        mockQuestionService.getQuestionSetById
          .mockResolvedValueOnce({
            id: 1,
            name: 'Set 1',
            description: 'Test set 1',
            category: 'general',
            difficulty: 'easy' as const,
            is_active: true,
            owner_id: 1,
            is_public: true,
            is_featured: false,
            tags: [],
            metadata: {},
            created_at: new Date(),
            updated_at: new Date()
          } as any)
          .mockResolvedValueOnce({
            id: 2,
            name: 'Set 2',
            description: 'Test set 2',
            category: 'science',
            difficulty: 'medium' as const,
            is_active: true,
            owner_id: 1,
            is_public: true,
            is_featured: false,
            tags: [],
            metadata: {},
            created_at: new Date(),
            updated_at: new Date()
          } as any);
        mockQuestionService.getQuestionsBySetId
          .mockResolvedValueOnce(Array(50).fill({ id: 1 }))
          .mockResolvedValueOnce(Array(30).fill({ id: 2 }));

        // Act
        const result = await lobbyService.validateQuestionSetSelection(questionSetIds);

        // Assert
        expect(mockQuestionService.getQuestionSetById).toHaveBeenCalledTimes(2);
        expect(mockQuestionService.getQuestionsBySetId).toHaveBeenCalledTimes(2);
        expect(result).toEqual({
          isValid: true,
          totalQuestions: 80,
          questionSets: [
            { id: 1, name: 'Set 1', questionCount: 50 },
            { id: 2, name: 'Set 2', questionCount: 30 }
          ],
          errors: []
        });
      });

      it('should return validation errors for invalid question sets', async () => {
        // Arrange
        const questionSetIds = [1, 999];

        mockQuestionService.getQuestionSetById
          .mockResolvedValueOnce({
            id: 1,
            name: 'Set 1',
            description: 'Test set 1',
            category: 'general',
            difficulty: 'easy' as const,
            is_active: true,
            owner_id: 1,
            is_public: true,
            is_featured: false,
            tags: [],
            metadata: {},
            created_at: new Date(),
            updated_at: new Date()
          } as any)
          .mockResolvedValueOnce(null); // Question set 999 not found
        mockQuestionService.getQuestionsBySetId
          .mockResolvedValueOnce(Array(50).fill({ id: 1 }));

        // Act
        const result = await lobbyService.validateQuestionSetSelection(questionSetIds);

        // Assert
        expect(result).toEqual({
          isValid: false,
          totalQuestions: 50,
          questionSets: [{ id: 1, name: 'Set 1', questionCount: 50 }],
          errors: ['Question set with ID 999 not found']
        });
      });

      it('should return error for empty question set selection', async () => {
        // Arrange
        const questionSetIds: number[] = [];

        // Act
        const result = await lobbyService.validateQuestionSetSelection(questionSetIds);

        // Assert
        expect(result).toEqual({
          isValid: false,
          totalQuestions: 0,
          questionSets: [],
          errors: ['At least one question set must be selected']
        });
      });
    });

    describe('getAvailableQuestionSets', () => {
      it('should return available question sets', async () => {
        // Arrange
        const questionSets = [
          {
            id: 1,
            name: 'General Knowledge',
            description: 'Test description',
            category: 'general',
            difficulty: 'easy' as const,
            is_active: true,
            owner_id: 1,
            is_public: true,
            is_featured: false,
            tags: [],
            metadata: {},
            created_at: new Date(),
            updated_at: new Date(),
            questionCount: 50,
            averageDifficulty: 1.5
          }
        ];
        mockQuestionService.getAllQuestionSetsWithStats.mockResolvedValue(questionSets as any);

        // Act
        const result = await lobbyService.getAvailableQuestionSets();

        // Assert
        expect(mockQuestionService.getAllQuestionSetsWithStats).toHaveBeenCalledWith(false);
        expect(result).toEqual([
          {
            id: 1,
            name: 'General Knowledge',
            category: 'general',
            difficulty: 'easy',
            questionCount: 50,
            isActive: true
          }
        ]);
      });
    });
  });

  describe('Game State Management', () => {
    describe('startGame', () => {
      it('should start game successfully when all players are ready', async () => {
        // Arrange
        const readyPlayers = [
          { ...mockPlayer, isReady: true },
          {
            id: 'player2',
            username: 'player2',
            character: 'teacher',
            isReady: true,
            isHost: false,
            score: 0,
            multiplier: 1,
            correctAnswers: 0,
            isConnected: true,
            joinedAt: new Date()
          }
        ];
        const lobbyWithReadyPlayers = { ...mockLobby, players: readyPlayers };
        const startedLobby = { ...lobbyWithReadyPlayers, status: 'starting' as const };

        mockLobbyRepository.findByCode.mockResolvedValue(lobbyWithReadyPlayers);
        mockLobbyRepository.updateLobbyStatus.mockResolvedValue(startedLobby);

        // Act
        const result = await lobbyService.startGame('ABC123', 1);

        // Assert
        expect(mockLobbyRepository.updateLobbyStatus).toHaveBeenCalledWith(1, 'starting');
        expect(result).toEqual({ ...mockLobbyWithPlayers, status: 'starting', players: readyPlayers });
      });

      it('should throw error when lobby not found', async () => {
        // Arrange
        mockLobbyRepository.findByCode.mockResolvedValue(null);

        // Act & Assert
        await expect(lobbyService.startGame('ABC123', 1))
          .rejects.toThrow('Lobby not found');
      });

      it('should throw error when user is not the host', async () => {
        // Arrange
        mockLobbyRepository.findByCode.mockResolvedValue(mockLobby);

        // Act & Assert
        await expect(lobbyService.startGame('ABC123', 2))
          .rejects.toThrow('Only the host can start the game');
      });

      it('should throw error when lobby is not in waiting status', async () => {
        // Arrange
        const activeLobby = { ...mockLobby, status: 'playing' as const };
        mockLobbyRepository.findByCode.mockResolvedValue(activeLobby);

        // Act & Assert
        await expect(lobbyService.startGame('ABC123', 1))
          .rejects.toThrow('Cannot start game for lobby that is not in waiting status');
      });

      it('should throw error when not all players are ready', async () => {
        // Arrange
        const unreadyPlayers = [
          { ...mockPlayer, isReady: true },
          {
            id: 'player2',
            username: 'player2',
            character: 'teacher',
            isReady: false,
            isHost: false,
            score: 0,
            multiplier: 1,
            correctAnswers: 0,
            isConnected: true,
            joinedAt: new Date()
          }
        ];
        const lobbyWithUnreadyPlayers = { ...mockLobby, players: unreadyPlayers };
        mockLobbyRepository.findByCode.mockResolvedValue(lobbyWithUnreadyPlayers);

        // Act & Assert
        await expect(lobbyService.startGame('ABC123', 1))
          .rejects.toThrow('All players must be ready to start the game');
      });

      it('should throw error when less than 2 players in lobby', async () => {
        // Arrange
        mockLobbyRepository.findByCode.mockResolvedValue(mockLobby);

        // Act & Assert
        await expect(lobbyService.startGame('ABC123', 1))
          .rejects.toThrow('At least 2 players are required to start the game');
      });
    });
  });

  describe('Lobby Cleanup', () => {
    describe('cleanupOldLobbies', () => {
      it('should cleanup old lobbies', async () => {
        mockLobbyRepository.cleanupOldLobbies.mockResolvedValue(5);

        const result = await lobbyService.cleanupOldLobbies(24);

        expect(mockLobbyRepository.cleanupOldLobbies).toHaveBeenCalledWith(24);
        expect(result).toBe(5);
      });

      it('should use default hours when no parameter provided', async () => {
        mockLobbyRepository.cleanupOldLobbies.mockResolvedValue(3);

        const result = await lobbyService.cleanupOldLobbies();

        expect(mockLobbyRepository.cleanupOldLobbies).toHaveBeenCalledWith(24);
        expect(result).toBe(3);
      });
    });

    describe('cleanupInactiveLobbies', () => {
      it('should cleanup inactive lobbies', async () => {
        mockLobbyRepository.cleanupInactiveLobbies.mockResolvedValue(2);

        const result = await lobbyService.cleanupInactiveLobbies(10);

        expect(mockLobbyRepository.cleanupInactiveLobbies).toHaveBeenCalledWith(10);
        expect(result).toBe(2);
      });

      it('should use default minutes when no parameter provided', async () => {
        mockLobbyRepository.cleanupInactiveLobbies.mockResolvedValue(1);

        const result = await lobbyService.cleanupInactiveLobbies();

        expect(mockLobbyRepository.cleanupInactiveLobbies).toHaveBeenCalledWith(10);
        expect(result).toBe(1);
      });
    });
  });

  describe('Lobby Statistics', () => {
    describe('getLobbyStats', () => {
      it('should return lobby statistics', async () => {
        // Arrange
        mockLobbyRepository.getLobbyCount.mockResolvedValue(100);
        mockLobbyRepository.getActiveLobbyCount.mockResolvedValue(25);
        mockLobbyRepository.findActiveLobbies.mockResolvedValue([
          { ...mockLobby, players: [mockPlayer] },
          { ...mockLobby, players: [mockPlayer, { ...mockPlayer, id: 'player2' }] }
        ]);

        // Act
        const result = await lobbyService.getLobbyStats();

        // Assert
        expect(mockLobbyRepository.getLobbyCount).toHaveBeenCalled();
        expect(mockLobbyRepository.getActiveLobbyCount).toHaveBeenCalled();
        expect(mockLobbyRepository.findActiveLobbies).toHaveBeenCalled();
        expect(result).toEqual({
          totalLobbies: 100,
          activeLobbies: 25,
          averagePlayersPerLobby: 1.5
        });
      });

      it('should handle case with no active lobbies', async () => {
        // Arrange
        mockLobbyRepository.getLobbyCount.mockResolvedValue(0);
        mockLobbyRepository.getActiveLobbyCount.mockResolvedValue(0);
        mockLobbyRepository.findActiveLobbies.mockResolvedValue([]);

        // Act
        const result = await lobbyService.getLobbyStats();

        // Assert
        expect(result).toEqual({
          totalLobbies: 0,
          activeLobbies: 0,
          averagePlayersPerLobby: 0
        });
      });
    });
  });

  describe('Utility Methods', () => {
    describe('isValidLobbyCode', () => {
      it('should validate correct lobby code format', () => {
        // Act & Assert
        expect(LobbyService.isValidLobbyCode('ABC123')).toBe(true);
        expect(LobbyService.isValidLobbyCode('XYZ789')).toBe(true);
        expect(LobbyService.isValidLobbyCode('123456')).toBe(true);
      });

      it('should reject invalid lobby code format', () => {
        // Act & Assert
        expect(LobbyService.isValidLobbyCode('ABC12')).toBe(false); // Too short
        expect(LobbyService.isValidLobbyCode('ABC1234')).toBe(false); // Too long
        expect(LobbyService.isValidLobbyCode('ABC12a')).toBe(false); // Lowercase
        expect(LobbyService.isValidLobbyCode('ABC-12')).toBe(false); // Special characters
        expect(LobbyService.isValidLobbyCode('')).toBe(false); // Empty
      });
    });

    describe('formatLobbyResponse', () => {
      it('should format lobby response correctly', () => {
        // Act
        const result = (lobbyService as any).formatLobbyResponse(mockLobby);

        // Assert
        expect(result).toEqual(mockLobbyWithPlayers);
        expect(result.players).toEqual(mockLobby.players);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Arrange
      mockLobbyRepository.findByCode.mockRejectedValue(new Error('Database connection failed'));

      // Act & Assert
      await expect(lobbyService.getLobbyByCode('ABC123'))
        .rejects.toThrow('Database connection failed');
    });

    it('should handle question service errors gracefully', async () => {
      // Arrange
      mockQuestionService.getQuestionSetById.mockRejectedValue(new Error('Question service unavailable'));

      // Act & Assert
      await expect(lobbyService.validateQuestionSetSelection([1]))
        .rejects.toThrow('Question service unavailable');
    });

    it('should handle user repository errors gracefully', async () => {
      // Arrange
      // GameProfileService throws so createLobby falls back to legacy UserRepository path
      mockGameProfileService.getOrCreateProfile.mockRejectedValue(new Error('No profile'));
      mockUserRepository.findUserById.mockRejectedValue(new Error('User service unavailable'));

      // Act & Assert
      await expect(lobbyService.createLobby({ hostId: 1 }))
        .rejects.toThrow('User service unavailable');
    });
  });
}); 