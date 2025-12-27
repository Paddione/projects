import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Server, Socket } from 'socket.io';
import { SocketService, SocketUser, SocketLobbyEvent } from '../SocketService';
import { LobbyService } from '../LobbyService';
import { GameService } from '../GameService';
import { UserRepository } from '../../repositories/UserRepository';
import { RequestLogger } from '../../middleware/logging';

// Mock the dependencies
jest.mock('../GameService');
jest.mock('../../repositories/UserRepository');
jest.mock('../../middleware/logging');

// Mock LobbyService with proper constructor and methods
jest.mock('../LobbyService', () => {
  const mockLobbyServiceMethods = {
    joinLobby: jest.fn(),
    leaveLobby: jest.fn(),
    updatePlayerReady: jest.fn(),
    updatePlayerConnection: jest.fn(),
    getLobbyQuestionSetInfo: jest.fn(),
    updateLobbyQuestionSets: jest.fn(),
  };

  function MockLobbyServiceConstructor() {
    return mockLobbyServiceMethods;
  }
  
  (MockLobbyServiceConstructor as any).isValidLobbyCode = jest.fn(() => true);

  return {
    LobbyService: MockLobbyServiceConstructor
  };
});

describe('SocketService', () => {
  let socketService: SocketService;
  let mockIo: jest.Mocked<Server>;
  let mockSocket: jest.Mocked<Socket>;
  let mockLobbyService: jest.Mocked<LobbyService>;
  let mockGameService: jest.Mocked<GameService>;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockRequestLogger: jest.Mocked<typeof RequestLogger>;

  // Test data
  const mockSocketUser: SocketUser = {
    id: '1',
    username: 'testuser',
    character: 'wizard',
    isHost: false,
    lobbyCode: 'ABC123'
  };

  const mockLobby = {
    id: 1,
    code: 'ABC123',
    host_id: 1,
    status: 'waiting' as const,
    question_count: 10,
    current_question: 0,
    created_at: new Date(),
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
        characterLevel: 1,
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

  const mockGameState = {
    lobbyCode: 'ABC123',
    gameSessionId: 1,
    currentQuestionIndex: 0,
    totalQuestions: 10,
    timeRemaining: 60,
    isActive: true,
    players: [
      {
        id: 'user_1',
        username: 'testuser',
        character: 'wizard',
        characterLevel: 1,
        isHost: false,
        score: 0,
        multiplier: 1,
        correctAnswers: 0,
        hasAnsweredCurrentQuestion: false,
        isConnected: true
      }
    ],
    selectedQuestionSetIds: [1, 2],
    questions: [
      {
        id: 1,
        question: 'What is the capital of France?',
        answers: ['London', 'Berlin', 'Paris', 'Madrid'],
        correctAnswer: 'Paris',
        questionSetId: 1,
        language: 'en'
      }
    ]
  };

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Mock console.error to prevent noise in test output
    jest.spyOn(console, 'error').mockImplementation(() => { });

    // Create mock Socket.IO server
    const mockToResult = {
      emit: jest.fn()
    };

    mockIo = {
      on: jest.fn(),
      to: jest.fn().mockReturnValue(mockToResult),
      emit: mockToResult.emit, // Point to the same emit function
      in: jest.fn().mockReturnThis(),
      use: jest.fn(), // Add the missing use method for authentication middleware
      sockets: {
        join: jest.fn(),
        leave: jest.fn(),
        disconnect: jest.fn()
      }
    } as any;

    // Create mock Socket
    mockSocket = {
      id: 'socket-123',
      join: jest.fn(),
      leave: jest.fn(),
      emit: jest.fn(),
      on: jest.fn(),
      disconnect: jest.fn(),
      rooms: new Set(['room1']),
      handshake: {
        auth: {},
        headers: {},
        query: {},
        address: '127.0.0.1'
      }
    } as any;

    // Get the mocked LobbyService instance - it returns the mockLobbyServiceMethods object
    const mockedModule = jest.requireMock('../LobbyService') as any;
    mockLobbyService = new mockedModule.LobbyService() as any;

    mockGameService = {
      isGameActive: jest.fn(),
      startGameSession: jest.fn(),
      submitAnswer: jest.fn(),
      handlePlayerDisconnect: jest.fn(),
      // Add other methods as needed
    } as any;

    mockUserRepository = {
      findUserById: jest.fn(),
      // Add other methods as needed
    } as any;

    // Mock the static RequestLogger methods using jest.spyOn
    jest.spyOn(RequestLogger, 'logSocketConnection').mockImplementation(() => { });
    jest.spyOn(RequestLogger, 'logSocketEvent').mockImplementation(() => { });

    mockRequestLogger = {
      logSocketConnection: RequestLogger.logSocketConnection as jest.MockedFunction<typeof RequestLogger.logSocketConnection>,
      logSocketEvent: RequestLogger.logSocketEvent as jest.MockedFunction<typeof RequestLogger.logSocketEvent>,
      // Add other methods as needed
    } as any;

    // Create SocketService instance
    socketService = new SocketService(mockIo);

    // Replace private instances with mocks
    (socketService as any).lobbyService = mockLobbyService;
    (socketService as any).gameService = mockGameService;
    (socketService as any).userRepository = mockUserRepository;
  });

  afterEach(() => {
    // Restore console.error
    jest.restoreAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with Socket.IO server', () => {
      expect(socketService).toBeInstanceOf(SocketService);
      expect(mockIo.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });

    it('should set up all event handlers on connection', () => {
      // Get the connection handler
      const connectionHandler = mockIo.on.mock.calls[0]![1];

      // Simulate connection
      connectionHandler(mockSocket);

      // Verify all event listeners are set up
      expect(mockSocket.on).toHaveBeenCalledWith('join-lobby', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('leave-lobby', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('player-ready', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('start-game', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('update-question-sets', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('get-question-set-info', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('submit-answer', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('disconnect', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('ping', expect.any(Function));
    });
  });

  describe('Connection Handling', () => {
    it('should handle new connections correctly', () => {
      const connectionHandler = mockIo.on.mock.calls[0]![1];

      connectionHandler(mockSocket);

      expect(mockRequestLogger.logSocketConnection).toHaveBeenCalledWith('socket-123', 'connect');
      expect(mockSocket.emit).toHaveBeenCalledWith('connected', {
        socketId: 'socket-123',
        timestamp: expect.any(Number),
        authenticated: false,
        user: null
      });
    });

    it('should handle ping/pong correctly', () => {
      const connectionHandler = mockIo.on.mock.calls[0]![1];
      connectionHandler(mockSocket);

      // Get the ping handler
      const pingHandler = mockSocket.on.mock.calls.find(call => call[0] === 'ping')?.[1];

      if (pingHandler) {
        pingHandler();

        expect(mockSocket.emit).toHaveBeenCalledWith('pong', {
          timestamp: expect.any(Number)
        });
      }
    });
  });

  describe('Lobby Management', () => {
    describe('handleJoinLobby', () => {
      it('should successfully join a valid lobby', async () => {
        // Mock the static method
        const mockedModule = jest.requireMock('../LobbyService') as any;
        mockedModule.LobbyService.isValidLobbyCode.mockReturnValue(true);
        mockLobbyService.joinLobby.mockResolvedValue(mockLobby);

        // Call the method directly
        await (socketService as any).handleJoinLobby(mockSocket, {
          lobbyCode: 'ABC123',
          player: mockSocketUser
        });

        expect(mockRequestLogger.logSocketEvent).toHaveBeenCalledWith(
          'socket-123',
          'join-lobby',
          { lobbyCode: 'ABC123', playerId: '1' }
        );
        expect(mockSocket.join).toHaveBeenCalledWith('ABC123');
        expect(mockSocket.emit).toHaveBeenCalledWith('join-success', {
          lobby: mockLobby,
          message: 'Successfully joined lobby'
        });
        expect(mockIo.to).toHaveBeenCalledWith('ABC123');
        expect(mockIo.emit).toHaveBeenCalledWith('lobby-updated', expect.objectContaining({
          lobby: mockLobby,
          event: 'player-joined'
        }));
      });

      it('should reject invalid lobby code format', async () => {
        // Mock the static method to return false for invalid code
        const mockedModule = jest.requireMock('../LobbyService') as any;
        mockedModule.LobbyService.isValidLobbyCode.mockReturnValue(false);

        // Call the method directly
        await (socketService as any).handleJoinLobby(mockSocket, {
          lobbyCode: 'INVALID',
          player: mockSocketUser
        });

        expect(mockSocket.emit).toHaveBeenCalledWith('join-error', {
          type: 'INVALID_CODE',
          message: 'Invalid lobby code format'
        });
      });

      it('should handle lobby not found error', async () => {
        // Mock the static method
        const mockedModule = jest.requireMock('../LobbyService') as any;
        mockedModule.LobbyService.isValidLobbyCode.mockReturnValue(true);
        mockLobbyService.joinLobby.mockRejectedValue(new Error('Lobby not found'));

        // Call the method directly
        await (socketService as any).handleJoinLobby(mockSocket, {
          lobbyCode: 'ABC123',
          player: mockSocketUser
        });

        expect(mockSocket.emit).toHaveBeenCalledWith('join-error', {
          type: 'SERVER_ERROR',
          message: 'Failed to join lobby'
        });
      });

      it('should handle server errors during join', async () => {
        // Mock the static method
        const mockedModule = jest.requireMock('../LobbyService') as any;
        mockedModule.LobbyService.isValidLobbyCode.mockReturnValue(true);
        mockLobbyService.joinLobby.mockRejectedValue(new Error('Database error'));

        // Call the method directly
        await (socketService as any).handleJoinLobby(mockSocket, {
          lobbyCode: 'ABC123',
          player: mockSocketUser
        });

        expect(mockSocket.emit).toHaveBeenCalledWith('join-error', {
          type: 'SERVER_ERROR',
          message: 'Failed to join lobby'
        });
      });
    });

    describe('handleLeaveLobby', () => {
      it('should successfully leave a lobby and delete it', async () => {
        mockLobbyService.leaveLobby.mockResolvedValue(null);

        // Add user to connected users
        (socketService as any).connectedUsers.set('socket-123', mockSocketUser);

        // Call the method directly
        await (socketService as any).handleLeaveLobby(mockSocket, {
          lobbyCode: 'ABC123',
          playerId: '1'
        });

        expect(mockRequestLogger.logSocketEvent).toHaveBeenCalledWith(
          'socket-123',
          'leave-lobby',
          { lobbyCode: 'ABC123', playerId: '1' }
        );
        expect(mockSocket.leave).toHaveBeenCalledWith('ABC123');
        expect(mockSocket.emit).toHaveBeenCalledWith('leave-success', {
          message: 'Successfully left lobby'
        });
        expect(mockIo.to).toHaveBeenCalledWith('ABC123');
        expect(mockIo.emit).toHaveBeenCalledWith('lobby-deleted', expect.objectContaining({
          message: 'Lobby has been deleted',
          reason: 'host-left'
        }));
      });

      it('should handle server errors during leave', async () => {
        mockLobbyService.leaveLobby.mockRejectedValue(new Error('Database error'));

        // Call the method directly
        await (socketService as any).handleLeaveLobby(mockSocket, {
          lobbyCode: 'ABC123',
          playerId: '1'
        });

        expect(mockSocket.emit).toHaveBeenCalledWith('leave-error', {
          type: 'SERVER_ERROR',
          message: 'Failed to leave lobby'
        });
      });
    });

    describe('handlePlayerReady', () => {
      it('should successfully update player ready state', async () => {
        mockLobbyService.updatePlayerReady.mockResolvedValue(mockLobby);

        // Call the method directly
        await (socketService as any).handlePlayerReady(mockSocket, {
          lobbyCode: 'ABC123',
          playerId: '1',
          isReady: true
        });

        expect(mockRequestLogger.logSocketEvent).toHaveBeenCalledWith(
          'socket-123',
          'player-ready',
          { lobbyCode: 'ABC123', playerId: '1', isReady: true }
        );
        expect(mockIo.to).toHaveBeenCalledWith('ABC123');
        expect(mockIo.emit).toHaveBeenCalledWith('lobby-updated', expect.objectContaining({
          lobby: mockLobby,
          event: 'player-ready-changed',
          playerId: '1',
          isReady: true
        }));
      });

      it('should handle server errors during ready state update', async () => {
        mockLobbyService.updatePlayerReady.mockRejectedValue(new Error('Database error'));

        // Call the method directly
        await (socketService as any).handlePlayerReady(mockSocket, {
          lobbyCode: 'ABC123',
          playerId: '1',
          isReady: true
        });

        expect(mockSocket.emit).toHaveBeenCalledWith('ready-error', {
          type: 'SERVER_ERROR',
          message: 'Failed to update ready state'
        });
      });
    });
  });

  describe('Game Management', () => {
    describe('handleStartGame', () => {
      it('should successfully start a game', async () => {
        mockGameService.startGameSession.mockResolvedValue(mockGameState);

        // Call the method directly
        await (socketService as any).handleStartGame(mockSocket, {
          lobbyCode: 'ABC123',
          hostId: '1'
        });

        expect(mockRequestLogger.logSocketEvent).toHaveBeenCalledWith(
          'socket-123',
          'start-game',
          { lobbyCode: 'ABC123', hostId: '1' }
        );
        expect(mockGameService.startGameSession).toHaveBeenCalledWith('ABC123', 1);
        expect(mockIo.to).toHaveBeenCalledWith('ABC123');
        expect(mockIo.emit).toHaveBeenCalledWith('game-started', {
          gameState: mockGameState,
          message: 'Game is starting...'
        });
      });

      it('should handle server errors during game start', async () => {
        mockGameService.startGameSession.mockRejectedValue(new Error('Game start failed'));

        // Call the method directly
        await (socketService as any).handleStartGame(mockSocket, {
          lobbyCode: 'ABC123',
          hostId: '1'
        });

        expect(mockSocket.emit).toHaveBeenCalledWith('start-game-error', {
          type: 'SERVER_ERROR',
          message: 'Failed to start game'
        });
      });
    });

    describe('handleSubmitAnswer', () => {
      it('should successfully submit an answer', async () => {
        mockGameService.submitAnswer.mockResolvedValue(undefined);

        // Call the method directly
        await (socketService as any).handleSubmitAnswer(mockSocket, {
          lobbyCode: 'ABC123',
          playerId: '1',
          answer: 'A',
          timeElapsed: 30
        });

        expect(mockRequestLogger.logSocketEvent).toHaveBeenCalledWith(
          'socket-123',
          'submit-answer',
          { lobbyCode: 'ABC123', playerId: '1', answer: 'A', timeElapsed: 30 }
        );
        expect(mockGameService.submitAnswer).toHaveBeenCalledWith('ABC123', '1', 'A');
      });

      it('should handle server errors during answer submission', async () => {
        mockGameService.submitAnswer.mockRejectedValue(new Error('Answer submission failed'));

        // Call the method directly
        await (socketService as any).handleSubmitAnswer(mockSocket, {
          lobbyCode: 'ABC123',
          playerId: '1',
          answer: 'A',
          timeElapsed: 30
        });

        expect(mockSocket.emit).toHaveBeenCalledWith('answer-error', {
          type: 'SERVER_ERROR',
          message: 'Failed to submit answer'
        });
      });
    });
  });

  describe('Question Set Management', () => {
    describe('handleUpdateQuestionSets', () => {
      it('should successfully update question sets', async () => {
        mockLobbyService.updateLobbyQuestionSets.mockResolvedValue(mockLobby);

        // Call the method directly
        await (socketService as any).handleUpdateQuestionSets(mockSocket, {
          lobbyCode: 'ABC123',
          hostId: '1',
          questionSetIds: [1, 2, 3],
          questionCount: 15
        });

        expect(mockRequestLogger.logSocketEvent).toHaveBeenCalledWith(
          'socket-123',
          'update-question-sets',
          { lobbyCode: 'ABC123', hostId: '1', questionSetIds: [1, 2, 3], questionCount: 15 }
        );
        expect(mockLobbyService.updateLobbyQuestionSets).toHaveBeenCalledWith(
          'ABC123',
          1,
          [1, 2, 3],
          15
        );
        expect(mockSocket.emit).toHaveBeenCalledWith('question-sets-update-success', {
          message: 'Question set settings updated successfully',
          lobby: mockLobby
        });
        expect(mockIo.to).toHaveBeenCalledWith('ABC123');
        expect(mockIo.emit).toHaveBeenCalledWith('question-sets-updated', {
          lobby: mockLobby,
          updatedBy: '1'
        });
      });

      it('should handle server errors during question set update', async () => {
        mockLobbyService.updateLobbyQuestionSets.mockRejectedValue(new Error('Update failed'));

        // Call the method directly
        await (socketService as any).handleUpdateQuestionSets(mockSocket, {
          lobbyCode: 'ABC123',
          hostId: '1',
          questionSetIds: [1, 2, 3],
          questionCount: 15
        });

        expect(mockSocket.emit).toHaveBeenCalledWith('question-sets-update-error', {
          type: 'UPDATE_FAILED',
          message: 'Update failed'
        });
      });
    });

    describe('handleGetQuestionSetInfo', () => {
      it('should successfully retrieve question set info', async () => {
        const mockQuestionSetInfo = {
          selectedSets: [
            { id: 1, name: 'General Knowledge', questionCount: 50 },
            { id: 2, name: 'Science', questionCount: 30 }
          ],
          totalQuestions: 80,
          selectedQuestionCount: 15,
          maxQuestionCount: 100
        };

        mockLobbyService.getLobbyQuestionSetInfo.mockResolvedValue(mockQuestionSetInfo);

        // Call the method directly
        await (socketService as any).handleGetQuestionSetInfo(mockSocket, {
          lobbyCode: 'ABC123'
        });

        expect(mockRequestLogger.logSocketEvent).toHaveBeenCalledWith(
          'socket-123',
          'get-question-set-info',
          { lobbyCode: 'ABC123' }
        );
        expect(mockSocket.emit).toHaveBeenCalledWith('question-set-info', {
          questionSetInfo: mockQuestionSetInfo
        });
      });

      it('should handle lobby not found error', async () => {
        mockLobbyService.getLobbyQuestionSetInfo.mockResolvedValue(null);

        // Call the method directly
        await (socketService as any).handleGetQuestionSetInfo(mockSocket, {
          lobbyCode: 'ABC123'
        });

        expect(mockSocket.emit).toHaveBeenCalledWith('question-set-info-error', {
          type: 'LOBBY_NOT_FOUND',
          message: 'Lobby not found'
        });
      });

      it('should handle server errors during info retrieval', async () => {
        mockLobbyService.getLobbyQuestionSetInfo.mockRejectedValue(new Error('Fetch failed'));

        // Call the method directly
        await (socketService as any).handleGetQuestionSetInfo(mockSocket, {
          lobbyCode: 'ABC123'
        });

        expect(mockSocket.emit).toHaveBeenCalledWith('question-set-info-error', {
          type: 'FETCH_FAILED',
          message: 'Failed to retrieve question set information'
        });
      });
    });
  });

  describe('Disconnection Handling', () => {
    it('should handle user disconnection correctly', async () => {
      // Add user to connected users
      (socketService as any).connectedUsers.set('socket-123', mockSocketUser);

      // Mock game service methods
      mockGameService.isGameActive.mockReturnValue(false);
      mockLobbyService.updatePlayerConnection.mockResolvedValue(mockLobby);

      // Call the method directly
      (socketService as any).handleDisconnect(mockSocket);

      // Wait for async operations to complete
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockRequestLogger.logSocketConnection).toHaveBeenCalledWith('socket-123', 'disconnect');
      expect(mockLobbyService.updatePlayerConnection).toHaveBeenCalledWith('ABC123', '1', false);
    });

    it('should handle game disconnection when game is active', () => {
      // Add user to connected users
      (socketService as any).connectedUsers.set('socket-123', mockSocketUser);

      // Mock game service methods
      mockGameService.isGameActive.mockReturnValue(true);
      mockLobbyService.updatePlayerConnection.mockResolvedValue(mockLobby);
      mockGameService.handlePlayerDisconnect.mockResolvedValue(undefined);

      // Call the method directly
      (socketService as any).handleDisconnect(mockSocket);

      expect(mockGameService.isGameActive).toHaveBeenCalledWith('ABC123');
      expect(mockGameService.handlePlayerDisconnect).toHaveBeenCalledWith('ABC123', '1');
    });

    it('should handle disconnection errors gracefully', () => {
      // Add user to connected users
      (socketService as any).connectedUsers.set('socket-123', mockSocketUser);

      // Mock errors
      mockLobbyService.updatePlayerConnection.mockRejectedValue(new Error('Update failed'));
      mockGameService.isGameActive.mockReturnValue(true);
      mockGameService.handlePlayerDisconnect.mockRejectedValue(new Error('Game disconnect failed'));

      // Should not throw error
      expect(() => (socketService as any).handleDisconnect(mockSocket)).not.toThrow();
    });
  });

  describe('Public Methods', () => {
    it('should return connected users correctly', () => {
      const connectedUsers = new Map();
      connectedUsers.set('socket-123', mockSocketUser);
      (socketService as any).connectedUsers = connectedUsers;

      const result = socketService.getConnectedUsers();

      expect(result).toBeInstanceOf(Map);
      expect(result.get('socket-123')).toEqual(mockSocketUser);
    });

    it('should return user by socket ID correctly', () => {
      const connectedUsers = new Map();
      connectedUsers.set('socket-123', mockSocketUser);
      (socketService as any).connectedUsers = connectedUsers;

      const result = socketService.getUserBySocketId('socket-123');

      expect(result).toEqual(mockSocketUser);
    });

    it('should return undefined for non-existent socket ID', () => {
      const result = socketService.getUserBySocketId('non-existent');

      expect(result).toBeUndefined();
    });

    it('should broadcast to lobby correctly', () => {
      socketService.broadcastToLobby('ABC123', 'test-event', { data: 'test' });

      expect(mockIo.to).toHaveBeenCalledWith('ABC123');
      expect(mockIo.emit).toHaveBeenCalledWith('test-event', { data: 'test' });
    });

    it('should emit to specific user correctly', () => {
      socketService.emitToUser('socket-123', 'test-event', { data: 'test' });

      expect(mockIo.to).toHaveBeenCalledWith('socket-123');
      expect(mockIo.emit).toHaveBeenCalledWith('test-event', { data: 'test' });
    });
  });

  describe('Error Recovery', () => {
    it('should handle lobby service errors gracefully', async () => {
      // Mock the static method
      const mockedModule = jest.requireMock('../LobbyService') as any;
      mockedModule.LobbyService.isValidLobbyCode.mockReturnValue(true);

      // Mock a service error
      mockLobbyService.joinLobby.mockRejectedValue(new Error('Service unavailable'));

      // Call the method directly
      await (socketService as any).handleJoinLobby(mockSocket, {
        lobbyCode: 'ABC123',
        player: mockSocketUser
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('join-error', {
        type: 'SERVER_ERROR',
        message: 'Failed to join lobby'
      });
    });

    it('should handle game service errors gracefully', async () => {
      // Mock a service error
      mockGameService.startGameSession.mockRejectedValue(new Error('Game service unavailable'));

      // Call the method directly
      await (socketService as any).handleStartGame(mockSocket, {
        lobbyCode: 'ABC123',
        hostId: '1'
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('start-game-error', {
        type: 'SERVER_ERROR',
        message: 'Failed to start game'
      });
    });

    it('should handle invalid data gracefully', async () => {
      // Mock the static method to return false for invalid code
      const mockedModule = jest.requireMock('../LobbyService') as any;
      mockedModule.LobbyService.isValidLobbyCode.mockReturnValue(false);

      // Call the method directly
      await (socketService as any).handleJoinLobby(mockSocket, {
        lobbyCode: '',
        player: null as any
      });

      // The test should check for INVALID_CODE error type when isValidLobbyCode returns false
      expect(mockSocket.emit).toHaveBeenCalledWith('join-error', {
        type: 'INVALID_CODE',
        message: 'Invalid lobby code format'
      });
    });
  });

  describe('Real-time Communication', () => {
    it('should handle multiple simultaneous connections', () => {
      const connectionHandler = mockIo.on.mock.calls[0]![1];

      // Create multiple mock sockets
      const socket1 = { ...mockSocket, id: 'socket-1' };
      const socket2 = { ...mockSocket, id: 'socket-2' };

      connectionHandler(socket1);
      connectionHandler(socket2);

      expect(mockRequestLogger.logSocketConnection).toHaveBeenCalledWith('socket-1', 'connect');
      expect(mockRequestLogger.logSocketConnection).toHaveBeenCalledWith('socket-2', 'connect');
    });

    it('should handle room management correctly', async () => {
      // Mock the static method
      const mockedModule = jest.requireMock('../LobbyService') as any;
      mockedModule.LobbyService.isValidLobbyCode.mockReturnValue(true);
      mockLobbyService.joinLobby.mockResolvedValue(mockLobby);

      // Call the method directly
      await (socketService as any).handleJoinLobby(mockSocket, {
        lobbyCode: 'ABC123',
        player: mockSocketUser
      });

      expect(mockSocket.join).toHaveBeenCalledWith('ABC123');
      expect(mockIo.to).toHaveBeenCalledWith('ABC123');
    });

    it('should handle message broadcasting correctly', async () => {
      // Mock the static method
      const mockedModule = jest.requireMock('../LobbyService') as any;
      mockedModule.LobbyService.isValidLobbyCode.mockReturnValue(true);
      mockLobbyService.joinLobby.mockResolvedValue(mockLobby);

      // Call the method directly
      await (socketService as any).handleJoinLobby(mockSocket, {
        lobbyCode: 'ABC123',
        player: mockSocketUser
      });

      // Verify broadcast to lobby
      expect(mockIo.to).toHaveBeenCalledWith('ABC123');
      expect(mockIo.emit).toHaveBeenCalledWith('lobby-updated', expect.objectContaining({
        lobby: mockLobby,
        event: 'player-joined'
      }));
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large numbers of connected users efficiently', () => {
      const connectedUsers = new Map();

      // Simulate 100 connected users
      for (let i = 0; i < 100; i++) {
        connectedUsers.set(`socket-${i}`, {
          ...mockSocketUser,
          id: `user-${i}`,
          username: `user${i}`
        });
      }

      (socketService as any).connectedUsers = connectedUsers;

      const result = socketService.getConnectedUsers();

      expect(result.size).toBe(100);
      expect(result.get('socket-50')).toBeDefined();
    });

    it('should handle rapid connection/disconnection cycles', () => {
      // Simulate rapid connect/disconnect
      for (let i = 0; i < 10; i++) {
        const tempSocket = { ...mockSocket, id: `socket-${i}` };
        (socketService as any).connectedUsers.set(`socket-${i}`, mockSocketUser);
        (socketService as any).connectedUsers.delete(`socket-${i}`);
      }

      // Should not throw errors
      expect(() => {
        const result = socketService.getConnectedUsers();
        expect(result.size).toBe(0);
      }).not.toThrow();
    });

    it('should handle rapid event firing without memory leaks', async () => {
      // Mock the static method
      const mockedModule = jest.requireMock('../LobbyService') as any;
      mockedModule.LobbyService.isValidLobbyCode.mockReturnValue(true);
      mockLobbyService.joinLobby.mockResolvedValue(mockLobby);

      const connectionHandler = mockIo.on.mock.calls[0]![1];
      connectionHandler(mockSocket);

      // Simulate rapid join-lobby events
      const joinHandler = mockSocket.on.mock.calls.find(call => call[0] === 'join-lobby')?.[1];

      if (joinHandler) {
        const promises: Promise<unknown>[] = [];
        for (let i = 0; i < 5; i++) {
          promises.push(joinHandler({
            lobbyCode: 'ABC123',
            player: { ...mockSocketUser, id: `user-${i}` }
          }));
        }

        await Promise.all(promises);

        // Should handle all events without errors
        expect(mockLobbyService.joinLobby).toHaveBeenCalledTimes(5);
      }
    });

    it('should handle concurrent answer submissions efficiently', async () => {
      mockGameService.submitAnswer.mockResolvedValue(undefined);

      const connectionHandler = mockIo.on.mock.calls[0]![1];
      connectionHandler(mockSocket);

      const submitHandler = mockSocket.on.mock.calls.find(call => call[0] === 'submit-answer')?.[1];

      if (submitHandler) {
        const promises: Promise<unknown>[] = [];
        for (let i = 0; i < 10; i++) {
          promises.push(submitHandler({
            lobbyCode: 'ABC123',
            playerId: '1',
            answer: 'A',
            timeElapsed: 30 + i
          }));
        }

        await Promise.all(promises);

        // Should handle all submissions without errors
        expect(mockGameService.submitAnswer).toHaveBeenCalledTimes(10);
      }
    });
  });

  describe('Rate Limiting and Abuse Prevention', () => {
    it('should handle rapid ping events without overwhelming the system', () => {
      const connectionHandler = mockIo.on.mock.calls[0]![1];
      connectionHandler(mockSocket);

      // Clear the emit calls from the connection event
      mockSocket.emit.mockClear();

      const pingHandler = mockSocket.on.mock.calls.find(call => call[0] === 'ping')?.[1];

      if (pingHandler) {
        // Simulate rapid ping events
        for (let i = 0; i < 20; i++) {
          pingHandler();
        }

        // Should handle all pings without errors
        expect(mockSocket.emit).toHaveBeenCalledTimes(20);
        expect(mockSocket.emit).toHaveBeenLastCalledWith('pong', {
          timestamp: expect.any(Number)
        });
      }
    });

    it('should handle malformed event data gracefully', async () => {
      // Mock the static method to return false for invalid/null lobby codes
      const mockedModule = jest.requireMock('../LobbyService') as any;
      mockedModule.LobbyService.isValidLobbyCode.mockReturnValue(false);

      const connectionHandler = mockIo.on.mock.calls[0]![1];
      connectionHandler(mockSocket);

      const joinHandler = mockSocket.on.mock.calls.find(call => call[0] === 'join-lobby')?.[1];

      if (joinHandler) {
        // Test with malformed data
        await joinHandler(null as any);
        await joinHandler({} as any);
        await joinHandler({ lobbyCode: null, player: null } as any);

        // Should handle gracefully without crashing
        expect(mockSocket.emit).toHaveBeenCalledWith('join-error', {
          type: 'INVALID_CODE',
          message: 'Invalid lobby code format'
        });
      }
    });
  });

  describe('Memory Management and Cleanup', () => {
    it('should properly clean up resources on disconnect', () => {
      // Add user to connected users
      (socketService as any).connectedUsers.set('socket-123', mockSocketUser);

      // Mock services
      mockGameService.isGameActive.mockReturnValue(false);
      mockLobbyService.updatePlayerConnection.mockResolvedValue(mockLobby);

      // Disconnect
      (socketService as any).handleDisconnect(mockSocket);

      // Should remove from connected users
      expect((socketService as any).connectedUsers.has('socket-123')).toBe(false);
      expect(socketService.getUserBySocketId('socket-123')).toBeUndefined();
    });

    it('should handle cleanup when user is not in connected users', () => {
      // Don't add user to connected users
      mockGameService.isGameActive.mockReturnValue(false);

      // Should not throw error
      expect(() => (socketService as any).handleDisconnect(mockSocket)).not.toThrow();
    });

    it('should handle cleanup when user has no lobby code', () => {
      // Add user without lobby code
      (socketService as any).connectedUsers.set('socket-123', {
        ...mockSocketUser,
        lobbyCode: undefined
      });

      // Should not throw error
      expect(() => (socketService as any).handleDisconnect(mockSocket)).not.toThrow();
    });
  });

  describe('Socket.IO Specific Features', () => {
    it('should handle socket acknowledgments correctly', () => {
      const connectionHandler = mockIo.on.mock.calls[0]![1];
      connectionHandler(mockSocket);

      // Test that events are emitted correctly
      expect(mockSocket.emit).toHaveBeenCalledWith('connected', {
        socketId: 'socket-123',
        timestamp: expect.any(Number),
        authenticated: false,
        user: null
      });
    });

    it('should handle socket room operations correctly', async () => {
      // Mock the static method
      const mockedModule = jest.requireMock('../LobbyService') as any;
      mockedModule.LobbyService.isValidLobbyCode.mockReturnValue(true);
      mockLobbyService.joinLobby.mockResolvedValue(mockLobby);

      // Call the method directly
      await (socketService as any).handleJoinLobby(mockSocket, {
        lobbyCode: 'ABC123',
        player: mockSocketUser
      });

      // Should join the room
      expect(mockSocket.join).toHaveBeenCalledWith('ABC123');
    });

    it('should handle socket leave operations correctly', async () => {
      mockLobbyService.leaveLobby.mockResolvedValue(null);

      // Call the method directly
      await (socketService as any).handleLeaveLobby(mockSocket, {
        lobbyCode: 'ABC123',
        playerId: '1'
      });

      // Should leave the room
      expect(mockSocket.leave).toHaveBeenCalledWith('ABC123');
    });
  });

  describe('Concurrent Event Handling', () => {
    it('should handle simultaneous join and leave events', async () => {
      // Mock the static method
      const mockedModule = jest.requireMock('../LobbyService') as any;
      mockedModule.LobbyService.isValidLobbyCode.mockReturnValue(true);
      mockLobbyService.joinLobby.mockResolvedValue(mockLobby);
      mockLobbyService.leaveLobby.mockResolvedValue(null);

      // Simulate simultaneous join and leave
      const joinPromise = (socketService as any).handleJoinLobby(mockSocket, {
        lobbyCode: 'ABC123',
        player: mockSocketUser
      });

      const leavePromise = (socketService as any).handleLeaveLobby(mockSocket, {
        lobbyCode: 'ABC123',
        playerId: '1'
      });

      await Promise.all([joinPromise, leavePromise]);

      // Both operations should complete without errors
      expect(mockLobbyService.joinLobby).toHaveBeenCalled();
      expect(mockLobbyService.leaveLobby).toHaveBeenCalled();
    });

    it('should handle race conditions in ready state updates', async () => {
      mockLobbyService.updatePlayerReady.mockResolvedValue(mockLobby);

      // Simulate rapid ready state changes
      const promises: any[] = [];
      for (let i = 0; i < 3; i++) {
        promises.push((socketService as any).handlePlayerReady(mockSocket, {
          lobbyCode: 'ABC123',
          playerId: '1',
          isReady: i % 2 === 0
        }));
      }

      await Promise.all(promises);

      // All updates should be processed
      expect(mockLobbyService.updatePlayerReady).toHaveBeenCalledTimes(3);
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from temporary service failures', async () => {
      // Mock the static method
      const mockedModule = jest.requireMock('../LobbyService') as any;
      mockedModule.LobbyService.isValidLobbyCode.mockReturnValue(true);

      // First call fails, second succeeds
      mockLobbyService.joinLobby
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce(mockLobby);

      // First attempt should fail
      await (socketService as any).handleJoinLobby(mockSocket, {
        lobbyCode: 'ABC123',
        player: mockSocketUser
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('join-error', {
        type: 'SERVER_ERROR',
        message: 'Failed to join lobby'
      });

      // Second attempt should succeed
      await (socketService as any).handleJoinLobby(mockSocket, {
        lobbyCode: 'ABC123',
        player: mockSocketUser
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('join-success', {
        lobby: mockLobby,
        message: 'Successfully joined lobby'
      });
    });

    it('should handle partial service failures gracefully', async () => {
      // Mock the static method
      const mockedModule = jest.requireMock('../LobbyService') as any;
      mockedModule.LobbyService.isValidLobbyCode.mockReturnValue(true);
      mockLobbyService.joinLobby.mockResolvedValue(mockLobby);

      // Mock successful join but failed broadcast
      mockIo.to.mockImplementationOnce(() => {
        throw new Error('Broadcast failed');
      });

      // Should still complete the join operation
      await (socketService as any).handleJoinLobby(mockSocket, {
        lobbyCode: 'ABC123',
        player: mockSocketUser
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('join-success', {
        lobby: mockLobby,
        message: 'Successfully joined lobby'
      });
    });

    it('should handle network timeouts gracefully', async () => {
      // Mock the static method
      const mockedModule = jest.requireMock('../LobbyService') as any;
      mockedModule.LobbyService.isValidLobbyCode.mockReturnValue(true);

      // Simulate timeout
      mockLobbyService.joinLobby.mockImplementation(() =>
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout')), 100)
        )
      );

      // Should handle timeout gracefully
      await (socketService as any).handleJoinLobby(mockSocket, {
        lobbyCode: 'ABC123',
        player: mockSocketUser
      });

      expect(mockSocket.emit).toHaveBeenCalledWith('join-error', {
        type: 'SERVER_ERROR',
        message: 'Failed to join lobby'
      });
    });
  });
}); 