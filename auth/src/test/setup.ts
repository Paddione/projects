/**
 * Jest Test Setup
 *
 * This file is loaded before all tests run.
 * It sets up global test utilities and cleanup hooks.
 */

import { jest, beforeAll, afterAll } from '@jest/globals';
import { deleteAllTestUsers, getTestDataStats } from './test-utils.js';

// Increase timeout for database operations
jest.setTimeout(30000);

// Global setup - runs once before all tests
beforeAll(async () => {
  console.log('\n[Test Setup] Starting test suite...');

  // Check for any leftover test data from previous runs
  const stats = await getTestDataStats();
  if (stats.testUsers > 0) {
    console.log(`[Test Setup] Found ${stats.testUsers} leftover test users, cleaning up...`);
    await deleteAllTestUsers();
  }
});

// Global teardown - runs once after all tests
afterAll(async () => {
  console.log('\n[Test Teardown] Cleaning up test data...');

  const deletedCount = await deleteAllTestUsers();
  if (deletedCount > 0) {
    console.log(`[Test Teardown] Deleted ${deletedCount} test users`);
  }

  console.log('[Test Teardown] Test suite complete');
});

// Export for use in tests that need custom setup/teardown
export { deleteAllTestUsers, getTestDataStats };
