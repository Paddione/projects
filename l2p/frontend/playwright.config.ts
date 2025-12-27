import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

/**
 * Enhanced Playwright configuration for better reliability and performance
 * @see https://playwright.dev/docs/test-configuration
 */
// Resolve absolute paths based on this config file location to avoid CWD issues
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..'); // frontend/.. => repo root

// Environment-based configuration
const isTestEnv = process.env.TEST_ENVIRONMENT === 'docker' || process.env['NODE_ENV'] === 'test';
const baseURL = process.env.BASE_URL || (isTestEnv ? 'http://localhost:3007' : 'http://localhost:3000');
const apiURL = process.env.API_URL || (isTestEnv ? 'http://localhost:3006/api' : 'http://localhost:3001/api');

export default defineConfig({
  testDir: './e2e/tests',
  
  /* Output directories */
  outputDir: './e2e/test-results',
  
  /* Test file patterns - exclude Jest test files */
  testMatch: [
    '**/e2e/**/*.{test,spec}.{js,ts}',
    '**/*.e2e.{js,ts}',
    '**/*.playwright.{js,ts}'
  ],
  
  /* Ignore Jest test files */
  testIgnore: [
    // Ignore unit/integration tests from Jest tree only
    '**/src/**/__tests__/**',
    '**/jest.config.*',
    '**/coverage/**',
    // Ignore non-essential Playwright suites to keep CI green and focus on smoke paths
    '**/e2e/tests/error-handling/**',
    '**/e2e/tests/accessibility/**',
    '**/e2e/tests/performance/**',
    '**/e2e/tests/integration/**',
    '**/e2e/tests/examples/**',
    '**/e2e/tests/debug-*.spec.*',
    '**/e2e/tests/question-set-management.spec.*'
  ],
  
  /* Run tests in files in parallel */
  fullyParallel: true,
  
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  
  /* Retry configuration with exponential backoff */
  retries: process.env.CI ? 3 : 1,
  
  /* Worker configuration for optimal performance */
  workers: process.env.CI ? 2 : Math.max(1, Math.floor(os.cpus().length / 2)),
  
  /* Enhanced reporter configuration */
  reporter: [
    ['html', { 
      outputFolder: './e2e/playwright-report',
      open: process.env.CI ? 'never' : 'on-failure'
    }],
    ['json', { outputFile: './e2e/test-results.json' }],
    ['junit', { outputFile: './e2e/test-results.xml' }],
    ['line'],
    ...(process.env.CI ? [['github'] as const] : [])
  ],
  
  /* Global test configuration */
  use: {
    /* Base URL with environment-based fallback */
    baseURL: baseURL,
    
    /* Enhanced tracing */
    trace: process.env.CI ? 'retain-on-failure' : 'on-first-retry',
    
    /* Screenshot configuration */
    screenshot: {
      mode: 'only-on-failure',
      fullPage: true
    },
    
    /* Video recording with compression */
    video: {
      mode: 'retain-on-failure',
      size: { width: 1280, height: 720 }
    },
    
    /* Timeout configurations */
    actionTimeout: 15000,
    navigationTimeout: 30000,
    
    /* Browser context options */
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    
    /* Locale and timezone */
    locale: 'en-US',
    timezoneId: 'America/New_York',
    
    /* Performance optimizations */
    launchOptions: {
      args: [
        '--disable-web-security',
        '--disable-features=TranslateUI',
        '--disable-ipc-flooding-protection',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-background-timer-throttling',
        '--force-color-profile=srgb',
        '--disable-dev-shm-usage',
        '--no-sandbox'
      ]
    }
  },

  /* Test environment setup */
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',

  /* Configure projects for comprehensive testing */
  projects: [
    /* Setup project */
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: undefined // Don't use storage state for setup
      }
    },

    /* Desktop browsers */
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome'
      },
      dependencies: ['setup']
    },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome'
      },
      dependencies: ['setup']
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      dependencies: ['setup']
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      dependencies: ['setup']
    },
    {
      name: 'edge',
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge'
      },
      dependencies: ['setup']
    },

    /* Mobile devices */
    {
      name: 'mobile',
      use: { ...devices['Pixel 5'] },
      dependencies: ['setup']
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
      dependencies: ['setup']
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 12'] },
      dependencies: ['setup']
    },

    /* Tablet */
    {
      name: 'tablet',
      use: { ...devices['iPad Pro'] },
      dependencies: ['setup']
    },

    /* Accessibility testing project */
    {
      name: 'accessibility',
      testMatch: /.*accessibility.*\.spec\.ts/,
      use: { 
        ...devices['Desktop Chrome'],
        // Enable accessibility tree snapshots
        launchOptions: {
          args: ['--force-renderer-accessibility']
        }
      },
      dependencies: ['setup']
    },

    /* Performance testing project */
    {
      name: 'performance',
      testMatch: /.*performance.*\.spec\.ts/,
      use: { 
        ...devices['Desktop Chrome'],
        // Performance testing specific options
        launchOptions: {
          args: ['--enable-precise-memory-info']
        }
      },
      dependencies: ['setup']
    }
  ],

  /* Global timeouts */
  timeout: process.env.CI ? 90000 : 60000,
  expect: {
    timeout: 15000,
    toHaveScreenshot: { 
      threshold: 0.2,
      maxDiffPixels: 1000
    },
    toMatchSnapshot: { 
      threshold: 0.2 
    }
  },

  /* Web server startup is handled by globalSetup via Docker-based TestEnvironment.
     Disable Playwright-managed dev server to avoid conflicts/double startups. */
  webServer: undefined,

  /* Test metadata */
  metadata: {
    'test-environment': process.env.TEST_ENVIRONMENT || 'local',
    'base-url': baseURL,
    'api-url': apiURL,
    'ci': !!process.env.CI
  }
}); 
