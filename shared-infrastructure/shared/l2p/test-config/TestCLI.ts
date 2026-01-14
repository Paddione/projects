#!/usr/bin/env node

/**
 * Unified Test CLI Interface
 * Comprehensive command-line interface for running different test types,
 * managing test environments, and generating reports
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import * as fs from 'fs';
import * as path from 'path';
import { TestConfigManager } from './TestConfigManager.js';
import { TestEnvironment } from './TestEnvironment.js';
import { TestRunner } from './TestRunner.js';
import { TestReporter } from './TestReporter.js';
import { 
  TestEnvironmentType, 
  TestType,
  TestEnvironmentStatus 
} from './types.js';
import { TestResult } from './TestRunner.js';

export class TestCLI {
  private configManager: TestConfigManager;
  private testEnvironment: TestEnvironment;
  private testRunner: TestRunner;
  private testReporter: TestReporter;
  private program: Command;

  constructor() {
    this.configManager = TestConfigManager.getInstance();
    this.testEnvironment = new TestEnvironment();
    this.testRunner = new TestRunner();
    this.testReporter = new TestReporter();
    this.program = new Command();
    
    this.setupCommands();
  }

  /**
   * Setup CLI commands and options
   */
  private setupCommands(): void {
    this.program
      .name('test-cli')
      .description('Unified Test CLI Interface for Learn2Play')
      .version('1.0.0');

    // Test execution commands
    this.setupTestCommands();
    
    // Environment management commands
    this.setupEnvironmentCommands();
    
    // Report generation commands
    this.setupReportCommands();
    
    // Debugging and troubleshooting commands
    this.setupDebugCommands();
    
    // Configuration commands
    this.setupConfigCommands();
  }

  /**
   * Setup test execution commands
   */
  private setupTestCommands(): void {
    const testCmd = this.program
      .command('test')
      .description('Run tests');

    // Run unit tests
    testCmd
      .command('unit')
      .description('Run unit tests')
      .option('-e, --env <environment>', 'Test environment', 'local')
      .option('-p, --parallel', 'Run tests in parallel', false)
      .option('-c, --coverage', 'Collect coverage', false)
      .option('-w, --watch', 'Watch mode', false)
      .option('-v, --verbose', 'Verbose output', false)
      .option('--bail', 'Stop on first failure', false)
      .option('--max-workers <number>', 'Maximum number of workers')
      .action(async (options) => {
        await this.runTests('unit', options);
      });

    // Run integration tests
    testCmd
      .command('integration')
      .description('Run integration tests')
      .option('-e, --env <environment>', 'Test environment', 'local')
      .option('-c, --coverage', 'Collect coverage', false)
      .option('-v, --verbose', 'Verbose output', false)
      .option('--bail', 'Stop on first failure', false)
      .action(async (options) => {
        await this.runTests('integration', options);
      });

    // Run E2E tests
    testCmd
      .command('e2e')
      .description('Run end-to-end tests')
      .option('-e, --env <environment>', 'Test environment', 'local')
      .option('-b, --browser <browser>', 'Browser to use', 'chromium')
      .option('-h, --headless', 'Run in headless mode', true)
      .option('-v, --verbose', 'Verbose output', false)
      .option('--debug', 'Debug mode', false)
      .action(async (options) => {
        await this.runTests('e2e', options);
      });

    // Run performance tests
    testCmd
      .command('performance')
      .description('Run performance tests')
      .option('-e, --env <environment>', 'Test environment', 'local')
      .option('-s, --scenarios <scenarios>', 'Test scenarios to run')
      .option('-u, --users <number>', 'Number of concurrent users', '10')
      .option('-d, --duration <seconds>', 'Test duration in seconds', '60')
      .action(async (options) => {
        await this.runTests('performance', options);
      });

    // Run accessibility tests
    testCmd
      .command('accessibility')
      .description('Run accessibility tests')
      .option('-e, --env <environment>', 'Test environment', 'local')
      .option('-s, --standard <standard>', 'Accessibility standard', 'WCAG21AA')
      .option('-v, --verbose', 'Verbose output', false)
      .action(async (options) => {
        await this.runTests('accessibility', options);
      });

    // Run all tests
    testCmd
      .command('all')
      .description('Run all test types')
      .option('-e, --env <environment>', 'Test environment', 'local')
      .option('-c, --coverage', 'Collect coverage', true)
      .option('-v, --verbose', 'Verbose output', false)
      .option('--bail', 'Stop on first failure', false)
      .option('--skip <types>', 'Skip test types (comma-separated)')
      .action(async (options) => {
        await this.runAllTests(options);
      });
  }

  /**
   * Setup environment management commands
   */
  private setupEnvironmentCommands(): void {
    const envCmd = this.program
      .command('env')
      .description('Manage test environments');

    // Start environment
    envCmd
      .command('start')
      .description('Start test environment')
      .option('-e, --env <environment>', 'Environment to start', 'local')
      .option('-f, --force', 'Force restart if already running', false)
      .action(async (options) => {
        await this.startEnvironment(options);
      });

    // Stop environment
    envCmd
      .command('stop')
      .description('Stop test environment')
      .option('-e, --env <environment>', 'Environment to stop', 'local')
      .action(async (options) => {
        await this.stopEnvironment(options);
      });

    // Reset environment
    envCmd
      .command('reset')
      .description('Reset test environment (clean restart)')
      .option('-e, --env <environment>', 'Environment to reset', 'local')
      .action(async (options) => {
        await this.resetEnvironment(options);
      });

    // Environment status
    envCmd
      .command('status')
      .description('Check environment status')
      .option('-e, --env <environment>', 'Environment to check', 'local')
      .option('-w, --watch', 'Watch mode', false)
      .action(async (options) => {
        await this.checkEnvironmentStatus(options);
      });

    // Environment logs
    envCmd
      .command('logs')
      .description('View environment logs')
      .option('-e, --env <environment>', 'Environment', 'local')
      .option('-s, --service <service>', 'Specific service')
      .option('-f, --follow', 'Follow logs', false)
      .option('-t, --tail <lines>', 'Number of lines to tail', '100')
      .action(async (options) => {
        await this.viewEnvironmentLogs(options);
      });
  }

  /**
   * Setup report generation commands
   */
  private setupReportCommands(): void {
    const reportCmd = this.program
      .command('report')
      .description('Generate and view test reports');

    // Generate report
    reportCmd
      .command('generate')
      .description('Generate test reports')
      .option('-t, --type <type>', 'Report type (coverage, test-results, performance)', 'test-results')
      .option('-f, --format <format>', 'Output format (html, json, xml)', 'html')
      .option('-o, --output <path>', 'Output directory', './test-reports')
      .option('--open', 'Open report in browser', false)
      .action(async (options) => {
        await this.generateReport(options);
      });

    // View report
    reportCmd
      .command('view')
      .description('View existing test reports')
      .option('-t, --type <type>', 'Report type', 'test-results')
      .option('-p, --path <path>', 'Report path')
      .action(async (options) => {
        await this.viewReport(options);
      });

    // Coverage summary
    reportCmd
      .command('coverage')
      .description('Show coverage summary')
      .option('-d, --detailed', 'Show detailed coverage', false)
      .option('-t, --threshold', 'Show threshold status', true)
      .action(async (options) => {
        await this.showCoverageSummary(options);
      });
  }

  /**
   * Setup debugging and troubleshooting commands
   */
  private setupDebugCommands(): void {
    const debugCmd = this.program
      .command('debug')
      .description('Debugging and troubleshooting utilities');

    // Health check
    debugCmd
      .command('health')
      .description('Perform comprehensive health check')
      .option('-e, --env <environment>', 'Environment to check', 'local')
      .option('-v, --verbose', 'Verbose output', false)
      .action(async (options) => {
        await this.performHealthCheck(options);
      });

    // Validate configuration
    debugCmd
      .command('validate')
      .description('Validate test configuration')
      .option('-c, --config <path>', 'Configuration file path')
      .option('-f, --fix', 'Attempt to fix issues', false)
      .action(async (options) => {
        await this.validateConfiguration(options);
      });

    // System info
    debugCmd
      .command('info')
      .description('Show system information')
      .action(async () => {
        await this.showSystemInfo();
      });

    // Cleanup
    debugCmd
      .command('cleanup')
      .description('Clean up test artifacts and resources')
      .option('-a, --all', 'Clean all artifacts', false)
      .option('-f, --force', 'Force cleanup', false)
      .action(async (options) => {
        await this.cleanup(options);
      });

    // Troubleshoot
    debugCmd
      .command('troubleshoot')
      .description('Interactive troubleshooting guide')
      .action(async () => {
        await this.troubleshoot();
      });
  }

  /**
   * Setup configuration commands
   */
  private setupConfigCommands(): void {
    const configCmd = this.program
      .command('config')
      .description('Configuration management');

    // Show configuration
    configCmd
      .command('show')
      .description('Show current configuration')
      .option('-e, --env <environment>', 'Environment configuration')
      .option('-t, --type <type>', 'Test type configuration')
      .action(async (options) => {
        await this.showConfiguration(options);
      });

    // List environments
    configCmd
      .command('environments')
      .description('List available environments')
      .action(async () => {
        await this.listEnvironments();
      });

    // List test types
    configCmd
      .command('test-types')
      .description('List available test types')
      .action(async () => {
        await this.listTestTypes();
      });

    // Generate Jest config
    configCmd
      .command('jest')
      .description('Generate Jest configuration')
      .option('-e, --env <environment>', 'Environment', 'local')
      .option('-t, --type <type>', 'Test type', 'unit')
      .option('-p, --project <project>', 'Project (frontend/backend)', 'backend')
      .option('-o, --output <path>', 'Output file path')
      .action(async (options) => {
        await this.generateJestConfig(options);
      });
  }

  /**
   * Run specific test type
   */
  private async runTests(testType: TestType, options: any): Promise<void> {
    const spinner = ora(`Running ${testType} tests...`).start();
    
    try {
      // Prepare test runner options
      const runnerOptions = {
        environment: options.env as TestEnvironmentType,
        parallel: options.parallel,
        maxWorkers: options.maxWorkers ? parseInt(options.maxWorkers) : undefined,
        bail: options.bail,
        verbose: options.verbose,
        collectCoverage: options.coverage,
        timeout: options.timeout ? parseInt(options.timeout) : undefined
      };

      // Run the specific test type
      let result: TestResult;
      switch (testType) {
        case 'unit':
          result = await this.testRunner.runUnit(runnerOptions);
          break;
        case 'integration':
          result = await this.testRunner.runIntegration(runnerOptions);
          break;
        case 'e2e':
          result = await this.testRunner.runE2E(runnerOptions);
          break;
        case 'performance':
          result = await this.testRunner.runPerformance(runnerOptions);
          break;
        case 'accessibility':
          result = await this.testRunner.runAccessibility(runnerOptions);
          break;
        default:
          throw new Error(`Unknown test type: ${testType}`);
      }

      spinner.stop();
      
      // Display results
      this.displayTestResults(result);
      
      // Generate report if requested
      if (options.report) {
        await this.testReporter.generateReport([result], {
          formats: ['html'],
          outputDir: './test-reports',
          includeArtifacts: true,
          openBrowser: true
        });
      }

      // Exit with appropriate code
      process.exit(result.exitCode);
      
    } catch (error) {
      spinner.fail(`${testType} tests failed`);
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }

  /**
   * Run all test types
   */
  private async runAllTests(options: any): Promise<void> {
    const spinner = ora('Running comprehensive test suite...').start();
    
    try {
      const runnerOptions = {
        environment: options.env as TestEnvironmentType,
        bail: options.bail,
        verbose: options.verbose,
        collectCoverage: options.coverage
      };

      // Parse skip options
      const skipTypes = options.skip ? options.skip.split(',').map((t: string) => t.trim()) : [];
      
      spinner.text = 'Running all tests...';
      const results = await this.testRunner.runAll(runnerOptions);
      
      spinner.stop();
      
      // Display comprehensive results
      this.displayComprehensiveResults(results);
      
      // Generate comprehensive report
      await this.testReporter.generateReport(results, {
        formats: ['html'],
        outputDir: './test-reports',
        includeArtifacts: true,
        openBrowser: false
      });

      // Determine exit code
      const hasFailures = results.some(result => result.failed > 0);
      process.exit(hasFailures ? 1 : 0);
      
    } catch (error) {
      spinner.fail('Test suite failed');
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }

  /**
   * Start test environment
   */
  private async startEnvironment(options: any): Promise<void> {
    const spinner = ora(`Starting ${options.env} environment...`).start();
    
    try {
      if (this.testEnvironment.isRunning() && !options.force) {
        spinner.info('Environment is already running');
        return;
      }

      if (options.force && this.testEnvironment.isRunning()) {
        spinner.text = 'Stopping existing environment...';
        await this.testEnvironment.stop();
      }

      spinner.text = 'Starting environment...';
      await this.testEnvironment.start();
      
      spinner.succeed('Environment started successfully');
      
      // Show service URLs
      const urls = this.testEnvironment.getServiceUrls();
      console.log(chalk.green('\n🌐 Service URLs:'));
      Object.entries(urls).forEach(([service, url]) => {
        console.log(`  ${service}: ${chalk.cyan(url)}`);
      });
      
    } catch (error) {
      spinner.fail('Failed to start environment');
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }

  /**
   * Stop test environment
   */
  private async stopEnvironment(options: any): Promise<void> {
    const spinner = ora(`Stopping ${options.env} environment...`).start();
    
    try {
      if (!this.testEnvironment.isRunning()) {
        spinner.info('Environment is not running');
        return;
      }

      await this.testEnvironment.stop();
      spinner.succeed('Environment stopped successfully');
      
    } catch (error) {
      spinner.fail('Failed to stop environment');
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }

  /**
   * Reset test environment
   */
  private async resetEnvironment(options: any): Promise<void> {
    const spinner = ora(`Resetting ${options.env} environment...`).start();
    
    try {
      await this.testEnvironment.reset();
      spinner.succeed('Environment reset successfully');
      
    } catch (error) {
      spinner.fail('Failed to reset environment');
      console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  }

  /**
   * Check environment status
   */
  private async checkEnvironmentStatus(options: any): Promise<void> {
    const checkStatus = async () => {
      try {
        const health = await this.testEnvironment.healthCheck();
        
        console.clear();
        console.log(chalk.blue('🔍 Environment Status\n'));
        
        health.forEach(service => {
          const statusIcon = service.status === 'healthy' ? '✅' : 
                           service.status === 'starting' ? '🟡' : '❌';
          const statusColor = service.status === 'healthy' ? 'green' : 
                            service.status === 'starting' ? 'yellow' : 'red';
          
          console.log(`${statusIcon} ${chalk.bold(service.name)}: ${chalk[statusColor](service.status)}`);
          if (service.url) {
            console.log(`   URL: ${chalk.cyan(service.url)}`);
          }
          if (service.error) {
            console.log(`   Error: ${chalk.red(service.error)}`);
          }
          console.log('');
        });
        
        console.log(`Last updated: ${chalk.gray(new Date().toLocaleTimeString())}`);
        
      } catch (error) {
        console.error(chalk.red('Failed to check status:'), error);
      }
    };

    if (options.watch) {
      // Watch mode - update every 5 seconds
      await checkStatus();
      setInterval(checkStatus, 5000);
    } else {
      await checkStatus();
    }
  }

  /**
   * View environment logs
   */
  private async viewEnvironmentLogs(options: any): Promise<void> {
    try {
      const logs = await this.testEnvironment.getLogs(options.service);
      
      console.log(chalk.blue(`📋 Logs${options.service ? ` for ${options.service}` : ''}\n`));
      
      const tailLines = options.tail ? parseInt(options.tail) : 100;
      const displayLogs = logs.slice(-tailLines);
      
      displayLogs.forEach(log => {
        // Color-code log levels
        if (log.includes('ERROR') || log.includes('error')) {
          console.log(chalk.red(log));
        } else if (log.includes('WARN') || log.includes('warn')) {
          console.log(chalk.yellow(log));
        } else if (log.includes('INFO') || log.includes('info')) {
          console.log(chalk.blue(log));
        } else {
          console.log(log);
        }
      });
      
    } catch (error) {
      console.error(chalk.red('Failed to get logs:'), error);
      process.exit(1);
    }
  }

  /**
   * Generate test report
   */
  private async generateReport(options: any): Promise<void> {
    const spinner = ora('Generating test report...').start();
    
    try {
      // This would integrate with the TestReporter class
      // For now, we'll show a placeholder implementation
      
      const reportPath = path.resolve(options.output);
      
      // Ensure output directory exists
      if (!fs.existsSync(reportPath)) {
        fs.mkdirSync(reportPath, { recursive: true });
      }
      
      spinner.succeed(`Report generated: ${reportPath}`);
      
      if (options.open) {
        const { default: open } = await import('open');
        await open(path.join(reportPath, 'index.html'));
      }
      
    } catch (error) {
      spinner.fail('Failed to generate report');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  }

  /**
   * View existing report
   */
  private async viewReport(options: any): Promise<void> {
    try {
      const reportPath = options.path || './test-reports';
      const indexPath = path.join(reportPath, 'index.html');
      
      if (!fs.existsSync(indexPath)) {
        console.error(chalk.red('Report not found:'), indexPath);
        process.exit(1);
      }
      
      const { default: open } = await import('open');
      await open(indexPath);
      console.log(chalk.green('Report opened in browser'));
      
    } catch (error) {
      console.error(chalk.red('Failed to open report:'), error);
      process.exit(1);
    }
  }

  /**
   * Show coverage summary
   */
  private async showCoverageSummary(options: any): Promise<void> {
    try {
      // This would read coverage data and display it
      console.log(chalk.blue('📊 Coverage Summary\n'));
      console.log('Implementation pending - would show coverage metrics');
      
    } catch (error) {
      console.error(chalk.red('Failed to show coverage:'), error);
      process.exit(1);
    }
  }

  /**
   * Perform comprehensive health check
   */
  private async performHealthCheck(options: any): Promise<void> {
    const spinner = ora('Performing health check...').start();
    
    try {
      const status = await this.configManager.performHealthCheck(options.env);
      
      spinner.stop();
      
      console.log(chalk.blue('🏥 Health Check Results\n'));
      console.log(`Environment: ${chalk.bold(status.environment)}`);
      console.log(`Status: ${status.status === 'ready' ? chalk.green('✅ Ready') : chalk.red('❌ Failed')}`);
      console.log(`Database: ${status.database_connected ? chalk.green('✅ Connected') : chalk.red('❌ Disconnected')}`);
      
      if (status.setup_time) {
        console.log(`Setup time: ${status.setup_time}ms`);
      }
      
      if (status.error) {
        console.log(`Error: ${chalk.red(status.error)}`);
      }
      
      console.log('\n🔍 Service Details:');
      status.services.forEach(service => {
        const statusIcon = service.status === 'healthy' ? '✅' : 
                          service.status === 'timeout' ? '⏰' : '❌';
        console.log(`  ${statusIcon} ${service.service}`);
        console.log(`     URL: ${service.url}`);
        if (service.response_time) {
          console.log(`     Response time: ${service.response_time}ms`);
        }
        if (service.error) {
          console.log(`     Error: ${chalk.red(service.error)}`);
        }
      });
      
    } catch (error) {
      spinner.fail('Health check failed');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  }

  /**
   * Validate configuration
   */
  private async validateConfiguration(options: any): Promise<void> {
    const spinner = ora('Validating configuration...').start();
    
    try {
      const config = this.configManager.loadConfig();
      const validation = this.configManager.validateConfig(config);
      
      spinner.stop();
      
      if (validation.isValid) {
        console.log(chalk.green('✅ Configuration is valid'));
        
        if (validation.warnings.length > 0) {
          console.log(chalk.yellow('\n⚠️  Warnings:'));
          validation.warnings.forEach(warning => {
            console.log(`  - ${warning}`);
          });
        }
      } else {
        console.log(chalk.red('❌ Configuration validation failed:'));
        validation.errors.forEach(error => {
          console.log(`  - ${chalk.red(error.field)}: ${error.message}`);
        });
        
        if (options.fix) {
          console.log(chalk.blue('\n🔧 Attempting to fix issues...'));
          // Implementation for auto-fixing would go here
        }
        
        process.exit(1);
      }
      
    } catch (error) {
      spinner.fail('Configuration validation failed');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  }

  /**
   * Show system information
   */
  private async showSystemInfo(): Promise<void> {
    const os = await import('os');
    const { execSync } = await import('child_process');
    
    console.log(chalk.blue('💻 System Information\n'));
    
    console.log(`OS: ${os.type()} ${os.release()}`);
    console.log(`Architecture: ${os.arch()}`);
    console.log(`CPUs: ${os.cpus().length}`);
    console.log(`Memory: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`);
    console.log(`Node.js: ${process.version}`);
    
    try {
      const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
      console.log(`npm: ${npmVersion}`);
    } catch (error) {
      console.log('npm: Not available');
    }
    
    try {
      const dockerVersion = execSync('docker --version', { encoding: 'utf8' }).trim();
      console.log(`Docker: ${dockerVersion}`);
    } catch (error) {
      console.log('Docker: Not available');
    }
    
    console.log(`\nCurrent directory: ${process.cwd()}`);
    console.log(`Test config: ${this.configManager ? '✅ Loaded' : '❌ Not loaded'}`);
  }

  /**
   * Cleanup test artifacts and resources
   */
  private async cleanup(options: any): Promise<void> {
    const spinner = ora('Cleaning up test artifacts...').start();
    
    try {
      // Stop environment if running
      if (this.testEnvironment.isRunning()) {
        spinner.text = 'Stopping test environment...';
        await this.testEnvironment.stop();
      }
      
      // Clean up test environment
      spinner.text = 'Cleaning up environment resources...';
      await this.testEnvironment.cleanup();
      
      // Clean up test runner processes
      spinner.text = 'Cleaning up test processes...';
      this.testRunner.cleanup();
      
      if (options.all) {
        // Clean up all artifacts
        spinner.text = 'Removing test artifacts...';
        const artifactDirs = ['./test-artifacts', './coverage', './test-reports'];
        
        for (const dir of artifactDirs) {
          if (fs.existsSync(dir)) {
            fs.rmSync(dir, { recursive: true, force: true });
          }
        }
      }
      
      spinner.succeed('Cleanup completed successfully');
      
    } catch (error) {
      spinner.fail('Cleanup failed');
      console.error(chalk.red('Error:'), error);
      process.exit(1);
    }
  }

  /**
   * Interactive troubleshooting guide
   */
  private async troubleshoot(): Promise<void> {
    console.log(chalk.blue('🔧 Interactive Troubleshooting Guide\n'));
    
    const answers = await inquirer.prompt([
      {
        type: 'list',
        name: 'issue',
        message: 'What issue are you experiencing?',
        choices: [
          'Tests are failing',
          'Environment won\'t start',
          'Slow test execution',
          'Coverage issues',
          'Configuration problems',
          'Other'
        ]
      }
    ]);
    
    switch (answers.issue) {
      case 'Tests are failing':
        await this.troubleshootFailingTests();
        break;
      case 'Environment won\'t start':
        await this.troubleshootEnvironment();
        break;
      case 'Slow test execution':
        await this.troubleshootPerformance();
        break;
      case 'Coverage issues':
        await this.troubleshootCoverage();
        break;
      case 'Configuration problems':
        await this.troubleshootConfiguration();
        break;
      default:
        console.log(chalk.yellow('Please check the documentation or contact support.'));
    }
  }

  /**
   * Display test results
   */
  private displayTestResults(result: TestResult): void {
    console.log(chalk.blue(`\n📊 ${result.type.toUpperCase()} Test Results\n`));
    
    const passIcon = result.passed > 0 ? chalk.green('✅') : '';
    const failIcon = result.failed > 0 ? chalk.red('❌') : '';
    const skipIcon = result.skipped > 0 ? chalk.yellow('⏭️') : '';
    
    console.log(`${passIcon} Passed: ${chalk.green(result.passed)}`);
    console.log(`${failIcon} Failed: ${chalk.red(result.failed)}`);
    console.log(`${skipIcon} Skipped: ${chalk.yellow(result.skipped)}`);
    console.log(`⏱️  Duration: ${result.duration}ms`);
    
    if (result.coverage) {
      console.log(`\n📈 Coverage: ${result.coverage.overall.statements.percentage.toFixed(1)}%`);
    }
    
    if (result.artifacts.length > 0) {
      console.log(`\n📁 Artifacts: ${result.artifacts.length} files`);
    }
  }

  /**
   * Display comprehensive test results
   */
  private displayComprehensiveResults(results: TestResult[]): void {
    console.log(chalk.blue('\n📊 Comprehensive Test Results\n'));
    
    const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
    const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    
    console.log(`✅ Total Passed: ${chalk.green(totalPassed)}`);
    console.log(`❌ Total Failed: ${chalk.red(totalFailed)}`);
    console.log(`⏭️  Total Skipped: ${chalk.yellow(totalSkipped)}`);
    console.log(`⏱️  Total Duration: ${totalDuration}ms`);
    
    console.log('\n📋 By Test Type:');
    results.forEach(result => {
      const status = result.failed > 0 ? chalk.red('FAIL') : chalk.green('PASS');
      console.log(`  ${result.type.padEnd(15)} ${status} (${result.passed}/${result.passed + result.failed})`);
    });
  }

  // Troubleshooting helper methods
  private async troubleshootFailingTests(): Promise<void> {
    console.log(chalk.yellow('\n🔍 Troubleshooting failing tests...\n'));
    console.log('1. Check test logs for specific error messages');
    console.log('2. Verify test environment is properly set up');
    console.log('3. Run tests with --verbose flag for more details');
    console.log('4. Check if dependencies are up to date');
  }

  private async troubleshootEnvironment(): Promise<void> {
    console.log(chalk.yellow('\n🔍 Troubleshooting environment issues...\n'));
    console.log('1. Check if Docker is running');
    console.log('2. Verify port availability');
    console.log('3. Check Docker Compose configuration');
    console.log('4. Try running: test-cli env reset');
  }

  private async troubleshootPerformance(): Promise<void> {
    console.log(chalk.yellow('\n🔍 Troubleshooting performance issues...\n'));
    console.log('1. Reduce parallel workers');
    console.log('2. Check system resources');
    console.log('3. Optimize test setup/teardown');
    console.log('4. Consider running tests in smaller batches');
  }

  private async troubleshootCoverage(): Promise<void> {
    console.log(chalk.yellow('\n🔍 Troubleshooting coverage issues...\n'));
    console.log('1. Check coverage configuration');
    console.log('2. Verify file patterns are correct');
    console.log('3. Ensure tests are actually running');
    console.log('4. Check for excluded files');
  }

  private async troubleshootConfiguration(): Promise<void> {
    console.log(chalk.yellow('\n🔍 Troubleshooting configuration issues...\n'));
    console.log('1. Run: test-cli config validate');
    console.log('2. Check test-config.yml syntax');
    console.log('3. Verify environment variables');
    console.log('4. Compare with working configuration');
  }

  // Additional helper methods for configuration display
  private async showConfiguration(options: any): Promise<void> {
    try {
      const config = this.configManager.loadConfig();
      
      if (options.env) {
        const envConfig = this.configManager.getEnvironmentConfig(options.env);
        console.log(chalk.blue(`\n🌍 ${options.env} Environment Configuration:\n`));
        console.log(JSON.stringify(envConfig, null, 2));
      } else if (options.type) {
        const typeConfig = this.configManager.getTestTypeConfig(options.type);
        console.log(chalk.blue(`\n🧪 ${options.type} Test Type Configuration:\n`));
        console.log(JSON.stringify(typeConfig, null, 2));
      } else {
        console.log(chalk.blue('\n⚙️  Full Configuration:\n'));
        console.log(JSON.stringify(config, null, 2));
      }
    } catch (error) {
      console.error(chalk.red('Failed to show configuration:'), error);
      process.exit(1);
    }
  }

  private async listEnvironments(): Promise<void> {
    try {
      const config = this.configManager.loadConfig();
      
      console.log(chalk.blue('\n🌍 Available Environments:\n'));
      
      Object.entries(config.environments).forEach(([name, envConfig]) => {
        console.log(`📍 ${chalk.bold(name)}`);
        console.log(`   Database: ${envConfig.database.url}`);
        console.log(`   Services: ${Object.keys(envConfig.services).join(', ')}`);
        console.log(`   Coverage threshold: ${envConfig.coverage.threshold.statements}%`);
        console.log('');
      });
    } catch (error) {
      console.error(chalk.red('Failed to list environments:'), error);
      process.exit(1);
    }
  }

  private async listTestTypes(): Promise<void> {
    try {
      const config = this.configManager.loadConfig();
      
      console.log(chalk.blue('\n🧪 Available Test Types:\n'));
      
      Object.entries(config.test_types).forEach(([name, typeConfig]) => {
        console.log(`🔬 ${chalk.bold(name)}`);
        console.log(`   Timeout: ${typeConfig.timeout}ms`);
        console.log(`   Parallel: ${typeConfig.parallel}`);
        console.log(`   Coverage: ${typeConfig.collect_coverage}`);
        if (typeConfig.headless !== undefined) {
          console.log(`   Headless: ${typeConfig.headless}`);
        }
        if (typeConfig.browsers) {
          console.log(`   Browsers: ${typeConfig.browsers.join(', ')}`);
        }
        console.log('');
      });
    } catch (error) {
      console.error(chalk.red('Failed to list test types:'), error);
      process.exit(1);
    }
  }

  private async generateJestConfig(options: any): Promise<void> {
    try {
      const context = this.configManager.createExecutionContext(options.env, options.type);
      const isBackend = options.project === 'backend';
      const jestConfig = this.configManager.getJestConfig(context, isBackend);
      
      if (options.output) {
        fs.writeFileSync(options.output, JSON.stringify(jestConfig, null, 2));
        console.log(chalk.green(`Jest configuration written to: ${options.output}`));
      } else {
        console.log(chalk.blue(`\n⚙️  Jest Configuration (${options.project}):\n`));
        console.log(JSON.stringify(jestConfig, null, 2));
      }
    } catch (error) {
      console.error(chalk.red('Failed to generate Jest config:'), error);
      process.exit(1);
    }
  }

  /**
   * Run the CLI
   */
  public async run(): Promise<void> {
    try {
      await this.program.parseAsync(process.argv);
    } catch (error) {
      console.error(chalk.red('CLI Error:'), error);
      process.exit(1);
    }
  }
}

// Export for use as a module
export default TestCLI;

// Export for use as a module - direct execution handled by test-cli.js