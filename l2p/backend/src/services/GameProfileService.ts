import { DatabaseService } from './DatabaseService.js';

export interface GameProfile {
  authUserId: number;
  selectedCharacter: string;
  characterLevel: number;
  experiencePoints: number;
  preferences: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export class GameProfileService {
  private db: DatabaseService;

  constructor() {
    this.db = DatabaseService.getInstance();
  }

  async getOrCreateProfile(authUserId: number): Promise<GameProfile> {
    console.log('[GameProfileService] getOrCreateProfile called for authUserId:', authUserId, 'type:', typeof authUserId);

    if (!Number.isFinite(authUserId)) {
      console.error('[GameProfileService] Invalid auth user id:', authUserId);
      throw new Error('Invalid auth user id for game profile');
    }

    const insertQuery = `
      INSERT INTO user_game_profiles (auth_user_id)
      VALUES ($1)
      ON CONFLICT (auth_user_id) DO NOTHING
      RETURNING auth_user_id, selected_character, character_level, experience_points, preferences, created_at, updated_at
    `;

    console.log('[GameProfileService] Attempting INSERT with authUserId:', authUserId);
    const insertResult = await this.db.query(insertQuery, [authUserId]);
    console.log('[GameProfileService] INSERT result rows:', insertResult.rows.length);
    let row = insertResult.rows[0];

    if (!row) {
      console.log('[GameProfileService] No row from INSERT, attempting SELECT for authUserId:', authUserId);
      const selectQuery = `
        SELECT auth_user_id, selected_character, character_level, experience_points, preferences, created_at, updated_at
        FROM user_game_profiles
        WHERE auth_user_id = $1
      `;
      const selectResult = await this.db.query(selectQuery, [authUserId]);
      console.log('[GameProfileService] SELECT result rows:', selectResult.rows.length);
      row = selectResult.rows[0];
    }

    if (!row) {
      console.error('[GameProfileService] Game profile not found after INSERT and SELECT for authUserId:', authUserId);
      throw new Error('Game profile not found');
    }

    console.log('[GameProfileService] Game profile found:', { authUserId: row['auth_user_id'], selectedCharacter: row['selected_character'] });

    return {
      authUserId: row['auth_user_id'],
      selectedCharacter: row['selected_character'] ?? 'student',
      characterLevel: row['character_level'] ?? 1,
      experiencePoints: row['experience_points'] ?? 0,
      preferences: this.parsePreferences(row['preferences']),
      createdAt: row['created_at'],
      updatedAt: row['updated_at']
    };
  }

  private parsePreferences(value: unknown): Record<string, unknown> {
    if (!value) {
      return { language: 'en', theme: 'light' };
    }

    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object') {
          return parsed as Record<string, unknown>;
        }
      } catch {
        return { language: 'en', theme: 'light' };
      }
    }

    if (typeof value === 'object') {
      return value as Record<string, unknown>;
    }

    return { language: 'en', theme: 'light' };
  }
}
