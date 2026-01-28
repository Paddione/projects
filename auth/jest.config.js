/**
 * Jest Configuration for Auth Service
 *
 * Uses ESM modules with --experimental-vm-modules flag.
 * Run tests with: NODE_OPTIONS=--experimental-vm-modules npx jest
 */

/** @type {import('jest').Config} */
export default {
  // Use ts-jest for TypeScript support with ESM
  preset: 'ts-jest/presets/default-esm',

  // Test environment
  testEnvironment: 'node',

  // Module resolution for ESM
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  // Transform settings for ts-jest ESM
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: 'tsconfig.json',
      },
    ],
  },

  // Test file patterns
  testMatch: [
    '<rootDir>/src/**/*.test.ts',
    '<rootDir>/src/**/*.spec.ts',
  ],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/frontend/',
  ],

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/src/test/setup.ts'],

  // Coverage settings
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/test/**',
    '!src/env.ts',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],

  // Timeout for async operations
  testTimeout: 30000,

  // Verbose output
  verbose: true,

  // Force exit after tests complete (helps with hanging connections)
  forceExit: true,

  // Detect open handles (useful for debugging)
  detectOpenHandles: true,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks between tests
  restoreMocks: true,
};
