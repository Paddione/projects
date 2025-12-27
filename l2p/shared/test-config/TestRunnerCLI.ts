#!/usr/bin/env node

/**
 * Command Line Interface for Unified Test Runner
 * Provides easy access to all testing capabilities
 */

import { Command } from 'commander';
import TestRunner, { TestRunnerOptions } from './TestRunner.js';
import TestReporter, { ReportOptions, ReportFormat } from './TestReporter.js';
import { TestEnvironmentType, TestType } from './types.js';

const program = new Command();

program
  .name('test-runner')
  .description('Unified test runner for Learn2Play application')
  .version('1.0.0');

// Global options
program
  .option('-e, --environment <env>', 'test environment (local, ci, docker)', 'local')
  .option('-v, --verbose', 'verbose output', false)
  .option('-b, --bail', 'stop on first failure', false)
  .option('--no-coverage', 'disable coverage collection')
  .option('-w, --workers <number>', 'number of parallel workers')
  .option('-t, --timeout <ms>', 'test timeout in milliseconds')
  .option('-o, --output <dir>', 'output directory for reports', 'test-reports')
  .option('--formats <formats>', 'report formats (html,json,xml,markdown,console)', 'html,console')
  .option('--open', 'open HTML report in browser', false);

// Unit tests command
program
  .command('unit')
  .description('run unit tests')
  .action(async (options) => {
    await runTests('unit', getOptions(options));
  });

// Integration tests command
program
  .command('integration')
  .description('run integration tests')
  .action(async (options) => {
    await runTests('integration', getOptions(options));
  });

// E2E tests command
program
  .command('e2e')
  .description('run end-to-end tests')
  .action(async (options) => {
    await runTests('e2e', getOptions(options));
  });

// Performance tests command
program
  .command('performance')
  .description('run performance tests')
  .action(async (options) => {
    await runTests('performance', getOptions(options));
  });

// Accessibility tests command
program
  .command('accessibility')
  .description('run accessibility tests')
  .action(async (options) => {
    await runTests('accessibility', getOptions(options));
  });

// All tests command
program
  .command('all')
  .description('run all test types')
  .action(async (options) => {
    await runAllTests(getOptions(options));
  });

// Watch mode command
program
  .command('watch')
  .description('run tests in watch mode')
  .option('-t, --type <type>', 'test type to watch (unit, integration, e2e)', 'unit')
  .action(async (options) => {
    await watchTests(options.type, getOptions(options));
  });

// Report generation command
program
  .command('report')
  .description('generate test report from existing results')
  .option('-i, --input <file>', 'input JSON results file')
  .action(async (options) => {
    await generateReport(getOptions(options), options.input);
  });

// Environment health check command
program
  .command('health')
  .description('check test environment health')
  .action(async (options) => {
    await checkHealth(getOptions(options));
  });

/**
 * Run specific test type
 */
async function runTests(testType: TestType, options: TestRunnerOptions & ReportOptions): Promise<void> {
  const runner = new TestRunner();
  const reporter = new TestReporter(options.outputDir);

  try {
    console.log(`🚀 Running ${testType} tests...`);
    console.log(`📊 Environment: ${options.environment}`);
    console.log(`⚙️  Options: ${JSON.stringify(options, null, 2)}`);

    const startTime = Date.now();
    let result;

    switch (testType) {
      case 'unit':
        result = await runner.runUnit(options);
        break;
      case 'integration':
        result = await runner.runIntegration(options);
        break;
      case 'e2e':
        result = await runner.runE2E(options);
        break;
      case 'performance':
        result = await runner.runPerformance(options);
        break;
      case 'accessibility':
        result = await runner.runAccessibility(options);
        break;
      default:
        throw new Error(`Unknown test type: ${testType}`);
    }

    const duration = Date.now() - startTime;
    console.log(`\n⏱️  Total execution time: ${formatDuration(duration)}`);

    // Generate reports
    const reportPaths = await reporter.generateReport([result], options, options.environment);
    
    console.log('\n📄 Generated reports:');
    reportPaths.forEach(path => console.log(`  - ${path}`));

    // Exit with appropriate code
    process.exit(result.exitCode);

  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  } finally {
    runner.cleanup();
  }
}

/**
 * Run all test types
 */
async function runAllTests(options: TestRunnerOptions & ReportOptions): Promise<void> {
  const runner = new TestRunner();
  const reporter = new TestReporter(options.outputDir);

  try {
    console.log('🚀 Running comprehensive test suite...');
    console.log(`📊 Environment: ${options.environment}`);

    const startTime = Date.now();
    const results = await runner.runAll(options);
    const duration = Date.now() - startTime;

    console.log(`\n⏱️  Total execution time: ${formatDuration(duration)}`);

    // Generate comprehensive report
    const reportPaths = await reporter.generateReport(results, options, options.environment);
    
    console.log('\n📄 Generated reports:');
    reportPaths.forEach(path => console.log(`  - ${path}`));

    // Print summary
    const summary = reporter.aggregateResults(results);
    console.log('\n📊 Test Summary:');
    console.log(`  Total: ${summary.totalTests}`);
    console.log(`  Passed: ${summary.totalPassed}`);
    console.log(`  Failed: ${summary.totalFailed}`);
    console.log(`  Skipped: ${summary.totalSkipped}`);
    console.log(`  Success: ${summary.success ? '✅' : '❌'}`);

    if (summary.overallCoverage) {
      console.log(`  Coverage: ${summary.overallCoverage.lines.percentage.toFixed(1)}%`);
    }

    // Exit with appropriate code
    process.exit(summary.success ? 0 : 1);

  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  } finally {
    runner.cleanup();
  }
}

/**
 * Watch tests for changes
 */
async function watchTests(testType: TestType, options: TestRunnerOptions): Promise<void> {
  console.log(`👀 Watching ${testType} tests for changes...`);
  console.log('Press Ctrl+C to stop watching');

  const chokidar = require('chokidar');
  const runner = new TestRunner();

  // Watch for file changes
  const watchPaths = [
    'frontend/src/**/*.{ts,tsx}',
    'backend/src/**/*.ts',
    'shared/**/*.ts'
  ];

  const watcher = chokidar.watch(watchPaths, {
    ignored: /node_modules|\.git|dist|coverage/,
    persistent: true
  });

  let isRunning = false;

  const runTest = async () => {
    if (isRunning) return;
    
    isRunning = true;
    try {
      console.log(`\n🔄 Running ${testType} tests...`);
      
      let result;
      switch (testType) {
        case 'unit':
          result = await runner.runUnit(options);
          break;
        case 'integration':
          result = await runner.runIntegration(options);
          break;
        default:
          console.log(`Watch mode not supported for ${testType} tests`);
          return;
      }

      console.log(`\n${result.failed > 0 ? '❌' : '✅'} Tests completed: ${result.passed} passed, ${result.failed} failed`);
      
    } catch (error) {
      console.error('❌ Test execution failed:', error);
    } finally {
      isRunning = false;
    }
  };

  // Initial run
  await runTest();

  // Watch for changes
  watcher.on('change', (path: string) => {
    console.log(`\n📝 File changed: ${path}`);
    runTest();
  });

  // Handle cleanup
  process.on('SIGINT', () => {
    console.log('\n👋 Stopping watch mode...');
    watcher.close();
    runner.cleanup();
    process.exit(0);
  });
}

/**
 * Generate report from existing results
 */
async function generateReport(options: ReportOptions, inputFile?: string): Promise<void> {
  if (!inputFile) {
    console.error('❌ Input file required for report generation');
    process.exit(1);
  }

  try {
    const fs = require('fs');
    const resultsData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
    
    const reporter = new TestReporter(options.outputDir);
    const reportPaths = await reporter.generateReport(resultsData.results, options, resultsData.environment);
    
    console.log('📄 Generated reports:');
    reportPaths.forEach(path => console.log(`  - ${path}`));
    
  } catch (error) {
    console.error('❌ Report generation failed:', error);
    process.exit(1);
  }
}

/**
 * Check environment health
 */
async function checkHealth(options: TestRunnerOptions): Promise<void> {
  try {
    const { TestConfigManager } = require('./TestConfigManager');
    const configManager = TestConfigManager.getInstance();
    
    console.log(`🔍 Checking ${options.environment} environment health...`);
    
    const status = await configManager.performHealthCheck(options.environment);
    
    console.log(`\n📊 Environment Status: ${status.status}`);
    console.log(`🗄️  Database Connected: ${status.database_connected ? '✅' : '❌'}`);
    
    if (status.setup_time) {
      console.log(`⏱️  Setup Time: ${formatDuration(status.setup_time)}`);
    }
    
    console.log('\n🔧 Services:');
    for (const service of status.services) {
      const statusIcon = service.status === 'healthy' ? '✅' : service.status === 'timeout' ? '⏰' : '❌';
      console.log(`  ${statusIcon} ${service.service}: ${service.status}`);
      if (service.response_time) {
        console.log(`     Response time: ${service.response_time}ms`);
      }
      if (service.error) {
        console.log(`     Error: ${service.error}`);
      }
    }
    
    if (status.error) {
      console.log(`\n❌ Error: ${status.error}`);
      process.exit(1);
    }
    
    if (status.status !== 'ready') {
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Health check failed:', error);
    process.exit(1);
  }
}

/**
 * Get options from command line arguments
 */
function getOptions(cmdOptions: any): TestRunnerOptions & ReportOptions {
  const globalOptions = program.opts();
  
  return {
    environment: globalOptions.environment as TestEnvironmentType,
    parallel: !globalOptions.bail,
    maxWorkers: globalOptions.workers ? parseInt(globalOptions.workers, 10) : undefined,
    bail: globalOptions.bail,
    verbose: globalOptions.verbose,
    collectCoverage: globalOptions.coverage !== false,
    outputDir: globalOptions.output,
    timeout: globalOptions.timeout ? parseInt(globalOptions.timeout, 10) : undefined,
    formats: globalOptions.formats.split(',') as ReportFormat[],
    includeArtifacts: true,
    openBrowser: globalOptions.open
  };
}

/**
 * Format duration in human-readable format
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  } else if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  } else {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(1);
    return `${minutes}m ${seconds}s`;
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Parse command line arguments
if (require.main === module) {
  program.parse();
}

export { program };
export default program;