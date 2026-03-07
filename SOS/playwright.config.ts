import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3005',
  },
  webServer: {
    command: 'npm run dev',
    port: 3005,
    reuseExistingServer: !process.env.CI,
  },
});
