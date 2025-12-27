import { AuthService } from '../../services/AuthService.js';
import { UserRepository } from '../../repositories/UserRepository.js';

async function testAuthSystem() {
  console.log('Testing Authentication System...\n');

  const authService = new AuthService();
  const userRepository = new UserRepository();

  try {
    // Test 1: Register a new user
    console.log('1. Testing user registration...');
    const registerData = {
      username: 'testuser',
      email: 'test@example.com',
      password: 'TestPassword123!',
      preferences: { language: 'en' as const, theme: 'light' as const }
    };

    const registrationResult = await authService.register(registerData);
    console.log('✅ User registered successfully');
    console.log('User ID:', registrationResult.user.id);
    console.log('Username:', registrationResult.user.username);
    console.log('Access Token Length:', registrationResult.tokens.accessToken.length);
    console.log('Refresh Token Length:', registrationResult.tokens.refreshToken.length);

    // Test 2: Login with credentials
    console.log('\n2. Testing user login...');
    const loginResult = await authService.login({
      username: 'testuser',
      password: 'TestPassword123!'
    });
    console.log('✅ User logged in successfully');
    console.log('User ID:', loginResult.user.id);

    // Test 3: Verify access token
    console.log('\n3. Testing token verification...');
    const tokenPayload = authService.verifyAccessToken(loginResult.tokens.accessToken);
    console.log('✅ Access token verified successfully');
    console.log('Token User ID:', tokenPayload.userId);
    console.log('Token Username:', tokenPayload.username);

    // Test 4: Refresh token
    console.log('\n4. Testing token refresh...');
    const refreshedTokens = await authService.refreshToken(loginResult.tokens.refreshToken);
    console.log('✅ Tokens refreshed successfully');
    console.log('New Access Token Length:', refreshedTokens.accessToken.length);

    // Test 5: Get user by token
    console.log('\n5. Testing get user by token...');
    const userFromToken = await authService.getUserByToken(refreshedTokens.accessToken);
    console.log('✅ User retrieved by token successfully');
    console.log('User from token:', userFromToken?.username);

    // Test 6: Change password
    console.log('\n6. Testing password change...');
    await authService.changePassword(registrationResult.user.id, 'TestPassword123!', 'NewPassword456!');
    console.log('✅ Password changed successfully');

    // Test 7: Login with new password
    console.log('\n7. Testing login with new password...');
    const newLoginResult = await authService.login({
      username: 'testuser',
      password: 'NewPassword456!'
    });
    console.log('✅ Login with new password successful');

    // Test 8: Test invalid credentials
    console.log('\n8. Testing invalid credentials...');
    try {
      await authService.login({
        username: 'testuser',
        password: 'WrongPassword'
      });
      console.log('❌ Should have failed with invalid credentials');
    } catch (error) {
      console.log('✅ Invalid credentials properly rejected');
    }

    // Test 9: Test expired/invalid token
    console.log('\n9. Testing invalid token...');
    try {
      authService.verifyAccessToken('invalid.token.here');
      console.log('❌ Should have failed with invalid token');
    } catch (error) {
      console.log('✅ Invalid token properly rejected');
    }

    // Cleanup: Delete test user
    console.log('\n10. Cleaning up test user...');
    await userRepository.deleteUser(registrationResult.user.id);
    console.log('✅ Test user deleted successfully');

    console.log('\n🎉 All authentication tests passed!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    
    // Try to cleanup in case of error
    try {
      const existingUser = await userRepository.findByUsername('testuser');
      if (existingUser) {
        await userRepository.deleteUser(existingUser.id);
        console.log('🧹 Cleaned up test user after error');
      }
    } catch (cleanupError) {
      console.error('Failed to cleanup:', cleanupError);
    }
  }
}

// Run the test
testAuthSystem().catch(console.error);