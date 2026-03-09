import { defineConfig, devices } from '@playwright/test';

/**
 * Arena E2E Test Configuration
 *
 * Strategy:
 * - Playwright spins up the Vite dev server (frontend only) for local testing.
 * - Individual tests mock the backend API + socket.io at the network layer
 *   using page.route() / page.evaluate() so no live database is required.
 * - Auth headers are injected via mocked /api/auth/me responses.
 *
 * To run locally:
 *   npx playwright test
 *   npx playwright test --ui
 *
 * To run against production:
 *   PLAYWRIGHT_BASE_URL=https://arena.korczewski.de npx playwright test
 *   (Filesystem tests are automatically skipped for remote servers)
 *
 * Show report:
 *   npx playwright show-report
 */

const isRemoteTest = () => {
    const baseUrl = process.env.PLAYWRIGHT_BASE_URL;
    return baseUrl && (baseUrl.includes('http://') || baseUrl.includes('https://'));
};

export default defineConfig({
    testDir: './e2e',
    fullyParallel: false,          // Socket tests need isolation
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1,                    // Sequential — avoids port conflicts
    reporter: [
        ['list'],
        ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ],

    use: {
        baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3002',
        trace: 'on-first-retry',
        screenshot: 'only-on-failure',
        // Don't actually talk to the backend — tests mock what they need
        ignoreHTTPSErrors: true,
    },

    projects: [
        {
            name: 'chromium',
            testIgnore: '**/mobile.spec.ts',
            use: { ...devices['Desktop Chrome'] },
        },
        {
            name: 'mobile-portrait',
            testMatch: '**/e2e/mobile.spec.ts',
            use: {
                ...devices['iPhone 13'],
                defaultBrowserType: 'chromium',
                hasTouch: true,
            },
        },
        {
            name: 'mobile-landscape',
            testMatch: '**/e2e/mobile.spec.ts',
            use: {
                ...devices['iPhone 13'],
                defaultBrowserType: 'chromium',
                hasTouch: true,
                // iPhone 15 Pro Max landscape (large modern device)
                viewport: { width: 932, height: 430 },
                deviceScaleFactor: 3,
            },
        },
    ],

    // Spin up Vite dev server before tests (local only)
    webServer: isRemoteTest() ? undefined : {
        command: 'npm run dev:frontend',
        url: 'http://localhost:3002',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        stdout: 'ignore',
        stderr: 'pipe',
    },
});
