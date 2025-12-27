/**
 * Global Jest Teardown for Backend Tests
 * Uses unified test configuration system
 */

module.exports = async function globalTeardown() {
  try {
    console.log('Starting global test teardown...');
    
    // Get stored context
    const context = global.__TEST_CONTEXT__;
    
    if (context) {
      try {
        const { TestUtilities } = await import('../../../shared/test-config/dist/TestUtilities.js');
        await TestUtilities.cleanupTestEnvironment(context);
      } catch (error) {
        console.warn('Could not load test utilities for cleanup:', error.message);
      }
    }
    
    console.log('Global teardown complete');
  } catch (error) {
    console.warn('Global teardown warning:', error);
  }
}