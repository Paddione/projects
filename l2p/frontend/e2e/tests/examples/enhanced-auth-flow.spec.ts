import { test, expect, AuthPage, TestHelpers, TestDataGenerator } from '../../index';

/**
 * Enhanced authentication flow tests demonstrating new fixtures and helpers
 */
test.describe('Enhanced Authentication Flow', () => {
  let authPage: AuthPage;

  test.beforeEach(async ({ page }) => {
    authPage = new AuthPage(page);
    await authPage.goto();
  });

  test('should register user with enhanced fixtures', async ({ page }) => {
    // Generate test user data
    const userData = TestDataGenerator.generateUser({
      username: 'enhanced_test_user',
      email: 'enhanced@example.com'
    });

    // Use page object model for registration
    await authPage.register(userData);

    // Verify registration success
    await authPage.verifyRegistrationSuccess();
    
    // Verify user is authenticated
    expect(await authPage.isAuthenticated()).toBe(true);

    // Take screenshot for documentation
    await TestHelpers.takeScreenshot(page, 'registration-success');
  });

  test('should handle registration errors gracefully', async ({ page }) => {
    // Test with invalid email
    const invalidUser = TestDataGenerator.generateUser({
      email: 'invalid-email-format'
    });

    await authPage.switchToRegister();
    await authPage.fillRegistrationForm(invalidUser);
    await authPage.submitRegistration();

    // Verify error handling
    await authPage.verifyFormValidation('email', 'Please enter a valid email address');
    expect(await authPage.isFormSubmittable('register')).toBe(false);
  });

  test('should login with existing user', async ({ testUser, page }) => {
    // First register the user
    await TestHelpers.registerUser(page, testUser);
    await TestHelpers.logoutUser(page);

    // Now test login
    await authPage.login(testUser.username, testUser.password);
    
    // Verify login success
    expect(await authPage.isAuthenticated()).toBe(true);
    
    // Verify user info is displayed
    const userInfo = await authPage.getCurrentUserInfo();
    expect(userInfo?.username).toBe(testUser.username);
  });

  test('should handle network errors during authentication', async ({ page }) => {
    const userData = TestDataGenerator.generateUser();

    // Simulate network error
    await TestHelpers.simulateNetworkError(page, '**/api/auth/**');

    await authPage.switchToRegister();
    await authPage.fillRegistrationForm(userData);
    await authPage.submitRegistration();

    // Verify error handling
    const errorMessage = await authPage.getErrorMessage();
    expect(errorMessage).toContain('Network error');
  });

  test('should test session persistence', async ({ authenticatedPage }) => {
    const authPageWithSession = new AuthPage(authenticatedPage);
    
    // Verify user is authenticated
    expect(await authPageWithSession.isAuthenticated()).toBe(true);
    
    // Test session persistence
    const sessionPersists = await authPageWithSession.testSessionPersistence();
    expect(sessionPersists).toBe(true);
  });

  test('should measure authentication performance', async ({ page }) => {
    const userData = TestDataGenerator.generateUser();

    // Measure registration performance
    const startTime = Date.now();
    await TestHelpers.registerUser(page, userData, { takeScreenshot: false });
    const registrationTime = Date.now() - startTime;

    // Verify performance is acceptable (under 5 seconds)
    expect(registrationTime).toBeLessThan(5000);

    // Measure page load performance
    const metrics = await TestHelpers.measurePageLoad(page);
    expect(metrics.loadTime).toBeLessThan(3000);
    expect(metrics.firstContentfulPaint).toBeLessThan(2000);
  });

  test('should test accessibility features', async ({ page }) => {
    // Check basic accessibility
    const accessibilityReport = await TestHelpers.checkBasicAccessibility(page);
    
    if (!accessibilityReport.passed) {
      console.warn('Accessibility issues found:', accessibilityReport.issues);
    }

    // Test keyboard navigation
    const keyboardNavWorks = await TestHelpers.testKeyboardNavigation(page);
    expect(keyboardNavWorks).toBe(true);

    // Verify form labels
    await authPage.switchToRegister();
    
    // Check that form inputs have proper labels
    const usernameInput = authPage.usernameInput;
    const usernameLabel = await usernameInput.getAttribute('aria-label');
    expect(usernameLabel).toBeTruthy();
  });

  test('should handle multiple authentication attempts', async ({ page }) => {
    const userData = TestDataGenerator.generateUser();

    // First registration should succeed
    await TestHelpers.registerUser(page, userData);
    await TestHelpers.logoutUser(page);

    // Second registration with same username should fail
    await authPage.switchToRegister();
    await authPage.fillRegistrationForm(userData);
    await authPage.submitRegistration();

    await authPage.verifyRegistrationError('Username already exists');
  });

  test('should cleanup test data properly', async ({ page }) => {
    const userData = TestDataGenerator.generateUser();
    
    // Create test data
    await TestHelpers.registerUser(page, userData);
    
    // Verify data exists
    const hasDataBefore = !(await TestHelpers.verifyCleanup(page));
    expect(hasDataBefore).toBe(true);
    
    // Cleanup test data
    await TestHelpers.cleanupTestData(page);
    
    // Verify cleanup
    const hasDataAfter = !(await TestHelpers.verifyCleanup(page));
    expect(hasDataAfter).toBe(false);
  });

  test('should retry failed operations', async ({ page }) => {
    const userData = TestDataGenerator.generateUser();

    // Use retry helper for flaky operations
    const result = await TestHelpers.retryOperation(async () => {
      await TestHelpers.registerUser(page, userData);
      return await authPage.isAuthenticated();
    }, 3, 1000);

    expect(result).toBe(true);
  });

  test('should generate comprehensive test data', async ({ page }) => {
    // Generate multiple users for testing
    const users = TestDataGenerator.generateUsers(3);
    expect(users).toHaveLength(3);
    expect(users[0].username).not.toBe(users[1].username);

    // Generate scenario-specific data
    const scenarioData = TestDataGenerator.generateScenarioData('multiplayer-game');
    expect(scenarioData.players).toHaveLength(4);
    expect(scenarioData.lobby).toBeDefined();
    expect(scenarioData.questions).toHaveLength(10);
  });
});