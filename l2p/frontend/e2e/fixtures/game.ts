import { test as base, expect, Page } from '@playwright/test';
import { test as authTest, AuthUser } from './auth';
import { TestDataGenerator } from '../utils/data-generators';
import { BrowserContext } from '@playwright/test';

export interface GameLobby {
  code: string;
  host: AuthUser;
  questionCount: number;
  questionSet: string;
  players: AuthUser[];
}

export interface GameSession {
  lobby: GameLobby;
  currentQuestion: number;
  totalQuestions: number;
  timeRemaining: number;
  scores: Record<string, number>;
}

export interface GameFixtures {
  gameLobby: GameLobby;
  gameSession: GameSession;
  multiPlayerLobby: GameLobby;
}

/**
 * Game-specific fixtures for lobby and gameplay testing
 */
export const test = authTest.extend<GameFixtures>({
  /**
   * Creates a game lobby with authenticated host
   */
  gameLobby: async ({ authenticatedPage }, use) => {
    const host = await authenticatedPage.evaluate(() => window.testUserData) as AuthUser;
    
    try {
      // Create lobby
      await authenticatedPage.click('[data-testid="create-lobby-button"]');
      
      // Configure lobby settings
      const questionCount = 5;
      const questionSet = 'general';
      
      await authenticatedPage.selectOption('[data-testid="question-count-select"]', questionCount.toString());
      await authenticatedPage.selectOption('[data-testid="question-set-select"]', questionSet);
      
      // Confirm lobby creation
      await authenticatedPage.click('[data-testid="confirm-create-lobby"]');
      
      // Wait for lobby to be created
      await expect(authenticatedPage.locator('[data-testid="lobby-code"]')).toBeVisible({ timeout: 10000 });
      
      // Get lobby code
      const lobbyCodeElement = authenticatedPage.locator('[data-testid="lobby-code"]');
      const lobbyCode = await lobbyCodeElement.textContent();
      
      if (!lobbyCode) {
        throw new Error('Failed to get lobby code');
      }
      
      const lobby: GameLobby = {
        code: lobbyCode.trim(),
        host,
        questionCount,
        questionSet,
        players: [host]
      };
      
      await use(lobby);
      
    } catch (error) {
      console.error('Failed to create game lobby:', error);
      await authenticatedPage.screenshot({ 
        path: `lobby-creation-error-${Date.now()}.png`,
        fullPage: true 
      });
      throw error;
    }
  },

  /**
   * Creates a game session with active gameplay
   */
  gameSession: async ({ gameLobby, authenticatedPage }, use) => {
    try {
      // Start the game
      await authenticatedPage.click('[data-testid="start-game-button"]');
      
      // Wait for game to start
      await expect(authenticatedPage.locator('[data-testid="question-container"]')).toBeVisible({ timeout: 15000 });
      
      // Get initial game state
      const gameState = await getGameState(authenticatedPage);
      
      const session: GameSession = {
        lobby: gameLobby,
        currentQuestion: gameState.currentQuestion,
        totalQuestions: gameState.totalQuestions,
        timeRemaining: gameState.timeRemaining,
        scores: gameState.scores
      };
      
      await use(session);
      
    } catch (error) {
      console.error('Failed to create game session:', error);
      await authenticatedPage.screenshot({ 
        path: `game-session-error-${Date.now()}.png`,
        fullPage: true 
      });
      throw error;
    }
  },

  /**
   * Creates a multiplayer lobby with multiple players
   */
  multiPlayerLobby: async ({ browser, gameLobby }, use) => {
    interface PlayerContext {
      context: BrowserContext;
      page: Page;
      player: AuthUser;
    }
    
    const playerContexts: PlayerContext[] = [];
    const players: AuthUser[] = [...gameLobby.players];
    
    try {
      // Add additional players
      const numAdditionalPlayers = 2;
      
      for (let i = 0; i < numAdditionalPlayers; i++) {
        const context = await browser.newContext();
        const page = await context.newPage();
        
        // Create and authenticate new player
        const player = TestDataGenerator.generateUser();
        await page.goto('/');
        await registerUser(page, player);
        
        // Join the lobby
        await joinLobby(page, gameLobby.code);
        
        players.push(player);
        playerContexts.push({ context, page, player });
      }
      
      const multiPlayerLobby: GameLobby = {
        ...gameLobby,
        players
      };
      
      await use(multiPlayerLobby);
      
    } finally {
      // Cleanup player contexts
      for (const { context } of playerContexts) {
        await context.close();
      }
    }
  }
});

/**
 * Join an existing lobby
 */
export async function joinLobby(page: Page, lobbyCode: string): Promise<void> {
  try {
    await page.click('[data-testid="join-lobby-button"]');
    await page.fill('[data-testid="lobby-code-input"]', lobbyCode);
    await page.click('[data-testid="join-lobby-confirm"]');
    
    // Wait for successful join
    await expect(page.locator('[data-testid="lobby-players"]')).toBeVisible({ timeout: 10000 });
    
  } catch (error) {
    console.error('Failed to join lobby:', error);
    await page.screenshot({ 
      path: `join-lobby-error-${Date.now()}.png`,
      fullPage: true 
    });
    throw error;
  }
}

/**
 * Start a game from lobby
 */
export async function startGame(page: Page): Promise<void> {
  try {
    await page.click('[data-testid="start-game-button"]');
    await expect(page.locator('[data-testid="question-container"]')).toBeVisible({ timeout: 15000 });
    
  } catch (error) {
    console.error('Failed to start game:', error);
    throw error;
  }
}

/**
 * Answer a question in the game
 */
export async function answerQuestion(page: Page, optionIndex: number = 0): Promise<void> {
  try {
    await page.click(`[data-testid="answer-option-${optionIndex}"]`);
    await expect(page.locator('[data-testid="answer-feedback"]')).toBeVisible({ timeout: 5000 });
    
  } catch (error) {
    console.error('Failed to answer question:', error);
    throw error;
  }
}

/**
 * Wait for next question or game end
 */
export async function waitForNextQuestion(page: Page): Promise<boolean> {
  try {
    // Wait for either next question or game end screen
    await page.waitForFunction(() => {
      const nextQuestion = document.querySelector('[data-testid="question-container"]');
      const gameEnd = document.querySelector('[data-testid="game-results"]');
      return nextQuestion || gameEnd;
    }, { timeout: 15000 });
    
    // Return true if there's a next question, false if game ended
    return await page.locator('[data-testid="question-container"]').isVisible();
    
  } catch (error) {
    console.error('Failed to wait for next question:', error);
    return false;
  }
}

/**
 * Get current game state
 */
export async function getGameState(page: Page): Promise<any> {
  try {
    return await page.evaluate(() => {
      const questionElement = document.querySelector('[data-testid="question-number"]');
      const totalElement = document.querySelector('[data-testid="total-questions"]');
      const timerElement = document.querySelector('[data-testid="timer"]');
      const scoreElements = document.querySelectorAll('[data-testid^="player-score-"]');
      
      const scores: Record<string, number> = {};
      scoreElements.forEach(element => {
        const playerId = element.getAttribute('data-testid')?.replace('player-score-', '');
        const score = parseInt(element.textContent || '0');
        if (playerId) {
          scores[playerId] = score;
        }
      });
      
      return {
        currentQuestion: parseInt(questionElement?.textContent || '1'),
        totalQuestions: parseInt(totalElement?.textContent || '5'),
        timeRemaining: parseInt(timerElement?.textContent || '30'),
        scores
      };
    });
    
  } catch (error) {
    console.error('Failed to get game state:', error);
    return {
      currentQuestion: 1,
      totalQuestions: 5,
      timeRemaining: 30,
      scores: {}
    };
  }
}

/**
 * Verify game results
 */
export async function verifyGameResults(page: Page, expectedPlayers: number): Promise<void> {
  try {
    await expect(page.locator('[data-testid="game-results"]')).toBeVisible({ timeout: 10000 });
    
    // Verify all players have scores
    const scoreElements = page.locator('[data-testid^="final-score-"]');
    await expect(scoreElements).toHaveCount(expectedPlayers);
    
    // Verify winner is displayed
    await expect(page.locator('[data-testid="game-winner"]')).toBeVisible();
    
  } catch (error) {
    console.error('Failed to verify game results:', error);
    throw error;
  }
}

/**
 * Register a user (helper function)
 */
async function registerUser(page: Page, user: AuthUser): Promise<void> {
  await page.click('text=Register');
  await page.fill('[data-testid="username-input"]', user.username);
  await page.fill('[data-testid="email-input"]', user.email);
  await page.fill('[data-testid="password-input"]', user.password);
  await page.fill('[data-testid="confirm-password-input"]', user.password);
  
  if (await page.locator('[data-testid="character-1"]').isVisible()) {
    await page.click('[data-testid="character-1"]');
  }
  
  await page.click('[data-testid="register-button"]');
  await expect(page.locator('[data-testid="user-menu"]')).toBeVisible({ timeout: 10000 });
}

export { expect };