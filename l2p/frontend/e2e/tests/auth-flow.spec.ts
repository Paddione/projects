import { test, expect } from '@playwright/test';

test.describe('Authentication Flow - End to End', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/');
  });

  test('Complete user registration flow (auto-login on success)', async ({ page }) => {
    // Navigate to registration
    await page.click('text=Register');
    
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
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    await expect(page.locator('[data-testid="welcome-message"]')).toBeVisible();
  });

  test('Email verification flow (query param)', async ({ page }) => {
    // Simulate email verification by visiting verification route with token
    const verificationToken = 'test-verification-token';
    await page.goto(`/verify-email?token=${verificationToken}`);
    
    // Verify success text appears
    await expect(page.locator('text=Email verified successfully')).toBeVisible();
    
    // Navigate back to login
    await page.goto('/');
    await page.click('text=Login');
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'TestPass123!');
    await page.click('[data-testid="login-button"]');
    
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  });

  test('User login flow', async ({ page }) => {
    // Navigate to login
    await page.click('text=Login');
    
    // Fill login form
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'TestPass123!');
    
    // Submit login
    await page.click('[data-testid="login-button"]');
    
    // Verify successful login
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    await expect(page.locator('[data-testid="welcome-message"]')).toBeVisible();
  });

  test('Login validation - incorrect credentials', async ({ page }) => {
    await page.click('text=Login');
    
    await page.fill('[data-testid="username-input"]', 'nonexistent');
    await page.fill('[data-testid="password-input"]', 'WrongPassword123!');
    await page.click('[data-testid="login-button"]');
    
    // Verify error message text is shown (component has no specific data-testid)
    await expect(page.locator('text=Invalid credentials')).toBeVisible();
    
    // Verify user menu is not visible
    await expect(page.locator('[data-testid="user-menu"]')).not.toBeVisible();
  });

  test('Character selection and profile management', async ({ page }) => {
    // Login first
    await page.click('text=Login');
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'TestPass123!');
    await page.click('[data-testid="login-button"]');
    
    // Navigate to profile page
    await page.click('[data-testid="profile-link"]');
    
    // Verify profile loaded
    await expect(page.locator('text=Your Profile')).toBeVisible();
    
    // Select a different available character if present
    // Click the first visible "Select" button
    const selectButtons = page.locator('button:has-text("Select")');
    const count = await selectButtons.count();
    if (count > 0) {
      await selectButtons.first().click();
      // Expect the UI to update to reflect current character
      await expect(page.locator('text=Current')).toBeVisible();
    }
  });

  test('User profile and experience display', async ({ page }) => {
    // Login first
    await page.click('text=Login');
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'TestPass123!');
    await page.click('[data-testid="login-button"]');
    
    // Navigate to profile page
    await page.click('[data-testid="profile-link"]');
    
    // Verify user information areas exist
    await expect(page.locator('text=Your Profile')).toBeVisible();
    await expect(page.locator('text=Level Progress')).toBeVisible();
    await expect(page.locator('text=Available Characters')).toBeVisible();
  });

  test('Logout functionality', async ({ page }) => {
    // Login first
    await page.click('text=Login');
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'TestPass123!');
    await page.click('[data-testid="login-button"]');
    
    // Verify user is logged in
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    
    // Logout
    await page.click('[data-testid="logout-button"]');
    
    // Verify user menu is hidden after logout (AuthGuard shows auth form)
    await expect(page.locator('[data-testid="user-menu"]')).not.toBeVisible();
  });
}); 
