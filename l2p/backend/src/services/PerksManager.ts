import { DatabaseService } from './DatabaseService.js';

export interface Perk {
  id: number;
  name: string;
  category: string;
  type: string;
  level_required: number;
  title: string;
  description: string;
  config_schema?: any;
  asset_data?: any;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface UserPerk {
  id: number;
  user_id: number;
  perk_id: number;
  is_unlocked: boolean;
  is_active: boolean;
  configuration: any;
  unlocked_at?: Date;
  activated_at?: Date;
  updated_at: Date;
  // Joined perk data
  perk?: Perk;
}

export interface UserLoadout {
  user_id: number;
  active_avatar: string;
  active_badge?: string;
  active_theme: string;
  perks_config: any;
  active_perks: UserPerk[];
}

export class PerksManager {
  private static instance: PerksManager;
  private db: DatabaseService;
  private perksCache: Map<number, Perk> = new Map();
  private cacheTimestamp: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.db = DatabaseService.getInstance();
  }

  public static getInstance(): PerksManager {
    if (!PerksManager.instance) {
      PerksManager.instance = new PerksManager();
    }
    return PerksManager.instance;
  }

  /**
   * Get all available perks (with caching)
   * After migration, perks table uses tier/effect_type instead of level_required
   */
  async getAllPerks(): Promise<Perk[]> {
    // Check cache validity
    if (this.isCacheValid()) {
      return Array.from(this.perksCache.values());
    }

    const query = `
      SELECT * FROM perks
      WHERE is_active = true
      ORDER BY tier ASC, category ASC
    `;

    const result = await this.db.query(query);
    const perks = result.rows as Perk[];

    // Update cache
    this.updateCache(perks);

    return perks;
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(): boolean {
    return this.perksCache.size > 0 && (Date.now() - this.cacheTimestamp) < this.CACHE_TTL;
  }

  /**
   * Update the perks cache
   */
  private updateCache(perks: Perk[]): void {
    this.perksCache.clear();
    perks.forEach(perk => this.perksCache.set(perk.id, perk));
    this.cacheTimestamp = Date.now();
  }

  /**
   * Invalidate the cache (call when perks are modified)
   */
  public invalidateCache(): void {
    this.perksCache.clear();
    this.cacheTimestamp = 0;
  }

  /**
   * Get or create legacy user ID for OAuth users
   * This is a bridge function to allow OAuth users to use the perks system
   * which currently requires a legacy user_id from the users table
   */
  private async getLegacyUserId(authUserId: number): Promise<number> {
    const query = 'SELECT get_or_create_legacy_user_id($1) as legacy_user_id';
    const result = await this.db.query(query, [authUserId]);
    if (!result.rows[0]) {
      throw new Error('Failed to get legacy user ID for OAuth user');
    }
    return result.rows[0]['legacy_user_id'];
  }

  /**
   * Get perks available for a specific level (now returns all gameplay perks since level_required was removed)
   */
  async getPerksForLevel(level: number): Promise<Perk[]> {
    const query = `
      SELECT *, 0 AS level_required FROM perks
      WHERE is_active = true
      ORDER BY tier ASC, category ASC
    `;

    const result = await this.db.query(query);
    return result.rows as Perk[];
  }

  /**
   * Get all perks for a user (draft-based: shows all gameplay perks with draft status)
   */
  async getUserPerks(userId: number): Promise<UserPerk[]> {
    // After migration: perks are draft-based gameplay perks (no level_required column).
    // Show all perks with their draft status from user_perk_drafts.
    const query = `
      SELECT
        p.id                AS perk_master_id,
        p.name              AS perk_name,
        p.category          AS perk_category,
        p.type              AS perk_type,
        p.tier              AS perk_tier,
        p.title             AS perk_title,
        p.description       AS perk_description,
        p.effect_type       AS perk_effect_type,
        p.effect_config     AS perk_effect_config,
        p.asset_data        AS perk_asset_data,
        p.created_at        AS perk_created_at,
        p.updated_at        AS perk_updated_at,
        d.chosen_perk_id    AS draft_chosen_perk_id
      FROM perks p
      LEFT JOIN user_perk_drafts d
        ON d.chosen_perk_id = p.id AND d.user_id = $1
      WHERE p.is_active = true
      ORDER BY p.tier ASC, p.category ASC
    `;

    const result = await this.db.query(query, [userId]);
    return result.rows.map(row => {
      const perkId = row['perk_master_id'] as number;
      const isChosen = row['draft_chosen_perk_id'] != null;

      return {
        id: perkId,
        user_id: userId,
        perk_id: perkId,
        is_unlocked: isChosen,
        is_active: isChosen,
        configuration: row['perk_effect_config'] ?? {},
        updated_at: (row['perk_updated_at'] as Date) ?? new Date(),
        perk: {
          id: perkId,
          name: row['perk_name'] as string,
          category: row['perk_category'] as string,
          type: row['perk_type'] as string,
          level_required: (row['perk_tier'] as number) ?? 0,
          title: row['perk_title'] as string,
          description: row['perk_description'] as string,
          asset_data: row['perk_asset_data'],
          is_active: true,
          created_at: (row['perk_created_at'] as Date) ?? new Date(),
          updated_at: (row['perk_updated_at'] as Date) ?? new Date(),
        },
      } as UserPerk;
    });
  }

  /**
   * Get only unlocked/chosen perks for a user (draft-based)
   */
  async getUnlockedPerks(userId: number): Promise<UserPerk[]> {
    const query = `
      SELECT p.*, d.level AS draft_level, 0 AS level_required
      FROM user_perk_drafts d
      JOIN perks p ON d.chosen_perk_id = p.id
      WHERE d.user_id = $1 AND d.chosen_perk_id IS NOT NULL
      ORDER BY d.level ASC
    `;

    const result = await this.db.query(query, [userId]);
    return result.rows.map((row: any) => ({
      id: row.id,
      user_id: userId,
      perk_id: row.id,
      is_unlocked: true,
      is_active: true,
      configuration: row.effect_config || {},
      updated_at: row.updated_at || new Date(),
      perk: {
        id: row.id,
        name: row.name,
        category: row.category,
        type: row.type,
        level_required: 0,
        title: row.title || row.name,
        description: row.description,
        asset_data: row.asset_data,
        is_active: true,
        created_at: row.created_at || new Date(),
        updated_at: row.updated_at || new Date(),
      }
    })) as UserPerk[];
  }

  /**
   * Get active perks for a user (draft-based: chosen perks from user_perk_drafts)
   */
  async getActivePerks(userId: number): Promise<UserPerk[]> {
    // Try draft-based perks first
    const draftQuery = `
      SELECT p.*, d.level AS draft_level
      FROM user_perk_drafts d
      JOIN perks p ON d.chosen_perk_id = p.id
      WHERE d.user_id = $1 AND d.chosen_perk_id IS NOT NULL
      ORDER BY d.level ASC
    `;

    try {
      const draftResult = await this.db.query(draftQuery, [userId]);
      if (draftResult.rows.length > 0) {
        return draftResult.rows.map((row: any) => ({
          id: row.id,
          user_id: userId,
          perk_id: row.id,
          is_unlocked: true,
          is_active: true,
          configuration: row.effect_config || {},
          updated_at: new Date(),
          perk: {
            id: row.id,
            name: row.name,
            category: row.category,
            type: row.type,
            level_required: 0,
            title: row.title || row.name,
            description: row.description,
            asset_data: row.asset_data,
            is_active: true,
            created_at: row.created_at,
            updated_at: row.updated_at,
          }
        })) as UserPerk[];
      }
    } catch (e) {
      // Fall through to legacy query if draft table doesn't exist yet
    }

    // Legacy fallback
    const query = `
      SELECT up.*, p.name, p.category, p.type, p.title, p.description, p.asset_data
      FROM user_perks up
      JOIN perks p ON up.perk_id = p.id
      WHERE up.user_id = $1 AND up.is_unlocked = true AND up.is_active = true
      ORDER BY p.category ASC
    `;

    const result = await this.db.query(query, [userId]);
    return result.rows as UserPerk[];
  }

  /**
   * Check if user can unlock a specific perk (legacy - perks are now draft-based)
   */
  async canUnlockPerk(userId: number, perkId: number): Promise<boolean> {
    // In the draft system, perks are chosen through the draft flow, not unlocked by level
    // Return false - perks should be acquired through the draft panel
    return false;
  }

  /**
   * Unlock a perk for a user
   */
  async unlockPerk(userId: number, perkId: number): Promise<boolean> {
    const canUnlock = await this.canUnlockPerk(userId, perkId);

    if (!canUnlock) {
      return false;
    }

    const query = `
      INSERT INTO user_perks (user_id, perk_id, is_unlocked, unlocked_at, updated_at)
      VALUES ($1, $2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, perk_id) 
      DO UPDATE SET 
        is_unlocked = true, 
        unlocked_at = CURRENT_TIMESTAMP, 
        updated_at = CURRENT_TIMESTAMP
      RETURNING id
    `;

    const result = await this.db.query(query, [userId, perkId]);
    return result.rows.length > 0;
  }

  /**
   * Activate a perk for a user
   */
  async activatePerk(userId: number, perkId: number, configuration: any = {}): Promise<boolean> {
    // Check if perk is unlocked via draft system (chosen_perk_id in user_perk_drafts)
    const unlockedQuery = `
      SELECT d.id FROM user_perk_drafts d
      WHERE d.user_id = $1 AND d.chosen_perk_id = $2
    `;
    const unlockedResult = await this.db.query(unlockedQuery, [userId, perkId]);

    if (unlockedResult.rows.length === 0) {
      return false;
    }

    // Get perk type for settings update
    const perkTypeQuery = `SELECT type FROM perks WHERE id = $1`;
    const perkTypeResult = await this.db.query(perkTypeQuery, [perkId]);

    if (perkTypeResult.rows.length === 0) {
      return false;
    }

    const perkType = perkTypeResult.rows[0]!['type'];

    // Update user's active settings based on perk type (avatar, theme, badge)
    await this.updateUserActiveSettings(userId, perkId, perkType, configuration);

    return true;
  }

  /**
   * Deactivate a perk for a user
   */
  async deactivatePerk(userId: number, perkId: number): Promise<boolean> {
    // Verify perk was chosen in draft system
    const unlockedQuery = `
      SELECT d.id FROM user_perk_drafts d
      WHERE d.user_id = $1 AND d.chosen_perk_id = $2
    `;
    const unlockedResult = await this.db.query(unlockedQuery, [userId, perkId]);

    if (unlockedResult.rows.length === 0) {
      return false;
    }

    // Get perk type to reset the corresponding user setting
    const perkTypeQuery = `SELECT type FROM perks WHERE id = $1`;
    const perkTypeResult = await this.db.query(perkTypeQuery, [perkId]);

    if (perkTypeResult.rows.length > 0) {
      const perkType = perkTypeResult.rows[0]!['type'];
      const defaults = this.getDefaultConfigurationForPerk(perkType);
      await this.updateUserActiveSettings(userId, perkId, perkType, defaults);
    }

    return true;
  }

  /**
   * Get user's current loadout (active settings)
   */
  async getUserLoadout(userId: number): Promise<UserLoadout | null> {
    const query = `
      SELECT active_avatar, active_badge, active_theme, perks_config
      FROM users 
      WHERE id = $1
    `;

    const result = await this.db.query(query, [userId]);

    if (result.rows.length === 0) {
      return null;
    }

    const user = result.rows[0]!;
    const activePerks = await this.getActivePerks(userId);

    return {
      user_id: userId,
      active_avatar: user['active_avatar'],
      active_badge: user['active_badge'],
      active_theme: user['active_theme'],
      perks_config: user['perks_config'],
      active_perks: activePerks
    };
  }

  /**
   * Legacy: Auto-unlock perks when user levels up.
   * In the new draft system, perks are acquired through the draft panel.
   * This method now returns empty — draft offers are generated by PerkDraftService.
   */
  async checkAndUnlockPerksForLevel(userId: number, newLevel: number): Promise<UserPerk[]> {
    // Perks are now draft-based. Draft offers are generated by PerkDraftService.
    return [];
  }

  /**
   * Get default configuration for perk type
   */
  private getDefaultConfigurationForPerk(perkType: string): any {
    switch (perkType) {
      case 'avatar':
        return { selected_avatar: 'student' };
      case 'theme':
        return { theme_name: 'default' };
      default:
        return {};
    }
  }

  /**
   * Get a specific user perk (draft-based: checks if perk was chosen in a draft)
   */
  private async getUserPerk(userId: number, perkId: number): Promise<UserPerk | null> {
    const query = `
      SELECT
        p.id AS perk_master_id,
        p.name AS perk_name,
        p.category AS perk_category,
        p.type AS perk_type,
        p.tier AS perk_tier,
        p.title AS perk_title,
        p.description AS perk_description,
        p.config_schema AS perk_config_schema,
        p.asset_data AS perk_asset_data,
        p.effect_config AS perk_effect_config,
        p.is_active AS perk_is_active,
        p.created_at AS perk_created_at,
        p.updated_at AS perk_updated_at,
        d.id AS draft_id,
        d.chosen_perk_id
      FROM perks p
      LEFT JOIN user_perk_drafts d ON d.chosen_perk_id = p.id AND d.user_id = $1
      WHERE p.id = $2
    `;

    const result = await this.db.query(query, [userId, perkId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0]!;
    const isChosen = row['chosen_perk_id'] != null;
    return {
      id: row['draft_id'] ?? row['perk_master_id'],
      user_id: userId,
      perk_id: row['perk_master_id'],
      is_unlocked: isChosen,
      is_active: isChosen,
      configuration: row['perk_effect_config'] ?? {},
      updated_at: row['perk_updated_at'],
      perk: {
        id: row['perk_master_id'],
        name: row['perk_name'],
        category: row['perk_category'],
        type: row['perk_type'],
        level_required: 0,
        title: row['perk_title'],
        description: row['perk_description'],
        config_schema: row['perk_config_schema'],
        asset_data: row['perk_asset_data'],
        is_active: row['perk_is_active'],
        created_at: row['perk_created_at'],
        updated_at: row['perk_updated_at']
      }
    };
  }

  /**
   * Update user's active settings when a perk is activated
   */
  private async updateUserActiveSettings(userId: number, perkId: number, perkType: string, configuration: any) {
    let updateQuery = '';
    let updateValue = '';

    switch (perkType) {
      case 'avatar':
        updateQuery = 'UPDATE users SET active_avatar = $2 WHERE id = $1';
        updateValue = configuration.selected_avatar || 'student';
        break;
      case 'badge':
        updateQuery = 'UPDATE users SET active_badge = $2 WHERE id = $1';
        // Create a badge identifier that includes the perk and style
        const badgeStyle = configuration.badge_style || configuration.color || 'classic';
        updateValue = `perk_${perkId}_${badgeStyle}`;
        break;
      case 'theme':
        updateQuery = 'UPDATE users SET active_theme = $2 WHERE id = $1';
        updateValue = configuration.theme_name || 'default';
        break;
    }

    if (updateQuery) {
      await this.db.query(updateQuery, [userId, updateValue]);
    }
  }

  /**
   * Validate perk configuration against schema
   */
  async validatePerkConfig(perkId: number, configuration: any): Promise<{ valid: boolean; errors?: string[] }> {
    // Basic type check
    if (typeof configuration !== 'object' || configuration === null) {
      return { valid: false, errors: ['Configuration must be a valid object'] };
    }

    // Get perk schema from cache or database
    let perk = this.perksCache.get(perkId);
    if (!perk) {
      const query = 'SELECT config_schema FROM perks WHERE id = $1';
      const result = await this.db.query(query, [perkId]);
      if (result.rows.length === 0) {
        return { valid: false, errors: ['Perk not found'] };
      }
      perk = result.rows[0] as Perk;
    }

    const schema = perk.config_schema;
    if (!schema) {
      // No schema defined, accept any valid object
      return { valid: true };
    }

    // Validate against config_schema
    const errors: string[] = [];
    for (const [key, schemaField] of Object.entries(schema)) {
      const field = schemaField as any;
      const value = configuration[key];

      // Check required fields
      if (field.required && value === undefined) {
        errors.push(`Field '${key}' is required`);
        continue;
      }

      if (value === undefined) continue;

      // Type validation
      if (field.type === 'enum') {
        if (!field.options || !field.options.includes(value)) {
          errors.push(`Field '${key}' must be one of: ${field.options?.join(', ')}`);
        }
      } else if (field.type === 'range') {
        const numValue = Number(value);
        if (isNaN(numValue)) {
          errors.push(`Field '${key}' must be a number`);
        } else if (field.min !== undefined && numValue < field.min) {
          errors.push(`Field '${key}' must be at least ${field.min}`);
        } else if (field.max !== undefined && numValue > field.max) {
          errors.push(`Field '${key}' must be at most ${field.max}`);
        }
      } else if (field.type === 'boolean') {
        if (typeof value !== 'boolean') {
          errors.push(`Field '${key}' must be a boolean`);
        }
      } else if (field.type === 'string') {
        if (typeof value !== 'string') {
          errors.push(`Field '${key}' must be a string`);
        }
      }
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }
    return { valid: true };
  }

  /**
   * Get perks by category
   */
  async getPerksByCategory(category: string): Promise<Perk[]> {
    const query = `
      SELECT *, 0 AS level_required FROM perks
      WHERE category = $1 AND is_active = true
      ORDER BY tier ASC
    `;

    const result = await this.db.query(query, [category]);
    return result.rows as Perk[];
  }
}
