import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestAdmin, deleteTestUsers, type TestUser } from './test-utils.js';
import { db } from '../config/database.js';
import { apps } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { TokenService } from '../services/TokenService.js';

const tokenService = new TokenService();
const BASE_URL = `http://localhost:${process.env.PORT || 5500}`;

describe('Admin Apps API', () => {
  let admin: TestUser;
  let adminToken: string;
  let createdUserIds: number[] = [];

  beforeEach(async () => {
    admin = await createTestAdmin();
    createdUserIds.push(admin.id);
    const tokens = tokenService.generateTokens({
      id: admin.id, email: admin.email, username: admin.username,
      role: 'ADMIN', password_hash: null,
    } as any);
    adminToken = tokens.accessToken;
  });

  afterEach(async () => {
    await deleteTestUsers(createdUserIds);
    createdUserIds = [];
  });

  it('PATCH /api/admin/apps/:id updates is_default', async () => {
    const [app] = await db.select().from(apps).limit(1);
    const res = await fetch(`${BASE_URL}/api/admin/apps/${app.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ is_default: true }),
    });
    expect(res.status).toBe(200);

    const [updated] = await db.select().from(apps).where(eq(apps.id, app.id));
    expect(updated.is_default).toBe(true);

    // Reset
    await db.update(apps).set({ is_default: false }).where(eq(apps.id, app.id));
  });

  it('PATCH /api/admin/apps/:id rejects invalid app ID', async () => {
    const res = await fetch(`${BASE_URL}/api/admin/apps/99999`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`,
        'X-Requested-With': 'XMLHttpRequest',
      },
      body: JSON.stringify({ is_default: true }),
    });
    expect(res.status).toBe(404);
  });
});
