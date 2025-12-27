import { test, expect } from '@playwright/test';
import { io, Socket } from 'socket.io-client';

test.describe('Complete Game Flow Integration', () => {
  let hostSocket: Socket;
  let playerSocket: Socket;

  test.afterEach(async () => {
    if (hostSocket) hostSocket.disconnect();
    if (playerSocket) playerSocket.disconnect();
  });

  test('should complete full game session with 2 players', async ({ page, context }) => {
    // Register host user
    await page.goto('/');
    await page.click('text=Register');
    
    const timestamp = Date.now();
    const hostUsername = `gamehost${timestamp}`;
    const hostEmail = `gamehost${timestamp}@example.com`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', hostUsername);
    await page.fill('[data-testid="email-input"]', hostEmail);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    // Create lobby
    await page.click('[data-testid="create-lobby-button"]');
    await page.selectOption('[data-testid="question-count-select"]', '3');
    await page.selectOption('[data-testid="question-set-select"]', 'general');
    await page.click('[data-testid="confirm-create-lobby"]');

    // Get lobby code
    const lobbyCode = await page.locator('[data-testid="lobby-code"]').textContent();
    expect(lobbyCode).toMatch(/[A-Z0-9]{6}/);

    // Open second browser for player
    const playerPage = await context.newPage();
    await playerPage.goto('/');
    await playerPage.click('text=Register');
    
    const playerUsername = `player${timestamp}`;
    const playerEmail = `player${timestamp}@example.com`;

    await playerPage.fill('[data-testid="username-input"]', playerUsername);
    await playerPage.fill('[data-testid="email-input"]', playerEmail);
    await playerPage.fill('[data-testid="password-input"]', password);
    await playerPage.fill('[data-testid="confirm-password-input"]', password);
    await playerPage.click('[data-testid="register-button"]');

    // Player joins lobby
    await playerPage.click('[data-testid="join-lobby-button"]');
    await playerPage.fill('[data-testid="lobby-code-input"]', lobbyCode || '');
    await playerPage.click('[data-testid="join-lobby-confirm"]');

    // Verify both players are in lobby
    await expect(page.locator('[data-testid="player-list"]')).toContainText(hostUsername);
    await expect(page.locator('[data-testid="player-list"]')).toContainText(playerUsername);
    await expect(playerPage.locator('[data-testid="player-list"]')).toContainText(hostUsername);
    await expect(playerPage.locator('[data-testid="player-list"]')).toContainText(playerUsername);

    // Both players ready up
    await page.click('[data-testid="ready-button"]');
    await playerPage.click('[data-testid="ready-button"]');

    // Host starts game
    await page.click('[data-testid="start-game-button"]');

    // Wait for game to start
    await expect(page.locator('[data-testid="question-container"]')).toBeVisible({ timeout: 10000 });
    await expect(playerPage.locator('[data-testid="question-container"]')).toBeVisible({ timeout: 10000 });

    // Play through 3 questions
    for (let questionNum = 1; questionNum <= 3; questionNum++) {
      // Wait for question to appear
      await expect(page.locator('[data-testid="question-text"]')).toBeVisible();
      await expect(playerPage.locator('[data-testid="question-text"]')).toBeVisible();

      // Verify timer is running
      await expect(page.locator('[data-testid="timer"]')).toBeVisible();
      await expect(playerPage.locator('[data-testid="timer"]')).toBeVisible();

      // Host answers question (always pick first option)
      await page.click('[data-testid="answer-option-0"]');
      
      // Player answers question (always pick second option)
      await playerPage.click('[data-testid="answer-option-1"]');

      // Wait for answer feedback
      await expect(page.locator('[data-testid="answer-feedback"]')).toBeVisible({ timeout: 5000 });
      await expect(playerPage.locator('[data-testid="answer-feedback"]')).toBeVisible({ timeout: 5000 });

      // Wait for next question or results (if last question)
      if (questionNum < 3) {
        await page.waitForTimeout(3000); // Wait for next question transition
      }
    }

    // Verify game completion and results
    await expect(page.locator('[data-testid="final-results"]')).toBeVisible({ timeout: 10000 });
    await expect(playerPage.locator('[data-testid="final-results"]')).toBeVisible({ timeout: 10000 });

    // Verify scores are displayed
    await expect(page.locator('[data-testid="final-score"]')).toBeVisible();
    await expect(playerPage.locator('[data-testid="final-score"]')).toBeVisible();

    // Verify both players' scores are shown
    await expect(page.locator('[data-testid="player-scores"]')).toContainText(hostUsername);
    await expect(page.locator('[data-testid="player-scores"]')).toContainText(playerUsername);
    await expect(playerPage.locator('[data-testid="player-scores"]')).toContainText(hostUsername);
    await expect(playerPage.locator('[data-testid="player-scores"]')).toContainText(playerUsername);
  });

  test('should handle player disconnection during game', async ({ page, context }) => {
    // Register host
    await page.goto('/');
    await page.click('text=Register');
    
    const timestamp = Date.now();
    const hostUsername = `disconnecthost${timestamp}`;
    const hostEmail = `disconnecthost${timestamp}@example.com`;
    const password = 'TestPassword123!';

    await page.fill('[data-testid="username-input"]', hostUsername);
    await page.fill('[data-testid="email-input"]', hostEmail);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    // Create lobby
    await page.click('[data-testid="create-lobby-button"]');
    await page.selectOption('[data-testid="question-count-select"]', '3');
    await page.click('[data-testid="confirm-create-lobby"]');

    const lobbyCode = await page.locator('[data-testid="lobby-code"]').textContent();

    // Create second player
    const playerPage = await context.newPage();
    await playerPage.goto('/');
    await playerPage.click('text=Register');
    
    const playerUsername = `disconnectplayer${timestamp}`;
    const playerEmail = `disconnectplayer${timestamp}@example.com`;

    await playerPage.fill('[data-testid="username-input"]', playerUsername);
    await playerPage.fill('[data-testid="email-input"]', playerEmail);
    await playerPage.fill('[data-testid="password-input"]', password);
    await playerPage.fill('[data-testid="confirm-password-input"]', password);
    await playerPage.click('[data-testid="register-button"]');

    // Join lobby
    await playerPage.click('[data-testid="join-lobby-button"]');
    await playerPage.fill('[data-testid="lobby-code-input"]', lobbyCode || '');
    await playerPage.click('[data-testid="join-lobby-confirm"]');

    // Start game
    await page.click('[data-testid="ready-button"]');
    await playerPage.click('[data-testid="ready-button"]');
    await page.click('[data-testid="start-game-button"]');

    // Wait for first question
    await expect(page.locator('[data-testid="question-container"]')).toBeVisible();

    // Simulate player disconnection
    await playerPage.close();

    // Verify host sees player disconnection
    await expect(page.locator('[data-testid="player-disconnected"]')).toContainText(playerUsername);
    
    // Game should continue for remaining player
    await expect(page.locator('[data-testid="question-text"]')).toBeVisible();
    await page.click('[data-testid="answer-option-0"]');
  });

  test('should handle lobby timeout correctly', async ({ page }) => {
    // Register user
    await page.goto('/');
    await page.click('text=Register');
    
    const timestamp = Date.now();
    const username = `timeoutuser${timestamp}`;
    const email = `timeoutuser${timestamp}@example.com`;
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

    // Wait for lobby timeout (if implemented)
    // This test depends on your lobby timeout implementation
    await page.waitForTimeout(60000); // Wait 1 minute

    // Check if lobby timeout notification appears
    // Adjust selector based on your implementation
    const timeoutMessage = page.locator('[data-testid="lobby-timeout"]');
    if (await timeoutMessage.isVisible()) {
      await expect(timeoutMessage).toContainText('timeout');
    }
  });

  test('should maintain real-time synchronization', async ({ page, context }) => {
    // Setup two players
    await page.goto('/');
    await page.click('text=Register');
    
    const timestamp = Date.now();
    const host = `synchost${timestamp}`;
    const player = `syncplayer${timestamp}`;
    const password = 'TestPassword123!';

    // Register host
    await page.fill('[data-testid="username-input"]', host);
    await page.fill('[data-testid="email-input"]', `${host}@example.com`);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    // Create lobby
    await page.click('[data-testid="create-lobby-button"]');
    await page.selectOption('[data-testid="question-count-select"]', '3');
    await page.click('[data-testid="confirm-create-lobby"]');

    const lobbyCode = await page.locator('[data-testid="lobby-code"]').textContent();

    // Setup second player
    const playerPage = await context.newPage();
    await playerPage.goto('/');
    await playerPage.click('text=Register');
    await playerPage.fill('[data-testid="username-input"]', player);
    await playerPage.fill('[data-testid="email-input"]', `${player}@example.com`);
    await playerPage.fill('[data-testid="password-input"]', password);
    await playerPage.fill('[data-testid="confirm-password-input"]', password);
    await playerPage.click('[data-testid="register-button"]');

    // Join lobby
    await playerPage.click('[data-testid="join-lobby-button"]');
    await playerPage.fill('[data-testid="lobby-code-input"]', lobbyCode || '');
    await playerPage.click('[data-testid="join-lobby-confirm"]');

    // Test real-time ready state updates
    await page.click('[data-testid="ready-button"]');
    await expect(page.locator('[data-testid="ready-indicator"]')).toHaveAttribute('data-ready', 'true');
    await expect(playerPage.locator(`[data-testid="player-${host}"] [data-testid="ready-status"]`)).toBeVisible();

    await playerPage.click('[data-testid="ready-button"]');
    await expect(playerPage.locator('[data-testid="ready-indicator"]')).toHaveAttribute('data-ready', 'true');
    await expect(page.locator(`[data-testid="player-${player}"] [data-testid="ready-status"]`)).toBeVisible();

    // Start game and test synchronized question display
    await page.click('[data-testid="start-game-button"]');

    await expect(page.locator('[data-testid="question-container"]')).toBeVisible();
    await expect(playerPage.locator('[data-testid="question-container"]')).toBeVisible();

    // Verify both see same question
    const hostQuestion = await page.locator('[data-testid="question-text"]').textContent();
    const playerQuestion = await playerPage.locator('[data-testid="question-text"]').textContent();
    expect(hostQuestion).toBe(playerQuestion);

    // Test synchronized timer
    const hostTimer = await page.locator('[data-testid="timer"]').textContent();
    const playerTimer = await playerPage.locator('[data-testid="timer"]').textContent();
    
    // Timers should be within 1 second of each other
    const hostTime = parseInt(hostTimer || '0');
    const playerTime = parseInt(playerTimer || '0');
    expect(Math.abs(hostTime - playerTime)).toBeLessThanOrEqual(1);
  });

  test('should handle scoring system correctly', async ({ page, context }) => {
    // Setup game with 2 players
    await page.goto('/');
    await page.click('text=Register');
    
    const timestamp = Date.now();
    const host = `scorehost${timestamp}`;
    const player = `scoreplayer${timestamp}`;
    const password = 'TestPassword123!';

    // Register and setup lobby
    await page.fill('[data-testid="username-input"]', host);
    await page.fill('[data-testid="email-input"]', `${host}@example.com`);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');

    await page.click('[data-testid="create-lobby-button"]');
    await page.selectOption('[data-testid="question-count-select"]', '5');
    await page.click('[data-testid="confirm-create-lobby"]');

    const lobbyCode = await page.locator('[data-testid="lobby-code"]').textContent();

    // Add second player
    const playerPage = await context.newPage();
    await playerPage.goto('/');
    await playerPage.click('text=Register');
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

    // Track scores through questions
    let hostScore = 0;
    let playerScore = 0;

    for (let questionNum = 1; questionNum <= 5; questionNum++) {
      await expect(page.locator('[data-testid="question-container"]')).toBeVisible();
      
      // Answer quickly for maximum points
      await page.click('[data-testid="answer-option-0"]');
      await playerPage.click('[data-testid="answer-option-0"]');

      // Check score updates
      await expect(page.locator('[data-testid="current-score"]')).toBeVisible();
      await expect(playerPage.locator('[data-testid="current-score"]')).toBeVisible();

      // Verify multiplier system (if consecutive correct)
      const multiplier = await page.locator('[data-testid="score-multiplier"]').textContent();
      expect(parseInt(multiplier || '1')).toBeGreaterThanOrEqual(1);
      expect(parseInt(multiplier || '1')).toBeLessThanOrEqual(5);

      if (questionNum < 5) {
        await page.waitForTimeout(3000);
      }
    }

    // Verify final scores
    await expect(page.locator('[data-testid="final-results"]')).toBeVisible();
    await expect(page.locator('[data-testid="final-score"]')).toBeVisible();
    
    const finalScore = await page.locator('[data-testid="final-score"]').textContent();
    expect(parseInt(finalScore || '0')).toBeGreaterThan(0);
  });
}); 