/**
 * Performance Test Framework Tests
 * Unit tests for the performance testing framework
 */
import { PerformanceTestFramework } from '../PerformanceTestFramework';
import { TestConfigManager } from '../TestConfigManager';
// Mock external dependencies
jest.mock('child_process');
jest.mock('fs');
describe('PerformanceTestFramework', () => {
    let performanceFramework;
    let configManager;
    beforeEach(() => {
        configManager = TestConfigManager.getInstance();
        performanceFramework = new PerformanceTestFramework();
    });
    afterEach(() => {
        performanceFramework.cleanup();
    });
    test('should initialize performance test framework', () => {
        expect(performanceFramework).toBeDefined();
        expect(typeof performanceFramework.runPerformanceTests).toBe('function');
        expect(typeof performanceFramework.cleanup).toBe('function');
    });
    test('should create load test scenarios', () => {
        // Access private method for testing
        const scenarios = performanceFramework.getLoadTestScenarios();
        expect(Array.isArray(scenarios)).toBe(true);
        expect(scenarios.length).toBeGreaterThan(0);
        // Verify scenario structure
        const scenario = scenarios[0];
        expect(scenario).toHaveProperty('name');
        expect(scenario).toHaveProperty('description');
        expect(scenario).toHaveProperty('duration');
        expect(scenario).toHaveProperty('virtualUsers');
        expect(scenario).toHaveProperty('endpoints');
        expect(scenario).toHaveProperty('thresholds');
        expect(Array.isArray(scenario.endpoints)).toBe(true);
        expect(scenario.endpoints.length).toBeGreaterThan(0);
        // Verify endpoint structure
        const endpoint = scenario.endpoints[0];
        expect(endpoint).toHaveProperty('name');
        expect(endpoint).toHaveProperty('method');
        expect(endpoint).toHaveProperty('url');
        expect(endpoint).toHaveProperty('weight');
        expect(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).toContain(endpoint.method);
    });
    test('should validate performance thresholds', () => {
        const mockMetrics = {
            responseTime: { min: 10, max: 500, avg: 100, p50: 80, p95: 200, p99: 400 },
            throughput: { requestsPerSecond: 100, totalRequests: 1000, successfulRequests: 990, failedRequests: 10 },
            memory: { heapUsed: 150, heapTotal: 200, external: 50, rss: 180, peak: 200 },
            cpu: { usage: 60, loadAverage: [1.0, 1.2, 1.1] },
            network: { bytesReceived: 1000000, bytesSent: 500000, connections: 50 },
            errors: { total: 10, byType: new Map(), errorRate: 1.0 }
        };
        const mockThresholds = {
            responseTime: { avg: 200, p95: 500, p99: 1000 },
            throughput: { minRequestsPerSecond: 50 },
            memory: { maxHeapUsed: 200, maxRss: 250 },
            cpu: { maxUsage: 80 },
            errorRate: { maxPercentage: 5 }
        };
        const result = performanceFramework.checkThresholds(mockMetrics, mockThresholds);
        expect(result).toHaveProperty('passed');
        expect(result).toHaveProperty('failures');
        expect(typeof result.passed).toBe('boolean');
        expect(Array.isArray(result.failures)).toBe(true);
        // With these values, all thresholds should pass
        expect(result.passed).toBe(true);
        expect(result.failures.length).toBe(0);
    });
    test('should detect performance regression', () => {
        const currentMetrics = {
            responseTime: { min: 10, max: 500, avg: 150, p50: 120, p95: 300, p99: 450 },
            throughput: { requestsPerSecond: 80, totalRequests: 800, successfulRequests: 780, failedRequests: 20 },
            memory: { heapUsed: 200, heapTotal: 250, external: 60, rss: 220, peak: 250 },
            cpu: { usage: 70, loadAverage: [1.2, 1.4, 1.3] },
            network: { bytesReceived: 800000, bytesSent: 400000, connections: 40 },
            errors: { total: 20, byType: new Map(), errorRate: 2.5 }
        };
        const baselineMetrics = {
            responseTime: { min: 8, max: 400, avg: 100, p50: 80, p95: 200, p99: 350 },
            throughput: { requestsPerSecond: 100, totalRequests: 1000, successfulRequests: 990, failedRequests: 10 },
            memory: { heapUsed: 150, heapTotal: 200, external: 50, rss: 180, peak: 200 },
            cpu: { usage: 50, loadAverage: [1.0, 1.1, 1.0] },
            network: { bytesReceived: 1000000, bytesSent: 500000, connections: 50 },
            errors: { total: 10, byType: new Map(), errorRate: 1.0 }
        };
        const regression = performanceFramework.detectRegression(currentMetrics, baselineMetrics);
        expect(regression).toHaveProperty('detected');
        expect(regression).toHaveProperty('details');
        expect(typeof regression.detected).toBe('boolean');
        expect(Array.isArray(regression.details)).toBe(true);
        // With these values, regression should be detected
        expect(regression.detected).toBe(true);
        expect(regression.details.length).toBeGreaterThan(0);
    });
    test('should create Artillery configuration', () => {
        const mockScenario = {
            name: 'test-scenario',
            description: 'Test scenario',
            duration: 60,
            virtualUsers: 10,
            rampUpTime: 10,
            endpoints: [
                {
                    name: 'test-endpoint',
                    method: 'GET',
                    url: '/api/test',
                    weight: 100,
                    expectedStatusCode: 200
                }
            ],
            thresholds: {
                responseTime: { avg: 500, p95: 1000, p99: 2000 },
                throughput: { minRequestsPerSecond: 10 },
                memory: { maxHeapUsed: 200, maxRss: 300 },
                cpu: { maxUsage: 80 },
                errorRate: { maxPercentage: 5 }
            }
        };
        const mockContext = {
            environment: 'test',
            test_type: 'performance',
            config: {},
            environment_config: {
                services: {
                    backend: { port: 3001, health_endpoint: '/health', timeout: 30, base_url: 'http://localhost:3001' }
                }
            },
            test_type_config: {},
            global_config: {}
        };
        const config = performanceFramework.createArtilleryConfig(mockScenario, mockContext);
        expect(typeof config).toBe('string');
        const parsedConfig = JSON.parse(config);
        expect(parsedConfig).toHaveProperty('config');
        expect(parsedConfig).toHaveProperty('scenarios');
        expect(parsedConfig.config).toHaveProperty('target');
        expect(parsedConfig.config).toHaveProperty('phases');
        expect(Array.isArray(parsedConfig.config.phases)).toBe(true);
        expect(parsedConfig.config.phases.length).toBe(2); // ramp-up and sustained load
        expect(Array.isArray(parsedConfig.scenarios)).toBe(true);
        expect(parsedConfig.scenarios.length).toBe(1);
        expect(parsedConfig.scenarios[0]).toHaveProperty('name', 'test-scenario');
    });
    test('should calculate average values correctly', () => {
        const values = [10, 20, 30, 40, 50];
        const average = performanceFramework.calculateAverage(values);
        expect(average).toBe(30);
    });
    test('should calculate CPU usage correctly', () => {
        const cpuMetrics = [
            { user: 1000000, system: 500000 },
            { user: 1200000, system: 600000 },
            { user: 1400000, system: 700000 }
        ];
        const cpuUsage = performanceFramework.calculateCpuUsage(cpuMetrics);
        expect(typeof cpuUsage).toBe('number');
        expect(cpuUsage).toBeGreaterThanOrEqual(0);
        expect(cpuUsage).toBeLessThanOrEqual(100);
    });
    test('should handle empty metrics gracefully', () => {
        const emptyMetrics = performanceFramework.getEmptyMetrics();
        expect(emptyMetrics).toHaveProperty('responseTime');
        expect(emptyMetrics).toHaveProperty('throughput');
        expect(emptyMetrics).toHaveProperty('memory');
        expect(emptyMetrics).toHaveProperty('cpu');
        expect(emptyMetrics).toHaveProperty('network');
        expect(emptyMetrics).toHaveProperty('errors');
        // All values should be zero or empty
        expect(emptyMetrics.responseTime.avg).toBe(0);
        expect(emptyMetrics.throughput.totalRequests).toBe(0);
        expect(emptyMetrics.memory.heapUsed).toBe(0);
        expect(emptyMetrics.cpu.usage).toBe(0);
        expect(emptyMetrics.errors.total).toBe(0);
    });
});
