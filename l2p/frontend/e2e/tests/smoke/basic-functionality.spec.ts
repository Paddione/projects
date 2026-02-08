import { test, expect, Page } from '@playwright/test';

const ensureAuthForm = async (page: Page) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  await page.waitForFunction(() => {
    const loadingElement = document.querySelector('p');
    if (loadingElement && loadingElement.textContent?.includes('Validating authentication')) {
      return false;
    }

    const authForm = document.querySelector('[data-testid="register-tab"], [data-testid="login-tab"]');
    const authenticatedContent = document.querySelector('[data-testid="create-lobby-button"], [data-testid="welcome-message"]');

    return authForm || authenticatedContent;
  }, { timeout: 15000 });

  const authTabs = page.locator('[data-testid="register-tab"], [data-testid="login-tab"]');
  if ((await authTabs.count()) > 0 && await authTabs.first().isVisible()) {
    return;
  }

  const authenticatedContent = page.locator('[data-testid="create-lobby-button"], [data-testid="welcome-message"]');
  if ((await authenticatedContent.count()) > 0 && await authenticatedContent.first().isVisible()) {
    await page.click('[data-testid="logout-button"]');
  }

  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('[data-testid="register-tab"], [data-testid="login-tab"]', { timeout: 15000 });
};

test.describe('Basic Functionality - Smoke Tests', () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthForm(page);
    await page.waitForTimeout(500);
  });

  test('should register new user successfully', async ({ page }) => {
    // Wait for AuthForm to be visible (in case we're not authenticated)
    await page.waitForSelector('[data-testid="register-tab"], [data-testid="login-tab"]', { timeout: 15000 });

    // Switch to registration tab (AuthForm shows login by default)
    await page.click('[data-testid="register-tab"]');

    // Fill registration form
    const timestamp = Date.now();
    const username = `testuser${timestamp}`;
    const email = `test${timestamp}@example.com`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);

    // Submit registration
    await page.click('[data-testid="register-button"]');

    // Wait for successful registration - should be on homepage
    await page.waitForURL(/.*\/$/, { timeout: 10000 });

    // Wait for authenticated UI (create lobby button is a stable indicator)
    await page.waitForSelector('[data-testid="create-lobby-button"]', { timeout: 15000 });
  });

  test('should login existing user successfully', async ({ page }) => {
    // Wait for AuthForm to be visible
    await page.waitForSelector('[data-testid="register-tab"], [data-testid="login-tab"]', { timeout: 15000 });

    // First register a user
    await page.click('[data-testid="register-tab"]');
    const timestamp = Date.now();
    const username = `loginuser${timestamp}`;
    const email = `login${timestamp}@example.com`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    // Wait for successful registration
    await page.waitForURL(/.*\/$/, { timeout: 10000 });
    await page.waitForSelector('[data-testid="create-lobby-button"]', { timeout: 15000 });

    // Logout
    await page.click('[data-testid="logout-button"]');

    // Wait for AuthForm to be visible again
    await page.waitForSelector('[data-testid="login-tab"]', { timeout: 15000 });

    // Login (AuthForm shows login by default)
    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="password-input"]', password);
    await page.click('[data-testid="login-button"]');

    // Verify successful login
    await page.waitForURL(/.*\/$/, { timeout: 10000 });
    await page.waitForSelector('[data-testid="create-lobby-button"]', { timeout: 15000 });
  });

  test('should create lobby successfully', async ({ page }) => {
    // Wait for AuthForm to be visible
    await page.waitForSelector('[data-testid="register-tab"], [data-testid="login-tab"]', { timeout: 15000 });

    // Register and login user
    await page.click('[data-testid="register-tab"]');
    const timestamp = Date.now();
    const username = `lobbyhost${timestamp}`;
    const email = `lobbyhost${timestamp}@example.com`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    // Wait for successful registration
    await page.waitForURL(/.*\/$/, { timeout: 10000 });
    await page.waitForSelector('[data-testid="create-lobby-button"]', { timeout: 15000 });

    // Wait for create lobby button to be visible
    await page.waitForSelector('[data-testid="create-lobby-button"]', { timeout: 15000 });

    // Click create lobby (in normal mode, this directly creates and navigates)
    await page.click('[data-testid="create-lobby-button"]');

    // Verify lobby creation - navigates to lobby page
    await page.waitForURL(/.*lobby\/[A-Z0-9]{6}/, { timeout: 15000 });
    await expect(page.locator('[data-testid="lobby-code"]')).toHaveText(/[A-Z0-9]{6}/);
    await expect(page.locator('[data-testid="host-indicator"]')).toBeVisible();
  });

  test('should join lobby with valid code', async ({ page, context }) => {
    // Wait for AuthForm to be visible
    await page.waitForSelector('[data-testid="register-tab"], [data-testid="login-tab"]', { timeout: 15000 });

    // Register and login user
    await page.click('[data-testid="register-tab"]');
    const timestamp = Date.now();
    const username = `lobbyjoiner${timestamp}`;
    const email = `lobbyjoiner${timestamp}@example.com`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    // Wait for successful registration
    await page.waitForURL(/.*\/$/, { timeout: 10000 });
    await page.waitForSelector('[data-testid="create-lobby-button"]', { timeout: 15000 });

    // Create a lobby first to get a valid code (normal mode: direct creation)
    await page.waitForSelector('[data-testid="create-lobby-button"]', { timeout: 15000 });
    await page.click('[data-testid="create-lobby-button"]');

    // Wait for lobby page to load
    await page.waitForURL(/.*lobby\/[A-Z0-9]{6}/, { timeout: 15000 });

    // Get the lobby code
    const lobbyCodeElement = await page.locator('[data-testid="lobby-code"]');
    const lobbyCode = await lobbyCodeElement.textContent();

    // Open a new page in the same browser context (shared storage)
    const newPage = await context.newPage();
    await newPage.goto('/');
    await newPage.waitForSelector('[data-testid="register-tab"], [data-testid="login-tab"], [data-testid="create-lobby-button"]', { timeout: 15000 });
    // If already authenticated (shared storage), log out to show AuthForm
    const logoutButton = newPage.locator('[data-testid="logout-button"]');
    if (await logoutButton.isVisible().catch(() => false)) {
      await logoutButton.click();
      await newPage.waitForSelector('[data-testid="register-tab"], [data-testid="login-tab"]', { timeout: 15000 });
    }

    // Register a second user
    await newPage.waitForSelector('[data-testid="register-tab"], [data-testid="login-tab"]', { timeout: 15000 });
    await newPage.click('[data-testid="register-tab"]');
    const timestamp2 = Date.now();
    const username2 = `joiner${timestamp2}`;
    const email2 = `joiner${timestamp2}@example.com`;

    await newPage.fill('[data-testid="username-input"]', username2);
    await newPage.fill('[data-testid="email-input"]', email2);
    await newPage.fill('[data-testid="password-input"]', password);
    await newPage.fill('[data-testid="confirm-password-input"]', password);
    await newPage.click('[data-testid="register-button"]');

    // Wait for successful registration
    await newPage.waitForURL(/.*\/$/, { timeout: 10000 });
    await newPage.waitForSelector('[data-testid="create-lobby-button"]', { timeout: 15000 });

    // Join the lobby
    await newPage.waitForSelector('[data-testid="lobby-code-input"]', { timeout: 15000 });
    await newPage.fill('[data-testid="lobby-code-input"]', lobbyCode || '');
    await newPage.click('[data-testid="join-lobby-confirm"]');

    // Verify successful join by checking lobby UI (more reliable than URL timing)
    await newPage.waitForSelector('[data-testid="lobby-code"]', { timeout: 10000 });
    await expect(newPage.locator('[data-testid="lobby-code"]')).toHaveText(lobbyCode || '');
    // Optional: also assert URL if available
    await expect(newPage).toHaveURL(/.*lobby\/[A-Z0-9]{6}/);

    await newPage.close();
  });

  test.skip('should handle language switching', async ({ page }) => {
    // SKIP: LanguageSelector is inside SettingsModal which is not yet wired into any page.
    // Re-enable once SettingsModal is accessible from the main UI.
  });

  test.skip('should handle theme switching', async ({ page }) => {
    // SKIP: ThemeSelector is inside SettingsModal which is not yet wired into any page.
    // Re-enable once SettingsModal is accessible from the main UI.
  });

  test('should display connection status', async ({ page }) => {
    // Wait for AuthForm to be visible
    await page.waitForSelector('[data-testid="register-tab"], [data-testid="login-tab"]', { timeout: 15000 });

    // Register and login user
    await page.click('[data-testid="register-tab"]');
    const timestamp = Date.now();
    const username = `connuser${timestamp}`;
    const email = `connuser${timestamp}@example.com`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    // Wait for successful registration
    await page.waitForURL(/.*\/$/, { timeout: 10000 });
    await page.waitForSelector('[data-testid="create-lobby-button"]', { timeout: 15000 });

    // Navigate to a lobby (ConnectionStatus is rendered on LobbyPage, not HomePage)
    await page.click('[data-testid="create-lobby-button"]');
    await page.waitForURL(/.*lobby\/[A-Z0-9]{6}/, { timeout: 15000 });

    // Check connection status indicator on lobby page
    await page.waitForSelector('[data-testid="connection-status"]', { timeout: 15000 });
    await expect(page.locator('[data-testid="connection-status"]')).toBeVisible();
    await expect(page.locator('[data-testid="connection-status"]')).toHaveAttribute('data-status');
  });
}); 
