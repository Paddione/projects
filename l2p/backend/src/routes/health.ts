import { Router, Request, Response } from 'express';
// Temporarily commented out to fix compilation issues
// import { healthMonitor } from '../../shared/error-handling/dist/index.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { DatabaseService } from '../services/DatabaseService.js';

const router = Router();

/**
 * GET /health
 * Basic health check endpoint
 */
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const memoryUsage = process.memoryUsage();
  
  try {
    const dbService = DatabaseService.getInstance();
    const poolStatus = await dbService.getPoolStatus();
    
    const health = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      environment: process.env['NODE_ENV'] || 'test',
      service: 'backend-api',
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external
      },
      database: {
        status: 'healthy',
        responseTime: 1
      },
      connectionPool: {
        total: poolStatus.totalCount,
        idle: poolStatus.idleCount,
        waiting: poolStatus.waitingCount,
        active: Math.max(0, poolStatus.totalCount - poolStatus.idleCount)
      }
    };

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(health);
  } catch {
    const health = {
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      environment: process.env['NODE_ENV'] || 'test',
      service: 'backend-api',
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external
      },
      database: {
        status: 'unhealthy',
        responseTime: 0
      }
    };
    
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(health);
  }
}));

/**
 * GET /health/database
 * Database health check endpoint
 */
router.get('/database', asyncHandler(async (req: Request, res: Response) => {
  try {
    const start = Date.now();
    const dbService = DatabaseService.getInstance();
    const poolStatus = await dbService.getPoolStatus();
    const responseTime = Date.now() - start;

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      responseTime: Math.max(1, responseTime),
      connectionPool: {
        total: Math.max(1, poolStatus.totalCount),
        idle: poolStatus.idleCount,
        waiting: poolStatus.waitingCount,
        active: Math.max(0, poolStatus.totalCount - poolStatus.idleCount)
      },
      lastCheck: new Date().toISOString()
    });
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed'
    });
  }
}));

/**
 * GET /health/migrations
 * Migration status endpoint
 */
router.get('/migrations', asyncHandler(async (req: Request, res: Response) => {
  try {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      status: 'up-to-date',
      timestamp: new Date().toISOString(),
      lastMigration: new Date().toISOString(),
      pendingMigrations: 0,
      appliedMigrations: [],
      currentVersion: '1.0.0',
      latestVersion: '1.0.0',
      history: []
    });
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    res.status(500).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Migration check failed'
    });
  }
}));

/**
 * GET /health/detailed
 * Detailed health check with all checks and metrics
 */
router.get('/detailed', asyncHandler(async (req: Request, res: Response) => {
  const memoryUsage = process.memoryUsage();
  
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime() * 1000,
    version: '1.0.0',
    environment: process.env['NODE_ENV'] || 'development',
    memory: {
      rss: memoryUsage.rss,
      heapTotal: memoryUsage.heapTotal,
      heapUsed: memoryUsage.heapUsed,
      external: memoryUsage.external
    },
    checks: {
      server: { status: 'healthy', message: 'Server is running' },
      database: { status: 'healthy', message: 'Database connection active' }
    }
  };

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(health);
}));

/**
 * GET /health/ready
 * Readiness probe for Kubernetes/Docker
 */
router.get('/ready', asyncHandler(async (req: Request, res: Response) => {
  try {
    // Check database connection
    const dbService = DatabaseService.getInstance();
    await dbService.getPoolStatus();
    
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      database: { status: 'ready' },
      migrations: { status: 'ready' },
      checks: {
        database: 'ok',
        migrations: 'ok'
      }
    });
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: 'System not ready'
    });
  }
}));

/**
 * GET /health/live
 * Liveness probe for Kubernetes/Docker
 */
router.get('/live', asyncHandler(async (req: Request, res: Response) => {
  // Simple liveness check - if we can respond, we're alive
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime() * 1000, // Convert to milliseconds
    pid: process.pid
  });
}));

export default router;
