import express, { type Request, type Response } from 'express';
import { and, eq } from 'drizzle-orm';
import { db } from '../config/database.js';
import { apps, userAppAccess, users } from '../db/schema.js';
import { authenticate } from '../middleware/authenticate.js';

const router = express.Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        role: users.role,
        name: users.name,
      })
      .from(users)
      .where(eq(users.id, req.user.userId))
      .limit(1);

    if (!user) {
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
        isDefault: apps.is_default,
        accessId: userAppAccess.id,
      })
      .from(apps)
      .leftJoin(
        userAppAccess,
        and(eq(userAppAccess.app_id, apps.id), eq(userAppAccess.user_id, user.id))
      )
      .orderBy(apps.name);

    const isAdmin = user.role === 'ADMIN';
    const visibleApps = appRows
      .filter((app) => isAdmin || app.isActive)
      .map((app) => ({
        id: app.id,
        key: app.key,
        name: app.name,
        description: app.description,
        url: app.url,
        isActive: app.isActive,
        isDefault: app.isDefault,
        hasAccess: isAdmin ? true : !!app.accessId,
      }));

    res.status(200).json({
      user,
      apps: visibleApps,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch apps' });
  }
});

export default router;
