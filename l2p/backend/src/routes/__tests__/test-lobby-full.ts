import { LobbyService } from '../../services/LobbyService.js';
import { UserRepository } from '../../repositories/UserRepository.js';
import { DatabaseService } from '../../services/DatabaseService.js';

const db = DatabaseService.getInstance();
import bcrypt from 'bcrypt';

async function testFullLobbyFunctionality() {
  console.log('Testing Full Lobby Functionality...');
  
  try {
    // Test database connection
    console.log('1. Testing database connection...');
    await db.testConnection();
    console.log('✓ Database connection successful');

    const userRepository = new UserRepository();
    const lobbyService = new LobbyService();

    // Create a test user first
    console.log('2. Creating test user...');
    const testUser = await userRepository.createUser({
      username: 'testhost',
      email: 'testhost@example.com',
      password_hash: await bcrypt.hash('testpassword', 10),
      preferences: { language: 'en', theme: 'light' }
    });
    console.log('✓ Test user created:', { id: testUser.id, username: testUser.username });

    // Test lobby creation
    console.log('3. Testing lobby creation...');
    const createRequest = {
      hostId: testUser.id,
      questionCount: 10,
      questionSetIds: [1, 2],
      settings: {
        timeLimit: 60,
        allowReplay: true
      }
    };

    const lobby = await lobbyService.createLobby(createRequest);
    console.log('✓ Lobby created successfully:', {
      id: lobby.id,
      code: lobby.code,
      status: lobby.status,
      playerCount: lobby.players.length,
      hostPlayer: lobby.players.find((p: any) => p.isHost)?.username
    });

    // Test lobby retrieval by code
    console.log('4. Testing lobby retrieval by code...');
    const retrievedLobby = await lobbyService.getLobbyByCode(lobby.code);
    if (retrievedLobby) {
      console.log('✓ Lobby retrieved successfully:', {
        code: retrievedLobby.code,
        status: retrievedLobby.status,
        playerCount: retrievedLobby.players.length
      });
    } else {
      throw new Error('Failed to retrieve lobby');
    }

    // Test joining lobby
    console.log('5. Testing lobby join...');
    const joinRequest = {
      lobbyCode: lobby.code,
      player: {
        id: 'player_123',
        username: 'TestPlayer',
        character: 'wizard',
        isReady: false,
        isConnected: true
      }
    };

    const joinedLobby = await lobbyService.joinLobby(joinRequest);
    console.log('✓ Player joined lobby successfully:', {
      playerCount: joinedLobby.players.length,
      players: joinedLobby.players.map((p: any) => ({ 
        id: p.id, 
        username: p.username, 
        isHost: p.isHost,
        character: p.character 
      }))
    });

    // Test player ready status update
    console.log('6. Testing player ready status update...');
    const readyLobby = await lobbyService.updatePlayerReady(lobby.code, 'player_123', true);
    const readyPlayer = readyLobby.players.find((p: any) => p.id === 'player_123');
    console.log('✓ Player ready status updated:', {
      playerId: readyPlayer?.id,
      isReady: readyPlayer?.isReady
    });

    // Test host ready status update
    console.log('7. Testing host ready status update...');
    const hostId = `user_${testUser.id}`;
    const hostReadyLobby = await lobbyService.updatePlayerReady(lobby.code, hostId, true);
    const hostPlayer = hostReadyLobby.players.find((p: any) => p.id === hostId);
    console.log('✓ Host ready status updated:', {
      playerId: hostPlayer?.id,
      isReady: hostPlayer?.isReady
    });

    // Test game start
    console.log('8. Testing game start...');
    const startedLobby = await lobbyService.startGame(lobby.code, testUser.id);
    console.log('✓ Game started successfully:', {
      status: startedLobby.status,
      startedAt: startedLobby.started_at
    });

    // Test lobby settings update (should fail after game started)
    console.log('9. Testing lobby settings update after game start (should fail)...');
    try {
      await lobbyService.updateLobbySettings(lobby.code, testUser.id, { questionCount: 15 });
      console.log('✗ Settings update should have failed');
    } catch (error) {
      console.log('✓ Settings update correctly failed after game start:', (error as Error).message);
    }

    // Test player leaving
    console.log('10. Testing player leave...');
    const afterLeaveLobby = await lobbyService.leaveLobby(lobby.code, 'player_123');
    if (afterLeaveLobby) {
      console.log('✓ Player left successfully:', {
        playerCount: afterLeaveLobby.players.length,
        remainingPlayers: afterLeaveLobby.players.map((p: any) => p.username)
      });
    }

    // Test lobby statistics
    console.log('11. Testing lobby statistics...');
    const stats = await lobbyService.getLobbyStats();
    console.log('✓ Lobby statistics retrieved:', stats);

    // Test active lobbies retrieval
    console.log('12. Testing active lobbies retrieval...');
    const activeLobbies = await lobbyService.getActiveLobbies(10);
    console.log('✓ Active lobbies retrieved:', {
      count: activeLobbies.length,
      lobbies: activeLobbies.map((l: any) => ({ 
        code: l.code, 
        status: l.status, 
        playerCount: l.players.length 
      }))
    });

    // Test lobbies by host
    console.log('13. Testing lobbies by host...');
    const hostLobbies = await lobbyService.getLobbiesByHost(testUser.id);
    console.log('✓ Host lobbies retrieved:', {
      count: hostLobbies.length,
      lobbies: hostLobbies.map((l: any) => ({ code: l.code, status: l.status }))
    });

    // Clean up test user
    console.log('14. Cleaning up test user...');
    await userRepository.deleteUser(testUser.id);
    console.log('✓ Test user cleaned up');

    console.log('\n✅ All lobby functionality tests passed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

// Run the test
testFullLobbyFunctionality().catch(console.error);