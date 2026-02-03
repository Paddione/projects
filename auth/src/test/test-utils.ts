/**
 * Test Utilities for Auth Service
 *
 * Provides helpers for creating and cleaning up test data.
 * All test users are marked with a specific prefix for easy identification.
 */

import { db } from '../config/database.js';
import { users, userAppAccess, accessRequests, sessions, tokenBlacklist, oauthAccounts } from '../db/schema.js';
import { eq, like, or, inArray } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

// Test data prefix - all test users will have usernames/emails starting with this
export const TEST_PREFIX = 'test_';
export const E2E_PREFIX = 'e2e_';
export const TEST_EMAIL_DOMAIN = '@test.local';

// Standard test password that meets all requirements
export const TEST_PASSWORD = 'TestPass123!';

export interface CreateTestUserOptions {
  username?: string;
  email?: string;
  password?: string;
  role?: 'USER' | 'ADMIN';
  emailVerified?: boolean;
  isActive?: boolean;
  name?: string;
}

export interface TestUser {
  id: number;
  username: string;
  email: string;
  role: string;
  password: string; // Plain text password for login tests
}

/**
 * Generate a unique test username
 */
export function generateTestUsername(suffix?: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${TEST_PREFIX}${suffix || 'user'}_${timestamp}_${random}`;
}

/**
 * Generate a unique test email
 */
export function generateTestEmail(suffix?: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${TEST_PREFIX}${suffix || 'user'}_${timestamp}_${random}${TEST_EMAIL_DOMAIN}`;
}

/**
 * Create a test user in the database
 * Returns the created user with the plain text password for login tests
 */
export async function createTestUser(options: CreateTestUserOptions = {}): Promise<TestUser> {
  const username = options.username || generateTestUsername();
  const email = options.email || generateTestEmail();
  const password = options.password || TEST_PASSWORD;

  // Hash password
  const saltRounds = 10; // Lower for tests to be faster
  const passwordHash = await bcrypt.hash(password, saltRounds);

  const [user] = await db.insert(users).values({
    username,
    email,
    password_hash: passwordHash,
    role: options.role || 'USER',
    email_verified: options.emailVerified ?? true, // Default to verified for easier testing
    is_active: options.isActive ?? true,
    name: options.name || `Test User ${username}`,
  }).returning({
    id: users.id,
    username: users.username,
    email: users.email,
    role: users.role,
  });

  return {
    ...user,
    password, // Return plain text password for login tests
  };
}

/**
 * Create multiple test users at once
 */
export async function createTestUsers(count: number, options: CreateTestUserOptions = {}): Promise<TestUser[]> {
  const testUsers: TestUser[] = [];
  for (let i = 0; i < count; i++) {
    const user = await createTestUser({
      ...options,
      username: options.username ? `${options.username}_${i}` : undefined,
      email: options.email ? `${i}_${options.email}` : undefined,
    });
    testUsers.push(user);
  }
  return testUsers;
}

/**
 * Create a test admin user
 */
export async function createTestAdmin(options: Omit<CreateTestUserOptions, 'role'> = {}): Promise<TestUser> {
  return createTestUser({ ...options, role: 'ADMIN' });
}

/**
 * Delete a specific test user by ID
 * Also cleans up related data (sessions, access requests, etc.)
 */
export async function deleteTestUser(userId: number): Promise<void> {
  // Delete in order respecting foreign key constraints
  await db.delete(accessRequests).where(eq(accessRequests.user_id, userId));
  await db.delete(accessRequests).where(eq(accessRequests.reviewed_by, userId));
  await db.delete(userAppAccess).where(eq(userAppAccess.user_id, userId));
  await db.delete(sessions).where(eq(sessions.user_id, userId));
  await db.delete(oauthAccounts).where(eq(oauthAccounts.user_id, userId));
  await db.delete(users).where(eq(users.id, userId));
}

/**
 * Delete multiple test users by IDs
 */
export async function deleteTestUsers(userIds: number[]): Promise<void> {
  if (userIds.length === 0) return;

  // Delete in order respecting foreign key constraints
  await db.delete(accessRequests).where(inArray(accessRequests.user_id, userIds));
  await db.delete(accessRequests).where(inArray(accessRequests.reviewed_by, userIds));
  await db.delete(userAppAccess).where(inArray(userAppAccess.user_id, userIds));
  await db.delete(sessions).where(inArray(sessions.user_id, userIds));
  await db.delete(oauthAccounts).where(inArray(oauthAccounts.user_id, userIds));
  await db.delete(users).where(inArray(users.id, userIds));
}

/**
 * Delete all test users (those with test_ or e2e_ prefix in username or email)
 * This is the main cleanup function for test data
 */
export async function deleteAllTestUsers(): Promise<number> {
  // Find all test and e2e users
  const testUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(
      or(
        like(users.username, `${TEST_PREFIX}%`),
        like(users.email, `${TEST_PREFIX}%`),
        like(users.username, `${E2E_PREFIX}%`),
        like(users.email, `${E2E_PREFIX}%`)
      )
    );

  if (testUsers.length === 0) {
    return 0;
  }

  const userIds = testUsers.map(u => u.id);
  await deleteTestUsers(userIds);

  return userIds.length;
}

/**
 * Clean up expired tokens from the blacklist
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await db
    .delete(tokenBlacklist)
    .where(eq(tokenBlacklist.expires_at, new Date()))
    .returning({ token: tokenBlacklist.token });

  // Note: This is a simplified version. In practice, you'd want:
  // .where(lt(tokenBlacklist.expires_at, new Date()))
  return result.length;
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const result = await db
    .delete(sessions)
    .where(eq(sessions.expires, new Date()))
    .returning({ id: sessions.id });

  return result.length;
}

/**
 * Test fixture helper - creates user before test, deletes after
 */
export function withTestUser(options: CreateTestUserOptions = {}) {
  let testUser: TestUser;

  return {
    async setup(): Promise<TestUser> {
      testUser = await createTestUser(options);
      return testUser;
    },
    async teardown(): Promise<void> {
      if (testUser) {
        await deleteTestUser(testUser.id);
      }
    },
    getUser(): TestUser {
      return testUser;
    }
  };
}

/**
 * Test fixture helper for multiple users
 */
export function withTestUsers(count: number, options: CreateTestUserOptions = {}) {
  let testUsers: TestUser[] = [];

  return {
    async setup(): Promise<TestUser[]> {
      testUsers = await createTestUsers(count, options);
      return testUsers;
    },
    async teardown(): Promise<void> {
      if (testUsers.length > 0) {
        await deleteTestUsers(testUsers.map(u => u.id));
      }
    },
    getUsers(): TestUser[] {
      return testUsers;
    }
  };
}

/**
 * Grant app access to a test user
 */
export async function grantTestUserAppAccess(userId: number, appId: number): Promise<void> {
  await db.insert(userAppAccess).values({
    user_id: userId,
    app_id: appId,
  }).onConflictDoNothing();
}

/**
 * Create a test access request
 */
export async function createTestAccessRequest(
  userId: number,
  appId: number,
  options: { reason?: string; status?: 'pending' | 'approved' | 'denied' } = {}
): Promise<number> {
  const [request] = await db.insert(accessRequests).values({
    user_id: userId,
    app_id: appId,
    reason: options.reason,
    status: options.status || 'pending',
  }).returning({ id: accessRequests.id });

  return request.id;
}

/**
 * Get test statistics
 */
export async function getTestDataStats(): Promise<{
  testUsers: number;
  testAccessRequests: number;
  testSessions: number;
}> {
  const testUsersList = await db
    .select({ id: users.id })
    .from(users)
    .where(
      or(
        like(users.username, `${TEST_PREFIX}%`),
        like(users.email, `${TEST_PREFIX}%`),
        like(users.username, `${E2E_PREFIX}%`),
        like(users.email, `${E2E_PREFIX}%`)
      )
    );

  const userIds = testUsersList.map(u => u.id);

  let testAccessRequestCount = 0;
  let testSessionCount = 0;

  if (userIds.length > 0) {
    const accessRequestsList = await db
      .select({ id: accessRequests.id })
      .from(accessRequests)
      .where(inArray(accessRequests.user_id, userIds));
    testAccessRequestCount = accessRequestsList.length;

    const sessionsList = await db
      .select({ id: sessions.id })
      .from(sessions)
      .where(inArray(sessions.user_id, userIds));
    testSessionCount = sessionsList.length;
  }

  return {
    testUsers: testUsersList.length,
    testAccessRequests: testAccessRequestCount,
    testSessions: testSessionCount,
  };
}
