import { test as base, expect, Page, BrowserContext } from '@playwright/test';
import { TestDataGenerator } from '../utils/data-generators';

export interface AuthUser {
  username: string;
  email: string;
  password: string;
  character?: string;
  token?: string;
}

export interface AuthFixtures {
  authenticatedPage: Page;
  authenticatedContext: BrowserContext;
  testUser: AuthUser;
  adminUser: AuthUser;
  guestUser: AuthUser;
}

/**
 * Enhanced authentication fixtures with proper cleanup and data management
 */
export const test = base.extend<AuthFixtures>({
  /**
   * Creates a fresh authenticated user for each test
   */
  authenticatedPage: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      // Generate unique test user
      const testUser = TestDataGenerator.generateUser();
      
      // Navigate to app and register user
      await page.goto('/');
      await page.waitForLoadState('networkidle');
      
      // Register new user
      await registerUser(page, testUser);
      
      // Verify authentication
      await expect(page.locator('[data-testid="user-menu"]')).toBeVisible({ timeout: 10000 });
      
      // Store user data for cleanup
      await page.evaluate((user) => {
        window.testUserData = user;
      }, testUser);
      
      await use(page);
      
    } finally {
      // Cleanup: logout and clear data
      try {
        await page.evaluate(() => {
          localStorage.clear();
          sessionStorage.clear();
        });
      } catch (error) {
        console.warn('Failed to cleanup user data:', error);
      }
      
      await context.close();
    }
  },

  /**
   * Provides authenticated browser context
   */
  authenticatedContext: async ({ browser }, use) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    
    try {
      const testUser = TestDataGenerator.generateUser();
      
      await page.goto('/');
      await registerUser(page, testUser);
      
      // Save authentication state
      await context.storageState({ path: `auth-state-${Date.now()}.json` });
      
      await use(context);
      
    } finally {
      await context.close();
    }
  },

  /**
   * Provides test user data without authentication
   */
  testUser: async ({}, use) => {
    const user = TestDataGenerator.generateUser();
    await use(user);
  },

  /**
   * Provides admin user with elevated privileges
   */
  adminUser: async ({ page }, use) => {
    const adminUser = TestDataGenerator.generateUser({
      username: `admin_${Date.now()}`,
      email: `admin_${Date.now()}@example.com`,
      role: 'admin'
    });
    
    await use(adminUser);
  },

  /**
   * Provides guest user for limited access testing
   */
  guestUser: async ({}, use) => {
    const guestUser = TestDataGenerator.generateUser({
      username: `guest_${Date.now()}`,
      email: `guest_${Date.now()}@example.com`,
      role: 'guest'
    });
    
    await use(guestUser);
  }
});

/**
 * Register a new user with proper error handling and validation
 */
async function registerUser(page: Page, user: AuthUser): Promise<void> {
  try {
    // Navigate to registration
    await page.click('text=Register', { timeout: 5000 });
    
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
    }, { timeout: 15000 });
    
    // Check for registration errors
    const errorElement = page.locator('[data-testid="registration-error"]');
    if (await errorElement.isVisible()) {
      const errorText = await errorElement.textContent();
      throw new Error(`Registration failed: ${errorText}`);
    }
    
    // Verify successful authentication
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
    
  } catch (error) {
    console.error('Registration failed:', error);
    
    // Take screenshot for debugging
    await page.screenshot({ 
      path: `registration-error-${Date.now()}.png`,
      fullPage: true 
    });
    
    throw error;
  }
}

/**
 * Login with existing user credentials
 */
export async function loginUser(page: Page, user: AuthUser): Promise<void> {
  try {
    await page.goto('/');
    await page.click('text=Login');
    
    await page.fill('[data-testid="username-input"]', user.username);
    await page.fill('[data-testid="password-input"]', user.password);
    await page.click('[data-testid="login-button"]');
    
    // Wait for login to complete
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible({ timeout: 10000 });
    
  } catch (error) {
    console.error('Login failed:', error);
    await page.screenshot({ 
      path: `login-error-${Date.now()}.png`,
      fullPage: true 
    });
    throw error;
  }
}

/**
 * Logout current user
 */
export async function logoutUser(page: Page): Promise<void> {
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
 * Verify user authentication state
 */
export async function verifyAuthState(page: Page, shouldBeAuthenticated: boolean = true): Promise<void> {
  if (shouldBeAuthenticated) {
    await expect(page.locator('[data-testid="user-menu"]')).toBeVisible();
  } else {
    await expect(page.locator('[data-testid="user-menu"]')).not.toBeVisible();
    await expect(page.locator('text=Login')).toBeVisible();
  }
}

export { expect };