// Temporarily commented out to fix compilation issues
// import { healthMonitor } from '../../shared/error-handling/dist/index.js';
import { databaseHealthCheck } from './DatabaseHealthCheck.js';

/**
 * Initialize backend-specific health checks
 */
export async function initializeBackendHealthChecks(): Promise<void> {
  // Temporarily disabled health monitoring during development
  console.log('Health monitoring disabled during development');
  
  // TODO: Re-enable when shared module imports are fixed
  // Register database health check
  // healthMonitor.registerHealthCheck(databaseHealthCheck);

  // Register backend-specific alert rules
  // healthMonitor.registerAlertRule({
  //   name: 'database-connection-failed',
  //   condition: (health: Record<string, any>) => {
  //     const dbCheck = health.checks['database'];
  //     return Boolean(dbCheck && dbCheck.status === 'unhealthy');
  //   },
  //   severity: 'critical',
  //   cooldown: 5, // 5 minutes
  //   channels: ['email', 'slack']
  // });

  // healthMonitor.registerAlertRule({
  //   name: 'database-slow-response',
  //   condition: (health: Record<string, any>) => {
  //     const dbCheck = health.checks['database'];
  //     return Boolean(dbCheck && dbCheck.status === 'degraded' && dbCheck.responseTime && dbCheck.responseTime > 2000);
  //   },
  //   severity: 'high',
  //   cooldown: 15, // 15 minutes
  //   channels: ['slack']
  // });
}

export { databaseHealthCheck };

// Export health check handlers for server.ts
import { Request, Response } from 'express';

export const healthCheckHandler = async (req: Request, res: Response) => {
  try {
    const dbHealth = await databaseHealthCheck.check();
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      checks: {
        database: dbHealth
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

export const readinessHandler = async (req: Request, res: Response) => {
  try {
    const dbHealth = await databaseHealthCheck.check();
    if (dbHealth.status === 'healthy') {
      res.status(200).json({
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(503).json({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        reason: 'Database not available'
      });
    }
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};