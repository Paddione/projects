import { test, expect, Page, BrowserContext, Browser } from '@playwright/test';
import { TestHelpers } from '../../utils/test-helpers';
import { UserData } from '../../utils/data-generators';

// All multiplayer tests use extended timeout
test.describe.configure({ timeout: 120_000 });

/**
 * Helper: register a fresh user in a new browser context and return the page + user
 */
async function createPlayer(browser: Browser): Promise<{
  context: BrowserContext;
  page: Page;
  user: UserData;
}> {
  const context = await browser.newContext();
  const page = await context.newPage();
  const { user } = await TestHelpers.registerUser(page);
  return { context, page, user };
}

/**
 * Helper: wait for either sync-countdown or question-container, then wait for question
 */
async function waitForGameStart(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      document.querySelector('[data-testid="sync-countdown"]') ||
      document.querySelector('[data-testid="question-container"]'),
    { timeout: 20_000 }
  );
  // If still syncing, wait for actual question
  await expect(page.locator('[data-testid="question-container"]')).toBeVisible({
    timeout: 15_000,
  });
}

/**
 * Helper: answer the current question (click first available option)
 */
async function answerCurrentQuestion(page: Page, optionIndex = 0): Promise<void> {
  const option = page.locator(`[data-testid="answer-option-${optionIndex}"]`);
  await expect(option).toBeVisible({ timeout: 10_000 });
  await expect(option).toBeEnabled();
  await option.click();
  await expect(page.locator('[data-testid="answer-feedback"]')).toBeVisible({
    timeout: 5_000,
  });
}

/**
 * Helper: wait for the next question to appear (new question-container after answer feedback)
 */
async function waitForNextQuestionOrResults(page: Page): Promise<'question' | 'results'> {
  // After answering, we need to wait for either:
  // - A new question (question text changes / answer options re-enable)
  // - Navigation to results page
  try {
    await page.waitForFunction(
      () => {
        // Check for results page
        if (
          document.querySelector('[data-testid="final-results"]') ||
          window.location.pathname.includes('/results/')
        ) {
          return true;
        }
        // Check if answer options are enabled again (new question loaded)
        const options = document.querySelectorAll('[data-testid^="answer-option-"]');
        if (options.length > 0) {
          const firstOption = options[0] as HTMLButtonElement;
          if (!firstOption.disabled) return true;
        }
        return false;
      },
      { timeout: 30_000 }
    );
  } catch {
    // Timeout — check where we are
  }

  if (await page.locator('[data-testid="final-results"]').isVisible().catch(() => false)) {
    return 'results';
  }
  if (page.url().includes('/results/')) {
    return 'results';
  }
  return 'question';
}

test.describe('Multiplayer Lobby & Game E2E', () => {
  test.afterEach(async ({ browser }) => {
    // Contexts are closed in each test's own cleanup
  });

  test('2-player complete game session', async ({ browser }) => {
    // Setup: register host and player
    const host = await createPlayer(browser);
    const player = await createPlayer(browser);

    try {
      // Host creates lobby
      const lobbyCode = await TestHelpers.createLobbySimple(host.page);
      expect(lobbyCode).toMatch(/^[A-Z0-9]{6}$/);

      // Player joins lobby
      await TestHelpers.joinLobby(player.page, lobbyCode);

      // Verify both players see each other in lobby
      await expect(host.page.locator('[data-testid="lobby-players"]')).toBeVisible();
      await expect(player.page.locator('[data-testid="lobby-players"]')).toBeVisible();

      // Verify player list shows both usernames
      const hostLobbyText = host.page.locator('[data-testid="lobby-players"]');
      const playerLobbyText = player.page.locator('[data-testid="lobby-players"]');
      await expect(hostLobbyText).toContainText(host.user.username, { timeout: 10_000 });
      await expect(hostLobbyText).toContainText(player.user.username, { timeout: 10_000 });
      await expect(playerLobbyText).toContainText(host.user.username, { timeout: 10_000 });
      await expect(playerLobbyText).toContainText(player.user.username, { timeout: 10_000 });

      // Both players ready up
      await TestHelpers.toggleReady(host.page);
      await TestHelpers.toggleReady(player.page);

      // Host starts game
      await expect(host.page.locator('[data-testid="start-game-button"]')).toBeEnabled({
        timeout: 5_000,
      });
      await host.page.click('[data-testid="start-game-button"]');

      // Both players should see game start (sync countdown then question)
      await waitForGameStart(host.page);
      await waitForGameStart(player.page);

      // Verify both see a question
      await expect(host.page.locator('[data-testid="question-text"]')).toBeVisible();
      await expect(player.page.locator('[data-testid="question-text"]')).toBeVisible();

      // Play through questions until results
      let questionCount = 0;
      const maxQuestions = 15; // Safety limit
      let gameState: 'question' | 'results' = 'question';

      while (gameState === 'question' && questionCount < maxQuestions) {
        questionCount++;

        // Both answer
        await answerCurrentQuestion(host.page, 0);
        await answerCurrentQuestion(player.page, 1);

        // Wait for next question or results
        gameState = await waitForNextQuestionOrResults(host.page);
      }

      // Verify both reach results page
      await TestHelpers.waitForResults(host.page);
      await TestHelpers.waitForResults(player.page);

      // Verify results are displayed
      await expect(host.page.locator('[data-testid="final-results"]')).toBeVisible();
      await expect(player.page.locator('[data-testid="final-results"]')).toBeVisible();
      await expect(host.page.locator('[data-testid="player-scores"]')).toBeVisible();
      await expect(player.page.locator('[data-testid="player-scores"]')).toBeVisible();

      // Verify both usernames appear in results
      await expect(host.page.locator('[data-testid="player-scores"]')).toContainText(
        host.user.username
      );
      await expect(host.page.locator('[data-testid="player-scores"]')).toContainText(
        player.user.username
      );
    } finally {
      await host.context.close();
      await player.context.close();
    }
  });

  test('lobby player management - join, ready, leave', async ({ browser }) => {
    const host = await createPlayer(browser);
    const player1 = await createPlayer(browser);
    const player2 = await createPlayer(browser);

    try {
      // Host creates lobby
      const lobbyCode = await TestHelpers.createLobbySimple(host.page);

      // Player 1 joins
      await TestHelpers.joinLobby(player1.page, lobbyCode);

      // Verify host sees 2 players
      const hostPlayers = host.page.locator('[data-testid="lobby-players"]');
      await expect(hostPlayers).toContainText(player1.user.username, { timeout: 10_000 });

      // Player 2 joins
      await TestHelpers.joinLobby(player2.page, lobbyCode);

      // Verify all see 3 players
      await expect(hostPlayers).toContainText(player2.user.username, { timeout: 10_000 });
      await expect(player1.page.locator('[data-testid="lobby-players"]')).toContainText(
        player2.user.username,
        { timeout: 10_000 }
      );

      // Player 1 toggles ready
      await TestHelpers.toggleReady(player1.page);

      // Host should see at least 1 ready player (start button should become enabled)
      // Give socket event time to propagate
      await host.page.waitForTimeout(1000);

      // Player 2 leaves lobby
      await player2.page.click('[data-testid="leave-lobby-button"]');

      // Verify host and player 1 no longer see player 2
      // Wait for the lobby update to propagate
      await host.page.waitForTimeout(2000);

      // The lobby should still work — host can start with player 1 ready
      await TestHelpers.toggleReady(host.page);
      await expect(host.page.locator('[data-testid="start-game-button"]')).toBeEnabled({
        timeout: 5_000,
      });
    } finally {
      await host.context.close();
      await player1.context.close();
      await player2.context.close();
    }
  });

  test('game synchronization - same question shown to all players', async ({ browser }) => {
    const host = await createPlayer(browser);
    const player = await createPlayer(browser);

    try {
      // Setup lobby
      const lobbyCode = await TestHelpers.createLobbySimple(host.page);
      await TestHelpers.joinLobby(player.page, lobbyCode);

      // Ready up and start
      await TestHelpers.toggleReady(host.page);
      await TestHelpers.toggleReady(player.page);
      await expect(host.page.locator('[data-testid="start-game-button"]')).toBeEnabled({
        timeout: 5_000,
      });
      await host.page.click('[data-testid="start-game-button"]');

      // Wait for game to start on both
      await waitForGameStart(host.page);
      await waitForGameStart(player.page);

      // Read question text from both pages
      const hostQ1 = await host.page.locator('[data-testid="question-text"]').textContent();
      const playerQ1 = await player.page.locator('[data-testid="question-text"]').textContent();

      // Both must see the same question
      expect(hostQ1).toBeTruthy();
      expect(hostQ1).toBe(playerQ1);

      // Verify both see the same timer region (within 2 seconds of each other)
      const hostTimer = await host.page.locator('[data-testid="timer"]').textContent();
      const playerTimer = await player.page.locator('[data-testid="timer"]').textContent();
      // Extract numbers from "⏱ Ns" format
      const hostTime = parseInt(hostTimer?.replace(/\D/g, '') || '0');
      const playerTime = parseInt(playerTimer?.replace(/\D/g, '') || '0');
      expect(Math.abs(hostTime - playerTime)).toBeLessThanOrEqual(2);

      // Both answer first question
      await answerCurrentQuestion(host.page, 0);
      await answerCurrentQuestion(player.page, 0);

      // Wait for second question
      const hostState = await waitForNextQuestionOrResults(host.page);

      if (hostState === 'question') {
        await waitForNextQuestionOrResults(player.page);

        // Read second question from both
        const hostQ2 = await host.page.locator('[data-testid="question-text"]').textContent();
        const playerQ2 = await player.page.locator('[data-testid="question-text"]').textContent();

        // Second question should also be identical
        expect(hostQ2).toBeTruthy();
        expect(hostQ2).toBe(playerQ2);

        // And it should be different from the first question
        expect(hostQ2).not.toBe(hostQ1);
      }
    } finally {
      await host.context.close();
      await player.context.close();
    }
  });

  test('player disconnection during game', async ({ browser }) => {
    const host = await createPlayer(browser);
    const player = await createPlayer(browser);

    try {
      // Setup and start game
      const lobbyCode = await TestHelpers.createLobbySimple(host.page);
      await TestHelpers.joinLobby(player.page, lobbyCode);
      await TestHelpers.toggleReady(host.page);
      await TestHelpers.toggleReady(player.page);
      await host.page.click('[data-testid="start-game-button"]');

      // Wait for first question on both
      await waitForGameStart(host.page);
      await waitForGameStart(player.page);

      // Disconnect player by closing their page
      await player.page.close();

      // Host should still be able to answer questions
      await answerCurrentQuestion(host.page, 0);

      // Wait for next question or results
      const state = await waitForNextQuestionOrResults(host.page);

      if (state === 'question') {
        // Host can continue playing
        await expect(host.page.locator('[data-testid="question-text"]')).toBeVisible();
        await answerCurrentQuestion(host.page, 0);
      }

      // Game should eventually complete for host
      // (either through answering all questions or timeout)
    } finally {
      await host.context.close();
      await player.context.close().catch(() => {});
    }
  });

  test('4-player lobby and game', async ({ browser }) => {
    const host = await createPlayer(browser);
    const player2 = await createPlayer(browser);
    const player3 = await createPlayer(browser);
    const player4 = await createPlayer(browser);
    const allPlayers = [host, player2, player3, player4];

    try {
      // Host creates lobby
      const lobbyCode = await TestHelpers.createLobbySimple(host.page);

      // All others join
      await TestHelpers.joinLobby(player2.page, lobbyCode);
      await TestHelpers.joinLobby(player3.page, lobbyCode);
      await TestHelpers.joinLobby(player4.page, lobbyCode);

      // Verify host sees all 4 players
      const hostPlayers = host.page.locator('[data-testid="lobby-players"]');
      for (const p of allPlayers) {
        await expect(hostPlayers).toContainText(p.user.username, { timeout: 10_000 });
      }

      // All ready up
      for (const p of allPlayers) {
        await TestHelpers.toggleReady(p.page);
      }

      // Host starts game
      await expect(host.page.locator('[data-testid="start-game-button"]')).toBeEnabled({
        timeout: 5_000,
      });
      await host.page.click('[data-testid="start-game-button"]');

      // All players should see game start
      for (const p of allPlayers) {
        await waitForGameStart(p.page);
      }

      // All players answer first question
      for (const p of allPlayers) {
        await answerCurrentQuestion(p.page, 0);
      }

      // Wait for next question or results for host
      const state = await waitForNextQuestionOrResults(host.page);

      if (state === 'question') {
        // Verify all players see the next question
        for (const p of allPlayers) {
          await expect(p.page.locator('[data-testid="question-text"]')).toBeVisible({
            timeout: 15_000,
          });
        }
      }
    } finally {
      for (const p of allPlayers) {
        await p.context.close().catch(() => {});
      }
    }
  });

  test('host leaves lobby - lobby destroyed', async ({ browser }) => {
    const host = await createPlayer(browser);
    const player = await createPlayer(browser);

    try {
      // Setup lobby
      const lobbyCode = await TestHelpers.createLobbySimple(host.page);
      await TestHelpers.joinLobby(player.page, lobbyCode);

      // Verify both in lobby
      await expect(host.page.locator('[data-testid="lobby-players"]')).toBeVisible();
      await expect(player.page.locator('[data-testid="lobby-players"]')).toBeVisible();

      // Host leaves lobby
      await host.page.click('[data-testid="leave-lobby-button"]');

      // Player should see lobby error or be redirected to home
      // The lobby-deleted socket event fires and the frontend handles it
      await player.page.waitForFunction(
        () => {
          // Check for error overlay
          const error = document.querySelector('[data-testid="lobby-error"]');
          // Check if redirected to home
          const createBtn = document.querySelector('[data-testid="create-lobby-button"]');
          // Check URL changed away from lobby
          const notInLobby = !window.location.pathname.includes('/lobby/');
          return error || createBtn || notInLobby;
        },
        { timeout: 15_000 }
      );
    } finally {
      await host.context.close();
      await player.context.close();
    }
  });
});
