import './env.js';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import passport from 'passport';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { corsMiddleware } from './middleware/cors.js';
import { csrfProtection } from './middleware/csrf.js';
import { errorHandler } from './middleware/errorHandler.js';
import { correlationId } from './middleware/correlationId.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import oauthRoutes from './routes/oauth.js';
import appsRoutes from './routes/apps.js';
import adminRoutes from './routes/admin.js';
import accessRequestsRoutes from './routes/access-requests.js';
import healthRoutes from './routes/health.js';
import { client } from './config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables (now handled by import './env.js')

const app = express();
const PORT = process.env.PORT || 5500;

// Trust the first proxy so rate limiting and secure cookies work behind reverse proxies.
app.set('trust proxy', 1);

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // React inline styles
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", ...(process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [])],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  xXssProtection: false, // Deprecated; CSP provides XSS protection instead
}));

// CORS
app.use(corsMiddleware);

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Cookie parser
app.use(cookieParser());

// Session middleware (required for OAuth)
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'dev-session-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: parseInt(process.env.SESSION_MAX_AGE || '2592000000'), // 30 days
    },
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Attach correlation ID for request tracing
app.use(correlationId);

const isRateLimitDisabled = (
  process.env.DISABLE_RATE_LIMITING === 'true' ||
  process.env.NODE_ENV === 'test' ||
  process.env.NODE_ENV === 'development'
);

// Bypass key for production testing (e.g., OpenClaw browser tests)
const rateLimitBypassKey = process.env.RATE_LIMIT_BYPASS_KEY || '';
function hasBypassKey(req: express.Request): boolean {
  return !!rateLimitBypassKey && req.headers['x-rate-limit-bypass'] === rateLimitBypassKey;
}

// Rate limiting — fully disabled in test/dev for browser testing throughput
const noopLimiter = (_req: express.Request, _res: express.Response, next: express.NextFunction) => next();

const authLimiter = isRateLimitDisabled ? noopLimiter : rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.AUTH_RATE_LIMIT_MAX ? parseInt(process.env.AUTH_RATE_LIMIT_MAX) : 100,
  skip: hasBypassKey,
  message: { error: 'Too many requests from this IP, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.setHeader('Retry-After', String(Math.ceil(15 * 60)));
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later',
      retryAfterSeconds: 15 * 60,
    });
  },
});

const strictAuthLimiter = isRateLimitDisabled ? noopLimiter : rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.AUTH_STRICT_RATE_LIMIT_MAX ? parseInt(process.env.AUTH_STRICT_RATE_LIMIT_MAX) : 5,
  skip: hasBypassKey,
  message: { error: 'Too many authentication attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (_req, res) => {
    res.setHeader('Retry-After', String(Math.ceil(15 * 60)));
    res.status(429).json({
      error: 'Too many authentication attempts, please try again later',
      retryAfterSeconds: 15 * 60,
    });
  },
});

// Rate limit warning: adds X-RateLimit-Warning header when remaining < 20%
function rateLimitWarning(_req: express.Request, res: express.Response, next: express.NextFunction) {
  const originalWriteHead = res.writeHead;
  res.writeHead = function (this: express.Response, ...args: Parameters<typeof res.writeHead>) {
    const limit = parseInt(res.getHeader('RateLimit-Limit') as string, 10);
    const remaining = parseInt(res.getHeader('RateLimit-Remaining') as string, 10);
    if (!isNaN(limit) && !isNaN(remaining) && limit > 0) {
      const threshold = Math.ceil(limit * 0.2);
      if (remaining <= threshold && remaining > 0) {
        res.setHeader('X-RateLimit-Warning', 'true');
      }
    }
    return originalWriteHead.apply(this, args);
  } as typeof res.writeHead;
  next();
}

app.use(rateLimitWarning);

// ============================================================================
// ROUTES
// ============================================================================

// Health check routes (k8s probes + detailed metrics)
app.use('/health', healthRoutes);

// API info (moved to /api endpoint)
app.get('/api', (_req, res) => {
  res.status(200).json({
    name: 'Unified Authentication Service',
    version: '1.0.0',
    description: 'Centralized authentication for l2p, VideoVault, and shop projects',
    endpoints: {
      health: 'GET /health',
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        logout: 'POST /api/auth/logout',
        refresh: 'POST /api/auth/refresh',
        verify: 'GET /api/auth/verify',
        verifyEmail: 'POST /api/auth/verify-email',
        forgotPassword: 'POST /api/auth/forgot-password',
        resetPassword: 'POST /api/auth/reset-password',
        changePassword: 'POST /api/auth/change-password',
      },
      oauth: {
        google: 'GET /api/oauth/google',
        googleCallback: 'GET /api/oauth/google/callback',
        providers: 'GET /api/oauth/providers',
        unlinkProvider: 'DELETE /api/oauth/providers/:provider',
      },
      apps: {
        list: 'GET /api/apps',
      },
      admin: {
        users: 'GET /api/admin/users',
        user: 'GET /api/admin/users/:userId',
        updateUser: 'PATCH /api/admin/users/:userId',
        deleteUser: 'DELETE /api/admin/users/:userId',
        apps: 'GET /api/admin/apps',
        updateApp: 'PATCH /api/admin/apps/:id',
        appUsers: 'GET /api/admin/apps/:appId/users',
        userApps: 'GET /api/admin/users/:userId/apps',
        updateUserApps: 'PUT /api/admin/users/:userId/apps',
      },
      accessRequests: {
        create: 'POST /api/access-requests',
        list: 'GET /api/access-requests',
        adminList: 'GET /api/access-requests/admin',
        review: 'PATCH /api/access-requests/admin/:id',
      },
      user: {
        me: 'GET /api/user/me',
        updateProfile: 'PATCH /api/user/profile',
      },
    },
  });
});

// Authentication routes (with rate limiting + CSRF)
app.use('/api/auth/login', strictAuthLimiter);
app.use('/api/auth/register', strictAuthLimiter);
app.use('/api/auth/forgot-password', strictAuthLimiter);
app.use('/api/auth', authLimiter, csrfProtection, authRoutes);

// OAuth routes (no CSRF — Google callback is a browser redirect,
// L2P token endpoint is server-to-server)
app.use('/api/oauth', authLimiter, oauthRoutes);

// Apps routes (CSRF on state-changing requests)
app.use('/api/apps', authLimiter, csrfProtection, appsRoutes);

// Admin routes (CSRF on state-changing requests)
app.use('/api/admin', authLimiter, csrfProtection, adminRoutes);

// Access request routes (CSRF on state-changing requests)
app.use('/api/access-requests', authLimiter, csrfProtection, accessRequestsRoutes);

// User routes (CSRF on state-changing requests)
app.use('/api/user', authLimiter, csrfProtection, userRoutes);

// Serve static frontend files
// In development (tsx): __dirname = /home/patrick/projects/auth/src
// After build: __dirname = /home/patrick/projects/auth/dist
const publicPath = join(__dirname, '..', 'dist', 'public');
console.log('Serving frontend from:', publicPath);
app.use(express.static(publicPath));

// Serve React app for all other routes (SPA fallback)
app.get('*', (req, res, next) => {
  // Skip API routes and health check
  if (req.path.startsWith('/api') || req.path.startsWith('/health')) {
    return next();
  }
  const indexPath = join(publicPath, 'index.html');
  res.sendFile(indexPath);
});

// 404 handler for API routes only
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
  });
});

// Error handler (must be last)
app.use(errorHandler);

// ============================================================================
// START SERVER
// ============================================================================

// Sync app catalog URLs on startup to ensure production domains are always current
async function syncAppCatalog() {
  try {
    await client`
      INSERT INTO auth.apps (key, name, description, url)
      VALUES
        ('l2p', 'Learn2Play', 'Multiplayer quiz platform', 'https://l2p.korczewski.de'),
        ('videovault', 'VideoVault', 'Video manager', 'https://videovault.korczewski.de'),
        ('shop', 'GoldCoins Shop', 'Digital currency shop', 'https://shop.korczewski.de')
      ON CONFLICT (key) DO UPDATE SET
        name = EXCLUDED.name,
        description = EXCLUDED.description,
        url = EXCLUDED.url
    `;
    console.log('✅ App catalog URLs synced');
  } catch (err) {
    // Non-fatal: table may not exist yet if migrations haven't run
    console.warn('⚠️  App catalog sync skipped (table may not exist yet):', (err as Error).message);
  }
}

const server = app.listen(PORT, async () => {
  console.log('================================================================================');
  console.log('🚀 Unified Authentication Service');
  console.log('================================================================================');
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ API URL: ${process.env.APP_URL || `http://localhost:${PORT}`}`);
  await syncAppCatalog();
  console.log('================================================================================');
  console.log('Available endpoints:');
  console.log(`  - Health Check:    GET  http://localhost:${PORT}/health`);
  console.log(`  - API Info:        GET  http://localhost:${PORT}/`);
  console.log(`  - Register:        POST http://localhost:${PORT}/api/auth/register`);
  console.log(`  - Login:           POST http://localhost:${PORT}/api/auth/login`);
  console.log(`  - Logout:          POST http://localhost:${PORT}/api/auth/logout`);
  console.log(`  - Refresh Token:   POST http://localhost:${PORT}/api/auth/refresh`);
  console.log(`  - Verify Token:    GET  http://localhost:${PORT}/api/auth/verify`);
  console.log(`  - User Profile:    GET  http://localhost:${PORT}/api/user/me`);
  console.log('================================================================================');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

export default app;
