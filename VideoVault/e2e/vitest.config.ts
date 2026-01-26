import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname, '..'),
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, '..', 'shared-infrastructure', 'shared', 'videovault'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    setupFiles: [path.resolve(__dirname, 'vitest.setup.ts')],
    include: ['e2e/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 10000,
    teardownTimeout: 10000,
    pool: 'threads',
    poolOptions: {
      threads: { singleThread: true },
    },
    bail: 1,
  },
});

