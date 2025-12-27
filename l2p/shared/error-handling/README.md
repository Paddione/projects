# Comprehensive Error Handling and Logging System

This directory contains a centralized error handling and logging system that provides structured error handling, recovery mechanisms, health monitoring, and notification capabilities.

## Features

### 🚨 Centralized Error Handler
- **Structured Error Handling**: Consistent error format with context, severity, and categorization
- **Error Recovery**: Automatic recovery strategies for common failure scenarios
- **Error Queuing**: Background processing of errors with retry logic
- **Context Enrichment**: Automatic addition of request context, user information, and metadata

### 📝 Advanced Logging
- **Multiple Log Levels**: Debug, Info, Warn, Error, Critical
- **Multiple Outputs**: Console, File, Remote endpoint
- **Log Rotation**: Automatic file rotation based on size and count
- **Structured Logging**: JSON format with consistent fields
- **Performance Monitoring**: Request timing and slow query detection

### 🏥 Health Monitoring
- **System Health Checks**: Memory, CPU, disk, database, and custom checks
- **Real-time Metrics**: System resource monitoring and alerting
- **Health Endpoints**: REST endpoints for health status and readiness probes
- **Alert Rules**: Configurable alerting based on system conditions

### 📢 Notification System
- **Multiple Channels**: Email, Slack, SMS, Webhooks
- **Severity-based Routing**: Different notification channels based on error severity
- **Template System**: Customizable notification templates
- **Queue Processing**: Background notification delivery with retry logic

## Quick Start

### 1. Initialize the System

```typescript
import { initializeErrorHandling } from './shared/error-handling';

await initializeErrorHandling({
  logLevel: 'info',
  enableFileLogging: true,
  enableRemoteLogging: false,
  enableHealthMonitoring: true,
  enableNotifications: true
});
```

### 2. Handle Errors

```typescript
import { errorHandler } from './shared/error-handling';

try {
  // Your code here
} catch (error) {
  await errorHandler.handleError(error, {
    userId: req.user?.id,
    ip: req.ip,
    url: req.url,
    method: req.method
  });
}
```

### 3. Check System Health

```typescript
import { healthMonitor } from './shared/error-handling';

const health = await healthMonitor.getSystemHealth();
console.log(`System status: ${health.status}`);
```

### 4. Send Notifications

```typescript
import { notificationService } from './shared/error-handling';

await notificationService.sendAlertNotification(
  'High CPU Usage',
  'CPU usage has exceeded 90% for 5 minutes',
  'high'
);
```

## Configuration

### Environment Variables

```bash
# Logging
LOG_LEVEL=info                    # debug, info, warn, error, critical
ENABLE_FILE_LOGGING=true
ENABLE_REMOTE_LOGGING=false
LOG_FILE_PATH=./logs/app.log
LOG_MAX_FILE_SIZE=10485760       # 10MB
LOG_MAX_FILES=5
LOG_REMOTE_ENDPOINT=https://logs.example.com/api/logs
LOG_API_KEY=your-api-key

# Service Information
SERVICE_NAME=your-service
APP_VERSION=1.0.0

# Notifications
ENABLE_NOTIFICATIONS=true

# Email Notifications
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email@example.com
SMTP_PASSWORD=your-password
ALERT_EMAIL=alerts@example.com

# Slack Notifications
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
SLACK_CHANNEL=#alerts

# SMS Notifications
SMS_API_KEY=your-sms-api-key
ALERT_PHONE_NUMBER=+1234567890
```

## Architecture

### Error Flow
1. **Error Occurs** → Application code catches error
2. **Error Normalization** → Convert to standardized ErrorDetails format
3. **Context Enrichment** → Add request context, user info, metadata
4. **Logging** → Log error with appropriate level and formatting
5. **Recovery Attempt** → Try registered recovery strategies if applicable
6. **Notification** → Send alerts based on severity and configuration

### Health Monitoring Flow
1. **Health Checks** → Run registered health checks on intervals
2. **Metrics Collection** → Gather system metrics (CPU, memory, disk)
3. **Status Evaluation** → Determine overall system health
4. **Alert Evaluation** → Check alert rules against current health
5. **Notification** → Send alerts if conditions are met

## Custom Health Checks

```typescript
import { healthMonitor } from './shared/error-handling';

healthMonitor.registerHealthCheck({
  name: 'custom-service',
  description: 'Check custom service availability',
  critical: true,
  timeout: 5000,
  interval: 60000,
  check: async () => {
    // Your health check logic
    return {
      status: 'healthy',
      message: 'Service is responding',
      responseTime: 0,
      timestamp: new Date().toISOString()
    };
  }
});
```

## Custom Recovery Strategies

```typescript
import { errorHandler } from './shared/error-handling';

errorHandler.registerRecoveryStrategy('CUSTOM_ERROR', {
  name: 'Custom Recovery',
  maxRetries: 3,
  backoffMs: 1000,
  execute: async (error) => {
    // Your recovery logic
    console.log(`Attempting recovery for: ${error.code}`);
    return true; // Return true if recovery successful
  }
});
```

## Custom Alert Rules

```typescript
import { healthMonitor } from './shared/error-handling';

healthMonitor.registerAlertRule({
  name: 'custom-alert',
  condition: (health) => {
    // Your alert condition
    return health.metrics.memory.percentage > 85;
  },
  severity: 'high',
  cooldown: 15, // minutes
  channels: ['email', 'slack']
});
```

## API Endpoints

### Health Check Endpoints

- `GET /health` - Basic health status
- `GET /health/detailed` - Detailed health information with all checks
- `GET /health/ready` - Kubernetes readiness probe
- `GET /health/live` - Kubernetes liveness probe

### Example Response

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "uptime": 3600000,
  "version": "1.0.0",
  "environment": "production",
  "checks": {
    "database": {
      "status": "healthy",
      "message": "Database connection healthy: 45ms",
      "responseTime": 45,
      "timestamp": "2024-01-15T10:30:00.000Z"
    },
    "memory": {
      "status": "healthy",
      "message": "Memory usage normal: 65.2%",
      "responseTime": 2,
      "timestamp": "2024-01-15T10:30:00.000Z"
    }
  },
  "metrics": {
    "memory": {
      "used": 1073741824,
      "total": 1647086592,
      "percentage": 65.2
    },
    "cpu": {
      "usage": 25.5,
      "loadAverage": [1.2, 1.1, 1.0]
    }
  }
}
```

## Testing

Run the test suite to verify the error handling system:

```bash
# Run all tests
node shared/error-handling/test-error-handling.js both

# Run only system tests
node shared/error-handling/test-error-handling.js test

# Run only pattern demonstrations
node shared/error-handling/test-error-handling.js demo
```

## Integration Examples

### Express.js Middleware

```typescript
import { errorHandler } from './shared/error-handling';

app.use(async (err, req, res, next) => {
  await errorHandler.handleError(err, {
    userId: req.user?.id,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    url: req.url,
    method: req.method
  });
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' 
      ? 'An error occurred' 
      : err.message
  });
});
```

### React Error Boundary

```typescript
import { errorHandler } from './shared/error-handling';

class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    errorHandler.handleError(error, {
      service: 'frontend',
      metadata: {
        componentStack: errorInfo.componentStack,
        errorBoundary: true
      }
    });
  }
}
```

## Best Practices

1. **Always provide context** when handling errors
2. **Use appropriate severity levels** for different error types
3. **Register custom health checks** for critical services
4. **Set up proper notification channels** for your team
5. **Monitor error patterns** and adjust recovery strategies
6. **Test error scenarios** regularly to ensure system reliability
7. **Keep error messages user-friendly** while logging technical details
8. **Use structured logging** for better searchability and analysis

## Troubleshooting

### Common Issues

1. **Logs not appearing**: Check LOG_LEVEL and ensure it's set appropriately
2. **Notifications not sending**: Verify notification channel configuration
3. **Health checks failing**: Check timeout values and service availability
4. **High memory usage**: Monitor log buffer size and flush intervals

### Debug Mode

Enable debug logging to see detailed system operation:

```bash
LOG_LEVEL=debug node your-app.js
```

## Contributing

When adding new features to the error handling system:

1. Follow the existing patterns for error categorization
2. Add appropriate tests for new functionality
3. Update documentation and examples
4. Consider backward compatibility
5. Test with different error scenarios

## License

This error handling system is part of the trivia application and follows the same license terms.