#!/usr/bin/env node
/**
 * Test Environment CLI
 * Command-line interface for the TestEnvironment orchestrator
 */
import { TestEnvironment } from './TestEnvironment.js';
import * as path from 'path';
// Colors for console output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m'
};
class TestEnvironmentCLI {
    constructor() {
        const configPath = process.env.TEST_CONFIG_PATH || path.join(process.cwd(), 'test-config.yml');
        this.testEnv = new TestEnvironment(configPath);
    }
    /**
     * Log with color
     */
    log(message, color = 'reset') {
        console.log(`${colors[color]}${message}${colors.reset}`);
    }
    /**
     * Log info message
     */
    logInfo(message) {
        this.log(`[INFO] ${message}`, 'blue');
    }
    /**
     * Log success message
     */
    logSuccess(message) {
        this.log(`[SUCCESS] ${message}`, 'green');
    }
    /**
     * Log warning message
     */
    logWarning(message) {
        this.log(`[WARNING] ${message}`, 'yellow');
    }
    /**
     * Log error message
     */
    logError(message) {
        this.log(`[ERROR] ${message}`, 'red');
    }
    /**
     * Start command
     */
    async start() {
        try {
            this.logInfo('Starting test environment...');
            await this.testEnv.start();
            this.logSuccess('Test environment started successfully');
            this.showServiceUrls();
        }
        catch (error) {
            this.logError(`Failed to start test environment: ${error}`);
            process.exit(1);
        }
    }
    /**
     * Stop command
     */
    async stop() {
        try {
            this.logInfo('Stopping test environment...');
            await this.testEnv.stop();
            this.logSuccess('Test environment stopped successfully');
        }
        catch (error) {
            this.logError(`Failed to stop test environment: ${error}`);
            process.exit(1);
        }
    }
    /**
     * Restart command
     */
    async restart() {
        try {
            this.logInfo('Restarting test environment...');
            await this.testEnv.stop();
            await this.testEnv.start();
            this.logSuccess('Test environment restarted successfully');
            this.showServiceUrls();
        }
        catch (error) {
            this.logError(`Failed to restart test environment: ${error}`);
            process.exit(1);
        }
    }
    /**
     * Reset command
     */
    async reset() {
        try {
            this.logInfo('Resetting test environment...');
            await this.testEnv.reset();
            this.logSuccess('Test environment reset successfully');
            this.showServiceUrls();
        }
        catch (error) {
            this.logError(`Failed to reset test environment: ${error}`);
            process.exit(1);
        }
    }
    /**
     * Cleanup command
     */
    async cleanup() {
        try {
            this.logInfo('Cleaning up test environment...');
            await this.testEnv.cleanup();
            this.logSuccess('Test environment cleaned up successfully');
        }
        catch (error) {
            this.logError(`Failed to cleanup test environment: ${error}`);
            process.exit(1);
        }
    }
    /**
     * Status command
     */
    async status() {
        try {
            this.logInfo('Checking test environment status...');
            if (this.testEnv.isRunning()) {
                this.logSuccess('Test environment is running');
            }
            else {
                this.logWarning('Test environment is not running');
            }
            const healthStatuses = await this.testEnv.healthCheck();
            this.showHealthStatus(healthStatuses);
        }
        catch (error) {
            this.logError(`Failed to get status: ${error}`);
            process.exit(1);
        }
    }
    /**
     * Health command
     */
    async health() {
        try {
            this.logInfo('Running health checks...');
            const healthStatuses = await this.testEnv.healthCheck();
            const allHealthy = healthStatuses.every(h => h.status === 'healthy');
            if (allHealthy) {
                this.logSuccess('All services are healthy');
            }
            else {
                this.logWarning('Some services are unhealthy');
            }
            this.showHealthStatus(healthStatuses);
            if (!allHealthy) {
                process.exit(1);
            }
        }
        catch (error) {
            this.logError(`Failed to run health checks: ${error}`);
            process.exit(1);
        }
    }
    /**
     * Logs command
     */
    async logs(serviceName) {
        try {
            this.logInfo(`Getting logs${serviceName ? ` for ${serviceName}` : ' for all services'}...`);
            const logs = await this.testEnv.getLogs(serviceName);
            if (logs.length === 0) {
                this.logWarning('No logs found');
            }
            else {
                console.log('\n--- Logs ---');
                logs.forEach(line => console.log(line));
                console.log('--- End Logs ---\n');
            }
        }
        catch (error) {
            this.logError(`Failed to get logs: ${error}`);
            process.exit(1);
        }
    }
    /**
     * URLs command
     */
    urls() {
        this.showServiceUrls();
    }
    /**
     * Show service URLs
     */
    showServiceUrls() {
        const urls = this.testEnv.getServiceUrls();
        console.log('\n--- Service URLs ---');
        Object.entries(urls).forEach(([service, url]) => {
            const serviceName = service.replace('-test', '').toUpperCase();
            console.log(`  ${serviceName.padEnd(12)}: ${url}`);
        });
        console.log('--- End URLs ---\n');
    }
    /**
     * Show health status
     */
    showHealthStatus(healthStatuses) {
        console.log('\n--- Health Status ---');
        healthStatuses.forEach(health => {
            const statusColor = health.status === 'healthy' ? 'green' :
                health.status === 'starting' ? 'yellow' : 'red';
            const serviceName = health.name.replace('-test', '').toUpperCase();
            const status = health.status.toUpperCase();
            this.log(`  ${serviceName.padEnd(12)}: ${status}`, statusColor);
            if (health.url) {
                console.log(`    URL: ${health.url}`);
            }
            if (health.error) {
                this.log(`    Error: ${health.error}`, 'red');
            }
            console.log(`    Last Check: ${health.lastCheck.toISOString()}`);
            console.log('');
        });
        console.log('--- End Health Status ---\n');
    }
    /**
     * Show help
     */
    showHelp() {
        console.log(`
Test Environment CLI

Usage: test-env <command> [options]

Commands:
  start       Start the test environment
  stop        Stop the test environment
  restart     Restart the test environment
  reset       Reset the test environment (clean restart)
  cleanup     Clean up all test environment resources
  status      Show test environment status
  health      Run health checks on all services
  logs        Show logs for all services
  logs <service>  Show logs for specific service
  urls        Show service URLs
  help        Show this help message

Examples:
  test-env start
  test-env logs backend-test
  test-env health
  test-env cleanup

Environment Variables:
  TEST_CONFIG_PATH    Path to test configuration file (default: ./test-config.yml)

Services:
  postgres-test       PostgreSQL test database

  backend-test        Backend API service
  frontend-test       Frontend web service
  mailhog-test        Email testing service
  redis-test          Redis cache service
`);
    }
    /**
     * Run CLI command
     */
    async run(args) {
        const command = args[0];
        const subCommand = args[1];
        try {
            switch (command) {
                case 'start':
                    await this.start();
                    break;
                case 'stop':
                    await this.stop();
                    break;
                case 'restart':
                    await this.restart();
                    break;
                case 'reset':
                    await this.reset();
                    break;
                case 'cleanup':
                    await this.cleanup();
                    break;
                case 'status':
                    await this.status();
                    break;
                case 'health':
                    await this.health();
                    break;
                case 'logs':
                    await this.logs(subCommand);
                    break;
                case 'urls':
                    this.urls();
                    break;
                case 'help':
                case '--help':
                case '-h':
                    this.showHelp();
                    break;
                default:
                    this.logError(`Unknown command: ${command}`);
                    this.showHelp();
                    process.exit(1);
            }
        }
        catch (error) {
            this.logError(`Command failed: ${error}`);
            process.exit(1);
        }
    }
}
// Run CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    const cli = new TestEnvironmentCLI();
    const args = process.argv.slice(2);
    if (args.length === 0) {
        cli.showHelp();
        process.exit(0);
    }
    cli.run(args).catch(error => {
        console.error('CLI Error:', error);
        process.exit(1);
    });
}
export { TestEnvironmentCLI };
