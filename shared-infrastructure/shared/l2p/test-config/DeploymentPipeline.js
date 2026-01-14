/**
 * Deployment Pipeline with Quality Gates
 * Provides automated deployment with comprehensive testing validation,
 * build process management, and rollback capabilities
 */
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { TestRunner } from './TestRunner';
import { TestConfigManager } from './TestConfigManager';
export class DeploymentPipeline {
    constructor(configPath) {
        this.deploymentHistory = new Map();
        this.runningProcesses = new Map();
        this.testRunner = new TestRunner(configPath);
        this.configManager = TestConfigManager.getInstance(configPath);
        this.projectRoot = this.findProjectRoot();
    }
    /**
     * Run complete pre-deployment validation including full test suite
     */
    async validate(target) {
        console.log('🔍 Starting pre-deployment validation...\n');
        const errors = [];
        const warnings = [];
        try {
            // 1. Validate configuration
            console.log('📋 Validating deployment configuration...');
            const configValidation = await this.validateConfiguration(target);
            errors.push(...configValidation.errors);
            warnings.push(...configValidation.warnings);
            // 2. Validate environment
            console.log('🌍 Validating environment setup...');
            const envValidation = await this.validateEnvironment();
            errors.push(...envValidation.errors);
            warnings.push(...envValidation.warnings);
            // 3. Validate dependencies
            console.log('📦 Validating dependencies...');
            const depValidation = await this.validateDependencies();
            errors.push(...depValidation.errors);
            warnings.push(...depValidation.warnings);
            // 4. Run complete test suite
            console.log('🧪 Running complete test suite...');
            const testResults = await this.runCompleteTestSuite();
            // Check if any tests failed
            const failedTests = testResults.filter(result => result.failed > 0);
            if (failedTests.length > 0) {
                for (const result of failedTests) {
                    errors.push({
                        type: 'dependency',
                        message: `${result.type} tests failed: ${result.failed} failures`,
                        details: {
                            testType: result.type,
                            failures: result.failed,
                            output: result.output,
                            error: result.error
                        }
                    });
                }
            }
            // 5. Security validation
            console.log('🔒 Running security validation...');
            const securityValidation = await this.validateSecurity();
            errors.push(...securityValidation.errors);
            warnings.push(...securityValidation.warnings);
            const isValid = errors.length === 0;
            if (isValid) {
                console.log('✅ Pre-deployment validation passed');
            }
            else {
                console.log(`❌ Pre-deployment validation failed with ${errors.length} errors`);
                errors.forEach(error => console.log(`   - ${error.message}`));
            }
            if (warnings.length > 0) {
                console.log(`⚠️  ${warnings.length} warnings found:`);
                warnings.forEach(warning => console.log(`   - ${warning}`));
            }
            return {
                isValid,
                errors,
                warnings
            };
        }
        catch (error) {
            console.error('❌ Validation failed with exception:', error);
            errors.push({
                type: 'configuration',
                message: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                details: error
            });
            return {
                isValid: false,
                errors,
                warnings
            };
        }
    }
    /**
     * Build application with proper error handling and logging
     */
    async build(options = {}) {
        const startTime = Date.now();
        const buildId = `build-${Date.now()}`;
        const timestamp = new Date();
        console.log(`🔨 Starting build process (ID: ${buildId})...\n`);
        const logs = [];
        const artifacts = [];
        try {
            if (options.skipBuild) {
                console.log('⏭️  Skipping build (skipBuild option enabled)');
                return {
                    success: true,
                    duration: 0,
                    artifacts: [],
                    logs: ['Build skipped'],
                    buildId,
                    timestamp
                };
            }
            // 1. Clean previous builds
            console.log('🧹 Cleaning previous builds...');
            await this.cleanPreviousBuilds();
            logs.push('Previous builds cleaned');
            // 2. Install dependencies
            console.log('📦 Installing dependencies...');
            const depResult = await this.installDependencies();
            logs.push(...depResult.logs);
            if (!depResult.success) {
                throw new Error(`Dependency installation failed: ${depResult.error}`);
            }
            // 3. Build frontend
            console.log('🎨 Building frontend...');
            const frontendResult = await this.buildProject('frontend');
            logs.push(...frontendResult.logs);
            artifacts.push(...frontendResult.artifacts);
            if (!frontendResult.success) {
                throw new Error(`Frontend build failed: ${frontendResult.error}`);
            }
            // 4. Build backend
            console.log('⚙️  Building backend...');
            const backendResult = await this.buildProject('backend');
            logs.push(...backendResult.logs);
            artifacts.push(...backendResult.artifacts);
            if (!backendResult.success) {
                throw new Error(`Backend build failed: ${backendResult.error}`);
            }
            // 5. Build Docker images
            console.log('🐳 Building Docker images...');
            const dockerResult = await this.buildDockerImages();
            logs.push(...dockerResult.logs);
            artifacts.push(...dockerResult.artifacts);
            if (!dockerResult.success) {
                throw new Error(`Docker build failed: ${dockerResult.error}`);
            }
            // 6. Validate build artifacts
            console.log('✅ Validating build artifacts...');
            const validationResult = await this.validateBuildArtifacts(artifacts);
            logs.push(...validationResult.logs);
            if (!validationResult.success) {
                throw new Error(`Build artifact validation failed: ${validationResult.error}`);
            }
            const duration = Date.now() - startTime;
            console.log(`✅ Build completed successfully in ${duration}ms`);
            console.log(`📦 Generated ${artifacts.length} artifacts`);
            return {
                success: true,
                duration,
                artifacts,
                logs,
                buildId,
                timestamp
            };
        }
        catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : 'Unknown build error';
            console.error(`❌ Build failed after ${duration}ms:`, errorMessage);
            logs.push(`Build failed: ${errorMessage}`);
            return {
                success: false,
                duration,
                artifacts,
                logs,
                error: errorMessage,
                buildId,
                timestamp
            };
        }
    }
    /**
     * Deploy to specified target with health checks and rollback capability
     */
    async deploy(target, options = {}) {
        const startTime = Date.now();
        const deploymentId = `deploy-${target.name}-${Date.now()}`;
        const timestamp = new Date();
        console.log(`🚀 Starting deployment to ${target.name} (ID: ${deploymentId})...\n`);
        const logs = [];
        const services = [];
        const healthChecks = [];
        try {
            if (options.dryRun) {
                console.log('🔍 Dry run mode - no actual deployment will occur');
                logs.push('Dry run mode enabled');
            }
            // 1. Pre-deployment validation
            if (!options.skipTests) {
                console.log('🔍 Running pre-deployment validation...');
                const validation = await this.validate(target);
                if (!validation.isValid) {
                    throw new Error(`Pre-deployment validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
                }
                logs.push('Pre-deployment validation passed');
            }
            // 2. Build if not skipped
            if (!options.skipBuild) {
                console.log('🔨 Building application...');
                const buildResult = await this.build(options);
                if (!buildResult.success) {
                    throw new Error(`Build failed: ${buildResult.error}`);
                }
                logs.push(`Build completed (${buildResult.artifacts.length} artifacts)`);
            }
            // 3. Run pre-deployment hooks
            console.log('🪝 Running pre-deployment hooks...');
            if (target.config.preDeploymentHooks) {
                for (const hook of target.config.preDeploymentHooks) {
                    const hookResult = await this.executeHook(hook, 'pre-deployment');
                    logs.push(`Pre-deployment hook executed: ${hook}`);
                    if (!hookResult.success) {
                        throw new Error(`Pre-deployment hook failed: ${hook} - ${hookResult.error}`);
                    }
                }
            }
            if (options.dryRun) {
                console.log('✅ Dry run completed successfully');
                return {
                    success: true,
                    target,
                    duration: Date.now() - startTime,
                    deploymentId,
                    timestamp,
                    services: [],
                    healthChecks: [],
                    logs: [...logs, 'Dry run completed'],
                    rollbackAvailable: false
                };
            }
            // 4. Deploy services
            console.log('🚀 Deploying services...');
            const deploymentResult = await this.deployServices(target);
            services.push(...deploymentResult.services);
            logs.push(...deploymentResult.logs);
            if (!deploymentResult.success) {
                throw new Error(`Service deployment failed: ${deploymentResult.error}`);
            }
            // 5. Wait for services to be healthy
            console.log('🏥 Performing health checks...');
            const healthCheckResults = await this.performHealthChecks(target);
            healthChecks.push(...healthCheckResults);
            const unhealthyServices = healthCheckResults.filter(hc => hc.status !== 'healthy');
            if (unhealthyServices.length > 0) {
                throw new Error(`Health checks failed for services: ${unhealthyServices.map(s => s.service).join(', ')}`);
            }
            // 6. Run smoke tests
            let smokeTestResults;
            if (target.config.smokeTestCommand) {
                console.log('💨 Running smoke tests...');
                smokeTestResults = await this.runSmokeTests(target);
                if (smokeTestResults.failed > 0) {
                    throw new Error(`Smoke tests failed: ${smokeTestResults.failed} failures`);
                }
                logs.push('Smoke tests passed');
            }
            // 7. Run post-deployment hooks
            console.log('🪝 Running post-deployment hooks...');
            if (target.config.postDeploymentHooks) {
                for (const hook of target.config.postDeploymentHooks) {
                    const hookResult = await this.executeHook(hook, 'post-deployment');
                    logs.push(`Post-deployment hook executed: ${hook}`);
                    if (!hookResult.success) {
                        console.warn(`Post-deployment hook failed (non-critical): ${hook} - ${hookResult.error}`);
                    }
                }
            }
            const duration = Date.now() - startTime;
            const result = {
                success: true,
                target,
                duration,
                deploymentId,
                timestamp,
                services,
                healthChecks,
                smokeTestResults,
                logs,
                rollbackAvailable: true
            };
            // Store deployment in history
            this.deploymentHistory.set(deploymentId, result);
            console.log(`✅ Deployment to ${target.name} completed successfully in ${duration}ms`);
            console.log(`🆔 Deployment ID: ${deploymentId}`);
            return result;
        }
        catch (error) {
            const duration = Date.now() - startTime;
            const errorMessage = error instanceof Error ? error.message : 'Unknown deployment error';
            console.error(`❌ Deployment to ${target.name} failed after ${duration}ms:`, errorMessage);
            // Attempt automatic rollback if deployment partially succeeded
            let rollbackAvailable = false;
            if (services.some(s => s.status === 'deployed')) {
                console.log('🔄 Attempting automatic rollback...');
                try {
                    await this.rollback(target, { reason: `Deployment failed: ${errorMessage}` });
                    rollbackAvailable = true;
                    logs.push('Automatic rollback completed');
                }
                catch (rollbackError) {
                    console.error('❌ Automatic rollback failed:', rollbackError);
                    logs.push(`Automatic rollback failed: ${rollbackError instanceof Error ? rollbackError.message : 'Unknown error'}`);
                }
            }
            const result = {
                success: false,
                target,
                duration,
                deploymentId,
                timestamp,
                services,
                healthChecks,
                logs,
                error: errorMessage,
                rollbackAvailable
            };
            // Store failed deployment in history
            this.deploymentHistory.set(deploymentId, result);
            return result;
        }
    }
    /**
     * Rollback failed deployment
     */
    async rollback(target, rollbackInfo) {
        console.log(`🔄 Starting rollback for ${target.name}...`);
        const reason = rollbackInfo?.reason || 'Manual rollback requested';
        console.log(`📝 Rollback reason: ${reason}`);
        try {
            // 1. Find previous successful deployment
            const previousDeployment = this.findPreviousSuccessfulDeployment(target);
            if (!previousDeployment) {
                throw new Error('No previous successful deployment found for rollback');
            }
            console.log(`🔍 Rolling back to deployment: ${previousDeployment.deploymentId}`);
            // 2. Execute rollback command if configured
            if (target.config.rollbackCommand) {
                console.log('⚙️  Executing rollback command...');
                const rollbackResult = await this.executeCommand(target.config.rollbackCommand, this.projectRoot);
                if (rollbackResult.exitCode !== 0) {
                    throw new Error(`Rollback command failed: ${rollbackResult.error}`);
                }
            }
            else {
                // 3. Default rollback: redeploy previous version
                console.log('🔄 Performing default rollback (redeploy previous version)...');
                // Stop current services
                await this.stopServices(target);
                // Start previous version services
                await this.deployServices(target, previousDeployment.deploymentId);
                // Verify health
                const healthChecks = await this.performHealthChecks(target);
                const unhealthyServices = healthChecks.filter(hc => hc.status !== 'healthy');
                if (unhealthyServices.length > 0) {
                    throw new Error(`Rollback health checks failed for: ${unhealthyServices.map(s => s.service).join(', ')}`);
                }
            }
            console.log(`✅ Rollback to ${target.name} completed successfully`);
            // Record rollback in history
            const rollbackRecord = {
                deploymentId: rollbackInfo?.deploymentId || `rollback-${Date.now()}`,
                target,
                timestamp: new Date(),
                reason,
                previousVersion: previousDeployment.deploymentId
            };
            console.log(`📝 Rollback recorded: ${JSON.stringify(rollbackRecord, null, 2)}`);
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown rollback error';
            console.error(`❌ Rollback failed: ${errorMessage}`);
            throw error;
        }
    }
    /**
     * Get deployment history
     */
    getDeploymentHistory() {
        return Array.from(this.deploymentHistory.values()).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }
    /**
     * Get deployment by ID
     */
    getDeployment(deploymentId) {
        return this.deploymentHistory.get(deploymentId);
    }
    // Private helper methods
    async validateConfiguration(target) {
        const errors = [];
        const warnings = [];
        try {
            // Validate Docker Compose files exist
            const dockerComposeFiles = ['docker-compose.yml', 'docker-compose.test.yml'];
            for (const file of dockerComposeFiles) {
                const filePath = path.join(this.projectRoot, file);
                if (!fs.existsSync(filePath)) {
                    errors.push({
                        type: 'configuration',
                        message: `Docker Compose file not found: ${file}`,
                        details: { path: filePath }
                    });
                }
            }
            // Validate target configuration if provided
            if (target) {
                if (!target.config.dockerCompose) {
                    errors.push({
                        type: 'configuration',
                        message: 'Docker Compose file not specified in target configuration'
                    });
                }
                if (!target.config.healthCheckUrl) {
                    errors.push({
                        type: 'configuration',
                        message: 'Health check URL not specified in target configuration'
                    });
                }
                // Validate service configurations
                for (const service of target.config.services) {
                    if (!service.name || !service.image) {
                        errors.push({
                            type: 'configuration',
                            message: `Invalid service configuration: ${service.name || 'unnamed service'}`,
                            details: service
                        });
                    }
                }
            }
            // Check for required environment variables
            const requiredEnvVars = ['NODE_ENV', 'DATABASE_URL'];
            for (const envVar of requiredEnvVars) {
                if (!process.env[envVar] && (!target || !target.config.environmentVariables[envVar])) {
                    warnings.push(`Environment variable ${envVar} not set`);
                }
            }
        }
        catch (error) {
            errors.push({
                type: 'configuration',
                message: `Configuration validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                details: error
            });
        }
        return { isValid: errors.length === 0, errors, warnings };
    }
    async validateEnvironment() {
        const errors = [];
        const warnings = [];
        try {
            // Check Docker availability
            const dockerResult = await this.executeCommand('docker --version', this.projectRoot);
            if (dockerResult.exitCode !== 0) {
                errors.push({
                    type: 'environment',
                    message: 'Docker is not available or not installed',
                    details: dockerResult.error
                });
            }
            // Check Docker Compose availability
            const composeResult = await this.executeCommand('docker-compose --version', this.projectRoot);
            if (composeResult.exitCode !== 0) {
                errors.push({
                    type: 'environment',
                    message: 'Docker Compose is not available or not installed',
                    details: composeResult.error
                });
            }
            // Check disk space
            const diskResult = await this.executeCommand('df -h .', this.projectRoot);
            if (diskResult.exitCode === 0) {
                // Parse disk usage (simplified)
                const lines = diskResult.output.split('\n');
                if (lines.length > 1) {
                    const usage = lines[1].split(/\s+/);
                    if (usage.length > 4) {
                        const usagePercent = parseInt(usage[4].replace('%', ''), 10);
                        if (usagePercent > 90) {
                            warnings.push(`Disk usage is high: ${usagePercent}%`);
                        }
                    }
                }
            }
        }
        catch (error) {
            errors.push({
                type: 'environment',
                message: `Environment validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                details: error
            });
        }
        return { isValid: errors.length === 0, errors, warnings };
    }
    async validateDependencies() {
        const errors = [];
        const warnings = [];
        try {
            // Check Node.js version
            const nodeResult = await this.executeCommand('node --version', this.projectRoot);
            if (nodeResult.exitCode !== 0) {
                errors.push({
                    type: 'dependency',
                    message: 'Node.js is not available',
                    details: nodeResult.error
                });
            }
            else {
                const nodeVersion = nodeResult.output.trim();
                console.log(`📦 Node.js version: ${nodeVersion}`);
            }
            // Check npm availability
            const npmResult = await this.executeCommand('npm --version', this.projectRoot);
            if (npmResult.exitCode !== 0) {
                errors.push({
                    type: 'dependency',
                    message: 'npm is not available',
                    details: npmResult.error
                });
            }
            // Validate package.json files
            const packageJsonFiles = [
                path.join(this.projectRoot, 'package.json'),
                path.join(this.projectRoot, 'frontend', 'package.json'),
                path.join(this.projectRoot, 'backend', 'package.json')
            ];
            for (const packageFile of packageJsonFiles) {
                if (!fs.existsSync(packageFile)) {
                    errors.push({
                        type: 'dependency',
                        message: `package.json not found: ${packageFile}`,
                        details: { path: packageFile }
                    });
                }
                else {
                    try {
                        const packageContent = JSON.parse(fs.readFileSync(packageFile, 'utf8'));
                        if (!packageContent.name || !packageContent.version) {
                            warnings.push(`Invalid package.json structure: ${packageFile}`);
                        }
                    }
                    catch (parseError) {
                        errors.push({
                            type: 'dependency',
                            message: `Invalid package.json format: ${packageFile}`,
                            details: parseError
                        });
                    }
                }
            }
        }
        catch (error) {
            errors.push({
                type: 'dependency',
                message: `Dependency validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                details: error
            });
        }
        return { isValid: errors.length === 0, errors, warnings };
    }
    async validateSecurity() {
        const errors = [];
        const warnings = [];
        try {
            // Check for common security issues
            const securityChecks = [
                {
                    name: 'Environment files',
                    check: () => {
                        const envFiles = ['.env', 'frontend/.env', 'backend/.env'];
                        for (const envFile of envFiles) {
                            const fullPath = path.join(this.projectRoot, envFile);
                            if (fs.existsSync(fullPath)) {
                                const content = fs.readFileSync(fullPath, 'utf8');
                                if (content.includes('password=') || content.includes('secret=')) {
                                    warnings.push(`Potential secrets in ${envFile} - ensure they are properly secured`);
                                }
                            }
                        }
                    }
                },
                {
                    name: 'Docker security',
                    check: () => {
                        const dockerFiles = ['Dockerfile', 'frontend/Dockerfile', 'backend/Dockerfile'];
                        for (const dockerFile of dockerFiles) {
                            const fullPath = path.join(this.projectRoot, dockerFile);
                            if (fs.existsSync(fullPath)) {
                                const content = fs.readFileSync(fullPath, 'utf8');
                                if (content.includes('USER root') || !content.includes('USER ')) {
                                    warnings.push(`${dockerFile} may be running as root - consider using non-root user`);
                                }
                            }
                        }
                    }
                }
            ];
            for (const check of securityChecks) {
                try {
                    check.check();
                }
                catch (error) {
                    warnings.push(`Security check '${check.name}' failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
        }
        catch (error) {
            errors.push({
                type: 'security',
                message: `Security validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                details: error
            });
        }
        return { isValid: errors.length === 0, errors, warnings };
    }
    async runCompleteTestSuite() {
        const testEnvironment = 'ci';
        try {
            const results = await this.testRunner.runAll({
                environment: testEnvironment,
                bail: true,
                collectCoverage: true,
                verbose: false
            });
            return results;
        }
        catch (error) {
            console.error('Test suite execution failed:', error);
            throw error;
        }
    }
    async cleanPreviousBuilds() {
        const buildDirs = [
            path.join(this.projectRoot, 'frontend', 'dist'),
            path.join(this.projectRoot, 'backend', 'dist'),
            path.join(this.projectRoot, 'frontend', 'build'),
            path.join(this.projectRoot, 'backend', 'build')
        ];
        for (const dir of buildDirs) {
            if (fs.existsSync(dir)) {
                await this.executeCommand(`rm -rf ${dir}`, this.projectRoot);
            }
        }
    }
    async installDependencies() {
        const logs = [];
        try {
            // Install root dependencies
            const rootResult = await this.executeCommand('npm ci', this.projectRoot);
            logs.push(`Root dependencies: ${rootResult.exitCode === 0 ? 'success' : 'failed'}`);
            if (rootResult.exitCode !== 0) {
                return { success: false, logs, error: rootResult.error };
            }
            // Install frontend dependencies
            const frontendResult = await this.executeCommand('npm ci', path.join(this.projectRoot, 'frontend'));
            logs.push(`Frontend dependencies: ${frontendResult.exitCode === 0 ? 'success' : 'failed'}`);
            if (frontendResult.exitCode !== 0) {
                return { success: false, logs, error: frontendResult.error };
            }
            // Install backend dependencies
            const backendResult = await this.executeCommand('npm ci', path.join(this.projectRoot, 'backend'));
            logs.push(`Backend dependencies: ${backendResult.exitCode === 0 ? 'success' : 'failed'}`);
            if (backendResult.exitCode !== 0) {
                return { success: false, logs, error: backendResult.error };
            }
            return { success: true, logs };
        }
        catch (error) {
            return {
                success: false,
                logs,
                error: error instanceof Error ? error.message : 'Unknown dependency installation error'
            };
        }
    }
    async buildProject(project) {
        const logs = [];
        const artifacts = [];
        const projectDir = path.join(this.projectRoot, project);
        try {
            const buildResult = await this.executeCommand('npm run build', projectDir);
            logs.push(`${project} build output: ${buildResult.output}`);
            if (buildResult.exitCode !== 0) {
                return { success: false, logs, artifacts, error: buildResult.error };
            }
            // Collect build artifacts
            const distDir = path.join(projectDir, 'dist');
            if (fs.existsSync(distDir)) {
                const files = this.getAllFiles(distDir);
                artifacts.push(...files);
            }
            const buildDir = path.join(projectDir, 'build');
            if (fs.existsSync(buildDir)) {
                const files = this.getAllFiles(buildDir);
                artifacts.push(...files);
            }
            return { success: true, logs, artifacts };
        }
        catch (error) {
            return {
                success: false,
                logs,
                artifacts,
                error: error instanceof Error ? error.message : `Unknown ${project} build error`
            };
        }
    }
    async buildDockerImages() {
        const logs = [];
        const artifacts = [];
        try {
            // Build frontend image
            const frontendResult = await this.executeCommand('docker build -t learn2play-frontend:latest -f frontend/Dockerfile frontend/', this.projectRoot);
            logs.push(`Frontend Docker build: ${frontendResult.exitCode === 0 ? 'success' : 'failed'}`);
            if (frontendResult.exitCode !== 0) {
                return { success: false, logs, artifacts, error: frontendResult.error };
            }
            // Build backend image
            const backendResult = await this.executeCommand('docker build -t learn2play-backend:latest -f backend/Dockerfile backend/', this.projectRoot);
            logs.push(`Backend Docker build: ${backendResult.exitCode === 0 ? 'success' : 'failed'}`);
            if (backendResult.exitCode !== 0) {
                return { success: false, logs, artifacts, error: backendResult.error };
            }
            // List built images as artifacts
            const imagesResult = await this.executeCommand('docker images learn2play-*', this.projectRoot);
            if (imagesResult.exitCode === 0) {
                artifacts.push('docker-images.txt');
                fs.writeFileSync(path.join(this.projectRoot, 'docker-images.txt'), imagesResult.output);
            }
            return { success: true, logs, artifacts };
        }
        catch (error) {
            return {
                success: false,
                logs,
                artifacts,
                error: error instanceof Error ? error.message : 'Unknown Docker build error'
            };
        }
    }
    async validateBuildArtifacts(artifacts) {
        const logs = [];
        try {
            // Check that essential artifacts exist
            const requiredArtifacts = [
                'frontend/dist/index.html',
                'backend/dist/server.js'
            ];
            for (const artifact of requiredArtifacts) {
                const fullPath = path.join(this.projectRoot, artifact);
                if (!fs.existsSync(fullPath)) {
                    return {
                        success: false,
                        logs,
                        error: `Required build artifact missing: ${artifact}`
                    };
                }
                logs.push(`Validated artifact: ${artifact}`);
            }
            // Check artifact sizes
            for (const artifact of artifacts) {
                if (fs.existsSync(artifact)) {
                    const stats = fs.statSync(artifact);
                    if (stats.size === 0) {
                        logs.push(`Warning: Empty artifact file: ${artifact}`);
                    }
                }
            }
            logs.push(`Validated ${artifacts.length} build artifacts`);
            return { success: true, logs };
        }
        catch (error) {
            return {
                success: false,
                logs,
                error: error instanceof Error ? error.message : 'Unknown artifact validation error'
            };
        }
    }
    async executeHook(hook, phase) {
        try {
            console.log(`🪝 Executing ${phase} hook: ${hook}`);
            const result = await this.executeCommand(hook, this.projectRoot);
            if (result.exitCode !== 0) {
                return { success: false, error: result.error };
            }
            return { success: true };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown hook execution error'
            };
        }
    }
    async deployServices(target, version) {
        const services = [];
        const logs = [];
        try {
            const composeFile = target.config.dockerCompose;
            const composeCommand = `docker-compose -f ${composeFile} up -d`;
            console.log(`🚀 Deploying services with: ${composeCommand}`);
            const result = await this.executeCommand(composeCommand, this.projectRoot);
            logs.push(`Docker Compose output: ${result.output}`);
            if (result.exitCode !== 0) {
                return { success: false, services, logs, error: result.error };
            }
            // Create service deployment results
            for (const serviceConfig of target.config.services) {
                services.push({
                    serviceName: serviceConfig.name,
                    status: 'deployed',
                    duration: 0, // Would be measured in real implementation
                    healthCheckPassed: false // Will be updated by health checks
                });
            }
            return { success: true, services, logs };
        }
        catch (error) {
            return {
                success: false,
                services,
                logs,
                error: error instanceof Error ? error.message : 'Unknown service deployment error'
            };
        }
    }
    async performHealthChecks(target) {
        const results = [];
        for (const service of target.config.services) {
            const startTime = Date.now();
            try {
                const healthCheck = await this.checkServiceHealth(service.name, service.healthCheck.endpoint, service.healthCheck.timeout, service.healthCheck.retries);
                results.push({
                    service: service.name,
                    url: service.healthCheck.endpoint,
                    status: healthCheck.status,
                    responseTime: Date.now() - startTime,
                    timestamp: new Date(),
                    error: healthCheck.error
                });
            }
            catch (error) {
                results.push({
                    service: service.name,
                    url: service.healthCheck.endpoint,
                    status: 'unhealthy',
                    responseTime: Date.now() - startTime,
                    timestamp: new Date(),
                    error: error instanceof Error ? error.message : 'Unknown health check error'
                });
            }
        }
        return results;
    }
    async checkServiceHealth(serviceName, endpoint, timeout, retries) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                console.log(`🏥 Health check ${attempt}/${retries} for ${serviceName}: ${endpoint}`);
                const curlResult = await this.executeCommand(`curl -f --max-time ${timeout} ${endpoint}`, this.projectRoot);
                if (curlResult.exitCode === 0) {
                    console.log(`✅ ${serviceName} is healthy`);
                    return { status: 'healthy' };
                }
                if (attempt < retries) {
                    console.log(`⏳ ${serviceName} not ready, retrying in 5 seconds...`);
                    await this.sleep(5000);
                }
            }
            catch (error) {
                if (attempt === retries) {
                    return {
                        status: 'unhealthy',
                        error: error instanceof Error ? error.message : 'Unknown health check error'
                    };
                }
                await this.sleep(5000);
            }
        }
        return { status: 'timeout', error: `Health check timed out after ${retries} attempts` };
    }
    async runSmokeTests(target) {
        if (!target.config.smokeTestCommand) {
            throw new Error('Smoke test command not configured');
        }
        const startTime = new Date();
        try {
            const result = await this.executeCommand(target.config.smokeTestCommand, this.projectRoot);
            const endTime = new Date();
            // Parse smoke test results (simplified)
            const passed = result.exitCode === 0 ? 1 : 0;
            const failed = result.exitCode === 0 ? 0 : 1;
            return {
                type: 'e2e', // Smoke tests are typically E2E
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
    async stopServices(target) {
        const composeFile = target.config.dockerCompose;
        const stopCommand = `docker-compose -f ${composeFile} down`;
        console.log(`🛑 Stopping services with: ${stopCommand}`);
        const result = await this.executeCommand(stopCommand, this.projectRoot);
        if (result.exitCode !== 0) {
            console.warn(`Warning: Failed to stop services: ${result.error}`);
        }
    }
    findPreviousSuccessfulDeployment(target) {
        const deployments = this.getDeploymentHistory();
        return deployments.find(deployment => deployment.target.name === target.name &&
            deployment.success === true);
    }
    async executeCommand(command, cwd) {
        return new Promise((resolve) => {
            const process = spawn('sh', ['-c', command], {
                cwd,
                stdio: ['pipe', 'pipe', 'pipe']
            });
            let output = '';
            let errorOutput = '';
            process.stdout?.on('data', (data) => {
                output += data.toString();
            });
            process.stderr?.on('data', (data) => {
                errorOutput += data.toString();
            });
            process.on('close', (code) => {
                resolve({
                    exitCode: code || 0,
                    output,
                    error: errorOutput || undefined
                });
            });
            process.on('error', (error) => {
                resolve({
                    exitCode: 1,
                    output,
                    error: error.message
                });
            });
        });
    }
    getAllFiles(dir) {
        const files = [];
        try {
            const items = fs.readdirSync(dir, { withFileTypes: true });
            for (const item of items) {
                const fullPath = path.join(dir, item.name);
                if (item.isDirectory()) {
                    files.push(...this.getAllFiles(fullPath));
                }
                else {
                    files.push(fullPath);
                }
            }
        }
        catch (error) {
            console.warn(`Failed to read directory ${dir}:`, error);
        }
        return files;
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
     * Clean up running processes
     */
    cleanup() {
        console.log('🧹 Cleaning up deployment processes...');
        for (const [processId, process] of this.runningProcesses) {
            try {
                process.kill('SIGTERM');
                console.log(`Terminated process: ${processId}`);
            }
            catch (error) {
                console.warn(`Failed to terminate process ${processId}:`, error);
            }
        }
        this.runningProcesses.clear();
    }
}
export default DeploymentPipeline;
