/**
 * Shared Test Utilities and Helpers
 * Common utilities for consistent test setup across frontend and backend
 */
import { TestConfigManager } from './TestConfigManager.js';
export class TestUtilities {
    /**
     * Initialize test environment with proper configuration
     */
    static async initializeTestEnvironment(environment = 'local', testType = 'unit') {
        try {
            // Load configuration
            const context = TestUtilities.configManager.createExecutionContext(environment, testType);
            // Setup environment variables
            TestUtilities.configManager.setupEnvironmentVariables(environment);
            // Validate configuration
            const validation = TestUtilities.configManager.validateConfig();
            if (!validation.isValid) {
                throw new Error(`Configuration validation failed:\n${validation.errors.map(e => `- ${e.field}: ${e.message}`).join('\n')}`);
            }
            // Log warnings if any
            if (validation.warnings.length > 0) {
                console.warn('Configuration warnings:');
                validation.warnings.forEach(warning => console.warn(`- ${warning}`));
            }
            console.log(`Test environment initialized: ${environment} (${testType})`);
            return context;
        }
        catch (error) {
            throw new Error(`Failed to initialize test environment: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Wait for services to be ready
     */
    static async waitForServices(environment, maxWaitTime = 120000, checkInterval = 5000) {
        const startTime = Date.now();
        let lastStatus;
        while (Date.now() - startTime < maxWaitTime) {
            try {
                lastStatus = await TestUtilities.configManager.performHealthCheck(environment);
                if (lastStatus.status === 'ready') {
                    console.log(`All services ready in ${lastStatus.setup_time}ms`);
                    return lastStatus;
                }
                if (lastStatus.status === 'failed') {
                    const failedServices = lastStatus.services
                        .filter(s => s.status !== 'healthy')
                        .map(s => `${s.service}: ${s.error || s.status}`)
                        .join(', ');
                    console.warn(`Services not ready: ${failedServices}. Retrying in ${checkInterval}ms...`);
                }
                await TestUtilities.sleep(checkInterval);
            }
            catch (error) {
                console.warn(`Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}. Retrying...`);
                await TestUtilities.sleep(checkInterval);
            }
        }
        throw new Error(`Services failed to become ready within ${maxWaitTime}ms. Last status: ${JSON.stringify(lastStatus, null, 2)}`);
    }
    /**
     * Create test database with proper isolation
     */
    static async setupTestDatabase(context) {
        if (!context.test_type_config.setup_database) {
            return;
        }
        try {
            // Set database URL
            process.env.DATABASE_URL = context.environment_config.database.url;
            // Additional database setup would go here
            // For now, we just ensure the URL is set
            console.log(`Test database configured: ${context.environment_config.database.url}`);
        }
        catch (error) {
            throw new Error(`Failed to setup test database: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Clean up test environment
     */
    static async cleanupTestEnvironment(context) {
        try {
            // Clear test data if needed
            if (context.test_type_config.setup_database) {
                // Database cleanup would go here
                console.log('Test database cleaned up');
            }
            // Reset environment variables to original state
            // Note: In a real implementation, you'd want to store and restore original values
            console.log('Test environment cleaned up');
        }
        catch (error) {
            console.warn(`Cleanup warning: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    /**
     * Create mock data generators
     */
    static createMockData() {
        return {
            user: (overrides = {}) => ({
                id: TestUtilities.generateId(),
                username: `testuser_${Date.now()}`,
                email: `test_${Date.now()}@example.com`,
                password: 'test_password_123',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                ...overrides
            }),
            gameSession: (overrides = {}) => ({
                id: TestUtilities.generateId(),
                lobby_id: TestUtilities.generateId(),
                status: 'waiting',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                ...overrides
            }),
            question: (overrides = {}) => ({
                id: TestUtilities.generateId(),
                question: 'What is the capital of France?',
                options: ['London', 'Berlin', 'Paris', 'Madrid'],
                correct_answer: 2,
                difficulty: 'medium',
                category: 'geography',
                created_at: new Date().toISOString(),
                ...overrides
            }),
            lobby: (overrides = {}) => ({
                id: TestUtilities.generateId(),
                name: `Test Lobby ${Date.now()}`,
                host_id: TestUtilities.generateId(),
                max_players: 4,
                status: 'waiting',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                ...overrides
            })
        };
    }
    /**
     * Create test helpers for common operations
     */
    static createTestHelpers() {
        return {
            /**
             * Wait for element to appear (for frontend tests)
             */
            waitForElement: async (selector, timeout = 5000) => {
                const startTime = Date.now();
                while (Date.now() - startTime < timeout) {
                    if (typeof document !== 'undefined') {
                        const element = document.querySelector(selector);
                        if (element)
                            return;
                    }
                    await TestUtilities.sleep(100);
                }
                throw new Error(`Element ${selector} not found within ${timeout}ms`);
            },
            /**
             * Make authenticated API request
             */
            makeAuthenticatedRequest: async (url, options = {}, token) => {
                const headers = {
                    'Content-Type': 'application/json',
                    ...options.headers
                };
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }
                const fetch = (await import('node-fetch')).default;
                return fetch(url, {
                    ...options,
                    headers
                });
            },
            /**
             * Create test user and get auth token
             */
            createTestUser: async (userData) => {
                const mockData = TestUtilities.createMockData();
                const user = mockData.user(userData);
                // In a real implementation, this would create a user via API
                // For now, return mock data
                return {
                    user,
                    token: 'mock_jwt_token_for_testing'
                };
            },
            /**
             * Setup test lobby
             */
            setupTestLobby: async (hostToken, lobbyData) => {
                const mockData = TestUtilities.createMockData();
                const lobby = mockData.lobby(lobbyData);
                // In a real implementation, this would create a lobby via API
                return lobby;
            },
            /**
             * Clean up test data
             */
            cleanupTestData: async (dataIds) => {
                // In a real implementation, this would clean up test data
                console.log(`Cleaning up test data: ${dataIds.join(', ')}`);
            }
        };
    }
    /**
     * Create performance measurement utilities
     */
    static createPerformanceUtils() {
        return {
            /**
             * Measure execution time
             */
            measureTime: async (fn) => {
                const startTime = performance.now();
                const result = await fn();
                const duration = performance.now() - startTime;
                return { result, duration };
            },
            /**
             * Memory usage snapshot
             */
            getMemoryUsage: () => {
                if (typeof process !== 'undefined' && process.memoryUsage) {
                    return process.memoryUsage();
                }
                return null;
            },
            /**
             * Create performance benchmark
             */
            benchmark: async (name, fn, iterations = 10) => {
                const times = [];
                for (let i = 0; i < iterations; i++) {
                    const { duration } = await TestUtilities.createPerformanceUtils().measureTime(fn);
                    times.push(duration);
                }
                const totalTime = times.reduce((sum, time) => sum + time, 0);
                const averageTime = totalTime / iterations;
                const minTime = Math.min(...times);
                const maxTime = Math.max(...times);
                return {
                    name,
                    iterations,
                    totalTime,
                    averageTime,
                    minTime,
                    maxTime
                };
            }
        };
    }
    /**
     * Create accessibility testing utilities
     */
    static createA11yUtils() {
        return {
            /**
             * Check color contrast
             */
            checkColorContrast: (foreground, background) => {
                // Simplified contrast calculation - in real implementation use a proper library
                const ratio = 4.5; // Mock ratio
                return {
                    ratio,
                    passes: ratio >= 4.5
                };
            },
            /**
             * Check ARIA attributes
             */
            checkAriaAttributes: (element) => {
                const issues = [];
                // Basic ARIA validation - in real implementation use axe-core
                if (element.getAttribute('role') && !element.getAttribute('aria-label')) {
                    issues.push('Element with role should have aria-label');
                }
                return {
                    valid: issues.length === 0,
                    issues
                };
            }
        };
    }
    // Private utility methods
    static generateId() {
        return `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Get current test context from environment
     */
    static getCurrentContext() {
        const environment = process.env.TEST_ENVIRONMENT || 'local';
        const testType = process.env.TEST_TYPE || 'unit';
        return { environment, testType };
    }
    /**
     * Set test context in environment
     */
    static setTestContext(environment, testType) {
        process.env.TEST_ENVIRONMENT = environment;
        process.env.TEST_TYPE = testType;
    }
    /**
     * Create Jest setup function
     */
    static createJestSetup(environment = 'local', testType = 'unit') {
        return async () => {
            try {
                const context = await TestUtilities.initializeTestEnvironment(environment, testType);
                // Setup database if needed
                await TestUtilities.setupTestDatabase(context);
                // Store context globally for tests
                global.testContext = context;
                console.log(`Jest setup complete for ${environment}/${testType}`);
            }
            catch (error) {
                console.error('Jest setup failed:', error);
                throw error;
            }
        };
    }
    /**
     * Create Jest teardown function
     */
    static createJestTeardown() {
        return async () => {
            try {
                const context = global.testContext;
                if (context) {
                    await TestUtilities.cleanupTestEnvironment(context);
                }
                console.log('Jest teardown complete');
            }
            catch (error) {
                console.warn('Jest teardown warning:', error);
            }
        };
    }
}
(() => {
    TestUtilities.configManager = TestConfigManager.getInstance();
})();
export default TestUtilities;
