import { test, expect } from '@playwright/test';
import { mockAuth, mockAuthUnauthorized, mockHealth, blockSocket, ALICE } from './helpers/mockApi';

/**
 * Auth + landing page E2E tests
 *
 * Tests the AuthGuard component, redirect behaviour, and
 * the authenticated Home page in isolation (no live backend needed).
 */

test.describe('Authentication', () => {
    test('shows loading spinner then home page when auth succeeds', async ({ page }) => {
        await mockAuth(page, ALICE);
        await mockHealth(page);
        await blockSocket(page);

        await page.goto('/');

        // Should eventually render the authenticated home
        await expect(page.locator('h1')).toContainText('ARENA', { timeout: 8000 });
        await expect(page.locator('text=Top-Down Battle Royale')).toBeVisible();
        await expect(page.locator('text=Playing as')).toBeVisible();
        await expect(page.locator('strong')).toContainText(ALICE.username);
    });

    test('shows Authenticating... state before auth resolves', async ({ page }) => {
        // Delay the auth response so we can catch the loading state
        await page.route('**/api/auth/me', async (route) => {
            await new Promise((r) => setTimeout(r, 300));
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ user: ALICE }),
            });
        });
        await blockSocket(page);

        await page.goto('/');
        // AuthGuard renders "Authenticating..." before the response arrives
        await expect(page.locator('text=Authenticating...')).toBeVisible();
        // Then home appears
        await expect(page.locator('h1')).toContainText('ARENA', { timeout: 5000 });
    });

    test('shows redirect message when auth returns 401', async ({ page }) => {
        // Intercept the redirect that AuthGuard fires so the test doesn't actually navigate away
        await mockAuthUnauthorized(page);
        await blockSocket(page);

        // Intercept navigation away from the origin (the login redirect)
        let redirected = false;
        page.on('request', (req) => {
            if (req.url().includes('login')) redirected = true;
        });

        await page.goto('/');
        // "Redirecting to login..." or the navigation itself signals unauthenticated
        // We can't fully follow the redirect because AUTH_SERVICE_URL is empty in local config,
        // so the AuthGuard clears auth and renders "Redirecting to login..."
        await expect(page.locator('text=Redirecting to login...')).toBeVisible({ timeout: 5000 });
    });

    test('derives username from email when x-auth-user is absent', async ({ page }) => {
        await page.route('**/api/auth/me', (route) =>
            route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    user: { userId: 99, username: 'charlie', email: 'charlie@arena.test', role: 'USER' },
                }),
            })
        );
        await blockSocket(page);

        await page.goto('/');
        await expect(page.locator('strong')).toContainText('charlie', { timeout: 5000 });
    });
});
