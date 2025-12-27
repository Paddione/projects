import { Request, Response, NextFunction } from 'express';
import { ValidationError } from './errorHandler.js';
import { logSecurityEvent } from './securityAudit.js';

export class EnhancedValidationMiddleware {
  private static readonly SQL_INJECTION_PATTERNS = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/gi,
    /((\%27)|(\')|(--)|(\%23)|(#))/gi,
    /((\%3D)|(=))[^\n]*((\%27)|(\')|(--)|(\%23)|(#))/gi,
    /\w*((\%27)|(\'))((\%6F)|o|(\%4F))((\%72)|r|(\%52))/gi,
    /((\%27)|(\'))union/gi
  ];

  private static readonly XSS_PATTERNS = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
    /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
    /expression\s*\(/gi,
    /vbscript:/gi
  ];

  private static readonly PATH_TRAVERSAL_PATTERNS = [
    /\.\.\//g,
    /\.\.\\/g,
    /%2e%2e%2f/gi,
    /%2e%2e%5c/gi,
    /\.\.%2f/gi,
    /\.\.%5c/gi
  ];

  private static readonly COMMAND_INJECTION_PATTERNS = [
    /(\||&|;|\$\(|\`)/g,
    /(exec\s*\(|eval\s*\(|system\s*\()/gi,
    /(cmd\.exe|powershell|bash|sh)/gi
  ];

  /**
   * Comprehensive input validation and sanitization
   */
  static validateAndSanitize = (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Validate and sanitize request body
      if (req.body) {
        req.body = EnhancedValidationMiddleware.processObject(req.body, req);
      }

      // Validate and sanitize query parameters
      if (req.query) {
        req.query = EnhancedValidationMiddleware.processObject(req.query, req);
      }

      // Validate and sanitize URL parameters
      if (req.params) {
        req.params = EnhancedValidationMiddleware.processObject(req.params, req);
      }

      // Validate headers for suspicious content
      EnhancedValidationMiddleware.validateHeaders(req);

      next();
    } catch (error) {
      next(error);
    }
  };

  /**
   * Process and validate object recursively
   */
  private static processObject(obj: any, req: Request): any {
    if (typeof obj === 'string') {
      return EnhancedValidationMiddleware.validateAndSanitizeString(obj, req);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => EnhancedValidationMiddleware.processObject(item, req));
    }

    if (obj && typeof obj === 'object') {
      const processed: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Validate key names
        const sanitizedKey = EnhancedValidationMiddleware.validateAndSanitizeString(key, req);
        processed[sanitizedKey] = EnhancedValidationMiddleware.processObject(value, req);
      }
      return processed;
    }

    return obj;
  }

  /**
   * Validate and sanitize string values
   */
  private static validateAndSanitizeString(value: string, req: Request): string {
    if (typeof value !== 'string') {
      return value;
    }

    // Check for SQL injection patterns
    for (const pattern of EnhancedValidationMiddleware.SQL_INJECTION_PATTERNS) {
      if (pattern.test(value)) {
        logSecurityEvent({
          type: 'SUSPICIOUS_ACTIVITY',
          action: 'SQL_INJECTION_ATTEMPT',
          ...(req.user?.userId !== undefined ? { userId: req.user.userId } : {}),
          ip: req.ip || 'unknown',
          ...(req.get('User-Agent') ? { userAgent: req.get('User-Agent') as string } : {}),
          details: {
            method: req.method,
            path: req.path,
            suspiciousValue: value.substring(0, 100),
            pattern: pattern.toString()
          },
          severity: 'HIGH',
          timestamp: new Date().toISOString()
        });

        throw new ValidationError('Invalid input detected', {
          code: 'SECURITY_VIOLATION',
          type: 'SQL_INJECTION'
        });
      }
    }

    // Check for XSS patterns
    for (const pattern of EnhancedValidationMiddleware.XSS_PATTERNS) {
      if (pattern.test(value)) {
        logSecurityEvent({
          type: 'SUSPICIOUS_ACTIVITY',
          action: 'XSS_ATTEMPT',
          ...(req.user?.userId !== undefined ? { userId: req.user.userId } : {}),
          ip: req.ip || 'unknown',
          ...(req.get('User-Agent') ? { userAgent: req.get('User-Agent') as string } : {}),
          details: {
            method: req.method,
            path: req.path,
            suspiciousValue: value.substring(0, 100),
            pattern: pattern.toString()
          },
          severity: 'HIGH',
          timestamp: new Date().toISOString()
        });

        // Sanitize XSS content instead of throwing error for better UX
        value = value.replace(pattern, '');
      }
    }

    // Check for path traversal patterns
    for (const pattern of EnhancedValidationMiddleware.PATH_TRAVERSAL_PATTERNS) {
      if (pattern.test(value)) {
        logSecurityEvent({
          type: 'SUSPICIOUS_ACTIVITY',
          action: 'PATH_TRAVERSAL_ATTEMPT',
          ...(req.user?.userId !== undefined ? { userId: req.user.userId } : {}),
          ip: req.ip || 'unknown',
          ...(req.get('User-Agent') ? { userAgent: req.get('User-Agent') as string } : {}),
          details: {
            method: req.method,
            path: req.path,
            suspiciousValue: value.substring(0, 100),
            pattern: pattern.toString()
          },
          severity: 'HIGH',
          timestamp: new Date().toISOString()
        });

        throw new ValidationError('Invalid path detected', {
          code: 'SECURITY_VIOLATION',
          type: 'PATH_TRAVERSAL'
        });
      }
    }

    // Check for command injection patterns
    for (const pattern of EnhancedValidationMiddleware.COMMAND_INJECTION_PATTERNS) {
      if (pattern.test(value)) {
        logSecurityEvent({
          type: 'SUSPICIOUS_ACTIVITY',
          action: 'COMMAND_INJECTION_ATTEMPT',
          ...(req.user?.userId !== undefined ? { userId: req.user.userId } : {}),
          ip: req.ip || 'unknown',
          ...(req.get('User-Agent') ? { userAgent: req.get('User-Agent') as string } : {}),
          details: {
            method: req.method,
            path: req.path,
            suspiciousValue: value.substring(0, 100),
            pattern: pattern.toString()
          },
          severity: 'CRITICAL',
          timestamp: new Date().toISOString()
        });

        throw new ValidationError('Invalid command detected', {
          code: 'SECURITY_VIOLATION',
          type: 'COMMAND_INJECTION'
        });
      }
    }

    // Basic sanitization
    return value
      .trim()
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
      .substring(0, 10000); // Limit string length
  }

  /**
   * Validate request headers
   */
  private static validateHeaders(req: Request): void {
    const suspiciousHeaders = ['x-forwarded-for', 'x-real-ip', 'x-originating-ip'];
    
    for (const header of suspiciousHeaders) {
      const value = req.get(header);
      if (value) {
        // Check for header injection
        if (value.includes('\n') || value.includes('\r')) {
          logSecurityEvent({
            type: 'SUSPICIOUS_ACTIVITY',
            action: 'HEADER_INJECTION_ATTEMPT',
            ...(req.user?.userId !== undefined ? { userId: req.user.userId } : {}),
            ip: req.ip || 'unknown',
            ...(req.get('User-Agent') ? { userAgent: req.get('User-Agent') as string } : {}),
            details: {
              method: req.method,
              path: req.path,
              header,
              value: value.substring(0, 100)
            },
            severity: 'HIGH',
            timestamp: new Date().toISOString()
          });

          throw new ValidationError('Invalid header detected', {
            code: 'SECURITY_VIOLATION',
            type: 'HEADER_INJECTION'
          });
        }
      }
    }

    // Check User-Agent for suspicious patterns
    const userAgent = req.get('User-Agent');
    if (userAgent) {
      const suspiciousUserAgents = [
        /sqlmap/gi,
        /nikto/gi,
        /nessus/gi,
        /burp/gi,
        /nmap/gi,
        /masscan/gi
      ];

      for (const pattern of suspiciousUserAgents) {
        if (pattern.test(userAgent)) {
          logSecurityEvent({
            type: 'SUSPICIOUS_ACTIVITY',
            action: 'SUSPICIOUS_USER_AGENT',
            ...(req.user?.userId !== undefined ? { userId: req.user.userId } : {}),
            ip: req.ip || 'unknown',
            ...(userAgent ? { userAgent } : {}),
            details: {
              method: req.method,
              path: req.path,
              pattern: pattern.toString()
            },
            severity: 'MEDIUM',
            timestamp: new Date().toISOString()
          });
          break;
        }
      }
    }
  }

  /**
   * Normalize file info from various upload libs (e.g., Multer) or browser File
   */
  private static getFileInfo(file: any): { filename: string; mimetype: string; size: number } {
    const filename: string = (file && (file.originalname ?? file.name)) || 'unknown';
    const mimetype: string = (file && (file.mimetype ?? file.type)) || 'application/octet-stream';
    const size: number = (file && typeof file.size === 'number') ? file.size : 0;
    return { filename, mimetype, size };
  }

  /**
   * File upload validation
   */
  static validateFileUpload = (req: Request, res: Response, next: NextFunction): void => {
    if (req.files || req.file) {
      const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : [req.file];
      
      for (const file of files) {
        if (!file) continue;

        // Check file size (10MB limit)
        const { filename, mimetype, size } = EnhancedValidationMiddleware.getFileInfo(file);
        if (size > 10 * 1024 * 1024) {
          logSecurityEvent({
            type: 'SUSPICIOUS_ACTIVITY',
            action: 'LARGE_FILE_UPLOAD',
            ...(req.user?.userId !== undefined ? { userId: req.user.userId } : {}),
            ip: req.ip || 'unknown',
            ...(req.get('User-Agent') ? { userAgent: req.get('User-Agent') as string } : {}),
            details: {
              filename,
              size,
              mimetype
            },
            severity: 'MEDIUM',
            timestamp: new Date().toISOString()
          });

          throw new ValidationError('File too large', {
            code: 'FILE_TOO_LARGE',
            maxSize: '10MB'
          });
        }

        // Check file type
        const allowedTypes = [
          'application/pdf',
          'text/plain',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'image/jpeg',
          'image/png',
          'image/gif'
        ];

        const fileType = mimetype;
        if (!allowedTypes.includes(fileType)) {
          logSecurityEvent({
            type: 'SUSPICIOUS_ACTIVITY',
            action: 'INVALID_FILE_TYPE',
            ...(req.user?.userId !== undefined ? { userId: req.user.userId } : {}),
            ip: req.ip || 'unknown',
            ...(req.get('User-Agent') ? { userAgent: req.get('User-Agent') as string } : {}),
            details: {
              filename,
              mimetype: fileType,
              allowedTypes
            },
            severity: 'MEDIUM',
            timestamp: new Date().toISOString()
          });

          throw new ValidationError('Invalid file type', {
            code: 'INVALID_FILE_TYPE',
            allowedTypes
          });
        }

        // Check filename for suspicious patterns
        const safeFilename = filename || '';
        if (safeFilename.includes('..') || safeFilename.includes('/') || safeFilename.includes('\\')) {
          logSecurityEvent({
            type: 'SUSPICIOUS_ACTIVITY',
            action: 'SUSPICIOUS_FILENAME',
            ...(req.user?.userId !== undefined ? { userId: req.user.userId } : {}),
            ip: req.ip || 'unknown',
            ...(req.get('User-Agent') ? { userAgent: req.get('User-Agent') as string } : {}),
            details: {
              filename: safeFilename,
              reason: 'Contains path traversal characters'
            },
            severity: 'HIGH',
            timestamp: new Date().toISOString()
          });

          throw new ValidationError('Invalid filename', {
            code: 'INVALID_FILENAME'
          });
        }
      }
    }

    next();
  };
}

// Export convenience functions
export const validateAndSanitize = EnhancedValidationMiddleware.validateAndSanitize;
export const validateFileUpload = EnhancedValidationMiddleware.validateFileUpload;
