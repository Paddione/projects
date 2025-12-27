// Jest setup file - globals are injected automatically with injectGlobals: true

// Override environment variables for unit tests to use local test database
process.env.NODE_ENV = 'test';
process.env.TEST_ENVIRONMENT = 'local';
process.env.TEST_TYPE = 'unit';

// Ensure we use local test database on port 5433
process.env.DATABASE_URL = 'postgresql://l2p_user:HEHlWwBhTj71Em5GL9qh8G8kXACPrzx3@localhost:5433/learn2play_test';
process.env.TEST_DATABASE_URL = 'postgresql://l2p_user:HEHlWwBhTj71Em5GL9qh8G8kXACPrzx3@localhost:5433/learn2play_test';

// Database configuration for unit tests
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5433';
process.env.DB_NAME = 'learn2play_test';
process.env.DB_USER = 'l2p_user';
process.env.DB_PASSWORD = 'HEHlWwBhTj71Em5GL9qh8G8kXACPrzx3';
process.env.DB_SSL = 'false';

// Test database configuration
process.env.TEST_DB_HOST = 'localhost';
process.env.TEST_DB_PORT = '5433';
process.env.TEST_DB_NAME = 'learn2play_test';
process.env.TEST_DB_USER = 'l2p_user';
process.env.TEST_DB_PASSWORD = 'HEHlWwBhTj71Em5GL9qh8G8kXACPrzx3';

console.log('Unit test setup: Using DATABASE_URL:', process.env.DATABASE_URL);
