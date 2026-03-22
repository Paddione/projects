/**
 * Vitest Test Setup
 *
 * This file is loaded before all tests run.
 * It sets up global test utilities and cleanup hooks.
 *
 * DB cleanup is dynamic-imported so pure unit tests (middleware, token)
 * can run without DATABASE_URL set.
 */

import { beforeAll, afterAll, vi } from 'vitest';

// Increase timeout for database operations
vi.setConfig({ testTimeout: 30000 });

// Global setup - runs once before all tests
beforeAll(async () => {
  console.log('\n[Test Setup] Starting test suite...');

  if (!process.env.DATABASE_URL) return;

  try {
    const { getTestDataStats, deleteAllTestUsers } = await import('./test-utils.js');
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

  if (!process.env.DATABASE_URL) {
    console.log('[Test Teardown] No DATABASE_URL — skipping cleanup');
    return;
  }

  try {
    const { deleteAllTestUsers } = await import('./test-utils.js');
    const deletedCount = await deleteAllTestUsers();
    if (deletedCount > 0) {
      console.log(`[Test Teardown] Deleted ${deletedCount} test users`);
    }
  } catch {
    console.log('[Test Teardown] No DB connection available — skipping post-test cleanup');
  }

  console.log('[Test Teardown] Test suite complete');
});
