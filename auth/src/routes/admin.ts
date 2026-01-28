import express, { type Request, type Response } from 'express';
import { z } from 'zod';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../config/database.js';
import { apps, userAppAccess, users } from '../db/schema.js';
import { authenticate, requireAdmin } from '../middleware/authenticate.js';

const router = express.Router();

router.use(authenticate, requireAdmin);

// Get all users (summary)
router.get('/users', async (_req: Request, res: Response) => {
  try {
    const allUsers = await db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        role: users.role,
        name: users.name,
        isActive: users.is_active,
        emailVerified: users.email_verified,
        createdAt: users.created_at,
        lastLogin: users.last_login,
      })
      .from(users)
      .orderBy(users.username);

    res.status(200).json({ users: allUsers });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get single user with all fields
router.get('/users/:userId', async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Get user's app access
    const appAccess = await db
      .select({
        appId: apps.id,
        appKey: apps.key,
        appName: apps.name,
      })
      .from(userAppAccess)
      .innerJoin(apps, eq(apps.id, userAppAccess.app_id))
      .where(eq(userAppAccess.user_id, userId));

    // Remove sensitive fields from response
    const { password_hash, email_verification_token, password_reset_token, ...safeUser } = user;

    res.status(200).json({
      user: safeUser,
      appAccess,
    });
  } catch (error) {
    console.error('Failed to fetch user:', error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// Update user fields
const updateUserSchema = z.object({
  email: z.string().email().optional(),
  username: z.string().min(3).max(50).optional(),
  name: z.string().max(255).nullable().optional(),
  role: z.enum(['USER', 'ADMIN']).optional(),
  is_active: z.boolean().optional(),
  email_verified: z.boolean().optional(),
  avatar_url: z.string().url().max(500).nullable().optional(),
  timezone: z.string().max(50).optional(),
  selected_character: z.string().max(50).optional(),
  character_level: z.number().int().min(1).optional(),
  experience_points: z.number().int().min(0).optional(),
  preferences: z.record(z.unknown()).optional(),
  notification_settings: z.record(z.unknown()).optional(),
  failed_login_attempts: z.number().int().min(0).optional(),
  account_locked_until: z.string().datetime().nullable().optional(),
});

router.patch('/users/:userId', async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!existingUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const parsed = updateUserSchema.parse(req.body);

    if (Object.keys(parsed).length === 0) {
      res.status(400).json({ error: 'No fields to update' });
      return;
    }

    // Check for unique constraint violations
    if (parsed.email) {
      const [emailExists] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.email, parsed.email), sql`${users.id} != ${userId}`))
        .limit(1);
      if (emailExists) {
        res.status(409).json({ error: 'Email already in use' });
        return;
      }
    }

    if (parsed.username) {
      const [usernameExists] = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.username, parsed.username), sql`${users.id} != ${userId}`))
        .limit(1);
      if (usernameExists) {
        res.status(409).json({ error: 'Username already in use' });
        return;
      }
    }

    // Build update object
    const updateData: Record<string, unknown> = {
      updated_at: new Date(),
    };

    if (parsed.email !== undefined) updateData.email = parsed.email;
    if (parsed.username !== undefined) updateData.username = parsed.username;
    if (parsed.name !== undefined) updateData.name = parsed.name;
    if (parsed.role !== undefined) updateData.role = parsed.role;
    if (parsed.is_active !== undefined) updateData.is_active = parsed.is_active;
    if (parsed.email_verified !== undefined) updateData.email_verified = parsed.email_verified;
    if (parsed.avatar_url !== undefined) updateData.avatar_url = parsed.avatar_url;
    if (parsed.timezone !== undefined) updateData.timezone = parsed.timezone;
    if (parsed.selected_character !== undefined) updateData.selected_character = parsed.selected_character;
    if (parsed.character_level !== undefined) updateData.character_level = parsed.character_level;
    if (parsed.experience_points !== undefined) updateData.experience_points = parsed.experience_points;
    if (parsed.preferences !== undefined) updateData.preferences = parsed.preferences;
    if (parsed.notification_settings !== undefined) updateData.notification_settings = parsed.notification_settings;
    if (parsed.failed_login_attempts !== undefined) updateData.failed_login_attempts = parsed.failed_login_attempts;
    if (parsed.account_locked_until !== undefined) {
      updateData.account_locked_until = parsed.account_locked_until ? new Date(parsed.account_locked_until) : null;
    }

    await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId));

    res.status(200).json({ message: 'User updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }
    console.error('Failed to update user:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user
router.delete('/users/:userId', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    // Prevent self-deletion
    if (userId === req.user.userId) {
      res.status(400).json({ error: 'Cannot delete your own account' });
      return;
    }

    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!existingUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    await db.delete(users).where(eq(users.id, userId));

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Failed to delete user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// Get users with access to a specific app
router.get('/apps/:appId/users', async (req: Request, res: Response) => {
  try {
    const appId = Number(req.params.appId);
    if (!Number.isInteger(appId)) {
      res.status(400).json({ error: 'Invalid app ID' });
      return;
    }

    const [app] = await db
      .select({ id: apps.id, name: apps.name })
      .from(apps)
      .where(eq(apps.id, appId))
      .limit(1);

    if (!app) {
      res.status(404).json({ error: 'App not found' });
      return;
    }

    const usersWithAccess = await db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        name: users.name,
        role: users.role,
        grantedAt: userAppAccess.created_at,
      })
      .from(userAppAccess)
      .innerJoin(users, eq(users.id, userAppAccess.user_id))
      .where(eq(userAppAccess.app_id, appId))
      .orderBy(users.username);

    res.status(200).json({
      app: { id: app.id, name: app.name },
      users: usersWithAccess,
    });
  } catch (error) {
    console.error('Failed to fetch app users:', error);
    res.status(500).json({ error: 'Failed to fetch app users' });
  }
});

router.get('/apps', async (_req: Request, res: Response) => {
  try {
    const allApps = await db
      .select({
        id: apps.id,
        key: apps.key,
        name: apps.name,
        description: apps.description,
        url: apps.url,
        isActive: apps.is_active,
      })
      .from(apps)
      .orderBy(apps.name);

    res.status(200).json({ apps: allApps });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch apps' });
  }
});

router.get('/users/:userId/apps', async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    const [targetUser] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!targetUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const appRows = await db
      .select({
        id: apps.id,
        key: apps.key,
        name: apps.name,
        description: apps.description,
        url: apps.url,
        isActive: apps.is_active,
        accessId: userAppAccess.id,
      })
      .from(apps)
      .leftJoin(
        userAppAccess,
        and(eq(userAppAccess.app_id, apps.id), eq(userAppAccess.user_id, userId))
      )
      .orderBy(apps.name);

    const isAdmin = targetUser.role === 'ADMIN';

    res.status(200).json({
      userId,
      role: targetUser.role,
      apps: appRows.map((app) => ({
        id: app.id,
        key: app.key,
        name: app.name,
        description: app.description,
        url: app.url,
        isActive: app.isActive,
        hasAccess: isAdmin ? true : !!app.accessId,
      })),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user access' });
  }
});

const updateAccessSchema = z.object({
  appIds: z.array(z.number().int()).default([]),
});

router.put('/users/:userId/apps', async (req: Request, res: Response) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId)) {
      res.status(400).json({ error: 'Invalid user ID' });
      return;
    }

    const [targetUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!targetUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const parsed = updateAccessSchema.parse(req.body);
    const appIds = Array.from(new Set(parsed.appIds));

    if (appIds.length > 0) {
      const validApps = await db
        .select({ id: apps.id })
        .from(apps)
        .where(inArray(apps.id, appIds));

      if (validApps.length !== appIds.length) {
        res.status(400).json({ error: 'One or more app IDs are invalid' });
        return;
      }
    }

    await db.transaction(async (tx) => {
      await tx.delete(userAppAccess).where(eq(userAppAccess.user_id, userId));

      if (appIds.length > 0) {
        await tx.insert(userAppAccess).values(
          appIds.map((appId) => ({
            user_id: userId,
            app_id: appId,
          }))
        );
      }
    });

    res.status(200).json({ message: 'Access updated successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Validation failed', details: error.errors });
      return;
    }

    res.status(500).json({ error: 'Failed to update access' });
  }
});

export default router;
