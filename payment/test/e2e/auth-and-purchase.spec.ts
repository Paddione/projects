import { test, expect, type APIRequestContext } from '@playwright/test';

const authServiceUrl = (process.env.AUTH_SERVICE_URL || 'http://localhost:5500').replace(/\/+$/, '');

const isAuthServiceHealthy = async (request: APIRequestContext): Promise<boolean> => {
    try {
        const response = await request.get(`${authServiceUrl}/health`, { timeout: 5000 });
        return response.ok();
    } catch {
        return false;
    }
};

const registerUser = async (
    request: APIRequestContext,
    payload: { username: string; email: string; password: string; name?: string }
): Promise<void> => {
    const response = await request.post(`${authServiceUrl}/api/auth/register`, {
        data: payload,
        timeout: 10000,
    });

    if (response.ok()) {
        return;
    }

    const body = await response.json().catch(() => null);
    const message = typeof body?.error === 'string' ? body.error : '';
    if (/already|exists/i.test(message)) {
        return;
    }

    throw new Error(`Registration failed (${response.status()}): ${message || 'Unknown error'}`);
};

test.describe('Payment registration and purchasing flows', () => {
    test('registers a user via auth service and logs in', async ({ page, request }) => {
        const authHealthy = await isAuthServiceHealthy(request);
        test.skip(!authHealthy, 'Auth service is not available for registration.');

        const timestamp = Date.now();
        const email = process.env.PAYMENT_E2E_REGISTER_EMAIL || `playwright-${timestamp}@example.com`;
        const password = process.env.PAYMENT_E2E_REGISTER_PASSWORD || 'Playwright123!';
        const username = process.env.PAYMENT_E2E_REGISTER_USERNAME || `playwright${timestamp}`;

        await registerUser(request, {
            username,
            email,
            password,
            name: 'Playwright Test',
        });

        await page.goto('/login');
        await page.fill('input[name="email"]', email);
        await page.fill('input[name="password"]', password);
        await page.getByRole('button', { name: /sign in/i }).click();

        await page.waitForURL('**/', { timeout: 10000 });
        await expect(page.getByText(email)).toBeVisible();
        await expect(page.getByRole('link', { name: /sign out/i })).toBeVisible();
    });

    test('attempts a purchase from the shop', async ({ page }) => {
        const loginEmail = process.env.PAYMENT_E2E_USER_EMAIL || 'user@example.com';
        const loginPassword = process.env.PAYMENT_E2E_USER_PASSWORD || 'password';

        await page.goto('/login');
        await page.fill('input[name="email"]', loginEmail);
        await page.fill('input[name="password"]', loginPassword);
        await page.getByRole('button', { name: /sign in/i }).click();

        const loginError = page.getByText(/invalid credentials/i);
        const loginErrorVisible = await loginError.isVisible().catch(() => false);
        test.skip(loginErrorVisible, 'E2E login credentials are not available.');

        await page.waitForURL('**/', { timeout: 10000 });
        await expect(page.getByText(loginEmail)).toBeVisible();

        await page.goto('/shop');
        const productLinks = page.getByRole('link', { name: 'View Details' });
        const productCount = await productLinks.count();
        test.skip(productCount === 0, 'No purchasable products available in the shop.');

        await productLinks.first().click();

        const bookingInput = page.locator('input[type="datetime-local"]');
        if (await bookingInput.isVisible()) {
            const bookingDate = new Date();
            bookingDate.setDate(bookingDate.getDate() + 1);
            bookingDate.setHours(10, 0, 0, 0);
            await bookingInput.fill(bookingDate.toISOString().slice(0, 16));
        }

        const purchaseButton = page.getByRole('button', { name: /purchase for/i });
        await purchaseButton.click();

        const errorMessage = page.getByText(/login required|insufficient patrickcoins|out of stock|booking time required|please select a booking time/i);

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
