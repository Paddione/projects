import { test, expect } from '@playwright/test';
import { cleanupAll, seedDefaultData } from './support/seed';

const AUTH_HEADERS = {
    'x-auth-user': 'Playwright Admin',
    'x-auth-email': 'admin@example.com',
    'x-auth-role': 'ADMIN',
    'x-auth-user-id': '999',
    'x-user-name': 'Playwright Admin',
    'x-user-email': 'admin@example.com',
    'x-user-role': 'ADMIN',
    'x-user-id': '999',
};

const applyAuthHeaders = async (page: import('@playwright/test').Page, role = 'ADMIN') => {
    const headers = {
        ...AUTH_HEADERS,
        'x-auth-role': role,
        'x-user-role': role,
    };
    await page.route('**/*', (route: import('@playwright/test').Route) => {
        const h = { ...route.request().headers(), ...headers };
        route.continue({ headers: h });
    });
    await page.setExtraHTTPHeaders(headers);
};

test.describe('Admin Functional Tests', () => {
    test.beforeEach(async () => {
        await cleanupAll();
        await seedDefaultData();
    });

    test.afterEach(async () => {
        await cleanupAll();
    });

    test('admin can access dashboard', async ({ page }) => {
        await applyAuthHeaders(page, 'ADMIN');
        await page.goto('/admin', { waitUntil: 'domcontentloaded' });

        await expect(page.getByRole('heading', { name: /admin command center/i })).toBeVisible();
        await expect(page.getByText(/welcome back/i)).toBeVisible();
    });

    test('admin can see product management', async ({ page }) => {
        await applyAuthHeaders(page, 'ADMIN');
        await page.goto('/admin/products', { waitUntil: 'domcontentloaded' });

        await expect(page.getByRole('heading', { name: /products & services/i })).toBeVisible();
        await expect(page.getByRole('link', { name: /add new item/i })).toBeVisible();
    });

    test('admin can access user management', async ({ page }) => {
        await applyAuthHeaders(page, 'ADMIN');
        await page.goto('/admin/users', { waitUntil: 'domcontentloaded' });

        await expect(page.getByRole('heading', { name: /user management/i })).toBeVisible();
        // The admin user itself should be in the list
        await expect(page.getByRole('cell', { name: 'admin@example.com' })).toBeVisible();
    });

    test('non-admin is rejected from admin pages', async ({ page }) => {
        // Use USER role headers
        const userHeaders = {
            ...AUTH_HEADERS,
            'x-auth-role': 'USER',
            'x-user-role': 'USER',
            'x-auth-email': 'regular.user@example.com',
            'x-user-email': 'regular.user@example.com',
        };
        await page.route('**/*', (route) => {
            const h = { ...route.request().headers(), ...userHeaders };
            route.continue({ headers: h });
        });
        await page.setExtraHTTPHeaders(userHeaders);

        // This should trigger an error response or a redirect
        // Based on requireAdmin(), it throws an Error which Next.js shows as an error page
        await page.goto('/admin', { waitUntil: 'domcontentloaded' });

        // We expect some form of error message or just not the dashboard
        await expect(page.getByText('Admin Command Center')).not.toBeVisible();
    });
});
