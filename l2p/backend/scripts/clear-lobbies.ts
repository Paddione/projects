import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/l2p',
  ssl: process.env['NODE_ENV'] === 'production' ? { rejectUnauthorized: false } : false
});

async function clearAllLobbies() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Delete all player answers first (if foreign key constraints exist)
    await client.query('DELETE FROM player_answers');
    
    // Delete all game sessions
    await client.query('DELETE FROM game_sessions');
    
    // Clear all lobbies
    const result = await client.query('DELETE FROM lobbies RETURNING *');
    
    await client.query('COMMIT');
    console.log(`Successfully cleared ${result.rowCount} lobbies`);
    return result.rows;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error clearing lobbies:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

clearAllLobbies()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to clear lobbies:', error);
    process.exit(1);
  });
