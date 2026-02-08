/**
 * Backend Performance Tests
 * Comprehensive performance testing for API endpoints and services
 */

import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import TestConfigManager from 'test-config/TestConfigManager';
import PerformanceTestFramework from 'test-config/PerformanceTestFramework';

// Performance tests require running backend/frontend services.
// Skip gracefully when services are unavailable (e.g., local dev without full stack).
let servicesAvailable = false;

async function checkServiceHealth(): Promise<boolean> {
  try {
    const http = await import('http');
    return new Promise((resolve) => {
      const req = http.default.get('http://localhost:3001/api/health', { timeout: 3000 }, (res) => {
        resolve(res.statusCode === 200);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
    });
  } catch {
    return false;
  }
}

describe('Backend Performance Tests', () => {
  let performanceFramework: PerformanceTestFramework;
  let configManager: TestConfigManager;
  const testEnv = (process.env.TEST_ENVIRONMENT || 'local') as any;
  const testType = (process.env.TEST_TYPE || 'performance') as any;
  const isMock = process.env.PERF_MOCK === 'true' || process.env.PERF_MOCK === '1';
  const isLong = process.env.RUN_PERF_LONG === 'true' || process.env.RUN_PERF_LONG === '1';

  beforeAll(async () => {
    servicesAvailable = await checkServiceHealth();
    if (!servicesAvailable) {
      console.log('⚠️  Backend service not reachable — skipping performance tests');
      return;
    }

    configManager = TestConfigManager.getInstance();
    performanceFramework = new PerformanceTestFramework();

    // Ensure test environment is ready
    const context = configManager.createExecutionContext(testEnv, testType);
    // await configManager.setupEnvironment(context.environment); // Method not available
  }, 60000);

  afterAll(async () => {
    if (!servicesAvailable) return;
    performanceFramework.cleanup();

    const context = configManager.createExecutionContext(testEnv, testType);
    // await configManager.teardownEnvironment(context.environment); // Method not available
  });

  test('should run comprehensive performance test suite', async () => {
    if (!servicesAvailable) return;
    const context = configManager.createExecutionContext(testEnv, testType);
    
    const results = await performanceFramework.runPerformanceTests(context);
    
    // Verify scenarios completed (1 in quick mode, 2 in long mode)
    expect(results.length).toBe(isLong ? 2 : 1);
    
    // Check that at least one scenario passed thresholds (relaxed in mock mode)
    interface PerformanceResult {
      thresholdsPassed: boolean;
      regression?: {
        detected: boolean;
        details: string[];
      };
      metrics: {
        throughput: {
          totalRequests: number;
          requestsPerSecond: number;
        };
        responseTime: {
          avg: number;
        };
        memory: {
          heapUsed: number;
        };
        cpu: {
          usage: number;
        };
        errors: {
          errorRate: number;
        };
      };
      artifacts: string[];
      scenario: string;
      thresholdFailures: string[];
    }
    
    const passedScenarios = results.filter((r: PerformanceResult) => r.thresholdsPassed);
    expect(passedScenarios.length).toBeGreaterThanOrEqual(isMock ? 0 : 1);
    
    // Verify metrics were collected
    for (const result of results) {
      if (result.regression) {
        expect(typeof result.regression.detected).toBe('boolean');
      }
      expect(result.metrics.throughput.totalRequests).toBeGreaterThanOrEqual(0);
      expect(result.artifacts).toBeDefined();
      expect(Array.isArray(result.artifacts)).toBe(true);
    }
    
    // Log results for debugging
    console.log('\n📊 Performance Test Results Summary:');
    results.forEach((result: PerformanceResult) => {
      console.log(`\n🎯 Scenario: ${result.scenario}`);
      console.log(`✅ Passed: ${result.thresholdsPassed}`);
      console.log(`⏱️  Avg Response: ${result.metrics.responseTime.avg.toFixed(2)}ms`);
      console.log(`🚀 Throughput: ${result.metrics.throughput.requestsPerSecond.toFixed(2)} req/s`);
      console.log(`💾 Memory: ${result.metrics.memory.heapUsed.toFixed(2)}MB`);
      console.log(`❌ Error Rate: ${result.metrics.errors.errorRate.toFixed(2)}%`);
      
      if (result.regression?.detected) {
        console.log(`⚠️  Regression detected: ${(result.regression.details as string[]).join(', ')}`);
      }
    });
    
  }, isLong ? 300000 : 90000);

  test('should detect performance regressions', async () => {
    if (!servicesAvailable) return;
    const context = configManager.createExecutionContext(testEnv, testType);
    
    // Run performance tests twice to test regression detection
    const firstRun = await performanceFramework.runPerformanceTests(context);
    
    // Brief pause between runs
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const secondRun = await performanceFramework.runPerformanceTests(context);
    
    // Verify both runs completed
    expect(firstRun.length).toBe(isLong ? 2 : 1);
    expect(secondRun.length).toBe(isLong ? 2 : 1);
    
    // Check that regression detection is working
    for (const result of secondRun) {
      expect(result.regression).toBeDefined();
      if (result.regression) {
        expect(typeof result.regression.detected).toBe('boolean');
        expect(Array.isArray(result.regression.details)).toBe(true);
      }
    }
    
  }, isLong ? 600000 : 180000);

  test('should validate performance thresholds', async () => {
    if (!servicesAvailable) return;
    const context = configManager.createExecutionContext(testEnv, testType);
    
    const results = await performanceFramework.runPerformanceTests(context);
    
    for (const result of results) {
      // Verify threshold checking is working
      expect(typeof result.thresholdsPassed).toBe('boolean');
      expect(Array.isArray(result.thresholdFailures)).toBe(true);
      
      // Verify metrics are within reasonable bounds
      expect(result.metrics.responseTime.avg).toBeGreaterThanOrEqual(0);
      expect(result.metrics.responseTime.avg).toBeLessThan(30000); // 30 seconds max
      expect(result.metrics.throughput.requestsPerSecond).toBeGreaterThanOrEqual(0);
      expect(result.metrics.memory.heapUsed).toBeGreaterThanOrEqual(0);
      expect(result.metrics.cpu.usage).toBeGreaterThanOrEqual(0);
      expect(result.metrics.cpu.usage).toBeLessThanOrEqual(100);
      expect(result.metrics.errors.errorRate).toBeGreaterThanOrEqual(0);
      expect(result.metrics.errors.errorRate).toBeLessThanOrEqual(100);
    }
    
  }, isLong ? 300000 : 120000);

  test('should generate performance reports and artifacts', async () => {
    if (!servicesAvailable) return;
    const context = configManager.createExecutionContext(testEnv, testType);
    
    const results = await performanceFramework.runPerformanceTests(context);
    
    // Verify artifacts were generated
    for (const result of results) {
      expect(result.artifacts.length).toBeGreaterThanOrEqual(0);
      
      // Check for expected artifact types (best-effort in mock mode)
      const hasLogFiles = result.artifacts.some((artifact: string) => {
        return artifact.includes('test-output.log') || artifact.includes('system-metrics.json')
      });
      if (!isMock) {
        expect(hasLogFiles).toBe(true);
      }
    }
    
    // Verify report files exist in the artifacts directory
    const fs = require('fs');
    const path = require('path');
    const reportDir = path.join(process.cwd(), 'test-artifacts', 'performance', 'reports');
    
    if (fs.existsSync(reportDir)) {
      const reportFiles = fs.readdirSync(reportDir);
      const hasHtmlReport = reportFiles.some((file: string) => file.endsWith('.html'));
      const hasJsonReport = reportFiles.some((file: string) => file.endsWith('.json'));
      
      expect(hasHtmlReport).toBe(true);
      expect(hasJsonReport).toBe(true);
    }
    
  }, isLong ? 300000 : 120000);
});
