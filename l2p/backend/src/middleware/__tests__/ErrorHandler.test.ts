import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, jest } from '@jest/globals';
import { Request, Response, NextFunction } from 'express';
import { 
  ErrorHandler, 
  ApiError, 
  ValidationError, 
  AuthenticationError, 
  AuthorizationError, 
  NotFoundError, 
  ConflictError, 
  DatabaseError 
} from '../errorHandler.js';

// Mock console.error to avoid noise in tests
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
});

describe('ErrorHandler', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Create mock request
    mockRequest = {
      url: '/api/test',
      method: 'GET',
      ip: '127.0.0.1',
      get: ((name: any) => 'Mozilla/5.0 Test Browser') as any
    };

    // Create mock response with proper Jest mocks
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    } as any;

    // Create mock next function
    mockNext = jest.fn();

    // Reset environment
    delete process.env.NODE_ENV;
  });

  describe('handle - Database Errors', () => {
    it('should handle database connection refused errors', () => {
      const error = new Error('Connection refused') as ApiError;
      error.code = 'ECONNREFUSED';

      ErrorHandler.handle(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Service Unavailable',
        message: 'Database connection failed',
        code: 'DATABASE_ERROR',
        timestamp: expect.any(String)
      });
    });

    it('should handle database-related error messages', () => {
      const error = new Error('Unable to connect to database server');

      ErrorHandler.handle(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(503);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Service Unavailable',
        message: 'Database connection failed',
        code: 'DATABASE_ERROR',
        timestamp: expect.any(String)
      });
    });
  });

  describe('handle - JWT Authentication Errors', () => {
    it('should handle JsonWebTokenError', () => {
      const error = new Error('Invalid token') as ApiError;
      error.name = 'JsonWebTokenError';

      ErrorHandler.handle(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Authentication Failed',
        message: 'Invalid or expired token',
        code: 'TOKEN_ERROR',
        timestamp: expect.any(String)
      });
    });
  });

  describe('handle - Validation Errors', () => {
    it('should handle ValidationError', () => {
      const error = new ValidationError('Invalid input data', { field: 'email' });

      ErrorHandler.handle(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Validation Failed',
        message: 'Invalid input data',
        code: 'VALIDATION_ERROR',
        details: { field: 'email' },
        timestamp: expect.any(String)
      });
    });

    it('should handle generic ValidationError name', () => {
      const error = new Error('Validation failed') as ApiError;
      error.name = 'ValidationError';

      ErrorHandler.handle(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Validation Failed',
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: undefined,
        timestamp: expect.any(String)
      });
    });
  });

  describe('handle - Rate Limiting Errors', () => {
    it('should handle rate limiting errors', () => {
      const error = new Error('Too many requests from this IP');

      ErrorHandler.handle(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded, please try again later',
        code: 'RATE_LIMIT_ERROR',
        timestamp: expect.any(String)
      });
    });
  });

  describe('handle - WebSocket Errors', () => {
    it('should handle socket-related errors', () => {
      const error = new Error('socket connection failed');

      ErrorHandler.handle(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'WebSocket Error',
        message: 'Real-time communication error',
        code: 'WEBSOCKET_ERROR',
        timestamp: expect.any(String)
      });
    });

    it('should handle websocket-related errors', () => {
      const error = new Error('websocket handshake failed');

      ErrorHandler.handle(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'WebSocket Error',
        message: 'Real-time communication error',
        code: 'WEBSOCKET_ERROR',
        timestamp: expect.any(String)
      });
    });
  });

  describe('handle - Custom API Errors', () => {
    it('should handle custom errors with status codes', () => {
      const error = new Error('Custom error') as ApiError;
      (error as any).statusCode = 418;
      error.code = 'TEAPOT_ERROR';
      error.details = { reason: 'I am a teapot' };

      ErrorHandler.handle(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(418);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Error',
        message: 'Custom error',
        code: 'TEAPOT_ERROR',
        details: { reason: 'I am a teapot' },
        timestamp: expect.any(String)
      });
    });

    it('should handle custom errors with custom names', () => {
      const error = new Error('Custom error') as ApiError;
      error.name = 'CustomError';
      (error as any).statusCode = 422;
      error.code = 'CUSTOM_ERROR';

      ErrorHandler.handle(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(422);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'CustomError',
        message: 'Custom error',
        code: 'CUSTOM_ERROR',
        details: undefined,
        timestamp: expect.any(String)
      });
    });
  });

  describe('handle - Default Server Errors', () => {
    it('should handle generic errors in development', () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('Unexpected error occurred');

      ErrorHandler.handle(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Internal Server Error',
        message: 'Unexpected error occurred',
        code: 'INTERNAL_ERROR',
        timestamp: expect.any(String),
        stack: error.stack
      });
    });

    it('should handle generic errors in production', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Unexpected error occurred');

      ErrorHandler.handle(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Internal Server Error',
        message: 'An unexpected error occurred',
        code: 'INTERNAL_ERROR',
        timestamp: expect.any(String)
      });
    });

    it('should handle generic errors when NODE_ENV is not set', () => {
      const error = new Error('Unexpected error occurred');

      ErrorHandler.handle(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Internal Server Error',
        message: 'Unexpected error occurred',
        code: 'INTERNAL_ERROR',
        timestamp: expect.any(String),
        stack: error.stack
      });
    });
  });

  describe('notFound', () => {
    it('should return 404 error for missing routes', () => {
      ErrorHandler.notFound(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Not Found',
        message: 'Route GET /api/test not found',
        code: 'ROUTE_NOT_FOUND',
        timestamp: expect.any(String)
      });
    });

    it('should handle different HTTP methods', () => {
      mockRequest.method = 'POST';
      mockRequest.url = '/api/users';

      ErrorHandler.notFound(
        mockRequest as Request,
        mockResponse as Response
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Not Found',
        message: 'Route POST /api/users not found',
        code: 'ROUTE_NOT_FOUND',
        timestamp: expect.any(String)
      });
    });
  });

  describe('asyncHandler', () => {
    it('should handle successful async operations', async () => {
      const asyncFunction = jest.fn().mockResolvedValue('success');
      const wrappedFunction = ErrorHandler.asyncHandler(asyncFunction);

      await wrappedFunction(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(asyncFunction).toHaveBeenCalledWith(
        mockRequest,
        mockResponse,
        mockNext
      );
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should catch and pass async errors to next', async () => {
      const error = new Error('Async error');
      const asyncFunction = jest.fn().mockRejectedValue(error);
      const wrappedFunction = ErrorHandler.asyncHandler(asyncFunction);

      await wrappedFunction(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(asyncFunction).toHaveBeenCalledWith(
        mockRequest,
        mockResponse,
        mockNext
      );
      expect(mockNext).toHaveBeenCalledWith(error);
    });

    it('should handle synchronous errors in async functions', async () => {
      const error = new Error('Sync error');
      const asyncFunction = jest.fn().mockImplementation(() => {
        throw error;
      });
      const wrappedFunction = ErrorHandler.asyncHandler(asyncFunction);

      // The asyncHandler should catch synchronous errors and pass them to next
      wrappedFunction(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Wait for the promise to resolve
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('Custom Error Classes', () => {
    describe('ValidationError', () => {
      it('should create validation error with default values', () => {
        const error = new ValidationError('Invalid data');

        expect(error.name).toBe('ValidationError');
        expect(error.message).toBe('Invalid data');
        expect(error.statusCode).toBe(400);
        expect(error.code).toBe('VALIDATION_ERROR');
        expect(error.details).toBeUndefined();
      });

      it('should create validation error with details', () => {
        const details = { field: 'email', value: 'invalid' };
        const error = new ValidationError('Invalid email', details);

        expect(error.details).toEqual(details);
      });
    });

    describe('AuthenticationError', () => {
      it('should create authentication error with default message', () => {
        const error = new AuthenticationError();

        expect(error.name).toBe('AuthenticationError');
        expect(error.message).toBe('Authentication required');
        expect(error.statusCode).toBe(401);
        expect(error.code).toBe('AUTHENTICATION_ERROR');
      });

      it('should create authentication error with custom message', () => {
        const error = new AuthenticationError('Invalid credentials');

        expect(error.message).toBe('Invalid credentials');
      });
    });

    describe('AuthorizationError', () => {
      it('should create authorization error with default message', () => {
        const error = new AuthorizationError();

        expect(error.name).toBe('AuthorizationError');
        expect(error.message).toBe('Access denied');
        expect(error.statusCode).toBe(403);
        expect(error.code).toBe('AUTHORIZATION_ERROR');
      });

      it('should create authorization error with custom message', () => {
        const error = new AuthorizationError('Insufficient permissions');

        expect(error.message).toBe('Insufficient permissions');
      });
    });

    describe('NotFoundError', () => {
      it('should create not found error with default message', () => {
        const error = new NotFoundError();

        expect(error.name).toBe('NotFoundError');
        expect(error.message).toBe('Resource not found');
        expect(error.statusCode).toBe(404);
        expect(error.code).toBe('NOT_FOUND_ERROR');
      });

      it('should create not found error with custom message', () => {
        const error = new NotFoundError('User not found');

        expect(error.message).toBe('User not found');
      });
    });

    describe('ConflictError', () => {
      it('should create conflict error with default message', () => {
        const error = new ConflictError();

        expect(error.name).toBe('ConflictError');
        expect(error.message).toBe('Resource conflict');
        expect(error.statusCode).toBe(409);
        expect(error.code).toBe('CONFLICT_ERROR');
      });

      it('should create conflict error with custom message', () => {
        const error = new ConflictError('Email already exists');

        expect(error.message).toBe('Email already exists');
      });
    });

    describe('DatabaseError', () => {
      it('should create database error with default message', () => {
        const error = new DatabaseError();

        expect(error.name).toBe('DatabaseError');
        expect(error.message).toBe('Database operation failed');
        expect(error.statusCode).toBe(503);
        expect(error.code).toBe('DATABASE_ERROR');
      });

      it('should create database error with custom message', () => {
        const error = new DatabaseError('Connection timeout');

        expect(error.message).toBe('Connection timeout');
      });
    });
  });

  describe('Error Logging', () => {
    it('should log error details to console', () => {
      const error = new Error('Test error');
      error.stack = 'Error stack trace';

      ErrorHandler.handle(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(console.error).toHaveBeenCalledWith('API Error:', {
        message: 'Test error',
        stack: 'Error stack trace',
        url: '/api/test',
        method: 'GET',
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0 Test Browser',
        timestamp: expect.any(String)
      });
    });

    it('should handle errors without stack trace', () => {
      const error = new Error('Test error');
      delete error.stack;

      ErrorHandler.handle(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(console.error).toHaveBeenCalledWith('API Error:', {
        message: 'Test error',
        stack: undefined,
        url: '/api/test',
        method: 'GET',
        ip: '127.0.0.1',
        userAgent: 'Mozilla/5.0 Test Browser',
        timestamp: expect.any(String)
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle errors without message', () => {
      const error = new Error();
      error.name = 'CustomError';
      (error as any).statusCode = 400;

      ErrorHandler.handle(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'CustomError',
        message: '',
        code: 'CUSTOM_ERROR',
        details: undefined,
        timestamp: expect.any(String)
      });
    });

    it('should handle non-Error objects', () => {
      const error = 'String error' as any;

      ErrorHandler.handle(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Internal Server Error',
        message: undefined,
        code: 'INTERNAL_ERROR',
        timestamp: expect.any(String),
        stack: undefined
      });
    });

    it('should handle null errors', () => {
      const error = null as any;

      expect(() => {
        ErrorHandler.handle(
          error,
          mockRequest as Request,
          mockResponse as Response,
          mockNext
        );
      }).toThrow('Cannot read properties of null (reading \'message\')');
    });
  });

  describe('Timestamp Consistency', () => {
    it('should include consistent timestamp format', () => {
      const error = new Error('Test error');

      ErrorHandler.handle(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      const responseCall = (mockResponse.json as jest.Mock).mock.calls[0][0];
      const timestamp = responseCall.timestamp;

      expect(timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });
  });
}); 
