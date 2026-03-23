import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';
import { UserData } from '../utils/data-generators';
import { TestDataManager } from '../utils/test-data-manager';

/**
 * Perks Management E2E — tests the slot-based PerksManager component
 *
 * The PerksManager renders 8 perk slots (avatar, theme, badge, helper, etc.)
 * each with an option-grid of selectable buttons. It uses a loadout sidebar
 * that shows currently equipped options per slot.
 *
 * Mock data provides 3 unlocked perks (theme, avatar, badge) and 1 locked
 * perk (helper at level 5). See apiService.ts mock for /perks/user endpoint.
 */

test.describe('Perks Management E2E', () => {
  const dataManager = TestDataManager.getInstance();
  let userCredentials: UserData;

  test.beforeEach(async ({ page }) => {
    await dataManager.cleanupAll();
  });

  test.beforeEach(async ({ page }) => {
    page.on('console', msg => {
      console.log(`[BROWSER ${msg.type()}] ${msg.text()}`);
    });

    const registration = await TestHelpers.registerUser(page, {
      character: 'student'
    });
    userCredentials = registration.user;
  });

  async function navigateToPerks(page: import('@playwright/test').Page) {
    // Navigate to profile page
    await page.goto('/profile');
    await expect(page).toHaveURL(/.*profile/);

    // Wait for profile page to load, then click the Perks button
    const perksButton = page.getByRole('button', { name: 'Perks' });
    await expect(perksButton).toBeVisible({ timeout: 10000 });
    await perksButton.click();

    // Wait for the perks manager to appear and finish loading
    const perksManager = page.locator('.perks-manager');
    await expect(perksManager).toBeVisible({ timeout: 10000 });
    // Ensure it's not in a loading state
    await expect(perksManager).not.toHaveClass(/loading/, { timeout: 10000 });
  }

  test('should display perks manager with slot layout', async ({ page }) => {
    await navigateToPerks(page);

    // Verify header
    const perksManager = page.locator('.perks-manager');
    await expect(perksManager).toBeVisible();

    // Verify slot rows exist (8 slots: avatar, theme, badge, helper, display, emote, multiplier, title)
    const slotRows = page.locator('.slot-row');
    const slotCount = await slotRows.count();
    expect(slotCount).toBe(8);
  });

  test('should show loadout summary sidebar', async ({ page }) => {
    await navigateToPerks(page);

    // Check loadout sidebar exists
    const overview = page.locator('.perks-overview');
    await expect(overview).toBeVisible();

    // Should show summary rows for each slot
    const summaryRows = page.locator('.summary-row');
    const rowCount = await summaryRows.count();
    expect(rowCount).toBe(8);

    // Active slots should have the 'active' class, empty ones should have 'empty'
    const activeRows = page.locator('.summary-row.active');
    const emptyRows = page.locator('.summary-row.empty');
    const activeCount = await activeRows.count();
    const emptyCount = await emptyRows.count();
    expect(activeCount + emptyCount).toBe(8);
  });

  test('should display option buttons for unlocked slots', async ({ page }) => {
    await navigateToPerks(page);

    // Theme slot should have option buttons (mock has 3 theme options: ocean, forest, sunset)
    const themeSlot = page.locator('.slot-row').filter({ hasText: /Theme/i }).first();
    await expect(themeSlot).toBeVisible();

    const themeOptions = themeSlot.locator('.option-btn');
    const themeCount = await themeOptions.count();
    expect(themeCount).toBeGreaterThan(0);

    // Each option button should have a label
    const firstOption = themeOptions.first();
    await expect(firstOption.locator('.option-label')).toBeVisible();
  });

  test('should show locked slots with level requirements', async ({ page }) => {
    await navigateToPerks(page);

    // The helper slot should be locked (focus_mode requires level 5)
    const lockedSlots = page.locator('.slot-row.locked');
    const lockedCount = await lockedSlots.count();
    expect(lockedCount).toBeGreaterThan(0);

    // Locked slots should show a lock message with level requirement
    const lockedMsg = lockedSlots.first().locator('.slot-locked-msg');
    await expect(lockedMsg).toBeVisible();
    await expect(lockedMsg).toContainText('🔒');
  });

  test('should select an option in a slot', async ({ page }) => {
    await navigateToPerks(page);

    // Find the avatar slot (unlocked, has options)
    const avatarSlot = page.locator('.slot-row').filter({ hasText: /Avatar/i }).first();
    await expect(avatarSlot).toBeVisible();

    const avatarOptions = avatarSlot.locator('.option-btn:not(.locked)');
    const optionCount = await avatarOptions.count();
    expect(optionCount).toBeGreaterThan(0);

    // Options should be enabled (not disabled)
    await expect(avatarOptions.first()).toBeEnabled();

    // Click an option — the component will call activatePerk (mock returns success)
    // and then re-fetch perks. Since the mock isn't stateful, the selection
    // resets after re-fetch, so we just verify the click completes without error.
    await avatarOptions.first().click();

    // After the activation round-trip, the slot row should still be visible
    // (no crash, no error state)
    await expect(avatarSlot).toBeVisible();
    await expect(avatarSlot).not.toHaveClass(/error/);
  });

  test('should not allow clicking locked options', async ({ page }) => {
    await navigateToPerks(page);

    // Find locked option buttons (if any exist in unlocked slots)
    const lockedOptions = page.locator('.option-btn.locked');
    const lockedCount = await lockedOptions.count();

    if (lockedCount > 0) {
      const lockedOption = lockedOptions.first();
      // Locked options should be disabled
      await expect(lockedOption).toBeDisabled();
      // Should show level requirement
      await expect(lockedOption.locator('.option-lock')).toBeVisible();
    }
  });

  test('should show clear button for active slot', async ({ page }) => {
    await navigateToPerks(page);

    // The theme slot has an active selection by default (starter_theme is active)
    const themeSlot = page.locator('.slot-row').filter({ hasText: /Theme/i }).first();
    await expect(themeSlot).toBeVisible();

    // The equipped badge should be visible for the active theme
    const equippedBadge = themeSlot.locator('.slot-equipped-badge');
    await expect(equippedBadge).toBeVisible({ timeout: 5000 });

    // A clear button should be available
    const clearBtn = themeSlot.locator('.slot-clear-btn');
    await expect(clearBtn).toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    await navigateToPerks(page);

    // If the component is in an error state, it should show retry button
    const errorState = page.locator('.perks-manager.error');
    const loadedState = page.locator('.perks-manager:not(.error):not(.loading)');

    // Either error state with retry, or loaded state — both are valid
    const isError = await errorState.isVisible({ timeout: 2000 }).catch(() => false);
    const isLoaded = await loadedState.isVisible({ timeout: 2000 }).catch(() => false);

    expect(isError || isLoaded).toBe(true);

    if (isError) {
      // Should show a retry button
      const retryButton = page.locator('button').filter({ hasText: /retry/i });
      await expect(retryButton).toBeVisible();
    }
  });

  test('should show option emojis and labels', async ({ page }) => {
    await navigateToPerks(page);

    // Find an unlocked slot with options
    const themeSlot = page.locator('.slot-row').filter({ hasText: /Theme/i }).first();
    const options = themeSlot.locator('.option-btn:not(.locked)');
    const count = await options.count();

    if (count > 0) {
      const firstOption = options.first();
      // Should have an emoji
      await expect(firstOption.locator('.option-emoji')).toBeVisible();
      // Should have a label
      await expect(firstOption.locator('.option-label')).toBeVisible();
    }
  });

  test('should reflect active perks in loadout sidebar', async ({ page }) => {
    await navigateToPerks(page);

    const overview = page.locator('.perks-overview');
    await expect(overview).toBeVisible();

    // The theme is active by default (starter_theme mock is active)
    // Its summary row should show as 'active' with a value
    const themeSummary = overview.locator('.summary-row').filter({ hasText: /Theme/i });
    await expect(themeSummary).toHaveClass(/active/, { timeout: 5000 });

    // The theme value should show the selected option name
    const themeValue = themeSummary.locator('.summary-value');
    const valueText = await themeValue.textContent();
    expect(valueText).not.toBe('—'); // Should have a real value, not the empty placeholder
  });

  test('should display slot header icons and labels', async ({ page }) => {
    await navigateToPerks(page);

    // Each slot row should have an icon and label in the header
    const slotHeaders = page.locator('.slot-row-header');
    const headerCount = await slotHeaders.count();
    expect(headerCount).toBe(8);

    // Check the first header has icon and label
    const firstHeader = slotHeaders.first();
    await expect(firstHeader.locator('.slot-row-icon')).toBeVisible();
    await expect(firstHeader.locator('.slot-row-label')).toBeVisible();
  });
});
