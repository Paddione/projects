import { db } from '../config/database.js';
import { profiles, inventory, shopCatalog, transactions } from '../db/schema.js';
import type { InventoryRecord } from '../db/schema.js';
import type { PurchaseResult, InventoryItem } from '../types/platform.js';
import { eq, and, sql } from 'drizzle-orm';

export class RespectService {
  /**
   * Credit respect to a user's balance and log the transaction atomically.
   */
  async creditRespect(
    userId: number,
    amount: number,
    metadata?: Record<string, unknown>,
  ): Promise<{ newBalance: number }> {
    const result = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(profiles)
        .set({
          respect_balance: sql`${profiles.respect_balance} + ${amount}`,
          updated_at: new Date(),
        })
        .where(eq(profiles.user_id, userId))
        .returning({ respect_balance: profiles.respect_balance });

      if (!updated) {
        throw new Error(`Profile not found for user ${userId}`);
      }

      await tx.insert(transactions).values({
        user_id: userId,
        type: 'respect_earned',
        currency: 'respect',
        amount,
        metadata: metadata ?? null,
      });

      return { newBalance: updated.respect_balance };
    });

    return result;
  }

  /**
   * Debit respect from a user's balance, rejecting if balance is insufficient.
   */
  async debitRespect(
    userId: number,
    amount: number,
    metadata?: Record<string, unknown>,
  ): Promise<{ newBalance: number } | { error: string; status: 402 }> {
    const result = await db.transaction(async (tx) => {
      // Lock the row and check current balance
      const rows = await tx
        .select({ respect_balance: profiles.respect_balance })
        .from(profiles)
        .where(eq(profiles.user_id, userId))
        .for('update');

      if (rows.length === 0) {
        return { error: 'Profile not found', status: 402 as const };
      }

      const currentBalance = rows[0].respect_balance;
      if (currentBalance < amount) {
        return { error: 'Insufficient respect balance', status: 402 as const };
      }

      const [updated] = await tx
        .update(profiles)
        .set({
          respect_balance: sql`${profiles.respect_balance} - ${amount}`,
          updated_at: new Date(),
        })
        .where(eq(profiles.user_id, userId))
        .returning({ respect_balance: profiles.respect_balance });

      await tx.insert(transactions).values({
        user_id: userId,
        type: 'respect_earned',
        currency: 'respect',
        amount: -amount,
        metadata: metadata ?? null,
      });

      return { newBalance: updated.respect_balance };
    });

    return result;
  }

  /**
   * Get the current respect balance for a user. Returns 0 if no profile exists.
   */
  async getBalance(userId: number): Promise<number> {
    const rows = await db
      .select({ respect_balance: profiles.respect_balance })
      .from(profiles)
      .where(eq(profiles.user_id, userId))
      .limit(1);

    return rows.length > 0 ? rows[0].respect_balance : 0;
  }

  /**
   * Purchase an item from the shop catalog using respect currency.
   * Validates item existence, ownership, level requirement, and balance.
   */
  async purchaseItem(
    userId: number,
    itemId: string,
  ): Promise<PurchaseResult | { error: string; status: number }> {
    // Validate item exists and is active
    const catalogRows = await db
      .select()
      .from(shopCatalog)
      .where(and(eq(shopCatalog.item_id, itemId), eq(shopCatalog.active, true)))
      .limit(1);

    if (catalogRows.length === 0) {
      return { error: 'Item not found or not available', status: 404 };
    }

    const catalogItem = catalogRows[0];

    // Validate user doesn't already own the item
    const existingOwnership = await db
      .select({ id: inventory.id })
      .from(inventory)
      .where(and(eq(inventory.user_id, userId), eq(inventory.item_id, itemId)))
      .limit(1);

    if (existingOwnership.length > 0) {
      return { error: 'Item already owned', status: 409 };
    }

    // Validate level requirement
    if (catalogItem.unlock_level !== null) {
      const profileRows = await db
        .select({ level: profiles.level })
        .from(profiles)
        .where(eq(profiles.user_id, userId))
        .limit(1);

      const userLevel = profileRows.length > 0 ? profileRows[0].level : 1;
      if (userLevel < catalogItem.unlock_level) {
        return {
          error: `Level ${catalogItem.unlock_level} required to purchase this item`,
          status: 403,
        };
      }
    }

    // Atomic: debit balance, insert inventory, log transaction
    const result = await db.transaction(async (tx) => {
      // Lock profile row and re-validate balance atomically
      const profileRows = await tx
        .select({ respect_balance: profiles.respect_balance })
        .from(profiles)
        .where(eq(profiles.user_id, userId))
        .for('update');

      if (profileRows.length === 0) {
        return { error: 'Profile not found', status: 402 as const };
      }

      const currentBalance = profileRows[0].respect_balance;
      if (currentBalance < catalogItem.respect_cost) {
        return { error: 'Insufficient respect balance', status: 402 as const };
      }

      // Debit the balance
      const [updatedProfile] = await tx
        .update(profiles)
        .set({
          respect_balance: sql`${profiles.respect_balance} - ${catalogItem.respect_cost}`,
          updated_at: new Date(),
        })
        .where(eq(profiles.user_id, userId))
        .returning({ respect_balance: profiles.respect_balance });

      // Add to inventory
      const [newInventoryRow]: InventoryRecord[] = await tx
        .insert(inventory)
        .values({
          user_id: userId,
          item_id: itemId,
          item_type: catalogItem.item_type,
          acquisition_source: 'respect_purchase',
        })
        .returning();

      // Log transaction
      await tx.insert(transactions).values({
        user_id: userId,
        type: 'item_purchase',
        currency: 'respect',
        amount: -catalogItem.respect_cost,
        item_id: itemId,
        metadata: null,
      });

      const item: InventoryItem = {
        id: newInventoryRow.id,
        userId: newInventoryRow.user_id,
        itemId: newInventoryRow.item_id,
        itemType: newInventoryRow.item_type as InventoryItem['itemType'],
        acquiredAt: newInventoryRow.acquired_at,
        acquisitionSource: newInventoryRow.acquisition_source as InventoryItem['acquisitionSource'],
      };

      return {
        success: true,
        item,
        newBalance: updatedProfile.respect_balance,
      } satisfies PurchaseResult;
    });

    return result;
  }
}
