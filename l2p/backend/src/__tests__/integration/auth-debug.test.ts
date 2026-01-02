import { describe, it, expect } from '@jest/globals';
import request from 'supertest';
import { AuthService, TokenPayload } from '../../services/AuthService.js';
import { app } from '../../server.js';

describe('Auth Debug Tests', () => {

  it('should test admin endpoint without JWT token (expect 401)', async () => {
    // Test admin endpoint without token - should get 401
    const response = await request(app)
      .get('/api/admin/info');

    expect(response.status).toBe(401);
  });

  it('should test admin endpoint with invalid JWT token (expect 401)', async () => {
    // Test admin endpoint with invalid token - should get 401
    const response = await request(app)
      .get('/api/admin/info')
      .set('Authorization', 'Bearer invalid-token');

    expect(response.status).toBe(401);
  });

  it('should test admin endpoint with mock JWT token', async () => {
    const adminPayload: TokenPayload = {
      userId: 999,
      username: 'admin-test',
      email: 'admin@test.local',
      selectedCharacter: 'professor',
      characterLevel: 1,
      isAdmin: true
    };

    const authService = new AuthService();
    const token = authService.generateAccessToken(adminPayload);

    // Test with mock JWT token
    const response = await request(app)
      .get('/api/admin/info')
      .set('Authorization', `Bearer ${token}`);

    // Should successfully authenticate with valid admin token
    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Admin access granted');
    expect(response.body.user.isAdmin).toBe(true);
  });
});
