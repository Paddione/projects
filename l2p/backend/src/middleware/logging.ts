import { Request, Response, NextFunction } from 'express';
import { DevFileLogger } from '../utils/fileLogger.js';

export interface LogEntry {
  timestamp: string;
  method: string;
  url: string;
  statusCode?: number;
  responseTime?: number;
  ip: string;
  userAgent?: string | undefined;
  userId?: number | undefined;
  correlationId?: string | undefined;
  error?: string;
}

export class RequestLogger {
  private static get centralLoggerSafe() {
    try {
      // Use dynamic require to avoid ESM parsing issues in Jest
      const EH = require('error-handling');
      const inst = EH?.RequestLogger?.getInstance?.();
      if (inst && typeof inst === 'object') return inst;
    } catch {}
    // Fallback noop logger used in tests if shared logger is unavailable
    return {
      logInfo: () => {},
      logWarn: () => {},
      logError: () => {},
      logDebug: () => {},
    } as any;
  }
  /**
   * Request logging middleware
   */
  static log = (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();

    // Log request start
    const ip = req.ip || (req as any).connection?.remoteAddress || 'unknown';
    const correlationId = (req as any).correlationId as string | undefined;
    const logEntry: LogEntry = {
      timestamp,
      method: req.method,
      url: req.url,
      ip,
      ...(req.get('User-Agent') ? { userAgent: req.get('User-Agent') as string } : {}),
      ...((req as any).user?.userId !== undefined ? { userId: (req as any).user.userId as number } : {}),
      correlationId
    };

    // Log request start using central logger (safe)
    const httpStart = {
      method: req.method,
      url: req.url,
      ip: logEntry.ip,
      ...(logEntry.userAgent ? { userAgent: logEntry.userAgent } : {}),
      ...(logEntry.userId !== undefined ? { userId: logEntry.userId } : {}),
      correlationId
    };
    RequestLogger.centralLoggerSafe.logInfo('HTTP Request', httpStart);
    DevFileLogger.http({ ts: timestamp, phase: 'start', ...httpStart });

    // Emit console log expected by tests
    try {
      console.log('📥 Request:', {
        method: req.method,
        url: req.url,
        ip: logEntry.ip,
        userAgent: logEntry.userAgent,
        userId: logEntry.userId,
        correlationId,
        timestamp
      });
    } catch {}

    // Override res.end to capture response details
    const originalEnd = res.end.bind(res);
    res.end = function(chunk?: any, encoding?: any, cb?: () => void) {
      const responseTime = Date.now() - startTime;
      
      // Log response using central logger
      const logMethod = res.statusCode >= 400 ? 'logWarn' : 'logInfo';
      const httpEnd = {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        responseTime,
        ip: logEntry.ip,
        userId: logEntry.userId,
        correlationId
      };
      (RequestLogger.centralLoggerSafe as any)[logMethod]('HTTP Response', httpEnd);
      DevFileLogger.http({ ts: new Date().toISOString(), phase: 'end', ...httpEnd });

      // Emit console log expected by tests
      try {
        const emoji = res.statusCode >= 400 ? '❌' : '✅';
        console.log(`${emoji} Response:`, {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          responseTime: `${responseTime}ms`,
          ip: logEntry.ip,
          userId: logEntry.userId,
          correlationId,
          timestamp: new Date().toISOString()
        });
      } catch {}

      // Log slow requests (> 1 second)
      if (responseTime > 1000) {
        RequestLogger.centralLoggerSafe.logWarn('Slow HTTP Request', {
          method: req.method,
          url: req.url,
          responseTime,
          statusCode: res.statusCode,
          correlationId
        });

        try {
          console.warn('🐌 Slow Request:', {
            method: req.method,
            url: req.url,
            responseTime: `${responseTime}ms`,
            statusCode: res.statusCode,
            correlationId
          });
        } catch {}
      }

      // Call original end method
      return originalEnd(chunk, encoding, cb);
    } as any;

    next();
  };

  /**
   * Error logging middleware
   */
  static logError = (err: Error, req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || (req as any).connection?.remoteAddress || 'unknown';
    const correlationId = (req as any).correlationId as string | undefined;
    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      url: req.url,
      ip,
      userAgent: req.get('User-Agent'),
      userId: (req as any).user?.userId,
      correlationId,
      error: err.message
    };

    // Log error using central logger
    const errPayload = {
      code: 'HTTP_ERROR',
      message: err.message,
      context: {
        timestamp: logEntry.timestamp,
        environment: process.env['NODE_ENV'] || 'development',
        service: 'backend-api',
        method: req.method,
        url: req.url,
        ip: logEntry.ip,
        ...(logEntry.userId !== undefined ? { userId: logEntry.userId } : {}),
        ...(logEntry.userAgent ? { userAgent: logEntry.userAgent } : {})
      },
      severity: 'medium',
      category: 'network',
      recoverable: true,
      retryable: false,
      stack: err.stack
    };
    RequestLogger.centralLoggerSafe.logError(errPayload);
    DevFileLogger.error(errPayload);

    // Emit console error expected by tests
    try {
      console.error('💥 Error:', {
        message: err.message,
        stack: err.stack,
        method: req.method,
        url: req.url,
        ip: logEntry.ip,
        userId: logEntry.userId,
        correlationId,
        timestamp: logEntry.timestamp
      });
    } catch {}

    next(err);
  };

  /**
   * Socket.IO connection logging
   */
  static logSocketConnection = (socketId: string, event: 'connect' | 'disconnect', userId?: number): void => {
    const emoji = event === 'connect' ? '🔌' : '🔌❌';
    RequestLogger.centralLoggerSafe.logInfo(`Socket ${event}`, {
      socketId,
      userId,
      event
    });

    try {
      console.log(`${emoji} Socket ${event}:`, {
        socketId,
        userId,
        timestamp: new Date().toISOString()
      });
    } catch {}
  };

  /**
   * Socket.IO event logging
   */
  static logSocketEvent = (socketId: string, event: string, data?: any, userId?: number): void => {
    const sock = {
      socketId,
      event,
      userId,
      dataSize: data ? JSON.stringify(data).length : 0
    };
    RequestLogger.centralLoggerSafe.logInfo('Socket Event', sock);
    DevFileLogger.socket({ ts: new Date().toISOString(), ...sock });

    try {
      console.log('📡 Socket Event:', {
        socketId,
        event,
        userId,
        dataSize: data ? JSON.stringify(data).length : 0,
        timestamp: new Date().toISOString()
      });
    } catch {}
  };

  /**
   * Database query logging
   */
  static logDatabaseQuery = (query: string, params?: any[], duration?: number): void => {
    const truncated = query.substring(0, 100) + (query.length > 100 ? '...' : '');
    try { RequestLogger.centralLoggerSafe.logDebug('Database Query', { query: truncated, paramCount: params?.length || 0, duration }); } catch {}
    DevFileLogger.db({ ts: new Date().toISOString(), query: truncated, paramCount: params?.length || 0, duration });

    try {
      console.log('🗄️ Database Query:', {
        query: truncated,
        paramCount: params?.length || 0,
        duration: duration !== undefined ? `${duration}ms` : undefined,
        timestamp: new Date().toISOString()
      });
    } catch {}
  };

  /**
   * Authentication event logging
   */
  static logAuthEvent = (event: 'login' | 'logout' | 'register' | 'token_refresh', userId?: number, ip?: string): void => {
    const emoji = {
      login: '🔐',
      logout: '🔓',
      register: '👤',
      token_refresh: '🔄'
    }[event];

    try { RequestLogger.centralLoggerSafe.logInfo('Auth Event', { event, userId, ip }); } catch {}
    DevFileLogger.app('auth', { event, userId, ip });

    try {
      console.log(`${emoji} Auth Event:`, {
        event,
        userId,
        ip,
        timestamp: new Date().toISOString()
      });
    } catch {}
  };

  /**
   * Game event logging
   */
  static logGameEvent = (event: string, lobbyCode?: string, userId?: number, data?: any): void => {
    try { RequestLogger.centralLoggerSafe.logInfo('Game Event', { event, lobbyCode, userId, dataSize: data ? JSON.stringify(data).length : 0 }); } catch {}
    DevFileLogger.game({ ts: new Date().toISOString(), event, lobbyCode, userId, dataSize: data ? JSON.stringify(data).length : 0 });

    try {
      console.log('🎮 Game Event:', {
        event,
        lobbyCode,
        userId,
        dataSize: data ? JSON.stringify(data).length : 0,
        timestamp: new Date().toISOString()
      });
    } catch {}
  };
}

// Export convenience functions
export const requestLogger = RequestLogger.log;
export const errorLogger = RequestLogger.logError;
export const logSocketConnection = RequestLogger.logSocketConnection;
export const logSocketEvent = RequestLogger.logSocketEvent;
export const logDatabaseQuery = RequestLogger.logDatabaseQuery;
export const logAuthEvent = RequestLogger.logAuthEvent;
export const logGameEvent = RequestLogger.logGameEvent;

// Export logger instance for server.ts
export const logger = {
  info: (message: string, data?: any) => {
    try {
      const payload = { message, data, timestamp: new Date().toISOString() };
      console.log('ℹ️ Info:', payload);
      DevFileLogger.app('info', payload);
    } catch {}
  },
  warn: (message: string, data?: any) => {
    try {
      const payload = { message, data, timestamp: new Date().toISOString() };
      console.warn('⚠️ Warning:', payload);
      DevFileLogger.app('warn', payload);
    } catch {}
  },
  error: (message: string, data?: any) => {
    try {
      const payload = { message, data, timestamp: new Date().toISOString() };
      console.error('❌ Error:', payload);
      DevFileLogger.error(payload);
    } catch {}
  },
  debug: (message: string, data?: any) => {
    try {
      const payload = { message, data, timestamp: new Date().toISOString() };
      console.log('🐛 Debug:', payload);
      DevFileLogger.app('debug', payload);
    } catch {}
  }
};
