import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestUser, createTestAdmin, deleteTestUsers, type TestUser } from './test-utils.js';
import { db } from '../config/database.js';
import { apps, userAppAccess } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { TokenService } from '../services/TokenService.js';

const tokenService = new TokenService();
const BASE_URL = `http://localhost:${process.env.PORT || 5500}`;

describe('Verify endpoint with app access check', () => {
  let user: TestUser;
  let admin: TestUser;
  let userToken: string;
  let adminToken: string;
  let createdUserIds: number[] = [];

  beforeEach(async () => {
    user = await createTestUser();
    admin = await createTestAdmin();
    createdUserIds.push(user.id, admin.id);

    userToken = tokenService.generateTokens({
      id: user.id, email: user.email, username: user.username,
      role: 'USER', password_hash: null,
    } as any).accessToken;

    adminToken = tokenService.generateTokens({
      id: admin.id, email: admin.email, username: admin.username,
      role: 'ADMIN', password_hash: null,
    } as any).accessToken;
  });

  afterEach(async () => {
    // Clean up any app access we created
    for (const id of createdUserIds) {
      await db.delete(userAppAccess).where(eq(userAppAccess.user_id, id));
    }
    await deleteTestUsers(createdUserIds);
    createdUserIds = [];
  });

  it('returns 200 without app param (backwards compatible)', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/verify`, {
      headers: { 'Authorization': `Bearer ${userToken}`, 'X-Requested-With': 'XMLHttpRequest' },
    });
    expect(res.status).toBe(200);
  });

  it('returns 403 when user lacks app access', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/verify?app=shop`, {
      headers: { 'Authorization': `Bearer ${userToken}`, 'X-Requested-With': 'XMLHttpRequest' },
    });
    expect(res.status).toBe(403);
  });

  it('returns 200 when user has app access', async () => {
    const [shopApp] = await db.select().from(apps).where(eq(apps.key, 'shop')).limit(1);
    if (shopApp) {
      await db.insert(userAppAccess).values({ user_id: user.id, app_id: shopApp.id });
    }

    const res = await fetch(`${BASE_URL}/api/auth/verify?app=shop`, {
      headers: { 'Authorization': `Bearer ${userToken}`, 'X-Requested-With': 'XMLHttpRequest' },
    });
    expect(res.status).toBe(200);
  });

  it('returns 200 for admin regardless of app access', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/verify?app=shop`, {
      headers: { 'Authorization': `Bearer ${adminToken}`, 'X-Requested-With': 'XMLHttpRequest' },
    });
    expect(res.status).toBe(200);
  });

  it('returns 403 for non-existent app key', async () => {
    const res = await fetch(`${BASE_URL}/api/auth/verify?app=nonexistent`, {
      headers: { 'Authorization': `Bearer ${userToken}`, 'X-Requested-With': 'XMLHttpRequest' },
    });
    expect(res.status).toBe(403);
  });
});
