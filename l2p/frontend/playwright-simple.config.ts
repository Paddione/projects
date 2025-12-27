import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/tests',
  
  /* Output directories */
  outputDir: './e2e/test-results',
  
  /* Test file patterns - focus on smoke tests only */
  testMatch: [
    '**/smoke/*.spec.ts'
  ],
  
  /* Run tests in files in parallel */
  fullyParallel: false,
  
  /* Retry configuration */
  retries: 1,
  
  /* Single worker for simplicity */
  workers: 1,
  
  /* Simple reporter */
  reporter: [
    ['line'],
    ['html', { 
      outputFolder: './e2e/playwright-report',
      open: 'on-failure'
    }]
  ],
  
  /* Global test configuration */
  use: {
    /* Base URL */
    baseURL: 'http://localhost:3000',
    
    /* Screenshot on failure */
    screenshot: 'only-on-failure',
    
    /* Timeout configurations */
    actionTimeout: 10000,
    navigationTimeout: 30000,
    
    /* Browser context options */
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
  },

  /* No global setup or teardown */
  globalSetup: undefined,
  globalTeardown: undefined,

  /* Single browser project for testing */
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        channel: 'chrome'
      }
    }
  ],

  /* Timeout */
  timeout: 30000,
  expect: {
    timeout: 5000
  },

  /* No web server management */
  webServer: undefined
});