import express from 'express';
import { Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { PerksManager } from '../services/PerksManager.js';
import { CharacterService } from '../services/CharacterService.js';

console.log('🟢 PERKS ROUTE MODULE LOADED!');

const perksManager = PerksManager.getInstance();
const characterService = new CharacterService();

const router = express.Router();

// Minimal test route
router.get('/test', (req: Request, res: Response) => {
  res.json({ success: true, message: 'Perks route is working!', timestamp: new Date().toISOString() });
});

/**
 * Get all perks available to the system
 */
router.get('/all', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const perks = await perksManager.getAllPerks();
    
    res.json({
      success: true,
      data: perks
    });
  } catch (error) {
    console.error('Error fetching all perks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch perks'
    });
  }
});

/**
 * Get user's perks (unlocked, locked, active)
 */
router.get('/user', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user!.userId as number;

    const userPerks = await perksManager.getUserPerks(userId);
    const activePerks = await perksManager.getActivePerks(userId);
    let loadout = await perksManager.getUserLoadout(userId);

    // Provide default loadout if user doesn't have one
    if (!loadout) {
      loadout = {
        user_id: userId,
        active_avatar: 'student',
        active_theme: 'default',
        perks_config: {},
        active_perks: activePerks,
        active_cosmetic_perks: {},
      };
    }

    res.json({
      success: true,
      data: {
        perks: userPerks,
        activePerks,
        loadout
      }
    });
  } catch (error) {
    console.error('Error fetching user perks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user perks'
    });
  }
});

/**
 * Unlock a specific perk
 */
router.post('/unlock/:perkId', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user!.userId as number;
    const perkId = parseInt(req.params['perkId'] as string);
    
    if (isNaN(perkId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid perk ID'
      });
      return;
    }
    
    const canUnlock = await perksManager.canUnlockPerk(userId, perkId);
    
    if (!canUnlock) {
      res.status(403).json({
        success: false,
        message: 'Cannot unlock this perk. Check level requirements or if already unlocked.'
      });
      return;
    }
    
    const unlocked = await perksManager.unlockPerk(userId, perkId);
    
    if (unlocked) {
      res.json({
        success: true,
        message: 'Perk unlocked successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to unlock perk'
      });
    }
  } catch (error) {
    console.error('Error unlocking perk:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unlock perk'
    });
  }
});

/**
 * Activate a perk with configuration
 */
router.post('/activate/:perkId', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user!.userId as number;
    const perkId = parseInt(req.params['perkId'] as string);
    const configuration = req.body.configuration || {};
    
    if (isNaN(perkId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid perk ID'
      });
      return;
    }
    
    // Validate configuration
    const validation = await perksManager.validatePerkConfig(perkId, configuration);

    if (!validation.valid) {
      res.status(400).json({
        success: false,
        message: 'Invalid perk configuration',
        errors: validation.errors
      });
      return;
    }
    
    const activated = await perksManager.activatePerk(userId, perkId, configuration);
    
    if (activated) {
      res.json({
        success: true,
        message: 'Perk activated successfully'
      });
    } else {
      res.status(403).json({
        success: false,
        message: 'Cannot activate perk. Make sure it is unlocked.'
      });
    }
  } catch (error) {
    console.error('Error activating perk:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to activate perk'
    });
  }
});

/**
 * Deactivate a perk
 */
router.post('/deactivate/:perkId', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user!.userId as number;
    const perkId = parseInt(req.params['perkId'] as string);
    
    if (isNaN(perkId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid perk ID'
      });
      return;
    }
    
    const deactivated = await perksManager.deactivatePerk(userId, perkId);
    
    if (deactivated) {
      res.json({
        success: true,
        message: 'Perk deactivated successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Perk not found or not active'
      });
    }
  } catch (error) {
    console.error('Error deactivating perk:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to deactivate perk'
    });
  }
});

/**
 * Get user's current loadout
 */
router.get('/loadout', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user!.userId as number;
    
    const loadout = await perksManager.getUserLoadout(userId);
    
    if (loadout) {
      res.json({
        success: true,
        data: loadout
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'User loadout not found'
      });
    }
  } catch (error) {
    console.error('Error fetching user loadout:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch loadout'
    });
  }
});

/**
 * Get perks by category
 */
router.get('/category/:category', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const category = req.params['category'] as string;
    
    const perks = await perksManager.getPerksByCategory(category);
    
    res.json({
      success: true,
      data: perks
    });
  } catch (error) {
    console.error('Error fetching perks by category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch perks by category'
    });
  }
});

/**
 * Get perk configuration options (avatar/theme/badge options from asset_data)
 */
router.get('/options/:perkId', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const perkId = parseInt(req.params['perkId'] as string);

    if (isNaN(perkId)) {
      res.status(400).json({
        success: false,
        message: 'Invalid perk ID'
      });
      return;
    }

    // Get all perks to find the requested one
    const allPerks = await perksManager.getAllPerks();
    const perk = allPerks.find(p => p.id === perkId);

    if (!perk) {
      res.status(404).json({
        success: false,
        message: 'Perk not found'
      });
      return;
    }

    res.json({
      success: true,
      data: {
        perkId: perk.id,
        type: perk.type,
        configSchema: perk.config_schema,
        assetData: perk.asset_data
      }
    });
  } catch (error) {
    console.error('Error fetching perk options:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch perk options'
    });
  }
});

/**
 * Check and unlock perks for user's current level
 * This endpoint can be called when a user levels up
 */
router.post('/check-unlocks', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user!.userId as number;
    
    // Get user's current level
    const characterInfo = await characterService.getUserCharacterInfo(userId);
    
    if (!characterInfo) {
      res.status(404).json({
        success: false,
        message: 'Character not found'
      });
      return;
    }
    
    const newlyUnlocked = await perksManager.checkAndUnlockPerksForLevel(userId, characterInfo.level);
    
    res.json({
      success: true,
      data: {
        newlyUnlocked,
        totalUnlocked: newlyUnlocked.length
      },
      message: `${newlyUnlocked.length} new perks unlocked!`
    });
  } catch (error) {
    console.error('Error checking perk unlocks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check perk unlocks'
    });
  }
});

export default router;
