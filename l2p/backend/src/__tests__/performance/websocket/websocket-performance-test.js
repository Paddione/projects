import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';
import ws from 'k6/ws';
import { textSummary } from 'https://jslib.k6.io/k6-summary/0.0.2/index.js';

// Custom metrics for WebSocket performance testing
const wsConnectionTime = new Trend('ws_connection_time');
const wsMessageLatency = new Trend('ws_message_latency');
const wsConnectionCount = new Counter('ws_connection_count');
const wsDisconnectionCount = new Counter('ws_disconnection_count');
const wsMessageThroughput = new Gauge('ws_message_throughput');
const wsBroadcastLatency = new Trend('ws_broadcast_latency');
const wsReconnectionTime = new Trend('ws_reconnection_time');
const wsConnectionErrors = new Counter('ws_connection_errors');
const wsMessageErrors = new Counter('ws_message_errors');

// WebSocket performance test configuration
export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Ramp up to 10 connections
    { duration: '2m', target: 50 },   // Ramp up to 50 connections
    { duration: '3m', target: 100 },  // Ramp up to 100 connections
    { duration: '5m', target: 200 },  // Ramp up to 200 connections
    { duration: '3m', target: 200 },  // Stay at 200 connections
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    ws_connection_time: ['p(95)<2000'],    // 95% of connections should be established within 2s
    ws_message_latency: ['p(95)<100'],     // 95% of messages should have latency < 100ms
    ws_broadcast_latency: ['p(95)<500'],   // 95% of broadcasts should have latency < 500ms
    ws_reconnection_time: ['p(95)<3000'],  // 95% of reconnections should be within 3s
    ws_connection_errors: ['rate<0.05'],   // Connection error rate should be below 5%
    ws_message_errors: ['rate<0.1'],       // Message error rate should be below 10%
  },
};

// Test data
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const WS_URL = __ENV.WS_URL || 'ws://localhost:3001';
const TEST_USERS = Array.from({ length: 25 }, (_, i) => ({
  username: `wsperftest${i + 1}`,
  password: 'TestPass123!',
}));

// WebSocket performance monitoring state
let activeConnections = 0;
let messageCount = 0;
let broadcastCount = 0;

// Helper function to get random user
function getRandomUser() {
  return TEST_USERS[Math.floor(Math.random() * TEST_USERS.length)];
}

// Helper function to generate auth token
function getAuthToken(user) {
  const loginResponse = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    username: user.username,
    password: user.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (loginResponse.status === 200) {
    const body = JSON.parse(loginResponse.body);
    return body.token;
  }
  return null;
}

// WebSocket connection performance test
function testWebSocketConnection(token, userId) {
  const startTime = Date.now();
  
  return new Promise((resolve) => {
    const socket = ws.connect(`${WS_URL}/socket.io/?token=${token}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    }, function(socket) {
      const connectionTime = Date.now() - startTime;
      wsConnectionTime.add(connectionTime);
      wsConnectionCount.add(1);
      activeConnections++;
      
      console.log(`WebSocket connected for user ${userId} in ${connectionTime}ms`);
      
      // Test message sending
      testMessageSending(socket, userId);
      
      // Test broadcasting
      testBroadcasting(socket, userId);
      
      // Test connection stability
      testConnectionStability(socket, userId);
      
      // Simulate user activity
      simulateUserActivity(socket, userId);
      
      // Close connection after test duration
      setTimeout(() => {
        socket.close();
        wsDisconnectionCount.add(1);
        activeConnections--;
        resolve();
      }, 30000); // 30 seconds per connection
    });
    
    socket.on('open', function() {
      console.log(`WebSocket opened for user ${userId}`);
    });
    
    socket.on('message', function(data) {
      const receiveTime = Date.now();
      const message = JSON.parse(data);
      
      // Calculate message latency
      if (message.timestamp) {
        const latency = receiveTime - message.timestamp;
        wsMessageLatency.add(latency);
        messageCount++;
      }
      
      // Handle different message types
      handleWebSocketMessage(socket, message, userId);
    });
    
    socket.on('close', function() {
      console.log(`WebSocket closed for user ${userId}`);
    });
    
    socket.on('error', function(error) {
      console.error(`WebSocket error for user ${userId}:`, error);
      wsConnectionErrors.add(1);
    });
  });
}

// Test message sending performance
function testMessageSending(socket, userId) {
  const messages = [
    { type: 'ping', data: { timestamp: Date.now() } },
    { type: 'user_ready', data: { userId, ready: true } },
    { type: 'game_action', data: { action: 'answer', questionId: 1, answer: 0 } },
    { type: 'chat_message', data: { message: 'Hello from performance test!' } },
  ];
  
  messages.forEach((message, index) => {
    setTimeout(() => {
      try {
        socket.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Failed to send message for user ${userId}:`, error);
        wsMessageErrors.add(1);
      }
    }, index * 1000); // Send messages with 1-second intervals
  });
}

// Test broadcasting performance
function testBroadcasting(socket, userId) {
  const broadcastMessages = [
    { type: 'lobby_update', data: { lobbyId: 1, players: ['user1', 'user2'] } },
    { type: 'game_state', data: { question: 'Test question?', options: ['A', 'B', 'C', 'D'] } },
    { type: 'score_update', data: { scores: { user1: 100, user2: 150 } } },
  ];
  
  broadcastMessages.forEach((message, index) => {
    setTimeout(() => {
      try {
        const startTime = Date.now();
        socket.send(JSON.stringify({
          ...message,
          broadcast: true,
          timestamp: startTime,
        }));
        broadcastCount++;
      } catch (error) {
        console.error(`Failed to broadcast message for user ${userId}:`, error);
        wsMessageErrors.add(1);
      }
    }, index * 2000); // Send broadcasts with 2-second intervals
  });
}

// Test connection stability
function testConnectionStability(socket, userId) {
  // Simulate network interruptions
  setTimeout(() => {
    console.log(`Simulating network interruption for user ${userId}`);
    socket.close();
    
    // Attempt reconnection
    setTimeout(() => {
      const reconnectStartTime = Date.now();
      const token = getAuthToken({ username: `wsperftest${userId}`, password: 'TestPass123!' });
      
      if (token) {
        ws.connect(`${WS_URL}/socket.io/?token=${token}`, {
          headers: { 'Authorization': `Bearer ${token}` },
        }, function(newSocket) {
          const reconnectTime = Date.now() - reconnectStartTime;
          wsReconnectionTime.add(reconnectTime);
          console.log(`Reconnected for user ${userId} in ${reconnectTime}ms`);
          
          // Close reconnected socket
          setTimeout(() => {
            newSocket.close();
          }, 10000);
        });
      }
    }, 2000);
  }, 15000); // Simulate interruption after 15 seconds
}

// Simulate user activity
function simulateUserActivity(socket, userId) {
  const activities = [
    () => socket.send(JSON.stringify({ type: 'user_typing', data: { userId } })),
    () => socket.send(JSON.stringify({ type: 'user_activity', data: { userId, activity: 'active' } })),
    () => socket.send(JSON.stringify({ type: 'ping', data: { timestamp: Date.now() } })),
  ];
  
  activities.forEach((activity, index) => {
    setTimeout(() => {
      try {
        activity();
      } catch (error) {
        console.error(`Activity failed for user ${userId}:`, error);
        wsMessageErrors.add(1);
      }
    }, index * 5000); // Activities every 5 seconds
  });
}

// Handle WebSocket messages
function handleWebSocketMessage(socket, message, userId) {
  switch (message.type) {
    case 'pong':
      // Handle ping-pong for latency measurement
      if (message.timestamp) {
        const latency = Date.now() - message.timestamp;
        wsMessageLatency.add(latency);
      }
      break;
      
    case 'broadcast_received':
      // Handle broadcast confirmation
      if (message.timestamp) {
        const broadcastLatency = Date.now() - message.timestamp;
        wsBroadcastLatency.add(broadcastLatency);
      }
      break;
      
    case 'error':
      console.error(`Received error message for user ${userId}:`, message.data);
      wsMessageErrors.add(1);
      break;
      
    default:
      // Handle other message types
      break;
  }
}

// Calculate message throughput
function calculateMessageThroughput() {
  const throughput = messageCount / (Date.now() / 1000); // messages per second
  wsMessageThroughput.add(throughput);
  return throughput;
}

// Main WebSocket performance test function
export default function() {
  const user = getRandomUser();
  const token = getAuthToken(user);
  
  if (!token) {
    console.error(`Failed to get token for user ${user.username}`);
    return;
  }

  // Test WebSocket connection and performance
  testWebSocketConnection(token, user.username);
  
  // Log performance metrics periodically
  if (__ITER % 10 === 0) {
    const throughput = calculateMessageThroughput();
    console.log(`WebSocket Performance - Active Connections: ${activeConnections}, Messages: ${messageCount}, Broadcasts: ${broadcastCount}, Throughput: ${throughput.toFixed(2)} msg/s`);
  }
  
  // Sleep between iterations
  sleep(Math.random() * 2 + 1);
}

// Setup function
export function setup() {
  console.log('Setting up WebSocket performance test environment...');
  
  // Create test users
  TEST_USERS.forEach(async (user) => {
    const registerResponse = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({
      username: user.username,
      email: `${user.username}@wsperftest.com`,
      password: user.password,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

    if (registerResponse.status === 201) {
      console.log(`Created WebSocket performance test user: ${user.username}`);
    }
  });
  
  return { baseUrl: BASE_URL, wsUrl: WS_URL };
}

// Teardown function
export function teardown(data) {
  console.log('Cleaning up WebSocket performance test environment...');
  console.log(`Final active connections: ${activeConnections}`);
  console.log(`Total messages sent: ${messageCount}`);
  console.log(`Total broadcasts sent: ${broadcastCount}`);
}

// Handle test results
export function handleSummary(data) {
  console.log('WebSocket performance test completed');
  console.log(`Total connections: ${data.metrics.ws_connection_count.values.count}`);
  console.log(`Average connection time: ${data.metrics.ws_connection_time.values.avg}ms`);
  console.log(`Average message latency: ${data.metrics.ws_message_latency.values.avg}ms`);
  console.log(`Connection errors: ${data.metrics.ws_connection_errors.values.count}`);
  console.log(`Message errors: ${data.metrics.ws_message_errors.values.count}`);
  
  return {
    'websocket-performance-results.json': JSON.stringify(data, null, 2),
    'websocket-performance-summary.txt': `
WebSocket Performance Test Summary
=================================
Total Connections: ${data.metrics.ws_connection_count.values.count}
Total Disconnections: ${data.metrics.ws_disconnection_count.values.count}
Average Connection Time: ${data.metrics.ws_connection_time.values.avg}ms
95th Percentile Connection Time: ${data.metrics.ws_connection_time.values['p(95)']}ms
Average Message Latency: ${data.metrics.ws_message_latency.values.avg}ms
95th Percentile Message Latency: ${data.metrics.ws_message_latency.values['p(95)']}ms
Average Broadcast Latency: ${data.metrics.ws_broadcast_latency.values.avg}ms
95th Percentile Broadcast Latency: ${data.metrics.ws_broadcast_latency.values['p(95)']}ms
Average Reconnection Time: ${data.metrics.ws_reconnection_time.values.avg}ms
95th Percentile Reconnection Time: ${data.metrics.ws_reconnection_time.values['p(95)']}ms
Connection Error Rate: ${(data.metrics.ws_connection_errors.values.rate * 100).toFixed(2)}%
Message Error Rate: ${(data.metrics.ws_message_errors.values.rate * 100).toFixed(2)}%
Average Message Throughput: ${data.metrics.ws_message_throughput.values.avg} msg/s
Peak Message Throughput: ${data.metrics.ws_message_throughput.values.max} msg/s
WebSocket Performance Status: ${data.metrics.ws_connection_errors.values.rate > 0.05 ? 'NEEDS OPTIMIZATION' : 'GOOD'}
    `,
  };
} 