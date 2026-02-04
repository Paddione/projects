import { test, expect } from '@playwright/test';

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

const applyAuthHeaders = async (page: import('@playwright/test').Page) => {
    await page.route('**/*', (route: import('@playwright/test').Route) => {
        const headers = { ...route.request().headers(), ...AUTH_HEADERS };
        route.continue({ headers });
    });
    await page.setExtraHTTPHeaders(AUTH_HEADERS);
};

test.describe('Help Screen', () => {
    test('help button is visible on the page', async ({ page }) => {
        await applyAuthHeaders(page);
        await page.goto('/', { waitUntil: 'domcontentloaded' });
        await expect(page.getByTestId('help-button')).toBeVisible();
    });

    test('clicking help button opens the help dialog', async ({ page }) => {
        await applyAuthHeaders(page);
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        await page.getByTestId('help-button').click();
        await expect(page.getByTestId('help-dialog')).toBeVisible();
        await expect(page.getByRole('heading', { name: 'Help Guide' })).toBeVisible();
    });

    test('help dialog shows all 7 navigation sections', async ({ page }) => {
        await applyAuthHeaders(page);
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        await page.getByTestId('help-button').click();
        await page.getByTestId('help-dialog').waitFor();

        const sidebar = page.getByTestId('help-sidebar');
        const navItems = sidebar.locator('button');
        await expect(navItems).toHaveCount(7);

        // Verify section headings
        const expectedSections = [
            'Getting Started', 'Shop', 'Wallet & PatrickCoin',
            'Orders', 'Appointments', 'Admin Panel', 'Security & Payments',
        ];
        for (const heading of expectedSections) {
            await expect(sidebar.getByText(heading)).toBeVisible();
        }
    });

    test('clicking a nav section shows its content', async ({ page }) => {
        await applyAuthHeaders(page);
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        await page.getByTestId('help-button').click();
        await page.getByTestId('help-dialog').waitFor();

        const content = page.getByTestId('help-content');

        // Default: Getting Started
        await expect(content.getByRole('heading', { name: 'Getting Started' })).toBeVisible();
        await expect(content.locator('li')).not.toHaveCount(0);

        // Switch to Shop
        page.getByTestId('help-sidebar').getByText('Shop').click();
        await expect(content.getByRole('heading', { name: 'Shop' })).toBeVisible();
        await expect(content.getByText('Browse products on the Shop page.')).toBeVisible();

        // Switch to Wallet
        page.getByTestId('help-sidebar').getByText('Wallet & PatrickCoin').click();
        await expect(content.getByRole('heading', { name: 'Wallet & PatrickCoin' })).toBeVisible();
    });

    test('language toggle switches between English and German', async ({ page }) => {
        await applyAuthHeaders(page);
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        await page.getByTestId('help-button').click();
        await page.getByTestId('help-dialog').waitFor();

        const content = page.getByTestId('help-content');

        // Default is English
        await expect(page.getByRole('heading', { name: 'Help Guide' })).toBeVisible();

        // Switch to German
        await page.getByTestId('help-lang-de').click();
        await expect(page.getByRole('heading', { name: 'Hilfe' })).toBeVisible();
        await expect(content.getByRole('heading', { name: 'Erste Schritte' })).toBeVisible();

        // Switch back to English
        await page.getByTestId('help-lang-en').click();
        await expect(page.getByRole('heading', { name: 'Help Guide' })).toBeVisible();
        await expect(content.getByRole('heading', { name: 'Getting Started' })).toBeVisible();
    });

    test('help dialog can be closed via close button', async ({ page }) => {
        await applyAuthHeaders(page);
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        await page.getByTestId('help-button').click();
        await page.getByTestId('help-dialog').waitFor();

        await page.getByTestId('help-close').click();
        await expect(page.getByTestId('help-dialog')).not.toBeVisible();
    });

    test('help dialog can be closed with Escape key', async ({ page }) => {
        await applyAuthHeaders(page);
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        await page.getByTestId('help-button').click();
        await page.getByTestId('help-dialog').waitFor();

        await page.keyboard.press('Escape');
        await expect(page.getByTestId('help-dialog')).not.toBeVisible();
    });

    test('all sections render content without errors', async ({ page }) => {
        await applyAuthHeaders(page);
        await page.goto('/', { waitUntil: 'domcontentloaded' });

        await page.getByTestId('help-button').click();
        await page.getByTestId('help-dialog').waitFor();

        const sidebar = page.getByTestId('help-sidebar');
        const content = page.getByTestId('help-content');
        const navItems = sidebar.locator('button');
        const count = await navItems.count();

        for (let i = 0; i < count; i++) {
            await navItems.nth(i).click();
            await expect(content.locator('li')).not.toHaveCount(0);
        }
    });
});
