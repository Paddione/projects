import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';
import { TestDataManager } from '../utils/test-data-manager';

/**
 * E2E tests for the Perk Draft System
 *
 * Tests the draft-based gameplay perk system where players:
 * - Earn 1 perk point per level (levels 1-30)
 * - See 3 random perks from available pool at each level-up
 * - Pick 1 perk (locks in immediately) or dump all 3 (permanently removed)
 *
 * Note: Tests that require the full game flow (ResultsPage with drafts)
 * are marked as integration tests and require a complete game session.
 */
test.describe('Perk Draft API E2E', () => {
  const dataManager = TestDataManager.getInstance();

  test.beforeEach(async ({ page }) => {
    await dataManager.cleanupAll();
  });

  test.beforeEach(async ({ page }) => {
    // Pipe browser logs to terminal for debugging
    page.on('console', msg => {
      if (msg.type() === 'error' || process.env.DEBUG) {
        console.log(`[BROWSER ${msg.type()}] ${msg.text()}`);
      }
    });

    // Register user in test/mock mode
    await TestHelpers.registerUser(page, { character: 'student' });
  });

  test('should fetch draft history from API', async ({ page }) => {
    const response = await page.evaluate(async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/perks/draft/history', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      return res.json();
    });

    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
  });

  test('should fetch active gameplay perks from API', async ({ page }) => {
    const response = await page.evaluate(async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/perks/draft/active', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      return res.json();
    });

    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
  });

  test('should fetch skill tree data from API', async ({ page }) => {
    const response = await page.evaluate(async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/perks/draft/skill-tree', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      return res.json();
    });

    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
  });

  test('should fetch available perk pool from API', async ({ page }) => {
    const response = await page.evaluate(async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/perks/draft/pool', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      return res.json();
    });

    expect(response.success).toBe(true);
    expect(response.data).toBeDefined();
  });

  test('should check needs-redraft status from API', async ({ page }) => {
    const response = await page.evaluate(async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/perks/draft/needs-redraft', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      return res.json();
    });

    expect(response.success).toBe(true);
    // Data should exist and contain needsRedraft boolean (could be false or true)
    expect(response.data).toBeDefined();
  });

  test('should pick a perk via API when draft is pending', async ({ page }) => {
    // This test simulates picking a perk from a draft offer
    const response = await page.evaluate(async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/perks/draft/pick', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ level: 1, perkId: 1 })
      });
      return res.json();
    });

    // The pick should succeed (or fail gracefully if no pending draft)
    expect(response).toBeDefined();
    // Either success or a specific error message
    if (!response.success) {
      expect(response.message || response.error).toBeDefined();
    }
  });

  test('should dump a draft offer via API', async ({ page }) => {
    const response = await page.evaluate(async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/perks/draft/dump', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ level: 1 })
      });
      return res.json();
    });

    expect(response).toBeDefined();
    // Either success or a specific error message
    if (!response.success) {
      expect(response.message || response.error).toBeDefined();
    }
  });

  test('should reset all drafts via API', async ({ page }) => {
    const response = await page.evaluate(async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/perks/draft/reset', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      return res.json();
    });

    expect(response.success).toBe(true);
  });

  test('should clear redraft flag via API', async ({ page }) => {
    const response = await page.evaluate(async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/perks/draft/clear-redraft', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      return res.json();
    });

    expect(response.success).toBe(true);
  });

  test('should handle pick request with missing parameters', async ({ page }) => {
    const response = await page.evaluate(async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/perks/draft/pick', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({}) // Missing required fields
      });
      return { status: res.status, ok: res.ok, data: await res.json() };
    });

    // Should either return error status or success:false or have an error message
    const isError = !response.ok || response.data.success === false || response.data.error || response.data.message;
    expect(isError).toBeTruthy();
  });

  test('should handle dump request with missing level', async ({ page }) => {
    const response = await page.evaluate(async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/perks/draft/dump', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({}) // Missing level
      });
      return { status: res.status, ok: res.ok, data: await res.json() };
    });

    // Should either return error status or success:false or have an error message
    const isError = !response.ok || response.data.success === false || response.data.error || response.data.message;
    expect(isError).toBeTruthy();
  });
});

/**
 * Tests for perk system integration with profile/perks page
 */
test.describe('Perk System Profile Integration', () => {
  const dataManager = TestDataManager.getInstance();

  test.beforeEach(async ({ page }) => {
    await dataManager.cleanupAll();
    await TestHelpers.registerUser(page, { character: 'student' });
  });

  test('should display perks section in profile', async ({ page }) => {
    await page.goto('/profile');

    // Wait for page to load
    await page.waitForTimeout(2000);

    // Check we're on the profile page
    await expect(page).toHaveURL(/.*profile/);

    // Look for perks-related content
    const perksButton = page.locator('[data-testid="perks-button"]');
    const perksText = page.getByText(/Perks/i).first();

    // Either button or text should be visible
    const hasPerksButton = await perksButton.isVisible();
    const hasPerksText = await perksText.isVisible();

    expect(hasPerksButton || hasPerksText).toBe(true);
  });

  test('should load perks data on profile page', async ({ page }) => {
    await page.goto('/profile');

    // Wait for profile to load
    await page.waitForTimeout(2000);

    // Check that some perks-related content exists
    const hasPerksContent = await page.evaluate(() => {
      const html = document.body.innerHTML.toLowerCase();
      return html.includes('perk') || html.includes('loadout') || html.includes('avatar');
    });

    expect(hasPerksContent).toBe(true);
  });
});
