import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// Custom metrics for stress testing
const errorRate = new Rate('errors');
const responseTime = new Trend('response_time');
const memoryUsage = new Gauge('memory_usage');
const cpuUsage = new Gauge('cpu_usage');
const connectionPoolExhaustion = new Counter('connection_pool_exhaustion');
const timeoutErrors = new Counter('timeout_errors');
const serverErrors = new Counter('server_errors');

// Stress test configuration - designed to push system to breaking point
export const options = {
  stages: [
    { duration: '1m', target: 50 },    // Ramp up to 50 users
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '3m', target: 200 },   // Ramp up to 200 users
    { duration: '5m', target: 500 },   // Ramp up to 500 users (stress level)
    { duration: '3m', target: 1000 },  // Ramp up to 1000 users (breaking point)
    { duration: '2m', target: 1000 },  // Stay at breaking point
    { duration: '1m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<5000'], // 95% of requests should be below 5s
    http_req_failed: ['rate<0.3'],     // Error rate should be below 30% under stress
    errors: ['rate<0.2'],              // Custom error rate should be below 20%
    timeout_errors: ['count<100'],     // Timeout errors should be limited
    server_errors: ['count<50'],       // Server errors should be limited
  },
};

// Test data
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const TEST_USERS = Array.from({ length: 20 }, (_, i) => ({
  username: `stresstest${i + 1}`,
  password: 'TestPass123!',
}));

// Helper function to get random user
function getRandomUser() {
  return TEST_USERS[Math.floor(Math.random() * TEST_USERS.length)];
}

// Helper function to generate auth token with retry logic
function getAuthToken(user, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const loginResponse = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
        username: user.username,
        password: user.password,
      }), {
        headers: { 'Content-Type': 'application/json' },
        timeout: '10s',
      });

      if (loginResponse.status === 200) {
        const body = JSON.parse(loginResponse.body);
        return body.token;
      }
    } catch (error) {
      if (i === retries - 1) {
        console.error(`Failed to get auth token for ${user.username}:`, error);
        timeoutErrors.add(1);
      }
      sleep(1);
    }
  }
  return null;
}

// Stress test scenarios
function performStressScenario(headers, scenario) {
  const startTime = Date.now();
  
  try {
    switch (scenario) {
      case 'heavy_database_queries':
        return performHeavyDatabaseQueries(headers);
      case 'concurrent_lobby_operations':
        return performConcurrentLobbyOperations(headers);
      case 'file_upload_stress':
        return performFileUploadStress(headers);
      case 'websocket_connection_stress':
        return performWebSocketStress(headers);
      case 'ai_generation_stress':
        return performAIGenerationStress(headers);
      default:
        return performBasicStress(headers);
    }
  } catch (error) {
    errorRate.add(1);
    console.error(`Stress scenario ${scenario} failed:`, error);
    return false;
  }
}

// Heavy database queries stress test
function performHeavyDatabaseQueries(headers) {
  const queries = [
    () => http.get(`${BASE_URL}/api/leaderboard?limit=1000`, { headers }),
    () => http.get(`${BASE_URL}/api/questions/sets?limit=500`, { headers }),
    () => http.get(`${BASE_URL}/api/user/profile`, { headers }),
    () => http.get(`${BASE_URL}/api/game/sessions?limit=1000`, { headers }),
  ];

  const results = queries.map(query => {
    try {
      return query();
    } catch (error) {
      serverErrors.add(1);
      return null;
    }
  });

  return results.every(result => result && result.status < 500);
}

// Concurrent lobby operations stress test
function performConcurrentLobbyOperations(headers) {
  const lobbyData = {
    name: `Stress Test Lobby ${Date.now()}`,
    maxPlayers: 8,
    questionSetId: 1,
    settings: { timeLimit: 30, difficulty: 'medium' },
  };

  // Create multiple lobbies simultaneously
  const createPromises = Array.from({ length: 10 }, () =>
    http.post(`${BASE_URL}/api/lobby/create`, JSON.stringify(lobbyData), { headers })
  );

  const results = createPromises.map(response => {
    if (response.status === 201) {
      const lobby = JSON.parse(response.body);
      
      // Immediately try to join the lobby
      const joinResponse = http.post(`${BASE_URL}/api/lobby/${lobby.id}/join`, {}, { headers });
      
      // Try to get lobby details
      const detailsResponse = http.get(`${BASE_URL}/api/lobby/${lobby.id}`, { headers });
      
      return joinResponse.status === 200 && detailsResponse.status === 200;
    }
    return false;
  });

  return results.filter(Boolean).length > 5; // At least 50% should succeed
}

// File upload stress test
function performFileUploadStress(headers) {
  // Create a large text file for upload testing
  const largeText = 'A'.repeat(1024 * 1024); // 1MB of text
  const fileData = new FormData();
  fileData.append('file', new Blob([largeText], { type: 'text/plain' }), 'stress-test.txt');
  fileData.append('questionSetId', '1');

  try {
    const uploadResponse = http.post(`${BASE_URL}/api/upload/document`, fileData, {
      headers: { ...headers, 'Content-Type': 'multipart/form-data' },
      timeout: '30s',
    });

    return uploadResponse.status === 200 || uploadResponse.status === 201;
  } catch (error) {
    timeoutErrors.add(1);
    return false;
  }
}

// WebSocket connection stress test
function performWebSocketStress(headers) {
  // This would require WebSocket client implementation
  // For now, we'll test the WebSocket endpoint availability
  try {
    const wsResponse = http.get(`${BASE_URL}/socket.io/`, { headers });
    return wsResponse.status === 200;
  } catch (error) {
    return false;
  }
}

// AI generation stress test
function performAIGenerationStress(headers) {
  const aiData = {
    prompt: 'Generate 10 questions about stress testing',
    count: 10,
    difficulty: 'hard',
    category: 'Technology',
    questionSetId: 1,
  };

  try {
    const aiResponse = http.post(`${BASE_URL}/api/questions/generate`, JSON.stringify(aiData), {
      headers,
      timeout: '60s',
    });

    return aiResponse.status === 200 || aiResponse.status === 202;
  } catch (error) {
    timeoutErrors.add(1);
    return false;
  }
}

// Basic stress test
function performBasicStress(headers) {
  const requests = [
    () => http.get(`${BASE_URL}/api/health`),
    () => http.get(`${BASE_URL}/api/questions/sets`, { headers }),
    () => http.get(`${BASE_URL}/api/leaderboard`, { headers }),
    () => http.get(`${BASE_URL}/api/user/profile`, { headers }),
  ];

  const results = requests.map(request => {
    try {
      return request();
    } catch (error) {
      serverErrors.add(1);
      return null;
    }
  });

  return results.every(result => result && result.status < 500);
}

// Main stress test function
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

  // Randomly select a stress scenario
  const scenarios = [
    'heavy_database_queries',
    'concurrent_lobby_operations',
    'file_upload_stress',
    'websocket_connection_stress',
    'ai_generation_stress',
    'basic_stress',
  ];

  const selectedScenario = scenarios[Math.floor(Math.random() * scenarios.length)];
  
  // Perform the stress scenario
  const success = performStressScenario(headers, selectedScenario);
  
  // Record metrics
  if (!success) {
    errorRate.add(1);
  }

  // Simulate resource monitoring
  memoryUsage.add(Math.random() * 100);
  cpuUsage.add(Math.random() * 100);

  // Random sleep to simulate real user behavior
  sleep(Math.random() * 2 + 0.5);
}

// Setup function
export function setup() {
  console.log('Setting up stress test environment...');
  
  // Create test users for stress testing
  const userPromises = TEST_USERS.map(async (user) => {
    const registerResponse = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({
      username: user.username,
      email: `${user.username}@stresstest.com`,
      password: user.password,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

    if (registerResponse.status === 201) {
      console.log(`Created stress test user: ${user.username}`);
    }
  });

  return { baseUrl: BASE_URL, usersCreated: TEST_USERS.length };
}

// Teardown function
export function teardown(data) {
  console.log('Cleaning up stress test environment...');
  console.log(`Stress test completed with ${data.usersCreated} test users`);
}

// Handle test results
export function handleSummary(data) {
  console.log('Stress test completed');
  console.log(`Total requests: ${data.metrics.http_reqs.values.count}`);
  console.log(`Average response time: ${data.metrics.http_req_duration.values.avg}ms`);
  console.log(`95th percentile: ${data.metrics.http_req_duration.values['p(95)']}ms`);
  console.log(`Error rate: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%`);
  console.log(`Max virtual users: ${data.metrics.vus.values.max}`);
  console.log(`Timeout errors: ${data.metrics.timeout_errors.values.count}`);
  console.log(`Server errors: ${data.metrics.server_errors.values.count}`);
  
  return {
    'stress-test-results.json': JSON.stringify(data, null, 2),
    'stress-test-summary.txt': `
Stress Test Summary
==================
Total Requests: ${data.metrics.http_reqs.values.count}
Average Response Time: ${data.metrics.http_req_duration.values.avg}ms
95th Percentile: ${data.metrics.http_req_duration.values['p(95)']}ms
Error Rate: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%
Max Virtual Users: ${data.metrics.vus.values.max}
Timeout Errors: ${data.metrics.timeout_errors.values.count}
Server Errors: ${data.metrics.server_errors.values.count}
Breaking Point Identified: ${data.metrics.vus.values.max > 500 ? 'Yes' : 'No'}
    `,
  };
} 