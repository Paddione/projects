import { DatabaseService, DatabaseError } from './DatabaseService.js';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import crypto from 'crypto';

// Handle __dirname in ES modules with fallback for test environments
let currentDirname: string = '';

// For test environments or when import.meta is not available, use cwd
if (process.env['NODE_ENV'] === 'test') {
  currentDirname = process.cwd();
} else {
  // In production/development, we need a different approach
  // This is a workaround for ES modules - we'll use a relative path from project root
  currentDirname = join(process.cwd(), 'src', 'services');
}

export interface Migration {
  version: string;
  description: string;
  up: string;
  down?: string | undefined;
  checksum: string;
}

export class MigrationService {
  private db: DatabaseService;
  private migrationsPath: string;

  constructor() {
    this.db = DatabaseService.getInstance();
    // Fix the migrations path to point to the backend/migrations directory
    this.migrationsPath = join(process.cwd(), 'migrations');
  }

  private calculateChecksum(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private async ensureMigrationsTable(): Promise<void> {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        version VARCHAR(50) UNIQUE NOT NULL,
        description TEXT,
        applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        checksum VARCHAR(64)
      );
    `;

    await this.db.query(createTableQuery);
  }

  private async getAppliedMigrations(): Promise<string[]> {
    const result = await this.db.query(
      'SELECT version FROM schema_migrations ORDER BY version'
    );
    return result.rows.map((row: any) => row.version);
  }

  private async recordMigration(migration: Migration): Promise<void> {
    await this.db.query(
      'INSERT INTO schema_migrations (version, description, checksum) VALUES ($1, $2, $3)',
      [migration.version, migration.description, migration.checksum]
    );
  }

  private async removeMigrationRecord(version: string): Promise<void> {
    await this.db.query(
      'DELETE FROM schema_migrations WHERE version = $1',
      [version]
    );
  }

  private loadMigrationFiles(): Migration[] {
    const migrations: Migration[] = [];
    const seenVersions = new Set<string>();

    try {
      const files = readdirSync(this.migrationsPath)
        .filter(file => file.endsWith('.sql'))
        .sort();

      for (const file of files) {
        const filePath = join(this.migrationsPath, file);
        const content = readFileSync(filePath, 'utf8');

        // Parse migration file format: YYYYMMDD_HHMMSS_description.sql
        const match = file.match(/^(\d{8}_\d{6})_(.+)\.sql$/);
        if (!match) {
          console.warn(`Skipping invalid migration file: ${file}`);
          continue;
        }

        const version = match[1] as string;
        const description = match[2] as string;

        // Skip duplicates of the same version to prevent schema_migrations constraint errors
        if (seenVersions.has(version)) {
          console.warn(`Skipping duplicate migration version ${version} from file: ${file}`);
          continue;
        }

        if (!version || !description) {
          console.warn(`Invalid migration file format: ${file}`);
          continue;
        }

        // Split up and down migrations if present
        const parts = content.split('-- DOWN MIGRATION');
        const upPart = parts[0];
        if (!upPart) {
          console.warn(`No UP migration found in: ${file}`);
          continue;
        }

        const up = upPart.replace('-- UP MIGRATION', '').trim();
        const down = parts[1] ? parts[1].trim() : undefined;

        migrations.push({
          version,
          description: description.replace(/_/g, ' '),
          up,
          down,
          checksum: this.calculateChecksum(up)
        });

        seenVersions.add(version);
      }
    } catch (error) {
      console.warn('No migrations directory found or error reading migrations:', error);
    }

    return migrations;
  }

  public async runMigrations(): Promise<void> {
    console.log('Starting database migrations...');

    try {
      await this.ensureMigrationsTable();

      const appliedMigrations = await this.getAppliedMigrations();
      const availableMigrations = this.loadMigrationFiles();

      // Check if we need to handle the initial schema case
      if (appliedMigrations.length === 0 && availableMigrations.length > 0) {
        // Check if tables already exist (from init.sql)
        const tablesExist = await this.checkIfTablesExist();

        if (tablesExist) {
          // Mark the initial migration as applied without running it
          const initialMigration = availableMigrations.find(m =>
            m.description.toLowerCase().includes('initial schema')
          );
          if (initialMigration) {
            console.log('Database schema already exists, marking initial migration as applied');
            await this.recordMigration(initialMigration);
            console.log(`Initial migration ${initialMigration.version} marked as applied`);
          }
        }
      }

      // Get updated applied migrations after potential initial migration marking
      const updatedAppliedMigrations = await this.getAppliedMigrations();
      const pendingMigrations = availableMigrations.filter(
        migration => !updatedAppliedMigrations.includes(migration.version)
      );

      if (pendingMigrations.length === 0) {
        console.log('No pending migrations found');
        return;
      }

      console.log(`Found ${pendingMigrations.length} pending migrations`);

      for (const migration of pendingMigrations) {
        console.log(`Applying migration: ${migration.version} - ${migration.description}`);

        await this.db.transaction(async (client) => {
          // Execute the migration
          await client.query(migration.up);

          // Record the migration
          await client.query(
            'INSERT INTO schema_migrations (version, description, checksum) VALUES ($1, $2, $3)',
            [migration.version, migration.description, migration.checksum]
          );
        });

        console.log(`Migration ${migration.version} applied successfully`);
      }

      console.log('All migrations completed successfully');
    } catch (error) {
      console.error('Migration failed:', error);
      throw new DatabaseError('Migration execution failed', 'MIGRATION_ERROR', error);
    }
  }

  private async checkIfTablesExist(): Promise<boolean> {
    try {
      const result = await this.db.query(`
        SELECT COUNT(*) as count 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN ('users', 'lobbies', 'questions', 'question_sets')
      `);

      const count = parseInt((result.rows[0] as any)?.['count'] || '0');
      return count >= 4; // If we have the main tables, schema exists
    } catch (error) {
      console.warn('Error checking if tables exist:', error);
      return false;
    }
  }

  public async rollbackMigration(version?: string): Promise<void> {
    console.log('Starting migration rollback...');

    try {
      await this.ensureMigrationsTable();

      const appliedMigrations = await this.getAppliedMigrations();
      const availableMigrations = this.loadMigrationFiles();

      // Determine which migration to rollback
      const targetVersion = version || appliedMigrations[appliedMigrations.length - 1];

      if (!targetVersion) {
        console.log('No migrations to rollback');
        return;
      }

      const migration = availableMigrations.find(m => m.version === targetVersion);

      if (!migration) {
        throw new Error(`Migration ${targetVersion} not found`);
      }

      if (!migration.down) {
        throw new Error(`Migration ${targetVersion} does not have a rollback script`);
      }

      console.log(`Rolling back migration: ${migration.version} - ${migration.description}`);

      await this.db.transaction(async (client) => {
        // Execute the rollback
        await client.query(migration.down!);

        // Remove the migration record
        await client.query(
          'DELETE FROM schema_migrations WHERE version = $1',
          [migration.version]
        );
      });

      console.log(`Migration ${migration.version} rolled back successfully`);
    } catch (error) {
      console.error('Rollback failed:', error);
      throw new DatabaseError('Migration rollback failed', 'ROLLBACK_ERROR', error);
    }
  }

  public async getMigrationStatus(): Promise<{
    applied: string[];
    pending: string[];
    total: number;
  }> {
    await this.ensureMigrationsTable();

    const appliedMigrations = await this.getAppliedMigrations();
    const availableMigrations = this.loadMigrationFiles();

    const pendingMigrations = availableMigrations
      .filter(migration => !appliedMigrations.includes(migration.version))
      .map(migration => migration.version);

    return {
      applied: appliedMigrations,
      pending: pendingMigrations,
      total: availableMigrations.length
    };
  }

  public async validateMigrations(): Promise<boolean> {
    try {
      await this.ensureMigrationsTable();

      const appliedMigrations = await this.db.query(
        'SELECT version, checksum FROM schema_migrations ORDER BY version'
      );

      const availableMigrations = this.loadMigrationFiles();

      for (const applied of appliedMigrations.rows as any[]) {
        const available = availableMigrations.find(m => m.version === applied['version']);

        if (!available) {
          console.warn(`Applied migration ${applied['version']} not found in migration files - this may be from initial setup`);
          continue; // Don't fail validation for missing migration files
        }

        if (available.checksum !== applied['checksum']) {
          console.error(`Checksum mismatch for migration ${applied['version']}`);
          console.error(`Expected: ${available.checksum}, Got: ${applied['checksum']}`);
          return false;
        }
      }

      console.log('Migration validation completed successfully');
      return true;
    } catch (error) {
      console.error('Migration validation failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const migrationService = new MigrationService();
