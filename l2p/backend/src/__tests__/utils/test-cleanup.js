import { Pool } from 'pg';

/**
 * Test cleanup utility for production database
 * This ensures that test data is properly cleaned up after tests
 */

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

/**
 * Prefix for test data to identify and clean up
 */
export const TEST_DATA_PREFIX = 'test_';

/**
 * Clean up test data from production database
 * This should be called in afterAll hooks
 */
export async function cleanupTestData() {
    if (process.env.USE_PROD_DB_FOR_TESTS !== 'true') {
        // Not using production DB, no cleanup needed
        return;
    }

    const client = await pool.connect();
    try {
        console.log('🧹 Cleaning up test data from production database...');

        // Clean up test users
        await client.query(`
      DELETE FROM users 
      WHERE username LIKE $1 
         OR email LIKE $1
         OR id IN (
           SELECT user_id FROM players WHERE username LIKE $1
         )
    `, [`${TEST_DATA_PREFIX}%`]);

        // Clean up test players
        await client.query(`
      DELETE FROM players 
      WHERE username LIKE $1
    `, [`${TEST_DATA_PREFIX}%`]);

        // Clean up test lobbies
        await client.query(`
      DELETE FROM lobbies 
      WHERE code LIKE $1
    `, [`${TEST_DATA_PREFIX}%`]);

        // Clean up test game sessions
        await client.query(`
      DELETE FROM game_sessions 
      WHERE lobby_id IN (
        SELECT id FROM lobbies WHERE code LIKE $1
      )
    `, [`${TEST_DATA_PREFIX}%`]);

        // Clean up test question sets
        await client.query(`
      DELETE FROM question_sets 
      WHERE name LIKE $1
    `, [`${TEST_DATA_PREFIX}%`]);

        // Clean up test questions
        await client.query(`
      DELETE FROM questions 
      WHERE question_set_id IN (
        SELECT id FROM question_sets WHERE name LIKE $1
      )
    `, [`${TEST_DATA_PREFIX}%`]);

        console.log('✅ Test data cleanup completed');
    } catch (error) {
        console.error('❌ Error cleaning up test data:', error);
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Close the database pool
 * This should be called in global teardown
 */
export async function closePool() {
    await pool.end();
}

/**
 * Generate a test username with the test prefix
 */
export function generateTestUsername(base) {
    return `${TEST_DATA_PREFIX}${base}_${Date.now()}`;
}

/**
 * Generate a test email with the test prefix
 */
export function generateTestEmail(base) {
    return `${TEST_DATA_PREFIX}${base}_${Date.now()}@test.example.com`;
}

/**
 * Generate a test lobby code with the test prefix
 */
export function generateTestLobbyCode() {
    return `${TEST_DATA_PREFIX}${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}
