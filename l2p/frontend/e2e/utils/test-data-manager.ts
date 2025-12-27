import { Page, BrowserContext } from '@playwright/test';
import { TestDataGenerator, UserData, LobbyData } from './data-generators';
import { Browser } from '@playwright/test';

/**
 * Manages test data lifecycle including creation, tracking, and cleanup
 */
export class TestDataManager {
  private static instance: TestDataManager;
  private createdUsers: Set<string> = new Set();
  private createdLobbies: Set<string> = new Set();
  private createdFiles: Set<string> = new Set();
  private testSessions: Map<string, TestSession> = new Map();

  private constructor() {}

  static getInstance(): TestDataManager {
    if (!TestDataManager.instance) {
      TestDataManager.instance = new TestDataManager();
    }
    return TestDataManager.instance;
  }

  /**
   * Create and track a test user
   */
  async createUser(page: Page, userData?: Partial<UserData>): Promise<UserData> {
    const user = TestDataGenerator.generateUser(userData);
    
    try {
      await this.registerUser(page, user);
      this.createdUsers.add(user.username);
      
      // Store user data for cleanup
      await page.evaluate((userData) => {
        if (!window.testData) window.testData = {};
        if (!window.testData.users) window.testData.users = [];
        window.testData.users.push(userData);
      }, user);
      
      return user;
    } catch (error) {
      console.error('Failed to create user:', error);
      throw error;
    }
  }

  /**
   * Create and track a test lobby
   */
  async createLobby(page: Page, lobbyData?: Partial<LobbyData>): Promise<string> {
    const lobby = TestDataGenerator.generateLobby(lobbyData);
    
    try {
      await page.click('[data-testid="create-lobby-button"]');
      await page.selectOption('[data-testid="question-count-select"]', lobby.questionCount.toString());
      await page.selectOption('[data-testid="question-set-select"]', lobby.questionSet);
      
      if (lobby.isPrivate) {
        await page.check('[data-testid="private-lobby-checkbox"]');
      }
      
      await page.click('[data-testid="confirm-create-lobby"]');
      
      // Get lobby code
      const lobbyCodeElement = page.locator('[data-testid="lobby-code"]');
      const lobbyCode = await lobbyCodeElement.textContent();
      
      if (!lobbyCode) {
        throw new Error('Failed to get lobby code');
      }
      
      this.createdLobbies.add(lobbyCode.trim());
      
      // Store lobby data for cleanup
      await page.evaluate((lobbyInfo) => {
        if (!window.testData) window.testData = {};
        if (!window.testData.lobbies) window.testData.lobbies = [];
        window.testData.lobbies.push(lobbyInfo);
      }, { code: lobbyCode.trim(), ...lobby });
      
      return lobbyCode.trim();
    } catch (error) {
      console.error('Failed to create lobby:', error);
      throw error;
    }
  }

  /**
   * Upload and track a test file
   */
  async uploadFile(page: Page, filePath: string, inputSelector: string = '[data-testid="file-input"]'): Promise<void> {
    try {
      await page.setInputFiles(inputSelector, filePath);
      this.createdFiles.add(filePath);
      
      // Wait for upload to complete
      await page.waitForSelector('[data-testid="upload-success"]', { timeout: 10000 });
      
    } catch (error) {
      console.error('Failed to upload file:', error);
      throw error;
    }
  }

  /**
   * Create a test session with multiple users and data
   */
  async createTestSession(sessionId: string, config: TestSessionConfig): Promise<TestSession> {
    const session: TestSession = {
      id: sessionId,
      users: [],
      lobbies: [],
      files: [],
      startTime: new Date(),
      config
    };

    // Create users if specified
    if (config.userCount > 0) {
      for (let i = 0; i < config.userCount; i++) {
        const context = await config.browser.newContext();
        const page = await context.newPage();
        
        const user = await this.createUser(page, config.userTemplate);
        session.users.push({ user, page, context });
      }
    }

    this.testSessions.set(sessionId, session);
    return session;
  }

  /**
   * Clean up all test data for a specific session
   */
  async cleanupSession(sessionId: string): Promise<void> {
    const session = this.testSessions.get(sessionId);
    if (!session) return;

    try {
      // Close all browser contexts
      for (const { context } of session.users) {
        await context.close();
      }

      // Clean up server-side data if needed
      await this.cleanupServerData(session);

      this.testSessions.delete(sessionId);
      console.log(`✅ Cleaned up test session: ${sessionId}`);
      
    } catch (error) {
      console.error(`Failed to cleanup session ${sessionId}:`, error);
    }
  }

  /**
   * Clean up all test data
   */
  async cleanupAll(): Promise<void> {
    try {
      // Cleanup all active sessions
      for (const sessionId of Array.from(this.testSessions.keys())) {
        await this.cleanupSession(sessionId);
      }

      // Clear tracking sets
      this.createdUsers.clear();
      this.createdLobbies.clear();
      this.createdFiles.clear();

      console.log('✅ All test data cleaned up');
      
    } catch (error) {
      console.error('Failed to cleanup all test data:', error);
    }
  }

  /**
   * Get test data summary
   */
  getDataSummary(): TestDataSummary {
    return {
      users: this.createdUsers.size,
      lobbies: this.createdLobbies.size,
      files: this.createdFiles.size,
      sessions: this.testSessions.size,
      activeSessions: Array.from(this.testSessions.keys())
    };
  }

  /**
   * Verify test data integrity
   */
  async verifyDataIntegrity(page: Page): Promise<DataIntegrityReport> {
    const report: DataIntegrityReport = {
      valid: true,
      issues: [],
      timestamp: new Date()
    };

    try {
      // Check if test data exists in browser
      const browserData = await page.evaluate(() => window.testData);
      
      if (!browserData) {
        report.issues.push('No test data found in browser');
        report.valid = false;
      }

      // Verify user data consistency
      if (browserData?.users) {
        for (const user of browserData.users) {
          if (!user.username || !user.email) {
            report.issues.push(`Invalid user data: ${JSON.stringify(user)}`);
            report.valid = false;
          }
        }
      }

      // Verify lobby data consistency
      if (browserData?.lobbies) {
        for (const lobby of browserData.lobbies) {
          if (!lobby.code || lobby.code.length !== 6) {
            report.issues.push(`Invalid lobby code: ${lobby.code}`);
            report.valid = false;
          }
        }
      }

    } catch (error) {
      report.issues.push(`Data integrity check failed: ${error}`);
      report.valid = false;
    }

    return report;
  }

  /**
   * Export test data for debugging
   */
  async exportTestData(page: Page, filePath: string): Promise<void> {
    try {
      const testData = await page.evaluate(() => window.testData);
      const exportData = {
        timestamp: new Date().toISOString(),
        summary: this.getDataSummary(),
        browserData: testData,
        sessions: Array.from(this.testSessions.entries()).map(([id, session]) => ({
          id,
          userCount: session.users.length,
          lobbyCount: session.lobbies.length,
          startTime: session.startTime,
          config: session.config
        }))
      };

      const fs = require('fs');
      fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));
      console.log(`📊 Test data exported to: ${filePath}`);
      
    } catch (error) {
      console.error('Failed to export test data:', error);
    }
  }

  /**
   * Register a user with error handling
   */
  private async registerUser(page: Page, user: UserData): Promise<void> {
    await page.goto('/');
    await page.click('text=Register');
    
    await page.fill('[data-testid="username-input"]', user.username);
    await page.fill('[data-testid="email-input"]', user.email);
    await page.fill('[data-testid="password-input"]', user.password);
    await page.fill('[data-testid="confirm-password-input"]', user.password);
    
    if (await page.locator('[data-testid="character-1"]').isVisible()) {
      await page.click('[data-testid="character-1"]');
    }
    
    await page.click('[data-testid="register-button"]');
    
    // Wait for registration to complete
    await page.waitForFunction(() => {
      const userMenu = document.querySelector('[data-testid="user-menu"]');
      const errorMessage = document.querySelector('[data-testid="registration-error"]');
      return userMenu || errorMessage;
    }, { timeout: 15000 });
    
    // Check for errors
    const errorElement = page.locator('[data-testid="registration-error"]');
    if (await errorElement.isVisible()) {
      const errorText = await errorElement.textContent();
      throw new Error(`Registration failed: ${errorText}`);
    }
  }

  /**
   * Clean up server-side data
   */
  private async cleanupServerData(session: TestSession): Promise<void> {
    // This would typically make API calls to clean up server-side data
    // For now, we'll just log the cleanup
    console.log(`🧹 Cleaning up server data for session: ${session.id}`);
    
    // Example cleanup operations:
    // - Delete test users from database
    // - Remove test lobbies
    // - Clean up uploaded files
    // - Clear test game sessions
  }
}

// Type definitions
export interface TestSessionConfig {
  browser: Browser;
  userCount: number;
  userTemplate?: Partial<UserData>;
  createLobbies?: boolean;
  lobbyCount?: number;
}

export interface TestSession {
  id: string;
  users: Array<{
    user: UserData;
    page: Page;
    context: BrowserContext;
  }>;
  lobbies: string[];
  files: string[];
  startTime: Date;
  config: TestSessionConfig;
}

export interface TestDataSummary {
  users: number;
  lobbies: number;
  files: number;
  sessions: number;
  activeSessions: string[];
}

export interface DataIntegrityReport {
  valid: boolean;
  issues: string[];
  timestamp: Date;
}

// Extend window interface for test data
declare global {
  interface Window {
    testData?: {
      users?: UserData[];
      lobbies?: Array<{ code: string; [key: string]: unknown }>;
      files?: string[];
    };
    testUserData?: UserData;
  }
}