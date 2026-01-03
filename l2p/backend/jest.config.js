// Backend-specific Jest configuration
const isIntegration = process.env.TEST_TYPE === 'integration';
const collectCoverage = !isIntegration && process.env.TEST_COVERAGE === '1';

const config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch:
    process.env.TEST_TYPE === 'unit'
      ? [
        '**/?(*.)+(spec|test).ts',
        '**/__tests__/**/*.test.ts',
        '**/src/__tests__/**/*.test.ts',
        '!**/*integration*.test.ts',
        '!**/*performance*.test.ts',
        '!**/integration/**/*.test.ts',
        '!**/performance/**/*.test.ts',
        '!**/*smtp-fix*.test.ts',
      ]
      : process.env.TEST_TYPE === 'integration'
        ? ['**/*integration*.test.ts', '**/integration/**/*.test.ts']
        : process.env.TEST_TYPE === 'performance'
          ? ['**/*performance*.test.ts', '**/performance/**/*.test.ts']
          : ['**/?(*.)+(spec|test).ts', '**/__tests__/**/*.test.ts', '**/src/__tests__/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/', '/coverage/'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.tests.json',
        diagnostics: { warnOnly: true },
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'mjs', 'cjs', 'json'],
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/../shared/$1',
    '^@test-config/(.*)$': '<rootDir>/../shared/test-config/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    // Map shared error-handling imports - keep ESM for Jest ESM mode
    '^../../shared/error-handling/dist/index\\.js$': '<rootDir>/../shared/error-handling/dist/index.js',
    '^../../../shared/error-handling/dist/index\\.js$': '<rootDir>/../shared/error-handling/dist/index.js',
    // Map server imports for route tests
    '^../../server\\.js$': '<rootDir>/src/server.ts',
    '^../../server$': '<rootDir>/src/server.ts',
    '^../server\\.js$': '<rootDir>/src/server.ts',
    // Strip .js extensions from relative imports to resolve to .ts files
    '^(\\..*)\\.js$': '$1',
    // Handle specific module resolution issues
    '^\\./BaseRepository\\.js$': '<rootDir>/src/repositories/BaseRepository.ts',
    '^\\./BaseRepository$': '<rootDir>/src/repositories/BaseRepository.ts',
    '^../utils/pagination\\.js$': '<rootDir>/src/utils/pagination.ts',
    '^../types/User\\.js$': '<rootDir>/src/types/User.ts',
    '^../BaseRepository$': '<rootDir>/src/repositories/BaseRepository.ts',
    '^../../services/AuthService$': '<rootDir>/src/services/AuthService.ts',
    '^../../services/EmailService$': '<rootDir>/src/services/EmailService.ts',
    '^../../services/DatabaseService$': '<rootDir>/src/services/DatabaseService.ts',
    '^../../services/LobbyService$': '<rootDir>/src/services/LobbyService.ts',
    '^../../services/MigrationService$': '<rootDir>/src/services/MigrationService.ts',
    '^../DatabaseService$': '<rootDir>/src/services/DatabaseService.ts',
    '^../EmailService$': '<rootDir>/src/services/EmailService.ts',
    '^../MigrationService$': '<rootDir>/src/services/MigrationService.ts',
    // Service mock mappings
    '^../LobbyService$': '<rootDir>/src/services/LobbyService.ts',
    '^../QuestionService$': '<rootDir>/src/services/QuestionService.ts',
    '^../ScoringService$': '<rootDir>/src/services/ScoringService.ts',
    '^../CharacterService$': '<rootDir>/src/services/CharacterService.ts',
    '^../GameService$': '<rootDir>/src/services/GameService.ts',
    '^../SocketService$': '<rootDir>/src/services/SocketService.ts',
    // Repository mock mappings
    '^../../repositories/GameSessionRepository$': '<rootDir>/src/repositories/GameSessionRepository.ts',
    '^../../repositories/UserRepository$': '<rootDir>/src/repositories/UserRepository.ts',
    '^../../repositories/LobbyRepository$': '<rootDir>/src/repositories/LobbyRepository.ts',
    '^../../repositories/QuestionRepository$': '<rootDir>/src/repositories/QuestionRepository.ts',
    // Middleware mappings
    '^../../middleware/logging$': '<rootDir>/src/middleware/logging.ts',
    '^\\./middleware/correlationId\\.js$': '<rootDir>/src/middleware/correlationId.ts',
    '^\\./middleware/metrics\\.js$': '<rootDir>/src/middleware/metrics.ts',
    // Specific DatabaseService mappings for different relative paths
    '^\\.\\.\\./DatabaseService\\.js$': '<rootDir>/src/services/DatabaseService.ts',
    '^\\.\\.\\./\\.\\.\\./services/DatabaseService\\.js$': '<rootDir>/src/services/DatabaseService.ts',
    // UserRepository mappings
    '^\\.\\.\\./\\.\\.\\./repositories/UserRepository\\.js$': '<rootDir>/src/repositories/UserRepository.ts',
  },
  transformIgnorePatterns: ['node_modules/(?!(jsonwebtoken|crypto))'],
  modulePathIgnorePatterns: ['<rootDir>/dist/', '<rootDir>/build/'],
  setupFiles: ['<rootDir>/jest.setup.mjs'],
  setupFilesAfterEnv: [
    '<rootDir>/jest.setup.timeout.mjs',
    ...(isIntegration
      ? ['<rootDir>/jest.setup.integration.mjs', '<rootDir>/src/__tests__/integration/setupMigrations.ts']
      : []),
  ],
  globalTeardown: isIntegration ? '<rootDir>/jest.teardown.mjs' : undefined,
  testPathIgnorePatterns: ['/node_modules/', '/dist/', '/build/', '/coverage/', '/frontend/'],
  testEnvironmentOptions: { customExportConditions: ['node', 'node-addons'] },
  collectCoverageFrom: collectCoverage
    ? [
      'src/services/**/*.ts',
      'src/repositories/**/*.ts',
      'src/middleware/**/*.ts',
      // Exclusions
      '!**/*.d.ts',
      '!**/node_modules/**',
      '!**/dist/**',
      '!**/coverage/**',
      '!**/__tests__/**',
      '!**/__mocks__/**',
      '!**/test-utils/**',
    ]
    : [],
  collectCoverage,
  coverageDirectory: collectCoverage ? 'coverage' : undefined,
  coverageReporters: collectCoverage ? ['text', 'lcov', 'html', 'json-summary'] : undefined,
  coveragePathIgnorePatterns: collectCoverage
    ? [
      '.*\\.test\\.ts$',
      '.*\\.spec\\.ts$',
      '/node_modules/',
      '/dist/',
      '/coverage/',
      '/__tests__/',
      '/__mocks__/',
    ]
    : [],
  coverageThreshold: collectCoverage
    ? {
      global: { statements: 30, branches: 25, functions: 30, lines: 30 },
    }
    : undefined,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  maxWorkers: 1,
  injectGlobals: true,
  workerIdleMemoryLimit: '512MB',
  detectOpenHandles: true,
  forceExit: isIntegration, // Force exit for integration tests with persistent connections
};

export default config;
