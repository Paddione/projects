import { RequestLogger } from './Logger.js';
import { errorHandler } from './ErrorHandler.js';

export interface HealthCheck {
  name: string;
  description: string;
  check: () => Promise<HealthCheckResult>;
  critical: boolean;
  timeout: number;
  interval: number;
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  message: string;
  responseTime: number;
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  checks: Record<string, HealthCheckResult>;
  metrics: SystemMetrics;
}

export interface SystemMetrics {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  disk: {
    used: number;
    total: number;
    percentage: number;
  };
  network: {
    connections: number;
    bytesIn: number;
    bytesOut: number;
  };
}

export interface AlertRule {
  name: string;
  condition: (health: SystemHealth) => boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  cooldown: number; // Minutes between alerts
  channels: string[]; // Alert channels (email, slack, etc.)
}

export class HealthMonitor {
  private static instance: HealthMonitor;
  private healthChecks: Map<string, HealthCheck> = new Map();
  private alertRules: AlertRule[] = [];
  private lastAlerts: Map<string, number> = new Map();
  private logger: RequestLogger;
  private isMonitoring = false;
  private startTime = Date.now();

  private constructor() {
    this.logger = RequestLogger.getInstance();
    this.initializeDefaultHealthChecks();
    this.initializeDefaultAlertRules();
  }

  static getInstance(): HealthMonitor {
    if (!HealthMonitor.instance) {
      HealthMonitor.instance = new HealthMonitor();
    }
    return HealthMonitor.instance;
  }

  /**
   * Start health monitoring
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      await this.logger.logWarn('Health monitoring already started');
      return;
    }

    this.isMonitoring = true;
    await this.logger.logInfo('Starting health monitoring');

    // Start periodic health checks
    this.healthChecks.forEach((healthCheck, name) => {
      setInterval(async () => {
        try {
          await this.runHealthCheck(name);
        } catch (error) {
          await errorHandler.handleError(error as Error, {
            service: 'health-monitor',
            metadata: { healthCheckName: name }
          });
        }
      }, healthCheck.interval);
    });

    // Start periodic system metrics collection
    setInterval(async () => {
      try {
        await this.collectSystemMetrics();
      } catch (error) {
        await errorHandler.handleError(error as Error, {
          service: 'health-monitor',
          metadata: { task: 'metrics-collection' }
        });
      }
    }, 60000); // Every minute

    // Start periodic alert checking
    setInterval(async () => {
      try {
        await this.checkAlerts();
      } catch (error) {
        await errorHandler.handleError(error as Error, {
          service: 'health-monitor',
          metadata: { task: 'alert-checking' }
        });
      }
    }, 30000); // Every 30 seconds
  }

  /**
   * Stop health monitoring
   */
  async stopMonitoring(): Promise<void> {
    this.isMonitoring = false;
    await this.logger.logInfo('Stopped health monitoring');
  }

  /**
   * Register a custom health check
   */
  registerHealthCheck(healthCheck: HealthCheck): void {
    this.healthChecks.set(healthCheck.name, healthCheck);
    this.logger.logInfo('Registered health check', { name: healthCheck.name });
  }

  /**
   * Register an alert rule
   */
  registerAlertRule(rule: AlertRule): void {
    this.alertRules.push(rule);
    this.logger.logInfo('Registered alert rule', { name: rule.name });
  }

  /**
   * Get current system health
   */
  async getSystemHealth(): Promise<SystemHealth> {
    const checks: Record<string, HealthCheckResult> = {};
    let overallStatus: SystemHealth['status'] = 'healthy';

    // Run all health checks
    for (const [name, healthCheck] of this.healthChecks) {
      try {
        const result = await this.runHealthCheck(name);
        checks[name] = result;

        // Determine overall status
        if (result.status === 'unhealthy' && healthCheck.critical) {
          overallStatus = 'unhealthy';
        } else if (result.status === 'degraded' && overallStatus === 'healthy') {
          overallStatus = 'degraded';
        }
      } catch (error) {
        checks[name] = {
          status: 'unhealthy',
          message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          responseTime: 0,
          timestamp: new Date().toISOString()
        };
        
        if (healthCheck.critical) {
          overallStatus = 'unhealthy';
        }
      }
    }

    const metrics = await this.collectSystemMetrics();

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: Date.now() - this.startTime,
      version: process.env.APP_VERSION || '1.0.0',
      environment: process.env['NODE_ENV'] || 'development',
      checks,
      metrics
    };
  }

  /**
   * Run a specific health check
   */
  private async runHealthCheck(name: string): Promise<HealthCheckResult> {
    const healthCheck = this.healthChecks.get(name);
    if (!healthCheck) {
      throw new Error(`Health check not found: ${name}`);
    }

    const startTime = Date.now();
    
    try {
      // Run health check with timeout
      const result = await Promise.race([
        healthCheck.check(),
        new Promise<HealthCheckResult>((_, reject) => 
          setTimeout(() => reject(new Error('Health check timeout')), healthCheck.timeout)
        )
      ]);

      result.responseTime = Date.now() - startTime;
      result.timestamp = new Date().toISOString();

      await this.logger.logDebug('Health check completed', {
        name,
        status: result.status,
        responseTime: result.responseTime
      });

      return result;
    } catch (error) {
      const result: HealthCheckResult = {
        status: 'unhealthy',
        message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };

      await this.logger.logError({
        code: 'HEALTH_CHECK_FAILED',
        message: `Health check ${name} failed: ${result.message}`,
        context: {
          timestamp: new Date().toISOString(),
          environment: process.env['NODE_ENV'] || 'development',
          service: 'health-monitor'
        },
        severity: healthCheck.critical ? 'high' : 'medium',
        category: 'system',
        recoverable: true,
        retryable: true
      });

      return result;
    }
  }

  /**
   * Collect system metrics
   */
  private async collectSystemMetrics(): Promise<SystemMetrics> {
    const os = await import('os');
    const fs = await import('fs/promises');

    // Memory metrics
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;

    // CPU metrics
    const cpus = os.cpus();
    const loadAverage = os.loadavg();

    // Disk metrics (simplified - would need more sophisticated implementation)
    let diskUsed = 0;
    let diskTotal = 0;
    try {
      const stats = await fs.stat('.');
      // This is a simplified implementation
      diskTotal = 1000000000; // 1GB placeholder
      diskUsed = 500000000;   // 500MB placeholder
    } catch (error) {
      // Ignore disk stat errors
    }

    const metrics: SystemMetrics = {
      memory: {
        used: usedMemory,
        total: totalMemory,
        percentage: (usedMemory / totalMemory) * 100
      },
      cpu: {
        usage: this.calculateCpuUsage(cpus),
        loadAverage
      },
      disk: {
        used: diskUsed,
        total: diskTotal,
        percentage: diskTotal > 0 ? (diskUsed / diskTotal) * 100 : 0
      },
      network: {
        connections: 0, // Would need to implement network monitoring
        bytesIn: 0,
        bytesOut: 0
      }
    };

    await this.logger.logDebug('System metrics collected', { metrics });
    return metrics;
  }

  /**
   * Calculate CPU usage percentage
   */
  private calculateCpuUsage(cpus: any[]): number {
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usage = 100 - ~~(100 * idle / total);

    return usage;
  }

  /**
   * Check alert rules and trigger alerts
   */
  private async checkAlerts(): Promise<void> {
    const health = await this.getSystemHealth();

    for (const rule of this.alertRules) {
      try {
        if (rule.condition(health)) {
          const lastAlert = this.lastAlerts.get(rule.name) || 0;
          const cooldownMs = rule.cooldown * 60 * 1000;
          
          if (Date.now() - lastAlert > cooldownMs) {
            await this.triggerAlert(rule, health);
            this.lastAlerts.set(rule.name, Date.now());
          }
        }
      } catch (error) {
        await errorHandler.handleError(error as Error, {
          service: 'health-monitor',
          metadata: { alertRule: rule.name }
        });
      }
    }
  }

  /**
   * Trigger an alert
   */
  private async triggerAlert(rule: AlertRule, health: SystemHealth): Promise<void> {
    await this.logger.logWarn('Alert triggered', {
      rule: rule.name,
      severity: rule.severity,
      systemStatus: health.status
    });

    // Here you would implement actual alert delivery
    // For now, just log the alert
    await this.logger.logInfo('Alert would be sent', {
      rule: rule.name,
      channels: rule.channels,
      health: {
        status: health.status,
        timestamp: health.timestamp
      }
    });
  }

  /**
   * Initialize default health checks
   */
  private initializeDefaultHealthChecks(): void {
    // Memory usage check
    this.registerHealthCheck({
      name: 'memory',
      description: 'Check system memory usage',
      critical: false,
      timeout: 5000,
      interval: 60000,
      check: async () => {
        const os = await import('os');
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedPercentage = ((totalMemory - freeMemory) / totalMemory) * 100;

        if (usedPercentage > 90) {
          return {
            status: 'unhealthy',
            message: `Memory usage critical: ${usedPercentage.toFixed(1)}%`,
            responseTime: 0,
            timestamp: '',
            metadata: { usedPercentage }
          };
        } else if (usedPercentage > 80) {
          return {
            status: 'degraded',
            message: `Memory usage high: ${usedPercentage.toFixed(1)}%`,
            responseTime: 0,
            timestamp: '',
            metadata: { usedPercentage }
          };
        }

        return {
          status: 'healthy',
          message: `Memory usage normal: ${usedPercentage.toFixed(1)}%`,
          responseTime: 0,
          timestamp: '',
          metadata: { usedPercentage }
        };
      }
    });

    // Disk space check
    this.registerHealthCheck({
      name: 'disk',
      description: 'Check disk space usage',
      critical: true,
      timeout: 5000,
      interval: 300000, // 5 minutes
      check: async () => {
        // Simplified disk check - would need proper implementation
        const diskUsage = 45; // Placeholder percentage

        if (diskUsage > 95) {
          return {
            status: 'unhealthy',
            message: `Disk space critical: ${diskUsage}%`,
            responseTime: 0,
            timestamp: '',
            metadata: { diskUsage }
          };
        } else if (diskUsage > 85) {
          return {
            status: 'degraded',
            message: `Disk space high: ${diskUsage}%`,
            responseTime: 0,
            timestamp: '',
            metadata: { diskUsage }
          };
        }

        return {
          status: 'healthy',
          message: `Disk space normal: ${diskUsage}%`,
          responseTime: 0,
          timestamp: '',
          metadata: { diskUsage }
        };
      }
    });
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultAlertRules(): void {
    // System unhealthy alert
    this.registerAlertRule({
      name: 'system-unhealthy',
      condition: (health) => health.status === 'unhealthy',
      severity: 'critical',
      cooldown: 5, // 5 minutes
      channels: ['email', 'slack']
    });

    // High memory usage alert
    this.registerAlertRule({
      name: 'high-memory-usage',
      condition: (health) => health.metrics.memory.percentage > 85,
      severity: 'high',
      cooldown: 15, // 15 minutes
      channels: ['slack']
    });

    // High error rate alert
    this.registerAlertRule({
      name: 'high-error-rate',
      condition: (health) => {
        // This would check error rate from logs
        // Placeholder implementation
        return false;
      },
      severity: 'high',
      cooldown: 10, // 10 minutes
      channels: ['email', 'slack']
    });
  }
}

// Export singleton instance
export const healthMonitor = HealthMonitor.getInstance();
