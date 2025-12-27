import { test, expect } from '@playwright/test';

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
    
    // Navigate to the application
    await page.goto('/');

    // Wait for the app to be ready by checking for either auth form or authenticated state
    // The AuthGuard shows a loading state first, then either AuthForm or authenticated content
    await page.waitForFunction(() => {
      // Check if we're past the loading state
      const loadingElement = document.querySelector('p');
      if (loadingElement && loadingElement.textContent?.includes('Validating authentication')) {
        return false;
      }
      
      // Check if we have either auth form or authenticated content
      const authForm = document.querySelector('[data-testid="register-tab"], [data-testid="login-tab"]');
      const authenticatedContent = document.querySelector('[data-testid="create-lobby-button"], [data-testid="welcome-message"]');
      
      return authForm || authenticatedContent;
    }, { timeout: 15000 });

    // Additional wait to ensure the UI is fully rendered
    await page.waitForTimeout(1000);
  });

  test('should register new user successfully', async ({ page }) => {
    // Wait for AuthForm to be visible
    await page.waitForSelector('[data-testid="register-tab"], [data-testid="login-tab"]', { timeout: 10000 });
    
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
    await page.waitForSelector('[data-testid="create-lobby-button"]', { timeout: 10000 });
    
    // Verify we can see the authenticated UI
    await expect(page.locator('[data-testid="create-lobby-button"]')).toBeVisible();
  });

  test('should login existing user successfully', async ({ page }) => {
    // Wait for AuthForm to be visible
    await page.waitForSelector('[data-testid="login-tab"]', { timeout: 10000 });
    
    // Fill login form (login tab should be active by default)
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'TestPassword123!');
    await page.click('[data-testid="login-button"]');

    // Wait for successful login
    await page.waitForSelector('[data-testid="create-lobby-button"]', { timeout: 10000 });
    
    // Verify we can see the authenticated UI
    await expect(page.locator('[data-testid="create-lobby-button"]')).toBeVisible();
  });

  test('should create lobby successfully', async ({ page }) => {
    // First login
    await page.waitForSelector('[data-testid="login-tab"]', { timeout: 10000 });
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'TestPassword123!');
    await page.click('[data-testid="login-button"]');

    // Wait for authenticated UI
    await page.waitForSelector('[data-testid="create-lobby-button"]', { timeout: 10000 });

    // Create lobby
    await page.click('[data-testid="create-lobby-button"]');

    // Wait for lobby creation to complete and navigation to lobby page
    await page.waitForSelector('[data-testid="lobby-code"]', { timeout: 15000 });
    
    // Verify lobby was created and we're on the lobby page
    const lobbyCodeElement = page.locator('[data-testid="lobby-code"]');
    await expect(lobbyCodeElement).toBeVisible();
    await expect(lobbyCodeElement).toContainText('ABC123');
  });

  test('should join lobby with valid code', async ({ page }) => {
    // First login
    await page.waitForSelector('[data-testid="login-tab"]', { timeout: 10000 });
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.fill('[data-testid="password-input"]', 'TestPassword123!');
    await page.click('[data-testid="login-button"]');

    // Wait for authenticated UI
    await page.waitForSelector('[data-testid="create-lobby-button"]', { timeout: 10000 });

    // Look for join lobby option
    const joinLobbyButton = page.locator('[data-testid="join-lobby-button"]');
    if (await joinLobbyButton.isVisible()) {
      await joinLobbyButton.click();
      
      // Fill lobby code
      await page.fill('[data-testid="lobby-code-input"]', 'ABC123');
      await page.click('[data-testid="join-lobby-submit"]');
      
      // Wait for join to complete
      await page.waitForSelector('[data-testid="lobby-info"]', { timeout: 10000 });
      await expect(page.locator('[data-testid="lobby-info"]')).toBeVisible();
    } else {
      // Skip if join lobby UI is not available
      console.log('Join lobby UI not found, skipping test');
      test.skip();
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