/**
 * Deployment Target Configurations
 * Defines staging and production deployment configurations
 */
export const STAGING_TARGET = {
    name: 'staging',
    environment: 'staging',
    config: {
        dockerCompose: 'docker-compose.yml',
        healthCheckUrl: 'http://localhost:3001/api/health',
        healthCheckTimeout: 30,
        healthCheckRetries: 10,
        smokeTestCommand: 'npm run test:smoke',
        rollbackCommand: 'docker-compose -f docker-compose.yml down && docker-compose -f docker-compose.yml up -d',
        preDeploymentHooks: [
            'echo "Starting staging deployment..."',
            'docker system prune -f',
            'npm run lint',
            'npm run type-check'
        ],
        postDeploymentHooks: [
            'echo "Staging deployment completed"',
            'npm run test:smoke',
            'curl -f http://localhost:3001/api/health'
        ],
        environmentVariables: {
            NODE_ENV: 'staging',
            DATABASE_URL: 'postgresql://staging_user:staging_pass@postgres:5432/staging_db',

            FRONTEND_URL: 'http://localhost:3000',
            BACKEND_URL: 'http://localhost:3001',
            LOG_LEVEL: 'info',
            ENABLE_CORS: 'true',
            JWT_SECRET: 'staging-jwt-secret-change-in-production',
            SMTP_HOST: 'localhost',
            SMTP_PORT: '1025',
            REDIS_URL: 'redis://redis:6379'
        },
        services: [
            {
                name: 'postgres',
                image: 'postgres:15-alpine',
                healthCheck: {
                    endpoint: 'http://localhost:5432',
                    timeout: 10,
                    retries: 5,
                    interval: 5
                },
                dependencies: []
            },

            {
                name: 'redis',
                image: 'redis:7-alpine',
                healthCheck: {
                    endpoint: 'http://localhost:6379',
                    timeout: 10,
                    retries: 5,
                    interval: 5
                },
                dependencies: []
            },
            {
                name: 'backend',
                image: 'learn2play-backend:latest',
                healthCheck: {
                    endpoint: 'http://localhost:3001/api/health',
                    timeout: 30,
                    retries: 10,
                    interval: 5
                },
                dependencies: ['postgres', 'redis']
            },
            {
                name: 'frontend',
                image: 'learn2play-frontend:latest',
                healthCheck: {
                    endpoint: 'http://localhost:3000',
                    timeout: 30,
                    retries: 10,
                    interval: 5
                },
                dependencies: ['backend']
            }
        ]
    }
};
export const PRODUCTION_TARGET = {
    name: 'production',
    environment: 'production',
    config: {
        dockerCompose: 'docker-compose.prod.yml',
        healthCheckUrl: 'https://api.learn2play.com/health',
        healthCheckTimeout: 60,
        healthCheckRetries: 15,
        smokeTestCommand: 'npm run test:smoke:production',
        rollbackCommand: 'kubectl rollout undo deployment/learn2play-backend && kubectl rollout undo deployment/learn2play-frontend',
        preDeploymentHooks: [
            'echo "Starting production deployment..."',
            'npm run security:audit',
            'npm run build:production',
            'docker system prune -f',
            'kubectl get nodes',
            'helm lint ./helm/learn2play'
        ],
        postDeploymentHooks: [
            'echo "Production deployment completed"',
            'npm run test:smoke:production',
            'curl -f https://api.learn2play.com/health',
            'npm run monitoring:verify',
            'slack-notify "Production deployment successful"'
        ],
        environmentVariables: {
            NODE_ENV: 'production',
            DATABASE_URL: '${DATABASE_URL}', // Injected from secrets

            FRONTEND_URL: 'https://learn2play.com',
            BACKEND_URL: 'https://api.learn2play.com',
            LOG_LEVEL: 'warn',
            ENABLE_CORS: 'false',
            JWT_SECRET: '${JWT_SECRET}', // Injected from secrets
            SMTP_HOST: '${SMTP_HOST}',
            SMTP_PORT: '${SMTP_PORT}',
            SMTP_USER: '${SMTP_USER}',
            SMTP_PASS: '${SMTP_PASS}',
            REDIS_URL: '${REDIS_URL}',
            SENTRY_DSN: '${SENTRY_DSN}',
            NEW_RELIC_LICENSE_KEY: '${NEW_RELIC_LICENSE_KEY}',
            CLOUDFLARE_API_TOKEN: '${CLOUDFLARE_API_TOKEN}'
        },
        services: [
            {
                name: 'postgres',
                image: 'postgres:15-alpine',
                healthCheck: {
                    endpoint: 'postgresql://postgres:5432',
                    timeout: 15,
                    retries: 10,
                    interval: 10
                },
                dependencies: []
            },

            {
                name: 'redis',
                image: 'redis:7-alpine',
                healthCheck: {
                    endpoint: 'redis://redis:6379',
                    timeout: 15,
                    retries: 10,
                    interval: 10
                },
                dependencies: []
            },
            {
                name: 'backend',
                image: 'learn2play-backend:production',
                healthCheck: {
                    endpoint: 'https://api.learn2play.com/health',
                    timeout: 60,
                    retries: 15,
                    interval: 10
                },
                dependencies: ['postgres', 'redis']
            },
            {
                name: 'frontend',
                image: 'learn2play-frontend:production',
                healthCheck: {
                    endpoint: 'https://learn2play.com',
                    timeout: 60,
                    retries: 15,
                    interval: 10
                },
                dependencies: ['backend']
            },
            {
                name: 'nginx',
                image: 'nginx:alpine',
                healthCheck: {
                    endpoint: 'https://learn2play.com/health',
                    timeout: 30,
                    retries: 10,
                    interval: 10
                },
                dependencies: ['frontend', 'backend']
            }
        ]
    }
};
export const DEPLOYMENT_TARGETS = {
    staging: STAGING_TARGET,
    production: PRODUCTION_TARGET
};
export default DEPLOYMENT_TARGETS;
