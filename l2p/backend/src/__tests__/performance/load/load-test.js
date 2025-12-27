import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');
const activeUsers = new Counter('active_users');
const databaseConnections = new Counter('database_connections');

// Test configuration
export const options = {
  stages: [
    { duration: '2m', target: 20 },   // Ramp up to 20 users
    { duration: '5m', target: 50 },   // Ramp up to 50 users
    { duration: '10m', target: 100 }, // Ramp up to 100 users
    { duration: '5m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'], // 95% of requests should be below 2s
    http_req_failed: ['rate<0.1'],     // Error rate should be below 10%
    errors: ['rate<0.05'],             // Custom error rate should be below 5%
  },
};

// Test data
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const TEST_USERS = [
  { username: 'loadtest1', password: 'TestPass123!' },
  { username: 'loadtest2', password: 'TestPass123!' },
  { username: 'loadtest3', password: 'TestPass123!' },
  { username: 'loadtest4', password: 'TestPass123!' },
  { username: 'loadtest5', password: 'TestPass123!' },
];

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

// Main test function
export default function() {
  const user = getRandomUser();
  const token = getAuthToken(user);
  
  if (!token) {
    errorRate.add(1);
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  // Test 1: Health check
  const healthCheck = http.get(`${BASE_URL}/api/health`);
  check(healthCheck, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 500ms': (r) => r.timings.duration < 500,
  });
  responseTime.add(healthCheck.timings.duration);

  // Test 2: Get question sets
  const questionSetsResponse = http.get(`${BASE_URL}/api/questions/sets`, { headers });
  check(questionSetsResponse, {
    'question sets status is 200': (r) => r.status === 200,
    'question sets response time < 1000ms': (r) => r.timings.duration < 1000,
    'question sets has data': (r) => JSON.parse(r.body).length > 0,
  });
  responseTime.add(questionSetsResponse.timings.duration);

  // Test 3: Create lobby
  const lobbyData = {
    name: `Load Test Lobby ${Date.now()}`,
    maxPlayers: 8,
    questionSetId: 1,
    settings: {
      timeLimit: 30,
      difficulty: 'medium',
    },
  };

  const createLobbyResponse = http.post(`${BASE_URL}/api/lobby/create`, JSON.stringify(lobbyData), { headers });
  check(createLobbyResponse, {
    'create lobby status is 201': (r) => r.status === 201,
    'create lobby response time < 2000ms': (r) => r.timings.duration < 2000,
    'lobby created successfully': (r) => JSON.parse(r.body).id !== undefined,
  });
  responseTime.add(createLobbyResponse.timings.duration);

  if (createLobbyResponse.status === 201) {
    const lobby = JSON.parse(createLobbyResponse.body);
    
    // Test 4: Join lobby
    const joinLobbyResponse = http.post(`${BASE_URL}/api/lobby/${lobby.id}/join`, {}, { headers });
    check(joinLobbyResponse, {
      'join lobby status is 200': (r) => r.status === 200,
      'join lobby response time < 1000ms': (r) => r.timings.duration < 1000,
    });
    responseTime.add(joinLobbyResponse.timings.duration);

    // Test 5: Get lobby details
    const lobbyDetailsResponse = http.get(`${BASE_URL}/api/lobby/${lobby.id}`, { headers });
    check(lobbyDetailsResponse, {
      'lobby details status is 200': (r) => r.status === 200,
      'lobby details response time < 1000ms': (r) => r.timings.duration < 1000,
    });
    responseTime.add(lobbyDetailsResponse.timings.duration);

    // Test 6: Leave lobby
    const leaveLobbyResponse = http.post(`${BASE_URL}/api/lobby/${lobby.id}/leave`, {}, { headers });
    check(leaveLobbyResponse, {
      'leave lobby status is 200': (r) => r.status === 200,
      'leave lobby response time < 1000ms': (r) => r.timings.duration < 1000,
    });
    responseTime.add(leaveLobbyResponse.timings.duration);
  }

  // Test 7: Get user profile
  const profileResponse = http.get(`${BASE_URL}/api/user/profile`, { headers });
  check(profileResponse, {
    'profile status is 200': (r) => r.status === 200,
    'profile response time < 1000ms': (r) => r.timings.duration < 1000,
  });
  responseTime.add(profileResponse.timings.duration);

  // Test 8: Get leaderboard
  const leaderboardResponse = http.get(`${BASE_URL}/api/leaderboard`, { headers });
  check(leaderboardResponse, {
    'leaderboard status is 200': (r) => r.status === 200,
    'leaderboard response time < 1500ms': (r) => r.timings.duration < 1500,
  });
  responseTime.add(leaderboardResponse.timings.duration);

  // Update custom metrics
  activeUsers.add(1);
  databaseConnections.add(1);

  // Random sleep between requests to simulate real user behavior
  sleep(Math.random() * 3 + 1);
}

// Setup function to prepare test data
export function setup() {
  console.log('Setting up load test environment...');
  
  // Create test users if they don't exist
  TEST_USERS.forEach(async (user) => {
    const registerResponse = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({
      username: user.username,
      email: `${user.username}@loadtest.com`,
      password: user.password,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

    if (registerResponse.status === 201) {
      console.log(`Created test user: ${user.username}`);
    }
  });

  return { baseUrl: BASE_URL };
}

// Teardown function to clean up test data
export function teardown(data) {
  console.log('Cleaning up load test environment...');
  
  // Clean up test users (optional - for persistent testing)
  // This could be implemented if needed for test isolation
}

// Handle test results
export function handleSummary(data) {
  console.log('Load test completed');
  console.log(`Total requests: ${data.metrics.http_reqs.values.count}`);
  console.log(`Average response time: ${data.metrics.http_req_duration.values.avg}ms`);
  console.log(`95th percentile: ${data.metrics.http_req_duration.values['p(95)']}ms`);
  console.log(`Error rate: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%`);
  
  return {
    'load-test-results.json': JSON.stringify(data, null, 2),
    'load-test-summary.txt': `
Load Test Summary
================
Total Requests: ${data.metrics.http_reqs.values.count}
Average Response Time: ${data.metrics.http_req_duration.values.avg}ms
95th Percentile: ${data.metrics.http_req_duration.values['p(95)']}ms
Error Rate: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%
Max Virtual Users: ${data.metrics.vus.values.max}
    `,
  };
} 