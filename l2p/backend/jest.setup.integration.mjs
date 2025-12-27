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

// Ensure we use local test database
process.env.DATABASE_URL = 'postgresql://test_user:test_password@localhost:5433/learn2play_test';
process.env.TEST_DATABASE_URL = 'postgresql://test_user:test_password@localhost:5433/learn2play_test';

// Database configuration
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5433';
process.env.DB_NAME = 'learn2play_test';
process.env.DB_USER = 'test_user';
process.env.DB_PASSWORD = 'test_password';
process.env.DB_SSL = 'false';

// Test database configuration
process.env.TEST_DB_HOST = 'localhost';
process.env.TEST_DB_PORT = '5433';
process.env.TEST_DB_NAME = 'learn2play_test';
process.env.TEST_DB_USER = 'test_user';
process.env.TEST_DB_PASSWORD = 'test_password';

// JWT configuration for tests - use longer secrets
process.env.JWT_SECRET = 'test_jwt_secret_for_testing_only_not_secure_but_long_enough_for_jwt';
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_for_testing_only_not_secure_but_long_enough';

console.log('Integration test setup: Using DATABASE_URL:', process.env.DATABASE_URL);

// Set flag to suppress database logging during test cleanup
process.env.SUPPRESS_DB_LOGGING = 'true';
