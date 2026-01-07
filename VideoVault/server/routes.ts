import type { Express, NextFunction, Request, Response } from 'express';
import { createServer, type Server } from 'http';
import {
  reportError,
  getErrorStats,
  healthCheck,
  listClientErrors,
  getClientError,
  deleteClientError,
  bulkDeleteClientErrors,
} from './routes/errors';
import { logger } from './lib/logger';
import {
  listVideos,
  bulkUpsertVideos,
  patchVideo,
  deleteVideo,
  batchDeleteVideos,
  getRoots,
  setRoot,
  addDirectory,
  removeDirectory,
  deleteRoot,
  getLastRootKey,
  setLastRootKey,
  listPresets,
  createPreset,
  updatePreset,
  deletePreset,
  listTags,
  updateTag,
} from './routes/persistence';
import { dbHealth } from './routes/db';
import { getSetting, setSetting, deleteSetting } from './routes/settings';
import rateLimit from 'express-rate-limit';
import { asyncHandler } from './lib/asyncHandler';
import { generateThumbnailRoute } from './routes/thumbnails';
import { computeHashes, getDuplicates, ignoreDuplicateRoute } from './routes/duplicates';
import {
  renameTagRoute,
  mergeTagsRoute,
  addSynonymRoute,
  listSynonymsRoute,
  deleteSynonymRoute,
} from './routes/tag-ops';
import { importCategories } from './routes/categories';
import thumbnailsV2Routes from './routes/thumbnails-v2';
import scanStateRoutes from './routes/scan-state';
import jobsRoutes from './routes/jobs';

// ... (existing imports)

// ... (inside registerRoutes)

type CsrfRequest = Request & { csrfToken?: () => string };
type AuthBody = { username?: string; password?: string };
type AuthServiceUser = { userId: number; username: string; email: string; role?: string };

const authServiceUrlRaw = process.env.AUTH_SERVICE_URL || 'http://localhost:5500';
const authServiceUrl = authServiceUrlRaw.replace(/\/+$/, '');
const AUTH_SERVICE_API_URL = authServiceUrl.endsWith('/api')
  ? authServiceUrl
  : `${authServiceUrl}/api`;

function extractAccessToken(req: Request): string | null {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  const cookieToken = req.cookies?.accessToken;
  return cookieToken || null;
}

async function fetchAuthUser(req: Request): Promise<AuthServiceUser | null> {
  const token = extractAccessToken(req);
  if (!token) return null;

  try {
      const response = await fetch(`${AUTH_SERVICE_API_URL}/auth/verify`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) return null;
    const data = await response.json().catch(() => null);
    return data?.user ?? null;
  } catch (error) {
    return null;
  }
}

// Central auth admin middleware
async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await fetchAuthUser(req);
    if (!user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    if (user.role !== 'ADMIN') {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }
    (req as Request & { user?: AuthServiceUser }).user = user;
    next();
  } catch (error) {
    res.status(503).json({ message: 'Authentication service unavailable' });
  }
}

// Rate limiters
const errorReportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

export function registerRoutes(app: Express): Server {
  // Public auth status endpoint (no auth required)
  app.get('/api/auth/status', async (req: Request, res: Response) => {
    const user = await fetchAuthUser(req);
    res.json({ isAdmin: user?.role === 'ADMIN' });
  });

  // Auth routes (session-based)
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    const { username, password } = (req.body || {}) as AuthBody;
    try {
      const response = await fetch(`${AUTH_SERVICE_API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usernameOrEmail: username, password }),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        return res.status(response.status).json(data ?? { message: 'Invalid credentials' });
      }

      return res.json({
        ok: true,
        tokens: data?.tokens,
        user: data?.user,
      });
    } catch (error) {
      return res.status(503).json({ message: 'Authentication service unavailable' });
    }
  });
  app.post('/api/auth/logout', async (req: Request, res: Response) => {
    const token = extractAccessToken(req);
    if (token) {
      try {
        await fetch(`${AUTH_SERVICE_API_URL}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {}
    }
    res.json({ ok: true });
  });

  // CSRF token endpoint for SPA
  app.get('/api/csrf', (req: Request, res: Response) => {
    if (!req.app?.locals?.csrfEnabled) {
      res.json({ csrfToken: null });
      return;
    }

    try {
      const csrfReq = req as CsrfRequest;
      const token = typeof csrfReq.csrfToken === 'function' ? csrfReq.csrfToken() : null;
      res.json({ csrfToken: token });
    } catch {
      res.json({ csrfToken: null });
    }
  });

  // Error reporting endpoints
  app.post('/api/errors/report', errorReportLimiter, asyncHandler(reportError));
  // Expose error stats without auth (contains only aggregate/placeholder info)
  app.get('/api/errors/stats', adminLimiter, asyncHandler(getErrorStats));
  app.get('/api/errors', requireAdmin, adminLimiter, asyncHandler(listClientErrors));
  app.get('/api/errors/:id', requireAdmin, adminLimiter, asyncHandler(getClientError));
  app.delete('/api/errors/:id', requireAdmin, adminLimiter, asyncHandler(deleteClientError));
  app.post(
    '/api/errors/bulk_delete',
    requireAdmin,
    adminLimiter,
    asyncHandler(bulkDeleteClientErrors),
  );
  app.get('/api/health', asyncHandler(healthCheck));
  app.get('/api/db/health', asyncHandler(dbHealth));
  app.get('/api/settings/:key', asyncHandler(getSetting));
  app.post('/api/settings/:key', asyncHandler(setSetting));
  app.delete('/api/settings/:key', asyncHandler(deleteSetting));

  // Persistence routes (enabled regardless; will 503 if DB missing)
  app.get('/api/videos', asyncHandler(listVideos));
  app.post('/api/videos/bulk_upsert', asyncHandler(bulkUpsertVideos));
  app.patch('/api/videos/:id', asyncHandler(patchVideo));
  app.delete('/api/videos/:id', asyncHandler(deleteVideo));
  app.post('/api/videos/batch_delete', asyncHandler(batchDeleteVideos));

  app.get('/api/roots', asyncHandler(getRoots));
  app.post('/api/roots', asyncHandler(setRoot));
  app.post('/api/roots/add', asyncHandler(addDirectory));
  app.post('/api/roots/remove', asyncHandler(removeDirectory));
  app.delete('/api/roots/:rootKey', asyncHandler(deleteRoot));
  app.get('/api/roots/last', asyncHandler(getLastRootKey));
  app.post('/api/roots/last', asyncHandler(setLastRootKey));

  app.get('/api/presets', asyncHandler(listPresets));
  app.post('/api/presets', asyncHandler(createPreset));
  app.patch('/api/presets/:id', asyncHandler(updatePreset));
  app.delete('/api/presets/:id', asyncHandler(deletePreset));

  app.get('/api/tags', asyncHandler(listTags));
  app.patch('/api/tags/:id', asyncHandler(updateTag));

  app.post('/api/thumbnails/generate', asyncHandler(generateThumbnailRoute));

  app.post('/api/videos/compute-hashes', asyncHandler(computeHashes));
  app.get('/api/videos/duplicates', asyncHandler(getDuplicates));
  app.post('/api/videos/duplicates/ignore', asyncHandler(ignoreDuplicateRoute));

  app.post('/api/tags/:id/rename', asyncHandler(renameTagRoute));
  app.post('/api/tags/merge', asyncHandler(mergeTagsRoute));
  app.get('/api/tags/synonyms', asyncHandler(listSynonymsRoute));
  app.post('/api/tags/synonyms', asyncHandler(addSynonymRoute));
  app.delete('/api/tags/synonyms/:source', asyncHandler(deleteSynonymRoute));

  app.post('/api/categories/import', asyncHandler(importCategories));

  // New background processing routes (thumbnails-v2, scan-state, jobs)
  app.use('/api/thumbnails', thumbnailsV2Routes);
  app.use('/api/scan-state', scanStateRoutes);
  app.use('/api/jobs', jobsRoutes);

  logger.info('API routes registered', {
    routes: [
      '/api/errors/report',
      '/api/errors/stats',
      '/api/health',
      '/api/db/health',
      '/api/videos',
      '/api/roots',
      '/api/presets',
      '/api/thumbnails/generate',
      '/api/thumbnails/:videoId (v2)',
      '/api/scan-state/:rootKey',
      '/api/jobs',
      '/api/videos/compute-hashes',
      '/api/videos/duplicates',
    ],
  });

  const httpServer = createServer(app);

  return httpServer;
}
