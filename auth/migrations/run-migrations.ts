#!/usr/bin/env tsx
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set');
  process.exit(1);
}

async function runMigrations() {
  const sql = postgres(DATABASE_URL!, { max: 1 });

  try {
    console.log('🚀 Starting database migrations...\n');

    const [{ to_regclass: usersTable }] = await sql`SELECT to_regclass('auth.users')`;
    if (!usersTable) {
      console.log('Running migration 001_create_auth_schema.sql...');
      const migration001 = readFileSync(join(__dirname, '001_create_auth_schema.sql'), 'utf-8');
      await sql.unsafe(migration001);
      console.log('✅ Migration 001 completed successfully\\n');
    } else {
      console.log('Skipping migration 001 (auth.users already exists)\\n');
    }

    const [{ to_regclass: appsTable }] = await sql`SELECT to_regclass('auth.apps')`;
    if (!appsTable) {
      console.log('Running migration 002_add_apps_and_access.sql...');
      const migration002 = readFileSync(join(__dirname, '002_add_apps_and_access.sql'), 'utf-8');
      await sql.unsafe(migration002);
      console.log('✅ Migration 002 completed successfully\\n');
    } else {
      console.log('Skipping migration 002 (auth.apps already exists)\\n');
    }

    console.log('🎉 All migrations completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

runMigrations();
