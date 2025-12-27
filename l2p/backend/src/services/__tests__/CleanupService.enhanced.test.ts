import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Skip long-running cleanup timer suite during coverage runs
const d = (process.env.TEST_COVERAGE === '1' || process.env.SKIP_TIMER_TESTS === 'true') ? describe.skip : describe;
import { CleanupService } from '../CleanupService.js';

d('CleanupService - Enhanced Testing', () => {
  interface MockLobbyService {
    cleanupInactiveLobbies: jest.MockedFunction<(minutes: number) => Promise<number>>;
    cleanupOldLobbies: jest.MockedFunction<(hours: number) => Promise<number>>;
  }

  let cleanupService: CleanupService;
  let mockLobbyService: MockLobbyService;
  let consoleLogSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();

    // Mock console methods
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    // Create mock LobbyService
    mockLobbyService = {
      cleanupInactiveLobbies: jest.fn(() => Promise.resolve(0)),
      cleanupOldLobbies: jest.fn(() => Promise.resolve(0)),
    } as MockLobbyService;

    cleanupService = new CleanupService(mockLobbyService as any);
  });

  afterEach(() => {
    // Always stop the service to clean up timers
    if (cleanupService) {
      cleanupService.stop();
    }
    
    jest.useRealTimers();
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Periodic Cleanup Execution', () => {
    it('should perform initial cleanup immediately when started', async () => {
      mockLobbyService.cleanupInactiveLobbies.mockResolvedValue(3);
      mockLobbyService.cleanupOldLobbies.mockResolvedValue(2);

      cleanupService.start();

      // Wait for initial cleanup to complete
      await jest.runOnlyPendingTimersAsync();

      expect(mockLobbyService.cleanupInactiveLobbies).toHaveBeenCalledWith(10);
      expect(mockLobbyService.cleanupOldLobbies).toHaveBeenCalledWith(24);
      expect(consoleLogSpy).toHaveBeenCalledWith('Starting cleanup service...');
      expect(consoleLogSpy).toHaveBeenCalledWith('Starting scheduled cleanup...');
    });

    it('should perform cleanup at regular intervals', async () => {
      mockLobbyService.cleanupInactiveLobbies.mockResolvedValue(1);
      mockLobbyService.cleanupOldLobbies.mockResolvedValue(1);

      cleanupService.start();

      // Clear initial call
      mockLobbyService.cleanupInactiveLobbies.mockClear();
      mockLobbyService.cleanupOldLobbies.mockClear();

      // Advance time by 5 minutes (cleanup interval)
      jest.advanceTimersByTime(5 * 60 * 1000);
      await jest.runOnlyPendingTimersAsync();

      expect(mockLobbyService.cleanupInactiveLobbies).toHaveBeenCalledTimes(1);
      expect(mockLobbyService.cleanupOldLobbies).toHaveBeenCalledTimes(1);

      // Advance by another 5 minutes
      jest.advanceTimersByTime(5 * 60 * 1000);
      await jest.runOnlyPendingTimersAsync();

      expect(mockLobbyService.cleanupInactiveLobbies).toHaveBeenCalledTimes(2);
      expect(mockLobbyService.cleanupOldLobbies).toHaveBeenCalledTimes(2);
    });

    it('should stop periodic cleanup when stopped', async () => {
      cleanupService.start();
      
      // Advance past initial cleanup
      await jest.runOnlyPendingTimersAsync();
      
      // Clear counters
      mockLobbyService.cleanupInactiveLobbies.mockClear();
      mockLobbyService.cleanupOldLobbies.mockClear();

      cleanupService.stop();

      // Advance time - no more cleanups should occur
      jest.advanceTimersByTime(10 * 60 * 1000);
      await jest.runOnlyPendingTimersAsync();

      expect(mockLobbyService.cleanupInactiveLobbies).not.toHaveBeenCalled();
      expect(mockLobbyService.cleanupOldLobbies).not.toHaveBeenCalled();
    });
  });

  describe('Cleanup Results Logging', () => {
    it('should log successful cleanup of inactive lobbies', async () => {
      mockLobbyService.cleanupInactiveLobbies.mockResolvedValue(5);
      mockLobbyService.cleanupOldLobbies.mockResolvedValue(0);

      cleanupService.start();
      await jest.runOnlyPendingTimersAsync();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Cleaned up 5 inactive lobbies (older than 10 minutes)'
      );
    });

    it('should log successful cleanup of old lobbies', async () => {
      mockLobbyService.cleanupInactiveLobbies.mockResolvedValue(0);
      mockLobbyService.cleanupOldLobbies.mockResolvedValue(3);

      cleanupService.start();
      await jest.runOnlyPendingTimersAsync();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Cleaned up 3 old ended lobbies (older than 24 hours)'
      );
    });

    it('should log when no cleanup is needed', async () => {
      mockLobbyService.cleanupInactiveLobbies.mockResolvedValue(0);
      mockLobbyService.cleanupOldLobbies.mockResolvedValue(0);

      cleanupService.start();
      await jest.runOnlyPendingTimersAsync();

      expect(consoleLogSpy).toHaveBeenCalledWith('No lobbies needed cleanup');
    });

    it('should log both cleanup operations when both have results', async () => {
      mockLobbyService.cleanupInactiveLobbies.mockResolvedValue(2);
      mockLobbyService.cleanupOldLobbies.mockResolvedValue(1);

      cleanupService.start();
      await jest.runOnlyPendingTimersAsync();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Cleaned up 2 inactive lobbies (older than 10 minutes)'
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Cleaned up 1 old ended lobbies (older than 24 hours)'
      );
      expect(consoleLogSpy).not.toHaveBeenCalledWith('No lobbies needed cleanup');
    });
  });

  describe('Error Handling in Cleanup Operations', () => {
    it('should handle cleanup failures gracefully', async () => {
      const testError = new Error('Database cleanup failed');
      mockLobbyService.cleanupInactiveLobbies.mockRejectedValue(testError);

      cleanupService.start();
      await jest.runOnlyPendingTimersAsync();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error during scheduled cleanup:',
        testError
      );
    });

    it('should continue operation after cleanup failures', async () => {
      // First cleanup fails, second succeeds
      mockLobbyService.cleanupInactiveLobbies
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValueOnce(2);
      mockLobbyService.cleanupOldLobbies.mockResolvedValue(1);

      cleanupService.start();

      // Initial cleanup should fail
      await jest.runOnlyPendingTimersAsync();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error during scheduled cleanup:',
        expect.any(Error)
      );

      // Clear error spy
      consoleErrorSpy.mockClear();

      // Next cleanup should succeed
      jest.advanceTimersByTime(5 * 60 * 1000);
      await jest.runOnlyPendingTimersAsync();

      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        'Cleaned up 2 inactive lobbies (older than 10 minutes)'
      );
    });

    it('should handle partial cleanup failures', async () => {
      mockLobbyService.cleanupInactiveLobbies.mockResolvedValue(3);
      mockLobbyService.cleanupOldLobbies.mockRejectedValue(new Error('Old lobby cleanup failed'));

      cleanupService.start();
      await jest.runOnlyPendingTimersAsync();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error during scheduled cleanup:',
        expect.any(Error)
      );
    });

    it('should handle promise rejection in cleanup methods', async () => {
      const rejectionError = new Error('Async cleanup rejection');
      mockLobbyService.cleanupInactiveLobbies.mockImplementation(() => {
        return Promise.reject(rejectionError);
      });

      cleanupService.start();
      
      // Handle async promise rejections
      await expect(jest.runOnlyPendingTimersAsync()).resolves.not.toThrow();
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error during scheduled cleanup:',
        rejectionError
      );
    });
  });

  describe('Service State Management', () => {
    it('should prevent multiple start calls', () => {
      cleanupService.start();
      cleanupService.start(); // Second call

      expect(consoleLogSpy).toHaveBeenCalledWith('Cleanup service is already running');
    });

    it('should handle stop when service is not running', () => {
      cleanupService.stop(); // Stop without starting

      expect(consoleLogSpy).not.toHaveBeenCalledWith('Cleanup service stopped');
    });

    it('should allow restart after stop', async () => {
      // Start, stop, then start again
      cleanupService.start();
      await jest.runOnlyPendingTimersAsync();

      cleanupService.stop();
      expect(consoleLogSpy).toHaveBeenCalledWith('Cleanup service stopped');

      // Clear logs and restart
      consoleLogSpy.mockClear();
      cleanupService.start();

      expect(consoleLogSpy).toHaveBeenCalledWith('Starting cleanup service...');
    });

    it('should maintain correct status information', () => {
      // Test not running status
      let status = cleanupService.getStatus();
      expect(status.isRunning).toBe(false);
      expect(status.nextCleanup).toBeUndefined();

      // Test running status
      cleanupService.start();
      status = cleanupService.getStatus();
      expect(status.isRunning).toBe(true);
      expect(status.nextCleanup).toBeInstanceOf(Date);

      // Test stopped status
      cleanupService.stop();
      status = cleanupService.getStatus();
      expect(status.isRunning).toBe(false);
      expect(status.nextCleanup).toBeUndefined();
    });
  });

  describe('Timing Configuration', () => {
    it('should use correct cleanup intervals', () => {
      const service = cleanupService as any;

      expect(service.INACTIVE_LOBBY_CLEANUP_MINUTES).toBe(10);
      expect(service.CLEANUP_INTERVAL_MS).toBe(5 * 60 * 1000);
    });

    it('should call cleanup methods with correct parameters', async () => {
      cleanupService.start();
      await jest.runOnlyPendingTimersAsync();

      expect(mockLobbyService.cleanupInactiveLobbies).toHaveBeenCalledWith(10);
      expect(mockLobbyService.cleanupOldLobbies).toHaveBeenCalledWith(24);
    });

    it('should maintain consistent timing across multiple cycles', async () => {
      mockLobbyService.cleanupInactiveLobbies.mockResolvedValue(1);
      mockLobbyService.cleanupOldLobbies.mockResolvedValue(1);

      cleanupService.start();
      
      // Track timestamps
      const timestamps: number[] = [];
      const originalPerformCleanup = (cleanupService as any).performCleanup;
      
      (cleanupService as any).performCleanup = async function() {
        timestamps.push(Date.now());
        return originalPerformCleanup.call(this);
      };

      // Run multiple cleanup cycles
      await jest.runOnlyPendingTimersAsync(); // Initial
      jest.advanceTimersByTime(5 * 60 * 1000);
      await jest.runOnlyPendingTimersAsync(); // First interval
      jest.advanceTimersByTime(5 * 60 * 1000);
      await jest.runOnlyPendingTimersAsync(); // Second interval

      expect(timestamps).toHaveLength(3);
      
      // Verify intervals are consistent (allowing for small timing variations)
      const interval1 = timestamps[1]! - timestamps[0]!;
      const interval2 = timestamps[2]! - timestamps[1]!;
      
      expect(Math.abs(interval1 - (5 * 60 * 1000))).toBeLessThan(100);
      expect(Math.abs(interval2 - (5 * 60 * 1000))).toBeLessThan(100);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle overlapping cleanup operations', async () => {
      // Make cleanup operations take longer than the interval
      let cleanupCount = 0;
      mockLobbyService.cleanupInactiveLobbies.mockImplementation(async () => {
        cleanupCount++;
        // Simulate long-running cleanup
        await new Promise(resolve => setTimeout(resolve, 1000));
        return 1;
      });

      cleanupService.start();

      // Run initial cleanup
      await jest.runOnlyPendingTimersAsync();

      // Start next interval while previous cleanup might still be running
      jest.advanceTimersByTime(5 * 60 * 1000);
      await jest.runOnlyPendingTimersAsync();

      expect(cleanupCount).toBeGreaterThan(0);
    });

    it('should handle service stop during cleanup operation', async () => {
      let cleanupInProgress = false;
      mockLobbyService.cleanupInactiveLobbies.mockImplementation(async () => {
        cleanupInProgress = true;
        await new Promise(resolve => setTimeout(resolve, 100));
        cleanupInProgress = false;
        return 1;
      });

      cleanupService.start();

      // Start cleanup and immediately stop service
      const cleanupPromise = jest.runOnlyPendingTimersAsync();
      cleanupService.stop();

      await cleanupPromise;

      // Service should be stopped even if cleanup was in progress
      const status = cleanupService.getStatus();
      expect(status.isRunning).toBe(false);
    });
  });

  describe('Memory Management', () => {
    it('should not leak timers when started and stopped repeatedly', () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      for (let i = 0; i < 5; i++) {
        cleanupService.start();
        cleanupService.stop();
      }

      // Should have created and cleared the same number of intervals
      expect(setIntervalSpy).toHaveBeenCalledTimes(5);
      expect(clearIntervalSpy).toHaveBeenCalledTimes(5);
    });

    it('should properly cleanup all resources on stop', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      cleanupService.start();
      const timerId = (cleanupService as any).cleanupInterval;
      
      cleanupService.stop();

      expect(clearIntervalSpy).toHaveBeenCalledWith(timerId);
      expect((cleanupService as any).cleanupInterval).toBeNull();
    });
  });

  describe('Integration with Fake Timers', () => {
    it('should work correctly with jest fake timers', async () => {
      mockLobbyService.cleanupInactiveLobbies.mockResolvedValue(2);
      mockLobbyService.cleanupOldLobbies.mockResolvedValue(1);

      cleanupService.start();

      // Use jest timer controls
      expect(jest.getTimerCount()).toBeGreaterThan(0);

      // Run all pending timers
      await jest.runAllTimersAsync();

      expect(mockLobbyService.cleanupInactiveLobbies).toHaveBeenCalled();
      expect(mockLobbyService.cleanupOldLobbies).toHaveBeenCalled();
    });

    it('should handle timer advancement correctly', async () => {
      let cleanupCallCount = 0;
      mockLobbyService.cleanupInactiveLobbies.mockImplementation(async () => {
        cleanupCallCount++;
        return 1;
      });

      cleanupService.start();

      // Initial cleanup
      await jest.runOnlyPendingTimersAsync();
      expect(cleanupCallCount).toBe(1);

      // Advance by exact interval
      jest.advanceTimersByTime(5 * 60 * 1000);
      await jest.runOnlyPendingTimersAsync();
      expect(cleanupCallCount).toBe(2);

      // Advance by multiple intervals
      jest.advanceTimersByTime(15 * 60 * 1000); // 3 intervals
      await jest.runAllTimersAsync();
      expect(cleanupCallCount).toBe(5); // 2 + 3 more
    });
  });
});
