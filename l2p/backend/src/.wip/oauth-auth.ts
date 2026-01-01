import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import axios from 'axios';

export interface TokenPayload {
  userId: number;
  username: string;
  email: string;
  role: string;
  emailVerified?: boolean;
  iat: number;
  exp: number;
  iss: string;
  aud: string;
}

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

/**
 * OAuth Authentication Middleware
 * Validates JWT tokens issued by the auth service
 */

// In-memory cache for blacklist checks (5 minute TTL)
const blacklistCache = new Map<string, { isBlacklisted: boolean; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const authServiceUrlRaw = (process.env.AUTH_SERVICE_URL || 'http://localhost:5500')
  .trim()
  .replace(/\/+$/, '');
const authServiceApiUrl = authServiceUrlRaw.endsWith('/api')
  ? authServiceUrlRaw
  : `${authServiceUrlRaw}/api`;
const authServiceClientId = process.env.AUTH_SERVICE_CLIENT_ID || 'l2p_client_prod';

/**
 * Extract token from request
 */
function extractToken(req: Request): string | null {
  // Try Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // Try cookie
  const tokenFromCookie = req.cookies?.accessToken;
  if (tokenFromCookie) {
    return tokenFromCookie;
  }

  return null;
}

/**
 * Verify JWT token locally (fast path)
 */
function verifyTokenLocally(token: string): TokenPayload {
  const secret = process.env.AUTH_SERVICE_JWT_SECRET;

  if (!secret) {
    throw new Error('AUTH_SERVICE_JWT_SECRET not configured');
  }

  const payload = jwt.verify(token, secret, {
    issuer: 'auth-service',
    audience: 'unified-auth'
  }) as TokenPayload;

  return payload;
}

/**
 * Check if token is blacklisted (with caching)
 */
async function isTokenBlacklisted(token: string): Promise<boolean> {
  // Check cache first
  const cached = blacklistCache.get(token);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.isBlacklisted;
  }

  // Call auth service to check blacklist
  try {
    const response = await axios.post(
      `${authServiceApiUrl}/oauth/validate`,
      {
        access_token: token,
        client_id: authServiceClientId
      },
      {
        timeout: 3000 // 3 second timeout
      }
    );

    const isValid = response.data.valid === true;
    const isBlacklisted = !isValid;

    // Cache the result
    blacklistCache.set(token, {
      isBlacklisted,
      expiresAt: Date.now() + CACHE_TTL
    });

    return isBlacklisted;
  } catch (error) {
    console.error('Error checking token blacklist:', error);
    // On error, assume token is valid (fail open for availability)
    // In production, you may want to fail closed for security
    return false;
  }
}

/**
 * Validate token with auth service (fallback path)
 */
async function validateTokenWithAuthService(token: string): Promise<TokenPayload | null> {
  try {
    const response = await axios.post(
      `${authServiceApiUrl}/oauth/validate`,
      {
        access_token: token,
        client_id: authServiceClientId
      },
      {
        timeout: 3000
      }
    );

    if (!response.data.valid) {
      return null;
    }

    return {
      userId: response.data.user.userId,
      username: response.data.user.username,
      email: response.data.user.email,
      role: response.data.user.role,
      emailVerified: response.data.user.emailVerified,
      iat: 0,
      exp: 0,
      iss: 'auth-service',
      aud: 'unified-auth'
    };
  } catch (error) {
    console.error('Error validating token with auth service:', error);
    return null;
  }
}

/**
 * Main OAuth authentication middleware
 */
export async function oauthAuthenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractToken(req);

    if (!token) {
      res.status(401).json({
        error: 'Authentication required',
        code: 'NO_TOKEN'
      });
      return;
    }

    // Step 1: Verify JWT signature locally (fast)
    let payload: TokenPayload | null = null;
    try {
      payload = verifyTokenLocally(token);
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        res.status(401).json({
          error: 'Token expired',
          code: 'TOKEN_EXPIRED'
        });
        return;
      } else if (error.name === 'JsonWebTokenError') {
        res.status(401).json({
          error: 'Invalid token',
          code: 'TOKEN_INVALID'
        });
        return;
      } else {
        // JWT verification failed, try auth service validation
        payload = await validateTokenWithAuthService(token);

        if (!payload) {
          res.status(401).json({
            error: 'Invalid token',
            code: 'TOKEN_INVALID'
          });
          return;
        }
      }
    }

    // Step 2: Check if token is blacklisted (with caching)
    const isBlacklisted = await isTokenBlacklisted(token);
    if (isBlacklisted) {
      res.status(401).json({
        error: 'Token has been revoked',
        code: 'TOKEN_REVOKED'
      });
      return;
    }

    // Step 3: Attach user to request
    req.user = payload;
    next();
  } catch (error) {
    console.error('OAuth authentication error:', error);
    res.status(500).json({
      error: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
}

/**
 * Optional authentication middleware
 * Attaches user if token is present, but doesn't require it
 */
export async function optionalOAuthAuthenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const token = extractToken(req);

    if (!token) {
      // No token, continue without user
      next();
      return;
    }

    // Try to verify token
    try {
      const payload = verifyTokenLocally(token);
      const isBlacklisted = await isTokenBlacklisted(token);

      if (!isBlacklisted) {
        req.user = payload;
      }
    } catch (error) {
      // Token invalid, continue without user
    }

    next();
  } catch (error) {
    console.error('Optional OAuth authentication error:', error);
    next();
  }
}

/**
 * Clear blacklist cache (call periodically)
 */
export function clearBlacklistCache(): void {
  const now = Date.now();
  for (const [token, data] of blacklistCache.entries()) {
    if (now >= data.expiresAt) {
      blacklistCache.delete(token);
    }
  }
}

// Clear cache every 10 minutes
setInterval(clearBlacklistCache, 10 * 60 * 1000);
