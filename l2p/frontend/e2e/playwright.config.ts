// Auto-generated test configuration - Updated by TestRunnerConfigUpdater
// Last updated: 2025-08-06T03:31:40.724Z
import { defineConfig, devices } from '@playwright/test';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 1,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ['html'],
    ['json', { outputFile: 'test-results.json' }],
    ['junit', { outputFile: 'test-results.xml' }]
  ],
  /* Ignore non-essential suites */
  testIgnore: [
    '**/tests/error-handling/**',
    '**/tests/accessibility/**',
    '**/tests/performance/**',
    '**/tests/integration/**',
    '**/tests/examples/**',
    '**/tests/debug-*.spec.*',
    '**/tests/question-set-management.spec.*',
    '**/tests/auth-flow.spec.*',
    '**/tests/smoke/basic-functionality.spec.ts'
  ],
  webServer: {
    command: 'npm --prefix .. run dev -- --host 127.0.0.1 --port 3000',
    url: process.env.BASE_URL || 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      ...process.env,
      VITE_TEST_MODE: 'true'
    }
  },
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    /* Extra HTTP headers to be sent with every request */
    extraHTTPHeaders: {
      'Accept': 'application/json',
    },
    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
    /* Screenshot on failure */
    screenshot: 'only-on-failure',
    /* Video recording */
    video: 'retain-on-failure',
    /* Global timeout for each action */
    actionTimeout: 15000,
    /* Navigation timeout */
    navigationTimeout: 30000,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Global test timeout */
  timeout: 30000,
  expect: {
    /* Global expect timeout */
    timeout: 15000,
  },

});
