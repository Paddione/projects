import { test, expect } from '@playwright/test';

/**
 * Routing & Domain Alias Tests
 * 
 * Verifies that domain aliases route to the correct services.
 */

const ALIASES = [
    { alias: 'https://video.korczewski.de', expectedStatus: 401 },
    { alias: 'https://shop.korczewski.de', expectedStatus: 401 },
    { alias: 'https://l2p.korczewski.de/api/health', expectedStatus: 401 },
];

test.describe('Domain Aliases & Routing', () => {
    for (const item of ALIASES) {
        test(`Alias: ${item.alias} is correctly routed`, async ({ page }) => {
            const response = await page.goto(item.alias);

            // A 401 proves both that the route exists (not 404) and ForwardAuth is protecting it.
            // A 404 or 5xx would indicate a routing misconfiguration.
            expect(response?.status(), `${item.alias} should be routed and protected`).toBe(item.expectedStatus);
        });
    }

    test('Trailing slash normalization', async ({ request }) => {
        // Traefik often normalizes or redirects for trailing slashes
        const res = await request.get('https://auth.korczewski.de/login/');
        expect(res.ok()).toBeTruthy();
    });
});
