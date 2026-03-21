import express, { type Request, type Response } from 'express';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '../config/database.js';
import { shopCatalog, inventory } from '../db/schema.js';
import { authenticate } from '../middleware/authenticate.js';
import { RespectService } from '../services/RespectService.js';
import { ProfileService } from '../services/ProfileService.js';
import rateLimit from 'express-rate-limit';

const router = express.Router();

// Validation schema
const purchaseSchema = z.object({
  itemId: z.string().min(1),
});

/**
 * GET /api/catalog
 * Browse the shop catalog (public — no auth required)
 * Optional query param: ?type=emote filters by item_type
 */
router.get('/catalog', async (req: Request, res: Response) => {
  try {
    const { type } = req.query;

    let items;
    if (type && typeof type === 'string') {
      items = await db
        .select()
        .from(shopCatalog)
        .where(and(eq(shopCatalog.active, true), eq(shopCatalog.item_type, type)));
    } else {
      items = await db
        .select()
        .from(shopCatalog)
        .where(eq(shopCatalog.active, true));
    }

    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch catalog' });
  }
});

const purchaseLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'Too many purchase attempts, try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * POST /api/catalog/purchase
 * Purchase an item from the catalog (authenticate required)
 */
router.post('/catalog/purchase', authenticate, purchaseLimiter, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { itemId } = purchaseSchema.parse(req.body);

    const respectService = new RespectService();
    const result = await respectService.purchaseItem(req.user.userId, itemId);

    if ('error' in result) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    res.status(200).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }

    res.status(500).json({ error: 'Purchase failed' });
  }
});

/**
 * GET /api/catalog/characters
 * Get character catalog + user's owned characters + balance.
 * Requires authentication (unlike GET /api/catalog which is public).
 */
router.get('/catalog/characters', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const userId = req.user.userId;

    // Ensure profile exists
    const profileService = new ProfileService();
    const profile = await profileService.getOrCreateProfile(userId);

    // Get character catalog items
    const characters = await db
      .select()
      .from(shopCatalog)
      .where(and(eq(shopCatalog.active, true), eq(shopCatalog.item_type, 'character')));

    // Get user's owned character item_ids
    const ownedRows = await db
      .select({ item_id: inventory.item_id })
      .from(inventory)
      .where(and(eq(inventory.user_id, userId), eq(inventory.item_type, 'character')));

    res.status(200).json({
      characters: characters.map((c) => ({
        itemId: c.item_id,
        name: c.name,
        description: c.description,
        respectCost: c.respect_cost,
      })),
      ownedCharacterIds: ownedRows.map((r) => r.item_id),
      respectBalance: profile.respect_balance,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch character catalog' });
  }
});

export default router;
