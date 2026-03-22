import '../env.js';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../db/schema.js';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Create postgres connection
// Use a shorter connect_timeout in test environments so unit tests that mock
// the DB don't block for 10 seconds waiting for a real connection to fail.
const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';
const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: isTest ? 2 : 10,
});

// Create drizzle instance with schema
export const db = drizzle(client, { schema });

// Export client for raw queries if needed
export { client };
