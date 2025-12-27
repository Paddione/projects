import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import {
  RequestLogger,
  LogEntry,
  requestLogger,
  errorLogger,
  logSocketConnection,
  logSocketEvent,
  logDatabaseQuery,
  logAuthEvent,
  logGameEvent
} from '../logging.js';

// Console spies (initialized per-test to avoid cross-file restore issues)
let mockConsoleLog: jest.SpyInstance<any, any>;
let mockConsoleError: jest.SpyInstance<any, any>;
let mockConsoleWarn: jest.SpyInstance<any, any>;

describe('LoggingMiddleware', () => {
  interface MockUser {
    userId: number;
    username: string;
    email: string;
    selectedCharacter: string;
    characterLevel: number;
    isAdmin: boolean;
  }

  interface MockConnection {
    remoteAddress: string;
  }

  let mockRequest: Partial<Request> & { user?: MockUser; correlationId?: string; connection?: MockConnection };
  let mockResponse: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Recreate console spies for each test
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    // Create mock request
    mockRequest = {
      method: 'GET',
      url: '/api/test',
      ip: '192.168.1.1',
      connection: ({ remoteAddress: '192.168.1.1' } as unknown) as any,
      get: jest.fn().mockReturnValue('Mozilla/5.0 Test Browser'),
      user: {
        userId: 123,
        username: 'testuser',
        email: 'test@example.com',
        selectedCharacter: 'wizard',
        characterLevel: 1,
        isAdmin: false
      }
    };

    // Create mock response with matching method signatures
    mockResponse = {
      statusCode: 200,
      end: ((..._args: any[]) => (mockResponse as Response)) as any,
      status: ((code: number) => (mockResponse as Response)) as any
    };

    // Create mock next function
    mockNext = jest.fn();
  });

  // Note: do not restoreAllMocks here, as it would remove our console spies for subsequent tests
  afterEach(() => {
    // Keep spies active across tests; only reset call counts in beforeEach
  });

  describe('RequestLogger.log', () => {
    it('should log request start with correct information', () => {
      // Act
      RequestLogger.log(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockConsoleLog).toHaveBeenCalledWith('📥 Request:', {
        method: 'GET',
        url: '/api/test',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser',
        userId: 123,
        correlationId: undefined,
        timestamp: expect.any(String)
      });
      expect(mockNext).toHaveBeenCalled();
    });

    it('should log request without user when user is not authenticated', () => {
      // Arrange
      mockRequest.user = undefined;

      // Act
      RequestLogger.log(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockConsoleLog).toHaveBeenCalledWith('📥 Request:', {
        method: 'GET',
        url: '/api/test',
        ip: '192.168.1.1',
        userAgent: 'Mozilla/5.0 Test Browser',
        userId: undefined,
        correlationId: undefined,
        timestamp: expect.any(String)
      });
    });

    it('should log response with success emoji for 2xx status codes', () => {
      // Arrange
      mockResponse.statusCode = 200;

      // Act
      RequestLogger.log(mockRequest as Request, mockResponse as Response, mockNext);
      
      // Simulate response end
      const originalEnd = mockResponse.end;
      if (typeof originalEnd === 'function') {
        originalEnd();
      }

      // Assert
      expect(mockConsoleLog).toHaveBeenCalledWith('✅ Response:', {
        method: 'GET',
        url: '/api/test',
        statusCode: 200,
        responseTime: expect.stringMatching(/\d+ms/),
        ip: '192.168.1.1',
        userId: 123,
        correlationId: undefined,
        timestamp: expect.any(String)
      });
    });

    it('should log response with error emoji for 4xx/5xx status codes', () => {
      // Arrange
      mockResponse.statusCode = 404;

      // Act
      RequestLogger.log(mockRequest as Request, mockResponse as Response, mockNext);
      
      // Simulate response end
      const originalEnd = mockResponse.end;
      if (typeof originalEnd === 'function') {
        originalEnd();
      }

      // Assert
      expect(mockConsoleLog).toHaveBeenCalledWith('❌ Response:', {
        method: 'GET',
        url: '/api/test',
        statusCode: 404,
        responseTime: expect.stringMatching(/\d+ms/),
        ip: '192.168.1.1',
        userId: 123,
        correlationId: undefined,
        timestamp: expect.any(String)
      });
    });

    it('should log slow request warning for responses over 1 second', (done) => {
      // Arrange
      jest.useFakeTimers();

      // Act
      RequestLogger.log(mockRequest as Request, mockResponse as Response, mockNext);
      
      // Advance time by 1.1 seconds
      jest.advanceTimersByTime(1100);
      
      // Simulate response end
      const originalEnd = mockResponse.end;
      if (typeof originalEnd === 'function') {
        originalEnd();
      }

      // Assert
      expect(mockConsoleWarn).toHaveBeenCalledWith('🐌 Slow Request:', {
        method: 'GET',
        url: '/api/test',
        responseTime: '1100ms',
        statusCode: 200,
        correlationId: undefined
      });

      jest.useRealTimers();
      done();
    });

    it('should handle missing IP address gracefully', () => {
      // Arrange
      (mockRequest as any).ip = undefined;
      (mockRequest as any).connection = undefined;

      // Act
      RequestLogger.log(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockConsoleLog).toHaveBeenCalledWith('📥 Request:', {
        method: 'GET',
        url: '/api/test',
        ip: 'unknown',
        userAgent: 'Mozilla/5.0 Test Browser',
        userId: 123,
        correlationId: undefined,
        timestamp: expect.any(String)
      });
    });

    it('should handle missing user agent gracefully', () => {
      // Arrange
      (mockRequest.get as jest.Mock).mockReturnValue(undefined);

      // Act
      RequestLogger.log(mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockConsoleLog).toHaveBeenCalledWith('📥 Request:', {
        method: 'GET',
        url: '/api/test',
        ip: '192.168.1.1',
        userAgent: undefined,
        userId: 123,
        correlationId: undefined,
        timestamp: expect.any(String)
      });
    });
  });

  describe('RequestLogger.logError', () => {
    it('should log error with correct information', () => {
      // Arrange
      const testError = new Error('Test error message');

      // Act
      RequestLogger.logError(testError, mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockConsoleError).toHaveBeenCalledWith('💥 Error:', {
        message: testError.message,
        stack: testError.stack,
        method: 'GET',
        url: '/api/test',
        ip: '192.168.1.1',
        userId: 123,
        correlationId: undefined,
        timestamp: expect.any(String)
      });
      expect(mockNext).toHaveBeenCalledWith(testError);
    });

    it('should log error without user when user is not authenticated', () => {
      // Arrange
      const testError = new Error('Test error message');
      (mockRequest as any).user = undefined;

      // Act
      RequestLogger.logError(testError, mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockConsoleError).toHaveBeenCalledWith('💥 Error:', {
        message: testError.message,
        stack: testError.stack,
        method: 'GET',
        url: '/api/test',
        ip: '192.168.1.1',
        userId: undefined,
        correlationId: undefined,
        timestamp: expect.any(String)
      });
    });

    it('should handle missing IP address in error logging', () => {
      // Arrange
      const testError = new Error('Test error message');
      (mockRequest as any).ip = undefined;
      (mockRequest as any).connection = undefined;

      // Act
      RequestLogger.logError(testError, mockRequest as Request, mockResponse as Response, mockNext);

      // Assert
      expect(mockConsoleError).toHaveBeenCalledWith('💥 Error:', {
        message: testError.message,
        stack: testError.stack,
        method: 'GET',
        url: '/api/test',
        ip: 'unknown',
        userId: 123,
        correlationId: undefined,
        timestamp: expect.any(String)
      });
    });
  });

  describe('RequestLogger.logSocketConnection', () => {
    it('should log socket connection with connect emoji', () => {
      // Act
      RequestLogger.logSocketConnection('socket123', 'connect', 456);

      // Assert
      expect(mockConsoleLog).toHaveBeenCalledWith('🔌 Socket connect:', {
        socketId: 'socket123',
        userId: 456,
        timestamp: expect.any(String)
      });
    });

    it('should log socket disconnection with disconnect emoji', () => {
      // Act
      RequestLogger.logSocketConnection('socket123', 'disconnect', 456);

      // Assert
      expect(mockConsoleLog).toHaveBeenCalledWith('🔌❌ Socket disconnect:', {
        socketId: 'socket123',
        userId: 456,
        timestamp: expect.any(String)
      });
    });

    it('should log socket connection without user ID', () => {
      // Act
      RequestLogger.logSocketConnection('socket123', 'connect');

      // Assert
      expect(mockConsoleLog).toHaveBeenCalledWith('🔌 Socket connect:', {
        socketId: 'socket123',
        userId: undefined,
        timestamp: expect.any(String)
      });
    });
  });

  describe('RequestLogger.logSocketEvent', () => {
    it('should log socket event with data size', () => {
      // Arrange
      const eventData = { message: 'test', value: 123 };

      // Act
      RequestLogger.logSocketEvent('socket123', 'message', eventData, 456);

      // Assert
      expect(mockConsoleLog).toHaveBeenCalledWith('📡 Socket Event:', {
        socketId: 'socket123',
        event: 'message',
        userId: 456,
        dataSize: JSON.stringify(eventData).length,
        timestamp: expect.any(String)
      });
    });

    it('should log socket event without data', () => {
      // Act
      RequestLogger.logSocketEvent('socket123', 'ping', undefined, 456);

      // Assert
      expect(mockConsoleLog).toHaveBeenCalledWith('📡 Socket Event:', {
        socketId: 'socket123',
        event: 'ping',
        userId: 456,
        dataSize: 0,
        timestamp: expect.any(String)
      });
    });

    it('should log socket event without user ID', () => {
      // Act
      RequestLogger.logSocketEvent('socket123', 'message', { test: 'data' });

      // Assert
      expect(mockConsoleLog).toHaveBeenCalledWith('📡 Socket Event:', {
        socketId: 'socket123',
        event: 'message',
        userId: undefined,
        dataSize: JSON.stringify({ test: 'data' }).length,
        timestamp: expect.any(String)
      });
    });
  });

  describe('RequestLogger.logDatabaseQuery', () => {
    it('should log database query with parameters and duration', () => {
      // Arrange
      const query = 'SELECT * FROM users WHERE id = ? AND active = ?';
      const params = [123, true];
      const duration = 45;

      // Act
      RequestLogger.logDatabaseQuery(query, params, duration);

      // Assert
      expect(mockConsoleLog).toHaveBeenCalledWith('🗄️ Database Query:', {
        query: 'SELECT * FROM users WHERE id = ? AND active = ?',
        paramCount: 2,
        duration: '45ms',
        timestamp: expect.any(String)
      });
    });

    it('should log database query without parameters', () => {
      // Arrange
      const query = 'SELECT COUNT(*) FROM users';

      // Act
      RequestLogger.logDatabaseQuery(query);

      // Assert
      expect(mockConsoleLog).toHaveBeenCalledWith('🗄️ Database Query:', {
        query: 'SELECT COUNT(*) FROM users',
        paramCount: 0,
        duration: undefined,
        timestamp: expect.any(String)
      });
    });

    it('should truncate long queries', () => {
      // Arrange
      const longQuery = 'SELECT * FROM users WHERE id = ? AND active = ? AND created_at > ? AND updated_at < ? AND email LIKE ? AND username LIKE ? AND status = ? AND role = ? AND last_login > ? AND login_count > ?';
      const params = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

      // Act
      RequestLogger.logDatabaseQuery(longQuery, params, 100);

      // Assert
      expect(mockConsoleLog).toHaveBeenCalledWith('🗄️ Database Query:', {
        query: expect.stringMatching(/^.{100}\.\.\.$/),
        paramCount: 10,
        duration: '100ms',
        timestamp: expect.any(String)
      });
    });
  });

  describe('RequestLogger.logAuthEvent', () => {
    it('should log login event with correct emoji', () => {
      // Act
      RequestLogger.logAuthEvent('login', 123, '192.168.1.1');

      // Assert
      expect(mockConsoleLog).toHaveBeenCalledWith('🔐 Auth Event:', {
        event: 'login',
        userId: 123,
        ip: '192.168.1.1',
        timestamp: expect.any(String)
      });
    });

    it('should log logout event with correct emoji', () => {
      // Act
      RequestLogger.logAuthEvent('logout', 123, '192.168.1.1');

      // Assert
      expect(mockConsoleLog).toHaveBeenCalledWith('🔓 Auth Event:', {
        event: 'logout',
        userId: 123,
        ip: '192.168.1.1',
        timestamp: expect.any(String)
      });
    });

    it('should log register event with correct emoji', () => {
      // Act
      RequestLogger.logAuthEvent('register', 123, '192.168.1.1');

      // Assert
      expect(mockConsoleLog).toHaveBeenCalledWith('👤 Auth Event:', {
        event: 'register',
        userId: 123,
        ip: '192.168.1.1',
        timestamp: expect.any(String)
      });
    });

    it('should log token refresh event with correct emoji', () => {
      // Act
      RequestLogger.logAuthEvent('token_refresh', 123, '192.168.1.1');

      // Assert
      expect(mockConsoleLog).toHaveBeenCalledWith('🔄 Auth Event:', {
        event: 'token_refresh',
        userId: 123,
        ip: '192.168.1.1',
        timestamp: expect.any(String)
      });
    });

    it('should log auth event without user ID and IP', () => {
      // Act
      RequestLogger.logAuthEvent('login');

      // Assert
      expect(mockConsoleLog).toHaveBeenCalledWith('🔐 Auth Event:', {
        event: 'login',
        userId: undefined,
        ip: undefined,
        timestamp: expect.any(String)
      });
    });
  });

  describe('RequestLogger.logGameEvent', () => {
    it('should log game event with all parameters', () => {
      // Arrange
      const gameData = { score: 100, timeElapsed: 30 };

      // Act
      RequestLogger.logGameEvent('answer_submitted', 'ABC123', 456, gameData);

      // Assert
      expect(mockConsoleLog).toHaveBeenCalledWith('🎮 Game Event:', {
        event: 'answer_submitted',
        lobbyCode: 'ABC123',
        userId: 456,
        dataSize: JSON.stringify(gameData).length,
        timestamp: expect.any(String)
      });
    });

    it('should log game event without data', () => {
      // Act
      RequestLogger.logGameEvent('player_joined', 'ABC123', 456);

      // Assert
      expect(mockConsoleLog).toHaveBeenCalledWith('🎮 Game Event:', {
        event: 'player_joined',
        lobbyCode: 'ABC123',
        userId: 456,
        dataSize: 0,
        timestamp: expect.any(String)
      });
    });

    it('should log game event without lobby code and user ID', () => {
      // Act
      RequestLogger.logGameEvent('game_started');

      // Assert
      expect(mockConsoleLog).toHaveBeenCalledWith('🎮 Game Event:', {
        event: 'game_started',
        lobbyCode: undefined,
        userId: undefined,
        dataSize: 0,
        timestamp: expect.any(String)
      });
    });
  });

  describe('Exported convenience functions', () => {
    it('should export requestLogger function', () => {
      expect(typeof requestLogger).toBe('function');
    });

    it('should export errorLogger function', () => {
      expect(typeof errorLogger).toBe('function');
    });

    it('should export logSocketConnection function', () => {
      expect(typeof logSocketConnection).toBe('function');
    });

    it('should export logSocketEvent function', () => {
      expect(typeof logSocketEvent).toBe('function');
    });

    it('should export logDatabaseQuery function', () => {
      expect(typeof logDatabaseQuery).toBe('function');
    });

    it('should export logAuthEvent function', () => {
      expect(typeof logAuthEvent).toBe('function');
    });

    it('should export logGameEvent function', () => {
      expect(typeof logGameEvent).toBe('function');
    });
  });

  describe('LogEntry interface', () => {
    it('should define correct LogEntry structure', () => {
      const logEntry: LogEntry = {
        timestamp: '2023-01-01T00:00:00.000Z',
        method: 'GET',
        url: '/api/test',
        statusCode: 200,
        responseTime: 100,
        ip: '192.168.1.1',
        userAgent: 'Test Browser',
        userId: 123,
        error: 'Test error'
      };

      expect(logEntry.timestamp).toBe('2023-01-01T00:00:00.000Z');
      expect(logEntry.method).toBe('GET');
      expect(logEntry.url).toBe('/api/test');
      expect(logEntry.statusCode).toBe(200);
      expect(logEntry.responseTime).toBe(100);
      expect(logEntry.ip).toBe('192.168.1.1');
      expect(logEntry.userAgent).toBe('Test Browser');
      expect(logEntry.userId).toBe(123);
      expect(logEntry.error).toBe('Test error');
    });
  });
}); 
