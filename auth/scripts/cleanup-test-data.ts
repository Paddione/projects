#!/usr/bin/env npx tsx
/**
 * Cleanup Test Data Script
 *
 * Scours the environment for test data and removes it.
 * Can be run manually or as part of CI/CD pipelines.
 *
 * Usage:
 *   npx tsx scripts/cleanup-test-data.ts [options]
 *
 * Options:
 *   --dry-run     Show what would be deleted without deleting
 *   --verbose     Show detailed output
 *   --all         Clean all test data types (default)
 *   --users       Clean only test users
 *   --sessions    Clean only expired sessions
 *   --tokens      Clean only expired tokens
 */

import '../src/env.js';
import { db } from '../src/config/database.js';
import {
  users,
  userAppAccess,
  accessRequests,
  sessions,
  tokenBlacklist,
  oauthAccounts,
  verificationTokens,
} from '../src/db/schema.js';
import { eq, like, or, inArray, lt, sql } from 'drizzle-orm';

const TEST_PREFIX = 'test_';
const TEST_EMAIL_DOMAIN = '@test.local';

interface CleanupStats {
  testUsers: number;
  accessRequests: number;
  userAppAccess: number;
  sessions: number;
  oauthAccounts: number;
  expiredTokens: number;
  expiredSessions: number;
  expiredVerificationTokens: number;
}

async function getTestUserIds(): Promise<number[]> {
  const testUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(
      or(
        like(users.username, `${TEST_PREFIX}%`),
        like(users.email, `${TEST_PREFIX}%`),
        like(users.email, `%${TEST_EMAIL_DOMAIN}`)
      )
    );
  return testUsers.map(u => u.id);
}

async function countTestData(): Promise<CleanupStats> {
  const testUserIds = await getTestUserIds();
  const now = new Date();

  let accessRequestCount = 0;
  let userAppAccessCount = 0;
  let sessionCount = 0;
  let oauthAccountCount = 0;

  if (testUserIds.length > 0) {
    const accessRequestsList = await db
      .select({ id: accessRequests.id })
      .from(accessRequests)
      .where(
        or(
          inArray(accessRequests.user_id, testUserIds),
          inArray(accessRequests.reviewed_by, testUserIds)
        )
      );
    accessRequestCount = accessRequestsList.length;

    const userAppAccessList = await db
      .select({ id: userAppAccess.id })
      .from(userAppAccess)
      .where(inArray(userAppAccess.user_id, testUserIds));
    userAppAccessCount = userAppAccessList.length;

    const sessionsList = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(inArray(sessions.user_id, testUserIds));
    sessionCount = sessionsList.length;

    const oauthAccountsList = await db
      .select({ id: oauthAccounts.id })
      .from(oauthAccounts)
      .where(inArray(oauthAccounts.user_id, testUserIds));
    oauthAccountCount = oauthAccountsList.length;
  }

  // Count expired items (not just test data)
  const expiredTokensList = await db
    .select({ token: tokenBlacklist.token })
    .from(tokenBlacklist)
    .where(lt(tokenBlacklist.expires_at, now));

  const expiredSessionsList = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(lt(sessions.expires, now));

  const expiredVerificationTokensList = await db
    .select({ identifier: verificationTokens.identifier })
    .from(verificationTokens)
    .where(lt(verificationTokens.expires, now));

  return {
    testUsers: testUserIds.length,
    accessRequests: accessRequestCount,
    userAppAccess: userAppAccessCount,
    sessions: sessionCount,
    oauthAccounts: oauthAccountCount,
    expiredTokens: expiredTokensList.length,
    expiredSessions: expiredSessionsList.length,
    expiredVerificationTokens: expiredVerificationTokensList.length,
  };
}

async function cleanupTestUsers(verbose: boolean): Promise<number> {
  const testUserIds = await getTestUserIds();

  if (testUserIds.length === 0) {
    if (verbose) console.log('  No test users found');
    return 0;
  }

  if (verbose) {
    console.log(`  Found ${testUserIds.length} test users to delete`);
  }

  // Delete in order respecting foreign key constraints
  // First update access_requests.reviewed_by to NULL where it references test users
  await db
    .update(accessRequests)
    .set({ reviewed_by: null })
    .where(inArray(accessRequests.reviewed_by, testUserIds));

  await db.delete(accessRequests).where(inArray(accessRequests.user_id, testUserIds));
  await db.delete(userAppAccess).where(inArray(userAppAccess.user_id, testUserIds));
  await db.delete(sessions).where(inArray(sessions.user_id, testUserIds));
  await db.delete(oauthAccounts).where(inArray(oauthAccounts.user_id, testUserIds));
  await db.delete(users).where(inArray(users.id, testUserIds));

  return testUserIds.length;
}

async function cleanupExpiredSessions(verbose: boolean): Promise<number> {
  const now = new Date();
  const result = await db
    .delete(sessions)
    .where(lt(sessions.expires, now))
    .returning({ id: sessions.id });

  if (verbose && result.length > 0) {
    console.log(`  Deleted ${result.length} expired sessions`);
  }

  return result.length;
}

async function cleanupExpiredTokens(verbose: boolean): Promise<number> {
  const now = new Date();
  const result = await db
    .delete(tokenBlacklist)
    .where(lt(tokenBlacklist.expires_at, now))
    .returning({ token: tokenBlacklist.token });

  if (verbose && result.length > 0) {
    console.log(`  Deleted ${result.length} expired blacklisted tokens`);
  }

  return result.length;
}

async function cleanupExpiredVerificationTokens(verbose: boolean): Promise<number> {
  const now = new Date();
  const result = await db
    .delete(verificationTokens)
    .where(lt(verificationTokens.expires, now))
    .returning({ identifier: verificationTokens.identifier });

  if (verbose && result.length > 0) {
    console.log(`  Deleted ${result.length} expired verification tokens`);
  }

  return result.length;
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const verbose = args.includes('--verbose') || dryRun;
  const cleanUsers = args.includes('--users') || args.includes('--all') || (!args.includes('--sessions') && !args.includes('--tokens'));
  const cleanSessions = args.includes('--sessions') || args.includes('--all') || (!args.includes('--users') && !args.includes('--tokens'));
  const cleanTokens = args.includes('--tokens') || args.includes('--all') || (!args.includes('--users') && !args.includes('--sessions'));

  console.log('========================================');
  console.log('  Auth Service - Test Data Cleanup');
  console.log('========================================');
  console.log('');

  if (dryRun) {
    console.log('  MODE: Dry Run (no changes will be made)');
    console.log('');
  }

  // Show current state
  console.log('Current test data in database:');
  const stats = await countTestData();
  console.log(`  Test users:                    ${stats.testUsers}`);
  console.log(`  - Access requests:             ${stats.accessRequests}`);
  console.log(`  - User app access records:     ${stats.userAppAccess}`);
  console.log(`  - Sessions:                    ${stats.sessions}`);
  console.log(`  - OAuth accounts:              ${stats.oauthAccounts}`);
  console.log(`  Expired blacklisted tokens:    ${stats.expiredTokens}`);
  console.log(`  Expired sessions:              ${stats.expiredSessions}`);
  console.log(`  Expired verification tokens:   ${stats.expiredVerificationTokens}`);
  console.log('');

  if (dryRun) {
    console.log('Dry run complete. Run without --dry-run to delete.');
    process.exit(0);
  }

  let totalDeleted = 0;

  // Cleanup
  console.log('Cleaning up...');

  if (cleanUsers && stats.testUsers > 0) {
    console.log('');
    console.log('Cleaning test users...');
    const deletedUsers = await cleanupTestUsers(verbose);
    console.log(`  Deleted ${deletedUsers} test users and related data`);
    totalDeleted += deletedUsers;
  }

  if (cleanSessions && stats.expiredSessions > 0) {
    console.log('');
    console.log('Cleaning expired sessions...');
    const deletedSessions = await cleanupExpiredSessions(verbose);
    totalDeleted += deletedSessions;
  }

  if (cleanTokens) {
    if (stats.expiredTokens > 0) {
      console.log('');
      console.log('Cleaning expired blacklisted tokens...');
      const deletedTokens = await cleanupExpiredTokens(verbose);
      totalDeleted += deletedTokens;
    }

    if (stats.expiredVerificationTokens > 0) {
      console.log('');
      console.log('Cleaning expired verification tokens...');
      const deletedVerificationTokens = await cleanupExpiredVerificationTokens(verbose);
      totalDeleted += deletedVerificationTokens;
    }
  }

  console.log('');
  console.log('========================================');
  console.log(`  Cleanup complete: ${totalDeleted} items deleted`);
  console.log('========================================');

  process.exit(0);
}

main().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
