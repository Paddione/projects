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
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import oauthRoutes from './routes/oauth.js';
import appsRoutes from './routes/apps.js';
import adminRoutes from './routes/admin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables (now handled by import './env.js')

const app = express();
const PORT = process.env.PORT || 5500;

// ============================================================================
// MIDDLEWARE
// ============================================================================

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false, // Disabled to allow inline styles from React
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
      maxAge: parseInt(process.env.SESSION_MAX_AGE || '2592000000'), // 30 days
    },
  })
);

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// Rate limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

const strictAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // Strict limit for login/register
  message: 'Too many authentication attempts, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

// ============================================================================
// ROUTES
// ============================================================================

// Health check
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'healthy',
    service: 'unified-auth-service',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API info (moved to /api endpoint)
app.get('/api', (_req, res) => {
  res.status(200).json({
    name: 'Unified Authentication Service',
    version: '1.0.0',
    description: 'Centralized authentication for l2p, VideoVault, and payment projects',
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
        apps: 'GET /api/admin/apps',
        userApps: 'GET /api/admin/users/:userId/apps',
        updateUserApps: 'PUT /api/admin/users/:userId/apps',
      },
      user: {
        me: 'GET /api/user/me',
        updateProfile: 'PATCH /api/user/profile',
      },
    },
  });
});

// Authentication routes (with rate limiting)
app.use('/api/auth/login', strictAuthLimiter);
app.use('/api/auth/register', strictAuthLimiter);
app.use('/api/auth', authLimiter, authRoutes);

// OAuth routes
app.use('/api/oauth', authLimiter, oauthRoutes);

// Apps routes
app.use('/api/apps', authLimiter, appsRoutes);

// Admin routes
app.use('/api/admin', authLimiter, adminRoutes);

// User routes
app.use('/api/user', authLimiter, userRoutes);

// Serve static frontend files
// In development (tsx): __dirname = /home/patrick/projects/auth/src
// After build: __dirname = /home/patrick/projects/auth/dist
const publicPath = join(__dirname, '..', 'dist', 'public');
console.log('Serving frontend from:', publicPath);
app.use(express.static(publicPath));

// Serve React app for all other routes (SPA fallback)
app.get('*', (req, res, next) => {
  // Skip API routes and health check
  if (req.path.startsWith('/api') || req.path === '/health') {
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

const server = app.listen(PORT, () => {
  console.log('================================================================================');
  console.log('🚀 Unified Authentication Service');
  console.log('================================================================================');
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✅ API URL: ${process.env.APP_URL || `http://localhost:${PORT}`}`);
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
