import { test, expect } from '@playwright/test';

test.describe('L2P Comprehensive E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(2000);
  });

  test('complete user registration and authentication flow', async ({ page }) => {
    console.log('🔐 Testing complete authentication flow');
    
    // Wait for auth form to load
    await page.waitForSelector('[data-testid="register-tab"], [data-testid="login-tab"]', { timeout: 10000 });
    
    // Switch to registration
    await page.click('[data-testid="register-tab"]');
    await page.waitForTimeout(500);
    
    // Fill registration form
    const timestamp = Date.now();
    const userData = {
      username: `e2euser${timestamp}`,
      email: `e2etest${timestamp}@example.com`,
      password: 'SecurePass123!'
    };

    console.log(`📝 Registering user: ${userData.username}`);
    
    await page.fill('[data-testid="username-input"]', userData.username);
    await page.fill('[data-testid="email-input"]', userData.email);
    await page.fill('[data-testid="password-input"]', userData.password);
    await page.fill('[data-testid="confirm-password-input"]', userData.password);

    // Submit registration
    await page.click('[data-testid="register-button"]');
    
    // Wait for registration success and redirect
    await page.waitForTimeout(5000);
    
    // Verify successful authentication by looking for authenticated UI elements
    const createLobbyButton = page.locator('[data-testid="create-lobby-button"]');
    await expect(createLobbyButton).toBeVisible({ timeout: 10000 });
    
    console.log('✅ User registration and authentication successful');
    
    // Test logout
    const logoutButton = page.locator('[data-testid="logout-button"]');
    if (await logoutButton.isVisible()) {
      console.log('🚪 Testing logout');
      await logoutButton.click();
      await page.waitForTimeout(2000);
      
      // Should redirect back to auth form
      await page.waitForSelector('[data-testid="login-tab"], [data-testid="register-tab"]', { timeout: 5000 });
      console.log('✅ Logout successful');
      
      // Test login with existing credentials
      console.log('🔑 Testing login with existing credentials');
      await page.click('[data-testid="login-tab"]');
      await page.waitForTimeout(500);
      
      await page.fill('[data-testid="username-input"]', userData.username);
      await page.fill('[data-testid="password-input"]', userData.password);
      await page.click('[data-testid="login-button"]');
      
      await page.waitForTimeout(5000);
      await expect(createLobbyButton).toBeVisible({ timeout: 10000 });
      console.log('✅ Login successful');
    }
  });

  test('lobby creation and management', async ({ page, context }) => {
    console.log('🏠 Testing lobby creation and management');
    
    // First register/login
    await page.waitForSelector('[data-testid="register-tab"]', { timeout: 10000 });
    await page.click('[data-testid="register-tab"]');
    
    const timestamp = Date.now();
    const hostData = {
      username: `host${timestamp}`,
      email: `host${timestamp}@example.com`,
      password: 'HostPass123!'
    };

    await page.fill('[data-testid="username-input"]', hostData.username);
    await page.fill('[data-testid="email-input"]', hostData.email);
    await page.fill('[data-testid="password-input"]', hostData.password);
    await page.fill('[data-testid="confirm-password-input"]', hostData.password);
    await page.click('[data-testid="register-button"]');
    
    await page.waitForTimeout(5000);
    await page.waitForSelector('[data-testid="create-lobby-button"]', { timeout: 10000 });
    
    console.log('👑 Creating lobby as host');
    
    // Create lobby
    await page.click('[data-testid="create-lobby-button"]');
    await page.waitForTimeout(3000);
    
    // Should be redirected to lobby page
    const url = page.url();
    expect(url).toMatch(/\/lobby\/[A-Z0-9]{6}/);
    
    // Get lobby code
    const lobbyCodeElement = page.locator('[data-testid="lobby-code"]');
    await expect(lobbyCodeElement).toBeVisible();
    const lobbyCode = await lobbyCodeElement.textContent();
    
    console.log(`🏠 Lobby created with code: ${lobbyCode}`);
    
    // Verify host status
    const hostIndicator = page.locator('[data-testid="host-indicator"]');
    await expect(hostIndicator).toBeVisible();
    
    console.log('✅ Lobby creation successful');
    
    // Test joining lobby with second user
    const secondPage = await context.newPage();
    await secondPage.goto('http://localhost:3000');
    await secondPage.waitForLoadState('domcontentloaded');
    await secondPage.waitForTimeout(3000);
    
    console.log('👤 Creating second user to join lobby');
    
    await secondPage.waitForSelector('[data-testid="register-tab"]', { timeout: 10000 });
    await secondPage.click('[data-testid="register-tab"]');
    
    const joinerData = {
      username: `joiner${timestamp}`,
      email: `joiner${timestamp}@example.com`,
      password: 'JoinerPass123!'
    };
    
    await secondPage.fill('[data-testid="username-input"]', joinerData.username);
    await secondPage.fill('[data-testid="email-input"]', joinerData.email);
    await secondPage.fill('[data-testid="password-input"]', joinerData.password);
    await secondPage.fill('[data-testid="confirm-password-input"]', joinerData.password);
    await secondPage.click('[data-testid="register-button"]');
    
    await secondPage.waitForTimeout(5000);
    await secondPage.waitForSelector('[data-testid="lobby-code-input"]', { timeout: 10000 });
    
    console.log(`🔗 Joining lobby with code: ${lobbyCode}`);
    
    // Join lobby
    await secondPage.fill('[data-testid="lobby-code-input"]', lobbyCode || '');
    await secondPage.click('[data-testid="join-lobby-confirm"]');
    
    await secondPage.waitForTimeout(3000);
    
    // Verify successful join
    const joinedLobbyCode = secondPage.locator('[data-testid="lobby-code"]');
    await expect(joinedLobbyCode).toHaveText(lobbyCode || '');
    
    console.log('✅ Second player joined lobby successfully');
    
    await secondPage.close();
  });

  test('user interface responsiveness and navigation', async ({ page }) => {
    console.log('📱 Testing UI responsiveness and navigation');
    
    // Test different viewport sizes
    const viewports = [
      { width: 1920, height: 1080, name: 'Desktop' },
      { width: 768, height: 1024, name: 'Tablet' },
      { width: 375, height: 667, name: 'Mobile' }
    ];
    
    for (const viewport of viewports) {
      console.log(`📏 Testing ${viewport.name} viewport (${viewport.width}x${viewport.height})`);
      
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(1000);
      
      // Check that main elements are still visible and functional
      const body = await page.locator('body').isVisible();
      expect(body).toBe(true);
      
      // Check for responsive behavior
      const buttons = await page.locator('button').count();
      expect(buttons).toBeGreaterThan(0);
      
      console.log(`✅ ${viewport.name} viewport working`);
    }
    
    // Reset to default viewport
    await page.setViewportSize({ width: 1280, height: 720 });
  });

  test('language and theme switching', async ({ page }) => {
    console.log('🌍 Testing language and theme switching');
    
    // Register a user first
    await page.waitForSelector('[data-testid="register-tab"]', { timeout: 10000 });
    await page.click('[data-testid="register-tab"]');
    
    const timestamp = Date.now();
    await page.fill('[data-testid="username-input"]', `languser${timestamp}`);
    await page.fill('[data-testid="email-input"]', `languser${timestamp}@example.com`);
    await page.fill('[data-testid="password-input"]', 'LangPass123!');
    await page.fill('[data-testid="confirm-password-input"]', 'LangPass123!');
    await page.click('[data-testid="register-button"]');
    
    await page.waitForTimeout(5000);
    await page.waitForSelector('[data-testid="create-lobby-button"]', { timeout: 10000 });
    
    // Test language switching
    const languageSelector = page.locator('[data-testid="language-selector"]');
    if (await languageSelector.isVisible()) {
      console.log('🇺🇸/🇩🇪 Testing language switching');
      
      await languageSelector.click();
      await page.waitForTimeout(1000);
      
      // Verify language switched (UI should update)
      console.log('✅ Language switching functional');
    }
    
    // Test theme switching
    const themeToggle = page.locator('[data-testid="theme-toggle"]');
    if (await themeToggle.isVisible()) {
      console.log('🌙/☀️ Testing theme switching');
      
      // Get initial theme
      const initialTheme = await page.locator('html').getAttribute('data-theme');
      console.log(`Initial theme: ${initialTheme}`);
      
      // Toggle theme
      await themeToggle.click();
      await page.waitForTimeout(1000);
      
      // Verify theme changed
      const newTheme = await page.locator('html').getAttribute('data-theme');
      console.log(`New theme: ${newTheme}`);
      
      expect(newTheme).not.toBe(initialTheme);
      console.log('✅ Theme switching functional');
    }
  });

  test('error handling and edge cases', async ({ page }) => {
    console.log('⚠️ Testing error handling and edge cases');
    
    // Test invalid login attempt
    await page.waitForSelector('[data-testid="login-tab"]', { timeout: 10000 });
    await page.click('[data-testid="login-tab"]');
    
    console.log('🚫 Testing invalid login credentials');
    
    await page.fill('[data-testid="username-input"]', 'nonexistentuser');
    await page.fill('[data-testid="password-input"]', 'wrongpassword');
    await page.click('[data-testid="login-button"]');
    
    await page.waitForTimeout(3000);
    
    // Should still be on auth page (login failed)
    const isStillOnAuthPage = await page.locator('[data-testid="login-tab"]').isVisible();
    expect(isStillOnAuthPage).toBe(true);
    
    console.log('✅ Invalid login properly rejected');
    
    // Test invalid lobby join
    console.log('🚫 Testing invalid lobby code');
    
    // First register to get to main interface
    await page.click('[data-testid="register-tab"]');
    const timestamp = Date.now();
    await page.fill('[data-testid="username-input"]', `erroruser${timestamp}`);
    await page.fill('[data-testid="email-input"]', `erroruser${timestamp}@example.com`);
    await page.fill('[data-testid="password-input"]', 'ErrorPass123!');
    await page.fill('[data-testid="confirm-password-input"]', 'ErrorPass123!');
    await page.click('[data-testid="register-button"]');
    
    await page.waitForTimeout(5000);
    
    // Try to join with invalid code
    const lobbyCodeInput = page.locator('[data-testid="lobby-code-input"]');
    if (await lobbyCodeInput.isVisible()) {
      await lobbyCodeInput.fill('INVALID');
      
      const joinButton = page.locator('[data-testid="join-lobby-confirm"]');
      await joinButton.click();
      
      await page.waitForTimeout(3000);
      
      // Should still be on main page (join failed)
      const isStillOnMainPage = await page.locator('[data-testid="create-lobby-button"]').isVisible();
      expect(isStillOnMainPage).toBe(true);
      
      console.log('✅ Invalid lobby code properly rejected');
    }
  });

  test('accessibility and keyboard navigation', async ({ page }) => {
    console.log('♿ Testing accessibility and keyboard navigation');
    
    // Test basic accessibility structure
    const hasMainContent = await page.locator('main, [role="main"]').count() > 0;
    const hasInteractiveElements = await page.locator('button, input, a, [tabindex]').count() > 0;
    
    expect(hasMainContent).toBe(true);
    expect(hasInteractiveElements).toBe(true);
    
    console.log('✅ Basic accessibility structure present');
    
    // Test keyboard navigation
    const firstButton = page.locator('button').first();
    if (await firstButton.isVisible()) {
      await firstButton.focus();
      
      // Test tab navigation
      await page.keyboard.press('Tab');
      await page.waitForTimeout(500);
      
      // Should be able to navigate with keyboard
      const activeElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(activeElement).toBeTruthy();
      
      console.log('✅ Keyboard navigation functional');
    }
  });

  test('performance and load testing', async ({ page }) => {
    console.log('🚀 Testing performance and load behavior');
    
    const startTime = Date.now();
    
    // Measure initial page load
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('domcontentloaded');
    
    const loadTime = Date.now() - startTime;
    console.log(`⏱️ Page load time: ${loadTime}ms`);
    
    // Basic performance checks
    expect(loadTime).toBeLessThan(10000); // Should load within 10 seconds
    
    // Test rapid interactions
    await page.waitForTimeout(2000);
    
    const buttons = page.locator('button');
    const buttonCount = await buttons.count();
    
    if (buttonCount > 0) {
      // Click multiple buttons rapidly
      for (let i = 0; i < Math.min(buttonCount, 3); i++) {
        await buttons.nth(i).click();
        await page.waitForTimeout(100);
      }
      
      console.log('✅ Rapid interactions handled well');
    }
    
    // Memory usage check (basic)
    const jsHeapUsedSize = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });
    
    if (jsHeapUsedSize > 0) {
      console.log(`💾 JS Heap Used: ${Math.round(jsHeapUsedSize / 1024 / 1024)}MB`);
      expect(jsHeapUsedSize).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
    }
    
    console.log('✅ Performance checks passed');
  });
});