// Jest setup file for ES modules and shared module support

// Global test configuration
global.jest = jest;

// Mock environment variables for tests
process.env['NODE_ENV'] = process.env['NODE_ENV'] || 'test';
process.env.TEST_ENVIRONMENT = process.env.TEST_ENVIRONMENT || 'local';

// Increase test timeout for integration tests
jest.setTimeout(15000);

// Mock console methods in test environment to reduce noise
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  // Suppress console noise in tests unless VERBOSE_TESTS is set
  error: process.env.VERBOSE_TESTS ? originalConsole.error : jest.fn(),
  warn: process.env.VERBOSE_TESTS ? originalConsole.warn : jest.fn(),
  info: process.env.VERBOSE_TESTS ? originalConsole.info : jest.fn(),
  log: process.env.VERBOSE_TESTS ? originalConsole.log : jest.fn(),
  debug: process.env.VERBOSE_TESTS ? originalConsole.debug : jest.fn(),
};

// Global test utilities
global.testUtils = {
  // Helper to wait for async operations
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Helper to create mock functions with proper typing
  createMockFn: (implementation) => jest.fn(implementation),
  
  // Helper to reset all mocks
  resetAllMocks: () => jest.resetAllMocks(),
};

// Handle unhandled promise rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process in tests, just log the error
});

// Clean up after each test
afterEach(() => {
  // Clear all timers
  jest.clearAllTimers();
  // Clear all mocks
  jest.clearAllMocks();
});
