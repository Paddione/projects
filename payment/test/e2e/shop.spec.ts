import { test, expect } from '@playwright/test';

test('visitor can see products', async ({ page }) => {
    await page.goto('/shop');
    await expect(page.locator('h1')).toContainText('PatrickCoin Shop');
});

test('login flow', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'user@example.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    // Default NextAuth redirect goes to /
    await expect(page).toHaveURL('/');
});
