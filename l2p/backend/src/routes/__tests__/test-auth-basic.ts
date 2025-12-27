#!/usr/bin/env tsx

import { AuthService } from '../../services/AuthService.js';

async function testBasicAuth() {
  console.log('🔐 Testing Basic Authentication System...\n');

  const authService = new AuthService();

  try {
    // Test 1: User Registration
    console.log('1. Testing User Registration...');
    const testUser = {
      username: 'testuser_' + Date.now(),
      email: 'test@example.com',
      password: 'TestPassword123!',
      preferences: { language: 'en' as const, theme: 'light' as const }
    };

    try {
      const registerResult = await authService.register(testUser);
      console.log('✅ User registration successful');
      console.log('User ID:', registerResult.user.id);
      console.log('Username:', registerResult.user.username);
      console.log('Email:', registerResult.user.email);
      console.log('Email verified:', registerResult.user.email_verified);
      console.log('Selected character:', registerResult.user.selected_character);
      console.log('Character level:', registerResult.user.character_level);
      console.log('Experience points:', registerResult.user.experience_points);
      console.log('Has access token:', !!registerResult.tokens.accessToken);
      console.log('Has refresh token:', !!registerResult.tokens.refreshToken);
    } catch (error) {
      console.log('❌ User registration failed:', error instanceof Error ? error.message : error);
      console.log('Full error:', error);
      return;
    }
    console.log();

    // Test 2: Login
    console.log('2. Testing User Login...');
    try {
      const loginResult = await authService.login({
        username: testUser.username,
        password: testUser.password
      });
      console.log('✅ User login successful');
      console.log('User ID:', loginResult.user.id);
      console.log('Username:', loginResult.user.username);
      console.log('Email verified:', loginResult.user.email_verified);
      console.log('Character level:', loginResult.user.character_level);
    } catch (error) {
      console.log('❌ User login failed:', error instanceof Error ? error.message : error);
    }
    console.log();

    // Test 3: Token Verification
    console.log('3. Testing Token Verification...');
    try {
      const registerResult = await authService.register({
        username: 'tokentest_' + Date.now(),
        email: 'tokentest@example.com',
        password: 'TestPassword123!',
      });
      
      const user = await authService.getUserByToken(registerResult.tokens.accessToken);
      if (user) {
        console.log('✅ Token verification successful');
        console.log('Retrieved user:', user.username);
        console.log('Email verified:', user.email_verified);
      } else {
        console.log('❌ Token verification failed: No user returned');
      }
    } catch (error) {
      console.log('❌ Token verification failed:', error instanceof Error ? error.message : error);
    }
    console.log();

    // Test 4: Password Change
    console.log('4. Testing Password Change...');
    try {
      const registerResult = await authService.register({
        username: 'pwdtest_' + Date.now(),
        email: 'pwdtest@example.com',
        password: 'TestPassword123!',
      });
      
      await authService.changePassword(registerResult.user.id, 'TestPassword123!', 'NewPassword456!');
      console.log('✅ Password change successful');
      
      // Test login with new password
      const loginResult = await authService.login({
        username: registerResult.user.username,
        password: 'NewPassword456!'
      });
      console.log('✅ Login with new password successful');
    } catch (error) {
      console.log('❌ Password change failed:', error instanceof Error ? error.message : error);
    }
    console.log();

    console.log('🎉 Basic authentication system test completed!');

  } catch (error) {
    console.error('❌ Test failed with error:', error);
  }
}

// Run the test
testBasicAuth().catch(console.error);