import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    exclude: ['test/e2e/**'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts'],
      thresholds: {
        'src/app.ts': { lines: 90, functions: 90, branches: 85, statements: 90 },
        'src/routes/health.ts': { lines: 95, functions: 95, branches: 90, statements: 95 },
      },
    },
  },
});
