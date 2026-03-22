import { chromium, FullConfig } from '@playwright/test';

/**
 * Global setup for Playwright tests
 * Ensures test environment is ready before running tests
 */
async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting global test setup...');

  // Determine test environment and base URL
  const isTestEnv = process.env.TEST_ENVIRONMENT === 'docker' || process.env['NODE_ENV'] === 'test';
  const baseURL = process.env.BASE_URL || (isTestEnv ? 'http://localhost:3007' : 'http://localhost:3000');

  console.log(`🔧 Test Environment: ${isTestEnv ? 'Docker Test Stack' : 'Local Development'}`);
  console.log(`🌐 Base URL: ${baseURL}`);

  // In local dev mode, webServer starts Vite AFTER globalSetup — skip availability check.
  // In Docker/CI mode, the test stack must already be running, so verify it.
  if (isTestEnv) {
    const browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      console.log(`Checking if application is available at ${baseURL}...`);
      await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 30000 });
      console.log('✅ Application is available');

      console.log('🔍 Verifying test environment configuration...');
      const apiURL = process.env.API_URL || 'http://localhost:3006/api';
      try {
        const response = await page.request.get(`${apiURL}/health`);
        if (response.ok()) {
          console.log('✅ Test API is available');
        } else {
          console.warn('⚠️ Test API health check failed');
        }
      } catch (error) {
        console.warn('⚠️ Could not verify test API availability');
      }
    } catch (error) {
      console.error('❌ Application not available');
      console.log('  For Docker test environment:');
      console.log('    docker compose -f docker-compose.test.yml up -d --build');
      console.log('    Wait for all services to be healthy');
      throw new Error(`Application not available at ${baseURL}`);
    } finally {
      await page.close();
      await context.close();
      await browser.close();
    }
  } else {
    console.log('⏭️ Skipping availability check — webServer will start Vite dev server');
  }

  console.log('✅ Global setup completed');
}

export default globalSetup;
