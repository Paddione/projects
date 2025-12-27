import { db } from '../config/database.js';
import { users, oauthAccounts } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { TokenService } from './TokenService.js';

export interface GoogleProfile {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

export class OAuthService {
  private tokenService: TokenService;

  constructor() {
    this.tokenService = new TokenService();
  }

  /**
   * Handle Google OAuth callback
   * Creates or links OAuth account and returns user + tokens
   */
  async handleGoogleCallback(profile: GoogleProfile, accessToken: string, refreshToken?: string) {
    // Check if OAuth account already exists
    const existingOAuthAccount = await db
      .select()
      .from(oauthAccounts)
      .where(
        and(
          eq(oauthAccounts.provider, 'google'),
          eq(oauthAccounts.provider_account_id, profile.id)
        )
      )
      .limit(1);

    let userId: number;

    if (existingOAuthAccount.length > 0) {
      // OAuth account exists, get the user
      userId = existingOAuthAccount[0].user_id;

      // Update OAuth tokens
      await db
        .update(oauthAccounts)
        .set({
          access_token: accessToken,
          refresh_token: refreshToken || null,
          updated_at: new Date(),
        })
        .where(eq(oauthAccounts.id, existingOAuthAccount[0].id));
    } else {
      // Check if user exists by email
      const existingUser = await db
        .select()
        .from(users)
        .where(eq(users.email, profile.email))
        .limit(1);

      if (existingUser.length > 0) {
        // User exists, link OAuth account
        userId = existingUser[0].id;

        // Create OAuth account link
        await db.insert(oauthAccounts).values({
          user_id: userId,
          provider: 'google',
          provider_account_id: profile.id,
          access_token: accessToken,
          refresh_token: refreshToken || null,
        });

        // Update user verification if Google verified the email
        if (profile.verified_email && !existingUser[0].email_verified) {
          await db
            .update(users)
            .set({
              email_verified: true,
              avatar_url: profile.picture || existingUser[0].avatar_url,
              updated_at: new Date(),
            })
            .where(eq(users.id, userId));
        }
      } else {
        // Create new user + OAuth account
        const newUser = await db
          .insert(users)
          .values({
            email: profile.email,
            username: this.generateUsernameFromEmail(profile.email),
            name: profile.name,
            email_verified: profile.verified_email,
            avatar_url: profile.picture || null,
            password_hash: null, // OAuth-only account
          })
          .returning();

        userId = newUser[0].id;

        // Create OAuth account
        await db.insert(oauthAccounts).values({
          user_id: userId,
          provider: 'google',
          provider_account_id: profile.id,
          access_token: accessToken,
          refresh_token: refreshToken || null,
        });
      }
    }

    // Get user data
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      throw new Error('User not found after OAuth processing');
    }

    // Update last login
    await db
      .update(users)
      .set({ last_login: new Date() })
      .where(eq(users.id, userId));

    // Generate JWT tokens
    const tokens = this.tokenService.generateTokens(user[0]);

    return {
      user: {
        userId: user[0].id,
        email: user[0].email,
        username: user[0].username,
        name: user[0].name,
        role: user[0].role,
        emailVerified: user[0].email_verified,
        avatarUrl: user[0].avatar_url,
      },
      tokens,
    };
  }

  /**
   * Unlink OAuth provider from user account
   */
  async unlinkOAuthProvider(userId: number, provider: string) {
    // Check if user has a password set (can't unlink if it's the only auth method)
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (user.length === 0) {
      throw new Error('User not found');
    }

    if (!user[0].password_hash) {
      // Check if this is the only OAuth provider
      const oauthAccountsForUser = await db
        .select()
        .from(oauthAccounts)
        .where(eq(oauthAccounts.user_id, userId));

      if (oauthAccountsForUser.length <= 1) {
        throw new Error(
          'Cannot unlink the only authentication method. Please set a password first.'
        );
      }
    }

    // Unlink OAuth account
    await db
      .delete(oauthAccounts)
      .where(
        and(
          eq(oauthAccounts.user_id, userId),
          eq(oauthAccounts.provider, provider)
        )
      );

    return { success: true };
  }

  /**
   * Get linked OAuth providers for a user
   */
  async getLinkedProviders(userId: number) {
    const accounts = await db
      .select({
        provider: oauthAccounts.provider,
        createdAt: oauthAccounts.created_at,
      })
      .from(oauthAccounts)
      .where(eq(oauthAccounts.user_id, userId));

    return accounts;
  }

  /**
   * Generate a unique username from email
   */
  private generateUsernameFromEmail(email: string): string {
    const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
    const randomSuffix = Math.floor(Math.random() * 10000);
    return `${baseUsername}_${randomSuffix}`;
  }
}
