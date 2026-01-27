import { test, expect } from '@playwright/test';
import { TEST_USER } from '../lib/auth-helpers.js';

/**
 * Authentication & ForwardAuth Tests
 */

test.describe('Unified Authentication (ForwardAuth)', () => {

    test('Protected service is blocked (401)', async ({ page }) => {
        // Try to access L2P which is protected
        const response = await page.goto('https://l2p.korczewski.de');

        // It should return 401 Unauthorized because of ForwardAuth
        expect(response?.status()).toBe(401);
    });

    test('Successful registration and cross-domain access', async ({ page }) => {
        // 1. Go to Auth Service Registration
        await page.goto('https://auth.korczewski.de/register');

        const timestamp = Date.now();
        const username = `e2e_${timestamp}`;
        const email = `e2e_${timestamp}@example.com`;
        const password = 'TestPassword123!';

        await page.fill('#username', username);
        await page.fill('#email', email);
        await page.fill('#password', password);

        // Optional name field
        const nameField = page.locator('#name');
        if (await nameField.isVisible()) {
            await nameField.fill('E2E Tester');
        }

        await page.click('button[type="submit"]');

        // 2. After registration, the app should navigate to /apps
        // We increase timeout in case the service is slow
        try {
            await expect(page).toHaveURL(/auth\.korczewski\.de\/apps/, { timeout: 20000 });
        } catch (e) {
            // If it fails, take a screenshot or log current URL
            console.error(`Current URL: ${page.url()}`);
            throw e;
        }

        // 3. Now verify cross-domain access to L2P
        // The cookies should have been set for .korczewski.de
        const response = await page.goto('https://l2p.korczewski.de');

        // Should be 200 now instead of 401
        expect(response?.status()).toBe(200);
        await expect(page).toHaveURL(/l2p\.korczewski\.de/);
    });

    test('Login works and provides access', async ({ page }) => {
        // We'll use the TEST_USER from lib/auth-helpers or just create one here
        // For a clean test, let's register then login

        const timestamp = Date.now();
        const username = `login_e2e_${timestamp}`;
        const email = `${username}@example.com`;
        const password = 'TestPassword123!';

        // Register
        await page.goto('https://auth.korczewski.de/register');
        await page.fill('#username', username);
        await page.fill('#email', email);
        await page.fill('#password', password);
        await page.click('button[type="submit"]');
        await expect(page).toHaveURL(/auth\.korczewski\.de\/apps/);

        // Clear cookies to simulate a new session
        await page.context().clearCookies();

        // Login
        await page.goto('https://auth.korczewski.de/login');
        // Login page usually has usernameOrEmail or similar
        // Let's check Login.tsx if possible, or assume #usernameOrEmail
        const userField = page.locator('#usernameOrEmail');
        if (await userField.isVisible()) {
            await userField.fill(username);
        } else {
            await page.fill('#username', username);
        }
        await page.fill('#password', password);
        await page.click('button[type="submit"]');

        await expect(page).toHaveURL(/auth\.korczewski\.de\/apps/);

        // Verify access to protected service
        const response = await page.goto('https://videovault.korczewski.de');
        expect(response?.status()).toBe(200);
    });
});
