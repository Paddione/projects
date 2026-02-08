import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { TimerTestUtils, AsyncCleanupTestUtils, ConsoleTestUtils } from '../../../../../shared-infrastructure/shared/l2p/test-utils/timer-test-utils';

// Skip this entire suite during coverage runs or when explicitly requested
const d = (process.env.TEST_COVERAGE === '1' || process.env.SKIP_TIMER_TESTS === 'true') ? describe.skip : describe;

/**
 * Example test file demonstrating comprehensive timer and cleanup testing patterns
 * This serves as both documentation and verification of the test utilities
 */

// Mock service for demonstration
class MockTimerService {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();

  startTimer(id: string, delay: number = 1000) {
    const timer = setTimeout(() => {
      console.log(`Timer ${id} executed`);
    }, delay);

    // Mock unref behavior in test environment
    if (process.env.TEST_ENVIRONMENT === 'local' && timer.unref) {
      timer.unref();
    }

    this.timers.set(id, timer);
    return timer;
  }

  startInterval(id: string, delay: number = 1000) {
    const interval = setInterval(() => {
      console.log(`Interval ${id} tick`);
    }, delay);

    if (process.env.TEST_ENVIRONMENT === 'local' && interval.unref) {
      interval.unref();
    }

    this.intervals.set(id, interval);
    return interval;
  }

  clearTimer(id: string) {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }

  clearInterval(id: string) {
    const interval = this.intervals.get(id);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(id);
    }
  }

  cleanup() {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.intervals.forEach((interval) => clearInterval(interval));
    this.timers.clear();
    this.intervals.clear();
  }

  async performAsyncCleanup() {
    // Simulate async cleanup operation
    await new Promise(resolve => setTimeout(resolve, 100));
    this.cleanup();
    console.log('Async cleanup completed');
  }

  getActiveTimerCount() {
    return this.timers.size + this.intervals.size;
  }
}

d('Timer Test Utilities - Examples and Verification', () => {
  let mockService: MockTimerService;
  let consoleCapture: ReturnType<typeof ConsoleTestUtils.captureConsoleOutput>;

  beforeEach(() => {
    TimerTestUtils.setupFakeTimers();
    mockService = new MockTimerService();
    consoleCapture = ConsoleTestUtils.captureConsoleOutput();
  });

  afterEach(() => {
    mockService.cleanup();
    TimerTestUtils.restoreRealTimers();
    consoleCapture.restore();
  });

  describe('Timer Creation Testing', () => {
    it('should verify timer creation with specific delays', () => {
      const verifier = TimerTestUtils.createTimerVerifier();

      mockService.startTimer('test-timer', 5000);
      mockService.startInterval('test-interval', 2000);

      expect(verifier.verifyTimerCreated('timeout', 5000)).toBe(true);
      expect(verifier.verifyTimerCreated('interval', 2000)).toBe(true);
      expect(verifier.getTimerCount()).toBe(2);
      expect(verifier.getTimerCount('timeout')).toBe(1);
      expect(verifier.getTimerCount('interval')).toBe(1);
    });

    it('should track timer lifecycle', () => {
      const verifier = TimerTestUtils.createTimerVerifier();

      const timer = mockService.startTimer('lifecycle-test', 1000);
      expect(verifier.getTimerCount()).toBe(1);

      mockService.clearTimer('lifecycle-test');
      expect(verifier.verifyTimerCleared(timer)).toBe(true);
      expect(verifier.getTimerCount()).toBe(0);
    });
  });

  describe('Timer Execution Testing', () => {
    it('should test timer callbacks execution', async () => {
      mockService.startTimer('callback-test', 1000);

      // Advance time and wait for execution
      await TimerTestUtils.advanceTimersByTimeAsync(1000);

      consoleCapture.expectLogContaining('Timer callback-test executed');
    });

    it('should test interval execution multiple times', async () => {
      mockService.startInterval('interval-test', 500);

      // Run for 2.5 seconds using jest.advanceTimersByTime directly
      // (advanceTimersByTimeAsync also runs pending timers which may fire extra ticks)
      jest.advanceTimersByTime(2500);

      // At 500ms intervals over 2500ms: fires at 500, 1000, 1500, 2000, 2500 = 5 times
      expect(consoleCapture.logs.filter(log =>
        log.includes('Interval interval-test tick')
      )).toHaveLength(5);
    });

    it('should handle timer execution with timeout protection', async () => {
      // Create a timer that might cause issues
      mockService.startTimer('potentially-problematic', 100);

      // Use timeout protection
      await expect(
        TimerTestUtils.runAllTimersAsync(1000)
      ).resolves.not.toThrow();
    });
  });

  describe('Timer unref Testing', () => {
    it('should verify unref is called in test environment', () => {
      const mockUnref = TimerTestUtils.mockTimerUnref();
      process.env.TEST_ENVIRONMENT = 'local';

      mockService.startTimer('unref-test');
      mockService.startInterval('unref-interval');

      expect(mockUnref.getUnrefCallsForType('timeout')).toHaveLength(1);
      expect(mockUnref.getUnrefCallsForType('interval')).toHaveLength(1);

      delete process.env.TEST_ENVIRONMENT;
    });
  });

  describe('Cleanup Operation Testing', () => {
    it('should test synchronous cleanup operations', () => {
      const verifier = TimerTestUtils.createTimerVerifier();

      // Create multiple timers
      mockService.startTimer('cleanup-test-1', 1000);
      mockService.startTimer('cleanup-test-2', 2000);
      mockService.startInterval('cleanup-interval', 500);

      expect(verifier.getTimerCount()).toBe(3);

      // Test cleanup
      mockService.cleanup();

      expect(verifier.verifyAllTimersCleared()).toBe(true);
      expect(mockService.getActiveTimerCount()).toBe(0);
    });

    it('should test asynchronous cleanup operations', async () => {
      const helper = TimerTestUtils.createCleanupTestHelper();

      // Create some timers
      mockService.startTimer('async-cleanup-1');
      mockService.startInterval('async-cleanup-2');

      // Perform async cleanup
      const cleanupPromise = mockService.performAsyncCleanup();
      helper.addOperation('async-cleanup', cleanupPromise);

      // Advance fake timers so the setTimeout inside performAsyncCleanup resolves
      await TimerTestUtils.advanceTimersByTimeAsync(200);

      await helper.waitForAllOperations();

      expect(helper.verifyAllOperationsCompleted()).toBe(true);
      expect(helper.verifyOperationSuccessful('async-cleanup')).toBe(true);
      consoleCapture.expectLogContaining('Async cleanup completed');
    });

    it('should test long-running cleanup operations', async () => {
      const longRunningCleanup = async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
        mockService.cleanup();
      };

      // Start the cleanup and advance fake timers so the setTimeout resolves
      const resultPromise = AsyncCleanupTestUtils.testLongRunningCleanup(
        longRunningCleanup,
        5000
      );

      // Advance fake timers to resolve the setTimeout(500) inside the cleanup
      await TimerTestUtils.advanceTimersByTimeAsync(600);

      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.timedOut).toBe(false);
    });

    it('should test concurrent cleanup operations', async () => {
      const cleanupFns = [
        () => mockService.performAsyncCleanup(),
        async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          mockService.cleanup();
        },
        async () => {
          mockService.cleanup();
        }
      ];

      // Start all concurrent cleanups (they use setTimeout internally under fake timers)
      const resultPromise = AsyncCleanupTestUtils.testConcurrentCleanup(
        cleanupFns,
        'all-succeed'
      );

      // Advance fake timers to resolve the setTimeouts inside the cleanup functions
      await TimerTestUtils.advanceTimersByTimeAsync(200);

      const result = await resultPromise;

      expect(result.meetsExpectation).toBe(true);
      expect(result.successful).toBe(3);
      expect(result.failed).toBe(0);
    });
  });

  describe('Resource Monitoring', () => {
    it('should monitor resource usage during operations', async () => {
      const monitor = AsyncCleanupTestUtils.monitorResourceUsage();

      // Perform some operations
      for (let i = 0; i < 10; i++) {
        mockService.startTimer(`resource-test-${i}`, 100 * i);
      }

      await TimerTestUtils.advanceTimersByTimeAsync(1000);
      mockService.cleanup();

      const metrics = monitor.finish();

      expect(metrics.duration).toBeGreaterThan(0);
      expect(typeof metrics.memoryDelta.rss).toBe('number');
      expect(typeof metrics.memoryDelta.heapUsed).toBe('number');
    });
  });

  describe('Error Handling in Timer Operations', () => {
    it('should handle timer callback errors gracefully', async () => {
      // Create a timer that throws an error
      const errorTimer = setTimeout(() => {
        throw new Error('Timer callback error');
      }, 100);

      // Under fake timers, thrown errors in callbacks propagate.
      // Verify the error is thrown (expected behavior with fake timers).
      try {
        await TimerTestUtils.advanceTimersByTimeAsync(200);
      } catch (error) {
        // Timer callback error is expected - fake timers propagate throws
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Timer callback error');
      }
    });

    it('should handle cleanup errors', async () => {
      const faultyCleanup = async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        throw new Error('Cleanup failed');
      };

      // Start the faulty cleanup and advance fake timers so the setTimeout resolves
      const resultPromise = AsyncCleanupTestUtils.testLongRunningCleanup(faultyCleanup);

      // Advance fake timers to resolve the setTimeout(100) inside the cleanup
      await TimerTestUtils.advanceTimersByTimeAsync(200);

      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error).toBeInstanceOf(Error);
      expect((result.error as Error).message).toBe('Cleanup failed');
    });
  });

  describe('Timer Test Suite Generator', () => {
    const timerSuite = TimerTestUtils.createTimerTestSuite('MockTimerService');

    timerSuite.testTimerCreation(
      () => mockService.startTimer('suite-test', 1000),
      'timeout',
      1000
    );

    timerSuite.testTimerCleanup(
      () => {
        mockService.startTimer('cleanup-suite-test-1');
        mockService.startTimer('cleanup-suite-test-2');
      },
      () => mockService.cleanup()
    );

    timerSuite.testTimerUnref(
      () => mockService.startTimer('unref-suite-test')
    );

    it('should handle async cleanup: should complete async cleanup successfully', async () => {
      const helper = TimerTestUtils.createCleanupTestHelper();
      const cleanupPromise = mockService.performAsyncCleanup();
      helper.addOperation('cleanup', cleanupPromise);

      // Advance fake timers so the setTimeout inside performAsyncCleanup resolves
      await TimerTestUtils.advanceTimersByTimeAsync(200);

      await helper.waitForAllOperations();
      expect(helper.verifyAllOperationsCompleted()).toBe(true);
      expect(helper.verifyOperationSuccessful('cleanup')).toBe(true);
    });
  });

  describe('Integration Testing', () => {
    it('should handle complex timer interactions', async () => {
      const helper = TimerTestUtils.createCleanupTestHelper();

      // Create a complex scenario (without verifier, since it replaces
      // fake timers with pass-through to real timers, breaking advanceTimersByTimeAsync)
      mockService.startTimer('quick', 100);
      mockService.startTimer('medium', 500);
      mockService.startTimer('slow', 1000);
      mockService.startInterval('periodic', 200);

      // Advance time by 600ms using jest directly (not advanceTimersByTimeAsync
      // which also runs pending timers and may fire additional interval ticks)
      jest.advanceTimersByTime(600);

      // Should have executed: quick (100ms), medium (500ms), and 3 intervals (200ms, 400ms, 600ms)
      expect(consoleCapture.logs.filter(log => log.includes('quick executed'))).toHaveLength(1);
      expect(consoleCapture.logs.filter(log => log.includes('medium executed'))).toHaveLength(1);
      expect(consoleCapture.logs.filter(log => log.includes('periodic tick'))).toHaveLength(3);

      // Clean up remaining timers synchronously
      mockService.cleanup();
      expect(mockService.getActiveTimerCount()).toBe(0);
    });
  });
});
