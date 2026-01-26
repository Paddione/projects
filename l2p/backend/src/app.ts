import express, { Application, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/auth.js';
import healthRoutes from './routes/health.js';
import lobbyRoutes from './routes/lobbies.js';
import questionRoutes from './routes/questions.js';
import questionManagementRoutes from './routes/question-management.js';
import scoringRoutes from './routes/scoring.js';
console.log('🔵 Attempting to import perks routes...');
import perksRoutes from './routes/perks.js';
console.log('🟢 Perks routes imported successfully!');

export function setupApp(app: Application) {
  // Trust proxy for rate limiting behind Nginx/Traefik
  app.set('trust proxy', 1);

  // Security middleware
  app.use(helmet());

  // CORS configuration
  const allowedOrigins = process.env['CORS_ORIGINS']
    ? process.env['CORS_ORIGINS'].split(',')
    : ['https://l2p.korczewski.de', 'http://localhost:3000', 'http://localhost:3002'];

  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl)
      if (!origin) return callback(null, true);

      const isAllowed = allowedOrigins.some(allowedOrigin => {
        if (allowedOrigin.includes('*')) {
          const pattern = new RegExp('^' + allowedOrigin.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
          return pattern.test(origin);
        }
        return allowedOrigin === origin;
      });

      if (isAllowed || origin.endsWith('.korczewski.de')) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  }));

  // Rate limiting
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // limit each IP to 300 requests per windowMs
    skip: (req) => {
      // Skip health check endpoints used by Kubernetes probes
      return req.path === '/api/health' || req.path === '/healthz';
    },
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  });

  // Apply rate limiting to all API routes
  app.use('/api/', apiLimiter);

  // Body parsing middleware
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // Logging middleware for development
  if (process.env['NODE_ENV'] === 'development') {
    app.use((req: Request, res: Response, next: NextFunction) => {
      console.log(`${req.method} ${req.path}`);
      next();
    });
  }

  // API routes
  app.use('/api/auth', authRoutes);
  app.use('/api/health', healthRoutes);
  app.use('/api/lobbies', lobbyRoutes);
  app.use('/api/questions', questionRoutes);
  app.use('/api/admin/questions', questionManagementRoutes);
  app.use('/api/scoring', scoringRoutes);
  app.use('/api/perks', perksRoutes);

  // Health check endpoint
  app.get('/healthz', (req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  // 404 handler for undefined routes
  app.use(notFoundHandler);

  // Global error handler (must be last)
  app.use(errorHandler);
}

export function createApp(): Application {
  const app = express();
  setupApp(app);
  return app;
}

// Only create and export the app if this file is run directly
if (require.main === module) {
  const app = createApp();
  const PORT = process.env['PORT'] || 3001;

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env['NODE_ENV'] || 'development'}`);
  });
}

export default createApp();
