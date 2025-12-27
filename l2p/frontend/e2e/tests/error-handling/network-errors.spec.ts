import { test, expect } from '@playwright/test';

test.describe('Network Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should handle API server downtime gracefully', async ({ page, context }) => {
    // Register user first
    await page.click('text=Register');
    const timestamp = Date.now();
    const username = `erroruser${timestamp}`;
    const email = `erroruser${timestamp}@example.com`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    // Block API requests to simulate server downtime
    await page.route('**/api/**', route => {
      route.abort('failed');
    });

    // Try to create lobby - should show error
    await page.click('[data-testid="create-lobby-button"]');
    await page.selectOption('[data-testid="question-count-select"]', '5');
    await page.click('[data-testid="confirm-create-lobby"]');

    // Verify error handling
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="error-message"]')).toContainText(/connection|server|network/i);

    // Verify retry mechanism
    await page.click('[data-testid="retry-button"]');
    await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible();
  });

  test('should handle WebSocket disconnection during game', async ({ page, context }) => {
    // Setup game session
    await page.click('text=Register');
    const timestamp = Date.now();
    const username = `wsuser${timestamp}`;
    const email = `wsuser${timestamp}@example.com`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    // Create lobby
    await page.click('[data-testid="create-lobby-button"]');
    await page.selectOption('[data-testid="question-count-select"]', '3');
    await page.click('[data-testid="confirm-create-lobby"]');

    // Add second player
    const playerPage = await context.newPage();
    await playerPage.goto('/');
    await playerPage.click('text=Register');
    
    const playerUsername = `wsplayer${timestamp}`;
    await playerPage.fill('[data-testid="username-input"]', playerUsername);
    await playerPage.fill('[data-testid="email-input"]', `${playerUsername}@example.com`);
    await playerPage.fill('[data-testid="password-input"]', password);
    await playerPage.fill('[data-testid="confirm-password-input"]', password);
    await playerPage.click('[data-testid="register-button"]');

    const lobbyCode = await page.locator('[data-testid="lobby-code"]').textContent();
    await playerPage.click('[data-testid="join-lobby-button"]');
    await playerPage.fill('[data-testid="lobby-code-input"]', lobbyCode || '');
    await playerPage.click('[data-testid="join-lobby-confirm"]');

    // Start game
    await page.click('[data-testid="ready-button"]');
    await playerPage.click('[data-testid="ready-button"]');
    await page.click('[data-testid="start-game-button"]');

    await expect(page.locator('[data-testid="question-container"]')).toBeVisible();

    // Simulate WebSocket disconnection
    await page.evaluate(() => {
      // Close WebSocket connection
      const wsConnections = (window as { socketConnections?: WebSocket[] }).socketConnections;
      if (wsConnections) {
        wsConnections.forEach((ws: WebSocket) => ws.close());
      }
    });

    // Verify reconnection attempts
    await expect(page.locator('[data-testid="connection-status"]')).toHaveAttribute('data-status', 'disconnected');
    await expect(page.locator('[data-testid="reconnecting-message"]')).toBeVisible();

    // Wait for automatic reconnection
    await expect(page.locator('[data-testid="connection-status"]')).toHaveAttribute('data-status', 'connected', { timeout: 10000 });
  });

  test('should handle invalid lobby codes gracefully', async ({ page }) => {
    // Register user
    await page.click('text=Register');
    const timestamp = Date.now();
    const username = `invaliduser${timestamp}`;
    const email = `invaliduser${timestamp}@example.com`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    // Try to join with invalid codes
    await page.click('[data-testid="join-lobby-button"]');
    
    // Test empty code
    await page.click('[data-testid="join-lobby-confirm"]');
    await expect(page.locator('[data-testid="error-message"]')).toContainText(/code.*required/i);

    // Test invalid format
    await page.fill('[data-testid="lobby-code-input"]', '123');
    await page.click('[data-testid="join-lobby-confirm"]');
    await expect(page.locator('[data-testid="error-message"]')).toContainText(/invalid.*format/i);

    // Test non-existent lobby
    await page.fill('[data-testid="lobby-code-input"]', 'ZZZZZZ');
    await page.click('[data-testid="join-lobby-confirm"]');
    await expect(page.locator('[data-testid="error-message"]')).toContainText(/lobby.*not.*found/i);

    // Test lobby that's already started
    // This would require setting up a lobby in progress
    await page.fill('[data-testid="lobby-code-input"]', 'ACTIVE');
    await page.click('[data-testid="join-lobby-confirm"]');
    // Error message depends on implementation
  });

  test('should handle authentication errors', async ({ page }) => {
    // Test registration with existing email
    await page.click('text=Register');
    const timestamp = Date.now();
    const username = `authuser${timestamp}`;
    const email = `duplicate@example.com`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    // Try to register again with same email
    await page.click('[data-testid="logout-button"]');
    await page.click('text=Register');
    
    const username2 = `authuser2${timestamp}`;
    await page.fill('[data-testid="username-input"]', username2);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    await expect(page.locator('[data-testid="error-message"]')).toContainText(/email.*already.*exists/i);

    // Test login with wrong credentials
    await page.click('text=Login');
    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="password-input"]', 'WrongPassword');
    await page.click('[data-testid="login-button"]');

    await expect(page.locator('[data-testid="error-message"]')).toContainText(/invalid.*credentials/i);
  });

  test('should handle session expiration', async ({ page }) => {
    // Register and login
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

    // Simulate expired token by modifying localStorage
    await page.evaluate(() => {
      localStorage.setItem('authToken', 'expired-token');
    });

    // Try to perform authenticated action
    await page.click('[data-testid="create-lobby-button"]');
    
    // Should redirect to login or show auth error
    await expect(page).toHaveURL(/.*login/);
    // OR expect error message depending on implementation
    // await expect(page.locator('[data-testid="error-message"]')).toContainText(/session.*expired/i);
  });

  test('should handle rate limiting', async ({ page }) => {
    // Register user
    await page.click('text=Register');
    const timestamp = Date.now();
    const username = `rateuser${timestamp}`;
    const email = `rateuser${timestamp}@example.com`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    // Rapidly attempt to create multiple lobbies
    for (let i = 0; i < 10; i++) {
      await page.click('[data-testid="create-lobby-button"]');
      await page.selectOption('[data-testid="question-count-select"]', '3');
      await page.click('[data-testid="confirm-create-lobby"]');
      
      // If rate limited, should see error
      const errorMessage = page.locator('[data-testid="error-message"]');
      if (await errorMessage.isVisible()) {
        await expect(errorMessage).toContainText(/rate.*limit|too.*many/i);
        break;
      }
      
      // Go back to try again
      await page.goBack();
    }
  });

  test('should handle malformed responses', async ({ page }) => {
    // Register user
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

    // Intercept API responses and return malformed data
    await page.route('**/api/lobby', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '{"invalid": "json"' // Malformed JSON
      });
    });

    // Try to create lobby
    await page.click('[data-testid="create-lobby-button"]');
    await page.selectOption('[data-testid="question-count-select"]', '3');
    await page.click('[data-testid="confirm-create-lobby"]');

    // Should handle parsing error gracefully
    await expect(page.locator('[data-testid="error-message"]')).toContainText(/error.*occurred|something.*wrong/i);
  });

  test('should handle database connection errors', async ({ page }) => {
    // Mock database error responses
    await page.route('**/api/**', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Database connection failed' })
      });
    });

    // Try to register
    await page.click('text=Register');
    const timestamp = Date.now();
    const username = `dbuser${timestamp}`;
    const email = `dbuser${timestamp}@example.com`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    // Should show appropriate error message
    await expect(page.locator('[data-testid="error-message"]')).toContainText(/server.*error|try.*again/i);
  });

  test('should handle concurrent lobby operations', async ({ page, context }) => {
    // Create two users trying to join same lobby simultaneously
    const hostPage = page;
    const playerPage = await context.newPage();

    // Register host
    await hostPage.goto('/');
    await hostPage.click('text=Register');
    const timestamp = Date.now();
    const host = `concurrenthost${timestamp}`;
    const password = 'TestPassword123!';

    await hostPage.fill('[data-testid="username-input"]', host);
    await hostPage.fill('[data-testid="email-input"]', `${host}@example.com`);
    await hostPage.fill('[data-testid="password-input"]', password);
    await hostPage.fill('[data-testid="confirm-password-input"]', password);
    await hostPage.click('[data-testid="register-button"]');

    // Create lobby
    await hostPage.click('[data-testid="create-lobby-button"]');
    await hostPage.selectOption('[data-testid="question-count-select"]', '3');
    await hostPage.click('[data-testid="confirm-create-lobby"]');

    const lobbyCode = await hostPage.locator('[data-testid="lobby-code"]').textContent();

    // Register multiple players and have them join simultaneously
    const players = [];
    for (let i = 0; i < 3; i++) {
      const newPage = await context.newPage();
      await newPage.goto('/');
      await newPage.click('text=Register');
      
      const playerName = `player${timestamp}_${i}`;
      await newPage.fill('[data-testid="username-input"]', playerName);
      await newPage.fill('[data-testid="email-input"]', `${playerName}@example.com`);
      await newPage.fill('[data-testid="password-input"]', password);
      await newPage.fill('[data-testid="confirm-password-input"]', password);
      await newPage.click('[data-testid="register-button"]');

      players.push(newPage);
    }

    // All players try to join simultaneously
    await Promise.all(players.map(async (playerPage) => {
      await playerPage.click('[data-testid="join-lobby-button"]');
      await playerPage.fill('[data-testid="lobby-code-input"]', lobbyCode || '');
      await playerPage.click('[data-testid="join-lobby-confirm"]');
    }));

    // Verify all players joined successfully or got appropriate errors
    for (const playerPage of players) {
      try {
        await expect(playerPage).toHaveURL(/.*lobby\/[A-Z0-9]{6}/, { timeout: 5000 });
      } catch {
        // If lobby is full, should show error
        await expect(playerPage.locator('[data-testid="error-message"]')).toContainText(/full|capacity/i);
      }
    }
  });
}); 