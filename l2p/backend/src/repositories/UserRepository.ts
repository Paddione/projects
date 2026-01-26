import { BaseRepository } from './BaseRepository.js';
import { buildOrderBy, MAX_LIMIT } from '../utils/pagination.js';

import { User } from '../types/User.js';

// Re-export User type for convenience
export type { User };

export interface CreateUserData {
  username: string;
  email: string;
  password_hash: string;
  email_verified?: boolean;
  email_verification_token?: string;
  email_verification_expires?: Date;
  selected_character?: string;
  character_level?: number;
  experience_points?: number;
  is_admin?: boolean;
  is_active?: boolean;
  preferences?: {
    language: 'en' | 'de';
    theme: 'light' | 'dark';
  };
  avatar_url?: string;
  timezone?: string;
  notification_settings?: {
    email: boolean;
    push: boolean;
  };
}

export interface UpdateUserData {
  username?: string;
  email?: string;
  password_hash?: string;
  email_verified?: boolean;
  email_verification_token?: string | null;
  email_verification_expires?: Date | null;
  password_reset_token?: string | null;
  password_reset_expires?: Date | null;
  selected_character?: string;
  character_level?: number;
  experience_points?: number;
  last_login?: Date;
  is_active?: boolean;
  is_admin?: boolean;
  preferences?: {
    language: 'en' | 'de';
    theme: 'light' | 'dark';
  };
  avatar_url?: string;
  timezone?: string;
  notification_settings?: {
    email: boolean;
    push: boolean;
  };
}

export class UserRepository extends BaseRepository {
  private readonly tableName = 'users';

  async findUserById(id: number): Promise<User | null> {
    return super.findById<User>(this.tableName, id);
  }

  async findByUsername(username: string): Promise<User | null> {
    const result = await this.getDb().query<User>(
      'SELECT * FROM users WHERE LOWER(username) = LOWER($1)',
      [username]
    );
    return result.rows[0] || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.getDb().query<User>(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    return result.rows[0] || null;
  }

  async createUser(userData: CreateUserData): Promise<User> {
    const defaultPreferences = {
      language: 'en' as const,
      theme: 'light' as const
    };

    const defaultNotificationSettings = {
      email: true,
      push: true
    };

    const data = {
      ...userData,
      email_verified: userData.email_verified || false,
      selected_character: userData.selected_character || 'student',
      character_level: userData.character_level || 1,
      experience_points: userData.experience_points || 0,
      // Ensure new users are active by default to satisfy auth flow in tests
      is_active: userData.is_active ?? true,
      is_admin: userData.is_admin ?? false,
      preferences: userData.preferences || defaultPreferences,
      notification_settings: userData.notification_settings || defaultNotificationSettings,
      timezone: userData.timezone || 'UTC'
    };

    return super.create<User>(this.tableName, data);
  }

  async updateUser(id: number, userData: UpdateUserData): Promise<User | null> {
    return super.update<User>(this.tableName, id, userData);
  }

  async deleteUser(id: number): Promise<boolean> {
    return super.delete(this.tableName, id);
  }

  async findAllUsers(limit?: number, offset?: number): Promise<User[]> {
    return super.findAll<User>(this.tableName, limit, offset);
  }

  /**
   * Paginated user listing with optional search and total count.
   * Sorting is whitelisted for safety; falls back to created_at DESC.
   */
  async listUsersPaginated(params: {
    limit: number;
    offset: number;
    sort: string;
    dir: 'ASC' | 'DESC';
    q?: string;
  }): Promise<{ items: User[]; total: number }> {
    const allowedSort = new Set([
      'id',
      'username',
      'email',
      'created_at',
      'last_login',
      'character_level',
      'experience_points',
      'is_active',
      'is_admin'
    ]);

    const sort = allowedSort.has(params.sort) ? params.sort : 'created_at';
    const dir = params.dir === 'ASC' ? 'ASC' : 'DESC';
    const limit = Math.min(Math.max(1, params.limit), MAX_LIMIT);
    const offset = Math.max(0, params.offset);

    const where: string[] = [];
    const values: (string | number)[] = [];

    if (params.q && params.q.trim() !== '') {
      values.push(`%${params.q}%`);
      where.push('(username ILIKE $' + values.length + ' OR email ILIKE $' + values.length + ')');
    }

    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

    // total count
    const countRes = await this.getDb().query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM ${this.tableName} ${whereSql}`,
      values
    );
    const total = parseInt(countRes.rows[0]!.count, 10);

    // items with pagination and stable secondary sort by id
    values.push(limit);
    values.push(offset);
    const limitIdx = values.length - 1;
    const offsetIdx = values.length;

    const orderBy = buildOrderBy(sort, dir, 'id');
    const result = await this.getDb().query<User>(
      `SELECT * FROM ${this.tableName}
       ${whereSql}
       ORDER BY ${orderBy}
       LIMIT $${limitIdx} OFFSET $${offsetIdx}`,
      values
    );

    return { items: result.rows, total };
  }

  async findActiveUsers(limit?: number): Promise<User[]> {
    let query = 'SELECT * FROM users WHERE is_active = true ORDER BY created_at DESC';
    const params: number[] = [];

    if (limit) {
      query += ` LIMIT $1`;
      params.push(limit);
    }

    const result = await this.getDb().query<User>(query, params);
    return result.rows;
  }

  async updateLastLogin(id: number): Promise<void> {
    await this.getDb().query(
      'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [id]
    );
  }

  async usernameExists(username: string): Promise<boolean> {
    return super.exists(this.tableName, 'username', username);
  }

  async emailExists(email: string): Promise<boolean> {
    return super.exists(this.tableName, 'email', email);
  }

  async getUserCount(): Promise<number> {
    return super.count(this.tableName);
  }

  async getActiveUserCount(): Promise<number> {
    return super.count(this.tableName, 'is_active = $1', [true]);
  }

  async searchUsers(searchTerm: string, limit: number = 10): Promise<User[]> {
    const result = await this.getDb().query<User>(
      `SELECT * FROM users 
       WHERE (username ILIKE $1 OR email ILIKE $1) 
       AND is_active = true 
       ORDER BY username 
       LIMIT $2`,
      [`%${searchTerm}%`, limit]
    );
    return result.rows;
  }

  async updatePreferences(id: number, preferences: User['preferences']): Promise<User | null> {
    const result = await this.getDb().query<User>(
      'UPDATE users SET preferences = $1 WHERE id = $2 RETURNING *',
      [JSON.stringify(preferences), id]
    );
    return result.rows[0] || null;
  }

  async getUsersByTimezone(timezone: string): Promise<User[]> {
    const result = await this.getDb().query<User>(
      'SELECT * FROM users WHERE timezone = $1 AND is_active = true',
      [timezone]
    );
    return result.rows;
  }

  // Email verification methods
  async findByEmailVerificationToken(token: string): Promise<User | null> {
    const result = await this.getDb().query<User>(
      'SELECT * FROM users WHERE email_verification_token = $1 AND email_verification_expires > NOW()',
      [token]
    );
    return result.rows[0] || null;
  }

  async setEmailVerificationToken(userId: number, token: string, expiresAt: Date): Promise<void> {
    await this.getDb().query(
      'UPDATE users SET email_verification_token = $1, email_verification_expires = $2 WHERE id = $3',
      [token, expiresAt, userId]
    );
  }

  async verifyEmail(token: string): Promise<User | null> {
    const result = await this.getDb().query<User>(
      `UPDATE users 
       SET email_verified = true, 
           email_verification_token = NULL, 
           email_verification_expires = NULL 
       WHERE email_verification_token = $1 
       AND email_verification_expires > NOW() 
       RETURNING *`,
      [token]
    );
    return result.rows[0] || null;
  }

  // Password reset methods
  async findByPasswordResetToken(token: string): Promise<User | null> {
    const result = await this.getDb().query<User>(
      'SELECT * FROM users WHERE password_reset_token = $1 AND password_reset_expires > NOW()',
      [token]
    );
    return result.rows[0] || null;
  }

  async setPasswordResetToken(userId: number, token: string, expiresAt: Date): Promise<void> {
    await this.getDb().query(
      'UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3',
      [token, expiresAt, userId]
    );
  }

  async resetPassword(token: string, newPasswordHash: string): Promise<User | null> {
    const result = await this.getDb().query<User>(
      `UPDATE users 
       SET password_hash = $1, 
           password_reset_token = NULL, 
           password_reset_expires = NULL 
       WHERE password_reset_token = $2 
       AND password_reset_expires > NOW() 
       RETURNING *`,
      [newPasswordHash, token]
    );
    return result.rows[0] || null;
  }

  async clearPasswordResetToken(userId: number): Promise<void> {
    await this.getDb().query(
      'UPDATE users SET password_reset_token = NULL, password_reset_expires = NULL WHERE id = $1',
      [userId]
    );
  }

  /**
   * Increment failed login attempts for a user
   */
  async incrementFailedLoginAttempts(username: string): Promise<void> {
    try {
      await this.getDb().query(`
        UPDATE users 
        SET failed_login_attempts = COALESCE(failed_login_attempts, 0) + 1,
            last_failed_login = NOW()
        WHERE username = $1
      `, [username]);
    } catch (error) {
      console.error('UserRepository.incrementFailedLoginAttempts error:', error);
      throw new Error('Failed to increment failed login attempts');
    }
  }

  /**
   * Reset failed login attempts for a user
   */
  async resetFailedLoginAttempts(username: string): Promise<void> {
    try {
      await this.getDb().query(`
        UPDATE users 
        SET failed_login_attempts = 0,
            last_failed_login = NULL
        WHERE username = $1
      `, [username]);
    } catch (error) {
      console.error('UserRepository.resetFailedLoginAttempts error:', error);
      throw new Error('Failed to reset failed login attempts');
    }
  }

  /**
   * Lock user account temporarily
   */
  async lockAccount(username: string): Promise<void> {
    try {
      await this.getDb().query(`
        UPDATE users 
        SET account_locked_until = NOW() + INTERVAL '15 minutes'
        WHERE username = $1
      `, [username]);
    } catch (error) {
      console.error('UserRepository.lockAccount error:', error);
      throw new Error('Failed to lock account');
    }
  }

  /**
   * Add token to blacklist
   */
  async addToBlacklist(token: string, expiresAt: number): Promise<void> {
    try {
      await this.getDb().query(`
        INSERT INTO token_blacklist (token, expires_at, created_at)
        VALUES ($1, to_timestamp($2), NOW())
        ON CONFLICT (token) DO NOTHING
      `, [token, expiresAt]);
    } catch (error) {
      console.error('UserRepository.addToBlacklist error:', error);
      throw new Error('Failed to blacklist token');
    }
  }

  /**
   * Check if token is blacklisted
   */
  async isTokenBlacklisted(token: string): Promise<boolean> {
    try {
      const result = await this.getDb().query(`
        SELECT 1 FROM token_blacklist 
        WHERE token = $1 AND expires_at > NOW()
      `, [token]);
      return result.rows.length > 0;
    } catch (error) {
      console.error('UserRepository.isTokenBlacklisted error:', error);
      return false; // Fail safe - don't block valid tokens due to DB errors
    }
  }
}
