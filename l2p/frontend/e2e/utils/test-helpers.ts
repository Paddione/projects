import { Page, BrowserContext, expect, Locator } from '@playwright/test';
import { TestDataGenerator, UserData } from './data-generators';
import { TestDataManager } from './test-data-manager';

/**
 * Comprehensive test helpers for common E2E operations
 */
export class TestHelpers {
  private static dataManager = TestDataManager.getInstance();

  private static async ensureAuthForm(page: Page): Promise<void> {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

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
  }

  /**
   * Authentication helpers
   */
  static async registerUser(
    page: Page, 
    userData?: Partial<UserData>,
    options: { takeScreenshot?: boolean; timeout?: number } = {}
  ): Promise<UserData> {
    const { takeScreenshot = false, timeout = 15000 } = options;
    
    try {
      const user = TestDataGenerator.generateUser(userData);

      await this.ensureAuthForm(page);
      await page.click('[data-testid="register-tab"]');
      
      // Fill registration form
      await page.fill('[data-testid="username-input"]', user.username);
      await page.fill('[data-testid="email-input"]', user.email);
      await page.fill('[data-testid="password-input"]', user.password);
      await page.fill('[data-testid="confirm-password-input"]', user.password);
      
      // Select character if available
      const characterSelector = '[data-testid="character-1"]';
      if (await page.locator(characterSelector).isVisible()) {
        await page.click(characterSelector);
      }
      
      // Submit registration
      await page.click('[data-testid="register-button"]');
      
      // Wait for registration to complete
      await page.waitForFunction(() => {
        const userMenu = document.querySelector('[data-testid="user-menu"]');
        const errorMessage = document.querySelector('[data-testid="registration-error"]');
        return userMenu || errorMessage;
      }, { timeout });
      
      // Check for registration errors
      const errorElement = page.locator('[data-testid="registration-error"]');
      if (await errorElement.isVisible()) {
        const errorText = await errorElement.textContent();
        throw new Error(`Registration failed: ${errorText}`);
      }
      
      // Verify successful authentication
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
      
      if (takeScreenshot) {
        await page.screenshot({ 
          path: `registration-success-${user.username}-${Date.now()}.png`,
          fullPage: true 
        });
      }
      
      return user;
      
    } catch (error) {
      console.error('Registration failed:', error);
      
      if (takeScreenshot) {
        await page.screenshot({ 
          path: `registration-error-${Date.now()}.png`,
          fullPage: true 
        });
      }
      
      throw error;
    }
  }

  static async loginUser(
    page: Page, 
    user: UserData,
    options: { takeScreenshot?: boolean; timeout?: number } = {}
  ): Promise<void> {
    const { takeScreenshot = false, timeout = 10000 } = options;
    
    try {
      await this.ensureAuthForm(page);
      await page.click('[data-testid="login-tab"]');
      
      await page.fill('[data-testid="username-input"]', user.username);
      await page.fill('[data-testid="password-input"]', user.password);
      await page.click('[data-testid="login-button"]');
      
      // Wait for login to complete
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible({ timeout });
      
      if (takeScreenshot) {
        await page.screenshot({ 
          path: `login-success-${user.username}-${Date.now()}.png`,
          fullPage: true 
        });
      }
      
    } catch (error) {
      console.error('Login failed:', error);
      
      if (takeScreenshot) {
        await page.screenshot({ 
          path: `login-error-${Date.now()}.png`,
          fullPage: true 
        });
      }
      
      throw error;
    }
  }

  static async logoutUser(page: Page): Promise<void> {
    try {
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="logout-button"]');
      
      // Verify logout
      await expect(page.locator('[data-testid="user-menu"]')).not.toBeVisible();
      await expect(page.locator('text=Login')).toBeVisible();
      
    } catch (error) {
      console.error('Logout failed:', error);
      throw error;
    }
  }

  /**
   * Lobby management helpers
   */
  static async createLobby(
    page: Page,
    options: {
      questionCount?: number;
      questionSet?: string;
      isPrivate?: boolean;
      maxPlayers?: number;
      takeScreenshot?: boolean;
    } = {}
  ): Promise<string> {
    const {
      questionCount = 5,
      questionSet = 'general',
      isPrivate = false,
      takeScreenshot = false
    } = options;
    
    try {
      await page.click('[data-testid="create-lobby-button"]');
      
      // Configure lobby settings
      await page.selectOption('[data-testid="question-count-select"]', questionCount.toString());
      await page.selectOption('[data-testid="question-set-select"]', questionSet);
      
      if (isPrivate) {
        await page.check('[data-testid="private-lobby-checkbox"]');
      }
      
      // Confirm lobby creation
      await page.click('[data-testid="confirm-create-lobby"]');
      
      // Wait for lobby to be created
      await expect(page.locator('[data-testid="lobby-code"]')).toBeVisible({ timeout: 10000 });
      
      // Get lobby code
      const lobbyCodeElement = page.locator('[data-testid="lobby-code"]');
      const lobbyCode = await lobbyCodeElement.textContent();
      
      if (!lobbyCode) {
        throw new Error('Failed to get lobby code');
      }
      
      if (takeScreenshot) {
        await page.screenshot({ 
          path: `lobby-created-${lobbyCode.trim()}-${Date.now()}.png`,
          fullPage: true 
        });
      }
      
      return lobbyCode.trim();
      
    } catch (error) {
      console.error('Failed to create lobby:', error);
      
      if (takeScreenshot) {
        await page.screenshot({ 
          path: `lobby-creation-error-${Date.now()}.png`,
          fullPage: true 
        });
      }
      
      throw error;
    }
  }

  static async joinLobby(
    page: Page, 
    lobbyCode: string,
    options: { takeScreenshot?: boolean; timeout?: number } = {}
  ): Promise<void> {
    const { takeScreenshot = false, timeout = 10000 } = options;
    
    try {
      await page.click('[data-testid="join-lobby-button"]');
      await page.fill('[data-testid="lobby-code-input"]', lobbyCode);
      await page.click('[data-testid="join-lobby-confirm"]');
      
      // Wait for successful join
      await expect(page.locator('[data-testid="lobby-players"]')).toBeVisible({ timeout });
      
      if (takeScreenshot) {
        await page.screenshot({ 
          path: `lobby-joined-${lobbyCode}-${Date.now()}.png`,
          fullPage: true 
        });
      }
      
    } catch (error) {
      console.error('Failed to join lobby:', error);
      
      if (takeScreenshot) {
        await page.screenshot({ 
          path: `join-lobby-error-${Date.now()}.png`,
          fullPage: true 
        });
      }
      
      throw error;
    }
  }

  static async startGame(
    page: Page,
    options: { takeScreenshot?: boolean; timeout?: number } = {}
  ): Promise<void> {
    const { takeScreenshot = false, timeout = 15000 } = options;
    
    try {
      await page.click('[data-testid="start-game-button"]');
      await expect(page.locator('[data-testid="question-container"]')).toBeVisible({ timeout });
      
      if (takeScreenshot) {
        await page.screenshot({ 
          path: `game-started-${Date.now()}.png`,
          fullPage: true 
        });
      }
      
    } catch (error) {
      console.error('Failed to start game:', error);
      throw error;
    }
  }

  /**
   * Game interaction helpers
   */
  static async answerQuestion(
    page: Page, 
    optionIndex: number = 0,
    options: { takeScreenshot?: boolean; timeout?: number } = {}
  ): Promise<{ correct: boolean; score: number }> {
    const { takeScreenshot = false, timeout = 5000 } = options;
    
    try {
      // Get current score before answering
      const currentScore = await this.getCurrentScore(page);
      
      // Click answer option
      await page.click(`[data-testid="answer-option-${optionIndex}"]`);
      
      // Wait for feedback
      await expect(page.locator('[data-testid="answer-feedback"]')).toBeVisible({ timeout });
      
      // Check if answer was correct
      const feedbackElement = page.locator('[data-testid="answer-feedback"]');
      const feedbackText = await feedbackElement.textContent();
      const correct = feedbackText?.toLowerCase().includes('correct') || false;
      
      // Get new score
      const newScore = await this.getCurrentScore(page);
      
      if (takeScreenshot) {
        await page.screenshot({ 
          path: `question-answered-${correct ? 'correct' : 'wrong'}-${Date.now()}.png`,
          fullPage: true 
        });
      }
      
      return { correct, score: newScore - currentScore };
      
    } catch (error) {
      console.error('Failed to answer question:', error);
      throw error;
    }
  }

  static async waitForNextQuestion(
    page: Page,
    options: { timeout?: number } = {}
  ): Promise<boolean> {
    const { timeout = 15000 } = options;
    
    try {
      // Wait for either next question or game end screen
      await page.waitForFunction(() => {
        const nextQuestion = document.querySelector('[data-testid="question-container"]');
        const gameEnd = document.querySelector('[data-testid="game-results"]');
        return nextQuestion || gameEnd;
      }, { timeout });
      
      // Return true if there's a next question, false if game ended
      return await page.locator('[data-testid="question-container"]').isVisible();
      
    } catch (error) {
      console.error('Failed to wait for next question:', error);
      return false;
    }
  }

  static async getCurrentScore(page: Page): Promise<number> {
    try {
      const scoreElement = page.locator('[data-testid="current-score"]');
      const scoreText = await scoreElement.textContent();
      return parseInt(scoreText || '0');
    } catch (error) {
      return 0;
    }
  }

  /**
   * File upload helpers
   */
  static async uploadFile(
    page: Page,
    filePath: string,
    options: {
      inputSelector?: string;
      waitForUpload?: boolean;
      takeScreenshot?: boolean;
      timeout?: number;
    } = {}
  ): Promise<void> {
    const {
      inputSelector = '[data-testid="file-input"]',
      waitForUpload = true,
      takeScreenshot = false,
      timeout = 10000
    } = options;
    
    try {
      await page.setInputFiles(inputSelector, filePath);
      
      if (waitForUpload) {
        await page.waitForSelector('[data-testid="upload-success"]', { timeout });
      }
      
      if (takeScreenshot) {
        await page.screenshot({ 
          path: `file-uploaded-${Date.now()}.png`,
          fullPage: true 
        });
      }
      
    } catch (error) {
      console.error('Failed to upload file:', error);
      throw error;
    }
  }

  static async createTestFile(
    fileName: string,
    content: string = 'Test file content',
    type: string = 'text/plain'
  ): Promise<string> {
    const fs = require('fs');
    const path = require('path');
    
    const testDataDir = path.join(__dirname, '../test-data');
    if (!fs.existsSync(testDataDir)) {
      fs.mkdirSync(testDataDir, { recursive: true });
    }
    
    const filePath = path.join(testDataDir, fileName);
    fs.writeFileSync(filePath, content);
    
    return filePath;
  }

  /**
   * Network and error simulation helpers
   */
  static async simulateNetworkError(
    page: Page,
    pattern: string = '**/api/**',
    errorType: 'failed' | 'timeout' | 'disconnected' = 'failed'
  ): Promise<void> {
    await page.route(pattern, route => route.abort(errorType));
  }

  static async simulateSlowNetwork(
    page: Page,
    delay: number = 5000,
    pattern: string = '**/api/**'
  ): Promise<void> {
    await page.route(pattern, async route => {
      await new Promise(resolve => setTimeout(resolve, delay));
      await route.continue();
    });
  }

  static async mockApiResponse(
    page: Page,
    url: string,
    response: Record<string, unknown>,
    status: number = 200
  ): Promise<void> {
    await page.route(url, route => {
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(response)
      });
    });
  }

  /**
   * Accessibility testing helpers
   */
  static async checkBasicAccessibility(page: Page): Promise<AccessibilityReport> {
    const report: AccessibilityReport = {
      passed: true,
      issues: [],
      timestamp: new Date()
    };

    try {
      // Check for headings
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').count();
      if (headings === 0) {
        report.issues.push('No headings found on page');
        report.passed = false;
      }

      // Check for alt text on images
      const images = await page.locator('img').all();
      for (const img of images) {
        const alt = await img.getAttribute('alt');
        if (!alt) {
          report.issues.push('Image missing alt text');
          report.passed = false;
        }
      }

      // Check for form labels
      const inputs = await page.locator('input, select, textarea').all();
      for (const input of inputs) {
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const ariaLabelledBy = await input.getAttribute('aria-labelledby');
        
        if (id) {
          const label = await page.locator(`label[for="${id}"]`).count();
          if (label === 0 && !ariaLabel && !ariaLabelledBy) {
            report.issues.push('Form input missing label');
            report.passed = false;
          }
        }
      }

      // Check for keyboard navigation
      await page.keyboard.press('Tab');
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      if (!focusedElement) {
        report.issues.push('No focusable elements found');
        report.passed = false;
      }

    } catch (error) {
      report.issues.push(`Accessibility check failed: ${error}`);
      report.passed = false;
    }

    return report;
  }

  static async testKeyboardNavigation(page: Page): Promise<boolean> {
    try {
      const focusableElements = await page.locator('button, input, select, textarea, a[href]').count();
      let focusedCount = 0;

      for (let i = 0; i < focusableElements && i < 10; i++) {
        await page.keyboard.press('Tab');
        const focused = await page.evaluate(() => document.activeElement !== document.body);
        if (focused) focusedCount++;
      }

      return focusedCount > 0;
    } catch (error) {
      console.error('Keyboard navigation test failed:', error);
      return false;
    }
  }

  /**
   * Performance testing helpers
   */
  static async measurePageLoad(page: Page): Promise<PerformanceMetrics> {
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');
      
      return {
        loadTime: navigation.loadEventEnd - navigation.fetchStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
        firstPaint: paint.find(p => p.name === 'first-paint')?.startTime || 0,
        firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0,
        networkTime: navigation.responseEnd - navigation.requestStart,
        renderTime: navigation.loadEventEnd - navigation.responseEnd
      };
    });

    return metrics;
  }

  static async measureMemoryUsage(page: Page): Promise<MemoryInfo> {
    return await page.evaluate(() => {
      const memory = (performance as any).memory;
      return {
        usedJSHeapSize: memory?.usedJSHeapSize || 0,
        totalJSHeapSize: memory?.totalJSHeapSize || 0,
        jsHeapSizeLimit: memory?.jsHeapSizeLimit || 0
      };
    });
  }

  /**
   * Screenshot and video helpers
   */
  static async takeScreenshot(
    page: Page,
    name: string,
    options: { fullPage?: boolean; path?: string } = {}
  ): Promise<string> {
    const { fullPage = true, path } = options;
    const timestamp = Date.now();
    const screenshotPath = path || `screenshots/${name}-${timestamp}.png`;
    
    await page.screenshot({ 
      path: screenshotPath,
      fullPage 
    });
    
    return screenshotPath;
  }

  static async startVideoRecording(context: BrowserContext): Promise<void> {
    // Video recording is handled by Playwright configuration
    // This is a placeholder for any additional video setup
  }

  /**
   * Wait and retry helpers
   */
  static async waitForStableNetwork(
    page: Page,
    timeout: number = 30000
  ): Promise<void> {
    await page.waitForLoadState('networkidle', { timeout });
  }

  static async retryOperation<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    delay: number = 1000
  ): Promise<T> {
    let lastError: Error;
    
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        if (i < maxRetries - 1) {
          await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
        }
      }
    }
    
    throw lastError!;
  }

  /**
   * Data cleanup helpers
   */
  static async cleanupTestData(page: Page): Promise<void> {
    try {
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
        
        // Clear IndexedDB if present
        if ('indexedDB' in window) {
          indexedDB.databases?.().then(databases => {
            databases.forEach(db => {
              if (db.name?.startsWith('test_')) {
                indexedDB.deleteDatabase(db.name);
              }
            });
          });
        }
      });

      // Clear cookies
      const context = page.context();
      await context.clearCookies();
      
    } catch (error) {
      console.warn('Failed to cleanup test data:', error);
    }
  }

  static async verifyCleanup(page: Page): Promise<boolean> {
    try {
      const hasTestData = await page.evaluate(() => {
        const localStorage = window.localStorage.length > 0;
        const sessionStorage = window.sessionStorage.length > 0;
        return localStorage || sessionStorage;
      });
      
      return !hasTestData;
    } catch (error) {
      return false;
    }
  }
}

// Type definitions
export interface AccessibilityReport {
  passed: boolean;
  issues: string[];
  timestamp: Date;
}

export interface PerformanceMetrics {
  loadTime: number;
  domContentLoaded: number;
  firstPaint: number;
  firstContentfulPaint: number;
  networkTime: number;
  renderTime: number;
}

export interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
}
