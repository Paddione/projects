// Jest setup file - globals are injected automatically with injectGlobals: true

// Override environment variables for unit tests without clobbering explicit config
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.TEST_ENVIRONMENT = process.env.TEST_ENVIRONMENT || 'local';
process.env.TEST_TYPE = process.env.TEST_TYPE || 'unit';

const useProdDb = process.env.USE_PROD_DB_FOR_TESTS === 'true';

if (useProdDb) {
  process.env.DATABASE_URL =
    process.env.DATABASE_URL ||
    'postgresql://l2p_user:06752fc9637d5fe896cd88b858d2cf2eff112de5cf4769e69927009f5d45d581@localhost:5432/l2p_db';
  process.env.TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

  // Database configuration for tests using production database
  process.env.DB_HOST = process.env.DB_HOST || 'localhost';
  process.env.DB_PORT = process.env.DB_PORT || '5432';
  process.env.DB_NAME = process.env.DB_NAME || 'l2p_db';
  process.env.DB_USER = process.env.DB_USER || 'l2p_user';
  process.env.DB_PASSWORD =
    process.env.DB_PASSWORD || '06752fc9637d5fe896cd88b858d2cf2eff112de5cf4769e69927009f5d45d581';
  process.env.DB_SSL = process.env.DB_SSL || 'false';

  // Test database configuration (same as production for this setup)
  process.env.TEST_DB_HOST = process.env.TEST_DB_HOST || process.env.DB_HOST;
  process.env.TEST_DB_PORT = process.env.TEST_DB_PORT || process.env.DB_PORT;
  process.env.TEST_DB_NAME = process.env.TEST_DB_NAME || process.env.DB_NAME;
  process.env.TEST_DB_USER = process.env.TEST_DB_USER || process.env.DB_USER;
  process.env.TEST_DB_PASSWORD = process.env.TEST_DB_PASSWORD || process.env.DB_PASSWORD;

  console.log('Unit test setup: Using PRODUCTION DATABASE:', process.env.DATABASE_URL);
  console.warn('⚠️  WARNING: Tests are using PRODUCTION database. Test data will be cleaned up after tests.');
}
