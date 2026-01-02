// Jest setup for integration tests
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load test environment variables
dotenv.config({ path: path.join(__dirname, '.env.test') });

// Override environment variables for integration tests
process.env.NODE_ENV = 'test';
process.env.TEST_ENVIRONMENT = 'local';
process.env.TEST_TYPE = 'integration';
process.env.AUTH_SERVICE_URL = '';

// Ensure we use local test database
process.env.DATABASE_URL = 'postgresql://l2p_user:06752fc9637d5fe896cd88b858d2cf2eff112de5cf4769e69927009f5d45d581@127.0.0.1:5432/l2p_db';
process.env.TEST_DATABASE_URL = 'postgresql://l2p_user:06752fc9637d5fe896cd88b858d2cf2eff112de5cf4769e69927009f5d45d581@127.0.0.1:5432/l2p_db';

// Database configuration
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'l2p_db';
process.env.DB_USER = 'l2p_user';
process.env.DB_PASSWORD = '06752fc9637d5fe896cd88b858d2cf2eff112de5cf4769e69927009f5d45d581';
process.env.DB_SSL = 'false';

// Test database configuration
process.env.TEST_DB_HOST = '127.0.0.1';
process.env.TEST_DB_PORT = '5432';
process.env.TEST_DB_NAME = 'l2p_db';
process.env.TEST_DB_USER = 'l2p_user';
process.env.TEST_DB_PASSWORD = '06752fc9637d5fe896cd88b858d2cf2eff112de5cf4769e69927009f5d45d581';

// JWT configuration for tests - use longer secrets
process.env.JWT_SECRET = 'test_jwt_secret_for_testing_only_not_secure_but_long_enough_for_jwt';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_for_testing_only_not_secure_but_long_enough';

console.log('Integration test setup: Using DATABASE_URL:', process.env.DATABASE_URL);

// Set flag to suppress database logging during test cleanup
process.env.SUPPRESS_DB_LOGGING = 'true';
