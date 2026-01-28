import { test, expect } from '@playwright/test';
import { getSeedProductId } from './support/seed';

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

const applyAuthHeaders = async (page: any) => {
    await page.route('**/*', (route: any) => {
        const headers = { ...route.request().headers(), ...AUTH_HEADERS };
        route.continue({ headers });
    });
    await page.setExtraHTTPHeaders(AUTH_HEADERS);
};

let seededProductId: string | null = null;

const getRedirectTarget = (url: string): string | null => {
    try {
        return new URL(url).searchParams.get('redirect');
    } catch {
        return null;
    }
};

test.describe('Payment registration and purchasing flows', () => {

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
        await applyAuthHeaders(page);
        await page.goto('/shop', { waitUntil: 'domcontentloaded' });

        if (!seededProductId) {
            seededProductId = await getSeedProductId();
        }

        expect(seededProductId).toBeTruthy();
        await page.goto(`/shop/${seededProductId}`, { waitUntil: 'domcontentloaded' });

        const bookingInput = page.locator('input[type="datetime-local"]');
        if (await bookingInput.isVisible()) {
            const bookingDate = new Date();
            bookingDate.setDate(bookingDate.getDate() + 1);
            bookingDate.setHours(10, 0, 0, 0);
            await bookingInput.fill(bookingDate.toISOString().slice(0, 16));
        }

        const purchaseButton = page.getByRole('button', { name: /purchase for/i });
        await purchaseButton.waitFor({ state: 'visible' });
        await purchaseButton.click();

        const errorMessage = page.getByText(/insufficient patrickcoins|out of stock|booking time required|please select a booking time|wallet|not found/i);

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
