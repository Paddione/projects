import { test, expect, Page } from '@playwright/test';

const registerAndLogin = async (page: Page) => {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  await page.waitForFunction(() => {
    const authForm = document.querySelector('[data-testid="register-tab"], [data-testid="login-tab"]');
    const authenticated = document.querySelector('[data-testid="create-lobby-button"]');
    return authForm || authenticated;
  }, { timeout: 15000 });

  // If already authenticated, skip registration
  const createLobby = page.locator('[data-testid="create-lobby-button"]');
  if (await createLobby.isVisible().catch(() => false)) {
    return;
  }

  const timestamp = Date.now();
  const username = `helpuser${timestamp}`;
  const email = `helpuser${timestamp}@example.com`;
  const password = 'TestPassword123!';

  await page.click('[data-testid="register-tab"]');
  await page.fill('[data-testid="username-input"]', username);
  await page.fill('[data-testid="email-input"]', email);
  await page.fill('[data-testid="password-input"]', password);
  await page.fill('[data-testid="confirm-password-input"]', password);
  await page.click('[data-testid="register-button"]');

  await page.waitForURL(/.*\/$/, { timeout: 10000 });
  await page.waitForSelector('[data-testid="create-lobby-button"]', { timeout: 15000 });
};

test.describe('Help Screen', () => {
  test.beforeEach(async ({ page }) => {
    await registerAndLogin(page);
  });

  test('help button is visible on the page', async ({ page }) => {
    await expect(page.locator('[data-testid="help-button"]')).toBeVisible();
  });

  test('clicking help button opens the help dialog', async ({ page }) => {
    await page.click('[data-testid="help-button"]');
    await expect(page.locator('[data-testid="help-dialog"]')).toBeVisible();
  });

  test('help dialog shows all navigation sections', async ({ page }) => {
    await page.click('[data-testid="help-button"]');
    await page.waitForSelector('[data-testid="help-dialog"]');

    const sections = [
      'howToPlay', 'scoring', 'lobbies', 'questionSets',
      'leveling', 'perks', 'profile', 'hallOfFame', 'settings',
    ];

    for (const section of sections) {
      await expect(page.locator(`[data-testid="help-nav-${section}"]`)).toBeVisible();
    }
  });

  test('clicking a nav section shows its content', async ({ page }) => {
    await page.click('[data-testid="help-button"]');
    await page.waitForSelector('[data-testid="help-dialog"]');

    // Default section is howToPlay — verify content is present
    const content = page.locator('[data-testid="help-content"]');
    await expect(content).toBeVisible();
    await expect(content).not.toBeEmpty();

    // Switch to scoring section
    await page.click('[data-testid="help-nav-scoring"]');
    // Scoring section should contain multiplier-related content
    await expect(content.locator('text=1x')).toBeVisible();

    // Switch to lobbies section
    await page.click('[data-testid="help-nav-lobbies"]');
    await expect(content.locator('li')).not.toHaveCount(0);
  });

  test('help dialog can be closed via close button', async ({ page }) => {
    await page.click('[data-testid="help-button"]');
    await page.waitForSelector('[data-testid="help-dialog"]');

    // Click the close button (× character)
    await page.locator('[data-testid="help-dialog"] button[aria-label]').first().click();
    await expect(page.locator('[data-testid="help-dialog"]')).not.toBeVisible();
  });

  test('help dialog can be closed by clicking the overlay', async ({ page }) => {
    await page.click('[data-testid="help-button"]');
    await page.waitForSelector('[data-testid="help-dialog"]');

    // Click outside the modal (the overlay)
    const dialog = page.locator('[data-testid="help-dialog"]');
    const box = await dialog.boundingBox();
    if (box) {
      // Click well above the dialog
      await page.mouse.click(box.x + box.width / 2, Math.max(box.y - 50, 5));
    }
    await expect(dialog).not.toBeVisible();
  });

  test('help dialog can be closed with Escape key', async ({ page }) => {
    await page.click('[data-testid="help-button"]');
    await page.waitForSelector('[data-testid="help-dialog"]');

    await page.keyboard.press('Escape');
    await expect(page.locator('[data-testid="help-dialog"]')).not.toBeVisible();
  });

  test('all nav sections render content without errors', async ({ page }) => {
    await page.click('[data-testid="help-button"]');
    await page.waitForSelector('[data-testid="help-dialog"]');

    const sections = [
      'howToPlay', 'scoring', 'lobbies', 'questionSets',
      'leveling', 'perks', 'profile', 'hallOfFame', 'settings',
    ];

    const content = page.locator('[data-testid="help-content"]');

    for (const section of sections) {
      await page.click(`[data-testid="help-nav-${section}"]`);
      await expect(content).toBeVisible();
      // Verify each section renders some text (not empty)
      const text = await content.textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    }
  });
});
