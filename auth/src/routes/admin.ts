import express, { type Request, type Response } from 'express';
import { z } from 'zod';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../config/database.js';
import { apps, userAppAccess, users } from '../db/schema.js';
import { authenticate, requireAdmin } from '../middleware/authenticate.js';

const router = express.Router();

router.use(authenticate, requireAdmin);

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
      })
      .from(users)
      .orderBy(users.username);

    res.status(200).json({ users: allUsers });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
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
