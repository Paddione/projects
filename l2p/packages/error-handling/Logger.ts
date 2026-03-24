import { ErrorDetails } from './ErrorHandler.js';

export interface LogEntry {
  level: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  message: string;
  timestamp: string;
  service: string;
  environment: string;
  context?: Record<string, any>;
  metadata?: Record<string, any>;
  traceId?: string;
  userId?: number;
  sessionId?: string;
}

export interface LoggerConfig {
  level: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  service: string;
  environment: string;
  enableConsole: boolean;
  enableFile: boolean;
  enableRemote: boolean;
  filePath?: string;
  remoteEndpoint?: string;
  maxFileSize?: number;
  maxFiles?: number;
}

export class RequestLogger {
  private static instance: RequestLogger;
  private config: LoggerConfig;
  private logBuffer: LogEntry[] = [];
  private isFlushingBuffer = false;
  private flushTimer?: NodeJS.Timeout;

  private constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      level: (process.env.LOG_LEVEL as LoggerConfig['level']) || 'info',
      service: process.env.SERVICE_NAME || 'unknown',
      environment: process.env['NODE_ENV'] || 'development',
      enableConsole: true,
      enableFile: process.env.ENABLE_FILE_LOGGING === 'true',
      enableRemote: process.env.ENABLE_REMOTE_LOGGING === 'true',
      filePath: process.env.LOG_FILE_PATH || './logs/app.log',
      remoteEndpoint: process.env.LOG_REMOTE_ENDPOINT,
      maxFileSize: parseInt(process.env.LOG_MAX_FILE_SIZE || '10485760'), // 10MB
      maxFiles: parseInt(process.env.LOG_MAX_FILES || '5'),
      ...config
    };

    // Avoid background timers when running under Jest to prevent
    // "Cannot log after tests are done" warnings
    if (!process.env.JEST_WORKER_ID) {
      this.startBufferFlush();
    }
  }

  static getInstance(config?: Partial<LoggerConfig>): RequestLogger {
    if (!RequestLogger.instance) {
      RequestLogger.instance = new RequestLogger(config);
    }
    return RequestLogger.instance;
  }

  /**
   * Log debug message
   */
  async logDebug(message: string, context?: Record<string, any>, metadata?: Record<string, any>): Promise<void> {
    await this.log('debug', message, context, metadata);
  }

  /**
   * Log info message
   */
  async logInfo(message: string, context?: Record<string, any>, metadata?: Record<string, any>): Promise<void> {
    await this.log('info', message, context, metadata);
  }

  /**
   * Log warning message
   */
  async logWarn(message: string, context?: Record<string, any>, metadata?: Record<string, any>): Promise<void> {
    await this.log('warn', message, context, metadata);
  }

  /**
   * Log error from ErrorDetails
   */
  async logError(error: ErrorDetails): Promise<void> {
    await this.log('error', error.message, {
      code: error.code,
      category: error.category,
      severity: error.severity,
      recoverable: error.recoverable,
      retryable: error.retryable,
      stack: error.stack,
      ...error.context
    }, error.metadata);
  }

  /**
   * Log critical message
   */
  async logCritical(message: string, context?: Record<string, any>, metadata?: Record<string, any>): Promise<void> {
    await this.log('critical', message, context, metadata);
  }

  /**
   * Core logging method
   */
  private async log(
    level: LogEntry['level'], 
    message: string, 
    context?: Record<string, any>, 
    metadata?: Record<string, any>
  ): Promise<void> {
    // Check if log level is enabled
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      service: this.config.service,
      environment: this.config.environment,
      context,
      metadata,
      traceId: this.generateTraceId(),
      userId: context?.userId,
      sessionId: context?.sessionId
    };

    // Add to buffer for batch processing
    this.logBuffer.push(logEntry);

    // For critical errors, flush immediately
    if (level === 'critical' || level === 'error') {
      await this.flushBuffer();
    }
  }

  /**
   * Check if log level should be logged
   */
  private shouldLog(level: LogEntry['level']): boolean {
    const levels = ['debug', 'info', 'warn', 'error', 'critical'];
    const configLevelIndex = levels.indexOf(this.config.level);
    const logLevelIndex = levels.indexOf(level);
    
    return logLevelIndex >= configLevelIndex;
  }

  /**
   * Generate trace ID for request correlation
   */
  private generateTraceId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  /**
   * Start buffer flush interval
   */
  private startBufferFlush(): void {
    this.flushTimer = setInterval(async () => {
      if (this.logBuffer.length > 0) {
        await this.flushBuffer();
      }
    }, 5000); // Flush every 5 seconds
  }

  /**
   * Flush log buffer to all configured outputs
   */
  private async flushBuffer(): Promise<void> {
    if (this.isFlushingBuffer || this.logBuffer.length === 0) {
      return;
    }

    this.isFlushingBuffer = true;
    const logsToFlush = [...this.logBuffer];
    this.logBuffer = [];

    try {
      await Promise.all([
        this.config.enableConsole ? this.writeToConsole(logsToFlush) : Promise.resolve(),
        this.config.enableFile ? this.writeToFile(logsToFlush) : Promise.resolve(),
        this.config.enableRemote ? this.writeToRemote(logsToFlush) : Promise.resolve()
      ]);
    } catch (error) {
      // Fallback to console if other outputs fail
      console.error('Failed to flush logs:', error);
      logsToFlush.forEach(log => {
        console.log(JSON.stringify(log));
      });
    } finally {
      this.isFlushingBuffer = false;
    }
  }

  /**
   * Write logs to console with formatting
   */
  private async writeToConsole(logs: LogEntry[]): Promise<void> {
    logs.forEach(log => {
      const emoji = this.getLevelEmoji(log.level);
      const coloredLevel = this.getColoredLevel(log.level);
      const timestamp = new Date(log.timestamp).toLocaleTimeString();
      
      const baseMessage = `${emoji} [${timestamp}] ${coloredLevel} ${log.service}: ${log.message}`;
      
      if (log.context || log.metadata) {
        const details = {
          ...(log.context && { context: log.context }),
          ...(log.metadata && { metadata: log.metadata }),
          ...(log.traceId && { traceId: log.traceId })
        };
        
        console.log(baseMessage);
        console.log('  Details:', JSON.stringify(details, null, 2));
      } else {
        console.log(baseMessage);
      }
    });
  }

  /**
   * Write logs to file
   */
  private async writeToFile(logs: LogEntry[]): Promise<void> {
    if (!this.config.filePath) return;

    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      // Ensure log directory exists
      const logDir = path.dirname(this.config.filePath);
      await fs.mkdir(logDir, { recursive: true });

      // Check file size and rotate if necessary
      await this.rotateLogFileIfNeeded();

      // Append logs to file
      const logLines = logs.map(log => JSON.stringify(log)).join('\n') + '\n';
      await fs.appendFile(this.config.filePath, logLines);
    } catch (error) {
      console.error('Failed to write logs to file:', error);
    }
  }

  /**
   * Write logs to remote endpoint
   */
  private async writeToRemote(logs: LogEntry[]): Promise<void> {
    if (!this.config.remoteEndpoint) return;

    try {
      const response = await fetch(this.config.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.LOG_API_KEY || ''}`
        },
        body: JSON.stringify({ logs })
      });

      if (!response.ok) {
        throw new Error(`Remote logging failed: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Failed to send logs to remote endpoint:', error);
      // Don't throw - we don't want logging failures to break the application
    }
  }

  /**
   * Rotate log file if it exceeds max size
   */
  private async rotateLogFileIfNeeded(): Promise<void> {
    if (!this.config.filePath || !this.config.maxFileSize) return;

    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      const stats = await fs.stat(this.config.filePath).catch(() => null);
      if (!stats || stats.size < this.config.maxFileSize) return;

      // Rotate existing files
      const logDir = path.dirname(this.config.filePath);
      const logName = path.basename(this.config.filePath, path.extname(this.config.filePath));
      const logExt = path.extname(this.config.filePath);

      for (let i = (this.config.maxFiles || 5) - 1; i > 0; i--) {
        const oldFile = path.join(logDir, `${logName}.${i}${logExt}`);
        const newFile = path.join(logDir, `${logName}.${i + 1}${logExt}`);
        
        try {
          await fs.rename(oldFile, newFile);
        } catch (error) {
          // File might not exist, continue
        }
      }

      // Move current log to .1
      const rotatedFile = path.join(logDir, `${logName}.1${logExt}`);
      await fs.rename(this.config.filePath, rotatedFile);
    } catch (error) {
      console.error('Failed to rotate log file:', error);
    }
  }

  /**
   * Get emoji for log level
   */
  private getLevelEmoji(level: LogEntry['level']): string {
    const emojis = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌',
      critical: '🚨'
    };
    return emojis[level];
  }

  /**
   * Get colored level string (for console output)
   */
  private getColoredLevel(level: LogEntry['level']): string {
    // ANSI color codes
    const colors = {
      debug: '\x1b[36m', // Cyan
      info: '\x1b[32m',  // Green
      warn: '\x1b[33m',  // Yellow
      error: '\x1b[31m', // Red
      critical: '\x1b[35m' // Magenta
    };
    const reset = '\x1b[0m';
    
    return `${colors[level]}${level.toUpperCase()}${reset}`;
  }

  /**
   * Get recent logs for debugging
   */
  async getRecentLogs(count: number = 100, level?: LogEntry['level']): Promise<LogEntry[]> {
    // This would query your log storage
    // For now, return empty array as implementation depends on storage backend
    return [];
  }

  /**
   * Search logs by criteria
   */
  async searchLogs(criteria: {
    startTime?: string;
    endTime?: string;
    level?: LogEntry['level'];
    service?: string;
    userId?: number;
    traceId?: string;
    message?: string;
  }): Promise<LogEntry[]> {
    // This would query your log storage with search criteria
    // Implementation depends on your logging backend
    return [];
  }

  /**
   * Get log statistics
   */
  async getLogStatistics(timeRange: 'hour' | 'day' | 'week' = 'hour'): Promise<{
    totalLogs: number;
    logsByLevel: Record<string, number>;
    logsByService: Record<string, number>;
    errorRate: number;
  }> {
    // This would query your log storage for statistics
    // Implementation depends on your logging backend
    return {
      totalLogs: 0,
      logsByLevel: {},
      logsByService: {},
      errorRate: 0
    };
  }
}
