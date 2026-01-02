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
   */
  async getAllPerks(): Promise<Perk[]> {
    // Check cache validity
    if (this.isCacheValid()) {
      return Array.from(this.perksCache.values());
    }

    const query = `
      SELECT * FROM perks
      WHERE is_active = true
      ORDER BY level_required ASC, category ASC
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
   * Get perks available for a specific level
   */
  async getPerksForLevel(level: number): Promise<Perk[]> {
    const query = `
      SELECT * FROM perks 
      WHERE level_required <= $1 AND is_active = true 
      ORDER BY level_required ASC, category ASC
    `;

    const result = await this.db.query(query, [level]);
    return result.rows as Perk[];
  }

  /**
   * Get all perks for a user (unlocked and locked)
   */
  async getUserPerks(userId: number): Promise<UserPerk[]> {
    // Use LEFT JOIN from perks to include all perks, and join the specific user's row
    // Alias columns to avoid collisions and ensure perk id is always available
    const query = `
      SELECT 
        p.id                AS perk_master_id,
        p.name              AS perk_name,
        p.category          AS perk_category,
        p.type              AS perk_type,
        p.level_required    AS perk_level_required,
        p.title             AS perk_title,
        p.description       AS perk_description,
        p.asset_data        AS perk_asset_data,
        p.created_at        AS perk_created_at,
        p.updated_at        AS perk_updated_at,
        up.id               AS user_perk_id,
        up.user_id          AS user_perk_user_id,
        up.perk_id          AS user_perk_perk_id,
        up.is_unlocked      AS user_perk_is_unlocked,
        up.is_active        AS user_perk_is_active,
        up.configuration    AS user_perk_configuration,
        up.unlocked_at      AS user_perk_unlocked_at,
        up.activated_at     AS user_perk_activated_at,
        up.updated_at       AS user_perk_updated_at
      FROM perks p
      LEFT JOIN user_perks up 
        ON up.perk_id = p.id AND up.user_id = $1
      WHERE p.is_active = true
      ORDER BY p.level_required ASC, p.category ASC
    `;

    const result = await this.db.query(query, [userId]);
    return result.rows.map(row => {
      const perkId = row['perk_master_id'] as number;
      const userPerkId = row['user_perk_id'] as number | null;
      const isUnlocked = (row['user_perk_is_unlocked'] as boolean) ?? false;
      const isActive = (row['user_perk_is_active'] as boolean) ?? false;
      const configuration = row['user_perk_configuration'] ?? {};
      const updatedAt = (row['user_perk_updated_at'] as Date) ?? new Date();

      return {
        // Preserve an id field even when user has not unlocked the perk yet
        id: userPerkId ?? perkId,
        user_id: (row['user_perk_user_id'] as number) ?? userId,
        perk_id: perkId,
        is_unlocked: isUnlocked,
        is_active: isActive,
        configuration,
        unlocked_at: row['user_perk_unlocked_at'] as Date | undefined,
        activated_at: row['user_perk_activated_at'] as Date | undefined,
        updated_at: updatedAt,
        perk: {
          id: perkId,
          name: row['perk_name'] as string,
          category: row['perk_category'] as string,
          type: row['perk_type'] as string,
          level_required: row['perk_level_required'] as number,
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
   * Get only unlocked perks for a user
   */
  async getUnlockedPerks(userId: number): Promise<UserPerk[]> {
    const query = `
      SELECT up.*, p.name, p.category, p.type, p.level_required, p.title, p.description, p.asset_data
      FROM user_perks up
      JOIN perks p ON up.perk_id = p.id
      WHERE up.user_id = $1 AND up.is_unlocked = true
      ORDER BY p.level_required ASC, p.category ASC
    `;

    const result = await this.db.query(query, [userId]);
    return result.rows as UserPerk[];
  }

  /**
   * Get active perks for a user
   */
  async getActivePerks(userId: number): Promise<UserPerk[]> {
    const query = `
      SELECT up.*, p.name, p.category, p.type, p.level_required, p.title, p.description, p.asset_data
      FROM user_perks up
      JOIN perks p ON up.perk_id = p.id
      WHERE up.user_id = $1 AND up.is_unlocked = true AND up.is_active = true
      ORDER BY p.level_required ASC, p.category ASC
    `;

    const result = await this.db.query(query, [userId]);
    return result.rows as UserPerk[];
  }

  /**
   * Check if user can unlock a specific perk
   */
  async canUnlockPerk(userId: number, perkId: number): Promise<boolean> {
    // Get user's current level
    const userQuery = `SELECT character_level FROM users WHERE id = $1`;
    const userResult = await this.db.query(userQuery, [userId]);

    if (userResult.rows.length === 0) {
      return false;
    }

    const userLevel = userResult.rows[0]!['character_level'];

    // Get perk requirements
    const perkQuery = `SELECT level_required FROM perks WHERE id = $1 AND is_active = true`;
    const perkResult = await this.db.query(perkQuery, [perkId]);

    if (perkResult.rows.length === 0) {
      return false;
    }

    const requiredLevel = perkResult.rows[0]!['level_required'];

    // Check if already unlocked
    const unlockedQuery = `SELECT id FROM user_perks WHERE user_id = $1 AND perk_id = $2 AND is_unlocked = true`;
    const unlockedResult = await this.db.query(unlockedQuery, [userId, perkId]);

    return userLevel >= requiredLevel && unlockedResult.rows.length === 0;
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
    // First check if perk is unlocked
    const unlockedQuery = `
      SELECT id FROM user_perks 
      WHERE user_id = $1 AND perk_id = $2 AND is_unlocked = true
    `;
    const unlockedResult = await this.db.query(unlockedQuery, [userId, perkId]);

    if (unlockedResult.rows.length === 0) {
      return false;
    }

    // Deactivate other perks of the same type (only one active per type)
    const perkTypeQuery = `SELECT type FROM perks WHERE id = $1`;
    const perkTypeResult = await this.db.query(perkTypeQuery, [perkId]);

    if (perkTypeResult.rows.length === 0) {
      return false;
    }

    const perkType = perkTypeResult.rows[0]!['type'];

    // Deactivate other perks of same type
    const deactivateQuery = `
      UPDATE user_perks SET is_active = false, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND perk_id IN (
        SELECT id FROM perks WHERE type = $2
      )
    `;
    await this.db.query(deactivateQuery, [userId, perkType]);

    // Activate the selected perk
    const activateQuery = `
      UPDATE user_perks 
      SET is_active = true, configuration = $3, activated_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND perk_id = $2
      RETURNING id
    `;

    const result = await this.db.query(activateQuery, [userId, perkId, JSON.stringify(configuration)]);

    // Update user's active settings based on perk type
    if (result.rows.length > 0) {
      await this.updateUserActiveSettings(userId, perkId, perkType, configuration);
    }

    return result.rows.length > 0;
  }

  /**
   * Deactivate a perk for a user
   */
  async deactivatePerk(userId: number, perkId: number): Promise<boolean> {
    const query = `
      UPDATE user_perks 
      SET is_active = false, activated_at = null, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $1 AND perk_id = $2
      RETURNING id
    `;

    const result = await this.db.query(query, [userId, perkId]);
    return result.rows.length > 0;
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
   * Auto-unlock perks when user levels up and auto-activate non-badge perks
   * OPTIMIZED: Uses batch insert for better performance
   */
  async checkAndUnlockPerksForLevel(userId: number, newLevel: number): Promise<UserPerk[]> {
    // Get all perks that should be unlocked at this level
    const perksQuery = `
      SELECT id, type, name, title, description, category, level_required, asset_data
      FROM perks
      WHERE level_required <= $1 AND is_active = true
      AND id NOT IN (
        SELECT perk_id FROM user_perks
        WHERE user_id = $2 AND is_unlocked = true
      )
    `;

    const perksResult = await this.db.query(perksQuery, [newLevel, userId]);

    if (perksResult.rows.length === 0) {
      return [];
    }

    // Batch unlock all perks in a single query
    const perkIds = perksResult.rows.map(p => p['id']);
    const values = perkIds.map((_, idx) => `($1, $${idx + 2}, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`).join(', ');

    const batchUnlockQuery = `
      INSERT INTO user_perks (user_id, perk_id, is_unlocked, unlocked_at, updated_at)
      VALUES ${values}
      ON CONFLICT (user_id, perk_id)
      DO UPDATE SET
        is_unlocked = true,
        unlocked_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      RETURNING id, user_id, perk_id, is_unlocked, is_active, configuration, unlocked_at, activated_at, updated_at
    `;

    const unlockResult = await this.db.query(batchUnlockQuery, [userId, ...perkIds]);

    // Build UserPerk objects with perk details
    const newlyUnlocked: UserPerk[] = unlockResult.rows.map((row) => {
      const perkDetails = perksResult.rows.find(p => p['id'] === row['perk_id']);
      if (!perkDetails) {
        throw new Error(`Perk details not found for perk_id ${row['perk_id']}`);
      }
      return {
        id: row['id'],
        user_id: row['user_id'],
        perk_id: row['perk_id'],
        is_unlocked: row['is_unlocked'],
        is_active: row['is_active'],
        configuration: row['configuration'] ?? {},
        unlocked_at: row['unlocked_at'],
        activated_at: row['activated_at'],
        updated_at: row['updated_at'],
        perk: {
          id: perkDetails['id'],
          name: perkDetails['name'],
          category: perkDetails['category'],
          type: perkDetails['type'],
          level_required: perkDetails['level_required'],
          title: perkDetails['title'],
          description: perkDetails['description'],
          asset_data: perkDetails['asset_data'],
          is_active: true,
          created_at: new Date(),
          updated_at: new Date()
        } as Perk
      };
    });

    // Auto-activate non-badge perks (in batch)
    const perksToActivate = newlyUnlocked.filter(up => up.perk?.type !== 'badge');
    if (perksToActivate.length > 0) {
      for (const userPerk of perksToActivate) {
        if (userPerk.perk) {
          const defaultConfig = this.getDefaultConfigurationForPerk(userPerk.perk.type);
          await this.activatePerk(userId, userPerk.perk.id, defaultConfig);
        }
      }
    }

    return newlyUnlocked;
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
   * Get a specific user perk
   */
  private async getUserPerk(userId: number, perkId: number): Promise<UserPerk | null> {
    const query = `
      SELECT
        up.id AS user_perk_id,
        up.user_id,
        up.perk_id,
        up.is_unlocked,
        up.is_active,
        up.configuration,
        up.unlocked_at,
        up.activated_at,
        up.updated_at,
        p.id AS perk_master_id,
        p.name AS perk_name,
        p.category AS perk_category,
        p.type AS perk_type,
        p.level_required AS perk_level_required,
        p.title AS perk_title,
        p.description AS perk_description,
        p.config_schema AS perk_config_schema,
        p.asset_data AS perk_asset_data,
        p.is_active AS perk_is_active,
        p.created_at AS perk_created_at,
        p.updated_at AS perk_updated_at
      FROM user_perks up
      JOIN perks p ON up.perk_id = p.id
      WHERE up.user_id = $1 AND up.perk_id = $2
    `;

    const result = await this.db.query(query, [userId, perkId]);

    if (result.rows.length === 0) {
      return null;
    }

    const row = result.rows[0]!;
    return {
      id: row['user_perk_id'],
      user_id: row['user_id'],
      perk_id: row['perk_id'],
      is_unlocked: row['is_unlocked'],
      is_active: row['is_active'],
      configuration: row['configuration'] ?? {},
      unlocked_at: row['unlocked_at'] ?? undefined,
      activated_at: row['activated_at'] ?? undefined,
      updated_at: row['updated_at'],
      perk: {
        id: row['perk_master_id'],
        name: row['perk_name'],
        category: row['perk_category'],
        type: row['perk_type'],
        level_required: row['perk_level_required'],
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
      SELECT * FROM perks 
      WHERE category = $1 AND is_active = true 
      ORDER BY level_required ASC
    `;

    const result = await this.db.query(query, [category]);
    return result.rows as Perk[];
  }
}
