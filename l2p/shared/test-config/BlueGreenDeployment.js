/**
 * Blue-Green Deployment Strategy
 * Implements blue-green deployment with health check validation,
 * automatic rollback triggers, and post-deployment verification
 */
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
export class BlueGreenDeployment {
    constructor(config) {
        this.rollbackInProgress = false;
        this.projectRoot = this.findProjectRoot();
        this.config = config;
        // Initialize environments
        this.blueEnvironment = this.createEnvironment('blue');
        this.greenEnvironment = this.createEnvironment('green');
    }
    /**
     * Deploy using blue-green strategy
     */
    async deploy(target, newVersion, buildArtifacts) {
        const startTime = Date.now();
        const deploymentId = `bg-deploy-${Date.now()}`;
        console.log(`🔄 Starting blue-green deployment (${deploymentId})...\n`);
        try {
            // 1. Determine current active environment and target environment
            const activeEnv = await this.getActiveEnvironment();
            const targetEnv = activeEnv === 'blue' ? 'green' : 'blue';
            console.log(`📍 Current active environment: ${activeEnv}`);
            console.log(`🎯 Deploying to: ${targetEnv}`);
            // 2. Deploy to inactive environment
            console.log(`🚀 Deploying version ${newVersion} to ${targetEnv} environment...`);
            const deploymentResult = await this.deployToEnvironment(targetEnv, target, newVersion, buildArtifacts);
            if (!deploymentResult.success) {
                throw new Error(`Deployment to ${targetEnv} failed: ${deploymentResult.error}`);
            }
            // 3. Run health checks on new environment
            console.log(`🏥 Running health checks on ${targetEnv} environment...`);
            const healthChecks = await this.performEnvironmentHealthChecks(targetEnv, target);
            const unhealthyServices = healthChecks.filter(hc => hc.status !== 'healthy');
            if (unhealthyServices.length > 0) {
                throw new Error(`Health checks failed for ${targetEnv}: ${unhealthyServices.map(s => s.service).join(', ')}`);
            }
            // 4. Run smoke tests against new environment
            console.log(`💨 Running smoke tests against ${targetEnv} environment...`);
            const smokeTestResults = await this.runSmokeTests(targetEnv);
            if (smokeTestResults.failed > 0) {
                throw new Error(`Smoke tests failed on ${targetEnv}: ${smokeTestResults.failed} failures`);
            }
            // 5. Switch traffic to new environment
            console.log(`🔀 Switching traffic from ${activeEnv} to ${targetEnv}...`);
            const trafficSwitchResult = await this.switchTraffic(activeEnv, targetEnv);
            if (!trafficSwitchResult.success) {
                throw new Error(`Traffic switch failed: ${trafficSwitchResult.error}`);
            }
            // 6. Start monitoring new environment
            console.log(`📊 Starting monitoring of ${targetEnv} environment...`);
            const monitoringResults = await this.startPostDeploymentMonitoring(targetEnv);
            // 7. Check for rollback triggers
            const rollbackTriggered = await this.checkRollbackTriggers(monitoringResults);
            if (rollbackTriggered) {
                console.log(`⚠️  Rollback triggered, switching back to ${activeEnv}...`);
                await this.performAutomaticRollback(targetEnv, activeEnv);
                return {
                    success: false,
                    target,
                    duration: Date.now() - startTime,
                    deploymentId,
                    timestamp: new Date(),
                    services: deploymentResult.services,
                    healthChecks,
                    smokeTestResults,
                    logs: deploymentResult.logs,
                    error: 'Deployment rolled back due to monitoring triggers',
                    rollbackAvailable: true,
                    blueEnvironment: this.blueEnvironment,
                    greenEnvironment: this.greenEnvironment,
                    activeEnvironment: activeEnv,
                    trafficSwitched: true,
                    rollbackTriggered: true,
                    monitoringResults
                };
            }
            // 8. Deployment successful - update environment status
            this.updateEnvironmentStatus(targetEnv, 'active', newVersion, deploymentId);
            this.updateEnvironmentStatus(activeEnv, 'inactive', '', '');
            console.log(`✅ Blue-green deployment completed successfully!`);
            console.log(`🎯 ${targetEnv} environment is now active`);
            return {
                success: true,
                target,
                duration: Date.now() - startTime,
                deploymentId,
                timestamp: new Date(),
                services: deploymentResult.services,
                healthChecks,
                smokeTestResults,
                logs: deploymentResult.logs,
                rollbackAvailable: true,
                blueEnvironment: this.blueEnvironment,
                greenEnvironment: this.greenEnvironment,
                activeEnvironment: targetEnv,
                trafficSwitched: true,
                rollbackTriggered: false,
                monitoringResults
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown deployment error';
            console.error(`❌ Blue-green deployment failed: ${errorMessage}`);
            // Attempt cleanup of failed deployment
            await this.cleanupFailedDeployment(deploymentId);
            return {
                success: false,
                target,
                duration: Date.now() - startTime,
                deploymentId,
                timestamp: new Date(),
                services: [],
                healthChecks: [],
                logs: [`Deployment failed: ${errorMessage}`],
                error: errorMessage,
                rollbackAvailable: false,
                blueEnvironment: this.blueEnvironment,
                greenEnvironment: this.greenEnvironment,
                activeEnvironment: await this.getActiveEnvironment(),
                trafficSwitched: false,
                rollbackTriggered: false,
                monitoringResults: []
            };
        }
    }
    /**
     * Perform immediate rollback to previous environment
     */
    async rollback(reason = 'Manual rollback') {
        if (this.rollbackInProgress) {
            throw new Error('Rollback already in progress');
        }
        this.rollbackInProgress = true;
        try {
            console.log(`🔄 Starting blue-green rollback: ${reason}`);
            const activeEnv = await this.getActiveEnvironment();
            const previousEnv = activeEnv === 'blue' ? 'green' : 'blue';
            console.log(`📍 Current active: ${activeEnv}, rolling back to: ${previousEnv}`);
            // Verify previous environment is available
            const previousEnvHealth = await this.performEnvironmentHealthChecks(previousEnv, null);
            const unhealthyServices = previousEnvHealth.filter(hc => hc.status !== 'healthy');
            if (unhealthyServices.length > 0) {
                // Try to restart previous environment
                console.log(`🔧 Previous environment unhealthy, attempting restart...`);
                await this.restartEnvironment(previousEnv);
                // Re-check health
                const recheckHealth = await this.performEnvironmentHealthChecks(previousEnv, null);
                const stillUnhealthy = recheckHealth.filter(hc => hc.status !== 'healthy');
                if (stillUnhealthy.length > 0) {
                    throw new Error(`Cannot rollback: previous environment (${previousEnv}) is unhealthy`);
                }
            }
            // Switch traffic back
            const rollbackSwitch = await this.switchTraffic(activeEnv, previousEnv);
            if (!rollbackSwitch.success) {
                throw new Error(`Rollback traffic switch failed: ${rollbackSwitch.error}`);
            }
            // Update environment status
            this.updateEnvironmentStatus(previousEnv, 'active', '', '');
            this.updateEnvironmentStatus(activeEnv, 'inactive', '', '');
            console.log(`✅ Rollback completed successfully`);
            console.log(`📍 ${previousEnv} environment is now active`);
        }
        finally {
            this.rollbackInProgress = false;
        }
    }
    /**
     * Get current environment status
     */
    getEnvironmentStatus() {
        return {
            blue: { ...this.blueEnvironment },
            green: { ...this.greenEnvironment }
        };
    }
    /**
     * Get active environment
     */
    async getActiveEnvironment() {
        // Check load balancer configuration to determine active environment
        try {
            const lbConfig = await this.readLoadBalancerConfig();
            // Parse configuration to determine which environment is receiving traffic
            if (lbConfig.includes('blue') && !lbConfig.includes('green')) {
                return 'blue';
            }
            else if (lbConfig.includes('green') && !lbConfig.includes('blue')) {
                return 'green';
            }
            else {
                // Default to blue if unclear
                console.warn('Unable to determine active environment from load balancer config, defaulting to blue');
                return 'blue';
            }
        }
        catch (error) {
            console.warn('Failed to read load balancer config, defaulting to blue:', error);
            return 'blue';
        }
    }
    // Private helper methods
    createEnvironment(name) {
        return {
            name,
            status: 'inactive',
            version: '',
            deploymentId: '',
            timestamp: new Date(),
            services: [],
            healthStatus: 'unknown',
            lastHealthCheck: new Date()
        };
    }
    async deployToEnvironment(environment, target, version, artifacts) {
        const logs = [];
        const services = [];
        try {
            // Create environment-specific docker-compose file
            const envComposeFile = await this.createEnvironmentComposeFile(environment, target);
            logs.push(`Created ${environment} environment compose file: ${envComposeFile}`);
            // Deploy services to specific environment
            const deployCommand = `docker-compose -f ${envComposeFile} up -d`;
            console.log(`🚀 Executing: ${deployCommand}`);
            const deployResult = await this.executeCommand(deployCommand, this.projectRoot);
            logs.push(`Deploy command output: ${deployResult.output}`);
            if (deployResult.exitCode !== 0) {
                return {
                    success: false,
                    services,
                    logs,
                    error: deployResult.error
                };
            }
            // Update environment status
            this.updateEnvironmentStatus(environment, 'deploying', version, `deploy-${Date.now()}`);
            // Create service entries
            for (const serviceConfig of target.config.services) {
                services.push({
                    serviceName: `${serviceConfig.name}-${environment}`,
                    status: 'deployed',
                    duration: 0,
                    healthCheckPassed: false
                });
            }
            return { success: true, services, logs };
        }
        catch (error) {
            return {
                success: false,
                services,
                logs,
                error: error instanceof Error ? error.message : 'Unknown deployment error'
            };
        }
    }
    async createEnvironmentComposeFile(environment, target) {
        const baseComposeFile = path.join(this.projectRoot, target.config.dockerCompose);
        const envComposeFile = path.join(this.projectRoot, `docker-compose.${environment}.yml`);
        try {
            // Read base compose file
            const baseContent = fs.readFileSync(baseComposeFile, 'utf8');
            // Modify service names and ports for environment isolation
            let envContent = baseContent;
            // Replace service names with environment-specific names
            const serviceNameReplacements = [
                { from: 'backend:', to: `backend-${environment}:` },
                { from: 'frontend:', to: `frontend-${environment}:` },
                { from: 'postgres:', to: `postgres-${environment}:` },

                { from: 'redis:', to: `redis-${environment}:` }
            ];
            for (const replacement of serviceNameReplacements) {
                envContent = envContent.replace(new RegExp(replacement.from, 'g'), replacement.to);
            }
            // Adjust ports to avoid conflicts
            const portOffset = environment === 'blue' ? 0 : 100;
            const portReplacements = [
                { from: '"3000:3000"', to: `"${3000 + portOffset}:3000"` },
                { from: '"3001:3001"', to: `"${3001 + portOffset}:3001"` },
                { from: '"5432:5432"', to: `"${5432 + portOffset}:5432"` },

                { from: '"6379:6379"', to: `"${6379 + portOffset}:6379"` }
            ];
            for (const replacement of portReplacements) {
                envContent = envContent.replace(new RegExp(replacement.from, 'g'), replacement.to);
            }
            // Add environment-specific labels
            envContent += `\n# Environment: ${environment}\n`;
            envContent += `# Generated: ${new Date().toISOString()}\n`;
            // Write environment-specific compose file
            fs.writeFileSync(envComposeFile, envContent);
            return envComposeFile;
        }
        catch (error) {
            throw new Error(`Failed to create ${environment} compose file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async performEnvironmentHealthChecks(environment, target) {
        const results = [];
        const portOffset = environment === 'blue' ? 0 : 100;
        // Default health check endpoints if no target provided
        const defaultEndpoints = [
            { service: 'backend', port: 3001 + portOffset, path: '/api/health' },
            { service: 'frontend', port: 3000 + portOffset, path: '/' },

        ];
        const endpoints = target ?
            target.config.services.map(s => ({
                service: s.name,
                port: this.extractPortFromHealthCheck(s.healthCheck.endpoint) + portOffset,
                path: this.extractPathFromHealthCheck(s.healthCheck.endpoint)
            })) :
            defaultEndpoints;
        for (const endpoint of endpoints) {
            const startTime = Date.now();
            const url = `http://localhost:${endpoint.port}${endpoint.path}`;
            try {
                const healthResult = await this.checkServiceHealth(`${endpoint.service}-${environment}`, url, 30, // timeout
                3 // retries
                );
                results.push({
                    service: `${endpoint.service}-${environment}`,
                    url,
                    status: healthResult.status,
                    responseTime: Date.now() - startTime,
                    timestamp: new Date(),
                    error: healthResult.error
                });
            }
            catch (error) {
                results.push({
                    service: `${endpoint.service}-${environment}`,
                    url,
                    status: 'unhealthy',
                    responseTime: Date.now() - startTime,
                    timestamp: new Date(),
                    error: error instanceof Error ? error.message : 'Unknown health check error'
                });
            }
        }
        // Update environment health status
        const env = environment === 'blue' ? this.blueEnvironment : this.greenEnvironment;
        const healthyCount = results.filter(r => r.status === 'healthy').length;
        env.healthStatus = healthyCount === results.length ? 'healthy' : 'unhealthy';
        env.lastHealthCheck = new Date();
        return results;
    }
    async runSmokeTests(environment) {
        const startTime = new Date();
        const portOffset = environment === 'blue' ? 0 : 100;
        try {
            // Set environment variables for smoke tests
            const testEnv = {
                ...process.env,
                FRONTEND_URL: `http://localhost:${3000 + portOffset}`,
                BACKEND_URL: `http://localhost:${3001 + portOffset}`,
                TEST_ENVIRONMENT: environment
            };
            const result = await this.executeCommand(this.config.smokeTests.command, this.projectRoot, testEnv);
            const endTime = new Date();
            const passed = result.exitCode === 0 ? 1 : 0;
            const failed = result.exitCode === 0 ? 0 : 1;
            return {
                type: 'e2e',
                passed,
                failed,
                skipped: 0,
                duration: endTime.getTime() - startTime.getTime(),
                artifacts: [],
                exitCode: result.exitCode,
                output: result.output,
                error: result.error,
                startTime,
                endTime
            };
        }
        catch (error) {
            const endTime = new Date();
            return {
                type: 'e2e',
                passed: 0,
                failed: 1,
                skipped: 0,
                duration: endTime.getTime() - startTime.getTime(),
                artifacts: [],
                exitCode: 1,
                output: '',
                error: error instanceof Error ? error.message : 'Unknown smoke test error',
                startTime,
                endTime
            };
        }
    }
    async switchTraffic(fromEnvironment, toEnvironment) {
        const startTime = Date.now();
        try {
            console.log(`🔀 Switching traffic from ${fromEnvironment} to ${toEnvironment}...`);
            // Update load balancer configuration
            await this.updateLoadBalancerConfig(toEnvironment);
            // Reload load balancer
            const reloadResult = await this.executeCommand(this.config.loadBalancer.reloadCommand, this.projectRoot);
            if (reloadResult.exitCode !== 0) {
                throw new Error(`Load balancer reload failed: ${reloadResult.error}`);
            }
            // Verify traffic switch
            await this.verifyTrafficSwitch(toEnvironment);
            console.log(`✅ Traffic successfully switched to ${toEnvironment}`);
            return {
                success: true,
                fromEnvironment,
                toEnvironment,
                timestamp: new Date(),
                duration: Date.now() - startTime
            };
        }
        catch (error) {
            console.error(`❌ Traffic switch failed: ${error}`);
            return {
                success: false,
                fromEnvironment,
                toEnvironment,
                timestamp: new Date(),
                duration: Date.now() - startTime,
                error: error instanceof Error ? error.message : 'Unknown traffic switch error'
            };
        }
    }
    async updateLoadBalancerConfig(activeEnvironment) {
        const configPath = this.config.loadBalancer.configPath;
        const portOffset = activeEnvironment === 'blue' ? 0 : 100;
        try {
            // Read current configuration
            const currentConfig = fs.readFileSync(configPath, 'utf8');
            // Generate new upstream configuration
            const newUpstream = this.config.loadBalancer.upstreamTemplate
                .replace('{{BACKEND_PORT}}', (3001 + portOffset).toString())
                .replace('{{FRONTEND_PORT}}', (3000 + portOffset).toString())
                .replace('{{ENVIRONMENT}}', activeEnvironment);
            // Replace upstream configuration
            const updatedConfig = currentConfig.replace(/upstream\s+\w+\s*{[^}]*}/g, newUpstream);
            // Write updated configuration
            fs.writeFileSync(configPath, updatedConfig);
            console.log(`📝 Updated load balancer config for ${activeEnvironment} environment`);
        }
        catch (error) {
            throw new Error(`Failed to update load balancer config: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async verifyTrafficSwitch(environment) {
        const portOffset = environment === 'blue' ? 0 : 100;
        const expectedBackendUrl = `http://localhost:${3001 + portOffset}`;
        try {
            // Make request through load balancer
            const lbResult = await this.executeCommand(`curl -f ${this.config.loadBalancer.healthCheckEndpoint}`, this.projectRoot);
            if (lbResult.exitCode !== 0) {
                throw new Error(`Load balancer health check failed: ${lbResult.error}`);
            }
            // Verify we're hitting the correct environment
            // This is a simplified check - in practice, you'd check response headers or content
            console.log(`✅ Traffic switch verification passed for ${environment}`);
        }
        catch (error) {
            throw new Error(`Traffic switch verification failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async startPostDeploymentMonitoring(environment) {
        const results = [];
        const monitoringDuration = this.config.monitoring.monitoringDuration * 1000; // Convert to ms
        const checkInterval = this.config.monitoring.checkInterval * 1000; // Convert to ms
        const startTime = Date.now();
        console.log(`📊 Starting ${this.config.monitoring.monitoringDuration}s monitoring of ${environment} environment...`);
        while (Date.now() - startTime < monitoringDuration) {
            try {
                const monitoringResult = await this.collectMonitoringMetrics(environment);
                results.push(monitoringResult);
                // Log monitoring status
                console.log(`📈 Monitoring: Error rate: ${monitoringResult.errorRate}%, Avg response: ${monitoringResult.averageResponseTime}ms`);
                // Check for alerts
                if (monitoringResult.alerts.length > 0) {
                    console.warn(`⚠️  Monitoring alerts: ${monitoringResult.alerts.join(', ')}`);
                }
                await this.sleep(checkInterval);
            }
            catch (error) {
                console.warn(`⚠️  Monitoring check failed: ${error}`);
                results.push({
                    timestamp: new Date(),
                    errorRate: 100, // Assume 100% error rate if monitoring fails
                    averageResponseTime: this.config.monitoring.responseTimeThreshold + 1,
                    healthyServices: 0,
                    totalServices: 1,
                    alerts: ['Monitoring check failed']
                });
            }
        }
        console.log(`📊 Monitoring completed with ${results.length} data points`);
        return results;
    }
    async collectMonitoringMetrics(environment) {
        const portOffset = environment === 'blue' ? 0 : 100;
        const backendUrl = `http://localhost:${3001 + portOffset}`;
        // Simulate metrics collection - in practice, this would integrate with monitoring tools
        const startTime = Date.now();
        try {
            // Make test requests to measure response time and error rate
            const testRequests = 5;
            let successfulRequests = 0;
            let totalResponseTime = 0;
            for (let i = 0; i < testRequests; i++) {
                try {
                    const requestStart = Date.now();
                    const result = await this.executeCommand(`curl -f --max-time 5 ${backendUrl}/api/health`, this.projectRoot);
                    if (result.exitCode === 0) {
                        successfulRequests++;
                        totalResponseTime += Date.now() - requestStart;
                    }
                }
                catch (error) {
                    // Request failed, counted as error
                }
            }
            const errorRate = ((testRequests - successfulRequests) / testRequests) * 100;
            const averageResponseTime = successfulRequests > 0 ? totalResponseTime / successfulRequests : 0;
            // Check health of services
            const healthChecks = await this.performEnvironmentHealthChecks(environment, null);
            const healthyServices = healthChecks.filter(hc => hc.status === 'healthy').length;
            // Generate alerts based on thresholds
            const alerts = [];
            if (errorRate > this.config.monitoring.errorRateThreshold) {
                alerts.push(`High error rate: ${errorRate}% (threshold: ${this.config.monitoring.errorRateThreshold}%)`);
            }
            if (averageResponseTime > this.config.monitoring.responseTimeThreshold) {
                alerts.push(`High response time: ${averageResponseTime}ms (threshold: ${this.config.monitoring.responseTimeThreshold}ms)`);
            }
            if (healthyServices < healthChecks.length) {
                alerts.push(`Unhealthy services: ${healthChecks.length - healthyServices}/${healthChecks.length}`);
            }
            return {
                timestamp: new Date(),
                errorRate,
                averageResponseTime,
                healthyServices,
                totalServices: healthChecks.length,
                alerts
            };
        }
        catch (error) {
            return {
                timestamp: new Date(),
                errorRate: 100,
                averageResponseTime: this.config.monitoring.responseTimeThreshold + 1,
                healthyServices: 0,
                totalServices: 1,
                alerts: [`Monitoring failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
            };
        }
    }
    async checkRollbackTriggers(monitoringResults) {
        if (monitoringResults.length === 0) {
            return false;
        }
        for (const trigger of this.config.rollbackTriggers) {
            if (!trigger.enabled) {
                continue;
            }
            const relevantResults = monitoringResults.slice(-Math.ceil(trigger.duration / this.config.monitoring.checkInterval));
            switch (trigger.type) {
                case 'error_rate':
                    const avgErrorRate = relevantResults.reduce((sum, r) => sum + r.errorRate, 0) / relevantResults.length;
                    if (avgErrorRate > trigger.threshold) {
                        console.log(`🚨 Rollback trigger: Error rate ${avgErrorRate}% exceeds threshold ${trigger.threshold}%`);
                        return true;
                    }
                    break;
                case 'response_time':
                    const avgResponseTime = relevantResults.reduce((sum, r) => sum + r.averageResponseTime, 0) / relevantResults.length;
                    if (avgResponseTime > trigger.threshold) {
                        console.log(`🚨 Rollback trigger: Response time ${avgResponseTime}ms exceeds threshold ${trigger.threshold}ms`);
                        return true;
                    }
                    break;
                case 'health_check':
                    const unhealthyCount = relevantResults.filter(r => r.healthyServices < r.totalServices).length;
                    const unhealthyPercentage = (unhealthyCount / relevantResults.length) * 100;
                    if (unhealthyPercentage > trigger.threshold) {
                        console.log(`🚨 Rollback trigger: Health check failures ${unhealthyPercentage}% exceeds threshold ${trigger.threshold}%`);
                        return true;
                    }
                    break;
            }
        }
        return false;
    }
    async performAutomaticRollback(currentEnvironment, previousEnvironment) {
        console.log(`🔄 Performing automatic rollback from ${currentEnvironment} to ${previousEnvironment}...`);
        try {
            // Switch traffic back
            const rollbackSwitch = await this.switchTraffic(currentEnvironment, previousEnvironment);
            if (!rollbackSwitch.success) {
                throw new Error(`Automatic rollback traffic switch failed: ${rollbackSwitch.error}`);
            }
            // Update environment status
            this.updateEnvironmentStatus(previousEnvironment, 'active', '', '');
            this.updateEnvironmentStatus(currentEnvironment, 'failed', '', '');
            // Send alert if configured
            if (this.config.monitoring.alertWebhook) {
                await this.sendAlert(`Automatic rollback performed: ${currentEnvironment} -> ${previousEnvironment}`);
            }
            console.log(`✅ Automatic rollback completed successfully`);
        }
        catch (error) {
            console.error(`❌ Automatic rollback failed: ${error}`);
            throw error;
        }
    }
    async restartEnvironment(environment) {
        console.log(`🔄 Restarting ${environment} environment...`);
        const composeFile = `docker-compose.${environment}.yml`;
        try {
            // Stop environment
            await this.executeCommand(`docker-compose -f ${composeFile} down`, this.projectRoot);
            // Start environment
            const startResult = await this.executeCommand(`docker-compose -f ${composeFile} up -d`, this.projectRoot);
            if (startResult.exitCode !== 0) {
                throw new Error(`Failed to restart ${environment}: ${startResult.error}`);
            }
            // Wait for services to be ready
            await this.sleep(10000); // Wait 10 seconds for services to start
            console.log(`✅ ${environment} environment restarted successfully`);
        }
        catch (error) {
            throw new Error(`Failed to restart ${environment} environment: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    async cleanupFailedDeployment(deploymentId) {
        console.log(`🧹 Cleaning up failed deployment: ${deploymentId}`);
        try {
            // Stop any running containers from failed deployment
            const cleanupCommands = [
                'docker-compose -f docker-compose.blue.yml down',
                'docker-compose -f docker-compose.green.yml down'
            ];
            for (const command of cleanupCommands) {
                try {
                    await this.executeCommand(command, this.projectRoot);
                }
                catch (error) {
                    console.warn(`Cleanup command failed (non-critical): ${command}`);
                }
            }
            console.log(`✅ Cleanup completed for deployment: ${deploymentId}`);
        }
        catch (error) {
            console.warn(`⚠️  Cleanup failed for deployment ${deploymentId}: ${error}`);
        }
    }
    updateEnvironmentStatus(environment, status, version, deploymentId) {
        const env = environment === 'blue' ? this.blueEnvironment : this.greenEnvironment;
        env.status = status;
        env.version = version;
        env.deploymentId = deploymentId;
        env.timestamp = new Date();
    }
    async readLoadBalancerConfig() {
        try {
            return fs.readFileSync(this.config.loadBalancer.configPath, 'utf8');
        }
        catch (error) {
            throw new Error(`Failed to read load balancer config: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    extractPortFromHealthCheck(endpoint) {
        const match = endpoint.match(/:(\d+)/);
        return match ? parseInt(match[1], 10) : 3001; // Default to 3001
    }
    extractPathFromHealthCheck(endpoint) {
        const match = endpoint.match(/https?:\/\/[^\/]+(\/.*)/);
        return match ? match[1] : '/'; // Default to root path
    }
    async checkServiceHealth(serviceName, endpoint, timeout, retries) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                const result = await this.executeCommand(`curl -f --max-time ${timeout} ${endpoint}`, this.projectRoot);
                if (result.exitCode === 0) {
                    return { status: 'healthy' };
                }
                if (attempt < retries) {
                    await this.sleep(2000); // Wait 2 seconds between retries
                }
            }
            catch (error) {
                if (attempt === retries) {
                    return {
                        status: 'unhealthy',
                        error: error instanceof Error ? error.message : 'Unknown health check error'
                    };
                }
                await this.sleep(2000);
            }
        }
        return { status: 'timeout', error: `Health check timed out after ${retries} attempts` };
    }
    async sendAlert(message) {
        if (!this.config.monitoring.alertWebhook) {
            return;
        }
        try {
            const alertPayload = {
                text: message,
                timestamp: new Date().toISOString(),
                service: 'blue-green-deployment'
            };
            await this.executeCommand(`curl -X POST -H "Content-Type: application/json" -d '${JSON.stringify(alertPayload)}' ${this.config.monitoring.alertWebhook}`, this.projectRoot);
            console.log(`📢 Alert sent: ${message}`);
        }
        catch (error) {
            console.warn(`⚠️  Failed to send alert: ${error}`);
        }
    }
    async executeCommand(command, cwd, env) {
        return new Promise((resolve) => {
            const childProcess = spawn('sh', ['-c', command], {
                cwd,
                env: env || process.env,
                stdio: ['pipe', 'pipe', 'pipe']
            });
            let output = '';
            let errorOutput = '';
            childProcess.stdout?.on('data', (data) => {
                output += data.toString();
            });
            childProcess.stderr?.on('data', (data) => {
                errorOutput += data.toString();
            });
            childProcess.on('close', (code) => {
                resolve({
                    exitCode: code || 0,
                    output,
                    error: errorOutput || undefined
                });
            });
            childProcess.on('error', (error) => {
                resolve({
                    exitCode: 1,
                    output,
                    error: error.message
                });
            });
        });
    }
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    findProjectRoot() {
        let currentDir = process.cwd();
        while (currentDir !== path.dirname(currentDir)) {
            if (fs.existsSync(path.join(currentDir, 'package.json'))) {
                return currentDir;
            }
            currentDir = path.dirname(currentDir);
        }
        return process.cwd();
    }
    /**
     * Clean up monitoring processes
     */
    cleanup() {
        console.log('🧹 Cleaning up blue-green deployment processes...');
        if (this.monitoringProcess) {
            try {
                this.monitoringProcess.kill('SIGTERM');
                console.log('Terminated monitoring process');
            }
            catch (error) {
                console.warn('Failed to terminate monitoring process:', error);
            }
        }
    }
}
export default BlueGreenDeployment;
