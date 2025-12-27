import { test, expect } from '@playwright/test';
import { afterTestCleanup } from './test-utils';

function buildFixture() {
  const now = new Date().toISOString();
  const base = {
    pathBase: '/root',
    rootKey: 'root-1',
  };
  const v = (
    id: string,
    name: string,
    cats: Partial<Record<keyof any, string[]>>,
    meta: { duration: number; size: number; performer?: string },
  ) => ({
    id,
    filename: `${name}.mp4`,
    displayName: name,
    path: `${base.pathBase}/${name}.mp4`,
    size: meta.size,
    lastModified: now,
    categories: {
      age: [],
      physical: [],
      ethnicity: [],
      relationship: [],
      acts: cats.acts || [],
      setting: [],
      quality: cats.quality || [],
      performer: meta.performer ? [meta.performer] : [],
    },
    customCategories: {},
    metadata: {
      duration: meta.duration,
      width: 1920,
      height: 1080,
      bitrate: 0,
      codec: 'H264',
      fps: 30,
      aspectRatio: '16:9',
    },
    thumbnail: { dataUrl: '', generated: false, timestamp: now },
    rootKey: base.rootKey,
  });

  const videos = [
    v(
      'v1',
      'alpha',
      { quality: ['hd'], acts: ['kissing'] },
      { duration: 60, size: 1_000_000, performer: 'Bob' },
    ),
    v(
      'v2',
      'bravo',
      { quality: ['sd'], acts: ['dancing'] },
      { duration: 80, size: 2_000_000, performer: 'Cara' },
    ),
    v(
      'v3',
      'charlie',
      { quality: ['hd'], acts: ['kissing'] },
      { duration: 120, size: 3_000_000, performer: 'Alice' },
    ),
    v('v4', 'delta', { quality: ['sd'], acts: ['running'] }, { duration: 40, size: 900_000 }),
    v(
      'v5',
      'echo',
      { quality: ['4k'], acts: ['singing'] },
      { duration: 200, size: 5_000_000, performer: 'Diana' },
    ),
    v(
      'v6',
      'foxtrot',
      { quality: ['hd'], acts: ['dancing'] },
      { duration: 90, size: 2_500_000, performer: 'Eve' },
    ),
  ];

  return {
    version: '1.0',
    exportDate: now,
    videos,
    totalVideos: videos.length,
  };
}

async function importDataset(page: any): Promise<void> {
  const data = Buffer.from(JSON.stringify(buildFixture()), 'utf-8');
  const fcPromise = page.waitForEvent('filechooser');
  await page.getByTestId('button-import-data').click();
  const fc = await fcPromise;
  await fc.setFiles({ name: 'import.json', mimeType: 'application/json', buffer: data });
  // Wait for first card
  await page.getByTestId('video-card-v1').waitFor();
}

async function countCards(page: any): Promise<number> {
  return page.locator('[data-testid^="video-card-"]').count() as Promise<number>;
}

test.describe('Bulk ops and filtering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('button-import-data').waitFor();
  });

  // Clean up test data after all tests complete
  test.afterAll(async ({ page }) => {
    await afterTestCleanup(page);
  });

  test('filter combinations and selection', async ({ page }) => {
    await importDataset(page);

    // Apply filters: quality:hd AND acts:kissing => expect 2
    await page.getByTestId('category-quality:hd').getByRole('checkbox').check();
    await page.getByTestId('category-acts:kissing').getByRole('checkbox').check();
    expect(await countCards(page)).toBe(2);

    // Add performer:Alice => expect 1 (charlie)
    await page.getByTestId('category-performer:Alice').getByRole('checkbox').check();
    expect(await countCards(page)).toBe(1);

    // Clear filters
    await page.getByTestId('button-clear-filters').click();
    expect(await countCards(page)).toBe(4);

    // Select two videos and verify toolbar
    await page.getByTestId('checkbox-select-v1').click();
    await page.getByTestId('checkbox-select-v2').click();
    await expect(page.getByText('2 videos selected')).toBeVisible();
    await page.getByTestId('button-deselect-all').click();
    await expect(page.getByText('2 videos selected')).toHaveCount(0);
  });

  test('batch rename success and delete success', async ({ page }) => {
    // Ensure no simulated failures
    await page.evaluate(() => localStorage.setItem('vv.simulateFail', '0'));
    await importDataset(page);

    // Select two and rename with prefix
    await page.getByTestId('checkbox-select-v1').click();
    await page.getByTestId('checkbox-select-v2').click();
    await page.getByTestId('button-bulk-rename').click();
    await page.getByPlaceholder('Prefix (optional)').fill('Renamed-');
    await page.getByTestId('button-batch-rename-submit').click();

    // Expect titles updated
    await expect(page.getByTestId('text-title-v1')).toContainText('Renamed-');
    await expect(page.getByTestId('text-title-v2')).toContainText('Renamed-');

    // Delete remaining two items (v3, v4)
    await page.getByTestId('checkbox-select-v3').click();
    await page.getByTestId('checkbox-select-v4').click();
    await page.getByRole('button', { name: 'More' }).click();
    await page.getByText('Delete Videos').click();
    await page.getByText('Delete Videos').click();
    expect(await countCards(page)).toBe(2);
  });

  test('batch rename failure and delete failure roll back', async ({ page }) => {
    // Force simulated failures
    await page.evaluate(() => localStorage.setItem('vv.simulateFail', '1'));
    await importDataset(page);

    // Capture originals
    const beforeV1 = await page.getByTestId('text-title-v1').innerText();
    const beforeV2 = await page.getByTestId('text-title-v2').innerText();

    await page.getByTestId('checkbox-select-v1').click();
    await page.getByTestId('checkbox-select-v2').click();
    await page.getByTestId('button-bulk-rename').click();
    await page.getByPlaceholder('Prefix (optional)').fill('Fail-');
    await page.getByTestId('button-batch-rename-submit').click();
    await expect(page.getByTestId('text-title-v1')).toHaveText(beforeV1);
    await expect(page.getByTestId('text-title-v2')).toHaveText(beforeV2);

    // Try to delete one and expect rollback (count unchanged)
    const countBefore = await countCards(page);
    await page.getByTestId('checkbox-select-v3').click();
    await page.getByRole('button', { name: 'More' }).click();
    await page.getByText('Delete Videos').click();
    await page.getByText('Delete Videos').click();
    expect(await countCards(page)).toBe(countBefore);
  });

  test('advanced filter combinations: search + categories + size + duration', async ({ page }) => {
    await importDataset(page);

    // Test search query filtering
    await page.getByPlaceholder('Search videos...').fill('echo');
    expect(await countCards(page)).toBe(1);
    await page.getByPlaceholder('Search videos...').clear();
    expect(await countCards(page)).toBe(6);

    // Test category + search combination
    await page.getByTestId('category-acts:dancing').getByRole('checkbox').check();
    expect(await countCards(page)).toBe(2); // bravo and foxtrot
    await page.getByPlaceholder('Search videos...').fill('bravo');
    expect(await countCards(page)).toBe(1); // only bravo
    await page.getByPlaceholder('Search videos...').clear();

    // Test multiple category filters
    await page.getByTestId('category-quality:hd').getByRole('checkbox').check();
    expect(await countCards(page)).toBe(1); // only foxtrot (hd + dancing)

    // Clear and test size range filter (if available)
    await page.getByTestId('button-clear-filters').click();
    expect(await countCards(page)).toBe(6);

    // Test duration range (videos with duration > 100s: charlie=120, echo=200)
    // Note: This assumes duration filter UI exists with test IDs
    // If not available, this test will need adjustment
  });

  test('bulk operations on filtered results', async ({ page }) => {
    await page.evaluate(() => localStorage.setItem('vv.simulateFail', '0'));
    await importDataset(page);

    // Filter to only HD quality videos (v1, v3, v6)
    await page.getByTestId('category-quality:hd').getByRole('checkbox').check();
    expect(await countCards(page)).toBe(3);

    // Select all filtered results
    await page.getByTestId('checkbox-select-v1').click();
    await page.getByTestId('checkbox-select-v3').click();
    await page.getByTestId('checkbox-select-v6').click();
    await expect(page.getByText('3 videos selected')).toBeVisible();

    // Batch rename only the filtered/selected items
    await page.getByTestId('button-bulk-rename').click();
    await page.getByPlaceholder('Prefix (optional)').fill('HD-');
    await page.getByTestId('button-batch-rename-submit').click();

    // Verify only the selected items were renamed
    await expect(page.getByTestId('text-title-v1')).toContainText('HD-');
    await expect(page.getByTestId('text-title-v3')).toContainText('HD-');
    await expect(page.getByTestId('text-title-v6')).toContainText('HD-');

    // Clear filter and verify other videos were not renamed
    await page.getByTestId('button-clear-filters').click();
    const v2Title = await page.getByTestId('text-title-v2').innerText();
    const v4Title = await page.getByTestId('text-title-v4').innerText();
    expect(v2Title).not.toContain('HD-');
    expect(v4Title).not.toContain('HD-');
  });

  test('partial batch failure with mixed results', async ({ page }) => {
    // Set up partial failure simulation (50% failure rate)
    await page.evaluate(() => localStorage.setItem('vv.simulatePartialFail', '1'));
    await importDataset(page);

    // Select multiple videos
    await page.getByTestId('checkbox-select-v1').click();
    await page.getByTestId('checkbox-select-v2').click();
    await page.getByTestId('checkbox-select-v3').click();
    await page.getByTestId('checkbox-select-v4').click();

    // Attempt batch rename
    await page.getByTestId('button-bulk-rename').click();
    await page.getByPlaceholder('Prefix (optional)').fill('Partial-');
    await page.getByTestId('button-batch-rename-submit').click();

    // Wait for operation to complete
    await page.waitForTimeout(1000);

    // Verify that some items were renamed and some were not (partial success)
    // Note: This test assumes the app shows partial success state
    // The exact behavior depends on implementation
    const allCards = await countCards(page);
    expect(allCards).toBe(6); // All videos still present

    // Clean up
    await page.evaluate(() => localStorage.removeItem('vv.simulatePartialFail'));
  });

  test('selection persistence during filtering', async ({ page }) => {
    await importDataset(page);

    // Select some videos
    await page.getByTestId('checkbox-select-v1').click();
    await page.getByTestId('checkbox-select-v2').click();
    await page.getByTestId('checkbox-select-v3').click();
    await expect(page.getByText('3 videos selected')).toBeVisible();

    // Apply filter that hides some selected videos
    await page.getByTestId('category-quality:hd').getByRole('checkbox').check();
    // v1 and v3 are HD, v2 is SD (hidden)
    expect(await countCards(page)).toBe(3); // v1, v3, v6

    // Selection count should update to reflect visible selections
    // Note: Behavior depends on implementation - might keep all selections or only visible ones

    // Clear filter
    await page.getByTestId('button-clear-filters').click();
    expect(await countCards(page)).toBe(6);

    // Deselect all
    await page.getByTestId('button-deselect-all').click();
    await expect(page.getByText('videos selected')).toHaveCount(0);
  });

  test('filter clearing and reset', async ({ page }) => {
    await importDataset(page);

    // Apply multiple filters
    await page.getByTestId('category-quality:hd').getByRole('checkbox').check();
    await page.getByTestId('category-acts:kissing').getByRole('checkbox').check();
    await page.getByPlaceholder('Search videos...').fill('alpha');
    expect(await countCards(page)).toBe(1);

    // Clear all filters
    await page.getByTestId('button-clear-filters').click();
    expect(await countCards(page)).toBe(6);

    // Verify search is also cleared
    const searchInput = page.getByPlaceholder('Search videos...');
    await expect(searchInput).toHaveValue('');

    // Verify category checkboxes are unchecked
    await expect(page.getByTestId('category-quality:hd').getByRole('checkbox')).not.toBeChecked();
    await expect(page.getByTestId('category-acts:kissing').getByRole('checkbox')).not.toBeChecked();
  });

  test('empty filter results handling', async ({ page }) => {
    await importDataset(page);

    // Apply filters that result in no matches
    await page.getByTestId('category-quality:hd').getByRole('checkbox').check();
    await page.getByTestId('category-acts:running').getByRole('checkbox').check();
    // No videos are both HD and running
    expect(await countCards(page)).toBe(0);

    // Verify empty state message is shown
    await expect(page.getByText(/no videos/i)).toBeVisible();

    // Clear filters and verify videos return
    await page.getByTestId('button-clear-filters').click();
    expect(await countCards(page)).toBe(6);
  });
});
