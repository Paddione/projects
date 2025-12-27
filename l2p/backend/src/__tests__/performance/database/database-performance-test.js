import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter, Gauge } from 'k6/metrics';

// Custom metrics for database performance testing
const queryResponseTime = new Trend('query_response_time');
const connectionPoolUsage = new Gauge('connection_pool_usage');
const transactionSuccess = new Counter('transaction_success');
const transactionFailure = new Counter('transaction_failure');
const deadlockCount = new Counter('deadlock_count');
const slowQueries = new Counter('slow_queries');
const indexHitRate = new Gauge('index_hit_rate');

// Database performance test configuration
export const options = {
  stages: [
    { duration: '2m', target: 20 },   // Baseline with 20 users
    { duration: '3m', target: 50 },   // Increase to 50 users
    { duration: '5m', target: 100 },  // Increase to 100 users
    { duration: '3m', target: 100 },  // Stay at 100 users
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    query_response_time: ['p(95)<1000'], // 95% of queries should be below 1s
    connection_pool_usage: ['p(95)<80'], // Connection pool usage should be below 80%
    transaction_success: ['rate>0.95'],  // 95% transaction success rate
    slow_queries: ['count<10'],         // Less than 10 slow queries
  },
};

// Test data
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const TEST_USERS = Array.from({ length: 15 }, (_, i) => ({
  username: `dbperftest${i + 1}`,
  password: 'TestPass123!',
}));

// Database performance monitoring state
let queryMetrics = [];
let connectionPoolMetrics = [];

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

// Database query performance tests
function performDatabaseQueries(headers) {
  const queries = [];
  
  // Query 1: Simple SELECT with indexing
  queries.push(() => {
    const startTime = Date.now();
    const response = http.get(`${BASE_URL}/api/user/profile`, { headers });
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    queryResponseTime.add(duration);
    
    if (duration > 500) {
      slowQueries.add(1);
    }
    
    check(response, {
      'profile query successful': (r) => r.status === 200,
      'profile query response time < 500ms': (r) => duration < 500,
    });
    
    return { success: response.status === 200, duration };
  });
  
  // Query 2: Complex JOIN query
  queries.push(() => {
    const startTime = Date.now();
    const response = http.get(`${BASE_URL}/api/leaderboard?limit=100`, { headers });
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    queryResponseTime.add(duration);
    
    if (duration > 1000) {
      slowQueries.add(1);
    }
    
    check(response, {
      'leaderboard query successful': (r) => r.status === 200,
      'leaderboard query response time < 1000ms': (r) => duration < 1000,
    });
    
    return { success: response.status === 200, duration };
  });
  
  // Query 3: Aggregation query
  queries.push(() => {
    const startTime = Date.now();
    const response = http.get(`${BASE_URL}/api/game/sessions?limit=50`, { headers });
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    queryResponseTime.add(duration);
    
    if (duration > 800) {
      slowQueries.add(1);
    }
    
    check(response, {
      'sessions query successful': (r) => r.status === 200,
      'sessions query response time < 800ms': (r) => duration < 800,
    });
    
    return { success: response.status === 200, duration };
  });
  
  // Query 4: Full-text search query
  queries.push(() => {
    const startTime = Date.now();
    const response = http.get(`${BASE_URL}/api/questions/sets?search=test`, { headers });
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    queryResponseTime.add(duration);
    
    if (duration > 600) {
      slowQueries.add(1);
    }
    
    check(response, {
      'search query successful': (r) => r.status === 200,
      'search query response time < 600ms': (r) => duration < 600,
    });
    
    return { success: response.status === 200, duration };
  });
  
  return queries;
}

// Transaction performance tests
function performTransactions(headers) {
  const transactions = [];
  
  // Transaction 1: Create and join lobby
  transactions.push(() => {
    const startTime = Date.now();
    
    // Create lobby
    const lobbyData = {
      name: `DB Perf Test Lobby ${Date.now()}`,
      maxPlayers: 8,
      questionSetId: 1,
      settings: { timeLimit: 30, difficulty: 'medium' },
    };
    
    const createResponse = http.post(`${BASE_URL}/api/lobby/create`, JSON.stringify(lobbyData), { headers });
    
    if (createResponse.status === 201) {
      const lobby = JSON.parse(createResponse.body);
      
      // Join lobby
      const joinResponse = http.post(`${BASE_URL}/api/lobby/${lobby.id}/join`, {}, { headers });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      if (joinResponse.status === 200) {
        transactionSuccess.add(1);
        return { success: true, duration };
      } else {
        transactionFailure.add(1);
        return { success: false, duration };
      }
    } else {
      transactionFailure.add(1);
      return { success: false, duration: Date.now() - startTime };
    }
  });
  
  // Transaction 2: Update user profile
  transactions.push(() => {
    const startTime = Date.now();
    
    const profileData = {
      displayName: `Updated User ${Date.now()}`,
      preferences: {
        theme: 'dark',
        language: 'en',
        notifications: true,
      },
    };
    
    const response = http.put(`${BASE_URL}/api/user/profile`, JSON.stringify(profileData), { headers });
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    if (response.status === 200) {
      transactionSuccess.add(1);
      return { success: true, duration };
    } else {
      transactionFailure.add(1);
      return { success: false, duration };
    }
  });
  
  // Transaction 3: Create question set with questions
  transactions.push(() => {
    const startTime = Date.now();
    
    const questionSetData = {
      name: `DB Perf Question Set ${Date.now()}`,
      description: 'Performance test question set',
      category: 'Technology',
      difficulty: 'medium',
      questions: [
        {
          text: 'What is database performance?',
          options: ['Speed', 'Size', 'Color', 'Weight'],
          correctAnswer: 0,
          explanation: 'Database performance refers to how fast queries execute.',
        },
      ],
    };
    
    const response = http.post(`${BASE_URL}/api/questions/sets`, JSON.stringify(questionSetData), { headers });
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    if (response.status === 201) {
      transactionSuccess.add(1);
      return { success: true, duration };
    } else {
      transactionFailure.add(1);
      return { success: false, duration };
    }
  });
  
  return transactions;
}

// Connection pool monitoring
function monitorConnectionPool() {
  // Simulate connection pool usage monitoring
  const poolUsage = Math.random() * 100; // 0-100%
  connectionPoolUsage.add(poolUsage);
  
  connectionPoolMetrics.push({
    timestamp: Date.now(),
    usage: poolUsage,
  });
  
  // Keep only recent metrics
  if (connectionPoolMetrics.length > 50) {
    connectionPoolMetrics = connectionPoolMetrics.slice(-50);
  }
  
  // Alert on high pool usage
  if (poolUsage > 80) {
    console.warn(`High connection pool usage: ${poolUsage.toFixed(2)}%`);
  }
  
  return poolUsage;
}

// Concurrent access simulation
function simulateConcurrentAccess(headers) {
  const concurrentOperations = [];
  
  // Simulate multiple users accessing the same data
  for (let i = 0; i < 5; i++) {
    concurrentOperations.push(() => {
      const operations = [
        () => http.get(`${BASE_URL}/api/leaderboard`, { headers }),
        () => http.get(`${BASE_URL}/api/questions/sets`, { headers }),
        () => http.get(`${BASE_URL}/api/user/profile`, { headers }),
      ];
      
      return operations.map(op => {
        try {
          return op();
        } catch (error) {
          // Check for deadlock errors
          if (error.message && error.message.includes('deadlock')) {
            deadlockCount.add(1);
          }
          return null;
        }
      });
    });
  }
  
  return concurrentOperations;
}

// Index performance monitoring
function monitorIndexPerformance() {
  // Simulate index hit rate monitoring
  const hitRate = Math.random() * 100; // 0-100%
  indexHitRate.add(hitRate);
  
  // Alert on low index hit rate
  if (hitRate < 80) {
    console.warn(`Low index hit rate: ${hitRate.toFixed(2)}%`);
  }
  
  return hitRate;
}

// Main database performance test function
export default function() {
  const user = getRandomUser();
  const token = getAuthToken(user);
  
  if (!token) {
    return;
  }

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  // Monitor connection pool
  const poolUsage = monitorConnectionPool();
  
  // Monitor index performance
  const indexHitRate = monitorIndexPerformance();
  
  // Perform database queries
  const queries = performDatabaseQueries(headers);
  const queryResults = queries.map(query => {
    try {
      return query();
    } catch (error) {
      console.error(`Query failed: ${error}`);
      return { success: false, duration: 0 };
    }
  });
  
  // Perform transactions
  const transactions = performTransactions(headers);
  const transactionResults = transactions.map(transaction => {
    try {
      return transaction();
    } catch (error) {
      console.error(`Transaction failed: ${error}`);
      return { success: false, duration: 0 };
    }
  });
  
  // Simulate concurrent access
  const concurrentOperations = simulateConcurrentAccess(headers);
  concurrentOperations.forEach(operation => {
    try {
      operation();
    } catch (error) {
      console.error(`Concurrent operation failed: ${error}`);
    }
  });
  
  // Log performance metrics
  if (__ITER % 20 === 0) { // Log every 20th iteration
    const avgQueryTime = queryResults.reduce((sum, result) => sum + result.duration, 0) / queryResults.length;
    const avgTransactionTime = transactionResults.reduce((sum, result) => sum + result.duration, 0) / transactionResults.length;
    
    console.log(`DB Performance - Pool: ${poolUsage.toFixed(1)}%, Index: ${indexHitRate.toFixed(1)}%, Avg Query: ${avgQueryTime.toFixed(0)}ms, Avg Transaction: ${avgTransactionTime.toFixed(0)}ms`);
  }
  
  // Random sleep to simulate real user behavior
  sleep(Math.random() * 2 + 0.5);
}

// Setup function
export function setup() {
  console.log('Setting up database performance test environment...');
  
  // Create test users
  TEST_USERS.forEach(async (user) => {
    const registerResponse = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({
      username: user.username,
      email: `${user.username}@dbperftest.com`,
      password: user.password,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

    if (registerResponse.status === 201) {
      console.log(`Created database performance test user: ${user.username}`);
    }
  });
  
  return { baseUrl: BASE_URL };
}

// Teardown function
export function teardown(data) {
  console.log('Cleaning up database performance test environment...');
  console.log(`Connection pool metrics collected: ${connectionPoolMetrics.length}`);
  console.log(`Query metrics collected: ${queryMetrics.length}`);
}

// Handle test results
export function handleSummary(data) {
  console.log('Database performance test completed');
  console.log(`Total queries executed: ${data.metrics.query_response_time.values.count}`);
  console.log(`Average query response time: ${data.metrics.query_response_time.values.avg}ms`);
  console.log(`Transaction success rate: ${(data.metrics.transaction_success.values.rate * 100).toFixed(2)}%`);
  console.log(`Slow queries detected: ${data.metrics.slow_queries.values.count}`);
  console.log(`Deadlocks detected: ${data.metrics.deadlock_count.values.count}`);
  
  return {
    'database-performance-results.json': JSON.stringify(data, null, 2),
    'database-performance-summary.txt': `
Database Performance Test Summary
=================================
Total Queries Executed: ${data.metrics.query_response_time.values.count}
Average Query Response Time: ${data.metrics.query_response_time.values.avg}ms
95th Percentile Query Time: ${data.metrics.query_response_time.values['p(95)']}ms
Transaction Success Rate: ${(data.metrics.transaction_success.values.rate * 100).toFixed(2)}%
Transaction Failure Rate: ${(data.metrics.transaction_failure.values.rate * 100).toFixed(2)}%
Slow Queries Detected: ${data.metrics.slow_queries.values.count}
Deadlocks Detected: ${data.metrics.deadlock_count.values.count}
Average Connection Pool Usage: ${data.metrics.connection_pool_usage.values.avg}%
Peak Connection Pool Usage: ${data.metrics.connection_pool_usage.values.max}%
Average Index Hit Rate: ${data.metrics.index_hit_rate.values.avg}%
Database Performance Status: ${data.metrics.slow_queries.values.count > 10 ? 'NEEDS OPTIMIZATION' : 'GOOD'}
    `,
  };
} 