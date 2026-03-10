import express, { type Request, type Response } from 'express';
import { eq, and } from 'drizzle-orm';
import { optionalAuthenticate } from '../middleware/authenticate.js';
import { db } from '../config/database.js';
import { apps, userAppAccess } from '../db/schema.js';

const router = express.Router();

const AUTH_BASE_URL = process.env.APP_URL || 'https://auth.korczewski.de';

/**
 * Reconstruct the original URL from Traefik's X-Forwarded-* headers.
 */
function getOriginalUrl(req: Request): string {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const uri = req.headers['x-forwarded-uri'] || '/';
  return `${proto}://${host}${uri}`;
}

/**
 * GET /api/auth/forward-auth
 *
 * Dedicated ForwardAuth endpoint for Traefik.
 * - Authenticated + authorized: 200 with auth headers
 * - Authenticated + no app access: 302 to access-denied page
 * - Not authenticated: 302 to login page with redirect back
 *
 * Query params:
 *   - app: app key to check access for (e.g., "fritzbox", "proxmox")
 *   - requireAdmin: if "true", requires ADMIN role
 */
router.get('/', optionalAuthenticate, async (req: Request, res: Response) => {
  const appKey = req.query.app as string | undefined;
  const requireAdmin = req.query.requireAdmin === 'true';
  const originalUrl = getOriginalUrl(req);

  // Not authenticated — redirect to login
  if (!req.user) {
    const loginUrl = `${AUTH_BASE_URL}/login?redirect=${encodeURIComponent(originalUrl)}`;
    res.redirect(302, loginUrl);
    return;
  }

  // Admin check
  if (requireAdmin && req.user.role !== 'ADMIN') {
    const deniedUrl = `${AUTH_BASE_URL}/access-denied?reason=admin_required&redirect=${encodeURIComponent(originalUrl)}`;
    res.redirect(302, deniedUrl);
    return;
  }

  // App access check (admins bypass)
  if (appKey && req.user.role !== 'ADMIN') {
    const [access] = await db
      .select({ id: userAppAccess.id })
      .from(userAppAccess)
      .innerJoin(apps, eq(apps.id, userAppAccess.app_id))
      .where(
        and(
          eq(userAppAccess.user_id, req.user.userId),
          eq(apps.key, appKey),
          eq(apps.is_active, true)
        )
      )
      .limit(1);

    if (!access) {
      const deniedUrl = `${AUTH_BASE_URL}/access-denied?app=${encodeURIComponent(appKey)}&redirect=${encodeURIComponent(originalUrl)}`;
      res.redirect(302, deniedUrl);
      return;
    }
  }

  // Authorized — set headers for downstream services and return 200
  res.setHeader('X-Auth-User', req.user.username || '');
  res.setHeader('X-Auth-Email', req.user.email || '');
  res.setHeader('X-Auth-Role', req.user.role || '');
  res.setHeader('X-Auth-User-Id', req.user.userId?.toString() || '');

  res.status(200).json({ valid: true });
});

export default router;
