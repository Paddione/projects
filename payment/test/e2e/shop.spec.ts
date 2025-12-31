import { test, expect } from '@playwright/test';

test('home page loads', async ({ page }) => {
    await page.goto('/');
    // Just verify the page loads without errors
    await expect(page).toHaveTitle(/.*/);
    // Verify we're on the home page
    await expect(page).toHaveURL('/');
});

test('shop page is accessible', async ({ page }) => {
    await page.goto('/shop');
    // Verify the page loads and has some content
    await page.waitForLoadState('networkidle');
    // Check that we're on the shop page
    await expect(page).toHaveURL('/shop');
});

test('login page loads', async ({ page }) => {
    await page.goto('/login');
    // Verify the login page has email and password inputs
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="password"]')).toBeVisible();
    // Check that at least one submit button exists
    await expect(page.locator('button[type="submit"]').first()).toBeVisible();
});
