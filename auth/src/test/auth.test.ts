/**
 * Auth Service Tests
 *
 * Demonstrates proper test user lifecycle management:
 * - Users are created before each test
 * - Users are deleted after each test
 * - No test data persists between tests
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import {
  createTestUser,
  createTestAdmin,
  deleteTestUser,
  deleteTestUsers,
  withTestUser,
  withTestUsers,
  TEST_PASSWORD,
  type TestUser,
} from './test-utils.js';
import { AuthService } from '../services/AuthService.js';

describe('AuthService', () => {
  // Create service instance
  const authService = new AuthService();

  // Track all users created in this describe block for cleanup
  let createdUserIds: number[] = [];

  afterEach(async () => {
    // Clean up any users created during this test
    if (createdUserIds.length > 0) {
      await deleteTestUsers(createdUserIds);
      createdUserIds = [];
    }
  });

  describe('login', () => {
    let testUser: TestUser;

    beforeEach(async () => {
      // Create a fresh test user before each login test
      testUser = await createTestUser();
      createdUserIds.push(testUser.id);
    });

    it('should login with valid credentials', async () => {
      const result = await authService.login({
        usernameOrEmail: testUser.username,
        password: testUser.password,
      });

      expect(result.user.id).toBe(testUser.id);
      expect(result.user.email).toBe(testUser.email);
      expect(result.tokens.accessToken).toBeDefined();
      expect(result.tokens.refreshToken).toBeDefined();
    });

    it('should login with email', async () => {
      const result = await authService.login({
        usernameOrEmail: testUser.email,
        password: testUser.password,
      });

      expect(result.user.id).toBe(testUser.id);
    });

    it('should fail with wrong password', async () => {
      await expect(
        authService.login({
          usernameOrEmail: testUser.username,
          password: 'WrongPassword123!',
        })
      ).rejects.toThrow('Invalid credentials');
    });

    it('should fail with non-existent user', async () => {
      await expect(
        authService.login({
          usernameOrEmail: 'nonexistent_user',
          password: TEST_PASSWORD,
        })
      ).rejects.toThrow('Invalid credentials');
    });
  });

  describe('login with inactive account', () => {
    it('should fail when account is inactive', async () => {
      const inactiveUser = await createTestUser({ isActive: false });
      createdUserIds.push(inactiveUser.id);

      await expect(
        authService.login({
          usernameOrEmail: inactiveUser.username,
          password: inactiveUser.password,
        })
      ).rejects.toThrow('Account is deactivated');
    });
  });
});

describe('AuthService with fixture helper', () => {
  // Create service instance
  const authService = new AuthService();

  // Using the withTestUser helper for cleaner setup/teardown
  const userFixture = withTestUser();

  beforeEach(async () => {
    await userFixture.setup();
  });

  afterEach(async () => {
    await userFixture.teardown();
  });

  it('should get user by ID', async () => {
    const testUser = userFixture.getUser();
    const result = await authService.getUserById(testUser.id);

    expect(result).not.toBeNull();
    expect(result!.id).toBe(testUser.id);
    expect(result!.username).toBe(testUser.username);
    // Password hash should not be returned
    expect((result as any).password_hash).toBeUndefined();
  });
});

describe('AuthService with multiple users', () => {
  // Create service instance
  const authService = new AuthService();

  const usersFixture = withTestUsers(3);

  beforeAll(async () => {
    await usersFixture.setup();
  });

  afterAll(async () => {
    await usersFixture.teardown();
  });

  it('should have created 3 test users', () => {
    const users = usersFixture.getUsers();
    expect(users).toHaveLength(3);
  });

  it('each user should be able to login', async () => {
    const users = usersFixture.getUsers();

    for (const user of users) {
      const result = await authService.login({
        usernameOrEmail: user.username,
        password: user.password,
      });
      expect(result.user.id).toBe(user.id);
    }
  });
});

describe('Admin functionality', () => {
  // Create service instance
  const authService = new AuthService();

  let adminUser: TestUser;
  let regularUser: TestUser;

  beforeEach(async () => {
    adminUser = await createTestAdmin();
    regularUser = await createTestUser();
  });

  afterEach(async () => {
    await deleteTestUsers([adminUser.id, regularUser.id]);
  });

  it('admin should have ADMIN role', async () => {
    const result = await authService.getUserById(adminUser.id);
    expect(result!.role).toBe('ADMIN');
  });

  it('regular user should have USER role', async () => {
    const result = await authService.getUserById(regularUser.id);
    expect(result!.role).toBe('USER');
  });
});

describe('Registration', () => {
  // Create service instance
  const authService = new AuthService();

  let createdUserId: number | null = null;

  afterEach(async () => {
    // Clean up user if registration succeeded
    if (createdUserId) {
      await deleteTestUser(createdUserId);
      createdUserId = null;
    }
  });

  it('should register a new user', async () => {
    const timestamp = Date.now();
    const result = await authService.register({
      username: `test_register_${timestamp}`,
      email: `test_register_${timestamp}@test.local`,
      password: TEST_PASSWORD,
      name: 'Test Register User',
    });

    createdUserId = result.user.id;

    expect(result.user.username).toBe(`test_register_${timestamp}`);
    expect(result.user.email).toBe(`test_register_${timestamp}@test.local`);
    expect(result.tokens.accessToken).toBeDefined();
  });

  it('should fail with duplicate username', async () => {
    const existingUser = await createTestUser();
    createdUserId = existingUser.id;

    await expect(
      authService.register({
        username: existingUser.username,
        email: 'different@test.local',
        password: TEST_PASSWORD,
      })
    ).rejects.toThrow('Username already taken');
  });

  it('should fail with duplicate email', async () => {
    const existingUser = await createTestUser();
    createdUserId = existingUser.id;

    await expect(
      authService.register({
        username: 'different_username',
        email: existingUser.email,
        password: TEST_PASSWORD,
      })
    ).rejects.toThrow('Email already registered');
  });

  it('should fail with weak password', async () => {
    await expect(
      authService.register({
        username: `test_weak_${Date.now()}`,
        email: `test_weak_${Date.now()}@test.local`,
        password: 'weak',
      })
    ).rejects.toThrow();
  });
});
