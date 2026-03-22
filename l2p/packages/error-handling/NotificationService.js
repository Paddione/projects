import { RequestLogger } from './Logger';
export class NotificationService {
    constructor() {
        this.channels = new Map();
        this.templates = new Map();
        this.notificationQueue = [];
        this.isProcessingQueue = false;
        this.logger = RequestLogger.getInstance();
        this.initializeDefaultChannels();
        this.initializeDefaultTemplates();
        this.startQueueProcessor();
    }
    static getInstance() {
        if (!NotificationService.instance) {
            NotificationService.instance = new NotificationService();
        }
        return NotificationService.instance;
    }
    /**
     * Register a notification channel
     */
    registerChannel(channel) {
        this.channels.set(channel.name, channel);
        this.logger.logInfo('Registered notification channel', {
            name: channel.name,
            type: channel.type
        });
    }
    /**
     * Register a notification template
     */
    registerTemplate(template) {
        this.templates.set(template.name, template);
        this.logger.logInfo('Registered notification template', {
            name: template.name,
            type: template.type
        });
    }
    /**
     * Send error notification
     */
    async sendErrorNotification(error) {
        const template = this.templates.get('error-notification');
        if (!template) {
            await this.logger.logWarn('Error notification template not found');
            return;
        }
        const message = {
            title: `Error: ${error.code}`,
            message: this.renderTemplate(template, {
                errorCode: error.code,
                errorMessage: error.message,
                service: error.context.service,
                environment: error.context.environment,
                timestamp: error.context.timestamp,
                severity: error.severity,
                category: error.category,
                userId: error.context.userId?.toString() || 'N/A',
                url: error.context.url || 'N/A'
            }),
            severity: error.severity,
            timestamp: new Date().toISOString(),
            metadata: {
                errorCode: error.code,
                service: error.context.service,
                environment: error.context.environment
            },
            channels: this.getChannelsForSeverity(error.severity)
        };
        await this.queueNotification(message);
    }
    /**
     * Send alert notification
     */
    async sendAlertNotification(alertName, message, severity, metadata) {
        const template = this.templates.get('alert-notification');
        if (!template) {
            await this.logger.logWarn('Alert notification template not found');
            return;
        }
        const notification = {
            title: `Alert: ${alertName}`,
            message: this.renderTemplate(template, {
                alertName,
                alertMessage: message,
                severity,
                timestamp: new Date().toISOString(),
                environment: process.env.NODE_ENV || 'development',
                service: process.env.SERVICE_NAME || 'unknown'
            }),
            severity,
            timestamp: new Date().toISOString(),
            metadata: {
                alertName,
                ...metadata
            },
            channels: this.getChannelsForSeverity(severity)
        };
        await this.queueNotification(notification);
    }
    /**
     * Send deployment notification
     */
    async sendDeploymentNotification(status, environment, version, metadata) {
        const template = this.templates.get('deployment-notification');
        if (!template) {
            await this.logger.logWarn('Deployment notification template not found');
            return;
        }
        const severity = status === 'failed' ? 'high' : 'medium';
        const notification = {
            title: `Deployment ${status}: ${environment}`,
            message: this.renderTemplate(template, {
                status,
                environment,
                version,
                timestamp: new Date().toISOString(),
                service: process.env.SERVICE_NAME || 'unknown'
            }),
            severity,
            timestamp: new Date().toISOString(),
            metadata: {
                deploymentStatus: status,
                environment,
                version,
                ...metadata
            },
            channels: ['slack'] // Deployment notifications typically go to team channels
        };
        await this.queueNotification(notification);
    }
    /**
     * Send custom notification
     */
    async sendCustomNotification(title, message, severity, channels, metadata) {
        const notification = {
            title,
            message,
            severity,
            timestamp: new Date().toISOString(),
            metadata,
            channels
        };
        await this.queueNotification(notification);
    }
    /**
     * Queue notification for processing
     */
    async queueNotification(notification) {
        this.notificationQueue.push(notification);
        await this.logger.logInfo('Notification queued', {
            title: notification.title,
            severity: notification.severity,
            channels: notification.channels
        });
        // Process high and critical notifications immediately
        if (notification.severity === 'high' || notification.severity === 'critical') {
            await this.processNotification(notification);
        }
    }
    /**
     * Start notification queue processor
     */
    startQueueProcessor() {
        setInterval(async () => {
            if (this.isProcessingQueue || this.notificationQueue.length === 0) {
                return;
            }
            this.isProcessingQueue = true;
            try {
                const notificationsToProcess = this.notificationQueue.splice(0, 5); // Process up to 5 at a time
                for (const notification of notificationsToProcess) {
                    await this.processNotification(notification);
                }
            }
            catch (error) {
                await this.logger.logError({
                    code: 'NOTIFICATION_PROCESSING_ERROR',
                    message: `Notification processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    context: {
                        timestamp: new Date().toISOString(),
                        environment: process.env.NODE_ENV || 'development',
                        service: 'notification-service',
                        queueLength: this.notificationQueue.length
                    },
                    severity: 'medium',
                    category: 'system',
                    recoverable: true,
                    retryable: true
                });
            }
            finally {
                this.isProcessingQueue = false;
            }
        }, 10000); // Process every 10 seconds
    }
    /**
     * Process a single notification
     */
    async processNotification(notification) {
        const results = [];
        for (const channelName of notification.channels) {
            const channel = this.channels.get(channelName);
            if (!channel || !channel.enabled) {
                results.push({
                    channel: channelName,
                    success: false,
                    error: 'Channel not found or disabled'
                });
                continue;
            }
            try {
                await this.sendToChannel(channel, notification);
                results.push({ channel: channelName, success: true });
            }
            catch (error) {
                results.push({
                    channel: channelName,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        await this.logger.logInfo('Notification processed', {
            title: notification.title,
            results
        });
    }
    /**
     * Send notification to specific channel
     */
    async sendToChannel(channel, notification) {
        switch (channel.type) {
            case 'email':
                await this.sendEmail(channel, notification);
                break;
            case 'slack':
                await this.sendSlack(channel, notification);
                break;
            case 'webhook':
                await this.sendWebhook(channel, notification);
                break;
            case 'sms':
                await this.sendSMS(channel, notification);
                break;
            default:
                throw new Error(`Unsupported channel type: ${channel.type}`);
        }
    }
    /**
     * Send email notification
     */
    async sendEmail(channel, notification) {
        // This would integrate with your email service (SendGrid, SES, etc.)
        await this.logger.logInfo('Email notification sent (mock)', {
            to: channel.config.to,
            subject: notification.title,
            channel: channel.name
        });
    }
    /**
     * Send Slack notification
     */
    async sendSlack(channel, notification) {
        if (!channel.config.webhookUrl) {
            throw new Error('Slack webhook URL not configured');
        }
        const color = this.getSeverityColor(notification.severity);
        const payload = {
            text: notification.title,
            attachments: [{
                    color,
                    fields: [
                        {
                            title: 'Message',
                            value: notification.message,
                            short: false
                        },
                        {
                            title: 'Severity',
                            value: notification.severity.toUpperCase(),
                            short: true
                        },
                        {
                            title: 'Timestamp',
                            value: notification.timestamp,
                            short: true
                        }
                    ]
                }]
        };
        const response = await fetch(channel.config.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) {
            throw new Error(`Slack notification failed: ${response.status} ${response.statusText}`);
        }
    }
    /**
     * Send webhook notification
     */
    async sendWebhook(channel, notification) {
        if (!channel.config.url) {
            throw new Error('Webhook URL not configured');
        }
        const response = await fetch(channel.config.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(channel.config.headers || {})
            },
            body: JSON.stringify(notification)
        });
        if (!response.ok) {
            throw new Error(`Webhook notification failed: ${response.status} ${response.statusText}`);
        }
    }
    /**
     * Send SMS notification
     */
    async sendSMS(channel, notification) {
        // This would integrate with your SMS service (Twilio, AWS SNS, etc.)
        await this.logger.logInfo('SMS notification sent (mock)', {
            to: channel.config.phoneNumber,
            message: `${notification.title}: ${notification.message}`,
            channel: channel.name
        });
    }
    /**
     * Render notification template with variables
     */
    renderTemplate(template, variables) {
        let rendered = template.body;
        for (const [key, value] of Object.entries(variables)) {
            const placeholder = `{{${key}}}`;
            rendered = rendered.replace(new RegExp(placeholder, 'g'), value);
        }
        return rendered;
    }
    /**
     * Get notification channels based on severity
     */
    getChannelsForSeverity(severity) {
        switch (severity) {
            case 'critical':
                return ['email', 'slack', 'sms'];
            case 'high':
                return ['email', 'slack'];
            case 'medium':
                return ['slack'];
            case 'low':
                return [];
            default:
                return ['slack'];
        }
    }
    /**
     * Get color for severity level (for Slack, etc.)
     */
    getSeverityColor(severity) {
        switch (severity) {
            case 'critical':
                return '#ff0000'; // Red
            case 'high':
                return '#ff8c00'; // Orange
            case 'medium':
                return '#ffd700'; // Yellow
            case 'low':
                return '#00ff00'; // Green
            default:
                return '#808080'; // Gray
        }
    }
    /**
     * Initialize default notification channels
     */
    initializeDefaultChannels() {
        // Email channel
        if (process.env.SMTP_HOST) {
            this.registerChannel({
                name: 'email',
                type: 'email',
                enabled: true,
                config: {
                    host: process.env.SMTP_HOST,
                    port: process.env.SMTP_PORT || 587,
                    user: process.env.SMTP_USER,
                    password: process.env.SMTP_PASSWORD,
                    to: process.env.ALERT_EMAIL || 'admin@example.com'
                }
            });
        }
        // Slack channel
        if (process.env.SLACK_WEBHOOK_URL) {
            this.registerChannel({
                name: 'slack',
                type: 'slack',
                enabled: true,
                config: {
                    webhookUrl: process.env.SLACK_WEBHOOK_URL,
                    channel: process.env.SLACK_CHANNEL || '#alerts'
                }
            });
        }
        // SMS channel
        if (process.env.SMS_API_KEY) {
            this.registerChannel({
                name: 'sms',
                type: 'sms',
                enabled: true,
                config: {
                    apiKey: process.env.SMS_API_KEY,
                    phoneNumber: process.env.ALERT_PHONE_NUMBER
                }
            });
        }
    }
    /**
     * Initialize default notification templates
     */
    initializeDefaultTemplates() {
        // Error notification template
        this.registerTemplate({
            name: 'error-notification',
            type: 'error',
            subject: 'Error Alert: {{errorCode}}',
            body: `
🚨 Error Alert

**Error Code:** {{errorCode}}
**Message:** {{errorMessage}}
**Service:** {{service}}
**Environment:** {{environment}}
**Severity:** {{severity}}
**Category:** {{category}}
**User ID:** {{userId}}
**URL:** {{url}}
**Timestamp:** {{timestamp}}

Please investigate this error immediately.
      `.trim(),
            variables: ['errorCode', 'errorMessage', 'service', 'environment', 'severity', 'category', 'userId', 'url', 'timestamp']
        });
        // Alert notification template
        this.registerTemplate({
            name: 'alert-notification',
            type: 'alert',
            subject: 'System Alert: {{alertName}}',
            body: `
⚠️ System Alert

**Alert:** {{alertName}}
**Message:** {{alertMessage}}
**Severity:** {{severity}}
**Service:** {{service}}
**Environment:** {{environment}}
**Timestamp:** {{timestamp}}

Please check the system status.
      `.trim(),
            variables: ['alertName', 'alertMessage', 'severity', 'service', 'environment', 'timestamp']
        });
        // Deployment notification template
        this.registerTemplate({
            name: 'deployment-notification',
            type: 'deployment',
            subject: 'Deployment {{status}}: {{environment}}',
            body: `
🚀 Deployment Update

**Status:** {{status}}
**Environment:** {{environment}}
**Version:** {{version}}
**Service:** {{service}}
**Timestamp:** {{timestamp}}

Deployment has {{status}}.
      `.trim(),
            variables: ['status', 'environment', 'version', 'service', 'timestamp']
        });
    }
}
// Export singleton instance
export const notificationService = NotificationService.getInstance();
