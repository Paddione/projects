// Test setup file for Jest
import { vi } from 'vitest';

// Set test environment variables
process.env['NODE_ENV'] = 'test';

// Load environment variables using centralized loader
// This must happen before any imports that read from process.env
import './config/env.js';

// Set up common mocks
setupCommonMocks();

/**
 * Set up common mocks used across test files
 */
function setupCommonMocks() {
  // Store original console methods
  const originalConsole = { ...console };

  // Mock console methods to reduce test noise
  global.console = {
    ...originalConsole,
    log: vi.fn(originalConsole.log),
    debug: vi.fn(originalConsole.debug),
    info: vi.fn(originalConsole.info),
    warn: vi.fn(originalConsole.warn),
    error: vi.fn(originalConsole.error),
  };

  // Set default mock implementations for common modules
  // These are now handled by manual mocks in __mocks__ directories
}

// Ensure test database configuration is used
const testDatabaseUrl = process.env['TEST_DATABASE_URL'] || 
  (process.env['DATABASE_URL'] ? (process.env['DATABASE_URL'] as string).replace('/learn2play', '/learn2play_test') : 
  'postgresql://l2p_user:P/o09KBVVkgN52Hr8hxV7VoyNAHdb3lXLEgyepGdD/o=@localhost:5432/learn2play_test');

// Override process.env with test-specific values
process.env['DATABASE_URL'] = testDatabaseUrl;
process.env['DB_NAME'] = 'learn2play_test';
process.env['DB_SSL'] = 'false'; // Disable SSL for local testing

// Ensure other test environment variables are set
process.env['GEMINI_API_KEY'] = process.env['GEMINI_API_KEY'] || 'test_key';
process.env['SMTP_HOST'] = process.env['SMTP_HOST'] || 'smtp.test.com';
process.env['SMTP_PORT'] = process.env['SMTP_PORT'] || '587';
process.env['SMTP_USER'] = process.env['SMTP_USER'] || 'test@test.com';
process.env['SMTP_PASS'] = process.env['SMTP_PASS'] || 'test_password';
process.env['JWT_SECRET'] = process.env['JWT_SECRET'] || 'test_jwt_secret';

// Global test timeout (Vitest uses vi.setConfig, not vi.setTimeout)
vi.setConfig({ testTimeout: 30000 });

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Make sure to clean up after tests
const originalExit = process.exit;
// @ts-ignore
process.exit = (code?: number) => {
  // Reset all mocks before exiting
  vi.clearAllMocks();
  vi.resetModules();
  originalExit(code || 0);
};

// Clean up after all tests
afterAll(() => {
  vi.clearAllMocks();
  vi.resetModules();
});

export {}; 
