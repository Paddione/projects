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

interface AuthServiceUser {
  userId: number;
  username: string;
  email: string;
  role?: string;
  emailVerified?: boolean;
  selectedCharacter?: string;
  characterLevel?: number;
}

class OAuthMiddleware {
  private authServiceUrl: string | null;

  constructor() {
    const configuredUrl = process.env['AUTH_SERVICE_URL'];
    this.authServiceUrl = configuredUrl && configuredUrl.trim() ? configuredUrl.trim() : null;
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
   * Verify token with the central auth service.
   */
  private async verifyWithAuthService(token: string): Promise<TokenPayload> {
    if (!this.authServiceUrl) {
      throw new Error('AUTH_SERVICE_UNAVAILABLE');
    }

    let response: globalThis.Response;
    try {
      response = await fetch(`${this.authServiceUrl}/api/auth/verify`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
    } catch (error) {
      throw new Error('AUTH_SERVICE_UNAVAILABLE');
    }

    let data: any = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      const code = typeof data?.code === 'string' ? data.code : undefined;
      const error = new Error(code || 'AUTH_FAILED');
      (error as any).status = response.status;
      (error as any).code = code;
      throw error;
    }

    const user = data?.user as AuthServiceUser | undefined;
    if (!user) {
      throw new Error('AUTH_FAILED');
    }

    const payload: TokenPayload = {
      userId: user.userId,
      username: user.username,
      email: user.email,
      isAdmin: user.role === 'ADMIN'
    };

    // Only add optional properties if they have defined values
    if (user.selectedCharacter !== undefined) {
      payload.selectedCharacter = user.selectedCharacter;
    }
    if (user.characterLevel !== undefined) {
      payload.characterLevel = user.characterLevel;
    }
    if (user.role !== undefined) {
      payload.role = user.role;
    }
    if (user.emailVerified !== undefined) {
      payload.emailVerified = user.emailVerified;
    }

    return payload;
  }

  /**
   * Middleware to authenticate OAuth requests using JWT
   */
  authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = this.extractToken(req);

      if (!token) {
        res.status(401).json({
          error: 'No token provided',
          message: 'No access token provided'
        });
        return;
      }

      if (!this.authServiceUrl) {
        res.status(503).json({
          error: 'Authentication service unavailable',
          message: 'OAuth authentication requires central auth service'
        });
        return;
      }

      try {
        const payload = await this.verifyWithAuthService(token);
        req.user = payload;
        next();
        return;
      } catch (error) {
        if (error instanceof Error) {
          const status = (error as any).status as number | undefined;
          const code = (error as any).code as string | undefined;

          if (code === 'TOKEN_EXPIRED') {
            res.status(401).json({
              error: 'Token expired',
              message: 'Access token has expired',
              code: 'TOKEN_EXPIRED'
            });
            return;
          }

          if (code === 'INVALID_TOKEN') {
            res.status(401).json({
              error: 'Invalid token',
              message: 'Access token is invalid',
              code: 'TOKEN_INVALID'
            });
            return;
          }

          if (error.message === 'AUTH_SERVICE_UNAVAILABLE') {
            res.status(503).json({
              error: 'Authentication service unavailable',
              message: 'Authentication service unavailable',
              code: 'AUTH_SERVICE_UNAVAILABLE'
            });
            return;
          }

          if (status === 401) {
            res.status(401).json({
              error: 'Authentication failed',
              message: 'Token verification failed'
            });
            return;
          }
        }

        res.status(401).json({
          error: 'Authentication failed',
          message: 'Token verification failed'
        });
      }
    } catch (error) {
      res.status(401).json({
        error: 'Authentication failed',
        message: 'Token verification failed'
      });
    }
  };
}

// Create singleton instance
const oauthMiddleware = new OAuthMiddleware();

// Export middleware function
export const oauthAuthenticate = oauthMiddleware.authenticate;
