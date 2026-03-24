import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: [
      { find: /^@shared\/(.*)/, replacement: path.resolve(__dirname, '../packages/$1') },
      { find: /^@test-config\/(.*)/, replacement: path.resolve(__dirname, '../packages/test-config/$1') },
      { find: /^@\/(.*)/, replacement: path.resolve(__dirname, 'src/$1') },
      { find: /^\.\.\/\.\.\/server(\.js)?$/, replacement: path.resolve(__dirname, 'src/server.ts') },
      { find: /^\.\.\/server(\.js)?$/, replacement: path.resolve(__dirname, 'src/server.ts') },
    ],
  },
  test: {
    globals: true,
    environment: 'node',
    root: './src',
    include: ['**/*.test.ts', '**/__tests__/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/coverage/**'],
    setupFiles: ['../vitest.setup.ts'],
    testTimeout: 30_000,
    clearMocks: true,
    restoreMocks: true,
    maxConcurrency: 1,
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      include: ['services/**/*.ts', 'repositories/**/*.ts', 'middleware/**/*.ts'],
      exclude: ['**/*.test.ts', '**/__tests__/**', '**/__mocks__/**', '**/*.d.ts'],
      thresholds: {
        statements: 30,
        branches: 25,
        functions: 30,
        lines: 30,
      },
    },
  },
});
