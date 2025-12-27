import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
// Centralized environment loader
import './config/env.js';
import { DatabaseService } from './services/DatabaseService.js';
import { MigrationService } from './services/MigrationService.js';
import { SocketService } from './services/SocketService.js';
import { CleanupService } from './services/CleanupService.js';
import { LobbyService } from './services/LobbyService.js';
import authRoutes from './routes/auth.js';
import healthRoutes from './routes/health.js';
import lobbyRoutes from './routes/lobbies.js';
import questionRoutes from './routes/questions.js';
import questionManagementRoutes from './routes/question-management.js';
import scoringRoutes from './routes/scoring.js';
import hallOfFameRoutes from './routes/hall-of-fame.js';
import characterRoutes from './routes/characters.js';
import fileUploadRoutes from './routes/file-upload.js';
import adminRoutes from './routes/admin.js';
import perksRoutes from './routes/perks.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { requestLogger } from './middleware/logging.js';
import { initializeBackendHealthChecks } from './health/index.js';
import { correlationId } from './middleware/correlationId.js';
import { metricsMiddleware } from './middleware/metrics.js';
import metricsRoutes from './routes/metrics.js';

// Feature flag: disable rate limiting in development and tests, or via override
const isRateLimitDisabled = (
  process.env['DISABLE_RATE_LIMITING'] === 'true' ||
  process.env['NODE_ENV'] === 'test' ||
  process.env['NODE_ENV'] === 'development'
);

const app = express();
const server = createServer(app);

// Export app for testing
export { app };

// Enable strong ETag for better conditional GET support
app.set('etag', 'strong');

// Trust proxy for nginx reverse proxy - required for rate limiting to work correctly
// Use specific trust proxy setting for production with nginx
app.set('trust proxy', process.env['NODE_ENV'] === 'production' ? 1 : false);

// CORS configuration with subdomain support and flexible env config
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // 1) Allow requests with no origin (mobile apps, curl, same-origin SSR)
    if (!origin) return callback(null, true);

    const env = process.env['NODE_ENV'] || 'development';
    const allowAll = process.env['CORS_ALLOW_ALL'] === 'true';

    // Short-circuit: explicit allow-all switch (use only for emergencies)
    if (allowAll) {
      console.log(`CORS allowed - CORS_ALLOW_ALL for origin: ${origin}`);
      return callback(null, true);
    }

    // 2) Collect allowed origins from env
    const frontendUrl = process.env['FRONTEND_URL'] || 'http://localhost:3000';
    const corsOrigin = process.env['CORS_ORIGIN']; // single value
    const corsOrigins = process.env['CORS_ORIGINS']; // comma-separated list
    const socketCorsOrigin = process.env['SOCKET_CORS_ORIGIN']; // optional
    const domainEnv = process.env['DOMAIN']; // e.g., l2p.korczewski.de

    const allowedOrigins = new Set<string>();
    const pushIf = (v?: string) => { if (v && v.trim()) allowedOrigins.add(v.trim()); };
    pushIf(frontendUrl);
    pushIf(corsOrigin);
    pushIf(socketCorsOrigin);
    if (corsOrigins) {
      corsOrigins.split(',').map(s => s.trim()).filter(Boolean).forEach(o => allowedOrigins.add(o));
    }
    // Add DOMAIN-derived scheme variants for exact-match allowance
    if (domainEnv) {
      pushIf(`https://${domainEnv}`);
      pushIf(`http://${domainEnv}`);
    }

    // Always allow localhost variants in development
    if (env === 'development') {
      ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3002', 'http://127.0.0.1:3002', 'http://localhost:5173', 'http://127.0.0.1:5173']
        .forEach(o => allowedOrigins.add(o));

      // Additionally allow common LAN IPs for Vite dev server access via IP
      // e.g., http://192.168.x.x:3000 or http://10.x.x.x:3000
      try {
        if (origin) {
          const o = new URL(origin);
          const host = o.hostname;
          const port = o.port || '80';
          const isPrivateLan = /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
          const isDevPort = ['3000', '3002', '5173'].includes(port);
          if (isPrivateLan && isDevPort) {
            console.log(`CORS allowed - LAN dev origin: ${origin}`);
            return callback(null, true);
          }
        }
      } catch {
        // ignore URL parse errors
      }
    }

    // 3) Exact match check
    if (allowedOrigins.has(origin)) {
      console.log(`CORS allowed - exact match: ${origin}`);
      return callback(null, true);
    }

    // 4) Subdomain check based on registrable domain of FRONTEND_URL and DOMAIN
    const allowedBaseDomains: string[] = [];
    try {
      const url = new URL(frontendUrl);
      const hostParts = url.hostname.split('.');
      if (hostParts.length >= 2) {
        allowedBaseDomains.push(hostParts.slice(-2).join('.'));
      }
    } catch {
      // ignore
    }
    if (domainEnv && /^[a-z0-9.-]+$/.test(domainEnv.trim())) {
      allowedBaseDomains.push(domainEnv.trim());
    }

    if (allowedBaseDomains.length > 0) {
      try {
        const { hostname } = new URL(origin);
        if (allowedBaseDomains.some(base => hostname === base || hostname.endsWith(`.${base}`))) {
          console.log(`CORS allowed - subdomain match: ${origin} (bases ${allowedBaseDomains.join(', ')})`);
          return callback(null, true);
        }
      } catch {
        console.log(`CORS rejected - invalid origin URL: ${origin}`);
        return callback(new Error('Not allowed by CORS - Invalid origin'), false);
      }
    }

    // 5) In production, allow same-origin (protocol/host/port) with FRONTEND_URL
    if (env === 'production') {
      try {
        const o = new URL(origin);
        const f = new URL(frontendUrl);
        if (o.protocol === f.protocol && o.hostname === f.hostname && o.port === f.port) {
          console.log(`CORS allowed - same origin (prod): ${origin}`);
          return callback(null, true);
        }
      } catch {
        // ignore
      }
    }

    // 6) No match
    console.log(`CORS rejected - no match. Origin: ${origin}. Allowed: ${JSON.stringify(Array.from(allowedOrigins))}. Base domains: ${JSON.stringify(allowedBaseDomains)}`);
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  // Add headers for Private Network Access
  exposedHeaders: ['Access-Control-Allow-Private-Network'],
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Handle OPTIONS preflight explicitly for Private Network Access BEFORE cors middleware
// This ensures the Access-Control-Allow-Private-Network header is present on preflight responses
app.options('*', (req: Request, res: Response) => {
  // Add PNA response header if requested by the browser
  if (req.headers['access-control-request-private-network']) {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
  // Mirror typical CORS headers for preflight
  const origin = req.headers.origin as string | undefined;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  return res.sendStatus(204);
});

const io = new Server(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000,
  upgradeTimeout: 30000,
  maxHttpBufferSize: 1e6,
  allowEIO3: true
});

// Security middleware with environment-specific configuration
const isDevelopment = process.env['NODE_ENV'] === 'development' || !process.env['NODE_ENV'];

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  // Disable Cross-Origin-Opener-Policy in development to prevent browser warnings
  // about untrustworthy origins when accessing via IP addresses (e.g., http://10.0.0.45:3000)
  // In production, use 'same-origin' for better security
  crossOriginOpenerPolicy: isDevelopment ? false : { policy: 'same-origin' },
  // Disable Origin-Agent-Cluster to prevent inconsistent header warnings
  originAgentCluster: false
}));

app.use(cors(corsOptions));

// Remove Origin-Agent-Cluster header to prevent browser warnings about inconsistent usage
app.use((req, res, next) => {
  // Override the end method to remove the header right before sending response
  const originalEnd = res.end;
  res.end = function (chunk?: any, encoding?: BufferEncoding | (() => void), cb?: () => void) {
    res.removeHeader('Origin-Agent-Cluster');
    if (typeof encoding === 'function') {
      return originalEnd.call(this, chunk, 'utf8', encoding);
    } else {
      return originalEnd.call(this, chunk, encoding || 'utf8', cb);
    }
  };
  next();
});

// Add Private Network Access headers for Chrome
app.use((req, res, next) => {
  // Handle preflight requests for Private Network Access
  if (req.method === 'OPTIONS' && req.headers['access-control-request-private-network']) {
    res.setHeader('Access-Control-Allow-Private-Network', 'true');
  }
  next();
});

// Rate limiting with different limits for different endpoints
// Disable rate limiting when DISABLE_RATE_LIMITING=true or in test environment
const generalLimiter = isRateLimitDisabled ? (req: Request, res: Response, next: NextFunction) => next() : rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    error: 'Too Many Requests',
    message: 'Too many requests from this IP, please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, _next) => {
    try {
      // Provide Retry-After in seconds to instruct client backoff
      const retryAfterSec = Math.ceil((15 * 60 * 1000) / 1000);
      res.setHeader('Retry-After', String(retryAfterSec));
    } catch { }
    return res.status(429).json({
      error: 'Too Many Requests',
      message: 'Too many requests from this IP, please try again later.',
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfterSeconds: Math.ceil((15 * 60 * 1000) / 1000),
      timestamp: new Date().toISOString()
    });
  }
});

const authLimiter = isRateLimitDisabled ? (req: Request, res: Response, next: NextFunction) => next() : rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 auth requests per windowMs (loosened from 10)
  message: {
    error: 'Too Many Authentication Attempts',
    message: 'Too many authentication attempts, please try again later.',
    code: 'AUTH_RATE_LIMIT_EXCEEDED'
  },
  // Do not count successful responses (2xx) towards the limit. This prevents
  // harmless calls like /api/auth/validate and successful /forgot-password from
  // exhausting the user's quota and causing 429s during normal flows.
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, _next) => {
    try {
      const retryAfterSec = Math.ceil((15 * 60 * 1000) / 1000);
      res.setHeader('Retry-After', String(retryAfterSec));
    } catch { }
    return res.status(429).json({
      error: 'Too Many Authentication Attempts',
      message: 'Too many authentication attempts, please try again later.',
      code: 'AUTH_RATE_LIMIT_EXCEEDED',
      retryAfterSeconds: Math.ceil((15 * 60 * 1000) / 1000),
      timestamp: new Date().toISOString()
    });
  }
});

// Core request parsing and tracing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Attach correlation ID as early as possible
app.use(correlationId);

// HTTP metrics timer (after correlation id, before logger)
app.use(metricsMiddleware);

// Expose metrics endpoint before general rate limiting to avoid self-interference
app.use('/metrics', metricsRoutes);

// Apply general rate limiter afterward
app.use(generalLimiter);

// Re-apply CORS after parsers (idempotent)
app.use(cors(corsOptions));

// Request logging middleware
app.use(requestLogger);


// Input sanitization middleware (placeholder - implement if needed)
// app.use(sanitize);

// Error logging middleware (placeholder - implement if needed)
// app.use(errorLogger);

// Health check routes (no rate limiting for health checks)
app.use('/api/health', healthRoutes);

// Migration status endpoint under API
app.get('/api/migrations/status', async (req: Request, res: Response) => {
  try {
    const migrationService = new MigrationService();
    const status = await migrationService.getMigrationStatus();
    res.json({
      ...status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get migration status',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    });
  }
});

// API routes with specific rate limiting
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/lobbies', lobbyRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/question-management', questionManagementRoutes);
app.use('/api/scoring', scoringRoutes);
app.use('/api/hall-of-fame', hallOfFameRoutes);
app.use('/api/characters', characterRoutes);
app.use('/api/file-upload', fileUploadRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/perks', perksRoutes);

// Basic API routes
app.get('/api/status', (req: Request, res: Response) => {
  // Allow caching with revalidation to demonstrate ETag/304
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=120, stale-while-revalidate=120');
  res.json({
    message: 'Learn2Play API is running!',
    version: '1.0.0',
    environment: process.env['NODE_ENV'] || 'development'
  });
});

// Database test endpoint
app.get('/api/database/test', async (req: Request, res: Response) => {
  try {
    const db = DatabaseService.getInstance();
    const result = await db.query('SELECT NOW() as current_time, version() as pg_version');
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Database test failed'
    });
  }
});

// 404 handler for undefined routes
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// Initialize Socket.IO service
new SocketService(io);

// Global cleanup service reference for shutdown handlers
let cleanupService: CleanupService | null = null;

// Initialize database and start server
async function startServer() {
  const PORT = process.env['PORT'] || 3001;

  try {
    console.log('Error handling system initialized');

    console.log('Initializing backend health checks...');
    await initializeBackendHealthChecks();
    console.log('Backend health checks initialized');

    console.log('Initializing database connection...');
    const db = DatabaseService.getInstance();
    await db.testConnection();
    console.log('Database connection established successfully');

    console.log('Skipping migrations temporarily...');
    // const migrationService = new MigrationService();
    // await migrationService.runMigrations();
    console.log('Database migrations skipped');

    // console.log('Validating applied migrations...');
    // const isValid = await migrationService.validateMigrations();
    // if (!isValid) {
    //   throw new Error('Migration validation failed');
    // }
    console.log('Migration validation skipped');

    // Initialize cleanup service in non-test environments
    if (process.env['NODE_ENV'] !== 'test') {
      const lobbyService = new LobbyService();
      cleanupService = new CleanupService(lobbyService);
      cleanupService.start();
      console.log('Cleanup service initialized');
    }

    server.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Environment: ${process.env['NODE_ENV'] || 'development'}`);
      console.log(`Database: ${db.isHealthy() ? 'Connected' : 'Disconnected'}`);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown handling - only set up when not running tests
if (process.env['NODE_ENV'] !== 'test' && !process.env['JEST_WORKER_ID']) {
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');

    try {
      // Stop cleanup service if running
      if (cleanupService) {
        cleanupService.stop();
        console.log('Cleanup service stopped');
      }

      const db = DatabaseService.getInstance();
      await db.close();
      console.log('Database connections closed');

      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  });

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully...');

    try {
      // Stop cleanup service if running
      if (cleanupService) {
        cleanupService.stop();
        console.log('Cleanup service stopped');
      }

      const db = DatabaseService.getInstance();
      await db.close();
      console.log('Database connections closed');

      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  });
}

// Start the server unless we're under Jest/tests
if (process.env['NODE_ENV'] !== 'test' && !process.env['JEST_WORKER_ID']) {
  startServer();
}
