import { cleanupTestData, closePool } from './src/__tests__/utils/test-cleanup.js';

/**
 * Global teardown for Jest tests
 * This runs once after all test suites have completed
 */
export default async function teardown() {
  console.log('\n🧪 Running global test teardown...');

  try {
    // Clean up test data from production database if using it
    if (process.env.USE_PROD_DB_FOR_TESTS === 'true') {
      await cleanupTestData();
    }

    // Close database pool
    await closePool();

    console.log('✅ Global teardown completed successfully\n');
  } catch (error) {
    console.error('❌ Error during global teardown:', error);
    // Don't throw - allow tests to complete even if cleanup fails
  }
}
