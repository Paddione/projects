import { Request, Response, NextFunction } from 'express';
import { RequestLogger } from './logging.js';

export interface SecurityEvent {
  type: 'AUTHENTICATION' | 'AUTHORIZATION' | 'INPUT_VALIDATION' | 'RATE_LIMIT' | 'SUSPICIOUS_ACTIVITY';
  action: string;
  userId?: number;
  ip: string;
  userAgent?: string;
  details?: any;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timestamp: string;
}

export class SecurityAuditMiddleware {
  private static suspiciousPatterns = [
    /(\<script\>|\<\/script\>)/gi,
    /(javascript:|vbscript:|onload=|onerror=)/gi,
    /(union\s+select|drop\s+table|delete\s+from)/gi,
    /(\.\.\/)|(\.\.\\)/g,
    /(exec\s*\(|eval\s*\(|system\s*\()/gi
  ];

  /**
   * Log security events
   */
  static logSecurityEvent(event: SecurityEvent): void {
    console.log(`🔒 SECURITY AUDIT: ${event.type} - ${event.action}`, {
      ...event,
      timestamp: new Date().toISOString()
    });

    // Log to central logger based on severity
    const centralLogger = (RequestLogger as any).centralLogger;
    if (event.severity === 'CRITICAL' || event.severity === 'HIGH') {
      centralLogger.logError({
        code: 'SECURITY_EVENT',
        message: `${event.type}: ${event.action}`,
        context: event,
        severity: event.severity.toLowerCase(),
        category: 'security',
        recoverable: false,
        retryable: false
      });
    } else {
      centralLogger.logWarn(`Security Event: ${event.type}`, event);
    }
  }

  /**
   * Authentication audit middleware
   */
  static auditAuthentication = (req: Request, res: Response, next: NextFunction): void => {
    const originalJson = res.json.bind(res);
    
    res.json = function(body: any) {
      // Log authentication attempts
      if (req.path.includes('/auth/login')) {
        const success = res.statusCode === 200;
        SecurityAuditMiddleware.logSecurityEvent({
          type: 'AUTHENTICATION',
          action: success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED',
          ...(success && body?.user?.id !== undefined ? { userId: body.user.id } : {}),
          ip: req.ip || 'unknown',
          ...(req.get('User-Agent') ? { userAgent: req.get('User-Agent') as string } : {}),
          details: {
            email: req.body?.email,
            statusCode: res.statusCode
          },
          severity: success ? 'LOW' : 'MEDIUM',
          timestamp: new Date().toISOString()
        });
      }

      // Log registration attempts
      if (req.path.includes('/auth/register')) {
        const success = res.statusCode === 201;
        SecurityAuditMiddleware.logSecurityEvent({
          type: 'AUTHENTICATION',
          action: success ? 'REGISTRATION_SUCCESS' : 'REGISTRATION_FAILED',
          ...(success && body?.user?.id !== undefined ? { userId: body.user.id } : {}),
          ip: req.ip || 'unknown',
          ...(req.get('User-Agent') ? { userAgent: req.get('User-Agent') as string } : {}),
          details: {
            email: req.body?.email,
            username: req.body?.username,
            statusCode: res.statusCode
          },
          severity: 'LOW',
          timestamp: new Date().toISOString()
        });
      }

      return originalJson(body);
    };

    next();
  };

  /**
   * Authorization audit middleware
   */
  static auditAuthorization = (req: Request, res: Response, next: NextFunction): void => {
    const originalStatus = res.status.bind(res);
    
    res.status = function(code: number) {
      if (code === 401 || code === 403) {
        SecurityAuditMiddleware.logSecurityEvent({
          type: 'AUTHORIZATION',
          action: code === 401 ? 'UNAUTHORIZED_ACCESS' : 'FORBIDDEN_ACCESS',
          ...(req.user?.userId !== undefined ? { userId: req.user.userId } : {}),
          ip: req.ip || 'unknown',
          ...(req.get('User-Agent') ? { userAgent: req.get('User-Agent') as string } : {}),
          details: {
            method: req.method,
            path: req.path,
            statusCode: code
          },
          severity: 'MEDIUM',
          timestamp: new Date().toISOString()
        });
      }
      
      return originalStatus(code);
    };

    next();
  };

  /**
   * Input validation audit middleware
   */
  static auditInputValidation = (req: Request, res: Response, next: NextFunction): void => {
    const requestData = JSON.stringify({ body: req.body, query: req.query, params: req.params });
    
    // Check for suspicious patterns
    const suspiciousPatterns = SecurityAuditMiddleware.suspiciousPatterns.filter(pattern => 
      pattern.test(requestData)
    );

    if (suspiciousPatterns.length > 0) {
      SecurityAuditMiddleware.logSecurityEvent({
        type: 'SUSPICIOUS_ACTIVITY',
        action: 'MALICIOUS_INPUT_DETECTED',
        ...(req.user?.userId !== undefined ? { userId: req.user.userId } : {}),
        ip: req.ip || 'unknown',
        ...(req.get('User-Agent') ? { userAgent: req.get('User-Agent') as string } : {}),
        details: {
          method: req.method,
          path: req.path,
          suspiciousPatterns: suspiciousPatterns.map(p => p.toString()),
          requestData: requestData.substring(0, 500) // Limit logged data
        },
        severity: 'HIGH',
        timestamp: new Date().toISOString()
      });
    }

    // Check for unusually large payloads
    const contentLength = parseInt(req.get('content-length') || '0');
    if (contentLength > 1024 * 1024) { // 1MB
      SecurityAuditMiddleware.logSecurityEvent({
        type: 'SUSPICIOUS_ACTIVITY',
        action: 'LARGE_PAYLOAD_DETECTED',
        ...(req.user?.userId !== undefined ? { userId: req.user.userId } : {}),
        ip: req.ip || 'unknown',
        ...(req.get('User-Agent') ? { userAgent: req.get('User-Agent') as string } : {}),
        details: {
          method: req.method,
          path: req.path,
          contentLength
        },
        severity: 'MEDIUM',
        timestamp: new Date().toISOString()
      });
    }

    next();
  };

  /**
   * Rate limit audit middleware
   */
  static auditRateLimit = (req: Request, res: Response, next: NextFunction): void => {
    const originalStatus = res.status.bind(res);
    
    res.status = function(code: number) {
      if (code === 429) {
        SecurityAuditMiddleware.logSecurityEvent({
          type: 'RATE_LIMIT',
          action: 'RATE_LIMIT_EXCEEDED',
          ...(req.user?.userId !== undefined ? { userId: req.user.userId } : {}),
          ip: req.ip || 'unknown',
          ...(req.get('User-Agent') ? { userAgent: req.get('User-Agent') as string } : {}),
          details: {
            method: req.method,
            path: req.path,
            statusCode: code
          },
          severity: 'MEDIUM',
          timestamp: new Date().toISOString()
        });
      }
      
      return originalStatus(code);
    };

    next();
  };

  /**
   * Comprehensive security audit middleware
   */
  static auditSecurity = (req: Request, res: Response, next: NextFunction): void => {
    // Apply all audit middlewares
    SecurityAuditMiddleware.auditAuthentication(req, res, () => {
      SecurityAuditMiddleware.auditAuthorization(req, res, () => {
        SecurityAuditMiddleware.auditInputValidation(req, res, () => {
          SecurityAuditMiddleware.auditRateLimit(req, res, next);
        });
      });
    });
  };

  /**
   * Monitor for brute force attacks
   */
  static monitorBruteForce = (() => {
    const failedAttempts = new Map<string, { count: number; lastAttempt: number }>();
    const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
    const MAX_ATTEMPTS = 5;

    return (req: Request, res: Response, next: NextFunction): void => {
      if (req.path.includes('/auth/login')) {
        const ip = req.ip || 'unknown';
        const now = Date.now();

        // Clean up old entries
        for (const [key, value] of failedAttempts.entries()) {
          if (now - value.lastAttempt > WINDOW_MS) {
            failedAttempts.delete(key);
          }
        }

        const originalJson = res.json.bind(res);
        res.json = function(body: any) {
          if (res.statusCode !== 200) {
            // Failed login attempt
            const attempts = failedAttempts.get(ip) || { count: 0, lastAttempt: now };
            attempts.count++;
            attempts.lastAttempt = now;
            failedAttempts.set(ip, attempts);

            if (attempts.count >= MAX_ATTEMPTS) {
              SecurityAuditMiddleware.logSecurityEvent({
                type: 'SUSPICIOUS_ACTIVITY',
                action: 'BRUTE_FORCE_DETECTED',
                ip,
                ...(req.get('User-Agent') ? { userAgent: req.get('User-Agent') as string } : {}),
                details: {
                  attemptCount: attempts.count,
                  timeWindow: WINDOW_MS / 1000 / 60 + ' minutes'
                },
                severity: 'HIGH',
                timestamp: new Date().toISOString()
              });
            }
          } else {
            // Successful login, reset counter
            failedAttempts.delete(ip);
          }

          return originalJson(body);
        };
      }

      next();
    };
  })();
}

// Export convenience functions
export const auditSecurity = SecurityAuditMiddleware.auditSecurity;
export const auditAuthentication = SecurityAuditMiddleware.auditAuthentication;
export const auditAuthorization = SecurityAuditMiddleware.auditAuthorization;
export const auditInputValidation = SecurityAuditMiddleware.auditInputValidation;
export const auditRateLimit = SecurityAuditMiddleware.auditRateLimit;
export const monitorBruteForce = SecurityAuditMiddleware.monitorBruteForce;
export const logSecurityEvent = SecurityAuditMiddleware.logSecurityEvent;
