import type { Express, NextFunction, Request, Response } from 'express';
import { createServer, type Server } from 'http';
import type { Session } from 'express-session';
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

// ... (existing imports)

// ... (inside registerRoutes)

type AdminUser = { username: string; role: 'admin' };
type AdminSession = Session & { user?: AdminUser };
type CsrfRequest = Request & { csrfToken?: () => string };
type AuthBody = { username?: string; password?: string };

// Basic/session admin auth middleware
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const adminUser = process.env.ADMIN_USER || 'admin';
  const adminPass = process.env.ADMIN_PASS || 'changeme';

  const session = req.session as AdminSession | undefined;
  const hasSession = session?.user?.role === 'admin';
  if (hasSession) return next();

  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Basic ')) {
    const creds = Buffer.from(authHeader.slice(6), 'base64').toString();
    const [u, p] = creds.split(':');
    if (u === adminUser && p === adminPass) {
      // Establish session for subsequent requests
      (req.session as AdminSession).user = { username: u, role: 'admin' };
      return next();
    }
  }
  res.status(401).json({ message: 'Unauthorized' });
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
  app.get('/api/auth/status', (req: Request, res: Response) => {
    const isAdmin = (req.session as AdminSession | undefined)?.user?.role === 'admin';
    res.json({ isAdmin });
  });

  // Auth routes (session-based)
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { username, password } = (req.body || {}) as AuthBody;
    const adminUser = process.env.ADMIN_USER || 'admin';
    const adminPass = process.env.ADMIN_PASS || 'changeme';
    if (username === adminUser && password === adminPass) {
      (req.session as AdminSession).user = { username, role: 'admin' };
      return res.json({ ok: true });
    }
    return res.status(401).json({ message: 'Invalid credentials' });
  });
  app.post('/api/auth/logout', (req: Request, res: Response) => {
    req.session?.destroy(() => {
      res.json({ ok: true });
    });
  });

  // CSRF token endpoint for SPA
  app.get('/api/csrf', (req: Request, res: Response) => {
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
      '/api/videos/compute-hashes',
      '/api/videos/duplicates',
    ],
  });

  const httpServer = createServer(app);

  return httpServer;
}
