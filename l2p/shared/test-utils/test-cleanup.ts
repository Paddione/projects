/**
 * Test cleanup utilities to ensure tests clean up after themselves
 * Prevents accumulation of test data, especially pagination test sets
 */

export interface TestDataTracker {
    questionSetIds: number[];
    questionIds: number[];
    userIds: number[];
}

export interface DatabaseService {
    query(sql: string, params?: any[]): Promise<{ rowCount?: number; rows: any[] }>;
}

export class TestCleanup {
    private tracker: TestDataTracker = {
        questionSetIds: [],
        questionIds: [],
        userIds: []
    };

    /**
     * Track a question set ID for cleanup
     */
    trackQuestionSet(id: number): void {
        this.tracker.questionSetIds.push(id);
    }

    /**
     * Track a question ID for cleanup
     */
    trackQuestion(id: number): void {
        this.tracker.questionIds.push(id);
    }

    /**
     * Track a user ID for cleanup
     */
    trackUser(id: number): void {
        this.tracker.userIds.push(id);
    }

    /**
     * Clean up all tracked test data
     */
    async cleanup(dbService: DatabaseService): Promise<void> {
        try {
            // Clean up questions first (due to foreign key constraints)
            if (this.tracker.questionIds.length > 0) {
                const questionIdList = this.tracker.questionIds.join(',');
                await dbService.query(`DELETE FROM questions WHERE id IN (${questionIdList})`);
                console.log(`🗑️ Cleaned up ${this.tracker.questionIds.length} test questions`);
            }

            // Clean up question sets
            if (this.tracker.questionSetIds.length > 0) {
                const setIdList = this.tracker.questionSetIds.join(',');
                // First clean up any remaining questions in these sets
                await dbService.query(`DELETE FROM questions WHERE question_set_id IN (${setIdList})`);
                await dbService.query(`DELETE FROM question_sets WHERE id IN (${setIdList})`);
                console.log(`🗑️ Cleaned up ${this.tracker.questionSetIds.length} test question sets`);
            }

            // Clean up users (if any test users were created)
            if (this.tracker.userIds.length > 0) {
                const userIdList = this.tracker.userIds.join(',');
                await dbService.query(`DELETE FROM users WHERE id IN (${userIdList})`);
                console.log(`🗑️ Cleaned up ${this.tracker.userIds.length} test users`);
            }

            // Reset tracker
            this.tracker = {
                questionSetIds: [],
                questionIds: [],
                userIds: []
            };

        } catch (error) {
            console.warn('⚠️ Error during test cleanup:', error);
        }
    }

    /**
     * Clean up pagination test data by name patterns
     * This helps clean up any leftover pagination test data
     */
    static async cleanupPaginationTestData(dbService: DatabaseService): Promise<void> {
        try {
            const paginationPatterns = [
                '%PagTest%',
                '%Paginated Set%',
                '%Debug Test Set%',
                '%Std Pagination Set%'
            ];

            for (const pattern of paginationPatterns) {
                // Clean up questions first
                const questionResult = await dbService.query(
                    'DELETE FROM questions WHERE question_set_id IN (SELECT id FROM question_sets WHERE name LIKE $1 OR description LIKE $2)',
                    [pattern, '%pagination test%']
                );

                // Clean up question sets
                const setResult = await dbService.query(
                    'DELETE FROM question_sets WHERE name LIKE $1 OR description LIKE $2',
                    [pattern, '%pagination test%']
                );

                if (setResult.rowCount && setResult.rowCount > 0) {
                    console.log(`🗑️ Cleaned up ${setResult.rowCount} pagination test sets matching pattern: ${pattern}`);
                }
            }

        } catch (error) {
            console.warn('⚠️ Error during pagination test data cleanup:', error);
        }
    }

    /**
     * Create a test cleanup instance with automatic cleanup on process exit
     */
    static createWithAutoCleanup(dbService: DatabaseService): TestCleanup {
        const cleanup = new TestCleanup();

        // Register cleanup on process exit
        const cleanupHandler = async () => {
            await cleanup.cleanup(dbService);
            await TestCleanup.cleanupPaginationTestData(dbService);
        };

        process.on('exit', cleanupHandler);
        process.on('SIGINT', cleanupHandler);
        process.on('SIGTERM', cleanupHandler);
        process.on('uncaughtException', cleanupHandler);

        return cleanup;
    }
}

/**
 * Helper function for Jest/Playwright tests to set up cleanup
 */
export function setupTestCleanup(dbService: DatabaseService): TestCleanup {
    return TestCleanup.createWithAutoCleanup(dbService);
}

/**
 * Utility to generate test names that avoid pagination patterns
 * This helps prevent accidental creation of data that looks like pagination tests
 */
export function generateTestName(prefix: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 8);
    // Avoid patterns that might be mistaken for pagination test data
    return `${prefix}-${timestamp}-${random}`;
}
