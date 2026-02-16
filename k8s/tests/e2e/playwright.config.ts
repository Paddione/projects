import { defineConfig, devices } from '@playwright/test';

/**
 * K3d Cluster E2E Test Configuration
 */
export default defineConfig({
  testDir: './specs',
  timeout: 60000,
  expect: {
    timeout: 10000
  },
  fullyParallel: false, // Run sequentially for better stability in k3d
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: 1, // Stick to 1 worker for infrastructure tests to avoid race conditions

  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],

  globalSetup: require.resolve('./global-setup.ts'),

  use: {
    baseURL: 'https://auth.korczewski.de',
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'on-first-retry',
    viewport: { width: 1280, height: 720 },
    // Bypass rate limiting for automated tests (sent with every request including XHR/fetch)
    extraHTTPHeaders: {
      ...(process.env.RATE_LIMIT_BYPASS_KEY ? { 'x-rate-limit-bypass': process.env.RATE_LIMIT_BYPASS_KEY } : {}),
    },
    launchOptions: {
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
      ],
    },
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
});
