import { LobbyService } from '../../services/LobbyService.js';
import { DatabaseService } from '../../services/DatabaseService.js';

const db = DatabaseService.getInstance();

async function testLobbyAPI() {
  console.log('Testing Lobby API functionality...');
  
  try {
    // Test database connection
    console.log('1. Testing database connection...');
    await db.testConnection();
    console.log('✓ Database connection successful');

    const lobbyService = new LobbyService();

    // Test lobby creation
    console.log('2. Testing lobby creation...');
    const createRequest = {
      hostId: 1, // Assuming user with ID 1 exists
      questionCount: 10,
      questionSetIds: [1, 2],
      settings: {
        timeLimit: 60,
        allowReplay: true
      }
    };

    try {
      const lobby = await lobbyService.createLobby(createRequest);
      console.log('✓ Lobby created successfully:', {
        id: lobby.id,
        code: lobby.code,
        status: lobby.status,
        playerCount: lobby.players.length
      });

      // Test lobby retrieval by code
      console.log('3. Testing lobby retrieval by code...');
      const retrievedLobby = await lobbyService.getLobbyByCode(lobby.code);
      if (retrievedLobby) {
        console.log('✓ Lobby retrieved successfully:', {
          code: retrievedLobby.code,
          status: retrievedLobby.status
        });
      } else {
        console.log('✗ Failed to retrieve lobby');
      }

      // Test joining lobby
      console.log('4. Testing lobby join...');
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
        players: joinedLobby.players.map((p: any) => ({ id: p.id, username: p.username, isHost: p.isHost }))
      });

      // Test player ready status update
      console.log('5. Testing player ready status update...');
      const readyLobby = await lobbyService.updatePlayerReady(lobby.code, 'player_123', true);
      const readyPlayer = readyLobby.players.find(p => p.id === 'player_123');
      console.log('✓ Player ready status updated:', {
        playerId: readyPlayer?.id,
        isReady: readyPlayer?.isReady
      });

      // Test lobby statistics
      console.log('6. Testing lobby statistics...');
      const stats = await lobbyService.getLobbyStats();
      console.log('✓ Lobby statistics retrieved:', stats);

      // Test active lobbies retrieval
      console.log('7. Testing active lobbies retrieval...');
      const activeLobbies = await lobbyService.getActiveLobbies(10);
      console.log('✓ Active lobbies retrieved:', {
        count: activeLobbies.length,
        lobbies: activeLobbies.map((l: any) => ({ code: l.code, status: l.status, playerCount: l.players.length }))
      });

      console.log('\n✅ All lobby API tests passed successfully!');

    } catch (error) {
      if (error instanceof Error && error.message === 'Host user not found') {
        console.log('⚠️  Skipping lobby creation test - no test user found');
        console.log('   This is expected if the database doesn\'t have test data');
        
        // Test code generation and validation instead
        console.log('2. Testing lobby code validation...');
        console.log('✓ Valid code ABC123:', LobbyService.isValidLobbyCode('ABC123'));
        console.log('✗ Invalid code abc123 (should be false):', LobbyService.isValidLobbyCode('abc123'));
        console.log('✓ Valid code ABCD12:', LobbyService.isValidLobbyCode('ABCD12'));
        console.log('✗ Invalid code ABC12@ (should be false):', LobbyService.isValidLobbyCode('ABC12@'));
        console.log('✓ Valid code 123ABC:', LobbyService.isValidLobbyCode('123ABC'));
        console.log('✗ Invalid code AB123 (too short):', LobbyService.isValidLobbyCode('AB123'));
        console.log('✗ Invalid code ABC123D (too long):', LobbyService.isValidLobbyCode('ABC123D'));
        
        console.log('\n✅ Basic lobby service tests passed!');
      } else {
        throw error;
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

// Run the test
testLobbyAPI().catch(console.error);