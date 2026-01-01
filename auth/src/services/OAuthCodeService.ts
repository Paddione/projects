import { db } from '../config/database.js';
import { oauthAuthorizationCodes } from '../db/schema.js';
import { eq, lt } from 'drizzle-orm';
import type { AuthorizationCodeData } from '../types/oauth.js';
import crypto from 'crypto';

/**
 * OAuthCodeService
 * Handles OAuth 2.0 authorization code generation, validation, and management
 */
export class OAuthCodeService {
  private readonly CODE_EXPIRY_MINUTES = parseInt(process.env.OAUTH_CODE_EXPIRY || '10'); // 10 minutes default

  /**
   * Generate a cryptographically secure authorization code
   */
  private generateCode(): string {
    return crypto.randomBytes(32).toString('base64url');
  }

  /**
   * Create authorization code
   * Returns a unique code that can be exchanged for tokens
   */
  async createAuthorizationCode(data: AuthorizationCodeData): Promise<string> {
    const code = this.generateCode();
    const expiresAt = new Date(Date.now() + this.CODE_EXPIRY_MINUTES * 60 * 1000);

    await db.insert(oauthAuthorizationCodes).values({
      code,
      client_id: data.clientId,
      user_id: data.userId,
      redirect_uri: data.redirectUri,
      scope: data.scope,
      expires_at: expiresAt,
      used_at: null
    });

    return code;
  }

  /**
   * Validate and consume authorization code
   * Returns user data if valid, null if invalid/expired/used
   */
  async validateAndConsumeCode(
    code: string,
    clientId: string,
    redirectUri: string
  ): Promise<{ userId: number; scope: string } | null> {
    try {
      // Find the authorization code
      const authCode = await db
        .select()
        .from(oauthAuthorizationCodes)
        .where(eq(oauthAuthorizationCodes.code, code))
        .limit(1);

      if (authCode.length === 0) {
        return null; // Code not found
      }

      const codeRecord = authCode[0];

      // Check if code has already been used
      if (codeRecord.used_at !== null) {
        console.warn(`Authorization code reuse attempt detected: ${code}`);
        return null;
      }

      // Check if code has expired
      if (new Date() > new Date(codeRecord.expires_at)) {
        return null;
      }

      // Validate client_id matches
      if (codeRecord.client_id !== clientId) {
        console.warn(`Client ID mismatch for code: ${code}`);
        return null;
      }

      // Validate redirect_uri matches
      if (codeRecord.redirect_uri !== redirectUri) {
        console.warn(`Redirect URI mismatch for code: ${code}`);
        return null;
      }

      // Mark code as used
      await db
        .update(oauthAuthorizationCodes)
        .set({ used_at: new Date() })
        .where(eq(oauthAuthorizationCodes.code, code));

      return {
        userId: codeRecord.user_id,
        scope: codeRecord.scope || 'openid profile email'
      };
    } catch (error) {
      console.error('Error validating authorization code:', error);
      return null;
    }
  }

  /**
   * Clean up expired authorization codes
   * Should be called periodically (e.g., via cron job)
   */
  async cleanupExpiredCodes(): Promise<number> {
    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

      await db
        .delete(oauthAuthorizationCodes)
        .where(lt(oauthAuthorizationCodes.expires_at, oneDayAgo));

      // Note: Drizzle doesn't return affected rows count in the same way
      // This is a best-effort cleanup
      return 0;
    } catch (error) {
      console.error('Error cleaning up expired codes:', error);
      return 0;
    }
  }

  /**
   * Revoke all codes for a specific user
   * Useful for logout or account deactivation
   */
  async revokeUserCodes(userId: number): Promise<void> {
    try {
      await db
        .delete(oauthAuthorizationCodes)
        .where(eq(oauthAuthorizationCodes.user_id, userId));
    } catch (error) {
      console.error('Error revoking user codes:', error);
    }
  }

  /**
   * Check if a code exists and is valid (without consuming it)
   * Useful for debugging
   */
  async isCodeValid(code: string): Promise<boolean> {
    try {
      const authCode = await db
        .select()
        .from(oauthAuthorizationCodes)
        .where(eq(oauthAuthorizationCodes.code, code))
        .limit(1);

      if (authCode.length === 0) {
        return false;
      }

      const codeRecord = authCode[0];

      // Check if used or expired
      if (codeRecord.used_at !== null || new Date() > new Date(codeRecord.expires_at)) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking code validity:', error);
      return false;
    }
  }
}
