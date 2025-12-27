/**
 * Test Environment Orchestrator
 * Manages Docker container lifecycle with health checking, retry logic, and cleanup
 */
import { spawn } from 'child_process';
import * as fsSync from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
export class TestEnvironment {
    constructor(configPath) {
        this.isStarted = false;
        this.portMappings = new Map();
        this.processes = new Map();
        this.config = this.loadConfig(configPath);
    }
    /**
     * Load configuration from YAML file
     */
    loadConfig(configPath) {
        const projectRoot = this.findProjectRoot();
        const defaultConfig = {
            composeFile: path.resolve(projectRoot, 'docker-compose.test.yml'),
            projectName: 'learn2play-test',
            network: 'test-network',
            services: {
                'postgres-test': {
                    container_name: 'l2p-postgres-test',
                    port: 5433,
                    health_endpoint: '',
                    health_timeout: 30,
                    startup_timeout: 60,
                },

                'backend-test': {
                    container_name: 'l2p-backend-test',
                    port: 3001,
                    health_endpoint: '/api/health',
                    health_timeout: 30,
                    startup_timeout: 90,
                },
                'frontend-test': {
                    container_name: 'l2p-frontend-test',
                    port: 3000,
                    health_endpoint: '/',
                    health_timeout: 30,
                    startup_timeout: 120,
                },
                'mailhog-test': {
                    container_name: 'l2p-mailhog-test',
                    port: 8025,
                    health_endpoint: '/',
                    health_timeout: 10,
                    startup_timeout: 30,
                },
                'redis-test': {
                    container_name: 'l2p-redis-test',
                    port: 6380,
                    health_endpoint: '',
                    health_timeout: 10,
                    startup_timeout: 30,
                },
            },
            volumes: {
                test_postgres_data: { type: 'tmpfs', size: '512m', uid: 999, gid: 999 },

                test_redis_data: { type: 'tmpfs', size: '128m', uid: 999, gid: 999 },
                test_backend_node_modules: { type: 'volume' },
                test_frontend_node_modules: { type: 'volume' },
                test_backend_logs: { type: 'volume' },
            },
        };
        if (configPath) {
            try {
                const configFile = require('fs').readFileSync(configPath, 'utf8');
                const loadedConfig = yaml.load(configFile);
                return { ...defaultConfig, ...loadedConfig.environments?.test };
            }
            catch (error) {
                console.warn(`Failed to load config from ${configPath}, using defaults:`, error);
            }
        }
        return defaultConfig;
    }
    /**
     * Start the test environment
     */
    async start() {
        if (this.isStarted) {
            throw new Error('Test environment is already started');
        }
        console.log('Starting test environment...');
        try {
            // Check for port conflicts and resolve them
            await this.resolvePortConflicts();
            // Pull latest images
            await this.pullImages();
            // Build test images
            await this.buildImages();
            // Start services
            await this.startServices();
            // Wait for services to be healthy
            await this.waitForHealthyServices();
            this.isStarted = true;
            this.startHealthCheckMonitoring();
            console.log('Test environment started successfully');
        }
        catch (error) {
            console.error('Failed to start test environment:', error);
            await this.cleanup();
            throw error;
        }
    }
    /**
     * Stop the test environment
     */
    async stop() {
        if (!this.isStarted) {
            console.log('Test environment is not running');
            return;
        }
        console.log('Stopping test environment...');
        try {
            // Stop health check monitoring
            if (this.healthCheckInterval) {
                clearInterval(this.healthCheckInterval);
                this.healthCheckInterval = undefined;
            }
            // Stop all processes
            for (const [name, process] of this.processes) {
                if (!process.killed) {
                    process.kill('SIGTERM');
                }
            }
            this.processes.clear();
            // Stop Docker services
            await this.executeCommand('docker-compose', [
                '-f', this.config.composeFile,
                '-p', this.config.projectName,
                'down'
            ]);
            this.isStarted = false;
            console.log('Test environment stopped successfully');
        }
        catch (error) {
            console.error('Error stopping test environment:', error);
            throw error;
        }
    }
    /**
     * Reset the test environment (clean restart)
     */
    async reset() {
        console.log('Resetting test environment...');
        await this.cleanup();
        await this.start();
    }
    /**
     * Clean up all resources
     */
    async cleanup() {
        console.log('Cleaning up test environment...');
        try {
            // Stop services if running
            if (this.isStarted) {
                await this.stop();
            }
            // Remove containers, volumes, and networks
            await this.executeCommand('docker-compose', [
                '-f', this.config.composeFile,
                '-p', this.config.projectName,
                'down', '-v', '--remove-orphans'
            ]);
            // Clean up test images
            await this.cleanupImages();
            // Clean up unused volumes and networks
            await this.executeCommand('docker', ['volume', 'prune', '-f']);
            await this.executeCommand('docker', ['network', 'prune', '-f']);
            console.log('Test environment cleaned up successfully');
        }
        catch (error) {
            console.error('Error during cleanup:', error);
            throw error;
        }
    }
    /**
     * Get health status of all services
     */
    async healthCheck() {
        const healthStatuses = [];
        for (const [serviceName, serviceConfig] of Object.entries(this.config.services)) {
            const health = await this.checkServiceHealth(serviceName, serviceConfig);
            healthStatuses.push(health);
        }
        return healthStatuses;
    }
    /**
     * Get logs for a specific service or all services
     */
    async getLogs(serviceName) {
        const args = [
            '-f', this.config.composeFile,
            '-p', this.config.projectName,
            'logs'
        ];
        if (serviceName) {
            args.push(serviceName);
        }
        try {
            const result = await this.executeCommand('docker-compose', args);
            return result.split('\n').filter(line => line.trim());
        }
        catch (error) {
            console.error(`Failed to get logs${serviceName ? ` for ${serviceName}` : ''}:`, error);
            return [];
        }
    }
    /**
     * Get service URLs
     */
    getServiceUrls() {
        const urls = {};
        for (const [serviceName, serviceConfig] of Object.entries(this.config.services)) {
            const port = this.portMappings.get(serviceName) || serviceConfig.port;
            urls[serviceName] = `http://localhost:${port}${serviceConfig.health_endpoint}`;
        }
        return urls;
    }
    /**
     * Check if environment is running
     */
    isRunning() {
        return this.isStarted;
    }
    /**
     * Resolve port conflicts by finding available ports
     */
    async resolvePortConflicts() {
        const conflicts = [];
        for (const [serviceName, serviceConfig] of Object.entries(this.config.services)) {
            const isPortInUse = await this.isPortInUse(serviceConfig.port);
            if (isPortInUse) {
                const newPort = await this.findAvailablePort(serviceConfig.port + 1000);
                conflicts.push({
                    originalPort: serviceConfig.port,
                    newPort,
                    service: serviceName
                });
                this.portMappings.set(serviceName, newPort);
                console.log(`Port conflict resolved for ${serviceName}: ${serviceConfig.port} -> ${newPort}`);
            }
        }
        return conflicts;
    }
    /**
     * Check if a port is in use
     */
    async isPortInUse(port) {
        return new Promise((resolve) => {
            const net = require('net');
            const server = net.createServer();
            server.listen(port, () => {
                server.once('close', () => resolve(false));
                server.close();
            });
            server.on('error', () => resolve(true));
        });
    }
    /**
     * Find an available port starting from the given port
     */
    async findAvailablePort(startPort) {
        let port = startPort;
        while (await this.isPortInUse(port)) {
            port++;
        }
        return port;
    }
    /**
     * Pull Docker images
     */
    async pullImages() {
        console.log('Pulling Docker images...');
        console.log(`Using compose file: ${this.config.composeFile}`);
        console.log(`Project root: ${this.findProjectRoot()}`);
        await this.executeCommand('docker-compose', [
            '-f', this.config.composeFile,
            '-p', this.config.projectName,
            'pull', '--quiet'
        ]);
    }
    /**
     * Build Docker images
     */
    async buildImages() {
        console.log('Building Docker images...');
        await this.executeCommand('docker-compose', [
            '-f', this.config.composeFile,
            '-p', this.config.projectName,
            'build', '--parallel'
        ]);
    }
    /**
     * Start Docker services
     */
    async startServices() {
        console.log('Starting Docker services...');
        await this.executeCommand('docker-compose', [
            '-f', this.config.composeFile,
            '-p', this.config.projectName,
            'up', '-d'
        ]);
    }
    /**
     * Wait for all services to be healthy
     */
    async waitForHealthyServices() {
        console.log('Waiting for services to be healthy...');
        const serviceOrder = [
            'postgres-test',
            'redis-test',
            'mailhog-test',
            'backend-test',
            'frontend-test'
        ];
        for (const serviceName of serviceOrder) {
            const serviceConfig = this.config.services[serviceName];
            if (serviceConfig) {
                await this.waitForServiceHealth(serviceName, serviceConfig);
            }
        }
    }
    /**
     * Wait for a specific service to be healthy
     */
    async waitForServiceHealth(serviceName, serviceConfig, maxAttempts = 60) {
        console.log(`Waiting for ${serviceName} to be healthy...`);
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const health = await this.checkServiceHealth(serviceName, serviceConfig);
            if (health.status === 'healthy') {
                console.log(`${serviceName} is healthy`);
                return;
            }
            if (attempt % 10 === 0) {
                console.log(`Still waiting for ${serviceName}... (attempt ${attempt}/${maxAttempts})`);
            }
            await this.sleep(2000); // Wait 2 seconds between checks
        }
        throw new Error(`${serviceName} failed to become healthy within ${maxAttempts * 2} seconds`);
    }
    /**
     * Check health of a specific service
     */
    async checkServiceHealth(serviceName, serviceConfig) {
        const health = {
            name: serviceName,
            status: 'unknown',
            lastCheck: new Date()
        };
        try {
            // For database services, check using docker-compose ps
            if (serviceName.includes('postgres') || serviceName.includes('redis')) {
                const result = await this.executeCommand('docker-compose', [
                    '-f', this.config.composeFile,
                    '-p', this.config.projectName,
                    'ps', serviceName
                ]);
                if (result.includes('healthy')) {
                    health.status = 'healthy';
                }
                else if (result.includes('starting')) {
                    health.status = 'starting';
                }
                else {
                    health.status = 'unhealthy';
                }
            }
            else {
                // For HTTP services, check the health endpoint
                const port = this.portMappings.get(serviceName) || serviceConfig.port;
                const url = `http://localhost:${port}${serviceConfig.health_endpoint}`;
                health.url = url;
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), serviceConfig.health_timeout * 1000);
                const response = await fetch(url, {
                    signal: controller.signal,
                    method: 'GET'
                });
                clearTimeout(timeoutId);
                if (response.ok) {
                    health.status = 'healthy';
                }
                else {
                    health.status = 'unhealthy';
                    health.error = `HTTP ${response.status}: ${response.statusText}`;
                }
            }
        }
        catch (error) {
            health.status = 'unhealthy';
            health.error = error instanceof Error ? error.message : String(error);
        }
        return health;
    }
    /**
     * Start health check monitoring
     */
    startHealthCheckMonitoring() {
        this.healthCheckInterval = setInterval(async () => {
            try {
                const healthStatuses = await this.healthCheck();
                const unhealthyServices = healthStatuses.filter(h => h.status === 'unhealthy');
                if (unhealthyServices.length > 0) {
                    console.warn('Unhealthy services detected:', unhealthyServices.map(h => h.name));
                }
            }
            catch (error) {
                console.error('Health check monitoring error:', error);
            }
        }, 30000); // Check every 30 seconds
    }
    /**
     * Clean up Docker images
     */
    async cleanupImages() {
        try {
            // Remove images with the project label
            const result = await this.executeCommand('docker', [
                'images',
                '--filter', `label=com.docker.compose.project=${this.config.projectName}`,
                '-q'
            ]);
            const imageIds = result.split('\n').filter(id => id.trim());
            if (imageIds.length > 0) {
                await this.executeCommand('docker', ['rmi', '-f', ...imageIds]);
            }
        }
        catch (error) {
            console.warn('Failed to clean up images:', error);
        }
    }
    /**
     * Execute a command and return the output
     */
    async executeCommand(command, args, cwd) {
        return new Promise((resolve, reject) => {
            const projectRoot = this.findProjectRoot();
            const workingDir = cwd || (command === 'docker-compose' ? projectRoot : process.cwd());
            const childProcess = spawn(command, args, { stdio: 'pipe', cwd: workingDir });
            let stdout = '';
            let stderr = '';
            childProcess.stdout?.on('data', (data) => {
                stdout += data.toString();
            });
            childProcess.stderr?.on('data', (data) => {
                stderr += data.toString();
            });
            childProcess.on('close', (code) => {
                if (code === 0) {
                    resolve(stdout);
                }
                else {
                    reject(new Error(`Command failed with code ${code}: ${stderr}`));
                }
            });
            childProcess.on('error', (error) => {
                reject(error);
            });
        });
    }
    /**
     * Sleep for the specified number of milliseconds
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Find project root directory by looking for package.json with workspaces
     */
    findProjectRoot() {
        let currentDir = process.cwd();
        while (currentDir !== path.dirname(currentDir)) {
            const packageJsonPath = path.join(currentDir, 'package.json');
            if (fsSync.existsSync(packageJsonPath)) {
                try {
                    const packageJson = JSON.parse(fsSync.readFileSync(packageJsonPath, 'utf8'));
                    // Look for the root package.json that has workspaces defined
                    if (packageJson.workspaces || packageJson.name === 'learn2play') {
                        return currentDir;
                    }
                }
                catch (error) {
                    // Continue searching if package.json is malformed
                }
            }
            currentDir = path.dirname(currentDir);
        }
        // Fallback to current directory if root package.json not found
        return process.cwd();
    }
}
