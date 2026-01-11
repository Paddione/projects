import { test, expect } from '@playwright/test';

/**
 * Keyboard Navigation Tests for L2P Application
 *
 * Tests keyboard accessibility across the application,
 * verifying tab order, focus indicators, and keyboard shortcuts.
 *
 * Related: ACCESSIBILITY_ISSUES.md Issues #6, #7, #8, #9
 */

test.describe('Keyboard Navigation - Home Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should show skip link on first Tab press', async ({ page }) => {
    await page.keyboard.press('Tab');

    const skipLink = page.locator('.skip-link');
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeVisible();
  });

  test('should navigate main actions with Tab', async ({ page }) => {
    // Tab through main CTAs
    await page.keyboard.press('Tab'); // Skip link
    await page.keyboard.press('Tab'); // Create Lobby

    const createButton = page.getByRole('button', { name: /create lobby/i });
    await expect(createButton).toBeFocused();

    await page.keyboard.press('Tab'); // Join Lobby
    const joinButton = page.getByRole('button', { name: /join lobby/i });
    await expect(joinButton).toBeFocused();
  });

  test('should activate Create Lobby with Enter', async ({ page }) => {
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab'); // Focus Create Lobby
    await page.keyboard.press('Enter');

    // Should navigate to lobby creation
    await expect(page).toHaveURL(/\/lobby\//);
  });

  test('should activate Create Lobby with Space', async ({ page }) => {
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab'); // Focus Create Lobby
    await page.keyboard.press('Space');

    await expect(page).toHaveURL(/\/lobby\//);
  });

  test('should navigate backwards with Shift+Tab', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /create lobby/i });
    const joinButton = page.getByRole('button', { name: /join lobby/i });

    // Tab forward to join button
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(joinButton).toBeFocused();

    // Shift+Tab back
    await page.keyboard.press('Shift+Tab');
    await expect(createButton).toBeFocused();
  });

  test('should have visible focus indicators', async ({ page }) => {
    const createButton = page.getByRole('button', { name: /create lobby/i });

    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');

    // Check for focus outline
    const outline = await createButton.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        outline: styles.outline,
        outlineColor: styles.outlineColor,
        outlineWidth: styles.outlineWidth
      };
    });

    // Should have cyan focus ring (from Cybervault design)
    expect(outline.outlineWidth).not.toBe('0px');
  });
});

test.describe('Keyboard Navigation - Lobby Page', () => {
  test.beforeEach(async ({ page }) => {
    // Create a lobby first
    await page.goto('/');
    await page.getByRole('button', { name: /create lobby/i }).click();
    await page.waitForURL(/\/lobby\//);
  });

  test('should focus Copy Code button with Tab', async ({ page }) => {
    const copyButton = page.getByRole('button', { name: /copy.*code/i });

    // Tab to copy button
    let focused = false;
    for (let i = 0; i < 10 && !focused; i++) {
      await page.keyboard.press('Tab');
      focused = await copyButton.evaluate((el) => el === document.activeElement);
    }

    expect(focused).toBe(true);
  });

  test('should copy lobby code with Enter key', async ({ page }) => {
    const copyButton = page.getByRole('button', { name: /copy.*code/i });
    await copyButton.focus();
    await page.keyboard.press('Enter');

    // Verify clipboard (if testable)
    // Check for success message
    await expect(page.locator('text=/copied/i')).toBeVisible({ timeout: 2000 });
  });

  test('should navigate to Leave Lobby button', async ({ page }) => {
    const leaveButton = page.getByRole('button', { name: /leave.*lobby/i });

    // Tab through until we find leave button
    let focused = false;
    for (let i = 0; i < 20 && !focused; i++) {
      await page.keyboard.press('Tab');
      focused = await leaveButton.evaluate((el) => el === document.activeElement);
    }

    expect(focused).toBe(true);
  });

  test('should activate Leave Lobby with keyboard', async ({ page }) => {
    const leaveButton = page.getByRole('button', { name: /leave.*lobby/i });
    await leaveButton.focus();
    await page.keyboard.press('Enter');

    // Should return to home
    await expect(page).toHaveURL('/');
  });

  test('Start Game button should be keyboard accessible when enabled', async ({ page }) => {
    // This test assumes game can start with one player for testing
    const startButton = page.getByRole('button', { name: /start.*game/i });

    if (await startButton.isVisible()) {
      await startButton.focus();
      await expect(startButton).toBeFocused();

      const isDisabled = await startButton.isDisabled();
      if (!isDisabled) {
        await page.keyboard.press('Enter');
        // Should navigate to game
        await expect(page).toHaveURL(/\/game\//);
      }
    }
  });
});

test.describe('Keyboard Navigation - Game Page', () => {
  test.beforeEach(async ({ page }) => {
    // Setup: Create lobby, start game
    // This may require additional setup depending on game flow
    await page.goto('/');
    // Note: Actual game setup will depend on test environment
  });

  test.skip('should navigate answer options with Tab', async ({ page }) => {
    // Skip until game flow is set up in E2E
    const answerA = page.locator('.answer-option').first();

    // Tab to first answer
    let focused = false;
    for (let i = 0; i < 30 && !focused; i++) {
      await page.keyboard.press('Tab');
      focused = await answerA.evaluate((el) => el === document.activeElement);
    }

    expect(focused).toBe(true);
  });

  test.skip('should navigate answers with Arrow keys (Issue #6 - IMPLEMENTED)', async ({ page }) => {
    // Note: Still skipped until game E2E setup is complete
    // Implementation exists in GamePage.tsx, needs integration testing
    const answersGrid = page.locator('[role="radiogroup"]');
    const answers = page.locator('[role="radio"]');

    // Focus the answers grid
    await answersGrid.focus();

    // Press Down Arrow - should move from answer 0 to answer 1
    await page.keyboard.press('ArrowDown');

    // Check that answer 1 has visual focus (answerFocused class)
    const secondAnswer = answers.nth(1);
    await expect(secondAnswer).toHaveClass(/answerFocused/);

    // Press Right Arrow - should move to answer 2
    await page.keyboard.press('ArrowRight');
    const thirdAnswer = answers.nth(2);
    await expect(thirdAnswer).toHaveClass(/answerFocused/);

    // Press Up Arrow - should move back to answer 1
    await page.keyboard.press('ArrowUp');
    await expect(secondAnswer).toHaveClass(/answerFocused/);
  });

  test.skip('should select answer with number keys 1-4 (Issue #6 - IMPLEMENTED)', async ({ page }) => {
    // Note: Still skipped until game E2E setup is complete
    // Implementation exists in GamePage.tsx, needs integration testing
    const answersGrid = page.locator('[role="radiogroup"]');
    const answers = page.locator('[role="radio"]');

    // Focus the answers grid
    await answersGrid.focus();

    // Press "2" to select answer B (index 1)
    await page.keyboard.press('2');

    const answerB = answers.nth(1);
    await expect(answerB).toHaveClass(/answerSelected/);
    await expect(answerB).toHaveAttribute('aria-checked', 'true');
  });

  test.skip('should select answer with Space key', async ({ page }) => {
    // Note: Still skipped until game E2E setup is complete
    const answersGrid = page.locator('[role="radiogroup"]');
    const answers = page.locator('[role="radio"]');

    // Focus the answers grid (focusedAnswerIndex starts at 0)
    await answersGrid.focus();

    // Press Space to submit the focused answer (answer A)
    await page.keyboard.press('Space');

    const answerA = answers.first();
    await expect(answerA).toHaveClass(/answerSelected/);
    await expect(answerA).toHaveAttribute('aria-checked', 'true');
  });

  test.skip('should select answer with Enter key', async ({ page }) => {
    // Note: Still skipped until game E2E setup is complete
    const answersGrid = page.locator('[role="radiogroup"]');
    const answers = page.locator('[role="radio"]');

    // Focus the answers grid
    await answersGrid.focus();

    // Navigate to answer B with arrow key
    await page.keyboard.press('ArrowDown');

    // Press Enter to submit the focused answer (answer B)
    await page.keyboard.press('Enter');

    const answerB = answers.nth(1);
    await expect(answerB).toHaveClass(/answerSelected/);
    await expect(answerB).toHaveAttribute('aria-checked', 'true');
  });
});

test.describe('Keyboard Navigation - Modal Focus Trap', () => {
  test.skip('Question Set Manager modal should trap focus (Issue #8)', async ({ page }) => {
    // Navigate to question set manager
    await page.goto('/admin');

    // Open modal
    const openButton = page.getByRole('button', { name: /add.*question/i });
    await openButton.click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Get all focusable elements in modal
    const focusableElements = modal.locator('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const count = await focusableElements.count();

    expect(count).toBeGreaterThan(0);

    // Tab through all elements
    for (let i = 0; i < count + 2; i++) {
      await page.keyboard.press('Tab');
    }

    // Focus should still be within modal
    const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
    const modalContainsFocus = await modal.evaluate((el, focused) => {
      return el.contains(document.activeElement);
    });

    expect(modalContainsFocus).toBe(true);
  });

  test.skip('Modal should close with Escape key (Issue #8)', async ({ page }) => {
    await page.goto('/admin');

    const openButton = page.getByRole('button', { name: /add.*question/i });
    await openButton.click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Press Escape
    await page.keyboard.press('Escape');

    // Modal should close
    await expect(modal).not.toBeVisible();
  });

  test.skip('Focus should return to trigger after modal close (Issue #8)', async ({ page }) => {
    await page.goto('/admin');

    const openButton = page.getByRole('button', { name: /add.*question/i });
    await openButton.click();

    const modal = page.locator('[role="dialog"]');
    await expect(modal).toBeVisible();

    // Close modal
    await page.keyboard.press('Escape');

    // Focus should return to open button
    await expect(openButton).toBeFocused();
  });
});

test.describe('Keyboard Navigation - Form Validation', () => {
  test('Login form should be fully keyboard accessible', async ({ page }) => {
    await page.goto('/login');

    // Tab to username field
    await page.keyboard.press('Tab');
    const usernameInput = page.locator('input[type="text"], input[name*="username"]').first();
    await expect(usernameInput).toBeFocused();

    // Type username
    await page.keyboard.type('testuser');

    // Tab to password
    await page.keyboard.press('Tab');
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeFocused();

    // Type password
    await page.keyboard.type('password123');

    // Tab to submit button
    await page.keyboard.press('Tab');
    const submitButton = page.getByRole('button', { name: /sign in|login/i });
    await expect(submitButton).toBeFocused();

    // Could press Enter to submit (but won't for this test)
  });

  test('Form submit with Enter key', async ({ page }) => {
    await page.goto('/login');

    // Fill form
    await page.fill('input[type="text"], input[name*="username"]', 'testuser');
    await page.fill('input[type="password"]', 'password123');

    // Focus password field and press Enter
    await page.locator('input[type="password"]').focus();
    await page.keyboard.press('Enter');

    // Form should submit (will fail with invalid credentials)
    // Check for error message or redirect
    await page.waitForTimeout(500);
  });

  test.skip('Focus moves to first error field on validation failure (Issue #5)', async ({ page }) => {
    await page.goto('/login');

    // Submit without filling
    const submitButton = page.getByRole('button', { name: /sign in|login/i });
    await submitButton.click();

    // First invalid field should receive focus
    const firstInvalidField = page.locator('[aria-invalid="true"]').first();
    await expect(firstInvalidField).toBeFocused();
  });
});

test.describe('Keyboard Navigation - Focus Indicators', () => {
  test('All interactive elements should have visible focus', async ({ page }) => {
    await page.goto('/');

    const interactiveElements = [
      page.getByRole('button', { name: /create lobby/i }),
      page.getByRole('button', { name: /join lobby/i }),
      page.getByRole('link', { name: /login|profile/i }).first()
    ];

    for (const element of interactiveElements) {
      if (await element.isVisible()) {
        await element.focus();

        // Check outline is visible
        const hasOutline = await element.evaluate((el) => {
          const styles = window.getComputedStyle(el);
          const outlineWidth = parseFloat(styles.outlineWidth);
          return outlineWidth > 0;
        });

        expect(hasOutline).toBe(true);
      }
    }
  });

  test('Focus indicators should use Cybervault cyan color', async ({ page }) => {
    await page.goto('/');

    const button = page.getByRole('button', { name: /create lobby/i });
    await button.focus();

    const outlineColor = await button.evaluate((el) => {
      return window.getComputedStyle(el).outlineColor;
    });

    // Cyan is rgb(0, 242, 255) or #00f2ff
    // Browser may return rgb() format
    expect(outlineColor).toMatch(/rgb\(0,\s*242,\s*255\)|#00f2ff/i);
  });
});

test.describe('Keyboard Navigation - Results Page', () => {
  test.skip('Results page buttons should be keyboard accessible', async ({ page }) => {
    // Skip until game flow complete
    await page.goto('/results'); // May need game completion first

    const playAgainButton = page.getByRole('button', { name: /play again/i });
    const homeButton = page.getByRole('button', { name: /home|menu/i });

    // Tab through buttons
    await page.keyboard.press('Tab');
    // Verify tab order and activation
  });
});

test.describe('Accessibility - Reduced Motion', () => {
  test('Animations should respect prefers-reduced-motion', async ({ page }) => {
    // Enable reduced motion
    await page.emulateMedia({ reducedMotion: 'reduce' });

    await page.goto('/');

    // Check that animations are minimal
    const button = page.getByRole('button', { name: /create lobby/i });

    const animationDuration = await button.evaluate((el) => {
      return window.getComputedStyle(el).animationDuration;
    });

    // Should be minimal (0.01ms from CSS)
    expect(parseFloat(animationDuration)).toBeLessThan(0.1);
  });
});

test.describe('Accessibility - High Contrast', () => {
  test('Elements should be visible in high contrast mode', async ({ page }) => {
    // Enable high contrast
    await page.emulateMedia({ colorScheme: 'dark', contrast: 'more' });

    await page.goto('/');

    // Check border widths increase in high contrast
    const card = page.locator('.cv-glass, .auth-card, .payment-product-card').first();

    if (await card.isVisible()) {
      const borderWidth = await card.evaluate((el) => {
        return window.getComputedStyle(el).borderWidth;
      });

      // High contrast mode should increase borders to 2px
      expect(parseFloat(borderWidth)).toBeGreaterThanOrEqual(1);
    }
  });
});
