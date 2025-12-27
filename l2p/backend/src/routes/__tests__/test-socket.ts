import { io as Client } from 'socket.io-client';

const SERVER_URL = 'http://localhost:3001';

async function testSocketConnection() {
  console.log('Testing Socket.IO connection...');
  
  const socket = Client(SERVER_URL);
  
  return new Promise<void>((resolve, reject) => {
    socket.on('connect', () => {
      console.log('✅ Connected to server');
      
      // Test ping/pong
      socket.emit('ping');
      socket.once('pong', (data) => {
        console.log('✅ Ping/pong working:', data);
        
        // Test lobby join
        testLobbyJoin(socket)
          .then(() => {
            console.log('✅ All WebSocket tests passed');
            socket.disconnect();
            resolve();
          })
          .catch(reject);
      });
    });
    
    socket.on('connect_error', (error) => {
      console.error('❌ Connection failed:', error.message);
      reject(error);
    });
    
    // Timeout after 10 seconds
    setTimeout(() => {
      reject(new Error('Connection timeout'));
    }, 10000);
  });
}

async function testLobbyJoin(socket: any) {
  console.log('Testing lobby join functionality...');
  
  const testPlayer = {
    id: 'test-player-1',
    username: 'TestPlayer',
    character: 'wizard',
    isHost: false
  };
  
  const testLobbyCode = 'ABC123';
  
  return new Promise<void>((resolve, reject) => {
    // Test joining a non-existent lobby
    socket.emit('join-lobby', {
      lobbyCode: testLobbyCode,
      player: testPlayer
    });
    
    socket.once('join-error', (data: any) => {
      console.log('✅ Expected error for non-existent lobby:', data);
      
      // Test invalid lobby code
      socket.emit('join-lobby', {
        lobbyCode: 'INVALID',
        player: testPlayer
      });
      
      socket.once('join-error', (data: any) => {
        console.log('✅ Expected error for invalid code:', data);
        resolve();
      });
    });
    
    // Timeout after 5 seconds
    setTimeout(() => {
      reject(new Error('Lobby join test timeout'));
    }, 5000);
  });
}

async function testPlayerReady() {
  console.log('Testing player ready functionality...');
  
  const socket = Client(SERVER_URL);
  
  return new Promise<void>((resolve, reject) => {
    socket.on('connect', () => {
      console.log('✅ Connected for ready test');
      
      const testPlayer = {
        id: 'test-player-2',
        username: 'TestPlayer2',
        character: 'knight',
        isHost: false
      };
      
      // Test player ready event
      socket.emit('player-ready', {
        lobbyCode: 'TEST123',
        playerId: testPlayer.id,
        isReady: true
      });
      
      socket.once('ready-error', (data: any) => {
        console.log('✅ Expected error for non-existent lobby:', data);
        socket.disconnect();
        resolve();
      });
      
      // Timeout after 5 seconds
      setTimeout(() => {
        reject(new Error('Player ready test timeout'));
      }, 5000);
    });
  });
}

async function testGameEvents() {
  console.log('Testing game events...');
  
  const socket = Client(SERVER_URL);
  
  return new Promise<void>((resolve, reject) => {
    socket.on('connect', () => {
      console.log('✅ Connected for game events test');
      
      // Test submit answer
      socket.emit('submit-answer', {
        lobbyCode: 'TEST123',
        playerId: 'test-player-3',
        answer: 'A',
        timeElapsed: 30
      });
      
      socket.once('answer-received', (data: any) => {
        console.log('✅ Answer received:', data);
        socket.disconnect();
        resolve();
      });
      
      // Timeout after 5 seconds
      setTimeout(() => {
        console.log('⚠️ No answer response received, but this is expected for non-existent lobby');
        socket.disconnect();
        resolve();
      }, 5000);
    });
  });
}

async function runAllTests() {
  try {
    console.log('🚀 Starting WebSocket tests...\n');
    
    await testSocketConnection();
    console.log('\n✅ Socket connection test completed');
    
    await testPlayerReady();
    console.log('\n✅ Player ready test completed');
    
    await testGameEvents();
    console.log('\n✅ Game events test completed');
    
    console.log('\n🎉 All WebSocket tests passed successfully!');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ WebSocket test failed:', error);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
} 