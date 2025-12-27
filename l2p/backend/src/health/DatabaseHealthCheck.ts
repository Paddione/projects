import { db } from '../services/DatabaseService.js';

interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  message: string;
  responseTime: number;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface HealthCheck {
  name: string;
  description: string;
  critical: boolean;
  timeout: number;
  interval: number;
  check(): Promise<HealthCheckResult>;
}

export const databaseHealthCheck: HealthCheck = {
  name: 'database',
  description: 'Check database connection and query performance',
  critical: true,
  timeout: 5000,
  interval: 30000, // Check every 30 seconds
  check: async (): Promise<HealthCheckResult> => {
    const startTime = Date.now();
    
    try {
      // Test basic connection
      const isHealthy = db.isHealthy();
      if (!isHealthy) {
        return {
          status: 'unhealthy',
          message: 'Database connection is not healthy',
          responseTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          metadata: { connectionStatus: 'disconnected' }
        };
      }

      // Test with a simple query
      await db.testConnection();
      
      const responseTime = Date.now() - startTime;
      
      if (responseTime > 2000) {
        return {
          status: 'degraded',
          message: `Database responding slowly: ${responseTime}ms`,
          responseTime,
          timestamp: new Date().toISOString(),
          metadata: { connectionStatus: 'connected', slowQuery: true }
        };
      }

      return {
        status: 'healthy',
        message: `Database connection healthy: ${responseTime}ms`,
        responseTime,
        timestamp: new Date().toISOString(),
        metadata: { connectionStatus: 'connected' }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: `Database check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        metadata: { 
          connectionStatus: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      };
    }
  }
};