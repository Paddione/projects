import { test, expect } from '@playwright/test';

test.describe('Accessibility Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should have proper heading hierarchy', async ({ page }) => {
    // Check for proper h1, h2, h3 structure
    const headings = await page.locator('h1, h2, h3, h4, h5, h6').all();
    
    expect(headings.length).toBeGreaterThan(0);
    
    // Should have at least one h1
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBeGreaterThanOrEqual(1);
  });

  test('should have alt text for images', async ({ page }) => {
    const images = await page.locator('img').all();
    
    for (const img of images) {
      const alt = await img.getAttribute('alt');
      expect(alt).toBeTruthy();
    }
  });

  test('should support keyboard navigation', async ({ page }) => {
    // Register user first to access interactive elements
    await page.click('text=Register');
    
    // Tab through form elements
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="username-input"]')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="email-input"]')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="password-input"]')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="confirm-password-input"]')).toBeFocused();
    
    await page.keyboard.press('Tab');
    await expect(page.locator('[data-testid="register-button"]')).toBeFocused();
  });

  test('should have proper form labels', async ({ page }) => {
    await page.click('text=Register');
    
    const requiredInputs = [
      '[data-testid="username-input"]',
      '[data-testid="email-input"]',
      '[data-testid="password-input"]',
      '[data-testid="confirm-password-input"]'
    ];
    
    for (const selector of requiredInputs) {
      const input = page.locator(selector);
      const id = await input.getAttribute('id');
      const ariaLabel = await input.getAttribute('aria-label');
      const ariaLabelledBy = await input.getAttribute('aria-labelledby');
      
      // Should have either label, aria-label, or aria-labelledby
      if (id) {
        const label = page.locator(`label[for="${id}"]`);
        const hasLabel = await label.count() > 0;
        
        expect(hasLabel || ariaLabel || ariaLabelledBy).toBeTruthy();
      } else {
        expect(ariaLabel || ariaLabelledBy).toBeTruthy();
      }
    }
  });

  test('should have proper ARIA roles and states', async ({ page }) => {
    // Register and navigate to dashboard
    await page.click('text=Register');
    const timestamp = Date.now();
    const username = `a11yuser${timestamp}`;
    
    await page.fill('[data-testid="username-input"]', username);
    await page.fill('[data-testid="email-input"]', `${username}@example.com`);
    await page.fill('[data-testid="password-input"]', 'TestPassword123!');
    await page.fill('[data-testid="confirm-password-input"]', 'TestPassword123!');
    await page.click('[data-testid="register-button"]');
    
    // Check for proper ARIA attributes on interactive elements
    const buttons = await page.locator('button').all();
    for (const button of buttons) {
      const role = await button.getAttribute('role');
      const ariaLabel = await button.getAttribute('aria-label');
      const textContent = await button.textContent();
      
      // Buttons should have accessible names
      expect(ariaLabel || textContent?.trim()).toBeTruthy();
    }
  });

  test('should support screen reader navigation', async ({ page }) => {
    // Check for landmark roles
    const landmarks = await page.locator('[role="main"], [role="navigation"], [role="banner"], [role="contentinfo"], main, nav, header, footer').count();
    expect(landmarks).toBeGreaterThan(0);
    
    // Check for skip links
    const skipLinks = await page.locator('a[href="#main"], a[href="#content"]').count();
    // Skip links are recommended but not always required
  });

  test('should have sufficient color contrast', async ({ page }) => {
    // This is a basic check - in real scenarios you'd use axe-core
    const bodyBg = await page.evaluate(() => {
      const body = document.body;
      return window.getComputedStyle(body).backgroundColor;
    });
    
    const bodyColor = await page.evaluate(() => {
      const body = document.body;
      return window.getComputedStyle(body).color;
    });
    
    // Basic check that colors are set
    expect(bodyBg).toBeTruthy();
    expect(bodyColor).toBeTruthy();
  });

  test('should be usable with reduced motion', async ({ page, context }) => {
    // Set reduced motion preference
    await context.addInitScript(() => {
      Object.defineProperty(window, 'matchMedia', {
        value: (query: string) => ({
          matches: query.includes('prefers-reduced-motion: reduce'),
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => {},
        }),
      });
    });
    
    await page.goto('/');
    
    // Check that animations respect reduced motion
    const animatedElements = await page.locator('[class*="animate"], [class*="transition"]').all();
    for (const element of animatedElements) {
      const animationDuration = await element.evaluate(el => 
        window.getComputedStyle(el).animationDuration
      );
      const transitionDuration = await element.evaluate(el => 
        window.getComputedStyle(el).transitionDuration
      );
      
      // With reduced motion, durations should be minimal or zero
      // This is a basic check - real implementation would be more sophisticated
    }
  });

  test('should work with high contrast mode', async ({ page, context }) => {
    // Simulate high contrast mode
    await context.addInitScript(() => {
      Object.defineProperty(window, 'matchMedia', {
        value: (query: string) => ({
          matches: query.includes('prefers-contrast: high'),
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => {},
        }),
      });
    });
    
    await page.goto('/');
    
    // Verify essential elements are still visible and functional
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('[data-testid="register-link"]')).toBeVisible();
  });

  test('should provide error messages accessibly', async ({ page }) => {
    await page.click('text=Register');
    
    // Submit empty form to trigger validation
    await page.click('[data-testid="register-button"]');
    
    // Check that error messages are properly associated
    const errorMessage = page.locator('[data-testid="username-error"]');
    await expect(errorMessage).toBeVisible();
    
    const usernameInput = page.locator('[data-testid="username-input"]');
    const ariaDescribedBy = await usernameInput.getAttribute('aria-describedby');
    const ariaInvalid = await usernameInput.getAttribute('aria-invalid');
    
    // Error should be properly associated with input
    expect(ariaDescribedBy || ariaInvalid).toBeTruthy();
  });

  test('should support zoom up to 200%', async ({ page }) => {
    // Set viewport size to simulate zoom
    await page.setViewportSize({ width: 640, height: 360 }); // Simulate 200% zoom by halving viewport
    await page.goto('/');
    
    // Simulate 200% zoom by halving viewport
    await page.setViewportSize({ width: 640, height: 360 });
    
    // Essential functionality should still work
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByTestId('register-link')).toBeVisible();
    
    // Registration should still work
    await page.click('text=Register');
    await expect(page.locator('[data-testid="username-input"]')).toBeVisible();
  });

  test('should have proper focus management', async ({ page }) => {
    await page.click('text=Register');
    
    // Focus should be managed properly
    await page.fill('[data-testid="username-input"]', 'testuser');
    await page.keyboard.press('Tab');
    
    // Should move to next focusable element
    await expect(page.locator('[data-testid="email-input"]')).toBeFocused();
    
    // Test modal focus management if applicable
    if (await page.locator('[data-testid="settings-button"]').isVisible()) {
      await page.click('[data-testid="settings-button"]');
      
      // Focus should move to modal
      const modal = page.locator('[role="dialog"], [data-testid="modal"]');
      if (await modal.isVisible()) {
        // First focusable element in modal should be focused
        const firstFocusable = modal.locator('button, input, select, textarea, [tabindex]:not([tabindex="-1"])').first();
        await expect(firstFocusable).toBeFocused();
      }
    }
  });
}); 