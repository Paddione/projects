import { test, expect } from '@playwright/test';

test.describe('Performance and Load Testing', () => {
  test('should handle multiple concurrent user registrations', async ({ browser }) => {
    const contexts = [];
    const pages = [];
    const userCount = 5;

    // Create multiple browser contexts
    for (let i = 0; i < userCount; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      contexts.push(context);
      pages.push(page);
    }

    try {
      const timestamp = Date.now();
      
      // Concurrent registration attempts
      const registrationPromises = pages.map(async (page, index) => {
        await page.goto('/');
        await page.click('text=Register');
        
        const username = `loaduser${timestamp}_${index}`;
        const email = `loaduser${timestamp}_${index}@example.com`;
        const password = 'TestPassword123!';

        await page.fill('[data-testid="username-input"]', username);
        await page.fill('[data-testid="email-input"]', email);
        await page.fill('[data-testid="password-input"]', password);
        await page.fill('[data-testid="confirm-password-input"]', password);
        
        const startTime = Date.now();
        await page.click('[data-testid="register-button"]');
        
        // Wait for response
        try {
          await expect(page).toHaveURL(/.*dashboard/, { timeout: 10000 });
          const endTime = Date.now();
          return { success: true, responseTime: endTime - startTime, user: username };
        } catch (error) {
          const endTime = Date.now();
          return { success: false, responseTime: endTime - startTime, user: username, error };
        }
      });

      const results = await Promise.all(registrationPromises);
      
      // Analyze results
      const successfulRegistrations = results.filter(r => r.success);
      const averageResponseTime = results.reduce((sum, r) => sum + r.responseTime, 0) / results.length;
      
      console.log(`Successful registrations: ${successfulRegistrations.length}/${userCount}`);
      console.log(`Average response time: ${averageResponseTime}ms`);
      
      // At least 80% should succeed
      expect(successfulRegistrations.length).toBeGreaterThanOrEqual(userCount * 0.8);
      
      // Response time should be reasonable (under 5 seconds)
      expect(averageResponseTime).toBeLessThan(5000);
      
    } finally {
      // Cleanup
      for (const context of contexts) {
        await context.close();
      }
    }
  });

  test('should handle multiple users joining same lobby', async ({ browser }) => {
    const maxPlayers = 8;
    const contexts = [];
    const pages = [];

    // Create host
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    contexts.push(hostContext);
    pages.push(hostPage);

    // Register host and create lobby
    await hostPage.goto('/');
    await hostPage.click('text=Register');
    
    const timestamp = Date.now();
    const hostUsername = `loadhost${timestamp}`;
    const password = 'TestPassword123!';

    await hostPage.fill('[data-testid="username-input"]', hostUsername);
    await hostPage.fill('[data-testid="email-input"]', `${hostUsername}@example.com`);
    await hostPage.fill('[data-testid="password-input"]', password);
    await hostPage.fill('[data-testid="confirm-password-input"]', password);
    await hostPage.click('[data-testid="register-button"]');

    await hostPage.click('[data-testid="create-lobby-button"]');
    await hostPage.selectOption('[data-testid="question-count-select"]', '5');
    await hostPage.click('[data-testid="confirm-create-lobby"]');

    const lobbyCode = await hostPage.locator('[data-testid="lobby-code"]').textContent();

    // Create player contexts
    for (let i = 0; i < maxPlayers - 1; i++) {
      const context = await browser.newContext();
      const page = await context.newPage();
      contexts.push(context);
      pages.push(page);
    }

    try {
      // Concurrent lobby joins
      const joinPromises = pages.slice(1).map(async (page, index) => {
        await page.goto('/');
        await page.click('text=Register');
        
        const username = `loadplayer${timestamp}_${index}`;
        await page.fill('[data-testid="username-input"]', username);
        await page.fill('[data-testid="email-input"]', `${username}@example.com`);
        await page.fill('[data-testid="password-input"]', password);
        await page.fill('[data-testid="confirm-password-input"]', password);
        await page.click('[data-testid="register-button"]');

        await page.click('[data-testid="join-lobby-button"]');
        await page.fill('[data-testid="lobby-code-input"]', lobbyCode || '');
        
        const startTime = Date.now();
        await page.click('[data-testid="join-lobby-confirm"]');
        
        try {
          await expect(page).toHaveURL(/.*lobby\/[A-Z0-9]{6}/, { timeout: 10000 });
          const endTime = Date.now();
          return { success: true, responseTime: endTime - startTime, user: username };
        } catch (error) {
          const endTime = Date.now();
          return { success: false, responseTime: endTime - startTime, user: username, error };
        }
      });

      const results = await Promise.all(joinPromises);
      
      // Check results
      const successfulJoins = results.filter(r => r.success);
      console.log(`Successful lobby joins: ${successfulJoins.length}/${maxPlayers - 1}`);
      
      // At least 6 players should be able to join (including host = 7 total)
      expect(successfulJoins.length).toBeGreaterThanOrEqual(6);
      
      // Verify player list on host page
      await expect(hostPage.locator('[data-testid="player-list"]')).toContainText(hostUsername);
      
    } finally {
      for (const context of contexts) {
        await context.close();
      }
    }
  });

  test('should handle rapid question answering', async ({ browser }) => {
    // Setup game with 2 players
    const hostContext = await browser.newContext();
    const playerContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    const playerPage = await playerContext.newPage();

    try {
      const timestamp = Date.now();
      const password = 'TestPassword123!';

      // Register host
      await hostPage.goto('/');
      await hostPage.click('text=Register');
      const hostUsername = `speedhost${timestamp}`;
      await hostPage.fill('[data-testid="username-input"]', hostUsername);
      await hostPage.fill('[data-testid="email-input"]', `${hostUsername}@example.com`);
      await hostPage.fill('[data-testid="password-input"]', password);
      await hostPage.fill('[data-testid="confirm-password-input"]', password);
      await hostPage.click('[data-testid="register-button"]');

      // Create lobby
      await hostPage.click('[data-testid="create-lobby-button"]');
      await hostPage.selectOption('[data-testid="question-count-select"]', '10');
      await hostPage.click('[data-testid="confirm-create-lobby"]');

      const lobbyCode = await hostPage.locator('[data-testid="lobby-code"]').textContent();

      // Register player
      await playerPage.goto('/');
      await playerPage.click('text=Register');
      const playerUsername = `speedplayer${timestamp}`;
      await playerPage.fill('[data-testid="username-input"]', playerUsername);
      await playerPage.fill('[data-testid="email-input"]', `${playerUsername}@example.com`);
      await playerPage.fill('[data-testid="password-input"]', password);
      await playerPage.fill('[data-testid="confirm-password-input"]', password);
      await playerPage.click('[data-testid="register-button"]');

      // Join lobby
      await playerPage.click('[data-testid="join-lobby-button"]');
      await playerPage.fill('[data-testid="lobby-code-input"]', lobbyCode || '');
      await playerPage.click('[data-testid="join-lobby-confirm"]');

      // Start game
      await hostPage.click('[data-testid="ready-button"]');
      await playerPage.click('[data-testid="ready-button"]');
      await hostPage.click('[data-testid="start-game-button"]');

      // Track response times for rapid answering
      const responseTimes = [];

      for (let questionNum = 1; questionNum <= 10; questionNum++) {
        await expect(hostPage.locator('[data-testid="question-container"]')).toBeVisible();
        
        const startTime = Date.now();
        
        // Both players answer as quickly as possible
        await Promise.all([
          hostPage.click('[data-testid="answer-option-0"]'),
          playerPage.click('[data-testid="answer-option-0"]')
        ]);

        // Wait for feedback
        await expect(hostPage.locator('[data-testid="answer-feedback"]')).toBeVisible({ timeout: 5000 });
        const endTime = Date.now();
        
        responseTimes.push(endTime - startTime);

        if (questionNum < 10) {
          await hostPage.waitForTimeout(2000); // Wait for next question
        }
      }

      // Analyze performance
      const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);
      
      console.log(`Average response time: ${averageResponseTime}ms`);
      console.log(`Max response time: ${maxResponseTime}ms`);
      
      // Response times should be reasonable
      expect(averageResponseTime).toBeLessThan(2000); // Average under 2 seconds
      expect(maxResponseTime).toBeLessThan(5000); // Max under 5 seconds

    } finally {
      await hostContext.close();
      await playerContext.close();
    }
  });

  test('should handle memory usage during extended gameplay', async ({ page }) => {
    // Register user
    await page.goto('/');
    await page.click('text=Register');
    
    const timestamp = Date.now();
    const username = `memoryuser${timestamp}`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', `${username}@example.com`);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    // Measure initial memory
    const initialMemory = await page.evaluate(() => {
      return (performance as any).memory ? (performance as any).memory.usedJSHeapSize : 0;
    });

    // Simulate extended usage
    for (let i = 0; i < 10; i++) {
      // Create and leave lobbies
      await page.click('[data-testid="create-lobby-button"]');
      await page.selectOption('[data-testid="question-count-select"]', '5');
      await page.click('[data-testid="confirm-create-lobby"]');
      
      await page.waitForTimeout(1000);
      
      // Go back to dashboard
      await page.goto('/dashboard');
      await page.waitForTimeout(500);
    }

    // Measure final memory
    const finalMemory = await page.evaluate(() => {
      return (performance as any).memory ? (performance as any).memory.usedJSHeapSize : 0;
    });

    if (initialMemory > 0 && finalMemory > 0) {
      const memoryIncrease = finalMemory - initialMemory;
      console.log(`Memory increase: ${memoryIncrease} bytes`);
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    }
  });

  test('should maintain performance with multiple WebSocket connections', async ({ browser }) => {
    const connectionCount = 10;
    const contexts = [];
    const pages = [];

    try {
      // Create multiple connections
      for (let i = 0; i < connectionCount; i++) {
        const context = await browser.newContext();
        const page = await context.newPage();
        contexts.push(context);
        pages.push(page);
      }

      const timestamp = Date.now();
      const password = 'TestPassword123!';

      // Connect all users and measure connection times
      const connectionPromises = pages.map(async (page, index) => {
        const startTime = Date.now();
        
        await page.goto('/');
        await page.click('text=Register');
        
        const username = `wsuser${timestamp}_${index}`;
        await page.fill('[data-testid="username-input"]', username);
        await page.fill('[data-testid="email-input"]', `${username}@example.com`);
        await page.fill('[data-testid="password-input"]', password);
        await page.fill('[data-testid="confirm-password-input"]', password);
        await page.click('[data-testid="register-button"]');

        // Wait for WebSocket connection
        await expect(page.locator('[data-testid="connection-status"]')).toHaveAttribute('data-status', 'connected', { timeout: 10000 });
        
        const endTime = Date.now();
        return { connectionTime: endTime - startTime, user: username };
      });

      const results = await Promise.all(connectionPromises);
      
      const averageConnectionTime = results.reduce((sum, r) => sum + r.connectionTime, 0) / results.length;
      console.log(`Average connection time: ${averageConnectionTime}ms`);
      
      // All connections should establish within reasonable time
      expect(averageConnectionTime).toBeLessThan(5000);
      
      // Test simultaneous messaging
      const messagePromises = pages.map(async (page) => {
        const startTime = Date.now();
        
        // Trigger some WebSocket activity (e.g., creating a lobby)
        await page.click('[data-testid="create-lobby-button"]');
        await page.selectOption('[data-testid="question-count-select"]', '3');
        await page.click('[data-testid="confirm-create-lobby"]');
        
        await expect(page).toHaveURL(/.*lobby\/[A-Z0-9]{6}/, { timeout: 5000 });
        
        const endTime = Date.now();
        return endTime - startTime;
      });

      const messagingResults = await Promise.all(messagePromises);
      const averageMessageTime = messagingResults.reduce((sum, time) => sum + time, 0) / messagingResults.length;
      
      console.log(`Average messaging response time: ${averageMessageTime}ms`);
      expect(averageMessageTime).toBeLessThan(3000);

    } finally {
      for (const context of contexts) {
        await context.close();
      }
    }
  });

  test('should handle page reload during active game session', async ({ page, context }) => {
    // Setup game
    await page.goto('/');
    await page.click('text=Register');
    
    const timestamp = Date.now();
    const host = `reloadhost${timestamp}`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', host);
    await page.fill('[data-testid="email-input"]', `${host}@example.com`);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    // Create lobby
    await page.click('[data-testid="create-lobby-button"]');
    await page.selectOption('[data-testid="question-count-select"]', '5');
    await page.click('[data-testid="confirm-create-lobby"]');

    const lobbyCode = await page.locator('[data-testid="lobby-code"]').textContent();

    // Add second player
    const playerPage = await context.newPage();
    await playerPage.goto('/');
    await playerPage.click('text=Register');
    
    const player = `reloadplayer${timestamp}`;
    await playerPage.fill('[data-testid="username-input"]', player);
    await playerPage.fill('[data-testid="email-input"]', `${player}@example.com`);
    await playerPage.fill('[data-testid="password-input"]', password);
    await playerPage.fill('[data-testid="confirm-password-input"]', password);
    await playerPage.click('[data-testid="register-button"]');

    await playerPage.click('[data-testid="join-lobby-button"]');
    await playerPage.fill('[data-testid="lobby-code-input"]', lobbyCode || '');
    await playerPage.click('[data-testid="join-lobby-confirm"]');

    // Start game
    await page.click('[data-testid="ready-button"]');
    await playerPage.click('[data-testid="ready-button"]');
    await page.click('[data-testid="start-game-button"]');

    await expect(page.locator('[data-testid="question-container"]')).toBeVisible();

    // Reload page during game
    const reloadStartTime = Date.now();
    await page.reload();
    
    // Should reconnect and resume or show appropriate state
    try {
      // Either back in game or shown appropriate message
      await expect(page.locator('[data-testid="question-container"]')).toBeVisible({ timeout: 10000 });
    } catch {
      // Or should show reconnection/game state message
      await expect(page.locator('[data-testid="game-reconnect"]')).toBeVisible();
    }
    
    const reloadEndTime = Date.now();
    const reloadTime = reloadEndTime - reloadStartTime;
    
    console.log(`Page reload and reconnection time: ${reloadTime}ms`);
    expect(reloadTime).toBeLessThan(10000); // Should reconnect within 10 seconds
  });
}); 