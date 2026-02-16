import { DatabaseService } from './DatabaseService.js';

export interface DraftPerk {
  id: number;
  name: string;
  category: string;
  type: string;
  effect_type: string;
  effect_config: any;
  tier: number;
  title: string;
  description: string;
}

export class PerkDraftService {
  private static instance: PerkDraftService;
  private db: DatabaseService;

  private constructor() {
    this.db = DatabaseService.getInstance();
  }

  public static getInstance(): PerkDraftService {
    if (!PerkDraftService.instance) {
      PerkDraftService.instance = new PerkDraftService();
    }
    return PerkDraftService.instance;
  }

  /**
   * Get all 40 gameplay perks from the database
   */
  async getAllGameplayPerks(): Promise<DraftPerk[]> {
    const result = await this.db.query(`
      SELECT id, name, category, type, effect_type, effect_config, tier, title, description
      FROM perks
      WHERE type = 'gameplay' AND is_active = true
      ORDER BY category, tier, name
    `);
    return result.rows as DraftPerk[];
  }

  /**
   * Get all active gameplay perks for a user (level-based unlocking)
   */
  async getActiveGameplayPerks(userId: number): Promise<DraftPerk[]> {
    const result = await this.db.query(`
      SELECT p.id, p.name, p.category, p.type, p.effect_type, p.effect_config, p.tier, p.title, p.description
      FROM perks p
      WHERE p.type = 'gameplay' AND p.is_active = true
      AND p.level_required <= (
        SELECT COALESCE(
          (SELECT character_level FROM user_game_profiles WHERE auth_user_id = $1),
          (SELECT character_level FROM users WHERE id = $1),
          0
        )
      )
      ORDER BY p.level_required ASC
    `, [userId]);
    return result.rows as DraftPerk[];
  }

  /**
   * Get perks newly unlocked between two levels (for level-up notifications)
   */
  async getNewlyUnlockedPerks(oldLevel: number, newLevel: number): Promise<DraftPerk[]> {
    const result = await this.db.query(`
      SELECT id, name, category, type, effect_type, effect_config, tier, title, description
      FROM perks
      WHERE type = 'gameplay' AND is_active = true
      AND level_required > $1 AND level_required <= $2
      ORDER BY level_required ASC
    `, [oldLevel, newLevel]);
    return result.rows as DraftPerk[];
  }
}
