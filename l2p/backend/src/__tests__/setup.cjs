// Jest setup (CommonJS) to avoid ESM transform issues in setupFilesAfterEnv

// Basic env for tests
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_for_testing_only_not_secure';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_refresh_secret_for_testing_only_not_secure';

// Prefer dedicated test DB unless explicitly told to use prod
const useProd = process.env.USE_PROD_DB_FOR_TESTS === 'true';
if (!useProd) {
  const defaultTestDb = 'postgresql://l2p_user:P/o09KBVVkgN52Hr8hxV7VoyNAHdb3lXLEgyepGdD/o=@localhost:5432/learn2play_test';
  const derived = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('/')
    ? process.env.DATABASE_URL.replace(/\/(\w+)$/, '/learn2play_test')
    : undefined;
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || derived || process.env.DATABASE_URL || defaultTestDb;
  process.env.DB_NAME = process.env.DB_NAME || 'learn2play_test';
  process.env.DB_SSL = process.env.DB_SSL || 'false';
  // Provide host/port expected by tests if not set
  process.env.DB_HOST = process.env.DB_HOST || 'localhost';
  process.env.DB_PORT = process.env.DB_PORT || '5432';
}

// Jest timeouts
jest.setTimeout(10000);

// Silence noisy logs in tests
const origLog = console.log;
const origWarn = console.warn;
const origErr = console.error;

beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Selectively suppress expected warnings/errors
console.warn = (...args) => {
  if (typeof args[0] === 'string' && (args[0].includes('Invalid DATABASE_URL') || args[0].includes('Database connection test failed'))) {
    return;
  }
  return origWarn(...args);
};

console.error = (...args) => {
  if (typeof args[0] === 'string' && (args[0].includes('Database connection test failed') || args[0].includes('ECONNREFUSED'))) {
    return;
  }
  return origErr(...args);
};
