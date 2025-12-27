// Central exports for error handling and logging system
export { CentralizedErrorHandler, errorHandler } from './ErrorHandler';
export { RequestLogger } from './Logger';
export { HealthMonitor, healthMonitor } from './HealthMonitor';
export { NotificationService, notificationService } from './NotificationService';
// Import instances for internal use
import { RequestLogger as RequestLoggerClass } from './Logger';
import { healthMonitor } from './HealthMonitor';
// Convenience function to initialize the entire error handling system
export async function initializeErrorHandling(config) {
    const { logLevel = 'info', enableFileLogging = false, enableRemoteLogging = false, enableHealthMonitoring = true, enableNotifications = true } = config || {};
    // Initialize logger with configuration
    const logger = RequestLoggerClass.getInstance({
        level: logLevel,
        enableFile: enableFileLogging,
        enableRemote: enableRemoteLogging
    });
    await logger.logInfo('Initializing error handling system', {
        logLevel,
        enableFileLogging,
        enableRemoteLogging,
        enableHealthMonitoring,
        enableNotifications
    });
    // Start health monitoring if enabled
    if (enableHealthMonitoring) {
        await healthMonitor.startMonitoring();
        await logger.logInfo('Health monitoring started');
    }
    // Initialize notification service if enabled
    if (enableNotifications) {
        // Notification service is initialized automatically
        await logger.logInfo('Notification service initialized');
    }
    await logger.logInfo('Error handling system initialized successfully');
}
// Convenience function for graceful shutdown
export async function shutdownErrorHandling() {
    const logger = RequestLoggerClass.getInstance();
    await logger.logInfo('Shutting down error handling system');
    // Stop health monitoring
    await healthMonitor.stopMonitoring();
    await logger.logInfo('Error handling system shutdown complete');
}
