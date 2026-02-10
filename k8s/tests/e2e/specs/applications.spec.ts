import { test, expect } from '@playwright/test';

/**
 * Application-specific tests
 * 
 * Verifies that each application is correctly loaded and functional.
 */

const APPS = [
    { name: 'L2P', url: 'https://l2p.korczewski.de', title: /L2P|Learn|Quiz/i, protected: true },
    { name: 'VideoVault', url: 'https://videovault.korczewski.de', title: /MediaVault|VideoVault|Video/i, protected: true },
    { name: 'Shop', url: 'https://shop.korczewski.de', title: /Shop/i, protected: true },
    { name: 'Dashboard', url: 'https://dashboard.korczewski.de', title: /Dashboard/i, protected: true },
];

test.describe('Application Health & UI', () => {

    for (const app of APPS) {
        test(`App: ${app.name} is reachable`, async ({ page }) => {
            const response = await page.goto(app.url);

            if (app.protected) {
                // ForwardAuth must block unauthenticated access
                expect(response?.status(), `${app.name} should be protected by ForwardAuth`).toBe(401);
            } else {
                expect(response?.status(), `${app.name} should be publicly accessible`).toBe(200);
                await expect(page).toHaveTitle(app.title);
            }
        });
    }

    test('L2P API health endpoint responds', async ({ request }) => {
        const response = await request.get('https://l2p.korczewski.de/api/health');
        // Health endpoint is behind ForwardAuth, so 401 is expected without auth
        expect(response.status(), 'Health endpoint should return 401 behind ForwardAuth').toBe(401);
    });
});
