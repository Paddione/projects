import jwt from 'jsonwebtoken';
import { db } from '../config/database.js';
import { tokenBlacklist } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import type { TokenPayload, AuthTokens } from '../types/auth.js';
import type { User } from '../db/schema.js';

export class TokenService {
  private readonly JWT_SECRET: string;
  private readonly JWT_REFRESH_SECRET: string;
  private readonly ACCESS_TOKEN_EXPIRY: string;
  private readonly REFRESH_TOKEN_EXPIRY: string;
  private readonly JITSI_JWT_SECRET: string;

  constructor() {
    const isTest = process.env.NODE_ENV === 'test';
    this.JWT_SECRET = process.env.JWT_SECRET || (isTest ? 'test-jwt-secret' : '');
    this.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || (isTest ? 'test-refresh-secret' : '');
    this.ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '15m';
    this.REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d';
    this.JITSI_JWT_SECRET = process.env.JITSI_JWT_SECRET || (isTest ? 'test-jitsi-secret' : '');

    if (!this.JWT_SECRET || !this.JWT_REFRESH_SECRET) {
      throw new Error('JWT secrets must be configured');
    }

    if (process.env.NODE_ENV === 'production' &&
        (this.JWT_SECRET === 'test-jwt-secret' || this.JWT_REFRESH_SECRET === 'test-refresh-secret')) {
      throw new Error('Production JWT secrets must be set');
    }
  }

  /**
   * Generate access and refresh tokens for a user
   */
  generateTokens(user: User): AuthTokens {
    const payload: TokenPayload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role || 'USER',
      selectedCharacter: user.selected_character || undefined,
      characterLevel: user.character_level || undefined,
    };

    const accessToken = jwt.sign(
      payload,
      this.JWT_SECRET,
      {
        expiresIn: this.ACCESS_TOKEN_EXPIRY,
        issuer: 'unified-auth',
        audience: 'korczewski-services',
      } as jwt.SignOptions
    );

    const refreshToken = jwt.sign(
      { userId: user.id, email: user.email },
      this.JWT_REFRESH_SECRET,
      {
        expiresIn: this.REFRESH_TOKEN_EXPIRY,
        issuer: 'unified-auth',
        audience: 'korczewski-services',
      } as jwt.SignOptions
    );

    return { accessToken, refreshToken };
  }

  /**
   * Verify and decode an access token
   */
  verifyAccessToken(token: string): TokenPayload {
    try {
      const payload = jwt.verify(token, this.JWT_SECRET, {
        issuer: 'unified-auth',
        audience: 'korczewski-services',
      }) as TokenPayload;

      return payload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('TOKEN_EXPIRED');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('INVALID_TOKEN');
      }
      throw error;
    }
  }

  /**
   * Verify and decode a refresh token
   */
  verifyRefreshToken(token: string): { userId: number; email: string } {
    try {
      const payload = jwt.verify(token, this.JWT_REFRESH_SECRET, {
        issuer: 'unified-auth',
        audience: 'korczewski-services',
      }) as { userId: number; email: string };

      return payload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('REFRESH_TOKEN_EXPIRED');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('INVALID_REFRESH_TOKEN');
      }
      throw error;
    }
  }

  /**
   * Add a token to the blacklist (for logout)
   */
  async blacklistToken(token: string): Promise<void> {
    try {
      // Decode token to get expiry (don't verify, just decode)
      const decoded = jwt.decode(token) as { exp?: number };

      if (!decoded || !decoded.exp) {
        throw new Error('Invalid token format');
      }

      const expiresAt = new Date(decoded.exp * 1000);

      await db.insert(tokenBlacklist).values({
        token,
        expires_at: expiresAt,
      });
    } catch (error) {
      console.error('Error blacklisting token:', error);
      throw new Error('Failed to blacklist token');
    }
  }

  /**
   * Check if a token is blacklisted
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    const result = await db
      .select()
      .from(tokenBlacklist)
      .where(eq(tokenBlacklist.token, token))
      .limit(1);

    return result.length > 0;
  }

  /**
   * Decode token without verification (for debugging)
   */
  decodeToken(token: string): TokenPayload | null {
    try {
      return jwt.decode(token) as TokenPayload;
    } catch {
      return null;
    }
  }

  /**
   * Generate a Jitsi Meet JWT for an authenticated user.
   * Format matches Prosody's token_verification module expectations.
   */
  generateJitsiToken(user: User, room: string = '*'): string {
    if (!this.JITSI_JWT_SECRET) {
      throw new Error('JITSI_JWT_SECRET not configured');
    }

    return jwt.sign(
      {
        room,
        sub: 'meet.korczewski.de',
        context: {
          user: {
            name: user.name || user.username,
            email: user.email,
            avatar: user.avatar_url || '',
            id: String(user.id),
          },
          features: {
            recording: false,
            livestreaming: false,
          },
        },
      },
      this.JITSI_JWT_SECRET,
      {
        issuer: 'jitsi-meet',
        audience: 'jitsi-meet',
        expiresIn: '24h',
      } as jwt.SignOptions
    );
  }

  /**
   * Generate a guest invite JWT for a specific Jitsi room.
   * Room-locked, short-lived, no moderator privileges.
   */
  generateGuestInvite(room: string, expiresIn: string = '2h'): string {
    if (!this.JITSI_JWT_SECRET) {
      throw new Error('JITSI_JWT_SECRET not configured');
    }

    return jwt.sign(
      {
        room,
        sub: 'meet.korczewski.de',
        context: {
          user: {
            name: 'Guest',
            guest: true,
          },
          features: {
            recording: false,
            livestreaming: false,
          },
        },
      },
      this.JITSI_JWT_SECRET,
      {
        issuer: 'jitsi-meet',
        audience: 'jitsi-meet',
        expiresIn,
      } as jwt.SignOptions
    );
  }
}
