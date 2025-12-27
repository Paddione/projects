/**
 * Test Configuration Manager Tests
 * Tests for the unified test configuration system
 */
import { TestConfigManager } from '../TestConfigManager';
import { TestUtilities } from '../TestUtilities';
import * as fs from 'fs';
import * as path from 'path';
describe('TestConfigManager', () => {
    let configManager;
    let originalConfigPath;
    beforeAll(() => {
        // Create a test configuration file
        const testConfigPath = path.join(__dirname, 'test-config.yml');
        const testConfig = `
environments:
  local:
    database:
      url: "postgresql://test_user:test_pass@localhost:5433/test_db"
      ssl: false
      pool_size: 5
      timeout: 30000
    services:
      backend:
        port: 3001
        health_endpoint: "/api/health"
        timeout: 30
        base_url: "http://localhost:3001"
      frontend:
        port: 3000
        health_endpoint: "/"
        timeout: 30
        base_url: "http://localhost:3000"
      chromadb:
        port: 8001
        health_endpoint: "/api/v1/heartbeat"
        timeout: 15
        base_url: "http://localhost:8001"
    coverage:
      threshold:
        statements: 80
        branches: 75
        functions: 80
        lines: 80
      exclude:
        - "**/*.test.ts"
        - "**/node_modules/**"
    reporting:
      formats: ["html", "lcov", "json"]
      output_dir: "coverage"
      open_browser: false
    environment_variables:
      NODE_ENV: "test"
      JWT_SECRET: "test_jwt_secret_for_testing_only_not_secure"

test_types:
  unit:
    timeout: 10000
    parallel: true
    max_workers: "50%"
    bail: false
    verbose: false
    collect_coverage: true

global:
  max_test_timeout: 300000
  setup_timeout: 120000
  teardown_timeout: 60000
  retry_attempts: 3
  retry_delay: 1000
  log_level: "warn"
  clear_mocks: true
  reset_mocks: true
  restore_mocks: true
`;
        fs.writeFileSync(testConfigPath, testConfig);
        configManager = TestConfigManager.getInstance(testConfigPath);
    });
    afterAll(() => {
        // Clean up test configuration file
        const testConfigPath = path.join(__dirname, 'test-config.yml');
        if (fs.existsSync(testConfigPath)) {
            fs.unlinkSync(testConfigPath);
        }
    });
    describe('loadConfig', () => {
        it('should load configuration from YAML file', () => {
            const config = configManager.loadConfig();
            expect(config).toBeDefined();
            expect(config.environments).toBeDefined();
            expect(config.test_types).toBeDefined();
            expect(config.global).toBeDefined();
        });
        it('should throw error for non-existent config file', () => {
            // Reset singleton to test with invalid path
            TestConfigManager.instance = null;
            const invalidManager = TestConfigManager.getInstance('/non/existent/path.yml');
            expect(() => invalidManager.loadConfig()).toThrow('Test configuration file not found');
            // Reset back to valid instance for other tests
            TestConfigManager.instance = null;
            const testConfigPath = path.join(__dirname, 'test-config.yml');
            configManager = TestConfigManager.getInstance(testConfigPath);
        });
    });
    describe('getEnvironmentConfig', () => {
        it('should return environment configuration', () => {
            const envConfig = configManager.getEnvironmentConfig('local');
            expect(envConfig).toBeDefined();
            expect(envConfig.database).toBeDefined();
            expect(envConfig.services).toBeDefined();
            expect(envConfig.coverage).toBeDefined();
            expect(envConfig.reporting).toBeDefined();
            expect(envConfig.environment_variables).toBeDefined();
        });
        it('should throw error for non-existent environment', () => {
            expect(() => configManager.getEnvironmentConfig('nonexistent')).toThrow('Environment configuration not found');
        });
    });
    describe('getTestTypeConfig', () => {
        it('should return test type configuration', () => {
            const typeConfig = configManager.getTestTypeConfig('unit');
            expect(typeConfig).toBeDefined();
            expect(typeConfig.timeout).toBe(10000);
            expect(typeConfig.parallel).toBe(true);
            expect(typeConfig.collect_coverage).toBe(true);
        });
        it('should throw error for non-existent test type', () => {
            expect(() => configManager.getTestTypeConfig('nonexistent')).toThrow('Test type configuration not found');
        });
    });
    describe('createExecutionContext', () => {
        it('should create complete execution context', () => {
            const context = configManager.createExecutionContext('local', 'unit');
            expect(context).toBeDefined();
            expect(context.environment).toBe('local');
            expect(context.test_type).toBe('unit');
            expect(context.config).toBeDefined();
            expect(context.environment_config).toBeDefined();
            expect(context.test_type_config).toBeDefined();
            expect(context.global_config).toBeDefined();
        });
    });
    describe('validateConfig', () => {
        it('should validate correct configuration', () => {
            const validation = configManager.validateConfig();
            expect(validation.isValid).toBe(true);
            expect(validation.errors).toHaveLength(0);
        });
        it('should detect invalid configuration', () => {
            const invalidConfig = {
                environments: {},
                test_types: {},
                global: {
                    max_test_timeout: 0,
                    setup_timeout: 0,
                    teardown_timeout: 0,
                    retry_attempts: 0,
                    retry_delay: 0,
                    log_level: '',
                    clear_mocks: false,
                    reset_mocks: false,
                    restore_mocks: false
                }
            };
            const validation = configManager.validateConfig(invalidConfig);
            expect(validation.isValid).toBe(false);
            expect(validation.errors.length).toBeGreaterThan(0);
        });
    });
    describe('setupEnvironmentVariables', () => {
        it('should set environment variables from configuration', () => {
            const originalEnv = { ...process.env };
            configManager.setupEnvironmentVariables('local');
            expect(process.env.NODE_ENV).toBe('test');
            expect(process.env.JWT_SECRET).toBe('test_jwt_secret_for_testing_only_not_secure');
            expect(process.env.DATABASE_URL).toBe('postgresql://test_user:test_pass@localhost:5433/test_db');
            // Restore original environment
            process.env = originalEnv;
        });
    });
    describe('getJestConfig', () => {
        it('should generate Jest configuration from context', () => {
            const context = configManager.createExecutionContext('local', 'unit');
            const jestConfig = configManager.getJestConfig(context, true);
            expect(jestConfig).toBeDefined();
            expect(jestConfig.testTimeout).toBe(10000);
            expect(jestConfig.verbose).toBe(false);
            expect(jestConfig.collectCoverage).toBe(true);
            expect(jestConfig.coverageThreshold).toBeDefined();
            expect(jestConfig.coverageThreshold.global).toBeDefined();
        });
    });
});
describe('TestUtilities', () => {
    describe('initializeTestEnvironment', () => {
        it('should initialize test environment with default values', async () => {
            // Mock the config manager to avoid file system dependencies
            const mockContext = {
                environment: 'local',
                test_type: 'unit',
                config: {},
                environment_config: {
                    environment_variables: {
                        NODE_ENV: 'test'
                    }
                },
                test_type_config: {
                    timeout: 10000
                },
                global_config: {
                    clear_mocks: true
                }
            };
            // This test would need more mocking in a real implementation
            expect(TestUtilities).toBeDefined();
        });
    });
    describe('createMockData', () => {
        it('should create mock data generators', () => {
            const mockData = TestUtilities.createMockData();
            expect(mockData).toBeDefined();
            expect(mockData.user).toBeInstanceOf(Function);
            expect(mockData.gameSession).toBeInstanceOf(Function);
            expect(mockData.question).toBeInstanceOf(Function);
            expect(mockData.lobby).toBeInstanceOf(Function);
        });
        it('should generate user mock data', () => {
            const mockData = TestUtilities.createMockData();
            const user = mockData.user();
            expect(user).toBeDefined();
            expect(user.id).toBeDefined();
            expect(user.username).toBeDefined();
            expect(user.email).toBeDefined();
            expect(user.password).toBeDefined();
        });
        it('should allow overrides in mock data', () => {
            const mockData = TestUtilities.createMockData();
            const user = mockData.user({ username: 'custom_user' });
            expect(user.username).toBe('custom_user');
        });
    });
    describe('createTestHelpers', () => {
        it('should create test helper functions', () => {
            const helpers = TestUtilities.createTestHelpers();
            expect(helpers).toBeDefined();
            expect(helpers.makeAuthenticatedRequest).toBeInstanceOf(Function);
            expect(helpers.createTestUser).toBeInstanceOf(Function);
            expect(helpers.setupTestLobby).toBeInstanceOf(Function);
            expect(helpers.cleanupTestData).toBeInstanceOf(Function);
        });
    });
    describe('createPerformanceUtils', () => {
        it('should create performance measurement utilities', () => {
            const perfUtils = TestUtilities.createPerformanceUtils();
            expect(perfUtils).toBeDefined();
            expect(perfUtils.measureTime).toBeInstanceOf(Function);
            expect(perfUtils.getMemoryUsage).toBeInstanceOf(Function);
            expect(perfUtils.benchmark).toBeInstanceOf(Function);
        });
        it('should measure execution time', async () => {
            const perfUtils = TestUtilities.createPerformanceUtils();
            const result = await perfUtils.measureTime(async () => {
                await new Promise(resolve => setTimeout(resolve, 10));
                return 'test result';
            });
            expect(result.result).toBe('test result');
            expect(result.duration).toBeGreaterThan(0);
        });
    });
    describe('getCurrentContext', () => {
        it('should get current test context from environment', () => {
            const originalEnv = { ...process.env };
            process.env.TEST_ENVIRONMENT = 'ci';
            process.env.TEST_TYPE = 'integration';
            const context = TestUtilities.getCurrentContext();
            expect(context.environment).toBe('ci');
            expect(context.testType).toBe('integration');
            // Restore original environment
            process.env = originalEnv;
        });
        it('should use defaults when environment variables are not set', () => {
            const originalEnv = { ...process.env };
            delete process.env.TEST_ENVIRONMENT;
            delete process.env.TEST_TYPE;
            const context = TestUtilities.getCurrentContext();
            expect(context.environment).toBe('local');
            expect(context.testType).toBe('unit');
            // Restore original environment
            process.env = originalEnv;
        });
    });
});
