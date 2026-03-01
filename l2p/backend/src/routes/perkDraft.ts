import express from 'express';
import { Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { PerkQueryService } from '../services/PerkQueryService.js';

const perkQueryService = PerkQueryService.getInstance();

const router = express.Router();

/**
 * GET /api/perks/draft/active — all active gameplay perks (level-based)
 */
router.get('/active', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user!.userId as number;
    const activePerks = await perkQueryService.getActiveGameplayPerks(userId);
    res.json({ success: true, data: activePerks });
  } catch (error) {
    console.error('Error fetching active perks:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch active perks' });
  }
});

/**
 * GET /api/perks/draft/all — all gameplay perks (regardless of level)
 */
router.get('/all', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const allPerks = await perkQueryService.getAllGameplayPerks();
    res.json({ success: true, data: allPerks });
  } catch (error) {
    console.error('Error fetching all gameplay perks:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch all gameplay perks' });
  }
});

/**
 * GET /api/perks/draft/newly-unlocked?oldLevel=X&newLevel=Y — perks unlocked between two levels
 */
router.get('/newly-unlocked', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const oldLevel = parseInt(req.query['oldLevel'] as string);
    const newLevel = parseInt(req.query['newLevel'] as string);

    if (isNaN(oldLevel) || isNaN(newLevel)) {
      res.status(400).json({ success: false, message: 'oldLevel and newLevel query params are required (integers)' });
      return;
    }

    const perks = await perkQueryService.getNewlyUnlockedPerks(oldLevel, newLevel);
    res.json({ success: true, data: perks });
  } catch (error) {
    console.error('Error fetching newly unlocked perks:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch newly unlocked perks' });
  }
});

export default router;
