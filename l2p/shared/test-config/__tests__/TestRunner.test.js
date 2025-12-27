/**
 * Tests for TestRunner class
 */
import TestRunner from '../TestRunner';
import TestReporter from '../TestReporter';
import { TestConfigManager } from '../TestConfigManager';
// Mock dependencies
jest.mock('../TestConfigManager');
jest.mock('child_process');
jest.mock('fs');
describe('TestRunner', () => {
    let testRunner;
    let mockConfigManager;
    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        // Mock TestConfigManager
        mockConfigManager = {
            createExecutionContext: jest.fn().mockReturnValue({
                environment: 'local',
                test_type: 'unit',
                config: {},
                environment_config: {
                    coverage: { threshold: { statements: 80, branches: 75, functions: 80, lines: 80 } },
                    reporting: { formats: ['html'], output_dir: 'coverage' }
                },
                test_type_config: {
                    timeout: 10000,
                    parallel: true,
                    max_workers: '50%',
                    bail: false,
                    verbose: false,
                    collect_coverage: true
                },
                global_config: {
                    clear_mocks: true,
                    reset_mocks: true,
                    restore_mocks: true
                }
            }),
            performHealthCheck: jest.fn().mockResolvedValue({
                environment: 'local',
                status: 'ready',
                services: [],
                database_connected: true
            })
        };
        TestConfigManager.getInstance.mockReturnValue(mockConfigManager);
        testRunner = new TestRunner();
    });
    afterEach(() => {
        testRunner.cleanup();
    });
    describe('constructor', () => {
        it('should create TestRunner instance', () => {
            expect(testRunner).toBeInstanceOf(TestRunner);
        });
        it('should initialize with config manager', () => {
            expect(TestConfigManager.getInstance).toHaveBeenCalled();
        });
    });
    describe('createExecutionPlan', () => {
        it('should create execution plan for multiple test types', () => {
            const options = {
                environment: 'local',
                parallel: true,
                maxWorkers: 2
            };
            const plan = testRunner.createExecutionPlan(['unit', 'integration'], options);
            expect(plan.tests).toHaveLength(2);
            expect(plan.parallel).toBe(true);
            expect(plan.maxConcurrency).toBe(2);
            expect(plan.tests[0].type).toBe('unit');
            expect(plan.tests[0].command).toBe('npm');
            expect(plan.tests[0].args).toContain('test:unit');
            expect(plan.tests[1].type).toBe('integration');
            expect(plan.tests[1].command).toBe('npm');
            expect(plan.tests[1].args).toContain('test:integration');
        });
        it('should handle percentage-based max workers', () => {
            const options = {
                environment: 'local',
                maxWorkers: '50%'
            };
            const plan = testRunner.createExecutionPlan(['unit'], options);
            // Should calculate based on CPU count
            expect(plan.maxConcurrency).toBeGreaterThan(0);
        });
    });
    describe('cleanup', () => {
        it('should cleanup running processes', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            testRunner.cleanup();
            expect(consoleSpy).toHaveBeenCalledWith('🧹 Cleaning up test processes...');
            consoleSpy.mockRestore();
        });
    });
});
describe('TestReporter', () => {
    let testReporter;
    let mockResults;
    beforeEach(() => {
        testReporter = new TestReporter('test-output');
        mockResults = [
            {
                type: 'unit',
                passed: 10,
                failed: 1,
                skipped: 2,
                duration: 5000,
                artifacts: ['test1.log'],
                exitCode: 1,
                output: 'Test output',
                startTime: new Date('2023-01-01T10:00:00Z'),
                endTime: new Date('2023-01-01T10:00:05Z')
            },
            {
                type: 'integration',
                passed: 5,
                failed: 0,
                skipped: 1,
                duration: 3000,
                artifacts: ['test2.log', 'screenshot.png'],
                exitCode: 0,
                output: 'Integration test output',
                startTime: new Date('2023-01-01T10:00:05Z'),
                endTime: new Date('2023-01-01T10:00:08Z')
            }
        ];
    });
    describe('aggregateResults', () => {
        it('should aggregate test results correctly', () => {
            const summary = testReporter.aggregateResults(mockResults);
            expect(summary.totalTests).toBe(19); // 10+1+2 + 5+0+1
            expect(summary.totalPassed).toBe(15); // 10 + 5
            expect(summary.totalFailed).toBe(1); // 1 + 0
            expect(summary.totalSkipped).toBe(3); // 2 + 1
            expect(summary.totalDuration).toBe(8000); // 5000 + 3000
            expect(summary.success).toBe(false); // has failures
            expect(summary.testsByType.size).toBe(2);
        });
        it('should mark as success when no failures', () => {
            const successResults = mockResults.map(r => ({ ...r, failed: 0, exitCode: 0 }));
            const summary = testReporter.aggregateResults(successResults);
            expect(summary.success).toBe(true);
        });
    });
    describe('collectArtifacts', () => {
        it('should categorize artifacts correctly', () => {
            const artifacts = testReporter.collectArtifacts(mockResults);
            expect(artifacts.logs).toContain('test1.log');
            expect(artifacts.logs).toContain('test2.log');
            expect(artifacts.screenshots).toContain('screenshot.png');
            expect(artifacts.videos).toHaveLength(0);
            expect(artifacts.coverageReports).toHaveLength(0);
        });
    });
    describe('aggregateCoverage', () => {
        it('should return undefined for empty coverage reports', () => {
            const coverage = testReporter.aggregateCoverage([]);
            expect(coverage).toBeUndefined();
        });
        it('should aggregate coverage metrics', () => {
            const coverageReports = [
                {
                    overall: {
                        statements: { covered: 80, total: 100, percentage: 80 },
                        branches: { covered: 60, total: 80, percentage: 75 },
                        functions: { covered: 40, total: 50, percentage: 80 },
                        lines: { covered: 90, total: 110, percentage: 81.8 }
                    },
                    byFile: new Map(),
                    byDirectory: new Map(),
                    uncoveredLines: [],
                    thresholdsMet: true
                },
                {
                    overall: {
                        statements: { covered: 70, total: 90, percentage: 77.8 },
                        branches: { covered: 50, total: 70, percentage: 71.4 },
                        functions: { covered: 30, total: 40, percentage: 75 },
                        lines: { covered: 80, total: 100, percentage: 80 }
                    },
                    byFile: new Map(),
                    byDirectory: new Map(),
                    uncoveredLines: [],
                    thresholdsMet: true
                }
            ];
            const aggregated = testReporter.aggregateCoverage(coverageReports);
            expect(aggregated).toBeDefined();
            expect(aggregated.statements.covered).toBe(150); // 80 + 70
            expect(aggregated.statements.total).toBe(190); // 100 + 90
            expect(aggregated.statements.percentage).toBeCloseTo(78.9, 1);
        });
    });
});
describe('Integration Tests', () => {
    it('should work together - TestRunner and TestReporter', async () => {
        const runner = new TestRunner();
        const reporter = new TestReporter();
        // Mock a successful test result
        const mockResult = {
            type: 'unit',
            passed: 5,
            failed: 0,
            skipped: 1,
            duration: 2000,
            artifacts: [],
            exitCode: 0,
            output: 'All tests passed',
            startTime: new Date(),
            endTime: new Date()
        };
        // Test aggregation
        const summary = reporter.aggregateResults([mockResult]);
        expect(summary.success).toBe(true);
        expect(summary.totalTests).toBe(6);
        expect(summary.testsByType.get('unit')).toEqual(mockResult);
        runner.cleanup();
    });
});
