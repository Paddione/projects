/**
 * Global Jest Setup for Backend Tests
 * Uses unified test configuration system
 */

module.exports = async function globalSetup() {
  try {
    console.log('Starting global test setup...');
    
    // Set up basic environment variables
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_for_testing_only_not_secure';
    process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_refresh_secret_for_testing_only_not_secure';

    // Auto-select DB: prefer test DB; if unavailable and ALLOW_PROD_DB_IN_TESTS=true, fallback to prod DB
    const allowProd = process.env.ALLOW_PROD_DB_IN_TESTS === 'true';

    const computeTestDbUrl = () => {
      const defaultTestDb = 'postgresql://l2p_user:P/o09KBVVkgN52Hr8hxV7VoyNAHdb3lXLEgyepGdD/o=@localhost:5432/learn2play_test';
      const derived = process.env.DATABASE_URL && process.env.DATABASE_URL.includes('/')
        ? process.env.DATABASE_URL.replace(/\/(\w+)$/, '/learn2play_test')
        : undefined;
      return process.env.TEST_DATABASE_URL || derived || process.env.DATABASE_URL || defaultTestDb;
    };

    const canConnect = async (databaseUrl, ssl) => {
      try {
        const { Pool } = require('pg');
        const pool = new Pool({
          connectionString: databaseUrl,
          ssl: ssl ? { rejectUnauthorized: false } : false,
          connectionTimeoutMillis: 1500
        });
        const client = await pool.connect();
        try {
          await client.query('SELECT 1');
        } finally {
          client.release();
          await pool.end();
        }
        return true;
      } catch (_) {
        return false;
      }
    };

    let selected = 'test';
    let selectedUrl = computeTestDbUrl();

    if (!(await canConnect(selectedUrl, false)) && allowProd) {
      // Try to load prod env from repo or backend root and test prod DB
      try {
        const path = require('path');
        const fs = require('fs');
        const dotenv = require('dotenv');
        const repoRoot = path.join(__dirname, '../../..');
        const backendRoot = path.join(__dirname, '../../');
        const candidates = [
          path.join(repoRoot, '.env.production'),
          path.join(repoRoot, '.env'),
          path.join(backendRoot, '.env.production'),
          path.join(backendRoot, '.env')
        ];
        for (const p of candidates) {
          if (fs.existsSync(p)) {
            dotenv.config({ path: p });
            break;
          }
        }
      } catch (_) { /* ignore */ }

      const prodUrl = process.env.DATABASE_URL;
      const prodSsl = process.env.DB_SSL === 'true';
      if (prodUrl && await canConnect(prodUrl, prodSsl)) {
        selected = 'prod';
        selectedUrl = prodUrl;
        process.env.USE_PROD_DB_FOR_TESTS = 'true';
      }
    }

    // Apply final selection
    process.env.DATABASE_URL = selectedUrl;
    if (selected === 'test') {
      process.env.DB_NAME = process.env.DB_NAME || 'learn2play_test';
      process.env.DB_SSL = process.env.DB_SSL || 'false';
      process.env.DB_HOST = process.env.DB_HOST || 'localhost';
      process.env.DB_PORT = process.env.DB_PORT || '5432';
    }

    console.log(`DB auto-select: ${selected} (${selectedUrl}) ALLOW_PROD_DB_IN_TESTS=${allowProd}`);

    try {
      // Try to load test utilities if available
      const { TestUtilities } = await import('../../../shared/test-config/dist/TestUtilities.js');
      
      // Get test context from environment
      const { environment, testType } = TestUtilities.getCurrentContext();
      
      // Initialize test environment
      const context = await TestUtilities.initializeTestEnvironment(environment, testType);
      
      // Wait for services if needed (for integration tests)
      if (testType === 'integration' || testType === 'e2e') {
        console.log('Waiting for services to be ready...');
        try {
          await TestUtilities.waitForServices(environment, 60000);
          console.log('All services are ready');
        } catch (error) {
          console.warn('Some services may not be ready:', error.message);
          // Continue with tests even if services aren't ready for unit tests
        }
      }
      
      // Store context globally
      global.__TEST_CONTEXT__ = context;
      
      console.log(`Global setup complete for ${environment}/${testType}`);
    } catch (error) {
      console.warn('Could not load test utilities, using basic setup:', error.message);
      console.log('Global setup complete with basic configuration');
    }
  } catch (error) {
    console.error('Global setup failed:', error);
    // Don't throw to allow tests to run with fallback configuration
  }
}