import { test, expect } from '@playwright/test';
import { ensureProductSeed, cleanupAll, seedDefaultData } from './support/seed';

const authServiceUrl = (process.env.AUTH_SERVICE_URL || 'https://auth.korczewski.de').replace(/\/+$/, '');

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

const applyAuthHeaders = async (page: import('@playwright/test').Page, role = 'USER') => {
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

const getRedirectTarget = (url: string): string | null => {
    try {
        return new URL(url).searchParams.get('redirect');
    } catch {
        return null;
    }
};

test.describe('Payment registration and purchasing flows', () => {
    test.beforeEach(async () => {
        await cleanupAll();
        await seedDefaultData();
    });

    test.afterEach(async () => {
        await cleanupAll();
    });

    test('redirects unauthenticated users to auth service login', async ({ request }) => {
        const response = await request.get('/orders', { maxRedirects: 0 });
        expect(response.status()).toBeGreaterThanOrEqual(300);
        expect(response.status()).toBeLessThan(400);

        const location = response.headers()['location'] || '';
        expect(location).toMatch(new RegExp(`${escapeRegex(authServiceUrl)}/login`));
        const redirectTarget = getRedirectTarget(location);
        expect(redirectTarget).toContain('/orders');
    });

    test('renders authenticated user context from ForwardAuth headers', async ({ page }) => {
        await applyAuthHeaders(page);
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        await expect(page.getByText(AUTH_HEADERS['x-auth-email'])).toBeVisible();
        await expect(page.getByRole('link', { name: /sign out/i })).toBeVisible();
    });

    test('attempts a purchase from the shop', async ({ page }) => {
        const product = await ensureProductSeed();
        const seededProductId = product.id;

        await applyAuthHeaders(page);
        await page.goto(`/shop/${seededProductId}`, { waitUntil: 'networkidle' });

        // Ensure the product page has actually loaded
        await expect(page.getByRole('heading', { name: product.title })).toBeVisible({ timeout: 10000 });

        const purchaseButton = page.getByRole('button', { name: /purchase for/i });
        await expect(purchaseButton).toBeVisible({ timeout: 10000 });
        await purchaseButton.click();

        const errorMessage = page.getByText(/insufficient patrickcoins|out of stock|booking time required|please select a booking time|wallet|not found/i).first();

        let redirected = false;
        try {
            await page.waitForURL('**/orders', { timeout: 8000 });
            redirected = true;
        } catch {
            redirected = false;
        }

        if (redirected) {
            await expect(page.getByRole('heading', { name: /order history/i })).toBeVisible();
        } else {
            await expect(errorMessage).toBeVisible();
        }
    });
});
