#!/usr/bin/env node
/**
 * Example usage of the unified test runner framework
 * This demonstrates how to use TestRunner and TestReporter
 */
import TestRunner from './TestRunner.js';
import TestReporter from './TestReporter.js';
async function demonstrateTestRunner() {
    console.log('🚀 Demonstrating Unified Test Runner Framework\n');
    // Initialize the test runner
    const runner = new TestRunner();
    const reporter = new TestReporter('demo-reports');
    try {
        // Configure test options
        const testOptions = {
            environment: 'local',
            parallel: true,
            maxWorkers: 2,
            bail: false,
            verbose: true,
            collectCoverage: true,
            timeout: 30000
        };
        // Configure report options
        const reportOptions = {
            outputDir: 'demo-reports',
            formats: ['html', 'json', 'console'],
            includeArtifacts: true,
            openBrowser: false
        };
        console.log('📋 Test Configuration:');
        console.log(JSON.stringify(testOptions, null, 2));
        console.log('\n📄 Report Configuration:');
        console.log(JSON.stringify(reportOptions, null, 2));
        // Example 1: Create execution plan
        console.log('\n🗂️  Creating execution plan...');
        const plan = runner.createExecutionPlan(['unit', 'integration'], testOptions);
        console.log(`Created plan with ${plan.tests.length} test types`);
        console.log(`Parallel execution: ${plan.parallel}`);
        console.log(`Max concurrency: ${plan.maxConcurrency}`);
        // Example 2: Simulate test results (since we can't run actual tests in this demo)
        console.log('\n🧪 Simulating test results...');
        const mockResults = [
            {
                type: 'unit',
                passed: 25,
                failed: 2,
                skipped: 3,
                duration: 5000,
                artifacts: ['unit-test.log', 'coverage-unit.html'],
                exitCode: 1,
                output: 'Unit tests completed with some failures',
                startTime: new Date('2023-01-01T10:00:00Z'),
                endTime: new Date('2023-01-01T10:00:05Z'),
                coverage: {
                    overall: {
                        statements: { covered: 85, total: 100, percentage: 85 },
                        branches: { covered: 70, total: 90, percentage: 77.8 },
                        functions: { covered: 40, total: 50, percentage: 80 },
                        lines: { covered: 90, total: 110, percentage: 81.8 }
                    },
                    byFile: new Map(),
                    byDirectory: new Map(),
                    uncoveredLines: [],
                    thresholdsMet: true
                }
            },
            {
                type: 'integration',
                passed: 15,
                failed: 0,
                skipped: 1,
                duration: 8000,
                artifacts: ['integration-test.log', 'api-responses.json'],
                exitCode: 0,
                output: 'Integration tests passed successfully',
                startTime: new Date('2023-01-01T10:00:05Z'),
                endTime: new Date('2023-01-01T10:00:13Z')
            }
        ];
        // Example 3: Aggregate results
        console.log('\n📊 Aggregating test results...');
        const summary = reporter.aggregateResults(mockResults);
        console.log(`Total tests: ${summary.totalTests}`);
        console.log(`Passed: ${summary.totalPassed}`);
        console.log(`Failed: ${summary.totalFailed}`);
        console.log(`Skipped: ${summary.totalSkipped}`);
        console.log(`Success: ${summary.success ? '✅' : '❌'}`);
        console.log(`Duration: ${summary.totalDuration}ms`);
        if (summary.overallCoverage) {
            console.log(`Coverage: ${summary.overallCoverage.lines.percentage.toFixed(1)}%`);
        }
        // Example 4: Collect artifacts
        console.log('\n📎 Collecting artifacts...');
        const artifacts = reporter.collectArtifacts(mockResults);
        console.log(`Screenshots: ${artifacts.screenshots.length}`);
        console.log(`Videos: ${artifacts.videos.length}`);
        console.log(`Logs: ${artifacts.logs.length}`);
        console.log(`Coverage reports: ${artifacts.coverageReports.length}`);
        console.log(`Other: ${artifacts.other.length}`);
        // Example 5: Generate reports
        console.log('\n📄 Generating reports...');
        const reportPaths = await reporter.generateReport(mockResults, reportOptions, 'demo');
        console.log('\n✅ Generated reports:');
        reportPaths.forEach(path => {
            console.log(`  - ${path}`);
        });
        console.log('\n🎉 Demo completed successfully!');
        console.log('\nKey features demonstrated:');
        console.log('  ✅ Unified test execution interface');
        console.log('  ✅ Parallel test execution planning');
        console.log('  ✅ Comprehensive result aggregation');
        console.log('  ✅ Multi-format report generation');
        console.log('  ✅ Artifact collection and categorization');
        console.log('  ✅ Coverage metrics aggregation');
    }
    catch (error) {
        console.error('❌ Demo failed:', error);
        process.exit(1);
    }
    finally {
        // Clean up
        runner.cleanup();
    }
}
// Run the demonstration
if (import.meta.url === `file://${process.argv[1]}`) {
    demonstrateTestRunner().catch(error => {
        console.error('❌ Demonstration failed:', error);
        process.exit(1);
    });
}
export { demonstrateTestRunner };
