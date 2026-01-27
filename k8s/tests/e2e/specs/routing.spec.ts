import { test, expect } from '@playwright/test';

/**
 * Routing & Domain Alias Tests
 * 
 * Verifies that domain aliases route to the correct services.
 */

const ALIASES = [
    { alias: 'https://video.korczewski.de', targetMatch: /mediavault|videovault/i },
    { alias: 'https://shop.korczewski.de', targetMatch: /payment|shop/i },
    { alias: 'https://l2p.korczewski.de/api/health', targetMatch: null }, // Just check connectivity
];

test.describe('Domain Aliases & Routing', () => {
    for (const item of ALIASES) {
        test(`Alias: ${item.alias} is correctly routed`, async ({ page }) => {
            const response = await page.goto(item.alias);

            // Should be reachable (may be 401 if protected, that's fine for routing check)
            expect(response?.status()).toBeLessThan(500);
            expect([200, 304, 401]).toContain(response?.status());

            // If we got a 200, check content
            if (response?.status() === 200 && item.targetMatch) {
                const content = await page.content();
                expect(content).toMatch(item.targetMatch);
            }
        });
    }

    test('Trailing slash normalization', async ({ request }) => {
        // Traefik often normalizes or redirects for trailing slashes
        const res = await request.get('https://auth.korczewski.de/login/');
        expect(res.ok()).toBeTruthy();
    });
});
