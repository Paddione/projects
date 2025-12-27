import { Request, Response, NextFunction } from 'express';
import { AuthService, TokenPayload } from '../services/AuthService.js';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: TokenPayload;
}

export class AuthMiddleware {
  private authService: AuthService;

  constructor() {
    this.authService = new AuthService();
  }

  /**
   * Extract token from request headers or cookies
   */
  private extractToken(req: Request): string | null {
    // Check Authorization header first (Bearer token)
    const authHeader = req.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check for token in cookies
    const cookieToken = req.cookies?.['accessToken'];
    if (cookieToken) {
      return cookieToken;
    }

    return null;
  }

  /**
   * Middleware to authenticate requests using JWT
   */
  authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = this.extractToken(req);

      if (!token) {
        // Match test expectations: concise error identifier
        res.status(401).json({
          error: 'No token provided',
          message: 'No access token provided'
        });
        return;
      }

      // Verify token
      const payload = this.authService.verifyAccessToken(token);

      // Attach user info to request
      req.user = payload;

      next();
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Access token expired') {
          res.status(401).json({
            error: 'Token expired',
            message: 'Access token has expired',
            code: 'TOKEN_EXPIRED'
          });
          return;
        }

        if (error.message === 'Invalid access token') {
          // Match test expectations for error field value
          res.status(401).json({
            error: 'Invalid token',
            message: 'Access token is invalid',
            code: 'TOKEN_INVALID'
          });
          return;
        }
      }

      res.status(401).json({
        error: 'Authentication failed',
        message: 'Token verification failed'
      });
    }
  };

  /**
   * Optional authentication middleware - doesn't fail if no token
   */
  optionalAuthenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = this.extractToken(req);

      if (token) {
        const payload = this.authService.verifyAccessToken(token);
        req.user = payload;
      }

      next();
    } catch (error) {
      // For optional auth, we don't fail on token errors
      // Just continue without user info
      next();
    }
  };

  /**
   * Middleware to check if user has specific role (for future use)
   */
  requireRole = (role: string) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          error: 'Authentication required',
          message: 'User not authenticated'
        });
        return;
      }

      // For now, we don't have roles in the user model
      // This is a placeholder for future role-based access control
      next();
    };
  };

  /**
   * Middleware to check if user owns the resource
   */
  requireOwnership = (userIdParam: string = 'userId') => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({
          error: 'Authentication required',
          message: 'User not authenticated'
        });
        return;
      }

      const userIdString = req.params[userIdParam];
      if (!userIdString) {
        res.status(400).json({
          error: 'Missing user ID',
          message: 'User ID parameter is required'
        });
        return;
      }

      const resourceUserId = parseInt(userIdString);
      
      if (isNaN(resourceUserId)) {
        res.status(400).json({
          error: 'Invalid user ID',
          message: 'User ID must be a valid number'
        });
        return;
      }

      if (req.user.userId !== resourceUserId) {
        res.status(403).json({
          error: 'Access denied',
          message: 'You can only access your own resources'
        });
        return;
      }

      next();
    };
  };

  /**
   * Middleware to require admin privileges
   */
  requireAdmin = (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated'
      });
      return;
    }

    if (!req.user.isAdmin) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Admin privileges required'
      });
      return;
    }

    next();
  };

  /**
   * Middleware to validate refresh token
   */
  validateRefreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const refreshToken = req.cookies?.['refreshToken'] || (req.body as Record<string, unknown>)['refreshToken'];

      if (!refreshToken) {
        res.status(401).json({
          error: 'Refresh token required',
          message: 'No refresh token provided'
        });
        return;
      }

      // Verify refresh token
      const payload = this.authService.verifyRefreshToken(refreshToken);
      req.user = payload;

      next();
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Refresh token expired') {
          res.status(401).json({
            error: 'Refresh token expired',
            message: 'Refresh token has expired, please login again',
            code: 'REFRESH_TOKEN_EXPIRED'
          });
          return;
        }

        if (error.message === 'Invalid refresh token') {
          res.status(401).json({
            error: 'Invalid refresh token',
            message: 'Refresh token is invalid',
            code: 'REFRESH_TOKEN_INVALID'
          });
          return;
        }
      }

      res.status(401).json({
        error: 'Refresh token validation failed',
        message: 'Could not validate refresh token'
      });
    }
  };
}

// Create singleton instance
export const authMiddleware = new AuthMiddleware();

// Export individual middleware functions for convenience
export const authenticate = authMiddleware.authenticate;
export const optionalAuthenticate = authMiddleware.optionalAuthenticate;
export const requireRole = authMiddleware.requireRole;
export const requireOwnership = authMiddleware.requireOwnership;
export const validateRefreshToken = authMiddleware.validateRefreshToken;
export const requireAdmin = authMiddleware.requireAdmin;
