import express, { type Request, Response, NextFunction } from 'express';
import { registerRoutes } from './routes';
import { setupVite, serveStatic, log } from './vite';
import { logger } from './lib/logger';
import { ensureDbReady } from './db';
import cookieParser from 'cookie-parser';
import csurf from 'csurf';
import { globalErrorHandler } from './middleware/errorHandler';
import { requestId, requestLogger, metricsMiddleware } from './middleware/observability';
import { setupSecurityHeaders } from './middleware/security';
import { setupRateLimiting } from './middleware/rate-limit';
import { createSessionMiddleware } from './config/session';
import { createCorsMiddleware } from './config/cors';
import compression from 'compression';

import path from 'path';
import fs from 'fs';

const app = express();
// When behind a proxy/load balancer (e.g., Docker/NGINX), trust X-Forwarded-* for secure cookies
if (process.env.TRUST_PROXY === '1' || process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Default request size limits (reduced for security)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' }));

// Compression for better performance
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: 6, // Good balance between speed and compression
}));

// Serve media files from MEDIA_ROOT or default to Bibliothek
const mediaRoot = process.env.MEDIA_ROOT || path.join(process.cwd(), 'Bibliothek');
const processedPath = process.env.PROCESSED_MEDIA_PATH || path.join(mediaRoot, 'processed');

// Only mount processed media if path exists
if (fs.existsSync(processedPath)) {
  app.use('/media/processed', express.static(processedPath));
  logger.info('Processed media mounted', { path: processedPath });
} else {
  logger.warn('Processed media path not found', { path: processedPath });
}

app.use('/media', express.static(mediaRoot));

// Session configuration (Postgres-backed if DB configured)
app.use(createSessionMiddleware());

// CORS: apply only to /api and allow local origins in development
app.use('/api', createCorsMiddleware());

// Security Headers (Helmet.js)
setupSecurityHeaders(app);

// Rate Limiting (production only)
if (process.env.NODE_ENV === 'production') {
  setupRateLimiting(app);
}

// Cookies for CSRF protection and other features
app.use(cookieParser());

// CSRF protection for mutating routes under /api except in tests and development
const enableCsrf = process.env.NODE_ENV === 'production' && process.env.FAST_TESTS !== '1';
if (enableCsrf) {
  const csrfProtection = csurf({
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
    ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
  });
  app.use('/api', csrfProtection as any);
}

app.use(requestId);
app.use(metricsMiddleware);
app.use(requestLogger);

(async () => {
  // Initialize DB connection if configured
  if (process.env.DATABASE_URL) {
    try {
      await ensureDbReady();
      logger.info('Database connection verified');
    } catch (err) {
      logger.error('Failed to connect to database', { error: (err as Error).message });
      // Continue to boot so app remains accessible (may use in-memory fallbacks)
    }
  }

  // Cleanup old logs on startup
  await logger.cleanup();

  const server = registerRoutes(app);

  // Handle CSRF errors with 403 instead of 500
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    if (err && err.code === 'EBADCSRFTOKEN') {
      logger.warn('CSRF token invalid or missing', { path: req.path, method: req.method });
      return res.status(403).json({ message: 'Invalid CSRF token' });
    }
    return next(err);
  });

  app.use(globalErrorHandler);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get('env') === 'development') {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Serve the app on the configured PORT. In development, if the port is busy,
  // fall back to the next available port to avoid orphan conflicts.
  const basePort = parseInt(process.env.PORT || '5000', 10);

  async function listenWithRetry(p: number, attemptsLeft: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const onError = (err: any) => {
        if (
          err?.code === 'EADDRINUSE' &&
          process.env.NODE_ENV === 'development' &&
          attemptsLeft > 0
        ) {
          const nextPort = p + 1;
          logger.warn(`Port ${p} in use; retrying on ${nextPort}`);
          server.off('error', onError);
          // Try the next port
          listenWithRetry(nextPort, attemptsLeft - 1)
            .then(resolve)
            .catch(reject);
        } else {
          reject(err);
        }
      };

      server.once('error', onError);
      server.listen({ port: p, host: '0.0.0.0', reusePort: true }, () => {
        server.off('error', onError);
        log(`serving on port ${p}`);
        resolve();
      });
    });
  }

  try {
    const maxHops = process.env.NODE_ENV === 'development' ? 5 : 0;
    await listenWithRetry(basePort, maxHops);
  } catch (err) {
    logger.error('Failed to bind server port', { error: (err as Error).message, port: basePort });
    process.exit(1);
  }
})();
