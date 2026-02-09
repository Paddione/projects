import { test, expect } from '@playwright/test';
import { cleanupAll, seedDefaultData } from './support/seed';

const AUTH_HEADERS = {
    'x-auth-user': 'Playwright User',
    'x-auth-email': 'playwright.user@example.com',
    'x-auth-role': 'USER',
    'x-auth-user-id': '123',
    'x-user-name': 'Playwright User',
    'x-user-email': 'playwright.user@example.com',
    'x-user-role': 'USER',
    'x-user-id': '123',
};

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const authServiceUrl = (process.env.AUTH_SERVICE_URL || 'https://auth.korczewski.de').replace(/\/+$/, '');

const applyAuthHeaders = async (page: import('@playwright/test').Page) => {
    await page.route('**/*', (route: import('@playwright/test').Route) => {
        const headers = { ...route.request().headers(), ...AUTH_HEADERS };
        route.continue({ headers });
    });
    await page.setExtraHTTPHeaders(AUTH_HEADERS);
};

test.describe('Shop page and redirection tests', () => {
    test.beforeEach(async () => {
        await cleanupAll();
        await seedDefaultData();
    });

    test.afterEach(async () => {
        await cleanupAll();
    });

    test('home page redirects to auth when unauthenticated', async ({ request }) => {
        const response = await request.get('/', { maxRedirects: 0 });
        expect(response.status()).toBeGreaterThanOrEqual(300);
        expect(response.status()).toBeLessThan(400);

        const location = response.headers()['location'] || '';
        expect(location).toMatch(new RegExp(`${escapeRegex(authServiceUrl)}/login`));
    });

    test('home page loads when authenticated', async ({ page }) => {
        await applyAuthHeaders(page);
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await expect(page).toHaveTitle(/.*/);
        await expect(page.getByText('playwright.user@example.com')).toBeVisible();
    });

    test('shop page is accessible when authenticated', async ({ page }) => {
        await applyAuthHeaders(page);
        await page.goto('/shop', { waitUntil: 'domcontentloaded' });
        await page.waitForLoadState('networkidle');
        await expect(page).toHaveURL('/shop');
    });

    test('login route redirects to auth service', async ({ request }) => {
        const response = await request.get('/login', { maxRedirects: 0 });
        expect(response.status()).toBeGreaterThanOrEqual(300);
        expect(response.status()).toBeLessThan(400);

        const location = response.headers()['location'] || '';
        expect(location).toMatch(new RegExp(`${escapeRegex(authServiceUrl)}/login`));
    });
});

