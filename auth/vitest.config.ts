import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/frontend/**'],
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    testTimeout: 30_000,
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.spec.ts',
        'src/test/**',
        'src/env.ts',
      ],
      thresholds: {
        'src/middleware/authenticate.ts': { lines: 90, functions: 90, branches: 85, statements: 90 },
        'src/middleware/csrf.ts': { lines: 95, functions: 95, branches: 90, statements: 95 },
        'src/middleware/correlationId.ts': { lines: 95, functions: 95, branches: 90, statements: 95 },
        'src/middleware/errorHandler.ts': { lines: 90, functions: 90, branches: 85, statements: 90 },
        'src/services/TokenService.ts': { lines: 85, functions: 85, branches: 80, statements: 85 },
      },
    },
  },
});
