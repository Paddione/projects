import express, { type Request, type Response } from 'express';
import { z } from 'zod';
import { AuthService } from '../services/AuthService.js';
import { authenticate } from '../middleware/authenticate.js';

const router = express.Router();
const authService = new AuthService();

// Validation schema
const updateProfileSchema = z.object({
  name: z.string().max(255).optional(),
  avatar_url: z.string().url().max(500).optional(),
  timezone: z.string().max(50).optional(),
  preferences: z.record(z.any()).optional(),
  notification_settings: z.record(z.any()).optional(),
});

/**
 * GET /api/user/me
 * Get current user profile
 */
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const user = await authService.getUserById(req.user!.userId);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(200).json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

/**
 * PATCH /api/user/profile
 * Update user profile
 */
router.patch('/profile', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const updates = updateProfileSchema.parse(req.body);

    const updatedUser = await authService.updateProfile(req.user!.userId, updates);

    res.status(200).json({
      user: updatedUser,
      message: 'Profile updated successfully',
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }

    res.status(400).json({ error: error instanceof Error ? error.message : 'Profile update failed' });
  }
});

export default router;
