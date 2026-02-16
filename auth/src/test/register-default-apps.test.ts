import { describe, it, expect, afterEach } from '@jest/globals';
import { deleteTestUsers } from './test-utils.js';
import { db } from '../config/database.js';
import { apps, userAppAccess } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { AuthService } from '../services/AuthService.js';

const authService = new AuthService();

describe('Registration auto-grants default apps', () => {
  let createdUserIds: number[] = [];

  afterEach(async () => {
    for (const id of createdUserIds) {
      await db.delete(userAppAccess).where(eq(userAppAccess.user_id, id));
    }
    await deleteTestUsers(createdUserIds);
    createdUserIds = [];
  });

  it('grants default apps to new user on registration', async () => {
    // Set one app as default
    const [testApp] = await db.select().from(apps).limit(1);
    await db.update(apps).set({ is_default: true }).where(eq(apps.id, testApp.id));

    try {
      const timestamp = Date.now();
      const result = await authService.register({
        username: `test_reg_${timestamp}`,
        email: `test_reg_${timestamp}@test.local`,
        password: 'TestPass123!',
      });

      createdUserIds.push(result.user.id);

      // Check that user_app_access row was created
      const [access] = await db
        .select()
        .from(userAppAccess)
        .where(and(
          eq(userAppAccess.user_id, result.user.id),
          eq(userAppAccess.app_id, testApp.id)
        ))
        .limit(1);

      expect(access).toBeDefined();
    } finally {
      // Reset the default flag
      await db.update(apps).set({ is_default: false }).where(eq(apps.id, testApp.id));
    }
  });

  it('still succeeds registration when no default apps exist', async () => {
    const timestamp = Date.now();
    const result = await authService.register({
      username: `test_nodef_${timestamp}`,
      email: `test_nodef_${timestamp}@test.local`,
      password: 'TestPass123!',
    });

    createdUserIds.push(result.user.id);
    expect(result.user.id).toBeDefined();
  });
});
