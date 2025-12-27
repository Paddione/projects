/**
 * Unified Test Configuration Manager
 * Centralized configuration management for all test types and environments
 */
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
export class TestConfigManager {
    constructor(configPath) {
        this.config = null;
        // Look for config file in project root, not current working directory
        const projectRoot = this.findProjectRoot();
        this.configPath = configPath || path.join(projectRoot, 'test-config.yml');
    }
    static getInstance(configPath) {
        if (!TestConfigManager.instance) {
            TestConfigManager.instance = new TestConfigManager(configPath);
        }
        return TestConfigManager.instance;
    }
    /**
     * Load test configuration from YAML file
     */
    loadConfig() {
        try {
            if (!fs.existsSync(this.configPath)) {
                throw new Error(`Test configuration file not found: ${this.configPath}`);
            }
            const configContent = fs.readFileSync(this.configPath, 'utf8');
            this.config = yaml.load(configContent);
            if (!this.config) {
                throw new Error('Failed to parse test configuration file');
            }
            return this.config;
        }
        catch (error) {
            throw new Error(`Failed to load test configuration: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Get configuration for specific environment
     */
    getEnvironmentConfig(environment) {
        if (!this.config) {
            this.loadConfig();
        }
        const envConfig = this.config.environments[environment];
        if (!envConfig) {
            throw new Error(`Environment configuration not found: ${environment}. Available environments: ${Object.keys(this.config.environments).join(', ')}`);
        }
        return envConfig;
    }
    /**
     * Get configuration for specific test type
     */
    getTestTypeConfig(testType) {
        if (!this.config) {
            this.loadConfig();
        }
        const typeConfig = this.config.test_types[testType];
        if (!typeConfig) {
            throw new Error(`Test type configuration not found: ${testType}. Available test types: ${Object.keys(this.config.test_types).join(', ')}`);
        }
        return typeConfig;
    }
    /**
     * Get global test configuration
     */
    getGlobalConfig() {
        if (!this.config) {
            this.loadConfig();
        }
        return this.config.global;
    }
    /**
     * Create complete test execution context
     */
    createExecutionContext(environment, testType) {
        if (!this.config) {
            this.loadConfig();
        }
        return {
            environment,
            test_type: testType,
            config: this.config,
            environment_config: this.getEnvironmentConfig(environment),
            test_type_config: this.getTestTypeConfig(testType),
            global_config: this.getGlobalConfig()
        };
    }
    /**
     * Validate test configuration
     */
    validateConfig(config) {
        const configToValidate = config || this.config;
        if (!configToValidate) {
            return {
                isValid: false,
                errors: [{ field: 'config', message: 'Configuration not loaded' }],
                warnings: []
            };
        }
        const errors = [];
        const warnings = [];
        // Validate environments
        if (!configToValidate.environments || Object.keys(configToValidate.environments).length === 0) {
            errors.push({ field: 'environments', message: 'At least one environment configuration is required' });
        }
        else {
            for (const [envName, envConfig] of Object.entries(configToValidate.environments)) {
                this.validateEnvironmentConfig(envName, envConfig, errors, warnings);
            }
        }
        // Validate test types
        if (!configToValidate.test_types || Object.keys(configToValidate.test_types).length === 0) {
            errors.push({ field: 'test_types', message: 'At least one test type configuration is required' });
        }
        else {
            for (const [typeName, typeConfig] of Object.entries(configToValidate.test_types)) {
                this.validateTestTypeConfig(typeName, typeConfig, errors, warnings);
            }
        }
        // Validate global config
        if (!configToValidate.global) {
            errors.push({ field: 'global', message: 'Global configuration is required' });
        }
        else {
            this.validateGlobalConfig(configToValidate.global, errors, warnings);
        }
        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }
    /**
     * Setup environment variables for testing
     */
    setupEnvironmentVariables(environment) {
        const envConfig = this.getEnvironmentConfig(environment);
        // Set environment variables
        for (const [key, value] of Object.entries(envConfig.environment_variables)) {
            process.env[key] = value;
        }
        // Set database URL
        process.env.DATABASE_URL = envConfig.database.url;
        // Set service URLs
        process.env.BACKEND_URL = envConfig.services.backend.base_url;
        process.env.FRONTEND_URL = envConfig.services.frontend.base_url;
        console.log(`Environment variables set for ${environment} environment`);
    }
    /**
     * Perform health check on services
     */
    async performHealthCheck(environment) {
        const envConfig = this.getEnvironmentConfig(environment);
        const startTime = Date.now();
        const healthChecks = [
            this.checkServiceHealth('backend', envConfig.services.backend),
            this.checkServiceHealth('frontend', envConfig.services.frontend)
        ];
        try {
            const results = await Promise.allSettled(healthChecks);
            const serviceResults = results.map((result, index) => {
                const serviceName = ['backend', 'frontend'][index];
                if (result.status === 'fulfilled') {
                    return result.value;
                }
                else {
                    return {
                        service: serviceName,
                        status: 'unhealthy',
                        error: result.reason?.message || 'Unknown error',
                        url: this.getServiceUrl(serviceName, envConfig)
                    };
                }
            });
            const allHealthy = serviceResults.every(result => result.status === 'healthy');
            const setupTime = Date.now() - startTime;
            return {
                environment,
                status: allHealthy ? 'ready' : 'failed',
                services: serviceResults,
                database_connected: await this.checkDatabaseConnection(envConfig.database.url),
                setup_time: setupTime
            };
        }
        catch (error) {
            return {
                environment,
                status: 'failed',
                services: [],
                database_connected: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    /**
     * Get Jest configuration for specific context
     */
    getJestConfig(context, isBackend = true) {
        const baseConfig = {
            testTimeout: context.test_type_config.timeout,
            verbose: context.test_type_config.verbose,
            bail: context.test_type_config.bail,
            clearMocks: context.global_config.clear_mocks,
            resetMocks: context.global_config.reset_mocks,
            restoreMocks: context.global_config.restore_mocks,
            collectCoverage: context.test_type_config.collect_coverage,
            coverageThreshold: {
                global: context.environment_config.coverage.threshold
            },
            collectCoverageFrom: this.getCoveragePatterns(isBackend),
            coveragePathIgnorePatterns: context.environment_config.coverage.exclude,
            coverageReporters: context.environment_config.reporting.formats,
            coverageDirectory: context.environment_config.reporting.output_dir
        };
        if (context.test_type_config.parallel) {
            baseConfig.maxWorkers = context.test_type_config.max_workers;
        }
        else {
            baseConfig.maxWorkers = 1;
        }
        return baseConfig;
    }
    // Private helper methods
    findProjectRoot() {
        let currentDir = process.cwd();
        // Look for package.json or test-config.yml to identify project root
        while (currentDir !== path.dirname(currentDir)) {
            if (fs.existsSync(path.join(currentDir, 'package.json')) &&
                fs.existsSync(path.join(currentDir, 'test-config.yml'))) {
                return currentDir;
            }
            // Also check if we're in a subdirectory and there's a test-config.yml in parent
            if (fs.existsSync(path.join(currentDir, '..', 'test-config.yml'))) {
                return path.join(currentDir, '..');
            }
            currentDir = path.dirname(currentDir);
        }
        // Fallback to current working directory
        return process.cwd();
    }
    validateEnvironmentConfig(envName, envConfig, errors, warnings) {
        // Validate database config
        if (!envConfig.database?.url) {
            errors.push({ field: `environments.${envName}.database.url`, message: 'Database URL is required' });
        }
        if (typeof envConfig.database?.timeout !== 'number' || envConfig.database.timeout <= 0) {
            errors.push({ field: `environments.${envName}.database.timeout`, message: 'Database timeout must be a positive number' });
        }
        // Validate services
        const requiredServices = ['backend', 'frontend'];
        for (const service of requiredServices) {
            if (!envConfig.services?.[service]) {
                errors.push({ field: `environments.${envName}.services.${service}`, message: `${service} service configuration is required` });
            }
            else {
                const serviceConfig = envConfig.services[service];
                if (!serviceConfig.base_url) {
                    errors.push({ field: `environments.${envName}.services.${service}.base_url`, message: `${service} base URL is required` });
                }
                if (!serviceConfig.health_endpoint) {
                    errors.push({ field: `environments.${envName}.services.${service}.health_endpoint`, message: `${service} health endpoint is required` });
                }
            }
        }
        // Validate coverage thresholds
        const thresholds = envConfig.coverage?.threshold;
        if (thresholds) {
            for (const [key, value] of Object.entries(thresholds)) {
                if (typeof value !== 'number' || value < 0 || value > 100) {
                    errors.push({ field: `environments.${envName}.coverage.threshold.${key}`, message: 'Coverage threshold must be between 0 and 100' });
                }
            }
        }
    }
    validateTestTypeConfig(typeName, typeConfig, errors, warnings) {
        if (typeof typeConfig.timeout !== 'number' || typeConfig.timeout <= 0) {
            errors.push({ field: `test_types.${typeName}.timeout`, message: 'Timeout must be a positive number' });
        }
        if (typeof typeConfig.parallel !== 'boolean') {
            errors.push({ field: `test_types.${typeName}.parallel`, message: 'Parallel must be a boolean' });
        }
        if (typeConfig.max_workers !== undefined) {
            if (typeof typeConfig.max_workers !== 'number' && typeof typeConfig.max_workers !== 'string') {
                errors.push({ field: `test_types.${typeName}.max_workers`, message: 'Max workers must be a number or string' });
            }
        }
    }
    validateGlobalConfig(globalConfig, errors, warnings) {
        const numericFields = ['max_test_timeout', 'setup_timeout', 'teardown_timeout', 'retry_attempts', 'retry_delay'];
        for (const field of numericFields) {
            if (typeof globalConfig[field] !== 'number' || globalConfig[field] <= 0) {
                errors.push({ field: `global.${field}`, message: `${field} must be a positive number` });
            }
        }
        const booleanFields = ['clear_mocks', 'reset_mocks', 'restore_mocks'];
        for (const field of booleanFields) {
            if (typeof globalConfig[field] !== 'boolean') {
                errors.push({ field: `global.${field}`, message: `${field} must be a boolean` });
            }
        }
    }
    async checkServiceHealth(serviceName, serviceConfig) {
        const url = `${serviceConfig.base_url}${serviceConfig.health_endpoint}`;
        const startTime = Date.now();
        try {
            // Use dynamic import for fetch in Node.js environments
            const fetch = (await import('node-fetch')).default;
            const response = await Promise.race([
                fetch(url),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), serviceConfig.timeout * 1000))
            ]);
            const responseTime = Date.now() - startTime;
            return {
                service: serviceName,
                status: response.ok ? 'healthy' : 'unhealthy',
                response_time: responseTime,
                url,
                error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
            };
        }
        catch (error) {
            const responseTime = Date.now() - startTime;
            return {
                service: serviceName,
                status: responseTime >= serviceConfig.timeout * 1000 ? 'timeout' : 'unhealthy',
                response_time: responseTime,
                url,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    async checkDatabaseConnection(databaseUrl) {
        try {
            // This is a basic check - in a real implementation, you'd use the actual database client
            const url = new URL(databaseUrl);
            return url.protocol === 'postgresql:' && url.hostname !== '';
        }
        catch {
            return false;
        }
    }
    getServiceUrl(serviceName, envConfig) {
        const service = envConfig.services[serviceName];
        return service ? service.base_url : '';
    }
    getCoveragePatterns(isBackend) {
        if (isBackend) {
            return [
                'src/**/*.ts',
                '!src/**/*.d.ts',
                '!src/**/*.test.ts',
                '!src/**/*.spec.ts',
                '!src/server.ts',
                '!src/cli/**/*.ts'
            ];
        }
        else {
            return [
                'src/**/*.{ts,tsx}',
                '!src/**/*.d.ts',
                '!src/**/*.test.{ts,tsx}',
                '!src/**/*.spec.{ts,tsx}',
                '!src/main.tsx',
                '!src/setupTests.ts'
            ];
        }
    }
}
export default TestConfigManager;
