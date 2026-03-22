/**
 * Jest Test Setup
 *
 * This file is loaded before all tests run.
 * It sets up global test utilities and cleanup hooks.
 */

import { beforeAll, afterAll, vi } from 'vitest';
import { deleteAllTestUsers, getTestDataStats } from './test-utils.js';

// Increase timeout for database operations
vi.setConfig({ testTimeout: 30000 });

// Global setup - runs once before all tests
beforeAll(async () => {
  console.log('\n[Test Setup] Starting test suite...');

  // Check for any leftover test data from previous runs.
  // Gracefully skip DB cleanup when no database connection is available
  // (e.g. pure unit tests running without a DB).
  try {
    const stats = await getTestDataStats();
    if (stats.testUsers > 0) {
      console.log(`[Test Setup] Found ${stats.testUsers} leftover test users, cleaning up...`);
      await deleteAllTestUsers();
    }
  } catch {
    console.log('[Test Setup] No DB connection available — skipping pre-test cleanup');
  }
});

// Global teardown - runs once after all tests
afterAll(async () => {
  console.log('\n[Test Teardown] Cleaning up test data...');

  try {
    const deletedCount = await deleteAllTestUsers();
    if (deletedCount > 0) {
      console.log(`[Test Teardown] Deleted ${deletedCount} test users`);
    }
  } catch {
    console.log('[Test Teardown] No DB connection available — skipping post-test cleanup');
  }

  console.log('[Test Teardown] Test suite complete');
});

// Export for use in tests that need custom setup/teardown
export { deleteAllTestUsers, getTestDataStats };
