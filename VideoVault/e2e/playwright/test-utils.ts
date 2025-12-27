import { Page } from '@playwright/test';

/**
 * Cleanup utility for Playwright tests
 * Deletes all test data from the database
 */
export async function cleanupTestData(page: Page, baseUrl: string = 'http://localhost:5101') {
  try {
    // Get all videos
    const response = await page.request.get(`${baseUrl}/api/videos`);
    if (!response.ok()) {
      console.warn(`Failed to fetch videos for cleanup: ${response.status()}`);
      return;
    }

    const videos = (await response.json()) as Array<{ id: string }>;

    if (videos.length === 0) {
      console.log('No test data to clean up');
      return;
    }

    // Delete all videos
    const videoIds = videos.map((v) => v.id);
    const deleteResponse = await page.request.post(`${baseUrl}/api/videos/batch_delete`, {
      data: { ids: videoIds },
      headers: { 'Content-Type': 'application/json' },
    });

    if (deleteResponse.ok()) {
      const result = await deleteResponse.json();
      console.log(`Cleaned up ${result.deleted} test videos`);
    } else {
      console.warn(`Failed to delete videos: ${deleteResponse.status()}`);
    }

    // Get and delete all roots except production ones
    const rootsResponse = await page.request.get(`${baseUrl}/api/roots`);
    if (rootsResponse.ok()) {
      const rootsData = await rootsResponse.json();
      const roots = rootsData.roots || [];

      // Delete test roots (keep only production roots)
      // In this case, we delete 'root-1' and 'test_root' patterns
      for (const root of roots) {
        if (
          root.rootKey === 'root-1' ||
          root.rootKey === 'test_root' ||
          root.rootKey.includes('test')
        ) {
          const deleteRootResponse = await page.request.delete(
            `${baseUrl}/api/roots/${root.rootKey}`,
          );
          if (deleteRootResponse.ok()) {
            console.log(`Deleted test root: ${root.rootKey}`);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error during test cleanup:', error);
  }
}

/**
 * Cleanup function that can be used in afterEach or afterAll hooks
 */
export async function afterTestCleanup(page: Page) {
  console.log('Running test cleanup...');
  await cleanupTestData(page);
}
