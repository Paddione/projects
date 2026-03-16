import express, { type Request, type Response } from 'express';
import { z } from 'zod';
import { ProfileService } from '../services/ProfileService.js';
import { authenticate } from '../middleware/authenticate.js';

const router = express.Router();
const profileService = new ProfileService();

// Validation schemas
const updateCharacterSchema = z.object({
  character: z.string().min(1),
  gender: z.enum(['male', 'female']),
});

const updateLoadoutSchema = z.object({
  equippedSkin: z.string().optional(),
  equippedEmote1: z.string().optional(),
  equippedEmote2: z.string().optional(),
  equippedEmote3: z.string().optional(),
  equippedEmote4: z.string().optional(),
  equippedTitle: z.string().optional(),
  equippedBorder: z.string().optional(),
  equippedPowerUp: z.string().optional(),
});

/**
 * GET /api/profile
 * Get current user's profile with loadout
 */
router.get('/profile', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const profile = await profileService.getProfileWithLoadout(req.user.userId);
    res.status(200).json(profile);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

/**
 * PUT /api/profile/character
 * Update selected character and gender
 */
router.put('/profile/character', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const { character, gender } = updateCharacterSchema.parse(req.body);
    const updated = await profileService.updateCharacter(req.user.userId, character, gender);
    res.status(200).json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    res.status(500).json({ error: 'Failed to update character' });
  }
});

/**
 * PUT /api/profile/loadout
 * Update equipped loadout items
 */
router.put('/profile/loadout', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const body = updateLoadoutSchema.parse(req.body);
    // Map camelCase request fields to snake_case Drizzle column names
    const updates: Record<string, string | undefined> = {};
    if (body.equippedSkin !== undefined) updates.equipped_skin = body.equippedSkin;
    if (body.equippedEmote1 !== undefined) updates.equipped_emote_1 = body.equippedEmote1;
    if (body.equippedEmote2 !== undefined) updates.equipped_emote_2 = body.equippedEmote2;
    if (body.equippedEmote3 !== undefined) updates.equipped_emote_3 = body.equippedEmote3;
    if (body.equippedEmote4 !== undefined) updates.equipped_emote_4 = body.equippedEmote4;
    if (body.equippedTitle !== undefined) updates.equipped_title = body.equippedTitle;
    if (body.equippedBorder !== undefined) updates.equipped_border = body.equippedBorder;
    if (body.equippedPowerUp !== undefined) updates.equipped_power_up = body.equippedPowerUp;
    const updatedLoadout = await profileService.updateLoadout(req.user.userId, updates as any);
    res.status(200).json(updatedLoadout);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    res.status(500).json({ error: 'Failed to update loadout' });
  }
});

/**
 * GET /api/profile/:userId
 * Get a user's public profile with loadout
 */
router.get('/profile/:userId', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    const profile = await profileService.getProfileWithLoadout(userId);
    res.status(200).json(profile);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

export default router;
