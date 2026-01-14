/**
 * Unified Test Runner Framework
 * Provides consistent interface for running all test types with parallel execution
 * and comprehensive result reporting
 */

import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import { TestConfigManager } from './TestConfigManager.js';
import {
  TestEnvironmentType,
  TestType,
  TestExecutionContext,
  TestEnvironmentStatus
} from './types';

export interface TestResult {
  type: TestType;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  coverage?: CoverageReport;
  artifacts: string[];
  exitCode: number;
  output: string;
  error?: string;
  startTime: Date;
  endTime: Date;
}

export interface CoverageReport {
  overall: CoverageMetrics;
  byFile: Map<string, CoverageMetrics>;
  byDirectory: Map<string, CoverageMetrics>;
  uncoveredLines: UncoveredLine[];
  thresholdsMet: boolean;
}

export interface CoverageMetrics {
  statements: { covered: number; total: number; percentage: number };
  branches: { covered: number; total: number; percentage: number };
  functions: { covered: number; total: number; percentage: number };
  lines: { covered: number; total: number; percentage: number };
}

export interface UncoveredLine {
  file: string;
  line: number;
  type: 'statement' | 'branch' | 'function';
}

export interface TestRunnerOptions {
  environment: TestEnvironmentType;
  parallel?: boolean;
  maxWorkers?: number | string;
  bail?: boolean;
  verbose?: boolean;
  collectCoverage?: boolean;
  outputDir?: string;
  timeout?: number;
}

export interface TestExecutionPlan {
  tests: Array<{
    type: TestType;
    command: string;
    args: string[];
    cwd: string;
    env: Record<string, string>;
    timeout: number;
  }>;
  parallel: boolean;
  maxConcurrency: number;
}

export class TestRunner {
  private configManager: TestConfigManager;
  private projectRoot: string;
  private runningProcesses: Map<string, ChildProcess> = new Map();
  private artifacts: Map<string, string[]> = new Map();

  constructor(configPath?: string) {
    this.configManager = TestConfigManager.getInstance(configPath);
    this.projectRoot = this.findProjectRoot();
  }

  /**
   * Run unit tests for both frontend and backend
   */
  async runUnit(options: TestRunnerOptions = { environment: 'local' }): Promise<TestResult> {
    const context = this.configManager.createExecutionContext(options.environment, 'unit');
    
    // Run unit tests in parallel for frontend and backend
    const backendResult = this.executeTest('unit', 'backend', context, options);
    const frontendResult = this.executeTest('unit', 'frontend', context, options);

    const results = await Promise.allSettled([backendResult, frontendResult]);
    
    return this.aggregateResults('unit', results, context);
  }

  /**
   * Run integration tests
   */
  async runIntegration(options: TestRunnerOptions = { environment: 'local' }): Promise<TestResult> {
    const context = this.configManager.createExecutionContext(options.environment, 'integration');
    
    // Ensure test environment is ready
    await this.ensureEnvironmentReady(context);
    
    // Run integration tests sequentially to avoid conflicts
    const backendResult = await this.executeTest('integration', 'backend', context, options);
    const frontendResult = await this.executeTest('integration', 'frontend', context, options);

    return this.aggregateResults('integration', [
      { status: 'fulfilled', value: backendResult },
      { status: 'fulfilled', value: frontendResult }
    ], context);
  }

  /**
   * Run end-to-end tests
   */
  async runE2E(options: TestRunnerOptions = { environment: 'local' }): Promise<TestResult> {
    const context = this.configManager.createExecutionContext(options.environment, 'e2e');
    
    // Ensure full application stack is ready
    await this.ensureEnvironmentReady(context);
    
    const result = await this.executeTest('e2e', 'frontend', context, options);
    
    return result;
  }

  /**
   * Run performance tests
   */
  async runPerformance(options: TestRunnerOptions = { environment: 'local' }): Promise<TestResult> {
    const context = this.configManager.createExecutionContext(options.environment, 'performance');
    
    await this.ensureEnvironmentReady(context);
    
    // Use the dedicated performance testing framework
    try {
      const { PerformanceTestFramework } = await import('./PerformanceTestFramework');
      const performanceFramework = new PerformanceTestFramework();
      
      const startTime = new Date();
      const performanceResults = await performanceFramework.runPerformanceTests(context);
      const endTime = new Date();
      
      // Convert performance results to TestResult format
      const totalScenarios = performanceResults.length;
      const passedScenarios = performanceResults.filter(r => r.thresholdsPassed).length;
      const failedScenarios = totalScenarios - passedScenarios;
      
      const allArtifacts = performanceResults.flatMap(r => r.artifacts);
      
      return {
        type: 'performance',
        passed: passedScenarios,
        failed: failedScenarios,
        skipped: 0,
        duration: endTime.getTime() - startTime.getTime(),
        artifacts: allArtifacts,
        exitCode: failedScenarios > 0 ? 1 : 0,
        output: `Performance tests completed: ${passedScenarios} passed, ${failedScenarios} failed`,
        startTime,
        endTime
      };
      
    } catch (error) {
      console.error('Performance testing failed:', error);
      
      // Fallback to regular test execution
      const result = await this.executeTest('performance', 'backend', context, options);
      return result;
    }
  }

  /**
   * Run accessibility tests
   */
  async runAccessibility(options: TestRunnerOptions = { environment: 'local' }): Promise<TestResult> {
    const context = this.configManager.createExecutionContext(options.environment, 'accessibility');
    
    await this.ensureEnvironmentReady(context);
    
    // Use Playwright for accessibility tests
    const result = await this.executeTest('accessibility', 'frontend', context, options);
    
    return result;
  }

  /**
   * Run all test types in sequence
   */
  async runAll(options: TestRunnerOptions = { environment: 'local' }): Promise<TestResult[]> {
    const results: TestResult[] = [];
    
    try {
      console.log('🚀 Starting comprehensive test suite...\n');
      
      // Run tests in logical order
      console.log('📋 Running unit tests...');
      const unitResult = await this.runUnit(options);
      results.push(unitResult);
      
      if (unitResult.failed > 0 && options.bail) {
        console.log('❌ Unit tests failed, stopping execution due to bail option');
        return results;
      }
      
      console.log('🔗 Running integration tests...');
      const integrationResult = await this.runIntegration(options);
      results.push(integrationResult);
      
      if (integrationResult.failed > 0 && options.bail) {
        console.log('❌ Integration tests failed, stopping execution due to bail option');
        return results;
      }
      
      console.log('🌐 Running E2E tests...');
      const e2eResult = await this.runE2E(options);
      results.push(e2eResult);
      
      if (e2eResult.failed > 0 && options.bail) {
        console.log('❌ E2E tests failed, stopping execution due to bail option');
        return results;
      }
      
      console.log('⚡ Running performance tests...');
      const performanceResult = await this.runPerformance(options);
      results.push(performanceResult);
      
      console.log('♿ Running accessibility tests...');
      const accessibilityResult = await this.runAccessibility(options);
      results.push(accessibilityResult);
      
      console.log('\n✅ All test suites completed');
      
    } catch (error) {
      console.error('❌ Test execution failed:', error);
      throw error;
    }
    
    return results;
  }

  /**
   * Create execution plan for parallel test running
   */
  createExecutionPlan(testTypes: TestType[], options: TestRunnerOptions): TestExecutionPlan {
    const tests = testTypes.map(testType => {
      const context = this.configManager.createExecutionContext(options.environment, testType);
      const isBackend = ['integration', 'performance'].includes(testType);
      const projectDir = isBackend ? 'backend' : 'frontend';
      
      return {
        type: testType,
        command: 'npm',
        args: ['run', `test:${testType}`],
        cwd: path.join(this.projectRoot, projectDir),
        env: {
          ...process.env,
          TEST_ENVIRONMENT: options.environment,
          TEST_TYPE: testType,
          NODE_ENV: 'test'
        },
        timeout: context.test_type_config.timeout
      };
    });

    return {
      tests,
      parallel: options.parallel ?? true,
      maxConcurrency: this.getMaxConcurrency(options)
    };
  }

  /**
   * Execute tests with resource management and monitoring
   */
  private async executeTest(
    testType: TestType,
    project: 'frontend' | 'backend',
    context: TestExecutionContext,
    options: TestRunnerOptions
  ): Promise<TestResult> {
    const startTime = new Date();
    const projectDir = path.join(this.projectRoot, project);
    const artifactDir = path.join(this.projectRoot, 'test-artifacts', testType, project);
    
    // Ensure artifact directory exists
    await this.ensureDirectoryExists(artifactDir);
    
    const testCommand = this.buildTestCommand(testType, project, context, options);
    
    console.log(`🔄 Running ${testType} tests for ${project}...`);
    console.log(`📁 Working directory: ${projectDir}`);
    console.log(`⚙️  Command: ${testCommand.command} ${testCommand.args.join(' ')}`);
    
    try {
      const result = await this.executeCommand(testCommand, artifactDir);
      const endTime = new Date();
      
      // Parse test results from output
      const parsedResult = this.parseTestOutput(result.output, testType);
      
      // Collect coverage if enabled
      let coverage: CoverageReport | undefined;
      if (options.collectCoverage && context.test_type_config.collect_coverage) {
        coverage = await this.collectCoverage(projectDir, testType);
      }
      
      // Collect artifacts
      const artifacts = await this.collectArtifacts(artifactDir, testType);
      
      const testResult: TestResult = {
        type: testType,
        passed: parsedResult.passed,
        failed: parsedResult.failed,
        skipped: parsedResult.skipped,
        duration: endTime.getTime() - startTime.getTime(),
        coverage,
        artifacts,
        exitCode: result.exitCode,
        output: result.output,
        error: result.error,
        startTime,
        endTime
      };
      
      console.log(`✅ ${testType} tests completed for ${project}`);
      console.log(`📊 Results: ${parsedResult.passed} passed, ${parsedResult.failed} failed, ${parsedResult.skipped} skipped`);
      
      return testResult;
      
    } catch (error) {
      const endTime = new Date();
      
      console.error(`❌ ${testType} tests failed for ${project}:`, error);
      
      return {
        type: testType,
        passed: 0,
        failed: 1,
        skipped: 0,
        duration: endTime.getTime() - startTime.getTime(),
        artifacts: [],
        exitCode: 1,
        output: '',
        error: error instanceof Error ? error.message : 'Unknown error',
        startTime,
        endTime
      };
    }
  }

  /**
   * Build test command based on test type and project
   */
  private buildTestCommand(
    testType: TestType,
    project: 'frontend' | 'backend',
    context: TestExecutionContext,
    options: TestRunnerOptions
  ): { command: string; args: string[]; cwd: string; env: Record<string, string> } {
    const cwd = path.join(this.projectRoot, project);
    const env: Record<string, string> = {
      ...process.env,
      TEST_ENVIRONMENT: options.environment,
      TEST_TYPE: testType,
      NODE_ENV: 'test'
    };

    let command = 'npm';
    let args: string[] = [];

    switch (testType) {
      case 'unit':
        args = ['run', 'test:unit'];
        if (options.collectCoverage) {
          args.push('--', '--coverage');
        }
        break;
        
      case 'integration':
        args = ['run', 'test:integration'];
        break;
        
      case 'e2e':
        if (project === 'frontend') {
          args = ['run', 'test:e2e'];
        } else {
          throw new Error('E2E tests only run on frontend');
        }
        break;
        
      case 'performance':
        args = ['run', 'test:performance'];
        break;
        
      case 'accessibility':
        if (project === 'frontend') {
          args = ['run', 'test:e2e:accessibility'];
        } else {
          throw new Error('Accessibility tests only run on frontend');
        }
        break;
        
      default:
        throw new Error(`Unknown test type: ${testType}`);
    }

    // Add timeout if specified
    if (options.timeout) {
      env.JEST_TIMEOUT = options.timeout.toString();
    }

    return { command, args, cwd, env };
  }

  /**
   * Execute command with proper error handling and output capture
   */
  private async executeCommand(
    testCommand: { command: string; args: string[]; cwd: string; env: Record<string, string> },
    artifactDir: string
  ): Promise<{ exitCode: number; output: string; error?: string }> {
    return new Promise((resolve, reject) => {
      const process = spawn(testCommand.command, testCommand.args, {
        cwd: testCommand.cwd,
        env: testCommand.env,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errorOutput = '';

      process.stdout?.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        console.log(chunk);
      });

      process.stderr?.on('data', (data) => {
        const chunk = data.toString();
        errorOutput += chunk;
        console.error(chunk);
      });

      process.on('close', (code) => {
        // Save output to artifacts
        const outputFile = path.join(artifactDir, 'test-output.log');
        fs.writeFileSync(outputFile, output);
        
        if (errorOutput) {
          const errorFile = path.join(artifactDir, 'test-error.log');
          fs.writeFileSync(errorFile, errorOutput);
        }

        resolve({
          exitCode: code || 0,
          output,
          error: errorOutput || undefined
        });
      });

      process.on('error', (error) => {
        reject(error);
      });

      // Store process for potential cleanup
      const processId = `${testCommand.cwd}-${Date.now()}`;
      this.runningProcesses.set(processId, process);

      // Clean up process reference when done
      process.on('close', () => {
        this.runningProcesses.delete(processId);
      });
    });
  }

  /**
   * Parse test output to extract results
   */
  private parseTestOutput(output: string, testType: TestType): { passed: number; failed: number; skipped: number } {
    // Default values
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    try {
      if (testType === 'e2e' || testType === 'accessibility') {
        // Playwright output parsing
        const playwrightMatch = output.match(/(\d+) passed.*?(\d+) failed.*?(\d+) skipped/);
        if (playwrightMatch) {
          passed = parseInt(playwrightMatch[1]!, 10);
          failed = parseInt(playwrightMatch[2]!, 10);
          skipped = parseInt(playwrightMatch[3]!, 10);
        }
      } else {
        // Jest output parsing
        const jestMatch = output.match(/Tests:\s+(\d+) failed,\s+(\d+) passed,\s+(\d+) total/);
        if (jestMatch) {
          failed = parseInt(jestMatch[1]!, 10);
          passed = parseInt(jestMatch[2]!, 10);
        } else {
          // Alternative Jest format
          const altMatch = output.match(/Tests:\s+(\d+) passed,\s+(\d+) total/);
          if (altMatch) {
            passed = parseInt(altMatch[1]!, 10);
            failed = 0;
          }
        }
        
        // Look for skipped tests
        const skippedMatch = output.match(/(\d+) skipped/);
        if (skippedMatch) {
          skipped = parseInt(skippedMatch[1]!, 10);
        }
      }
    } catch (error) {
      console.warn('Failed to parse test output:', error);
    }

    return { passed, failed, skipped };
  }

  /**
   * Collect coverage information
   */
  private async collectCoverage(projectDir: string, testType: TestType): Promise<CoverageReport | undefined> {
    const coverageDir = path.join(projectDir, 'coverage');
    const lcovFile = path.join(coverageDir, 'lcov.info');
    
    if (!fs.existsSync(lcovFile)) {
      console.warn(`Coverage file not found: ${lcovFile}`);
      return undefined;
    }

    try {
      // Parse LCOV file for coverage metrics
      const lcovContent = fs.readFileSync(lcovFile, 'utf8');
      const coverage = this.parseLcovFile(lcovContent);
      
      return coverage;
    } catch (error) {
      console.warn('Failed to collect coverage:', error);
      return undefined;
    }
  }

  /**
   * Parse LCOV file to extract coverage metrics
   */
  private parseLcovFile(lcovContent: string): CoverageReport {
    const files = new Map<string, CoverageMetrics>();
    const directories = new Map<string, CoverageMetrics>();
    const uncoveredLines: UncoveredLine[] = [];
    
    // This is a simplified LCOV parser - in production, you'd use a proper library
    const sections = lcovContent.split('end_of_record');
    
    let totalStatements = { covered: 0, total: 0 };
    let totalBranches = { covered: 0, total: 0 };
    let totalFunctions = { covered: 0, total: 0 };
    let totalLines = { covered: 0, total: 0 };
    
    for (const section of sections) {
      if (!section.trim()) continue;
      
      const lines = section.trim().split('\n');
      let currentFile = '';
      let fileMetrics: CoverageMetrics = {
        statements: { covered: 0, total: 0, percentage: 0 },
        branches: { covered: 0, total: 0, percentage: 0 },
        functions: { covered: 0, total: 0, percentage: 0 },
        lines: { covered: 0, total: 0, percentage: 0 }
      };
      
      for (const line of lines) {
        if (line.startsWith('SF:')) {
          currentFile = line.substring(3);
        } else if (line.startsWith('LF:')) {
          fileMetrics.lines.total = parseInt(line.substring(3), 10);
          totalLines.total += fileMetrics.lines.total;
        } else if (line.startsWith('LH:')) {
          fileMetrics.lines.covered = parseInt(line.substring(3), 10);
          totalLines.covered += fileMetrics.lines.covered;
        } else if (line.startsWith('BRF:')) {
          fileMetrics.branches.total = parseInt(line.substring(4), 10);
          totalBranches.total += fileMetrics.branches.total;
        } else if (line.startsWith('BRH:')) {
          fileMetrics.branches.covered = parseInt(line.substring(4), 10);
          totalBranches.covered += fileMetrics.branches.covered;
        } else if (line.startsWith('FNF:')) {
          fileMetrics.functions.total = parseInt(line.substring(4), 10);
          totalFunctions.total += fileMetrics.functions.total;
        } else if (line.startsWith('FNH:')) {
          fileMetrics.functions.covered = parseInt(line.substring(4), 10);
          totalFunctions.covered += fileMetrics.functions.covered;
        }
      }
      
      // Calculate percentages
      fileMetrics.lines.percentage = fileMetrics.lines.total > 0 
        ? (fileMetrics.lines.covered / fileMetrics.lines.total) * 100 
        : 100;
      fileMetrics.branches.percentage = fileMetrics.branches.total > 0 
        ? (fileMetrics.branches.covered / fileMetrics.branches.total) * 100 
        : 100;
      fileMetrics.functions.percentage = fileMetrics.functions.total > 0 
        ? (fileMetrics.functions.covered / fileMetrics.functions.total) * 100 
        : 100;
      fileMetrics.statements.percentage = fileMetrics.lines.percentage; // Simplified
      
      if (currentFile) {
        files.set(currentFile, fileMetrics);
      }
    }
    
    const overall: CoverageMetrics = {
      statements: {
        covered: totalLines.covered,
        total: totalLines.total,
        percentage: totalLines.total > 0 ? (totalLines.covered / totalLines.total) * 100 : 100
      },
      branches: {
        covered: totalBranches.covered,
        total: totalBranches.total,
        percentage: totalBranches.total > 0 ? (totalBranches.covered / totalBranches.total) * 100 : 100
      },
      functions: {
        covered: totalFunctions.covered,
        total: totalFunctions.total,
        percentage: totalFunctions.total > 0 ? (totalFunctions.covered / totalFunctions.total) * 100 : 100
      },
      lines: {
        covered: totalLines.covered,
        total: totalLines.total,
        percentage: totalLines.total > 0 ? (totalLines.covered / totalLines.total) * 100 : 100
      }
    };
    
    return {
      overall,
      byFile: files,
      byDirectory: directories,
      uncoveredLines,
      thresholdsMet: this.checkCoverageThresholds(overall)
    };
  }

  /**
   * Check if coverage meets thresholds
   */
  private checkCoverageThresholds(metrics: CoverageMetrics): boolean {
    // This would check against configured thresholds
    // For now, using basic thresholds
    return metrics.statements.percentage >= 80 &&
           metrics.branches.percentage >= 75 &&
           metrics.functions.percentage >= 80 &&
           metrics.lines.percentage >= 80;
  }

  /**
   * Collect test artifacts (screenshots, videos, logs)
   */
  private async collectArtifacts(artifactDir: string, testType: TestType): Promise<string[]> {
    const artifacts: string[] = [];
    
    try {
      if (!fs.existsSync(artifactDir)) {
        return artifacts;
      }
      
      const files = fs.readdirSync(artifactDir, { recursive: true });
      
      for (const file of files) {
        if (typeof file === 'string') {
          const fullPath = path.join(artifactDir, file);
          if (fs.statSync(fullPath).isFile()) {
            artifacts.push(fullPath);
          }
        }
      }
      
      // For E2E tests, also collect Playwright artifacts
      if (testType === 'e2e' || testType === 'accessibility') {
        const playwrightDir = path.join(this.projectRoot, 'frontend', 'test-results');
        if (fs.existsSync(playwrightDir)) {
          const playwrightFiles = fs.readdirSync(playwrightDir, { recursive: true });
          for (const file of playwrightFiles) {
            if (typeof file === 'string') {
              const fullPath = path.join(playwrightDir, file);
              if (fs.statSync(fullPath).isFile()) {
                artifacts.push(fullPath);
              }
            }
          }
        }
      }
      
    } catch (error) {
      console.warn('Failed to collect artifacts:', error);
    }
    
    return artifacts;
  }

  /**
   * Aggregate results from multiple test executions
   */
  private aggregateResults(
    testType: TestType,
    results: PromiseSettledResult<TestResult>[],
    context: TestExecutionContext
  ): TestResult {
    const startTime = new Date();
    let totalPassed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;
    let totalDuration = 0;
    let combinedOutput = '';
    let combinedError = '';
    let allArtifacts: string[] = [];
    let exitCode = 0;
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        const testResult = result.value;
        totalPassed += testResult.passed;
        totalFailed += testResult.failed;
        totalSkipped += testResult.skipped;
        totalDuration += testResult.duration;
        combinedOutput += testResult.output + '\n';
        if (testResult.error) {
          combinedError += testResult.error + '\n';
        }
        allArtifacts.push(...testResult.artifacts);
        if (testResult.exitCode !== 0) {
          exitCode = testResult.exitCode;
        }
      } else {
        totalFailed += 1;
        combinedError += result.reason?.message || 'Unknown error';
        exitCode = 1;
      }
    }
    
    return {
      type: testType,
      passed: totalPassed,
      failed: totalFailed,
      skipped: totalSkipped,
      duration: totalDuration,
      artifacts: allArtifacts,
      exitCode,
      output: combinedOutput,
      error: combinedError || undefined,
      startTime,
      endTime: new Date()
    };
  }

  /**
   * Ensure test environment is ready
   */
  private async ensureEnvironmentReady(context: TestExecutionContext): Promise<void> {
    console.log(`🔍 Checking ${context.environment} environment status...`);
    
    const status = await this.configManager.performHealthCheck(context.environment);
    
    if (status.status !== 'ready') {
      throw new Error(`Test environment not ready: ${status.error || 'Unknown error'}`);
    }
    
    console.log('✅ Test environment is ready');
  }

  /**
   * Get maximum concurrency based on options and system resources
   */
  private getMaxConcurrency(options: TestRunnerOptions): number {
    if (options.maxWorkers) {
      if (typeof options.maxWorkers === 'number') {
        return options.maxWorkers;
      } else if (typeof options.maxWorkers === 'string' && options.maxWorkers.endsWith('%')) {
        const percentage = parseInt(options.maxWorkers.slice(0, -1), 10);
        const cpuCount = require('os').cpus().length;
        return Math.max(1, Math.floor((cpuCount * percentage) / 100));
      }
    }
    
    // Default to half of available CPUs
    return Math.max(1, Math.floor(require('os').cpus().length / 2));
  }

  /**
   * Ensure directory exists
   */
  private async ensureDirectoryExists(dir: string): Promise<void> {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Find project root directory
   */
  private findProjectRoot(): string {
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
  cleanup(): void {
    console.log('🧹 Cleaning up test processes...');
    
    for (const [processId, process] of this.runningProcesses) {
      try {
        process.kill('SIGTERM');
        console.log(`Terminated process: ${processId}`);
      } catch (error) {
        console.warn(`Failed to terminate process ${processId}:`, error);
      }
    }
    
    this.runningProcesses.clear();
  }
}

export default TestRunner;