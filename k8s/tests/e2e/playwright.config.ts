import { defineConfig } from '@playwright/test';

/**
 * K3d Cluster E2E Test Configuration
 *
 * Tests health endpoints and connectivity for all services
 * deployed in the k3d cluster.
 *
 * Prerequisites:
 * - k3d cluster running
 * - Services deployed (./scripts/deploy/deploy-all.sh)
 * - /etc/hosts entries for *.korczewski.de pointing to 127.0.0.1
 */
export default defineConfig({
  testDir: './specs',
  timeout: 30000,
  retries: 1,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: '../../test-results/playwright-report' }],
    ['json', { outputFile: '../../test-results/results.json' }],
  ],

  outputDir: '../../test-results/test-artifacts',

  use: {
    ignoreHTTPSErrors: true, // Self-signed certs in local k3d
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  globalSetup: './global-setup.ts',
});
