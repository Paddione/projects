import { Page, Locator, expect } from '@playwright/test';
import { UserData } from '../utils/data-generators';

/**
 * Page Object Model for authentication workflows
 */
export class AuthPage {
  readonly page: Page;
  
  // Locators
  readonly loginTab: Locator;
  readonly registerTab: Locator;
  readonly usernameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly loginButton: Locator;
  readonly registerButton: Locator;
  readonly forgotPasswordLink: Locator;
  readonly userMenu: Locator;
  readonly logoutButton: Locator;
  readonly characterSelector: Locator;
  readonly registrationError: Locator;
  readonly loginError: Locator;
  readonly registrationSuccess: Locator;

  constructor(page: Page) {
    this.page = page;
    
    // Initialize locators
    this.loginTab = page.locator('[data-testid="login-tab"]');
    this.registerTab = page.locator('[data-testid="register-tab"]');
    this.usernameInput = page.locator('[data-testid="username-input"]');
    this.emailInput = page.locator('[data-testid="email-input"]');
    this.passwordInput = page.locator('[data-testid="password-input"]');
    this.confirmPasswordInput = page.locator('[data-testid="confirm-password-input"]');
    this.loginButton = page.locator('[data-testid="login-button"]');
    this.registerButton = page.locator('[data-testid="register-button"]');
    this.forgotPasswordLink = page.locator('[data-testid="forgot-password-link"]');
    this.userMenu = page.locator('[data-testid="user-menu"]');
    this.logoutButton = page.locator('[data-testid="logout-button"]');
    this.characterSelector = page.locator('[data-testid="character-1"]');
    this.registrationError = page.locator('[data-testid="registration-error"]');
    this.loginError = page.locator('[data-testid="login-error"]');
    this.registrationSuccess = page.locator('[data-testid="registration-success"]');
  }

  /**
   * Navigate to the authentication page
   */
  async goto(): Promise<void> {
    await this.page.goto('/');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Switch to login tab
   */
  async switchToLogin(): Promise<void> {
    await this.loginTab.click();
    await expect(this.loginButton).toBeVisible();
  }

  /**
   * Switch to register tab
   */
  async switchToRegister(): Promise<void> {
    await this.registerTab.click();
    await expect(this.registerButton).toBeVisible();
  }

  /**
   * Fill login form
   */
  async fillLoginForm(username: string, password: string): Promise<void> {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
  }

  /**
   * Fill registration form
   */
  async fillRegistrationForm(user: UserData): Promise<void> {
    await this.usernameInput.fill(user.username);
    await this.emailInput.fill(user.email);
    await this.passwordInput.fill(user.password);
    await this.confirmPasswordInput.fill(user.password);
  }

  /**
   * Select character during registration
   */
  async selectCharacter(characterIndex: number = 1): Promise<void> {
    const characterSelector = this.page.locator(`[data-testid="character-${characterIndex}"]`);
    if (await characterSelector.isVisible()) {
      await characterSelector.click();
    }
  }

  /**
   * Submit login form
   */
  async submitLogin(): Promise<void> {
    await this.loginButton.click();
  }

  /**
   * Submit registration form
   */
  async submitRegistration(): Promise<void> {
    await this.registerButton.click();
  }

  /**
   * Complete login workflow
   */
  async login(username: string, password: string): Promise<void> {
    await this.goto();
    await this.switchToLogin();
    await this.fillLoginForm(username, password);
    await this.submitLogin();
    
    // Wait for login to complete
    await expect(this.userMenu).toBeVisible({ timeout: 10000 });
  }

  /**
   * Complete registration workflow
   */
  async register(user: UserData, characterIndex: number = 1): Promise<void> {
    await this.goto();
    await this.switchToRegister();
    await this.fillRegistrationForm(user);
    await this.selectCharacter(characterIndex);
    await this.submitRegistration();
    
    // Wait for registration to complete
    await this.page.waitForFunction(() => {
      const userMenu = document.querySelector('[data-testid="user-menu"]');
      const errorMessage = document.querySelector('[data-testid="registration-error"]');
      return userMenu || errorMessage;
    }, { timeout: 15000 });
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    await this.userMenu.click();
    await this.logoutButton.click();
    
    // Verify logout
    await expect(this.userMenu).not.toBeVisible();
    await expect(this.loginTab).toBeVisible();
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    return await this.userMenu.isVisible();
  }

  /**
   * Get authentication error message
   */
  async getErrorMessage(): Promise<string | null> {
    if (await this.loginError.isVisible()) {
      return await this.loginError.textContent();
    }
    if (await this.registrationError.isVisible()) {
      return await this.registrationError.textContent();
    }
    return null;
  }

  /**
   * Verify successful registration
   */
  async verifyRegistrationSuccess(): Promise<void> {
    await expect(this.registrationSuccess).toBeVisible();
    await expect(this.userMenu).toBeVisible();
  }

  /**
   * Verify login error
   */
  async verifyLoginError(expectedMessage?: string): Promise<void> {
    await expect(this.loginError).toBeVisible();
    if (expectedMessage) {
      await expect(this.loginError).toContainText(expectedMessage);
    }
  }

  /**
   * Verify registration error
   */
  async verifyRegistrationError(expectedMessage?: string): Promise<void> {
    await expect(this.registrationError).toBeVisible();
    if (expectedMessage) {
      await expect(this.registrationError).toContainText(expectedMessage);
    }
  }

  /**
   * Wait for authentication state change
   */
  async waitForAuthStateChange(timeout: number = 10000): Promise<void> {
    await this.page.waitForFunction(() => {
      const userMenu = document.querySelector('[data-testid="user-menu"]');
      const loginTab = document.querySelector('[data-testid="login-tab"]');
      return userMenu || loginTab;
    }, { timeout });
  }

  /**
   * Get current user info from UI
   */
  async getCurrentUserInfo(): Promise<{ username?: string; email?: string } | null> {
    if (!await this.isAuthenticated()) {
      return null;
    }

    try {
      await this.userMenu.click();
      
      const usernameElement = this.page.locator('[data-testid="username-display"]');
      const emailElement = this.page.locator('[data-testid="email-display"]');
      
      const username = await usernameElement.textContent();
      const email = await emailElement.textContent();
      
      return {
        username: username || undefined,
        email: email || undefined
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Verify form validation
   */
  async verifyFormValidation(field: 'username' | 'email' | 'password', expectedError: string): Promise<void> {
    const errorSelector = `[data-testid="${field}-error"]`;
    const errorElement = this.page.locator(errorSelector);
    
    await expect(errorElement).toBeVisible();
    await expect(errorElement).toContainText(expectedError);
  }

  /**
   * Check if form is submittable
   */
  async isFormSubmittable(formType: 'login' | 'register'): Promise<boolean> {
    const button = formType === 'login' ? this.loginButton : this.registerButton;
    return await button.isEnabled();
  }

  /**
   * Reset password workflow
   */
  async requestPasswordReset(email: string): Promise<void> {
    await this.forgotPasswordLink.click();
    await this.emailInput.fill(email);
    await this.page.locator('[data-testid="request-reset-button"]').click();
    
    // Verify success message
    await expect(this.page.locator('[data-testid="reset-request-success"]')).toBeVisible();
  }

  /**
   * Complete password reset
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    await this.page.goto('/reset-password');
    
    await this.page.locator('[data-testid="reset-token-input"]').fill(token);
    await this.page.locator('[data-testid="new-password-input"]').fill(newPassword);
    await this.page.locator('[data-testid="confirm-new-password-input"]').fill(newPassword);
    await this.page.locator('[data-testid="reset-password-button"]').click();
    
    // Verify success
    await expect(this.page.locator('[data-testid="reset-success"]')).toBeVisible();
  }

  /**
   * Verify email verification flow
   */
  async verifyEmail(token: string): Promise<void> {
    await this.page.goto('/verify-email');
    
    await this.page.locator('[data-testid="verification-token-input"]').fill(token);
    await this.page.locator('[data-testid="verify-button"]').click();
    
    // Verify success
    await expect(this.page.locator('[data-testid="verification-success"]')).toBeVisible();
    await expect(this.userMenu).toBeVisible();
  }

  /**
   * Test session persistence
   */
  async testSessionPersistence(): Promise<boolean> {
    const wasAuthenticated = await this.isAuthenticated();
    
    if (wasAuthenticated) {
      await this.page.reload();
      await this.page.waitForLoadState('networkidle');
      return await this.isAuthenticated();
    }
    
    return false;
  }
}