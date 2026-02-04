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

export interface DraftOffer {
  level: number;
  perks: DraftPerk[];
  drafted: boolean;
  dumped: boolean;
  chosenPerkId?: number;
}

export interface DraftRecord {
  id: number;
  user_id: number;
  level: number;
  offered_perk_ids: number[];
  chosen_perk_id: number | null;
  dumped: boolean;
  drafted_at: Date;
  chosenPerk?: DraftPerk;
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
   * Get the available pool: all gameplay perks minus those already picked or dumped
   */
  async getAvailablePool(userId: number): Promise<DraftPerk[]> {
    const result = await this.db.query(`
      SELECT p.id, p.name, p.category, p.type, p.effect_type, p.effect_config, p.tier, p.title, p.description
      FROM perks p
      WHERE p.type = 'gameplay' AND p.is_active = true
      AND p.id NOT IN (
        SELECT unnest(offered_perk_ids)
        FROM user_perk_drafts
        WHERE user_id = $1 AND (chosen_perk_id IS NOT NULL OR dumped = true)
      )
    `, [userId]);
    return result.rows as DraftPerk[];
  }

  /**
   * Generate a draft offer of 3 random perks for a given level.
   * Returns existing offer if one already exists for this level.
   */
  async generateDraftOffer(userId: number, forLevel: number): Promise<DraftOffer> {
    // Check if a draft already exists for this level
    const existing = await this.db.query(
      'SELECT * FROM user_perk_drafts WHERE user_id = $1 AND level = $2',
      [userId, forLevel]
    );

    if (existing.rows.length > 0) {
      const row = existing.rows[0]!;
      const perkIds = row['offered_perk_ids'] as number[];
      const perks = await this.getPerksByIds(perkIds);
      return {
        level: forLevel,
        perks,
        drafted: row['chosen_perk_id'] != null || row['dumped'] === true,
        dumped: row['dumped'] as boolean,
        chosenPerkId: row['chosen_perk_id'] as number | undefined,
      };
    }

    // Get available pool
    const pool = await this.getAvailablePool(userId);

    if (pool.length === 0) {
      return { level: forLevel, perks: [], drafted: false, dumped: false };
    }

    // Pick up to 3 random perks
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    const offered = shuffled.slice(0, Math.min(3, pool.length));
    const offeredIds = offered.map(p => p.id);

    // Store the draft offer
    await this.db.query(`
      INSERT INTO user_perk_drafts (user_id, level, offered_perk_ids)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, level) DO NOTHING
    `, [userId, forLevel, offeredIds]);

    return {
      level: forLevel,
      perks: offered,
      drafted: false,
      dumped: false,
    };
  }

  /**
   * Pick a perk from a draft offer
   */
  async pickPerk(userId: number, level: number, perkId: number): Promise<{ success: boolean; error?: string }> {
    // Validate the draft exists and perk is in the offer
    const draft = await this.db.query(
      'SELECT * FROM user_perk_drafts WHERE user_id = $1 AND level = $2',
      [userId, level]
    );

    if (draft.rows.length === 0) {
      return { success: false, error: 'No draft offer found for this level' };
    }

    const row = draft.rows[0]!;
    if (row['chosen_perk_id'] != null || row['dumped'] === true) {
      return { success: false, error: 'This draft has already been resolved' };
    }

    const offeredIds = row['offered_perk_ids'] as number[];
    if (!offeredIds.includes(perkId)) {
      return { success: false, error: 'Perk not in the offered set' };
    }

    // Set the chosen perk
    await this.db.query(
      'UPDATE user_perk_drafts SET chosen_perk_id = $1, drafted_at = CURRENT_TIMESTAMP WHERE user_id = $2 AND level = $3',
      [perkId, userId, level]
    );

    return { success: true };
  }

  /**
   * Dump all 3 offered perks (permanently remove from pool)
   */
  async dumpOffer(userId: number, level: number): Promise<{ success: boolean; error?: string }> {
    const draft = await this.db.query(
      'SELECT * FROM user_perk_drafts WHERE user_id = $1 AND level = $2',
      [userId, level]
    );

    if (draft.rows.length === 0) {
      return { success: false, error: 'No draft offer found for this level' };
    }

    const row = draft.rows[0]!;
    if (row['chosen_perk_id'] != null || row['dumped'] === true) {
      return { success: false, error: 'This draft has already been resolved' };
    }

    await this.db.query(
      'UPDATE user_perk_drafts SET dumped = true, drafted_at = CURRENT_TIMESTAMP WHERE user_id = $1 AND level = $2',
      [userId, level]
    );

    return { success: true };
  }

  /**
   * Full reset: delete all drafts, return full pool
   */
  async resetDrafts(userId: number): Promise<{ success: boolean; poolSize: number }> {
    await this.db.query(
      'DELETE FROM user_perk_drafts WHERE user_id = $1',
      [userId]
    );

    const pool = await this.getAvailablePool(userId);
    return { success: true, poolSize: pool.length };
  }

  /**
   * Get all active gameplay perks for a user (where chosen_perk_id IS NOT NULL)
   */
  async getActiveGameplayPerks(userId: number): Promise<DraftPerk[]> {
    const result = await this.db.query(`
      SELECT p.id, p.name, p.category, p.type, p.effect_type, p.effect_config, p.tier, p.title, p.description
      FROM perks p
      INNER JOIN user_perk_drafts d ON d.chosen_perk_id = p.id
      WHERE d.user_id = $1 AND d.chosen_perk_id IS NOT NULL
      ORDER BY d.level ASC
    `, [userId]);
    return result.rows as DraftPerk[];
  }

  /**
   * Get pending draft levels: levels 1..min(currentLevel, 30) without a completed draft
   */
  async getPendingDraftLevels(userId: number, currentLevel: number): Promise<number[]> {
    const maxLevel = Math.min(currentLevel, 30);
    if (maxLevel < 1) return [];

    const result = await this.db.query(`
      SELECT level FROM user_perk_drafts
      WHERE user_id = $1 AND (chosen_perk_id IS NOT NULL OR dumped = true)
    `, [userId]);

    const completedLevels = new Set(result.rows.map(r => r['level'] as number));
    const pending: number[] = [];
    for (let i = 1; i <= maxLevel; i++) {
      if (!completedLevels.has(i)) {
        pending.push(i);
      }
    }
    return pending;
  }

  /**
   * Get full draft history for skill tree
   */
  async getDraftHistory(userId: number): Promise<DraftRecord[]> {
    const result = await this.db.query(`
      SELECT d.*, p.name as perk_name, p.category as perk_category, p.type as perk_type,
             p.effect_type as perk_effect_type, p.effect_config as perk_effect_config,
             p.tier as perk_tier, p.title as perk_title, p.description as perk_description
      FROM user_perk_drafts d
      LEFT JOIN perks p ON d.chosen_perk_id = p.id
      WHERE d.user_id = $1
      ORDER BY d.level ASC
    `, [userId]);

    return result.rows.map(row => ({
      id: row['id'] as number,
      user_id: row['user_id'] as number,
      level: row['level'] as number,
      offered_perk_ids: row['offered_perk_ids'] as number[],
      chosen_perk_id: row['chosen_perk_id'] as number | null,
      dumped: row['dumped'] as boolean,
      drafted_at: row['drafted_at'] as Date,
      chosenPerk: row['chosen_perk_id'] ? {
        id: row['chosen_perk_id'] as number,
        name: row['perk_name'] as string,
        category: row['perk_category'] as string,
        type: row['perk_type'] as string,
        effect_type: row['perk_effect_type'] as string,
        effect_config: row['perk_effect_config'],
        tier: row['perk_tier'] as number,
        title: row['perk_title'] as string,
        description: row['perk_description'] as string,
      } : undefined,
    }));
  }

  /**
   * Check if user needs redraft (migration flag)
   */
  async needsRedraft(userId: number): Promise<boolean> {
    // Check both tables
    const profileResult = await this.db.query(
      'SELECT needs_perk_redraft FROM user_game_profiles WHERE auth_user_id = $1',
      [userId]
    );
    if (profileResult.rows.length > 0 && profileResult.rows[0]!['needs_perk_redraft']) {
      return true;
    }

    const userResult = await this.db.query(
      'SELECT needs_perk_redraft FROM users WHERE id = $1',
      [userId]
    );
    if (userResult.rows.length > 0 && userResult.rows[0]!['needs_perk_redraft']) {
      return true;
    }

    return false;
  }

  /**
   * Clear the redraft flag after user has completed their re-drafting
   */
  async clearRedraftFlag(userId: number): Promise<void> {
    await this.db.query(
      'UPDATE user_game_profiles SET needs_perk_redraft = false WHERE auth_user_id = $1',
      [userId]
    );
    await this.db.query(
      'UPDATE users SET needs_perk_redraft = false WHERE id = $1',
      [userId]
    );
  }

  /**
   * Get skill tree data: combined draft history + all perk definitions
   */
  async getSkillTreeData(userId: number): Promise<{
    allPerks: DraftPerk[];
    history: DraftRecord[];
    activePerks: DraftPerk[];
    poolSize: number;
  }> {
    const [allPerks, history, activePerks, pool] = await Promise.all([
      this.getAllGameplayPerks(),
      this.getDraftHistory(userId),
      this.getActiveGameplayPerks(userId),
      this.getAvailablePool(userId),
    ]);

    return { allPerks, history, activePerks, poolSize: pool.length };
  }

  /**
   * Helper: get perks by IDs
   */
  private async getPerksByIds(ids: number[]): Promise<DraftPerk[]> {
    if (ids.length === 0) return [];
    const result = await this.db.query(`
      SELECT id, name, category, type, effect_type, effect_config, tier, title, description
      FROM perks
      WHERE id = ANY($1)
    `, [ids]);
    return result.rows as DraftPerk[];
  }
}
