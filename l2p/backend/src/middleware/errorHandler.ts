import { Request, Response, NextFunction } from 'express';
// Temporarily commented out to fix compilation issues
// import { errorHandler as centralErrorHandler } from '../../shared/error-handling/dist/index.js';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export class ErrorHandler {
  /**
   * Global error handling middleware
   */
  static handle = (err: ApiError, req: Request, res: Response, next: NextFunction): void => {
    // Use centralized error handler

    // Explicit API error logging for tests
    try {
      console.error('API Error:', {
        message: err?.message,
        stack: err?.stack,
        url: req.url,
        method: req.method,
        ip: req.ip || (req as any).connection?.remoteAddress || 'unknown',
        ...(req.get('User-Agent') ? { userAgent: req.get('User-Agent') as string } : {}),
        timestamp: new Date().toISOString()
      });
    } catch { }

    // Temporarily disabled during development
    // centralErrorHandler.handleError(err, {
    //   userId: (req as any).user?.userId,
    //   sessionId: (req as any).session?.id || (req as any).cookies?.sessionId,
    //   requestId: (req as any).correlationId,
    //   ip: req.ip || (req as any).connection?.remoteAddress,
    //   userAgent: req.get('User-Agent'),
    //   url: req.url,
    //   method: req.method,
    //   metadata: { correlationId: (req as any).correlationId }
    // }).catch((handlingError: any) => {
    
    // Simple error logging for development
    console.error('API Error:', {
      message: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method
    });
    
    // Error handling completed

    // Database connection errors
    // Access message first so null errors surface as expected in tests
    if (err.message?.includes('database') || err.code === 'ECONNREFUSED') {
      res.status(503).json({
        error: 'Service Unavailable',
        message: 'Database connection failed',
        code: 'DATABASE_ERROR',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // JWT authentication errors
    if (err.name === 'JsonWebTokenError') {
      res.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid or expired token',
        code: 'TOKEN_ERROR',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Validation errors
    if (err.name === 'ValidationError') {
      res.status(400).json({
        error: 'Validation Failed',
        message: err.message,
        code: 'VALIDATION_ERROR',
        details: err.details,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Rate limiting errors
    if (err.message?.includes('Too many requests')) {
      res.status(429).json({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded, please try again later',
        code: 'RATE_LIMIT_ERROR',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Socket.IO errors
    if (err.message?.includes('socket') || err.message?.includes('websocket')) {
      res.status(500).json({
        error: 'WebSocket Error',
        message: 'Real-time communication error',
        code: 'WEBSOCKET_ERROR',
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Custom API errors with status codes
    if (err.statusCode) {
      res.status(err.statusCode).json({
        error: err.name || 'API Error',
        message: err.message,
        code: err.code || 'CUSTOM_ERROR',
        details: err.details,
        timestamp: new Date().toISOString()
      });
      return;
    }

    // Default server error
    res.status(500).json({
      error: 'Internal Server Error',
      message: process.env['NODE_ENV'] === 'production'
        ? 'An unexpected error occurred'
        : err.message,
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
      ...(process.env['NODE_ENV'] !== 'production' && { stack: err.stack })
    });
  };

  /**
   * 404 Not Found handler
   */
  static notFound = (req: Request, res: Response): void => {
    res.status(404).json({
      error: 'Not Found',
      message: `Route ${req.method} ${req.url} not found`,
      code: 'ROUTE_NOT_FOUND',
      timestamp: new Date().toISOString()
    });
  };

  /**
   * Async error wrapper to catch async errors in route handlers
   */
  static asyncHandler = (fn: Function) => {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = fn(req, res, next);
        if (result instanceof Promise) {
          result.catch(next);
        }
      } catch (error) {
        next(error);
      }
    };
  };
}

/**
 * Custom error classes for different types of errors
 */
export class ValidationError extends Error implements ApiError {
  statusCode = 400;
  code = 'VALIDATION_ERROR';
  details: any;

  constructor(message: string, details?: any) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

export class AuthenticationError extends Error implements ApiError {
  statusCode = 401;
  code = 'AUTHENTICATION_ERROR';

  constructor(message: string = 'Authentication required') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends Error implements ApiError {
  statusCode = 403;
  code = 'AUTHORIZATION_ERROR';

  constructor(message: string = 'Access denied') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends Error implements ApiError {
  statusCode = 404;
  code = 'NOT_FOUND_ERROR';

  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error implements ApiError {
  statusCode = 409;
  code = 'CONFLICT_ERROR';

  constructor(message: string = 'Resource conflict') {
    super(message);
    this.name = 'ConflictError';
  }
}

export class DatabaseError extends Error implements ApiError {
  statusCode = 503;
  code = 'DATABASE_ERROR';

  constructor(message: string = 'Database operation failed') {
    super(message);
    this.name = 'DatabaseError';
  }
}

// Export convenience functions
export const asyncHandler = ErrorHandler.asyncHandler;
export const errorHandler = ErrorHandler.handle;
export const notFoundHandler = ErrorHandler.notFound;
