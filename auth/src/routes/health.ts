import { Router } from 'express';
import { client } from '../config/database.js';

const router = Router();

/**
 * GET /health
 * Basic health check with memory and database status
 */
router.get('/', async (_req, res) => {
  const memoryUsage = process.memoryUsage();

  try {
    const start = Date.now();
    await client`SELECT 1`;
    const responseTime = Date.now() - start;

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      service: 'auth',
      environment: process.env.NODE_ENV || 'development',
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
      },
      database: {
        status: 'healthy',
        responseTime,
      },
    });
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      service: 'auth',
      environment: process.env.NODE_ENV || 'development',
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
      },
      database: {
        status: 'unhealthy',
        responseTime: 0,
      },
    });
  }
});

/**
 * GET /health/ready
 * Readiness probe for Kubernetes
 */
router.get('/ready', async (_req, res) => {
  try {
    await client`SELECT 1`;
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
      checks: { database: 'ok' },
    });
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed',
    });
  }
});

/**
 * GET /health/live
 * Liveness probe for Kubernetes
 */
router.get('/live', (_req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    pid: process.pid,
  });
});

/**
 * GET /health/detailed
 * Full health metrics
 */
router.get('/detailed', async (_req, res) => {
  const memoryUsage = process.memoryUsage();
  let dbStatus = 'healthy';
  let dbResponseTime = 0;

  try {
    const start = Date.now();
    await client`SELECT 1`;
    dbResponseTime = Date.now() - start;
  } catch {
    dbStatus = 'unhealthy';
  }

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({
    status: dbStatus === 'healthy' ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    memory: {
      rss: memoryUsage.rss,
      heapTotal: memoryUsage.heapTotal,
      heapUsed: memoryUsage.heapUsed,
      external: memoryUsage.external,
    },
    checks: {
      server: { status: 'healthy', message: 'Server is running' },
      database: { status: dbStatus, responseTime: dbResponseTime },
    },
  });
});

export default router;
