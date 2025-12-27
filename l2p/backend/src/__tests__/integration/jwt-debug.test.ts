import { describe, it, expect } from '@jest/globals';
import { AuthService, TokenPayload } from '../../services/AuthService.js';

describe('JWT Debug Tests', () => {
  it('should create and verify JWT token correctly', () => {
    const authService = new AuthService();
    
    const adminPayload: TokenPayload = {
      userId: 999,
      username: 'admin-test',
      email: 'admin@test.local',
      selectedCharacter: 'professor',
      characterLevel: 1,
      isAdmin: true
    };

    console.log('Creating JWT token...');
    let token: string;
    try {
      token = authService.generateAccessToken(adminPayload);
      console.log('Token created:', token ? 'SUCCESS' : 'FAILED');
      if (token) {
        console.log('Token length:', token.length);
        console.log('Token preview:', token.substring(0, 50) + '...');
      } else {
        console.log('Token is undefined or null');
      }
    } catch (error) {
      console.log('Token creation failed with error:', error instanceof Error ? error.message : error);
      console.log('Error stack:', error instanceof Error ? error.stack : 'No stack');
      throw error;
    }

    console.log('Verifying JWT token...');
    try {
      const verifiedPayload = authService.verifyAccessToken(token);
      console.log('Token verification: SUCCESS');
      console.log('Verified payload:', JSON.stringify(verifiedPayload, null, 2));
      
      expect(verifiedPayload.userId).toBe(adminPayload.userId);
      expect(verifiedPayload.isAdmin).toBe(adminPayload.isAdmin);
    } catch (error) {
      console.log('Token verification: FAILED');
      console.log('Error:', error instanceof Error ? error.message : error);
      console.log('Error stack:', error instanceof Error ? error.stack : 'No stack');
      throw error;
    }
  });

  it('should verify manually created token matches AuthService format', () => {
    const crypto = require('crypto');
    
    const adminPayload = {
      userId: 999,
      username: 'admin-test',
      email: 'admin@test.local',
      selectedCharacter: 'professor',
      characterLevel: 1,
      isAdmin: true
    };

    // Create JWT manually (same as auth-debug test)
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      ...adminPayload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (15 * 60), // 15 minutes
      iss: 'learn2play-api',
      aud: 'learn2play-client'
    })).toString('base64url');
    
    const signature = crypto
      .createHmac('sha256', 'test_jwt_secret_for_testing_only_not_secure_but_long_enough_for_jwt')
      .update(`${header}.${payload}`)
      .digest('base64url');
    
    const manualToken = `${header}.${payload}.${signature}`;
    
    console.log('Manual token created');
    console.log('Manual token length:', manualToken.length);
    
    // Compare with AuthService token
    const authService = new AuthService();
    const serviceToken = authService.generateAccessToken(adminPayload);
    
    console.log('Service token length:', serviceToken.length);
    
    // Try to verify manual token
    console.log('Verifying manual token...');
    try {
      const verifiedPayload = authService.verifyAccessToken(manualToken);
      console.log('Manual token verification: SUCCESS');
      console.log('Verified payload:', JSON.stringify(verifiedPayload, null, 2));
    } catch (error) {
      console.log('Manual token verification: FAILED');
      console.log('Error:', error instanceof Error ? error.message : error);
    }
    
    // Try to verify service token
    console.log('Verifying service token...');
    try {
      const verifiedPayload = authService.verifyAccessToken(serviceToken);
      console.log('Service token verification: SUCCESS');
      console.log('Verified payload:', JSON.stringify(verifiedPayload, null, 2));
    } catch (error) {
      console.log('Service token verification: FAILED');
      console.log('Error:', error instanceof Error ? error.message : error);
    }
  });
});
