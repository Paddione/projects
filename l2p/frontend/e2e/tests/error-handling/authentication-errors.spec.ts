import { test, expect } from '@playwright/test';

test.describe('Authentication Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should handle invalid JWT tokens', async ({ page }) => {
    // Register user first
    await page.click('text=Register');
    const timestamp = Date.now();
    const username = `tokenuser${timestamp}`;
    const email = `tokenuser${timestamp}@example.com`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    // Set invalid token
    await page.evaluate(() => {
      localStorage.setItem('authToken', 'invalid.jwt.token');
    });

    // Try to access protected resource
    await page.click('[data-testid="create-lobby-button"]');
    
    // Should redirect to login or show token error
    await expect(page).toHaveURL(/.*login/);
    // OR expect error message
    // await expect(page.locator('[data-testid="error-message"]')).toContainText(/invalid.*token/i);
  });

  test('should handle expired JWT tokens', async ({ page }) => {
    // Register user first
    await page.click('text=Register');
    const timestamp = Date.now();
    const username = `expireduser${timestamp}`;
    const email = `expireduser${timestamp}@example.com`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    // Set expired token (simulate by setting old timestamp)
    await page.evaluate(() => {
      const expiredToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImlhdCI6MTUxNjIzOTAyMiwiZXhwIjoxNTE2MjM5MDIyfQ.invalid';
      localStorage.setItem('authToken', expiredToken);
    });

    // Try to access protected resource
    await page.click('[data-testid="create-lobby-button"]');
    
    // Should redirect to login or show expired token error
    await expect(page).toHaveURL(/.*login/);
    // OR expect error message
    // await expect(page.locator('[data-testid="error-message"]')).toContainText(/token.*expired/i);
  });

  test('should handle malformed JWT tokens', async ({ page }) => {
    // Register user first
    await page.click('text=Register');
    const timestamp = Date.now();
    const username = `malformeduser${timestamp}`;
    const email = `malformeduser${timestamp}@example.com`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    // Set malformed token
    await page.evaluate(() => {
      localStorage.setItem('authToken', 'not.a.valid.jwt.token');
    });

    // Try to access protected resource
    await page.click('[data-testid="create-lobby-button"]');
    
    // Should redirect to login or show malformed token error
    await expect(page).toHaveURL(/.*login/);
    // OR expect error message
    // await expect(page.locator('[data-testid="error-message"]')).toContainText(/malformed.*token/i);
  });

  test('should handle session expiration', async ({ page }) => {
    // Register and login user
    await page.click('text=Register');
    const timestamp = Date.now();
    const username = `sessionuser${timestamp}`;
    const email = `sessionuser${timestamp}@example.com`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    // Simulate session expiration by clearing token
    await page.evaluate(() => {
      localStorage.removeItem('authToken');
    });

    // Try to perform authenticated action
    await page.click('[data-testid="create-lobby-button"]');
    
    // Should redirect to login
    await expect(page).toHaveURL(/.*login/);
    await expect(page.locator('[data-testid="error-message"]')).toContainText(/session.*expired|please.*login/i);
  });

  test('should handle unauthorized access attempts', async ({ page }) => {
    // Try to access protected route without authentication
    await page.goto('/dashboard');
    
    // Should redirect to login
    await expect(page).toHaveURL(/.*login/);
    await expect(page.locator('[data-testid="error-message"]')).toContainText(/unauthorized|access.*denied/i);

    // Try to access API endpoint directly
    await page.goto('/api/lobby');
    
    // Should show unauthorized error
    await expect(page.locator('body')).toContainText(/unauthorized|access.*denied/i);
  });

  test('should handle account lockout after failed attempts', async ({ page }) => {
    // Try multiple failed login attempts
    await page.click('text=Login');
    
    const maxAttempts = 5;
    for (let i = 0; i < maxAttempts; i++) {
      await page.fill('[data-testid="username-input"]', 'nonexistentuser');
      await page.fill('[data-testid="password-input"]', 'WrongPassword123!');
      await page.click('[data-testid="login-button"]');
      
      await expect(page.locator('[data-testid="error-message"]')).toContainText(/invalid.*credentials/i);
      
      // Wait a bit between attempts
      await page.waitForTimeout(1000);
    }

    // After max attempts, should show account lockout message
    await page.fill('[data-testid="username-input"]', 'nonexistentuser');
    await page.fill('[data-testid="password-input"]', 'WrongPassword123!');
    await page.click('[data-testid="login-button"]');
    
    await expect(page.locator('[data-testid="error-message"]')).toContainText(/account.*locked|too.*many.*attempts/i);
  });

  test('should handle password policy enforcement', async ({ page }) => {
    await page.click('text=Register');

    // Test weak passwords that should be rejected
    const weakPasswords = [
      'short', // too short
      'nouppercase123!', // no uppercase
      'NOLOWERCASE123!', // no lowercase
      'NoNumbers!', // no numbers
      'NoSpecialChars123', // no special characters
      'password123', // common password
      '123456789', // sequential numbers
    ];

    for (const password of weakPasswords) {
      await page.fill('[data-testid="username-input"]', 'testuser');
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', password);
      await page.fill('[data-testid="confirm-password-input"]', password);
      await page.click('[data-testid="register-button"]');
      
      await expect(page.locator('[data-testid="password-error"]')).toBeVisible();
      await expect(page.locator('[data-testid="password-error"]')).toContainText(/password.*requirements|weak.*password/i);
      
      // Clear fields for next test
      await page.fill('[data-testid="password-input"]', '');
      await page.fill('[data-testid="confirm-password-input"]', '');
    }
  });

  test('should handle role-based access control', async ({ page }) => {
    // Register regular user
    await page.click('text=Register');
    const timestamp = Date.now();
    const username = `roleuser${timestamp}`;
    const email = `roleuser${timestamp}@example.com`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    // Try to access admin-only features
    await page.goto('/admin');
    
    // Should show access denied
    await expect(page.locator('[data-testid="error-message"]')).toContainText(/access.*denied|insufficient.*permissions/i);
  });

  test('should handle token refresh failures', async ({ page }) => {
    // Register user first
    await page.click('text=Register');
    const timestamp = Date.now();
    const username = `refreshuser${timestamp}`;
    const email = `refreshuser${timestamp}@example.com`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    // Mock token refresh failure
    await page.route('**/api/auth/refresh', route => {
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ 
          error: 'Token refresh failed',
          code: 'TOKEN_REFRESH_FAILED'
        })
      });
    });

    // Simulate token refresh attempt (this would happen automatically)
    await page.evaluate(() => {
      // Trigger token refresh
      const event = new CustomEvent('tokenRefresh');
      window.dispatchEvent(event);
    });

    // Should redirect to login after refresh failure
    await expect(page).toHaveURL(/.*login/);
    await expect(page.locator('[data-testid="error-message"]')).toContainText(/session.*expired|please.*login/i);
  });

  test('should handle concurrent session conflicts', async ({ page, context }) => {
    // Register user
    await page.click('text=Register');
    const timestamp = Date.now();
    const username = `concurrentuser${timestamp}`;
    const email = `concurrentuser${timestamp}@example.com`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    // Create second browser context and login with same credentials
    const secondPage = await context.newPage();
    await secondPage.goto('/');
    await secondPage.click('text=Login');
    await secondPage.fill('[data-testid="username-input"]', username);
    await secondPage.fill('[data-testid="password-input"]', password);
    await secondPage.click('[data-testid="login-button"]');

    // Try to perform action in first browser
    await page.click('[data-testid="create-lobby-button"]');
    
    // Should show session conflict error
    await expect(page.locator('[data-testid="error-message"]')).toContainText(/session.*conflict|another.*session/i);
  });

  test('should handle authentication service unavailability', async ({ page }) => {
    // Mock authentication service failure
    await page.route('**/api/auth/**', route => {
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ 
          error: 'Authentication service unavailable',
          code: 'AUTH_SERVICE_UNAVAILABLE'
        })
      });
    });

    // Try to login
    await page.click('text=Login');
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'TestPassword123!');
    await page.click('[data-testid="login-button"]');

    // Should show service unavailable error
    await expect(page.locator('[data-testid="error-message"]')).toContainText(/service.*unavailable|try.*later/i);
  });

  test('should handle password reset token expiration', async ({ page }) => {
    // Navigate to password reset
    await page.click('text=Login');
    await page.click('[data-testid="forgot-password-link"]');
    
    // Fill email
    await page.fill('[data-testid="email-input"]', 'test@example.com');
    await page.click('[data-testid="request-reset-button"]');

    // Navigate to reset page with expired token
    await page.goto('/reset-password?token=expired-token');
    
    // Try to reset password
    await page.fill('[data-testid="new-password-input"]', 'NewPassword123!');
    await page.fill('[data-testid="confirm-new-password-input"]', 'NewPassword123!');
    await page.click('[data-testid="reset-password-button"]');

    // Should show token expired error
    await expect(page.locator('[data-testid="error-message"]')).toContainText(/token.*expired|invalid.*token/i);
  });
}); 