import express from 'express';
import { Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { PerkDraftService } from '../services/PerkDraftService.js';
import { CharacterService } from '../services/CharacterService.js';

const perkDraftService = PerkDraftService.getInstance();
const characterService = new CharacterService();

const router = express.Router();

/**
 * GET /api/perks/draft/pending — pending draft offers for current user
 */
router.get('/pending', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user!.userId as number;
    const charInfo = await characterService.getUserCharacterInfo(userId);
    const currentLevel = charInfo?.level || 1;

    const pendingLevels = await perkDraftService.getPendingDraftLevels(userId, currentLevel);
    const offers = [];
    for (const level of pendingLevels) {
      const offer = await perkDraftService.generateDraftOffer(userId, level);
      if (offer.perks.length > 0) {
        offers.push(offer);
      }
    }

    res.json({ success: true, data: { pendingDrafts: offers, count: offers.length } });
  } catch (error) {
    console.error('Error fetching pending drafts:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch pending drafts' });
  }
});

/**
 * POST /api/perks/draft/pick — pick a perk { level, perkId }
 */
router.post('/pick', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user!.userId as number;
    const { level, perkId } = req.body;

    if (typeof level !== 'number' || typeof perkId !== 'number') {
      res.status(400).json({ success: false, message: 'level and perkId are required as numbers' });
      return;
    }

    const result = await perkDraftService.pickPerk(userId, level, perkId);
    if (!result.success) {
      res.status(400).json({ success: false, message: result.error });
      return;
    }

    res.json({ success: true, message: 'Perk selected' });
  } catch (error) {
    console.error('Error picking perk:', error);
    res.status(500).json({ success: false, message: 'Failed to pick perk' });
  }
});

/**
 * POST /api/perks/draft/dump — dump all 3 { level }
 */
router.post('/dump', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user!.userId as number;
    const { level } = req.body;

    if (typeof level !== 'number') {
      res.status(400).json({ success: false, message: 'level is required as a number' });
      return;
    }

    const result = await perkDraftService.dumpOffer(userId, level);
    if (!result.success) {
      res.status(400).json({ success: false, message: result.error });
      return;
    }

    res.json({ success: true, message: 'Offer dumped' });
  } catch (error) {
    console.error('Error dumping offer:', error);
    res.status(500).json({ success: false, message: 'Failed to dump offer' });
  }
});

/**
 * GET /api/perks/draft/history — full draft history (for skill tree)
 */
router.get('/history', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user!.userId as number;
    const history = await perkDraftService.getDraftHistory(userId);
    res.json({ success: true, data: history });
  } catch (error) {
    console.error('Error fetching draft history:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch draft history' });
  }
});

/**
 * GET /api/perks/draft/active — all active gameplay perks
 */
router.get('/active', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user!.userId as number;
    const activePerks = await perkDraftService.getActiveGameplayPerks(userId);
    res.json({ success: true, data: activePerks });
  } catch (error) {
    console.error('Error fetching active perks:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch active perks' });
  }
});

/**
 * GET /api/perks/draft/pool — remaining available pool
 */
router.get('/pool', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user!.userId as number;
    const pool = await perkDraftService.getAvailablePool(userId);
    res.json({ success: true, data: { pool, size: pool.length } });
  } catch (error) {
    console.error('Error fetching perk pool:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch perk pool' });
  }
});

/**
 * POST /api/perks/draft/reset — full respec
 */
router.post('/reset', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user!.userId as number;
    const result = await perkDraftService.resetDrafts(userId);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error resetting drafts:', error);
    res.status(500).json({ success: false, message: 'Failed to reset drafts' });
  }
});

/**
 * GET /api/perks/draft/needs-redraft — check migration flag
 */
router.get('/needs-redraft', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user!.userId as number;
    const needs = await perkDraftService.needsRedraft(userId);
    res.json({ success: true, data: { needsRedraft: needs } });
  } catch (error) {
    console.error('Error checking redraft:', error);
    res.status(500).json({ success: false, message: 'Failed to check redraft status' });
  }
});

/**
 * POST /api/perks/draft/clear-redraft — clear migration flag after redrafting
 */
router.post('/clear-redraft', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user!.userId as number;
    await perkDraftService.clearRedraftFlag(userId);
    res.json({ success: true, message: 'Redraft flag cleared' });
  } catch (error) {
    console.error('Error clearing redraft flag:', error);
    res.status(500).json({ success: false, message: 'Failed to clear redraft flag' });
  }
});

/**
 * GET /api/perks/skill-tree — combined tree data (history + perk defs)
 */
router.get('/skill-tree', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user!.userId as number;
    const data = await perkDraftService.getSkillTreeData(userId);
    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching skill tree:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch skill tree' });
  }
});

export default router;
