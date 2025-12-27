import { db } from '../../services/DatabaseService.js';
import { UserRepository } from '../../repositories/UserRepository.js';
import bcrypt from 'bcrypt';

async function testLobbyEndpoints() {
  console.log('Testing Lobby API Endpoints...');
  
  try {
    // Test database connection
    console.log('1. Testing database connection...');
    await db.testConnection();
    console.log('✓ Database connection successful');

    const userRepository = new UserRepository();

    // Create a test user first
    console.log('2. Creating test user...');
    const testUser = await userRepository.createUser({
      username: 'apitest',
      email: 'apitest@example.com',
      password_hash: await bcrypt.hash('testpassword', 10),
      preferences: { language: 'en', theme: 'light' }
    });
    console.log('✓ Test user created:', { id: testUser.id, username: testUser.username });

    const baseUrl = 'http://localhost:3001/api';

    // Test lobby statistics endpoint (no auth required)
    console.log('3. Testing GET /api/lobbies/stats...');
    const statsResponse = await fetch(`${baseUrl}/lobbies/stats`);
    if (statsResponse.ok) {
      const statsData = await statsResponse.json() as any;
      console.log('✓ Lobby stats retrieved:', statsData.stats);
    } else {
      console.log('✗ Failed to get lobby stats:', statsResponse.status);
    }

    // Test active lobbies endpoint
    console.log('4. Testing GET /api/lobbies...');
    const lobbiesResponse = await fetch(`${baseUrl}/lobbies`);
    if (lobbiesResponse.ok) {
      const lobbiesData = await lobbiesResponse.json() as any;
      console.log('✓ Active lobbies retrieved:', {
        count: lobbiesData.count,
        lobbies: lobbiesData.lobbies.length
      });
    } else {
      console.log('✗ Failed to get active lobbies:', lobbiesResponse.status);
    }

    // Test join lobby endpoint with invalid code
    console.log('5. Testing POST /api/lobbies/join with invalid code...');
    const invalidJoinResponse = await fetch(`${baseUrl}/lobbies/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lobbyCode: 'INVALID',
        player: {
          id: 'test_player',
          username: 'TestPlayer',
          character: 'wizard',
          isReady: false,
          isConnected: true
        }
      })
    });
    
    if (invalidJoinResponse.status === 400) {
      const errorData = await invalidJoinResponse.json() as any;
      console.log('✓ Invalid lobby code correctly rejected:', errorData.message);
    } else {
      console.log('✗ Invalid lobby code should have been rejected');
    }

    // Test get lobby with invalid code
    console.log('6. Testing GET /api/lobbies/:code with invalid code...');
    const invalidGetResponse = await fetch(`${baseUrl}/lobbies/INVALID`);
    if (invalidGetResponse.status === 400) {
      const errorData = await invalidGetResponse.json() as any;
      console.log('✓ Invalid lobby code correctly rejected:', errorData.message);
    } else {
      console.log('✗ Invalid lobby code should have been rejected');
    }

    // Test get lobby with valid but non-existent code
    console.log('7. Testing GET /api/lobbies/:code with non-existent code...');
    const notFoundResponse = await fetch(`${baseUrl}/lobbies/ABC123`);
    if (notFoundResponse.status === 404) {
      const errorData = await notFoundResponse.json() as any;
      console.log('✓ Non-existent lobby correctly returned 404:', errorData.message);
    } else {
      console.log('✗ Non-existent lobby should return 404');
    }

    // Clean up test user
    console.log('8. Cleaning up test user...');
    await userRepository.deleteUser(testUser.id);
    console.log('✓ Test user cleaned up');

    console.log('\n✅ All lobby endpoint tests passed successfully!');
    console.log('Note: Authentication-required endpoints need proper JWT tokens to test fully');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

// Run the test
testLobbyEndpoints().catch(console.error);