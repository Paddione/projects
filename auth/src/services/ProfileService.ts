import { db } from '../config/database.js';
import { profiles, loadouts, inventory } from '../db/schema.js';
import type { ProfileRecord, LoadoutRecord, LoadoutInsert, InventoryRecord } from '../db/schema.js';
import type { ProfileWithLoadout } from '../types/platform.js';
import { eq, sql } from 'drizzle-orm';

export class ProfileService {
  /**
   * Calculate level from total XP.
   * Matches L2P formula: exponential scaling, base 500 XP, 1.8 power.
   * Level 1 at 0 XP, capped at 100.
   */
  static calculateLevel(xpTotal: number): number {
    if (xpTotal <= 0) return 1;
    const level = Math.floor(Math.pow(xpTotal / 500, 1 / 1.8)) + 1;
    return Math.min(level, 100);
  }

  /**
   * Get existing profile or create a new one with defaults.
   * Also creates an empty loadout on first creation.
   */
  async getOrCreateProfile(userId: number): Promise<ProfileRecord> {
    const existing = await db
      .select()
      .from(profiles)
      .where(eq(profiles.user_id, userId))
      .limit(1);

    if (existing.length > 0) {
      return existing[0];
    }

    // Create new profile with defaults
    const [newProfile] = await db
      .insert(profiles)
      .values({ user_id: userId })
      .returning();

    // Also create empty loadout
    await db
      .insert(loadouts)
      .values({ user_id: userId })
      .onConflictDoNothing();

    return newProfile;
  }

  /**
   * Update the selected character and gender for a user's profile.
   */
  async updateCharacter(userId: number, character: string, gender: string): Promise<ProfileRecord> {
    // Ensure profile exists
    await this.getOrCreateProfile(userId);

    const [updated] = await db
      .update(profiles)
      .set({
        selected_character: character,
        selected_gender: gender,
        updated_at: new Date(),
      })
      .where(eq(profiles.user_id, userId))
      .returning();

    return updated;
  }

  /**
   * Upsert loadout — insert or update only the provided fields.
   */
  async updateLoadout(userId: number, updates: Partial<LoadoutInsert>): Promise<LoadoutRecord> {
    const setFields: Partial<LoadoutInsert> = {
      ...updates,
      updated_at: new Date(),
    };

    // Remove user_id from the update set (it's the PK, not updatable)
    delete setFields.user_id;

    const [result] = await db
      .insert(loadouts)
      .values({ user_id: userId, ...updates })
      .onConflictDoUpdate({
        target: loadouts.user_id,
        set: setFields,
      })
      .returning();

    return result;
  }

  /**
   * Get full profile with loadout and inventory.
   */
  async getProfileWithLoadout(userId: number): Promise<ProfileWithLoadout> {
    const profile = await this.getOrCreateProfile(userId);

    const loadoutRows = await db
      .select()
      .from(loadouts)
      .where(eq(loadouts.user_id, userId))
      .limit(1);

    const inventoryRows: InventoryRecord[] = await db
      .select()
      .from(inventory)
      .where(eq(inventory.user_id, userId));

    // Loadout should exist from getOrCreateProfile, but fallback just in case
    const loadout = loadoutRows[0] ?? (
      await db.insert(loadouts).values({ user_id: userId }).onConflictDoNothing().returning()
    )[0];

    return {
      userId: profile.user_id,
      displayName: profile.display_name,
      selectedCharacter: profile.selected_character,
      selectedGender: profile.selected_gender,
      selectedPowerUp: profile.selected_power_up,
      respectBalance: profile.respect_balance,
      xpTotal: profile.xp_total,
      level: profile.level,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
      loadout: {
        userId: loadout.user_id,
        equippedSkin: loadout.equipped_skin,
        equippedEmote1: loadout.equipped_emote_1,
        equippedEmote2: loadout.equipped_emote_2,
        equippedEmote3: loadout.equipped_emote_3,
        equippedEmote4: loadout.equipped_emote_4,
        equippedTitle: loadout.equipped_title,
        equippedBorder: loadout.equipped_border,
        equippedPowerUp: loadout.equipped_power_up,
        updatedAt: loadout.updated_at,
      },
      inventory: inventoryRows.map((row) => ({
        id: row.id,
        userId: row.user_id,
        itemId: row.item_id,
        itemType: row.item_type as 'skin' | 'emote' | 'title' | 'border' | 'power_up' | 'character',
        acquiredAt: row.acquired_at,
        acquisitionSource: row.acquisition_source as 'respect_purchase' | 'stripe' | 'achievement' | 'level_unlock' | 'migration',
      })),
    };
  }

  /**
   * Award XP to a user and recalculate their level.
   */
  async awardXp(userId: number, amount: number): Promise<ProfileRecord> {
    // Ensure profile exists
    await this.getOrCreateProfile(userId);

    // Atomically increment XP and recalculate level in one query
    const [updated] = await db
      .update(profiles)
      .set({
        xp_total: sql`${profiles.xp_total} + ${amount}`,
        level: sql`LEAST(FLOOR(POWER((${profiles.xp_total} + ${amount})::numeric / 500, 1.0 / 1.8)) + 1, 100)`,
        updated_at: new Date(),
      })
      .where(eq(profiles.user_id, userId))
      .returning();

    return updated;
  }
}
