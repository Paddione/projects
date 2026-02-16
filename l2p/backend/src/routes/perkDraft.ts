import express from 'express';
import { Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { PerkDraftService } from '../services/PerkDraftService.js';

const perkDraftService = PerkDraftService.getInstance();

const router = express.Router();

/**
 * GET /api/perks/draft/active — all active gameplay perks (level-based)
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

export default router;
