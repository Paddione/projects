#!/usr/bin/env node

import { 
  initializeErrorHandling, 
  errorHandler, 
  healthMonitor, 
  notificationService 
} from './index.js';

/**
 * Test script for the error handling system
 */
async function testErrorHandling() {
  console.log('🧪 Testing Error Handling System\n');

  try {
    // Initialize the system
    console.log('1. Initializing error handling system...');
    await initializeErrorHandling({
      logLevel: 'debug',
      enableFileLogging: false,
      enableRemoteLogging: false,
      enableHealthMonitoring: true,
      enableNotifications: true
    });
    console.log('✅ Error handling system initialized\n');

    // Test error handling
    console.log('2. Testing error handling...');
    
    // Test different types of errors
    const testErrors = [
      new Error('Test validation error'),
      new Error('Database connection failed'),
      new Error('Network timeout occurred'),
      new Error('Authentication failed'),
      new Error('Rate limit exceeded')
    ];

    for (const error of testErrors) {
      await errorHandler.handleError(error, {
        userId: 123,
        sessionId: 'test-session',
        ip: '127.0.0.1',
        userAgent: 'Test Agent',
        url: '/test',
        method: 'GET'
      });
    }
    console.log('✅ Error handling tests completed\n');

    // Test health monitoring
    console.log('3. Testing health monitoring...');
    const health = await healthMonitor.getSystemHealth();
    console.log(`System Status: ${health.status}`);
    console.log(`Uptime: ${Math.round(health.uptime / 1000)}s`);
    console.log(`Environment: ${health.environment}`);
    console.log(`Checks: ${Object.keys(health.checks).length}`);
    console.log('✅ Health monitoring test completed\n');

    // Test notifications
    console.log('4. Testing notification system...');
    
    await notificationService.sendAlertNotification(
      'Test Alert',
      'This is a test alert to verify the notification system is working',
      'medium',
      { testRun: true }
    );

    await notificationService.sendCustomNotification(
      'Test Custom Notification',
      'This is a custom notification for testing purposes',
      'low',
      ['slack'],
      { testRun: true }
    );
    console.log('✅ Notification system test completed\n');

    // Test error recovery
    console.log('5. Testing error recovery...');
    
    // Register a test recovery strategy
    errorHandler.registerRecoveryStrategy('TEST_ERROR', {
      name: 'Test Recovery',
      maxRetries: 2,
      backoffMs: 1000,
      execute: async (error) => {
        console.log(`  Attempting recovery for: ${error.code}`);
        return Math.random() > 0.5; // 50% success rate for testing
      }
    });

    // Trigger a recoverable error
    await errorHandler.handleError(new Error('Test recoverable error'), {
      userId: 456,
      sessionId: 'recovery-test-session'
    });
    console.log('✅ Error recovery test completed\n');

    console.log('🎉 All tests completed successfully!');
    console.log('\nTo monitor the system in real-time, you can:');
    console.log('- Check health status: GET /health/detailed');
    console.log('- View system metrics in the health monitor');
    console.log('- Monitor logs for error patterns');
    console.log('- Set up alert channels for notifications');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

/**
 * Demonstrate error handling patterns
 */
async function demonstrateErrorPatterns() {
  console.log('\n📚 Error Handling Patterns Demo\n');

  // Pattern 1: Try-catch with centralized error handling
  console.log('Pattern 1: Try-catch with centralized handling');
  try {
    throw new Error('Simulated API error');
  } catch (error) {
    await errorHandler.handleError(error as Error, {
      service: 'demo-service',
      url: '/api/demo',
      method: 'POST'
    });
  }

  // Pattern 2: Promise rejection handling
  console.log('Pattern 2: Promise rejection handling');
  Promise.reject(new Error('Simulated async error'))
    .catch(async (error) => {
      await errorHandler.handleError(error, {
        service: 'async-service',
        metadata: { operation: 'async-operation' }
      });
    });

  // Pattern 3: Custom error with context
  console.log('Pattern 3: Custom error with rich context');
  await errorHandler.handleError({
    code: 'CUSTOM_BUSINESS_ERROR',
    message: 'Business rule violation detected',
    context: {
      timestamp: new Date().toISOString(),
      environment: 'demo',
      service: 'business-logic',
      userId: 789
    },
    severity: 'high',
    category: 'business',
    recoverable: false,
    retryable: false,
    metadata: {
      ruleId: 'RULE_001',
      violationType: 'data_integrity'
    }
  });

  console.log('✅ Error patterns demonstration completed\n');
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];
  
  switch (command) {
    case 'test':
      testErrorHandling().catch(error => {
        console.error('Test execution failed:', error);
        process.exit(1);
      });
      break;
    case 'demo':
      demonstrateErrorPatterns().catch(error => {
        console.error('Demo execution failed:', error);
        process.exit(1);
      });
      break;
    case 'both':
      Promise.all([
        testErrorHandling(),
        demonstrateErrorPatterns()
      ]).catch(error => {
        console.error('Execution failed:', error);
        process.exit(1);
      });
      break;
    default:
      console.log('Usage: node test-error-handling.js [test|demo|both]');
      console.log('  test - Run error handling system tests');
      console.log('  demo - Demonstrate error handling patterns');
      console.log('  both - Run both tests and demo');
      process.exit(1);
  }
}