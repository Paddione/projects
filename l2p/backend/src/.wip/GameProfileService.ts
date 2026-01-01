import { DatabaseService } from './DatabaseService.js';

export interface GameProfile {
  authUserId: number;
  selectedCharacter: string;
  characterLevel: number;
  experiencePoints: number;
  preferences: {
    language: string;
    theme: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface UpdateGameProfileData {
  selectedCharacter?: string;
  characterLevel?: number;
  experiencePoints?: number;
  preferences?: {
    language?: string;
    theme?: string;
  };
}

/**
 * GameProfileService
 * Manages game-specific user data linked to auth service users
 */
export class GameProfileService {
  private db: DatabaseService;

  constructor(db?: DatabaseService) {
    this.db = db || new DatabaseService();
  }

  /**
   * Get or create game profile for a user
   * Automatically creates profile if it doesn't exist
   */
  async getOrCreateProfile(authUserId: number): Promise<GameProfile> {
    try {
      // Use PostgreSQL function to get or create profile
      const result = await this.db.query(
        'SELECT * FROM get_or_create_game_profile($1)',
        [authUserId]
      );

      if (result.rows.length === 0) {
        throw new Error('Failed to get or create game profile');
      }

      return this.mapRowToProfile(result.rows[0]);
    } catch (error) {
      console.error('Error getting or creating game profile:', error);
      throw error;
    }
  }

  /**
   * Get game profile (returns null if not found)
   */
  async getProfile(authUserId: number): Promise<GameProfile | null> {
    try {
      const result = await this.db.query(
        'SELECT * FROM user_game_profiles WHERE auth_user_id = $1',
        [authUserId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return this.mapRowToProfile(result.rows[0]);
    } catch (error) {
      console.error('Error getting game profile:', error);
      throw error;
    }
  }

  /**
   * Update game profile
   */
  async updateProfile(authUserId: number, data: UpdateGameProfileData): Promise<GameProfile> {
    try {
      // Build dynamic UPDATE query
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (data.selectedCharacter !== undefined) {
        updates.push(`selected_character = $${paramIndex++}`);
        values.push(data.selectedCharacter);
      }

      if (data.characterLevel !== undefined) {
        updates.push(`character_level = $${paramIndex++}`);
        values.push(data.characterLevel);
      }

      if (data.experiencePoints !== undefined) {
        updates.push(`experience_points = $${paramIndex++}`);
        values.push(data.experiencePoints);
      }

      if (data.preferences !== undefined) {
        updates.push(`preferences = preferences || $${paramIndex++}::jsonb`);
        values.push(JSON.stringify(data.preferences));
      }

      if (updates.length === 0) {
        // No updates, just return existing profile
        const existing = await this.getProfile(authUserId);
        if (!existing) {
          throw new Error('Game profile not found');
        }
        return existing;
      }

      // Add auth_user_id to values
      values.push(authUserId);

      const query = `
        UPDATE user_game_profiles
        SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
        WHERE auth_user_id = $${paramIndex}
        RETURNING *
      `;

      const result = await this.db.query(query, values);

      if (result.rows.length === 0) {
        throw new Error('Game profile not found');
      }

      return this.mapRowToProfile(result.rows[0]);
    } catch (error) {
      console.error('Error updating game profile:', error);
      throw error;
    }
  }

  /**
   * Add experience points to user
   */
  async addExperience(authUserId: number, points: number): Promise<GameProfile> {
    try {
      const result = await this.db.query(
        `UPDATE user_game_profiles
         SET experience_points = experience_points + $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE auth_user_id = $2
         RETURNING *`,
        [points, authUserId]
      );

      if (result.rows.length === 0) {
        throw new Error('Game profile not found');
      }

      return this.mapRowToProfile(result.rows[0]);
    } catch (error) {
      console.error('Error adding experience:', error);
      throw error;
    }
  }

  /**
   * Level up user
   */
  async levelUp(authUserId: number): Promise<GameProfile> {
    try {
      const result = await this.db.query(
        `UPDATE user_game_profiles
         SET character_level = character_level + 1,
             updated_at = CURRENT_TIMESTAMP
         WHERE auth_user_id = $1
         RETURNING *`,
        [authUserId]
      );

      if (result.rows.length === 0) {
        throw new Error('Game profile not found');
      }

      return this.mapRowToProfile(result.rows[0]);
    } catch (error) {
      console.error('Error leveling up:', error);
      throw error;
    }
  }

  /**
   * Get top players by level
   */
  async getTopPlayers(limit: number = 10): Promise<GameProfile[]> {
    try {
      const result = await this.db.query(
        `SELECT * FROM user_game_profiles
         ORDER BY character_level DESC, experience_points DESC
         LIMIT $1`,
        [limit]
      );

      return result.rows.map(row => this.mapRowToProfile(row));
    } catch (error) {
      console.error('Error getting top players:', error);
      throw error;
    }
  }

  /**
   * Delete game profile
   */
  async deleteProfile(authUserId: number): Promise<void> {
    try {
      await this.db.query(
        'DELETE FROM user_game_profiles WHERE auth_user_id = $1',
        [authUserId]
      );
    } catch (error) {
      console.error('Error deleting game profile:', error);
      throw error;
    }
  }

  /**
   * Map database row to GameProfile object
   */
  private mapRowToProfile(row: any): GameProfile {
    return {
      authUserId: row.auth_user_id,
      selectedCharacter: row.selected_character,
      characterLevel: row.character_level,
      experiencePoints: row.experience_points,
      preferences: typeof row.preferences === 'string'
        ? JSON.parse(row.preferences)
        : row.preferences,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}
