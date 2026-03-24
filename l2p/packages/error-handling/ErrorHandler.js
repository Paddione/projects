import { RequestLogger } from './Logger';
export class CentralizedErrorHandler {
    constructor() {
        this.recoveryStrategies = new Map();
        this.errorQueue = [];
        this.isProcessingQueue = false;
        this.logger = RequestLogger.getInstance();
        this.initializeDefaultRecoveryStrategies();
        this.startErrorQueueProcessor();
    }
    static getInstance() {
        if (!CentralizedErrorHandler.instance) {
            CentralizedErrorHandler.instance = new CentralizedErrorHandler();
        }
        return CentralizedErrorHandler.instance;
    }
    /**
     * Handle error with context and recovery attempts
     */
    async handleError(error, context) {
        const errorDetails = this.normalizeError(error, context);
        // Log the error immediately
        await this.logger.logError(errorDetails);
        // Add to processing queue for recovery attempts
        this.errorQueue.push(errorDetails);
        // For critical errors, attempt immediate recovery
        if (errorDetails.severity === 'critical') {
            await this.attemptRecovery(errorDetails);
        }
    }
    /**
     * Register a custom recovery strategy
     */
    registerRecoveryStrategy(errorCode, strategy) {
        this.recoveryStrategies.set(errorCode, strategy);
    }
    /**
     * Normalize error into standardized format
     */
    normalizeError(error, context) {
        if ('code' in error && 'severity' in error) {
            // Already normalized
            return error;
        }
        const baseError = error;
        const errorContext = {
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development',
            service: process.env.SERVICE_NAME || 'unknown',
            version: process.env.APP_VERSION || '1.0.0',
            ...context
        };
        return {
            code: this.categorizeError(baseError),
            message: baseError.message,
            stack: baseError.stack,
            context: errorContext,
            severity: this.determineSeverity(baseError),
            category: this.determineCategory(baseError),
            recoverable: this.isRecoverable(baseError),
            retryable: this.isRetryable(baseError)
        };
    }
    /**
     * Categorize error based on message and type
     */
    categorizeError(error) {
        const message = error.message.toLowerCase();
        const name = error.name.toLowerCase();
        if (name.includes('validation') || message.includes('validation'))
            return 'VALIDATION_ERROR';
        if (name.includes('auth') || message.includes('auth') || message.includes('token'))
            return 'AUTH_ERROR';
        if (message.includes('database') || message.includes('connection') || message.includes('query'))
            return 'DATABASE_ERROR';
        if (message.includes('network') || message.includes('timeout') || message.includes('fetch'))
            return 'NETWORK_ERROR';
        if (message.includes('permission') || message.includes('forbidden') || message.includes('access'))
            return 'PERMISSION_ERROR';
        if (message.includes('not found') || message.includes('404'))
            return 'NOT_FOUND_ERROR';
        if (message.includes('rate limit') || message.includes('too many'))
            return 'RATE_LIMIT_ERROR';
        return 'UNKNOWN_ERROR';
    }
    /**
     * Determine error severity
     */
    determineSeverity(error) {
        const message = error.message.toLowerCase();
        if (message.includes('critical') || message.includes('fatal') || message.includes('crash'))
            return 'critical';
        if (message.includes('database') || message.includes('auth') || message.includes('security'))
            return 'high';
        if (message.includes('validation') || message.includes('not found'))
            return 'medium';
        return 'low';
    }
    /**
     * Determine error category
     */
    determineCategory(error) {
        const message = error.message.toLowerCase();
        const name = error.name.toLowerCase();
        if (name.includes('validation') || message.includes('validation'))
            return 'validation';
        if (name.includes('auth') || message.includes('auth'))
            return 'authentication';
        if (message.includes('permission') || message.includes('forbidden'))
            return 'authorization';
        if (message.includes('database') || message.includes('query'))
            return 'database';
        if (message.includes('network') || message.includes('fetch'))
            return 'network';
        if (message.includes('system') || message.includes('memory'))
            return 'system';
        return 'unknown';
    }
    /**
     * Check if error is recoverable
     */
    isRecoverable(error) {
        const message = error.message.toLowerCase();
        // Non-recoverable errors
        if (message.includes('syntax') || message.includes('reference') || message.includes('type'))
            return false;
        if (message.includes('permission') || message.includes('forbidden'))
            return false;
        // Recoverable errors
        if (message.includes('network') || message.includes('timeout'))
            return true;
        if (message.includes('database') || message.includes('connection'))
            return true;
        if (message.includes('rate limit'))
            return true;
        return false;
    }
    /**
     * Check if error is retryable
     */
    isRetryable(error) {
        const message = error.message.toLowerCase();
        // Retryable errors
        if (message.includes('timeout') || message.includes('network'))
            return true;
        if (message.includes('rate limit'))
            return true;
        if (message.includes('temporary') || message.includes('unavailable'))
            return true;
        return false;
    }
    /**
     * Initialize default recovery strategies
     */
    initializeDefaultRecoveryStrategies() {
        // Database connection recovery
        this.registerRecoveryStrategy('DATABASE_ERROR', {
            name: 'Database Reconnection',
            maxRetries: 3,
            backoffMs: 1000,
            execute: async (error) => {
                try {
                    // Attempt database reconnection
                    await this.logger.logInfo('Attempting database reconnection', {
                        errorCode: error.code,
                        attempt: 'recovery'
                    });
                    // This would trigger database reconnection logic
                    // Implementation depends on your database setup
                    return true;
                }
                catch (recoveryError) {
                    await this.logger.logError({
                        ...error,
                        message: `Recovery failed: ${recoveryError instanceof Error ? recoveryError.message : 'Unknown error'}`
                    });
                    return false;
                }
            }
        });
        // Network retry strategy
        this.registerRecoveryStrategy('NETWORK_ERROR', {
            name: 'Network Retry',
            maxRetries: 5,
            backoffMs: 2000,
            execute: async (error) => {
                try {
                    await this.logger.logInfo('Attempting network retry', {
                        errorCode: error.code,
                        url: error.context.url
                    });
                    // This would retry the failed network request
                    // Implementation depends on your HTTP client
                    return true;
                }
                catch (recoveryError) {
                    return false;
                }
            }
        });
        // Rate limit backoff strategy
        this.registerRecoveryStrategy('RATE_LIMIT_ERROR', {
            name: 'Rate Limit Backoff',
            maxRetries: 3,
            backoffMs: 5000,
            execute: async (error) => {
                await this.logger.logInfo('Applying rate limit backoff', {
                    errorCode: error.code,
                    backoffMs: 5000
                });
                // Wait for rate limit to reset
                await new Promise(resolve => setTimeout(resolve, 5000));
                return true;
            }
        });
    }
    /**
     * Attempt error recovery
     */
    async attemptRecovery(errorDetails) {
        if (!errorDetails.recoverable) {
            await this.logger.logInfo('Error not recoverable, skipping recovery', {
                errorCode: errorDetails.code
            });
            return false;
        }
        const strategy = this.recoveryStrategies.get(errorDetails.code);
        if (!strategy) {
            await this.logger.logInfo('No recovery strategy found', {
                errorCode: errorDetails.code
            });
            return false;
        }
        let attempt = 0;
        while (attempt < strategy.maxRetries) {
            try {
                await this.logger.logInfo('Attempting error recovery', {
                    errorCode: errorDetails.code,
                    strategy: strategy.name,
                    attempt: attempt + 1,
                    maxRetries: strategy.maxRetries
                });
                const success = await strategy.execute(errorDetails);
                if (success) {
                    await this.logger.logInfo('Error recovery successful', {
                        errorCode: errorDetails.code,
                        strategy: strategy.name,
                        attempt: attempt + 1
                    });
                    return true;
                }
            }
            catch (recoveryError) {
                await this.logger.logError({
                    code: 'RECOVERY_FAILED',
                    message: `Recovery strategy failed: ${recoveryError instanceof Error ? recoveryError.message : 'Unknown error'}`,
                    context: errorDetails.context,
                    severity: 'medium',
                    category: 'system',
                    recoverable: false,
                    retryable: false
                });
            }
            attempt++;
            if (attempt < strategy.maxRetries) {
                const backoffTime = strategy.backoffMs * Math.pow(2, attempt - 1); // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, backoffTime));
            }
        }
        await this.logger.logError({
            code: 'RECOVERY_EXHAUSTED',
            message: `All recovery attempts exhausted for error: ${errorDetails.code}`,
            context: errorDetails.context,
            severity: 'high',
            category: 'system',
            recoverable: false,
            retryable: false
        });
        return false;
    }
    /**
     * Start background error queue processor
     */
    startErrorQueueProcessor() {
        setInterval(async () => {
            if (this.isProcessingQueue || this.errorQueue.length === 0) {
                return;
            }
            this.isProcessingQueue = true;
            try {
                const errorsToProcess = this.errorQueue.splice(0, 10); // Process up to 10 errors at a time
                for (const error of errorsToProcess) {
                    if (error.recoverable && error.severity !== 'critical') {
                        await this.attemptRecovery(error);
                    }
                }
            }
            catch (processingError) {
                await this.logger.logError({
                    code: 'QUEUE_PROCESSING_ERROR',
                    message: `Error queue processing failed: ${processingError instanceof Error ? processingError.message : 'Unknown error'}`,
                    context: {
                        timestamp: new Date().toISOString(),
                        environment: process.env.NODE_ENV || 'development',
                        service: 'error-handler',
                        queueLength: this.errorQueue.length
                    },
                    severity: 'medium',
                    category: 'system',
                    recoverable: false,
                    retryable: false
                });
            }
            finally {
                this.isProcessingQueue = false;
            }
        }, 30000); // Process every 30 seconds
    }
    /**
     * Get error statistics
     */
    async getErrorStatistics(timeRange = 'hour') {
        // This would query your logging storage for statistics
        // Implementation depends on your logging backend
        return {
            totalErrors: 0,
            errorsByCategory: {},
            errorsBySeverity: {},
            recoverySuccessRate: 0
        };
    }
}
// Export singleton instance
export const errorHandler = CentralizedErrorHandler.getInstance();
