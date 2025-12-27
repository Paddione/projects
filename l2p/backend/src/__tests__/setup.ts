import { Server } from 'http';
import express from 'express';

export interface TestEnvironment {
  app: express.Application;
  server: Server;
}

// Set up environment variables for tests using .env configuration
function setupTestEnvironmentVariables() {
  process.env.NODE_ENV = 'test';
  
  // Use test database from .env files
  const testDatabaseUrl = process.env.TEST_DATABASE_URL || 
    process.env.DATABASE_URL?.replace('/learn2play', '/learn2play_test') ||
    'postgresql://l2p_user:P/o09KBVVkgN52Hr8hxV7VoyNAHdb3lXLEgyepGdD/o=@localhost:5432/learn2play_test';
  
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.DB_NAME = 'learn2play_test';
  process.env.DB_SSL = 'false'; // Disable SSL for local testing
  
  // Use existing .env configuration for other variables
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret_for_testing_only_not_secure';
  process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test_refresh_secret_for_testing_only_not_secure';
  process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test_key';
}

// Global test setup
global.beforeAll(async () => {
  try {
    // Set up environment variables first
    setupTestEnvironmentVariables();
    
    // Set up environment variables using .env configuration
    setupTestEnvironmentVariables();
    console.log('Test setup complete using .env configuration');
  } catch (error) {
    console.error('Test setup failed:', error);
    // Ensure environment variables are set even if setup fails
    setupTestEnvironmentVariables();
  }
});

// Global test teardown
global.afterAll(async () => {
  try {
    console.log('Test teardown complete');
  } catch (error) {
    console.warn('Test teardown warning:', error);
  }
});

// Mock console methods to reduce noise in tests
const originalConsole = { ...console };
global.beforeEach(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

global.afterEach(() => {
  jest.restoreAllMocks();
});

// Set timeout
jest.setTimeout(10000);

// Suppress console warnings during tests
const originalWarn = console.warn;
console.warn = (...args: any[]) => {
  // Suppress specific warnings that are expected in test environment
  if (typeof args[0] === 'string' && (args[0].includes('Invalid DATABASE_URL') || 
      args[0].includes('Database connection test failed'))) {
    return;
  }
  originalWarn(...args);
};

// Suppress console errors during tests
const originalError = console.error;
console.error = (...args: any[]) => {
  // Suppress specific errors that are expected in test environment
  if (args[0] && typeof args[0] === 'string' && (args[0].includes('Database connection test failed') ||
      args[0].includes('ECONNREFUSED'))) {
    return;
  }
  originalError(...args);
};

// Mock external services for unit tests
jest.mock('../services/DatabaseService.js', () => ({
  DatabaseService: {
    reset: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue({ rows: [] }),
    getClient: jest.fn().mockResolvedValue({
      query: jest.fn().mockResolvedValue({ rows: [] }),
      release: jest.fn()
    })
  }
}));

// ChromaService mock removed - no longer needed

jest.mock('../services/GeminiService.js', () => ({
  GeminiService: {
    getInstance: jest.fn().mockReturnValue({
      generateQuestions: jest.fn().mockResolvedValue({
        questions: [],
        metadata: {}
      })
    })
  }
}));

async function setupTestEnvironment(): Promise<TestEnvironment> {
  // Import the app directly
  const { app } = await import('../server.js');
  
  // Create a test server
  const server = app.listen(0); // Use port 0 to get a random available port
  
  return { app, server };
}

async function cleanupTestEnvironment(server: Server): Promise<void> {
  return new Promise((resolve) => {
    if (server && server.close) {
      server.close(() => {
        resolve();
      });
    } else {
      resolve();
    }
  });
} 