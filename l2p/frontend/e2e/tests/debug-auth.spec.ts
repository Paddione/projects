import { test, expect } from '@playwright/test';

test.describe('Debug Authentication', () => {
  test('should debug authentication flow', async ({ page }) => {
    // Listen for console logs
    page.on('console', msg => {
      console.log('Browser console:', msg.text());
    });

    // Listen for network requests
    page.on('request', request => {
      if (request.url().includes('/api/auth/')) {
        console.log('Auth request:', request.method(), request.url());
      }
    });

    page.on('response', response => {
      if (response.url().includes('/api/auth/')) {
        console.log('Auth response:', response.status(), response.url());
      }
    });

    // Navigate to the app
    await page.goto('/', { waitUntil: 'networkidle' });
    
    // Wait for React app to load
    await page.waitForFunction(() => {
      const root = document.getElementById('root');
      return root && root.children.length > 0;
    }, { timeout: 10000 });

    // Check if we're showing the auth form
    const authForm = await page.locator('[data-testid="login-tab"]').isVisible();
    console.log('Auth form visible:', authForm);

    if (authForm) {
      // Switch to registration tab
      await page.click('[data-testid="register-tab"]');

      // Fill registration form
      const timestamp = Date.now();
      const username = `debuguser${timestamp}`;
      const email = `debug${timestamp}@example.com`;
      const password = 'TestPassword123!';

      await page.fill('[data-testid="username-input"]', username);
      await page.fill('[data-testid="email-input"]', email);
      await page.fill('[data-testid="password-input"]', password);
      await page.fill('[data-testid="confirm-password-input"]', password);

      // Check if the register button is enabled
      const button = page.locator('[data-testid="register-button"]');
      const isDisabled = await button.isDisabled();
      console.log('Register button disabled:', isDisabled);
      
      // Check if there are any validation errors
      const errorElements = await page.locator('.error, [data-testid*="error"]').count();
      console.log('Number of error elements:', errorElements);

      // Submit registration
      console.log('Clicking register button...');
      await page.click('[data-testid="register-button"]');

      // Wait for any network requests to complete
      await page.waitForLoadState('networkidle');
      
      // Wait longer and check what's on the page
      await page.waitForTimeout(5000);

      // Check if we're still on auth form or if we're authenticated
      const stillAuthForm = await page.locator('[data-testid="login-tab"]').isVisible();
      const welcomeMessage = await page.locator('[data-testid="welcome-message"]').isVisible();
      
      console.log('Still showing auth form:', stillAuthForm);
      console.log('Welcome message visible:', welcomeMessage);

      // Take a screenshot for debugging
      await page.screenshot({ path: 'debug-auth-flow.png' });

      // Log the current URL
      console.log('Current URL:', page.url());

      // Log any console errors
      page.on('console', msg => {
        if (msg.type() === 'error') {
          console.log('Console error:', msg.text());
        }
      });
    }
  });
}); 