import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@\/(.*)/, replacement: path.resolve(__dirname, 'src/$1') },
      { find: /^@frontend\/(.*)/, replacement: path.resolve(__dirname, 'src/$1') },
      { find: 'shared-3d', replacement: path.resolve(__dirname, 'src/__mocks__/shared-3d.js') },
      { find: '@react-three/fiber', replacement: path.resolve(__dirname, 'src/__mocks__/@react-three/fiber.js') },
      { find: '@react-three/drei', replacement: path.resolve(__dirname, 'src/__mocks__/@react-three/drei.js') },
      { find: /^three\/addons\/(.*)/, replacement: path.resolve(__dirname, 'src/__mocks__/three-addons.js') },
      { find: /^three$/, replacement: path.resolve(__dirname, 'src/__mocks__/three.js') },
    ],
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'src/**/__tests__/**/*.test.{ts,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**', '**/*.e2e.*', '**/*.playwright.*'],
    testTimeout: 10_000,
    clearMocks: true,
    restoreMocks: true,
    css: {
      modules: {
        classNameStrategy: 'non-scoped',
      },
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.d.ts',
        'src/main.tsx',
        'src/setupTests.ts',
        'src/test-setup.ts',
        'src/__mocks__/**',
      ],
      thresholds: {
        statements: 30,
        branches: 25,
        functions: 30,
        lines: 30,
      },
    },
  },
});
