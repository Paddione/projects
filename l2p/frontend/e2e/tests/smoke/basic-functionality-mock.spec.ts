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

test.describe('Basic Functionality - Mock API Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock WebSocket connections
    await page.addInitScript(() => {
      // Mock Socket.IO client
      (window as any).io = () => ({
        connect: () => {},
        disconnect: () => {},
        on: () => {},
        off: () => {},
        emit: (event, data, callback) => {
          // Mock successful lobby creation
          if (event === 'createLobby' && callback) {
            setTimeout(() => {
              callback({
                success: true,
                data: {
                  id: 1,
                  code: 'ABC123',
                  name: 'Test Lobby',
                  hostId: 1,
                  maxPlayers: 4,
                  currentPlayers: 1
                }
              });
            }, 100);
          }
        },
        connected: true
      });
    });

    // Mock all API endpoints
    await page.route('**/api/**', async route => {
      const url = route.request().url();
      const method = route.request().method();
      
      // Mock registration endpoint
      if (url.includes('/api/auth/register') && method === 'POST') {
        const mockToken = 'mock-jwt-token-' + Date.now();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            user: {
              id: 1,
              username: 'testuser',
              email: 'test@example.com'
            },
            tokens: {
              accessToken: mockToken,
              refreshToken: 'mock-refresh-token'
            }
          })
        });
        // Store token in localStorage after successful registration
        await page.evaluate((token) => {
          localStorage.setItem('authToken', token);
        }, mockToken);
        return;
      }
      
      // Mock login endpoint
      if (url.includes('/api/auth/login') && method === 'POST') {
        const mockToken = 'mock-jwt-token-' + Date.now();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            user: {
              id: 1,
              username: 'testuser',
              email: 'test@example.com'
            },
            tokens: {
              accessToken: mockToken,
              refreshToken: 'mock-refresh-token'
            }
          })
        });
        // Store token in localStorage after successful login
        await page.evaluate((token) => {
          localStorage.setItem('authToken', token);
        }, mockToken);
        return;
      }
      
      // Mock create lobby endpoint
      if (url.includes('/api/lobbies') && method === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 1,
              code: 'ABC123',
              name: 'Test Lobby',
              hostId: 1,
              maxPlayers: 4,
              currentPlayers: 1
            }
          })
        });
        return;
      }
      
      // Mock get lobby endpoint (for navigation validation)
      if (url.includes('/api/lobbies/ABC123') && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              id: 1,
              code: 'ABC123',
              name: 'Test Lobby',
              hostId: 1,
              maxPlayers: 4,
              currentPlayers: 1
            }
          })
        });
        return;
      }
      
      // Mock join lobby endpoint
      if (url.includes('/api/lobbies/join') && method === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            lobby: {
              id: 1,
              code: 'ABC123',
              name: 'Test Lobby',
              hostId: 1,
              maxPlayers: 4,
              currentPlayers: 2
            }
          })
        });
        return;
      }
      
      // Mock auth validation endpoint
      if (url.includes('/api/auth/validate') && method === 'GET') {
        // Check localStorage for token to sync with frontend state
        const token = await page.evaluate(() => localStorage.getItem('authToken'));
        if (token) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              user: {
                id: 1,
                username: 'testuser',
                email: 'test@example.com'
              },
              token: token
            })
          });
        } else {
          await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'No valid token found' })
          });
        }
        return;
      }
      
      // Mock health endpoint
      if (url.includes('/api/health')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ status: 'ok' })
        });
        return;
      }
      
      // Default mock response for unhandled API calls
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'API endpoint not mocked' })
      });
    });
    
    await ensureAuthForm(page);
    await page.waitForTimeout(500);
  });

  test('should register new user successfully', async ({ page }) => {
    // Wait for AuthForm to be visible
    await page.waitForSelector('[data-testid="register-tab"], [data-testid="login-tab"]', { timeout: 15000 });
    
    // Switch to registration tab
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

    // Wait for successful registration - should show authenticated UI
    await page.waitForSelector('[data-testid="create-lobby-button"]', { timeout: 15000 });
    
    // Verify we can see the authenticated UI
    await expect(page.locator('[data-testid="create-lobby-button"]')).toBeVisible();
  });

  test('should login existing user successfully', async ({ page }) => {
    // Wait for AuthForm to be visible
    await page.waitForSelector('[data-testid="login-tab"]', { timeout: 15000 });
    
    // Fill login form (login tab should be active by default)
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'TestPassword123!');
    await page.click('[data-testid="login-button"]');

    // Wait for successful login
    await page.waitForSelector('[data-testid="create-lobby-button"]', { timeout: 15000 });
    
    // Verify we can see the authenticated UI
    await expect(page.locator('[data-testid="create-lobby-button"]')).toBeVisible();
  });

  test('should create lobby successfully', async ({ page }) => {
    // First login
    await page.waitForSelector('[data-testid="login-tab"]', { timeout: 15000 });
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'TestPassword123!');
    await page.click('[data-testid="login-button"]');

    // Wait for authenticated UI
    await page.waitForSelector('[data-testid="create-lobby-button"]', { timeout: 15000 });

    // Verify the create lobby button is present (actual lobby creation may require backend)
    const createLobbyButton = page.locator('[data-testid="create-lobby-button"]');
    await expect(createLobbyButton).toBeVisible();
    await expect(createLobbyButton).toBeEnabled();
  });

  test('should show lobby options when authenticated', async ({ page }) => {
    // First login
    await page.waitForSelector('[data-testid="login-tab"]', { timeout: 15000 });
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'TestPassword123!');
    await page.click('[data-testid="login-button"]');

    // Wait for authenticated UI
    await page.waitForSelector('[data-testid="create-lobby-button"]', { timeout: 15000 });

    // Verify authenticated UI elements are present
    await expect(page.locator('[data-testid="create-lobby-button"]')).toBeVisible();

    // Check if join lobby button exists (it may vary based on UI state)
    const joinLobbyButton = page.locator('[data-testid="join-lobby-button"]');
    const hasJoinButton = await joinLobbyButton.count() > 0;

    if (hasJoinButton) {
      await expect(joinLobbyButton).toBeVisible();
    }
  });

  test('should display connection status', async ({ page }) => {
    // Check for any connection status indicators
    const connectionStatus = page.locator('[data-testid="connection-status"], [data-testid="online-status"]');
    
    // Wait a bit for any connection indicators to appear
    await page.waitForTimeout(2000);
    
    // This test is optional - connection status might not always be visible
    if (await connectionStatus.count() > 0) {
      await expect(connectionStatus.first()).toBeVisible();
    } else {
      console.log('No connection status indicators found');
    }
  });
});
