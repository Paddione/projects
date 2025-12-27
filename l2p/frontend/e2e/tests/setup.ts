import { test as base, expect } from '@playwright/test';
import { Page } from '@playwright/test';

// Extend the base test with custom fixtures
export const test = base.extend({
  // Custom fixture for authenticated user
  authenticatedPage: async ({ page }, use) => {
    // Navigate to app
    await page.goto('/');
    
    // Register a test user
    const timestamp = Date.now();
    const username = `testuser${timestamp}`;
    const email = `test${timestamp}@example.com`;
    const password = 'TestPassword123!';
    
    await page.click('text=Register');
    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');
    
    // Wait for successful registration
    await expect(page).toHaveURL(/.*dashboard/);
    
    // Use the authenticated page
    await use(page);
  },

  // Custom fixture for game lobby
  gameLobby: async ({ page }, use) => {
    // Create authenticated user first
    await page.goto('/');
    const timestamp = Date.now();
    const username = `gamehost${timestamp}`;
    const email = `gamehost${timestamp}@example.com`;
    const password = 'TestPassword123!';
    
    await page.click('text=Register');
    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', email);
    await page.fill('[data-testid="password-input"]', password);
    await page.fill('[data-testid="confirm-password-input"]', password);
    await page.click('[data-testid="register-button"]');
    
    // Create lobby
    await page.click('[data-testid="create-lobby-button"]');
    await page.selectOption('[data-testid="question-count-select"]', '5');
    await page.selectOption('[data-testid="question-set-select"]', 'general');
    await page.click('[data-testid="confirm-create-lobby"]');
    
    // Get lobby code
    const lobbyCode = await page.locator('[data-testid="lobby-code"]').textContent();
    
    await use({ page, lobbyCode });
  }
});

// Helper functions for common test operations
export class TestHelpers {
  static async registerUser(page: Page, username?: string, email?: string, password?: string) {
    const timestamp = Date.now();
    const defaultUsername = username || `testuser${timestamp}`;
    const defaultEmail = email || `test${timestamp}@example.com`;
    const defaultPassword = password || 'TestPassword123!';
    
    await page.goto('/');
    await page.click('text=Register');
    await page.fill('[data-testid="username-input"]', defaultUsername);
    await page.fill('[data-testid="email-input"]', defaultEmail);
    await page.fill('[data-testid="password-input"]', defaultPassword);
    await page.fill('[data-testid="confirm-password-input"]', defaultPassword);
    await page.click('[data-testid="register-button"]');
    
    return { username: defaultUsername, email: defaultEmail, password: defaultPassword };
  }

  static async createLobby(page: Page, questionCount: string = '5', questionSet: string = 'general') {
    await page.click('[data-testid="create-lobby-button"]');
    await page.selectOption('[data-testid="question-count-select"]', questionCount);
    await page.selectOption('[data-testid="question-set-select"]', questionSet);
    await page.click('[data-testid="confirm-create-lobby"]');
    
    const lobbyCode = await page.locator('[data-testid="lobby-code"]').textContent();
    return lobbyCode;
  }

  static async joinLobby(page: Page, lobbyCode: string) {
    await page.click('[data-testid="join-lobby-button"]');
    await page.fill('[data-testid="lobby-code-input"]', lobbyCode);
    await page.click('[data-testid="join-lobby-confirm"]');
  }

  static async waitForGameStart(page: Page) {
    await expect(page.locator('[data-testid="question-container"]')).toBeVisible({ timeout: 15000 });
  }

  static async answerQuestion(page: Page, optionIndex: number = 0) {
    await page.click(`[data-testid="answer-option-${optionIndex}"]`);
    await expect(page.locator('[data-testid="answer-feedback"]')).toBeVisible({ timeout: 5000 });
  }

  static async simulateNetworkError(page: Page, pattern: string = '**/api/**') {
    await page.route(pattern, route => route.abort('failed'));
  }

  static async simulateSlowNetwork(page: Page, delay: number = 5000) {
    await page.route('**/api/**', async route => {
      await new Promise(resolve => setTimeout(resolve, delay));
      await route.continue();
    });
  }

  static async mockApiResponse(page: Page, url: string, response: Record<string, unknown>, status: number = 200) {
    await page.route(url, route => {
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(response)
      });
    });
  }

  static async checkAccessibility(page: Page) {
    // Basic accessibility checks
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').count();
    expect(headings).toBeGreaterThan(0);
    
    const images = await page.locator('img').all();
    for (const img of images) {
      const alt = await img.getAttribute('alt');
      expect(alt).toBeTruthy();
    }
  }

  static async measurePerformance(page: Page) {
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        loadTime: navigation.loadEventEnd - navigation.fetchStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0
      };
    });
    
    return metrics;
  }

  static async simulateUserInactivity(page: Page, duration: number = 60000) {
    await page.waitForTimeout(duration);
  }

  static async checkConsoleErrors(page: Page) {
    const consoleErrors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    return consoleErrors;
  }

  static async takeScreenshotOnFailure(page: any, testName: string) {
    const screenshot = await page.screenshot({ 
      path: `test-results/screenshots/${testName}-${Date.now()}.png`,
      fullPage: true 
    });
    return screenshot;
  }

  static generateTestData() {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    
    return {
      username: `user${timestamp}${randomId}`,
      email: `test${timestamp}${randomId}@example.com`,
      password: 'TestPassword123!',
      lobbyCode: Array.from({ length: 6 }, () => 
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]
      ).join('')
    };
  }

  static async waitForStableNetwork(page: any, timeout: number = 30000) {
    await page.waitForLoadState('networkidle', { timeout });
  }

  static async cleanupTestData(page: any) {
    // Clean up any test data if needed
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  }
}

// Export expect for convenience
export { expect }; 