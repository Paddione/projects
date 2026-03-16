/**
 * Jest Configuration for middleware unit tests (no database required)
 *
 * Omits the global DB setup so pure middleware tests can run in isolation.
 */

/** @type {import('jest').Config} */
export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: 'tsconfig.json',
      },
    ],
  },
  testMatch: [
    '<rootDir>/src/test/internal-auth.test.ts',
  ],
  verbose: true,
  forceExit: true,
  clearMocks: true,
  restoreMocks: true,
};
