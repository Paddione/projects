import { test, expect } from '@playwright/test';

test.describe('VideoVault smoke', () => {
  test('loads home and shows header and sidebar', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('heading', { name: 'Video Category Manager' }).waitFor();
    await expect(page.getByTestId('button-scan-directory')).toBeVisible();
    await expect(page.getByTestId('button-clear-filters')).toBeVisible();
    await expect(page.getByTestId('input-search')).toBeVisible();
  });

  test('theme toggle switches html class', async ({ page }) => {
    await page.goto('/');
    const html = page.locator('html');
    await expect(html).toHaveClass(/light/);
    await page.getByTestId('button-theme-toggle').click();
    await expect(html).toHaveClass(/dark/);
  });

  test('settings dialog opens', async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('button-settings').waitFor();
    await page.getByTestId('button-settings').click();
    await page.getByRole('heading', { name: 'Settings' }).waitFor();
  });

  test('search input accepts text', async ({ page }) => {
    await page.goto('/');
    const input = page.getByTestId('input-search');
    await input.fill('cats');
    await expect(input).toHaveValue('cats');
  });

  test('server health endpoint responds', async ({ page }) => {
    const res = await page.request.get('/api/health');
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('healthy');
  });
});
