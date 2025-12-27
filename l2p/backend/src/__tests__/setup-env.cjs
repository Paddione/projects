// Pre-test environment setup (runs before test files are loaded)
// Do NOT use Jest APIs in this file.

process.env.NODE_ENV = process.env.NODE_ENV || 'test';

// Match expected secrets in tests
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';

// SMTP Configuration for tests
// When TEST_REAL_SMTP=true, use actual production SMTP credentials for integration testing
// Otherwise, tests will mock the email service
const useRealSmtp = process.env.TEST_REAL_SMTP === 'true';
if (useRealSmtp) {
  process.env.SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
  process.env.SMTP_PORT = process.env.SMTP_PORT || '587';
  process.env.SMTP_SECURE = process.env.SMTP_SECURE || 'false';
  process.env.SMTP_USER = process.env.SMTP_USER || 'p.korczewski@gmail.com';
  process.env.SMTP_PASS = process.env.SMTP_PASS || 'mxbd2kfpnqwer8st';
  process.env.EMAIL_SENDER_ADDRESS = process.env.EMAIL_SENDER_ADDRESS || 'noreply@l2p.korczewski.de';
  process.env.EMAIL_SENDER_NAME = process.env.EMAIL_SENDER_NAME || 'Learn2Play';
  console.log('Test environment: Using real SMTP configuration for email testing');
} else {
  // Set test-safe SMTP values that will be mocked
  process.env.SMTP_HOST = process.env.SMTP_HOST || 'smtp.test.com';
  process.env.SMTP_PORT = process.env.SMTP_PORT || '587';
  process.env.SMTP_SECURE = process.env.SMTP_SECURE || 'false';
  process.env.SMTP_USER = process.env.SMTP_USER || 'test@example.com';
  process.env.SMTP_PASS = process.env.SMTP_PASS || 'testpassword';
  process.env.EMAIL_SENDER_ADDRESS = process.env.EMAIL_SENDER_ADDRESS || 'noreply@test.com';
  process.env.EMAIL_SENDER_NAME = process.env.EMAIL_SENDER_NAME || 'Test Platform';
}

// Database-related env (safe defaults for unit tests)
// If USE_PROD_DB_FOR_TESTS=true, DO NOT override DATABASE_URL/DB_* so tests hit the live prod DB.
const useProd = process.env.USE_PROD_DB_FOR_TESTS === 'true';
if (useProd) {
  // Load production env if available so DATABASE_URL and DB_* come from .env.production
  try {
    const path = require('path');
    const fs = require('fs');
    const rootDir = path.join(__dirname, '../../');
    const prodEnv = path.join(rootDir, '.env.production');
    const defaultEnv = path.join(rootDir, '.env');
    const envPath = fs.existsSync(prodEnv) ? prodEnv : (fs.existsSync(defaultEnv) ? defaultEnv : undefined);
    if (envPath) {
      require('dotenv').config({ path: envPath });
    }
  } catch (_) {
    // best-effort; continue if dotenv not available
  }
}
if (!useProd) {
  const defaultTestDb = 'postgresql://l2p_user:P/o09KBVVkgN52Hr8hxV7VoyNAHdb3lXLEgyepGdD/o=@localhost:5432/learn2play_test';
  const derived = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('/')
    ? process.env.DATABASE_URL.replace(/\/(\w+)$/, '/learn2play_test')
    : undefined;
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || derived || process.env.DATABASE_URL || defaultTestDb;
  process.env.DB_NAME = process.env.DB_NAME || 'learn2play_test';
  process.env.DB_SSL = process.env.DB_SSL || 'false';
  process.env.DB_HOST = process.env.DB_HOST || 'localhost';
  process.env.DB_PORT = process.env.DB_PORT || '5432';
}
