import { defineConfig, devices } from '@playwright/test';


export default defineConfig({
    testDir: './test/e2e',
    fullyParallel: false,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: 1,
    reporter: 'html',
    globalSetup: './test/e2e/support/global-setup.ts',
    globalTeardown: './test/e2e/support/global-teardown.ts',
    use: {
        baseURL: 'http://localhost:3004',
        trace: 'on-first-retry',
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
    webServer: {
        command: 'npm run dev',
        url: 'http://localhost:3004',
        reuseExistingServer: true,
        timeout: 120 * 1000,
        env: {
            DATABASE_URL: 'postgresql://payment_user:2e67a4d8576773457fcaac19b3de8b1c@localhost:5432/payment_test?schema=public'
        }
    },
});
