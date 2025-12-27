/**
 * E2E Testing Framework Exports
 * 
 * This file provides a centralized export for all E2E testing utilities,
 * fixtures, page objects, and helpers.
 */

import type { Page, Browser } from '@playwright/test';

// Test fixtures
export { test, expect } from './fixtures/auth';
export { test as gameTest } from './fixtures/game';
export type { AuthUser, AuthFixtures } from './fixtures/auth';
export type { GameLobby, GameSession, GameFixtures } from './fixtures/game';

// Page Object Models
export { AuthPage } from './page-objects/auth-page';
export { LobbyPage } from './page-objects/lobby-page';
export { GamePage } from './page-objects/game-page';

// Utilities
export { TestHelpers } from './utils/test-helpers';
export { TestDataGenerator } from './utils/data-generators';
export { TestDataManager } from './utils/test-data-manager';

// Types
export type { 
  UserData, 
  LobbyData, 
  QuestionData 
} from './utils/data-generators';

export type {
  TestSessionConfig,
  TestSession,
  TestDataSummary,
  DataIntegrityReport
} from './utils/test-data-manager';

export type {
  AccessibilityReport,
  PerformanceMetrics,
  MemoryInfo
} from './utils/test-helpers';

// Helper functions for common operations
export {
  loginUser,
  logoutUser,
  verifyAuthState
} from './fixtures/auth';

export {
  joinLobby,
  startGame,
  answerQuestion,
  waitForNextQuestion,
  getGameState,
  verifyGameResults
} from './fixtures/game';

/**
 * Quick setup functions for common test scenarios
 */
export const TestScenarios = {
  /**
   * Set up a single authenticated user
   */
  async singleUser(page: Page) {
    const { TestHelpers } = await import('./utils/test-helpers');
    return await TestHelpers.registerUser(page);
  },

  /**
   * Set up a multiplayer game lobby
   */
  async multiplayerLobby(browser: Browser, playerCount: number = 2) {
    const { TestDataManager } = await import('./utils/test-data-manager');
    const dataManager = TestDataManager.getInstance();
    
    return await dataManager.createTestSession(`multiplayer-${Date.now()}`, {
      browser,
      userCount: playerCount
    });
  },

  /**
   * Set up performance testing scenario
   */
  async performanceTest(page: Page) {
    const { TestHelpers } = await import('./utils/test-helpers');
    
    // Register user and measure performance
    const user = await TestHelpers.registerUser(page);
    const metrics = await TestHelpers.measurePageLoad(page);
    
    return { user, metrics };
  },

  /**
   * Set up accessibility testing scenario
   */
  async accessibilityTest(page: Page) {
    const { TestHelpers } = await import('./utils/test-helpers');
    
    // Navigate to main page and check accessibility
    await page.goto('/');
    const report = await TestHelpers.checkBasicAccessibility(page);
    
    return report;
  }
};

/**
 * Test configuration presets
 */
export const TestConfigs = {
  /**
   * Fast test configuration for development
   */
  fast: {
    timeout: 30000,
    retries: 1,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry'
  },

  /**
   * Comprehensive test configuration for CI
   */
  comprehensive: {
    timeout: 60000,
    retries: 3,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure'
  },

  /**
   * Performance test configuration
   */
  performance: {
    timeout: 90000,
    retries: 1,
    screenshot: 'off',
    video: 'off',
    trace: 'off'
  },

  /**
   * Accessibility test configuration
   */
  accessibility: {
    timeout: 45000,
    retries: 2,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'on-first-retry'
  }
};

/**
 * Common test data sets
 */
export const TestData = {
  /**
   * Valid user credentials for testing
   */
  validUsers: [
    {
      username: 'testuser1',
      email: 'test1@example.com',
      password: 'TestPassword123!'
    },
    {
      username: 'testuser2',
      email: 'test2@example.com',
      password: 'TestPassword123!'
    }
  ],

  /**
   * Invalid user credentials for negative testing
   */
  invalidUsers: [
    {
      username: '',
      email: 'invalid@example.com',
      password: 'TestPassword123!'
    },
    {
      username: 'testuser',
      email: 'invalid-email',
      password: 'TestPassword123!'
    },
    {
      username: 'testuser',
      email: 'test@example.com',
      password: 'weak'
    }
  ],

  /**
   * Lobby configurations for testing
   */
  lobbyConfigs: [
    {
      questionCount: 5,
      questionSet: 'general',
      isPrivate: false,
      maxPlayers: 4
    },
    {
      questionCount: 10,
      questionSet: 'science',
      isPrivate: true,
      maxPlayers: 2
    }
  ],

  /**
   * Error scenarios for testing
   */
  errorScenarios: [
    {
      type: 'network',
      description: 'Network connection failed',
      simulation: 'offline'
    },
    {
      type: 'server',
      description: 'Server error',
      simulation: '500'
    },
    {
      type: 'timeout',
      description: 'Request timeout',
      simulation: 'slow'
    }
  ]
};

/**
 * Utility functions for test setup and teardown
 */
export const TestUtils = {
  /**
   * Clean up all test data
   */
  async cleanup() {
    const { TestDataManager } = await import('./utils/test-data-manager');
    const dataManager = TestDataManager.getInstance();
    await dataManager.cleanupAll();
  },

  /**
   * Generate test report
   */
  async generateReport(testResults: any) {
    const timestamp = new Date().toISOString();
    const report = {
      timestamp,
      results: testResults,
      summary: {
        total: testResults.length,
        passed: testResults.filter((r: any) => r.status === 'passed').length,
        failed: testResults.filter((r: any) => r.status === 'failed').length,
        skipped: testResults.filter((r: any) => r.status === 'skipped').length
      }
    };

    return report;
  },

  /**
   * Wait for application to be ready
   */
  async waitForApp(page: any, timeout: number = 30000) {
    await page.waitForFunction(() => {
      const root = document.getElementById('root');
      return root && root.children.length > 0;
    }, { timeout });

    await page.waitForLoadState('networkidle');
  },

  /**
   * Take debug screenshot
   */
  async debugScreenshot(page: any, name: string) {
    const timestamp = Date.now();
    const path = `debug-${name}-${timestamp}.png`;
    await page.screenshot({ path, fullPage: true });
    return path;
  }
};