// Auto-generated test configuration - Updated by TestRunnerConfigUpdater
// Last updated: 2025-08-06T03:31:40.724Z
import { defineConfig, devices } from '@playwright/test';

/**
 * Shared ignore patterns for non-essential test suites.
 * Project-level testIgnore overrides global testIgnore in Playwright,
 * so we define them once and spread into each project.
 */
const ignoredSuites = [
  '**/error-handling/**',
  '**/accessibility/**',
  '**/performance/**',
  '**/examples/**',
  '**/question-set-management.spec.*',
  '**/smoke/basic-functionality.spec.ts',
];

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
  /* Global ignore (applies unless overridden by project-level testIgnore) */
  testIgnore: ignoredSuites,
  webServer: {
    command: 'npm --prefix .. run dev -- --host 127.0.0.1 --port 3000',
    url: process.env.BASE_URL || 'http://127.0.0.1:3000',
    reuseExistingServer: true,
    timeout: 120000,
    env: {
      ...process.env,
      VITE_TEST_MODE: 'true'
    }
  },
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: process.env.BASE_URL || 'http://127.0.0.1:3000',
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
    /* Ignore HTTPS errors for local k3d testing */
    ignoreHTTPSErrors: true,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      /* Must include all ignoredSuites + integration (project-level overrides global) */
      testIgnore: [...ignoredSuites, '**/integration/**'],
    },
    {
      name: 'integration',
      use: { ...devices['Desktop Chrome'] },
      testMatch: '**/integration/**',
      /* Must include ignoredSuites so only integration tests run (not other excluded suites) */
      testIgnore: ignoredSuites,
      timeout: 120000,
    },
  ],

  /* Global test timeout */
  timeout: 30000,
  expect: {
    /* Global expect timeout */
    timeout: 15000,
  },

});
