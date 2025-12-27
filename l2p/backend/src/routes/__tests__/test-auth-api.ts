import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { db } from '../services/DatabaseService.js';
import { migrationService } from '../services/MigrationService.js';
import authRoutes from '../routes/auth.js';

// Create test app
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use('/api/auth', authRoutes);

async function testAuthAPI() {
  console.log('🔧 Testing Authentication API endpoints...\n');

  try {
    // Initialize database
    console.log('Initializing database...');
    await db.testConnection();
    await migrationService.runMigrations();
    console.log('✅ Database initialized\n');

    let accessToken = '';
    let refreshToken = '';
    let userId = 0;

    // Test 1: Register endpoint
    console.log('1. Testing POST /api/auth/register...');
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'apitestuser',
        email: 'apitest@example.com',
        password: 'TestPassword123!',
        preferences: { language: 'en', theme: 'light' }
      });

    if (registerResponse.status === 201) {
      console.log('✅ Registration successful');
      console.log('User ID:', registerResponse.body.user.id);
      console.log('Username:', registerResponse.body.user.username);
      
      accessToken = registerResponse.body.tokens.accessToken;
      refreshToken = registerResponse.body.tokens.refreshToken;
      userId = registerResponse.body.user.id;
      
      // Check cookies
      const cookies = registerResponse.headers['set-cookie'];
      console.log('Cookies set:', cookies ? 'Yes' : 'No');
    } else {
      throw new Error(`Registration failed: ${registerResponse.status} - ${registerResponse.body.message}`);
    }

    // Test 2: Login endpoint
    console.log('\n2. Testing POST /api/auth/login...');
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'apitestuser',
        password: 'TestPassword123!'
      });

    if (loginResponse.status === 200) {
      console.log('✅ Login successful');
      console.log('User ID:', loginResponse.body.user.id);
      
      // Update tokens from login
      accessToken = loginResponse.body.tokens.accessToken;
      refreshToken = loginResponse.body.tokens.refreshToken;
    } else {
      throw new Error(`Login failed: ${loginResponse.status} - ${loginResponse.body.message}`);
    }

    // Test 3: Get current user endpoint
    console.log('\n3. Testing GET /api/auth/me...');
    const meResponse = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    if (meResponse.status === 200) {
      console.log('✅ Get current user successful');
      console.log('Username:', meResponse.body.user.username);
      console.log('Email:', meResponse.body.user.email);
    } else {
      throw new Error(`Get current user failed: ${meResponse.status} - ${meResponse.body.message}`);
    }

    // Test 4: Token validation endpoint
    console.log('\n4. Testing GET /api/auth/validate...');
    const validateResponse = await request(app)
      .get('/api/auth/validate')
      .set('Authorization', `Bearer ${accessToken}`);

    if (validateResponse.status === 200) {
      console.log('✅ Token validation successful');
      console.log('Valid:', validateResponse.body.valid);
      console.log('User ID:', validateResponse.body.user.userId);
    } else {
      throw new Error(`Token validation failed: ${validateResponse.status} - ${validateResponse.body.message}`);
    }

    // Test 5: Refresh token endpoint
    console.log('\n5. Testing POST /api/auth/refresh...');
    const refreshResponse = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `refreshToken=${refreshToken}`)
      .send({});

    if (refreshResponse.status === 200) {
      console.log('✅ Token refresh successful');
      console.log('New access token length:', refreshResponse.body.tokens.accessToken.length);
      
      // Update access token
      accessToken = refreshResponse.body.tokens.accessToken;
    } else {
      throw new Error(`Token refresh failed: ${refreshResponse.status} - ${refreshResponse.body.message}`);
    }

    // Test 6: Change password endpoint
    console.log('\n6. Testing POST /api/auth/change-password...');
    const changePasswordResponse = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'TestPassword123!',
        newPassword: 'NewPassword456!'
      });

    if (changePasswordResponse.status === 200) {
      console.log('✅ Password change successful');
    } else {
      throw new Error(`Password change failed: ${changePasswordResponse.status} - ${changePasswordResponse.body.message}`);
    }

    // Test 7: Login with new password
    console.log('\n7. Testing login with new password...');
    const newLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'apitestuser',
        password: 'NewPassword456!'
      });

    if (newLoginResponse.status === 200) {
      console.log('✅ Login with new password successful');
      accessToken = newLoginResponse.body.tokens.accessToken;
    } else {
      throw new Error(`Login with new password failed: ${newLoginResponse.status} - ${newLoginResponse.body.message}`);
    }

    // Test 8: Logout endpoint
    console.log('\n8. Testing POST /api/auth/logout...');
    const logoutResponse = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`);

    if (logoutResponse.status === 200) {
      console.log('✅ Logout successful');
    } else {
      throw new Error(`Logout failed: ${logoutResponse.status} - ${logoutResponse.body.message}`);
    }

    // Test 9: Test invalid credentials
    console.log('\n9. Testing invalid credentials...');
    const invalidLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        username: 'apitestuser',
        password: 'WrongPassword'
      });

    if (invalidLoginResponse.status === 401) {
      console.log('✅ Invalid credentials properly rejected');
    } else {
      throw new Error(`Invalid credentials test failed: Expected 401, got ${invalidLoginResponse.status}`);
    }

    // Test 10: Test invalid token
    console.log('\n10. Testing invalid token...');
    const invalidTokenResponse = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.token.here');

    if (invalidTokenResponse.status === 401) {
      console.log('✅ Invalid token properly rejected');
    } else {
      throw new Error(`Invalid token test failed: Expected 401, got ${invalidTokenResponse.status}`);
    }

    // Cleanup: Delete test user
    console.log('\n11. Cleaning up test user...');
    const { UserRepository } = await import('./repositories/UserRepository.js');
    const userRepository = new UserRepository();
    await userRepository.deleteUser(userId);
    console.log('✅ Test user deleted successfully');

    console.log('\n🎉 All authentication API tests passed!');

  } catch (error) {
    console.error('❌ API test failed:', error);
    
    // Try to cleanup in case of error
    try {
      const { UserRepository } = await import('./repositories/UserRepository.js');
      const userRepository = new UserRepository();
      const existingUser = await userRepository.findByUsername('apitestuser');
      if (existingUser) {
        await userRepository.deleteUser(existingUser.id);
        console.log('🧹 Cleaned up test user after error');
      }
    } catch (cleanupError) {
      console.error('Failed to cleanup test user:', cleanupError);
    }
  } finally {
    await db.close();
  }
}

// Run the test
testAuthAPI().catch(console.error);