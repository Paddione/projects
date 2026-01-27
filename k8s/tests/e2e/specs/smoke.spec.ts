import { test, expect } from '@playwright/test';

/**
 * Smoke tests for the K3d Cluster
 * 
 * Verifies that the infrastructure is up and basic routing works.
 */

const ENDPOINTS = [
    { name: 'Auth UI', url: 'https://auth.korczewski.de/login' },
    { name: 'Traefik Dashboard', url: 'https://traefik.korczewski.de/dashboard/', expectedStatus: [200, 401] },
];

test.describe('Infrastructure Smoke Tests', () => {
    for (const endpoint of ENDPOINTS) {
        test(`Connectivity: ${endpoint.name}`, async ({ request }) => {
            const response = await request.get(endpoint.url, { failOnStatusCode: false });

            if (endpoint.expectedStatus) {
                expect(endpoint.expectedStatus).toContain(response.status());
            } else {
                expect(response.ok() || response.status() === 302 || response.status() === 308).toBeTruthy();
            }
        });
    }

    test('HTTPS Redirection', async ({ request }) => {
        const response = await request.get('http://auth.korczewski.de', {
            maxRedirects: 0,
            failOnStatusCode: false,
        });
        // Should be a redirect (301, 302, 307, 308)
        expect(response.status()).toBeGreaterThanOrEqual(301);
        expect(response.status()).toBeLessThanOrEqual(308);
    });
});
