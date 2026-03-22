/**
 * Jest setup file for backend tests only
 * This file is automatically loaded by Jest for backend tests
 */

import { afterEach, beforeAll, afterAll } from '@jest/globals';
import { TestCleanup } from './test-cleanup';

// Track if we've already set up global cleanup
let globalCleanupSetup = false;

// Set up global cleanup that runs after all tests
if (!globalCleanupSetup) {
    globalCleanupSetup = true;

    // Add cleanup after each test suite
    afterEach(async () => {
        // Only run in integration tests where database is available
        if (process.env.TEST_TYPE === 'integration' && process.env['NODE_ENV'] === 'test') {
            try {
                // Dynamic import to avoid issues when database isn't available
                const { DatabaseService } = await import('../../backend/dist/services/DatabaseService.js')
                    .catch(() => ({ DatabaseService: null }));

                if (DatabaseService) {
                    const dbService = DatabaseService.getInstance();
                    await TestCleanup.cleanupPaginationTestData(dbService);
                }
            } catch (error) {
                // Silently ignore database cleanup errors in unit tests
                if (process.env.TEST_TYPE === 'integration') {
                    console.warn('⚠️ Failed to cleanup test data:', error);
                }
            }
        }
    });

    // Global cleanup on process exit
    process.on('exit', async () => {
        if (process.env.TEST_TYPE === 'integration' && process.env['NODE_ENV'] === 'test') {
            try {
                const { DatabaseService } = await import('../../backend/dist/services/DatabaseService.js')
                    .catch(() => ({ DatabaseService: null }));

                if (DatabaseService) {
                    const dbService = DatabaseService.getInstance();
                    await TestCleanup.cleanupPaginationTestData(dbService);
                }
            } catch (error) {
                // Silent cleanup on exit
            }
        }
    });
}
