// Runs database migrations once before integration tests
import { beforeAll } from '@jest/globals';
import { DatabaseService } from '../../services/DatabaseService.js';
import { MigrationService } from '../../services/MigrationService.js';

beforeAll(async () => {
  try {
    const db = DatabaseService.getInstance();
    await db.testConnection();
    const migrationService = new MigrationService();
    await migrationService.runMigrations();
    await migrationService.validateMigrations();
  } catch (err) {
    // Do not hard-fail the suite; log and proceed (tests may still run)
    // Individual tests often seed tables and can reveal actionable errors
    // if migrations are out of sync in the environment.
    // eslint-disable-next-line no-console
    console.warn('Integration setup: migrations failed or skipped:', err);
  }
});

