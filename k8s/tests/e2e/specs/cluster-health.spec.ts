import { test, expect } from '@playwright/test';

/**
 * K3d Cluster Health & Connectivity Tests
 *
 * Tests that all services in the k3d cluster are:
 * 1. Responding to health checks
 * 2. Properly routed through Traefik
 * 3. Accessible via their public URLs
 */

// Public service health endpoints (no auth required)
const PUBLIC_SERVICES = [
  { name: 'auth', healthUrl: 'https://auth.korczewski.de/health' },
  { name: 'l2p-backend', healthUrl: 'https://l2p.korczewski.de/api/health' },
  { name: 'l2p-frontend', healthUrl: 'https://l2p.korczewski.de' },
  { name: 'videovault', healthUrl: 'https://videovault.korczewski.de/api/health' },
];

// Services that require authentication (should return 401 without auth)
const AUTH_REQUIRED_SERVICES = [
  { name: 'payment', healthUrl: 'https://payment.korczewski.de' },
  { name: 'dashboard', healthUrl: 'https://dashboard.korczewski.de/health' },
];

// All services combined for concurrent testing
const ALL_SERVICES = [...PUBLIC_SERVICES, ...AUTH_REQUIRED_SERVICES];

test.describe('K3d Cluster Health', () => {
  test.describe('Public Service Health Endpoints', () => {
    for (const service of PUBLIC_SERVICES) {
      test(`${service.name} returns 2xx`, async ({ request }) => {
        const response = await request.get(service.healthUrl, {
          timeout: 10000,
        });

        expect(
          response.ok(),
          `${service.name} at ${service.healthUrl} should return 2xx, got ${response.status()}`
        ).toBeTruthy();
      });
    }
  });

  test.describe('Auth-Protected Service Endpoints', () => {
    for (const service of AUTH_REQUIRED_SERVICES) {
      test(`${service.name} returns 401 (auth required)`, async ({ request }) => {
        const response = await request.get(service.healthUrl, {
          timeout: 10000,
          failOnStatusCode: false,
        });

        // These services require authentication, so 401 is the expected response
        expect(
          response.status(),
          `${service.name} should return 401 (auth required), got ${response.status()}`
        ).toBe(401);
      });
    }

    test('traefik responds to requests', async ({ request }) => {
      // Test that Traefik is working by verifying it's routing traffic
      // The dashboard may not be publicly exposed, but Traefik is definitely
      // working since all other services are being routed correctly
      const response = await request.get('https://traefik.korczewski.de/', {
        timeout: 10000,
        failOnStatusCode: false,
      });

      // Traefik may return: 200 (dashboard), 401 (auth required), 404 (not exposed), 302/308 (redirect)
      // Any response indicates Traefik is running and accepting requests
      expect(
        response.status() < 500,
        `Traefik should respond without server error (got ${response.status()})`
      ).toBeTruthy();
    });
  });

  test.describe('Service Response Validation', () => {
    test('L2P backend returns valid health response', async ({ request }) => {
      const response = await request.get('https://l2p.korczewski.de/api/health');
      expect(response.ok()).toBeTruthy();

      const body = await response.json();
      expect(body).toHaveProperty('status');
    });

    test('Auth service returns valid health response', async ({ request }) => {
      const response = await request.get('https://auth.korczewski.de/health');
      expect(response.ok()).toBeTruthy();

      const body = await response.json();
      expect(body).toHaveProperty('status');
    });

    test('VideoVault returns valid health response', async ({ request }) => {
      const response = await request.get('https://videovault.korczewski.de/api/health');
      expect(response.ok()).toBeTruthy();
    });
  });
});

test.describe('Traefik Routing', () => {
  test('HTTP to HTTPS redirect works', async ({ request }) => {
    // Test that HTTP requests are redirected to HTTPS
    const response = await request.get('http://l2p.korczewski.de', {
      maxRedirects: 0,
      failOnStatusCode: false,
    });

    // Traefik should return 308 Permanent Redirect
    expect(
      [301, 302, 307, 308].includes(response.status()),
      `HTTP should redirect to HTTPS, got ${response.status()}`
    ).toBeTruthy();
  });

  test('L2P frontend loads correctly', async ({ page }) => {
    await page.goto('https://l2p.korczewski.de');

    // Should load the L2P frontend (React app)
    // Check for page title or known element
    await expect(page).toHaveTitle(/L2P|Learn|Quiz/i, { timeout: 15000 });
  });

  test('Auth service login page is accessible', async ({ page }) => {
    const response = await page.goto('https://auth.korczewski.de/login');

    expect(response?.ok() || response?.status() === 304).toBeTruthy();
  });

  test('Payment service requires authentication', async ({ page }) => {
    const response = await page.goto('https://payment.korczewski.de');

    // Payment requires auth, so we expect 401 or redirect to auth service
    expect(
      response?.status() === 401 || response?.url().includes('auth.korczewski.de')
    ).toBeTruthy();
  });

  test('VideoVault frontend loads correctly', async ({ page }) => {
    const response = await page.goto('https://videovault.korczewski.de');

    expect(response?.ok()).toBeTruthy();
  });
});

test.describe('Cross-Service Connectivity', () => {
  test('L2P backend can be reached from frontend domain', async ({ request }) => {
    // Test that the API routing works correctly
    const response = await request.get('https://l2p.korczewski.de/api/health');
    expect(response.ok()).toBeTruthy();
  });

  test('Multiple public services respond to concurrent requests', async ({ request }) => {
    // Test that public services can handle concurrent requests
    const requests = PUBLIC_SERVICES.map((service) =>
      request.get(service.healthUrl, { timeout: 10000 })
    );

    const responses = await Promise.all(requests);

    responses.forEach((response, index) => {
      expect(
        response.ok(),
        `${PUBLIC_SERVICES[index].name} should respond successfully to concurrent request`
      ).toBeTruthy();
    });
  });
});

test.describe('Infrastructure Services', () => {
  test('PostgreSQL is accessible via service health', async ({ request }) => {
    // We test PostgreSQL indirectly via services that depend on it
    // Auth service requires PostgreSQL to function
    const response = await request.get('https://auth.korczewski.de/health');
    expect(response.ok()).toBeTruthy();

    // If auth is healthy, PostgreSQL is working
  });

  test('All domain aliases work', async ({ request }) => {
    // Test that domain aliases resolve correctly
    const aliases = [
      { primary: 'https://videovault.korczewski.de/api/health', alias: 'https://video.korczewski.de/api/health' },
      { primary: 'https://payment.korczewski.de', alias: 'https://shop.korczewski.de' },
    ];

    for (const { primary, alias } of aliases) {
      const primaryResponse = await request.get(primary, { failOnStatusCode: false });
      const aliasResponse = await request.get(alias, { failOnStatusCode: false });

      // Both should be accessible (may redirect to auth)
      expect(
        [200, 302, 401].includes(primaryResponse.status()),
        `Primary ${primary} should be accessible`
      ).toBeTruthy();
      expect(
        [200, 302, 401].includes(aliasResponse.status()),
        `Alias ${alias} should be accessible`
      ).toBeTruthy();
    }
  });
});
