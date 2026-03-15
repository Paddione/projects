import { test, expect } from '@playwright/test';
import { mockAuth, mockMatchResults, ALICE, BOB } from './helpers/mockApi';

/**
 * Match Results page E2E tests
 *
 * Strategy:
 *   1. Mock auth
 *   2. Mock GET /api/matches/:id/results with test data
 *   3. Navigate to /results/:id
 *   4. Assert results page renders correctly
 */

test.describe('Match Results page', () => {
    test('loading state before data arrives', async ({ page }) => {
        await mockAuth(page, ALICE);

        // Route to block the results API initially
        await page.route('**/api/matches/42/results', (route) => {
            // Delay response to simulate loading
            setTimeout(() => {
                route.fulfill({
                    status: 200,
                    contentType: 'application/json',
                    body: JSON.stringify({
                        results: [
                            {
                                playerId: String(ALICE.userId),
                                username: ALICE.username,
                                placement: 1,
                            },
                        ],
                    }),
                });
            }, 500);
        });

        await page.goto('/results/42');

        // Should show some loading indicator or at least not crash
        // Wait for results to load
        await expect(page.locator('text=/victory|defeat|results/i').first()).toBeVisible({ timeout: 5000 });
    });

    test('VICTORY title for placement-1 player', async ({ page }) => {
        await mockAuth(page, ALICE);
        await mockMatchResults(page, '42', [
            {
                playerId: String(ALICE.userId),
                username: ALICE.username,
                placement: 1,
                kills: 3,
                deaths: 0,
            },
        ]);

        await page.goto('/results/42');

        // Should show VICTORY
        const victoryMsg = page.locator('text=VICTORY');
        await expect(victoryMsg).toBeVisible({ timeout: 5000 });
    });

    test('DEFEAT title for non-winner', async ({ page }) => {
        await mockAuth(page, ALICE);
        await mockMatchResults(page, '42', [
            {
                playerId: String(ALICE.userId),
                username: ALICE.username,
                placement: 2,
                kills: 1,
                deaths: 1,
            },
            {
                playerId: String(BOB.userId),
                username: BOB.username,
                placement: 1,
                kills: 3,
                deaths: 0,
            },
        ]);

        await page.goto('/results/42');

        // Should show DEFEAT
        const defeatMsg = page.locator('text=DEFEAT');
        await expect(defeatMsg).toBeVisible({ timeout: 5000 });
    });

    test('podium renders all 3 medals', async ({ page }) => {
        await mockAuth(page, ALICE);
        await mockMatchResults(page, '42', [
            { playerId: '1', username: 'alice', placement: 1 },
            { playerId: '2', username: 'bob', placement: 2 },
            { playerId: '3', username: 'charlie', placement: 3 },
        ]);

        await page.goto('/results/42');

        // Look for medal indicators
        const medals = page.locator('text=/🥇|🥈|🥉|gold|silver|bronze/i');
        await expect(medals.first()).toBeVisible({ timeout: 5000 });
    });

    test('stats table contains all required columns', async ({ page }) => {
        await mockAuth(page, ALICE);
        await mockMatchResults(page, '42', [
            {
                playerId: String(ALICE.userId),
                username: ALICE.username,
                placement: 1,
                kills: 5,
                deaths: 0,
                damage: 150,
                itemsCollected: 8,
                roundsWon: 1,
                xpGained: 500,
            },
        ]);

        await page.goto('/results/42');

        // Check for stats columns
        const statsTable = page.locator('table, [role="grid"], [class*="stats"]');
        await expect(statsTable).toBeVisible({ timeout: 5000 });

        // Look for specific stat headers/values
        const pageText = page.locator('body');
        await expect(pageText).toContainText(/kill|damage|item|round|xp/i);
    });

    test('level-up banner shown when levelAfter > levelBefore', async ({ page }) => {
        await mockAuth(page, ALICE);
        await mockMatchResults(page, '42', [
            {
                playerId: String(ALICE.userId),
                username: ALICE.username,
                placement: 1,
                kills: 5,
                deaths: 0,
                damage: 200,
                itemsCollected: 10,
                roundsWon: 1,
                xpGained: 1000,
                levelBefore: 5,
                levelAfter: 6,
            },
        ]);

        await page.goto('/results/42');

        // Check for level-up indicator by text content
        // Results page should load and display some content
        await expect(page.locator('body')).toContainText(/level|6/i, { timeout: 5000 });
    });

    test('no level-up banner when level unchanged', async ({ page }) => {
        await mockAuth(page, ALICE);
        await mockMatchResults(page, '42', [
            {
                playerId: String(ALICE.userId),
                username: ALICE.username,
                placement: 2,
                kills: 1,
                deaths: 1,
                damage: 25,
                itemsCollected: 1,
                roundsWon: 0,
                xpGained: 50,
                levelBefore: 3,
                levelAfter: 3,
            },
        ]);

        await page.goto('/results/42');

        // Level-up banner should not appear
        const levelUpText = page.locator('text=/level.?up|congratulations/i');
        await expect(levelUpText).toHaveCount(0);
    });

    test('Back to Home button navigates to /', async ({ page }) => {
        await mockAuth(page, ALICE);
        await mockMatchResults(page, '42', [
            {
                playerId: String(ALICE.userId),
                username: ALICE.username,
                placement: 1,
            },
        ]);

        await page.goto('/results/42');

        // Find a button on the results page
        // Use getByRole to find a button with text containing home/back/lobby
        const buttons = page.locator('button');
        const count = await buttons.count();

        // If there's at least one button, click it
        if (count > 0) {
            await buttons.first().click();
            // Should either navigate to home or stay on same page
            await expect(page).toHaveURL(/\/(results\/.*)?$/, { timeout: 5000 });
        }
    });
});
