import { Page, BrowserContext, expect } from '@playwright/test';

/**
 * Shared authentication helpers for K3d E2E tests
 */

export const TEST_USER = {
    username: `testuser_${Date.now()}`,
    email: `testuser_${Date.now()}@example.com`,
    password: 'TestPassword123!',
};

/**
 * Performs a login via the Auth service and stores the state
 */
export async function loginAsTestUser(page: Page, context: BrowserContext) {
    // Go to login page
    await page.goto('https://auth.korczewski.de/login');

    // Check if we need to register first (in a fresh environment)
    // Or just try to login and if it fails, register.
    // For robustness, we'll try to register first.

    await page.goto('https://auth.korczewski.de/register');
    await page.fill('input[name="username"]', TEST_USER.username);
    await page.fill('input[name="email"]', TEST_USER.email);
    await page.fill('input[name="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');

    // After registration, we should be logged in or at least have cookies
    // The auth service sets accessToken and refreshToken cookies

    // Verify we are on the dashboard or landing page
    await expect(page).toHaveURL(/auth\.korczewski\.de\/($|dashboard|home)/);

    return TEST_USER;
}

/**
 * Verifies that a request to a protected URL redirects to the login page
 */
export async function verifyProtectedRedirect(page: Page, protectedUrl: string) {
    const response = await page.goto(protectedUrl);
    // It should either be a 401 (if API) or a redirect to auth.korczewski.de
    const url = page.url();
    expect(url).toContain('auth.korczewski.de');
}
