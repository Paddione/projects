import { jest } from '@jest/globals';

/**
 * Comprehensive timer testing utilities for consistent timer behavior testing
 */
export class TimerTestUtils {
  private static originalSetTimeout: typeof setTimeout;
  private static originalSetInterval: typeof setInterval;
  private static originalClearTimeout: typeof clearTimeout;
  private static originalClearInterval: typeof clearInterval;

  /**
   * Setup fake timers with comprehensive spying
   */
  static setupFakeTimers() {
    // Store original functions
    this.originalSetTimeout = global.setTimeout;
    this.originalSetInterval = global.setInterval;
    this.originalClearTimeout = global.clearTimeout;
    this.originalClearInterval = global.clearInterval;

    // Use Jest fake timers
    jest.useFakeTimers();

    return {
      setTimeoutSpy: jest.spyOn(global, 'setTimeout'),
      setIntervalSpy: jest.spyOn(global, 'setInterval'),
      clearTimeoutSpy: jest.spyOn(global, 'clearTimeout'),
      clearIntervalSpy: jest.spyOn(global, 'clearInterval'),
    };
  }

  /**
   * Restore real timers and clean up spies
   */
  static restoreRealTimers() {
    jest.useRealTimers();
  }

  /**
   * Create a mock timer that tracks its lifecycle
   */
  static createMockTimer(type: 'timeout' | 'interval' = 'timeout') {
    const mockTimer = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      isCleared: false,
      unref: jest.fn(),
      ref: jest.fn(),
      refresh: jest.fn(),
      [Symbol.toPrimitive]: () => mockTimer.id,
    };

    const originalClear = type === 'timeout' ? this.originalClearTimeout : this.originalClearInterval;
    
    // Mock the clear function to track clearing
    const clearSpy = jest.spyOn(global, type === 'timeout' ? 'clearTimeout' : 'clearInterval')
      .mockImplementation((timer: any) => {
        if (timer === mockTimer) {
          mockTimer.isCleared = true;
        }
        return originalClear(timer);
      });

    return { mockTimer, clearSpy };
  }

  /**
   * Wait for all pending timers to execute with timeout protection
   */
  static async runAllTimersAsync(timeoutMs: number = 5000): Promise<void> {
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error(`Timer execution timeout after ${timeoutMs}ms`)), timeoutMs);
    });

    const timerPromise = jest.runAllTimersAsync();

    try {
      await Promise.race([timerPromise, timeoutPromise]);
    } catch (error) {
      // If timeout, try to run only pending timers
      if (error instanceof Error && error.message.includes('timeout')) {
        await jest.runOnlyPendingTimersAsync();
      } else {
        throw error;
      }
    }
  }

  /**
   * Advance timers by time with pending timer execution
   */
  static async advanceTimersByTimeAsync(ms: number): Promise<void> {
    jest.advanceTimersByTime(ms);
    await jest.runOnlyPendingTimersAsync();
  }

  /**
   * Create a timer verification helper
   */
  static createTimerVerifier() {
    const createdTimers: any[] = [];
    const clearedTimers: any[] = [];

    const setTimeoutSpy = jest.spyOn(global, 'setTimeout')
      .mockImplementation((callback: any, delay: number) => {
        const timer = this.originalSetTimeout(callback, delay);
        createdTimers.push({ timer, type: 'timeout', delay, callback });
        return timer;
      });

    const setIntervalSpy = jest.spyOn(global, 'setInterval')
      .mockImplementation((callback: any, delay: number) => {
        const timer = this.originalSetInterval(callback, delay);
        createdTimers.push({ timer, type: 'interval', delay, callback });
        return timer;
      });

    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout')
      .mockImplementation((timer: any) => {
        clearedTimers.push({ timer, type: 'timeout' });
        return this.originalClearTimeout(timer);
      });

    const clearIntervalSpy = jest.spyOn(global, 'clearInterval')
      .mockImplementation((timer: any) => {
        clearedTimers.push({ timer, type: 'interval' });
        return this.originalClearInterval(timer);
      });

    return {
      createdTimers,
      clearedTimers,
      spies: { setTimeoutSpy, setIntervalSpy, clearTimeoutSpy, clearIntervalSpy },
      verifyTimerCreated: (type: 'timeout' | 'interval', delay?: number) => {
        const matching = createdTimers.filter(t => 
          t.type === type && (delay === undefined || t.delay === delay)
        );
        return matching.length > 0;
      },
      verifyTimerCleared: (timer: any) => {
        return clearedTimers.some(t => t.timer === timer);
      },
      verifyAllTimersCleared: () => {
        return createdTimers.every(created => 
          clearedTimers.some(cleared => cleared.timer === created.timer)
        );
      },
      getTimerCount: (type?: 'timeout' | 'interval') => {
        const active = createdTimers.filter(created => 
          !clearedTimers.some(cleared => cleared.timer === created.timer)
        );
        return type ? active.filter(t => t.type === type).length : active.length;
      }
    };
  }

  /**
   * Create a cleanup operation test helper
   */
  static createCleanupTestHelper() {
    const operations: Array<{
      name: string;
      promise: Promise<any>;
      status: 'pending' | 'resolved' | 'rejected';
      result?: any;
      error?: any;
    }> = [];

    const addOperation = (name: string, promise: Promise<any>) => {
      const operation: {
        name: string;
        promise: Promise<any>;
        status: 'pending' | 'resolved' | 'rejected';
        result?: any;
        error?: any;
      } = { name, promise, status: 'pending' };
      operations.push(operation);

      promise
        .then(result => {
          operation.status = 'resolved';
          operation.result = result;
        })
        .catch(error => {
          operation.status = 'rejected';
          operation.error = error;
        });

      return promise;
    };

    const waitForAllOperations = async (timeoutMs: number = 5000) => {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`Operations timeout after ${timeoutMs}ms`)), timeoutMs);
      });

      const allOperations = Promise.all(
        operations.map(op => op.promise.catch(() => null)) // Don't fail if individual operations fail
      );

      try {
        await Promise.race([allOperations, timeoutPromise]);
      } catch (error) {
        console.warn('Some cleanup operations may not have completed:', error);
      }
    };

    const getOperationStatus = (name?: string) => {
      if (name) {
        return operations.filter(op => op.name === name);
      }
      return operations;
    };

    const verifyAllOperationsCompleted = () => {
      return operations.every(op => op.status !== 'pending');
    };

    const verifyOperationSuccessful = (name: string) => {
      const operation = operations.find(op => op.name === name);
      return operation?.status === 'resolved';
    };

    return {
      addOperation,
      waitForAllOperations,
      getOperationStatus,
      verifyAllOperationsCompleted,
      verifyOperationSuccessful,
      reset: () => operations.splice(0, operations.length)
    };
  }

  /**
   * Mock unref behavior for Node.js timers
   */
  static mockTimerUnref() {
    const unrefCalls: Array<{ timer: any; type: string }> = [];

    const createMockWithUnref = (originalFn: any, type: string) => {
      return (...args: any[]) => {
        const timer = originalFn(...args);
        if (timer && typeof timer === 'object') {
          timer.unref = jest.fn(() => {
            unrefCalls.push({ timer, type });
            return timer;
          });
        }
        return timer;
      };
    };

    const setTimeoutSpy = jest.spyOn(global, 'setTimeout')
      .mockImplementation(createMockWithUnref(this.originalSetTimeout, 'timeout'));

    const setIntervalSpy = jest.spyOn(global, 'setInterval')
      .mockImplementation(createMockWithUnref(this.originalSetInterval, 'interval'));

    return {
      unrefCalls,
      setTimeoutSpy,
      setIntervalSpy,
      verifyUnrefCalled: (timer: any) => {
        return unrefCalls.some(call => call.timer === timer);
      },
      getUnrefCallsForType: (type: string) => {
        return unrefCalls.filter(call => call.type === type);
      }
    };
  }

  /**
   * Create a comprehensive timer test suite
   */
  static createTimerTestSuite(serviceName: string) {
    return {
      /**
       * Test timer creation and management
       */
      testTimerCreation: (createTimerFn: () => any, expectedType: 'timeout' | 'interval', expectedDelay?: number) => {
        it(`should create ${expectedType} timer with correct delay`, () => {
          const verifier = TimerTestUtils.createTimerVerifier();
          
          createTimerFn();

          expect(verifier.verifyTimerCreated(expectedType, expectedDelay)).toBe(true);
          if (expectedDelay !== undefined) {
            const matching = verifier.createdTimers.filter(t => 
              t.type === expectedType && t.delay === expectedDelay
            );
            expect(matching).toHaveLength(1);
          }
        });
      },

      /**
       * Test timer cleanup
       */
      testTimerCleanup: (createTimerFn: () => any, cleanupFn: () => void) => {
        it('should properly clean up timers', () => {
          const verifier = TimerTestUtils.createTimerVerifier();
          
          createTimerFn();
          expect(verifier.getTimerCount()).toBeGreaterThan(0);

          cleanupFn();
          expect(verifier.verifyAllTimersCleared()).toBe(true);
        });
      },

      /**
       * Test timer behavior in test environment
       */
      testTimerUnref: (createTimerFn: () => any) => {
        it('should unref timers in test environment', () => {
          const mockUnref = TimerTestUtils.mockTimerUnref();
          process.env.TEST_ENVIRONMENT = 'local';

          createTimerFn();

          expect(mockUnref.unrefCalls.length).toBeGreaterThan(0);
          
          delete process.env.TEST_ENVIRONMENT;
        });
      },

      /**
       * Test async cleanup operations
       */
      testAsyncCleanup: (cleanupFn: () => Promise<any>, expectedBehavior: string) => {
        it(`should handle async cleanup: ${expectedBehavior}`, async () => {
          const helper = TimerTestUtils.createCleanupTestHelper();
          
          const cleanupPromise = cleanupFn();
          helper.addOperation('cleanup', cleanupPromise);

          await helper.waitForAllOperations();
          expect(helper.verifyAllOperationsCompleted()).toBe(true);
          expect(helper.verifyOperationSuccessful('cleanup')).toBe(true);
        });
      }
    };
  }
}

/**
 * Async cleanup test utilities
 */
export class AsyncCleanupTestUtils {
  /**
   * Test long-running cleanup operations
   */
  static async testLongRunningCleanup(
    cleanupFn: () => Promise<any>,
    timeoutMs: number = 1000
  ) {
    const startTime = Date.now();
    
    try {
      await cleanupFn();
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      return {
        success: true,
        duration,
        timedOut: false
      };
    } catch (error) {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      return {
        success: false,
        duration,
        timedOut: duration >= timeoutMs,
        error
      };
    }
  }

  /**
   * Test concurrent cleanup operations
   */
  static async testConcurrentCleanup(
    cleanupFns: Array<() => Promise<any>>,
    expectedBehavior: 'all-succeed' | 'some-fail' | 'race-condition' = 'all-succeed'
  ) {
    const results = await Promise.allSettled(
      cleanupFns.map(fn => fn())
    );

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return {
      total: results.length,
      successful,
      failed,
      results,
      meetsExpectation: (() => {
        switch (expectedBehavior) {
          case 'all-succeed': return failed === 0;
          case 'some-fail': return failed > 0 && successful > 0;
          case 'race-condition': return true; // Any outcome is acceptable for race conditions
          default: return true;
        }
      })()
    };
  }

  /**
   * Test cleanup operation with resource monitoring
   */
  static monitorResourceUsage() {
    const startMemory = process.memoryUsage();
    const startTime = process.hrtime.bigint();

    return {
      finish: () => {
        const endMemory = process.memoryUsage();
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - startTime) / 1000000; // Convert to milliseconds

        return {
          duration,
          memoryDelta: {
            rss: endMemory.rss - startMemory.rss,
            heapUsed: endMemory.heapUsed - startMemory.heapUsed,
            heapTotal: endMemory.heapTotal - startMemory.heapTotal,
            external: endMemory.external - startMemory.external
          }
        };
      }
    };
  }
}

/**
 * Console output capture utilities for testing logging behavior
 */
export class ConsoleTestUtils {
  private static originalConsole: {
    log: typeof console.log;
    error: typeof console.error;
    warn: typeof console.warn;
    info: typeof console.info;
  };

  static captureConsoleOutput() {
    this.originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info
    };

    const logs: string[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];
    const infos: string[] = [];

    const logSpy = jest.spyOn(console, 'log').mockImplementation((...args) => {
      logs.push(args.join(' '));
    });

    const errorSpy = jest.spyOn(console, 'error').mockImplementation((...args) => {
      errors.push(args.join(' '));
    });

    const warnSpy = jest.spyOn(console, 'warn').mockImplementation((...args) => {
      warnings.push(args.join(' '));
    });

    const infoSpy = jest.spyOn(console, 'info').mockImplementation((...args) => {
      infos.push(args.join(' '));
    });

    return {
      logs,
      errors,
      warnings,
      infos,
      spies: { logSpy, errorSpy, warnSpy, infoSpy },
      restore: () => {
        logSpy.mockRestore();
        errorSpy.mockRestore();
        warnSpy.mockRestore();
        infoSpy.mockRestore();
      },
      expectLogContaining: (text: string) => {
        expect(logs.some(log => log.includes(text))).toBe(true);
      },
      expectErrorContaining: (text: string) => {
        expect(errors.some(error => error.includes(text))).toBe(true);
      },
      expectNoErrors: () => {
        expect(errors).toHaveLength(0);
      }
    };
  }
}
