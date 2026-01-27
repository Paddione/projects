import { test, expect } from '@playwright/test';

/**
 * Application-specific tests
 * 
 * Verifies that each application is correctly loaded and functional.
 */

const APPS = [
    { name: 'L2P', url: 'https://l2p.korczewski.de', title: /L2P|Learn|Quiz/i },
    { name: 'VideoVault', url: 'https://videovault.korczewski.de', title: /MediaVault|VideoVault|Video/i },
    { name: 'Payment/Shop', url: 'https://payment.korczewski.de', title: /Shop|Payment/i },
    { name: 'Dashboard', url: 'https://dashboard.korczewski.de', title: /Dashboard/i },
];

test.describe('Application Health & UI', () => {
    // We skip these if not logged in, or we assume the worker is authenticated if using storageState

    for (const app of APPS) {
        test(`App: ${app.name} is reachable`, async ({ page }) => {
            const response = await page.goto(app.url);

            // Should be 200 (if public/already authed) or 401 (if protected)
            // But definitely not 404, 500, or 503.
            expect(response?.status(), `${app.name} returned ${response?.status()}`).toBeLessThan(500);
            expect([200, 304, 401]).toContain(response?.status());
        });
    }

    test('L2P API is reachable', async ({ request }) => {
        // Note: This will likely fail with 401 if not authenticated, 
        // but verifying it's NOT a 404 or 503 is also valuable.
        const response = await request.get('https://l2p.korczewski.de/api/health');
        expect(response.status()).not.toBe(404);
        expect(response.status()).not.toBe(503);
    });
});
