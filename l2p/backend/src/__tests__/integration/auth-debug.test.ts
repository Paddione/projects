import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import { createServer, Server } from 'http';
import request from 'supertest';
import { AuthService, TokenPayload } from '../../services/AuthService.js';
import { app } from '../../server.js';

describe('Auth Debug Tests', () => {
  let server: Server;
  let api: ReturnType<typeof request>;

  beforeAll(async () => {
    server = createServer(app);
    await new Promise<void>((resolve, reject) => {
      const onError = (error: Error) => reject(error);
      server.once('error', onError);
      server.listen(0, '127.0.0.1', () => {
        server.off('error', onError);
        resolve();
      });
    });
    api = request(server);
  });

  afterAll(async () => {
    if (!server) return;
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  it('should test admin endpoint without JWT token (expect 401)', async () => {
    // Test admin endpoint without token - should get 401
    const response = await api
      .get('/api/admin/info');

    console.log('Response status (no token):', response.status);
    console.log('Response body (no token):', response.body);

    expect(response.status).toBe(401);
  });

  it('should test admin endpoint with invalid JWT token (expect 401)', async () => {
    // Test admin endpoint with invalid token - should get 401
    const response = await api
      .get('/api/admin/info')
      .set('Authorization', 'Bearer invalid-token');

    console.log('Response status (invalid token):', response.status);
    console.log('Response body (invalid token):', response.body);

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

    console.log('Creating mock JWT token via AuthService...');

    const authService = new AuthService();
    const token = authService.generateAccessToken(adminPayload);

    console.log('Mock JWT token created:', token ? 'SUCCESS' : 'FAILED');
    console.log('Token length:', token.length);
    console.log('Token preview:', token.substring(0, 50) + '...');

    // Test with mock JWT token
    const response = await api
      .get('/api/admin/info')
      .set('Authorization', `Bearer ${token}`);

    console.log('Response status (mock token):', response.status);
    console.log('Response body (mock token):', response.body);

    // This should work if authentication is properly configured
    expect(response.status).toBe(200);
  });
});
