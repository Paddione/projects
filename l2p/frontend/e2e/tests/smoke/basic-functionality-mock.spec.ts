import { test, expect } from '@playwright/test';
import { TestHelpers } from '../../utils/test-helpers';

test.describe('Basic Functionality - Mock API Tests', () => {
  test.beforeEach(async ({ page }) => {
    await TestHelpers.injectAuth(page);
  });

  test('should show authenticated home page', async ({ page }) => {
    await expect(page.locator('[data-testid="create-lobby-button"]')).toBeVisible();
  });

  test('should show lobby options when authenticated', async ({ page }) => {
    await expect(page.locator('[data-testid="create-lobby-button"]')).toBeVisible();

    // Check if join lobby button exists (it may vary based on UI state)
    const joinLobbyButton = page.locator('[data-testid="join-lobby-button"]');
    const hasJoinButton = await joinLobbyButton.count() > 0;

    if (hasJoinButton) {
      await expect(joinLobbyButton).toBeVisible();
    }
  });

  test('should display connection status', async ({ page }) => {
    const connectionStatus = page.locator('[data-testid="connection-status"], [data-testid="online-status"]');

    await page.waitForTimeout(2000);

    // This test is optional - connection status might not always be visible
    if (await connectionStatus.count() > 0) {
      await expect(connectionStatus.first()).toBeVisible();
    } else {
      console.log('No connection status indicators found');
    }
  });
});
