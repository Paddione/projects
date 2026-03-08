import { test, expect } from '@playwright/test';
import { mockAuth, blockSocket, makeLobby, ALICE } from './helpers/mockApi';

/**
 * Mobile orientation E2E tests
 *
 * Run via two Playwright projects defined in playwright.config.ts:
 *   - mobile-portrait  (iPhone 13, 390×844)
 *   - mobile-landscape (iPhone 13, 844×390)
 *
 * Tests run for both orientations without any `test.use()` in this file.
 */

// ---------------------------------------------------------------------------
// Home page
// ---------------------------------------------------------------------------

test.describe('Home page', () => {
    test.beforeEach(async ({ page }) => {
        await mockAuth(page, ALICE);
        await blockSocket(page);
        await page.goto('/');
        await expect(page.locator('h1')).toContainText('ARENA', { timeout: 8000 });
    });

    test('title and buttons visible without horizontal scroll', async ({ page }) => {
        await expect(page.locator('h1')).toBeVisible();
        await expect(page.locator('#create-lobby-btn')).toBeVisible();
        await expect(page.locator('#join-code-input')).toBeVisible();
        const noOverflow = await page.evaluate(() =>
            document.body.scrollWidth <= document.body.clientWidth
        );
        expect(noOverflow).toBe(true);
    });

    test('Create Lobby button has adequate touch target height (≥ 44px)', async ({ page }) => {
        const box = await page.locator('#create-lobby-btn').boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
    });

    test('Join Lobby button has adequate touch target height (≥ 44px)', async ({ page }) => {
        const box = await page.locator('#join-lobby-btn').boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
    });

    test('join code input accepts tap and text entry', async ({ page }) => {
        await page.locator('#join-code-input').tap();
        await page.locator('#join-code-input').fill('AB1234');
        await expect(page.locator('#join-code-input')).toHaveValue('AB1234');
    });

    test('username displayed on home page', async ({ page }) => {
        await expect(page.locator('strong')).toContainText(ALICE.username);
    });

    test('Create Lobby navigates to /lobby on tap', async ({ page }) => {
        await page.route('**/api/lobbies', async (route) => {
            if (route.request().method() !== 'POST') return route.continue();
            await route.fulfill({
                status: 201, contentType: 'application/json',
                body: JSON.stringify(makeLobby({ code: 'MOB001' })),
            });
        });
        await page.locator('#create-lobby-btn').tap();
        await expect(page).toHaveURL(/\/lobby\/MOB001/, { timeout: 5000 });
    });
});

// ---------------------------------------------------------------------------
// Lobby page
// ---------------------------------------------------------------------------

const TEST_LOBBY = makeLobby({ code: 'MOB002' });

async function gotoLobbyMobile(page: any) {
    await mockAuth(page, ALICE);
    await blockSocket(page);
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('ARENA', { timeout: 8000 });
    await page.route('**/api/lobbies', async (route: any) => {
        if (route.request().method() !== 'POST') return route.continue();
        await route.fulfill({
            status: 201, contentType: 'application/json',
            body: JSON.stringify(TEST_LOBBY),
        });
    });
    await page.locator('#create-lobby-btn').tap();
    await expect(page).toHaveURL(/\/lobby\/MOB002/, { timeout: 5000 });
}

test.describe('Lobby page', () => {
    test('lobby code is visible', async ({ page }) => {
        await gotoLobbyMobile(page);
        await expect(page.locator('.lobby-code')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('.lobby-code')).toContainText('MOB002');
    });

    test('Leave button has adequate touch target (≥ 44px)', async ({ page }) => {
        await gotoLobbyMobile(page);
        const box = await page.locator('#leave-lobby-btn').boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
    });

    test('Ready button has adequate touch target (≥ 44px)', async ({ page }) => {
        await gotoLobbyMobile(page);
        const box = await page.locator('#ready-btn').boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
    });

    test('no horizontal overflow on lobby page', async ({ page }) => {
        await gotoLobbyMobile(page);
        const noOverflow = await page.evaluate(() =>
            document.body.scrollWidth <= document.body.clientWidth
        );
        expect(noOverflow).toBe(true);
    });

    test('Leave button taps and navigates home', async ({ page }) => {
        await gotoLobbyMobile(page);
        await page.locator('#leave-lobby-btn').tap();
        await expect(page).toHaveURL('/', { timeout: 4000 });
    });
});
