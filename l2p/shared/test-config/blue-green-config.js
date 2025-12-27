/**
 * Blue-Green Deployment Configuration
 * Default configurations for blue-green deployment strategy
 */
export const DEFAULT_BLUE_GREEN_CONFIG = {
    loadBalancer: {
        type: 'nginx',
        configPath: '/etc/nginx/sites-available/learn2play',
        reloadCommand: 'sudo nginx -s reload',
        healthCheckEndpoint: 'http://localhost/api/health',
        upstreamTemplate: `
upstream backend_{{ENVIRONMENT}} {
    server localhost:{{BACKEND_PORT}};
}

upstream frontend_{{ENVIRONMENT}} {
    server localhost:{{FRONTEND_PORT}};
}
`
    },
    monitoring: {
        errorRateThreshold: 5, // 5% error rate threshold
        responseTimeThreshold: 2000, // 2 second response time threshold
        monitoringDuration: 300, // 5 minutes of monitoring
        checkInterval: 30, // Check every 30 seconds
        alertWebhook: process.env.SLACK_WEBHOOK_URL || process.env.TEAMS_WEBHOOK_URL
    },
    rollbackTriggers: [
        {
            type: 'error_rate',
            threshold: 10, // 10% error rate triggers rollback
            duration: 120, // Monitor for 2 minutes
            enabled: true
        },
        {
            type: 'response_time',
            threshold: 5000, // 5 second response time triggers rollback
            duration: 180, // Monitor for 3 minutes
            enabled: true
        },
        {
            type: 'health_check',
            threshold: 50, // 50% of health checks failing triggers rollback
            duration: 60, // Monitor for 1 minute
            enabled: true
        }
    ],
    smokeTests: {
        command: 'npm run test:smoke',
        timeout: 120000, // 2 minutes timeout
        retries: 3,
        criticalEndpoints: [
            '/api/health',
            '/api/auth/status',
            '/api/users/profile',
            '/api/games/lobby',
            '/'
        ]
    },
    trafficSwitching: {
        strategy: 'immediate',
        switchTimeout: 30000 // 30 seconds timeout for traffic switch
    }
};
export const STAGING_BLUE_GREEN_CONFIG = {
    ...DEFAULT_BLUE_GREEN_CONFIG,
    loadBalancer: {
        ...DEFAULT_BLUE_GREEN_CONFIG.loadBalancer,
        configPath: './nginx/staging.conf',
        reloadCommand: 'docker-compose exec nginx nginx -s reload',
        healthCheckEndpoint: 'http://localhost:8080/api/health'
    },
    monitoring: {
        ...DEFAULT_BLUE_GREEN_CONFIG.monitoring,
        errorRateThreshold: 10, // More lenient for staging
        responseTimeThreshold: 3000, // More lenient for staging
        monitoringDuration: 180, // 3 minutes for staging
        checkInterval: 15 // Check every 15 seconds
    },
    rollbackTriggers: [
        {
            type: 'error_rate',
            threshold: 25, // 25% error rate for staging
            duration: 60,
            enabled: true
        },
        {
            type: 'response_time',
            threshold: 10000, // 10 seconds for staging
            duration: 120,
            enabled: true
        },
        {
            type: 'health_check',
            threshold: 75, // 75% health check failures for staging
            duration: 30,
            enabled: true
        }
    ]
};
export const PRODUCTION_BLUE_GREEN_CONFIG = {
    ...DEFAULT_BLUE_GREEN_CONFIG,
    loadBalancer: {
        ...DEFAULT_BLUE_GREEN_CONFIG.loadBalancer,
        configPath: '/etc/nginx/sites-available/learn2play-prod',
        reloadCommand: 'sudo systemctl reload nginx',
        healthCheckEndpoint: 'https://learn2play.com/api/health'
    },
    monitoring: {
        ...DEFAULT_BLUE_GREEN_CONFIG.monitoring,
        errorRateThreshold: 2, // Strict for production
        responseTimeThreshold: 1000, // 1 second for production
        monitoringDuration: 600, // 10 minutes for production
        checkInterval: 60, // Check every minute
        alertWebhook: process.env.PRODUCTION_ALERT_WEBHOOK
    },
    rollbackTriggers: [
        {
            type: 'error_rate',
            threshold: 5, // 5% error rate triggers rollback in production
            duration: 180,
            enabled: true
        },
        {
            type: 'response_time',
            threshold: 3000, // 3 seconds triggers rollback in production
            duration: 300,
            enabled: true
        },
        {
            type: 'health_check',
            threshold: 25, // 25% health check failures triggers rollback
            duration: 120,
            enabled: true
        }
    ],
    smokeTests: {
        command: 'npm run test:smoke:production',
        timeout: 300000, // 5 minutes timeout for production
        retries: 5,
        criticalEndpoints: [
            '/api/health',
            '/api/auth/status',
            '/api/users/profile',
            '/api/games/lobby',
            '/api/games/leaderboard',
            '/',
            '/login',
            '/dashboard'
        ]
    },
    trafficSwitching: {
        strategy: 'gradual',
        gradualSteps: [10, 25, 50, 75, 100], // Gradual rollout percentages
        switchTimeout: 60000 // 1 minute timeout for production
    }
};
export const CANARY_BLUE_GREEN_CONFIG = {
    ...PRODUCTION_BLUE_GREEN_CONFIG,
    trafficSwitching: {
        strategy: 'canary',
        canaryPercentage: 5, // 5% canary traffic
        switchTimeout: 120000 // 2 minutes for canary
    },
    monitoring: {
        ...PRODUCTION_BLUE_GREEN_CONFIG.monitoring,
        monitoringDuration: 1800, // 30 minutes for canary
        checkInterval: 30 // Check every 30 seconds for canary
    }
};
export const BLUE_GREEN_CONFIGS = {
    default: DEFAULT_BLUE_GREEN_CONFIG,
    staging: STAGING_BLUE_GREEN_CONFIG,
    production: PRODUCTION_BLUE_GREEN_CONFIG,
    canary: CANARY_BLUE_GREEN_CONFIG
};
export default BLUE_GREEN_CONFIGS;
