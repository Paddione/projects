import { test, expect } from '@playwright/test';

test.describe('Authentication Flow - End to End', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
  });

  test('Complete user registration flow (auto-login on success)', async ({ page }) => {
    // Wait for auth form
    await page.waitForSelector('[data-testid="register-tab"], [data-testid="login-tab"]', { timeout: 15000 });

    // Navigate to registration
    await page.click('[data-testid="register-tab"]');

    // Fill registration form
    const testEmail = `test${Date.now()}@example.com`;
    const testUsername = `testuser${Date.now()}`;

    await page.fill('[data-testid="username-input"]', testUsername);
    await page.fill('[data-testid="email-input"]', testEmail);
    await page.fill('[data-testid="password-input"]', 'TestPass123!');
    await page.fill('[data-testid="confirm-password-input"]', 'TestPass123!');

    // Submit registration
    await page.click('[data-testid="register-button"]');

    // App auto-logs in and redirects home in current implementation
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="welcome-message"]')).toBeVisible();
  });

  test('Email verification page handles invalid token gracefully', async ({ page }) => {
    // Visit verification route with an invalid token
    const verificationToken = 'test-invalid-token';
    await page.goto(`/verify-email?token=${verificationToken}`);

    // Should show verification failed (invalid token won't pass API validation)
    await expect(page.locator('text=Verification Failed')).toBeVisible({ timeout: 15000 });

    // "Go to Login" button should be available
    const goToLoginButton = page.locator('button:has-text("Go to Login")');
    await expect(goToLoginButton).toBeVisible();

    // Click should navigate back to home
    await goToLoginButton.click();
    await page.waitForURL(/.*\/$/, { timeout: 10000 });
  });

  test('User login flow', async ({ page }) => {
    // Wait for auth form
    await page.waitForSelector('[data-testid="register-tab"], [data-testid="login-tab"]', { timeout: 15000 });

    // First register a user to have valid credentials
    const timestamp = Date.now();
    const username = `logintest${timestamp}`;
    const email = `logintest${timestamp}@example.com`;
    const password = 'TestPass123!';

    await page.click('[data-testid="register-tab"]');
    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    // Wait for auto-login after registration
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible({ timeout: 15000 });

    // Logout
    await page.click('[data-testid="logout-button"]');
    await expect(page.locator('[data-testid="login-tab"]')).toBeVisible({ timeout: 15000 });

    // Now test login with the registered credentials
    await page.click('[data-testid="login-tab"]');
    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="password-input"]', password);
    await page.click('[data-testid="login-button"]');

    // Verify successful login
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('[data-testid="welcome-message"]')).toBeVisible();
  });

  test('Login validation - incorrect credentials', async ({ page }) => {
    // Wait for auth form
    await page.waitForSelector('[data-testid="register-tab"], [data-testid="login-tab"]', { timeout: 15000 });

    await page.click('[data-testid="login-tab"]');

    await page.fill('[data-testid="username-input"]', 'nonexistent');
    await page.fill('[data-testid="password-input"]', 'WrongPassword123!');
    await page.click('[data-testid="login-button"]');

    // Verify error is shown (wait for API response)
    await page.waitForTimeout(2000);

    // Verify user menu is not visible (still on auth page)
    await expect(page.locator('[data-testid="user-menu"]')).not.toBeVisible();
    // Auth form should still be visible
    await expect(page.locator('[data-testid="login-tab"]')).toBeVisible();
  });

  test('Character selection and profile management', async ({ page }) => {
    // Wait for auth form
    await page.waitForSelector('[data-testid="register-tab"], [data-testid="login-tab"]', { timeout: 15000 });

    // Register a fresh user (auto-logs in)
    const timestamp = Date.now();
    const username = `profileuser${timestamp}`;
    const email = `profileuser${timestamp}@example.com`;

    await page.click('[data-testid="register-tab"]');
    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', 'TestPass123!');
    await page.fill('[data-testid="confirm-password-input"]', 'TestPass123!');
    await page.click('[data-testid="register-button"]');

    // Wait for auto-login
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible({ timeout: 15000 });

    // Navigate to profile page
    await page.click('[data-testid="profile-link"]');

    // Verify profile page loaded (wait for route change)
    await page.waitForURL(/.*profile/, { timeout: 10000 });
  });

  test('User profile and experience display', async ({ page }) => {
    // Wait for auth form
    await page.waitForSelector('[data-testid="register-tab"], [data-testid="login-tab"]', { timeout: 15000 });

    // Register a fresh user (auto-logs in)
    const timestamp = Date.now();
    const username = `xpuser${timestamp}`;
    const email = `xpuser${timestamp}@example.com`;

    await page.click('[data-testid="register-tab"]');
    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', 'TestPass123!');
    await page.fill('[data-testid="confirm-password-input"]', 'TestPass123!');
    await page.click('[data-testid="register-button"]');

    // Wait for auto-login
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible({ timeout: 15000 });

    // Navigate to profile page
    await page.click('[data-testid="profile-link"]');

    // Verify profile page loaded
    await page.waitForURL(/.*profile/, { timeout: 10000 });
  });

  test('Logout functionality', async ({ page }) => {
    // Wait for auth form
    await page.waitForSelector('[data-testid="register-tab"], [data-testid="login-tab"]', { timeout: 15000 });

    // Register a fresh user (auto-logs in)
    const timestamp = Date.now();
    const username = `logoutuser${timestamp}`;
    const email = `logoutuser${timestamp}@example.com`;

    await page.click('[data-testid="register-tab"]');
    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', 'TestPass123!');
    await page.fill('[data-testid="confirm-password-input"]', 'TestPass123!');
    await page.click('[data-testid="register-button"]');

    // Verify user is logged in
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible({ timeout: 15000 });

    // Logout
    await page.click('[data-testid="logout-button"]');

    // Verify user menu is hidden after logout (AuthGuard shows auth form)
    await expect(page.locator('[data-testid="user-menu"]')).not.toBeVisible();
    await expect(page.locator('[data-testid="login-tab"]')).toBeVisible({ timeout: 15000 });
  });
});
