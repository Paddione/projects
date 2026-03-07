import { test, expect } from '@playwright/test';

test('page loads with correct title', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle('Taschentherapeut – Prototyp');
});

test('breathing animation headline is visible', async ({ page }) => {
  await page.goto('/');
  const headline = page.locator('.atem-headline').first();
  await expect(headline).toBeVisible();
});

test('menu navigation to SOS screen', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-screen="sos"]');
  const sosHeading = page.locator('text=Hilfe - SOS – Notfall').first();
  await expect(sosHeading).toBeVisible();
});

test('emergency number 112 is displayed', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-screen="sos"]');
  const text = await page.textContent('body');
  expect(text).toContain('112');
});

test('Telefonseelsorge hotline is displayed', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-screen="sos"]');
  const text = await page.textContent('body');
  expect(text).toContain('Telefonseelsorge');
});

test('all 15 menu items are present', async ({ page }) => {
  await page.goto('/');
  const buttons = page.locator('.main-btn');
  await expect(buttons).toHaveCount(15);
});

test('crisis plan has fillable inputs', async ({ page }) => {
  await page.goto('/');
  await page.click('[data-screen="sos"]');
  const inputs = page.locator('.plan-input');
  const count = await inputs.count();
  expect(count).toBeGreaterThan(0);
});

test('health endpoint returns OK', async ({ request }) => {
  const res = await request.get('/health');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.status).toBe('OK');
  expect(body.service).toBe('sos');
});
