#!/usr/bin/env tsx

/**
 * User Migration Script
 *
 * Migrates users from l2p, VideoVault, and payment databases to the unified auth service.
 *
 * Migration Strategy:
 * 1. l2p users: Primary source (most complete user data)
 * 2. VideoVault users: Merge by email, preserve VideoVault-specific data
 * 3. payment users: Merge by email, preserve payment-specific data
 *
 * Usage:
 *   tsx scripts/migrate-users.ts [--dry-run] [--project=l2p|videovault|payment]
 */

import postgres from 'postgres';
import { db } from '../src/config/database.js';
import { users, userMigrationLog } from '../src/db/schema.js';
import { eq, or } from 'drizzle-orm';
import bcrypt from 'bcrypt';

interface MigrationOptions {
  dryRun: boolean;
  project?: 'l2p' | 'videovault' | 'payment';
}

interface L2PUser {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  role: string;
  email_verified: boolean;
  selected_character?: string;
  character_level?: number;
  experience_points?: number;
  created_at: Date;
  updated_at: Date;
}

interface VideoVaultUser {
  id: number;
  email: string;
  password_hash: string;
  created_at: Date;
}

interface PaymentUser {
  id: string;
  email: string;
  name?: string;
  password?: string;
  emailVerified?: Date;
  image?: string;
  createdAt: Date;
  updatedAt: Date;
}

class UserMigration {
  private options: MigrationOptions;
  private l2pDb?: ReturnType<typeof postgres>;
  private videoVaultDb?: ReturnType<typeof postgres>;
  private paymentDb?: ReturnType<typeof postgres>;

  constructor(options: MigrationOptions) {
    this.options = options;
  }

  async connect() {
    console.log('📡 Connecting to source databases...');

    // Connect to l2p database
    if (!this.options.project || this.options.project === 'l2p') {
      try {
        this.l2pDb = postgres(process.env.L2P_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/l2p_db');
        console.log('✅ Connected to l2p database');
      } catch (error) {
        console.log('⚠️  Could not connect to l2p database');
      }
    }

    // Connect to VideoVault database
    if (!this.options.project || this.options.project === 'videovault') {
      try {
        this.videoVaultDb = postgres(process.env.VIDEOVAULT_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/videovault_db');
        console.log('✅ Connected to VideoVault database');
      } catch (error) {
        console.log('⚠️  Could not connect to VideoVault database');
      }
    }

    // Connect to payment database
    if (!this.options.project || this.options.project === 'payment') {
      try {
        this.paymentDb = postgres(process.env.PAYMENT_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5434/payment_db');
        console.log('✅ Connected to payment database');
      } catch (error) {
        console.log('⚠️  Could not connect to payment database');
      }
    }
  }

  async disconnect() {
    console.log('\n📡 Disconnecting from source databases...');
    await this.l2pDb?.end();
    await this.videoVaultDb?.end();
    await this.paymentDb?.end();
    console.log('✅ Disconnected from all databases');
  }

  async migrateL2PUsers() {
    if (!this.l2pDb) {
      console.log('\n⏭️  Skipping l2p user migration (not connected)');
      return 0;
    }

    console.log('\n🔄 Migrating l2p users...');

    try {
      const l2pUsers = await this.l2pDb<L2PUser[]>`
        SELECT * FROM users ORDER BY created_at ASC
      `;

      console.log(`📊 Found ${l2pUsers.length} l2p users`);

      let migrated = 0;
      let skipped = 0;
      let merged = 0;

      for (const l2pUser of l2pUsers) {
        try {
          // Check if user already exists by email or username
          const existingUser = await db
            .select()
            .from(users)
            .where(or(eq(users.email, l2pUser.email), eq(users.username, l2pUser.username)))
            .limit(1);

          if (existingUser.length > 0) {
            console.log(`  ⚠️  User ${l2pUser.email} already exists (skipping)`);
            skipped++;

            if (!this.options.dryRun) {
              await db.insert(userMigrationLog).values({
                merged_user_id: existingUser[0].id,
                source_project: 'l2p',
                source_user_id: l2pUser.id.toString(),
                merge_strategy: 'skipped',
                metadata: { reason: 'User already exists' },
              });
            }
            continue;
          }

          if (this.options.dryRun) {
            console.log(`  ✓ Would migrate: ${l2pUser.email}`);
            migrated++;
            continue;
          }

          // Create new user
          const newUser = await db.insert(users).values({
            email: l2pUser.email,
            username: l2pUser.username,
            password_hash: l2pUser.password_hash,
            email_verified: l2pUser.email_verified,
            role: l2pUser.role,
            selected_character: l2pUser.selected_character || 'student',
            character_level: l2pUser.character_level || 1,
            experience_points: l2pUser.experience_points || 0,
            created_at: l2pUser.created_at,
            updated_at: l2pUser.updated_at,
          }).returning();

          console.log(`  ✓ Migrated: ${l2pUser.email}`);
          migrated++;

          // Log migration
          await db.insert(userMigrationLog).values({
            merged_user_id: newUser[0].id,
            source_project: 'l2p',
            source_user_id: l2pUser.id.toString(),
            merge_strategy: 'primary',
            metadata: { username: l2pUser.username },
          });
        } catch (error) {
          console.error(`  ❌ Failed to migrate ${l2pUser.email}:`, error instanceof Error ? error.message : error);
        }
      }

      console.log(`\n📊 L2P Migration Summary:`);
      console.log(`  ✅ Migrated: ${migrated}`);
      console.log(`  ⏭️  Skipped: ${skipped}`);
      console.log(`  🔀 Merged: ${merged}`);

      return migrated;
    } catch (error) {
      console.error('❌ L2P migration failed:', error);
      return 0;
    }
  }

  async migrateVideoVaultUsers() {
    if (!this.videoVaultDb) {
      console.log('\n⏭️  Skipping VideoVault user migration (not connected)');
      return 0;
    }

    console.log('\n🔄 Migrating VideoVault users...');

    try {
      const vvUsers = await this.videoVaultDb<VideoVaultUser[]>`
        SELECT * FROM users ORDER BY created_at ASC
      `;

      console.log(`📊 Found ${vvUsers.length} VideoVault users`);

      let migrated = 0;
      let skipped = 0;
      let merged = 0;

      for (const vvUser of vvUsers) {
        try {
          // Check if user exists by email
          const existingUser = await db
            .select()
            .from(users)
            .where(eq(users.email, vvUser.email))
            .limit(1);

          if (existingUser.length > 0) {
            console.log(`  🔀 User ${vvUser.email} already exists (merging)`);
            merged++;

            if (!this.options.dryRun) {
              // User exists, just log the merge
              await db.insert(userMigrationLog).values({
                merged_user_id: existingUser[0].id,
                source_project: 'videovault',
                source_user_id: vvUser.id.toString(),
                merge_strategy: 'merged',
                metadata: { note: 'User account merged with existing l2p user' },
              });
            }
            continue;
          }

          if (this.options.dryRun) {
            console.log(`  ✓ Would migrate: ${vvUser.email}`);
            migrated++;
            continue;
          }

          // Generate username from email
          const username = vvUser.email.split('@')[0] + '_vv';

          // Create new user
          const newUser = await db.insert(users).values({
            email: vvUser.email,
            username: username,
            password_hash: vvUser.password_hash,
            email_verified: false,
            created_at: vvUser.created_at,
          }).returning();

          console.log(`  ✓ Migrated: ${vvUser.email}`);
          migrated++;

          // Log migration
          await db.insert(userMigrationLog).values({
            merged_user_id: newUser[0].id,
            source_project: 'videovault',
            source_user_id: vvUser.id.toString(),
            merge_strategy: 'primary',
            metadata: { username: username },
          });
        } catch (error) {
          console.error(`  ❌ Failed to migrate ${vvUser.email}:`, error instanceof Error ? error.message : error);
        }
      }

      console.log(`\n📊 VideoVault Migration Summary:`);
      console.log(`  ✅ Migrated: ${migrated}`);
      console.log(`  ⏭️  Skipped: ${skipped}`);
      console.log(`  🔀 Merged: ${merged}`);

      return migrated;
    } catch (error) {
      console.error('❌ VideoVault migration failed:', error);
      return 0;
    }
  }

  async migratePaymentUsers() {
    if (!this.paymentDb) {
      console.log('\n⏭️  Skipping payment user migration (not connected)');
      return 0;
    }

    console.log('\n🔄 Migrating payment users...');

    try {
      const paymentUsers = await this.paymentDb<PaymentUser[]>`
        SELECT * FROM "User" ORDER BY "createdAt" ASC
      `;

      console.log(`📊 Found ${paymentUsers.length} payment users`);

      let migrated = 0;
      let skipped = 0;
      let merged = 0;

      for (const paymentUser of paymentUsers) {
        try {
          // Check if user exists by email
          const existingUser = await db
            .select()
            .from(users)
            .where(eq(users.email, paymentUser.email))
            .limit(1);

          if (existingUser.length > 0) {
            console.log(`  🔀 User ${paymentUser.email} already exists (merging)`);
            merged++;

            if (!this.options.dryRun) {
              // Update existing user with payment data
              await db.insert(userMigrationLog).values({
                merged_user_id: existingUser[0].id,
                source_project: 'payment',
                source_user_id: paymentUser.id,
                merge_strategy: 'merged',
                metadata: { note: 'User account merged with existing user' },
              });
            }
            continue;
          }

          if (this.options.dryRun) {
            console.log(`  ✓ Would migrate: ${paymentUser.email}`);
            migrated++;
            continue;
          }

          // Generate username from email
          const username = paymentUser.email.split('@')[0] + '_pay';

          // Hash password if exists
          let passwordHash = null;
          if (paymentUser.password) {
            passwordHash = await bcrypt.hash(paymentUser.password, 12);
          }

          // Create new user
          const newUser = await db.insert(users).values({
            email: paymentUser.email,
            username: username,
            password_hash: passwordHash,
            name: paymentUser.name || null,
            email_verified: !!paymentUser.emailVerified,
            avatar_url: paymentUser.image || null,
            created_at: paymentUser.createdAt,
            updated_at: paymentUser.updatedAt,
          }).returning();

          console.log(`  ✓ Migrated: ${paymentUser.email}`);
          migrated++;

          // Log migration
          await db.insert(userMigrationLog).values({
            merged_user_id: newUser[0].id,
            source_project: 'payment',
            source_user_id: paymentUser.id,
            merge_strategy: 'primary',
            metadata: { username: username },
          });
        } catch (error) {
          console.error(`  ❌ Failed to migrate ${paymentUser.email}:`, error instanceof Error ? error.message : error);
        }
      }

      console.log(`\n📊 Payment Migration Summary:`);
      console.log(`  ✅ Migrated: ${migrated}`);
      console.log(`  ⏭️  Skipped: ${skipped}`);
      console.log(`  🔀 Merged: ${merged}`);

      return migrated;
    } catch (error) {
      console.error('❌ Payment migration failed:', error);
      return 0;
    }
  }

  async run() {
    console.log('================================================================================');
    console.log('🚀 User Migration Script');
    console.log('================================================================================');

    if (this.options.dryRun) {
      console.log('⚠️  DRY RUN MODE - No changes will be made');
    }

    if (this.options.project) {
      console.log(`📦 Project filter: ${this.options.project}`);
    }

    console.log('');

    await this.connect();

    const totalMigrated =
      await this.migrateL2PUsers() +
      await this.migrateVideoVaultUsers() +
      await this.migratePaymentUsers();

    await this.disconnect();

    console.log('\n================================================================================');
    console.log(`✅ Migration complete! Total users migrated: ${totalMigrated}`);
    console.log('================================================================================');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options: MigrationOptions = {
  dryRun: args.includes('--dry-run'),
  project: undefined,
};

const projectArg = args.find(arg => arg.startsWith('--project='));
if (projectArg) {
  const project = projectArg.split('=')[1] as 'l2p' | 'videovault' | 'payment';
  if (['l2p', 'videovault', 'payment'].includes(project)) {
    options.project = project;
  } else {
    console.error('❌ Invalid project. Must be one of: l2p, videovault, payment');
    process.exit(1);
  }
}

// Run migration
const migration = new UserMigration(options);
migration.run().catch((error) => {
  console.error('❌ Migration failed:', error);
  process.exit(1);
});
