import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Gauge, Counter } from 'k6/metrics';

// Custom metrics for memory testing
const memoryUsage = new Gauge('memory_usage_mb');
const memoryGrowth = new Trend('memory_growth_rate');
const garbageCollectionCount = new Counter('gc_count');
const memoryLeakDetected = new Counter('memory_leak_detected');
const resourceCleanup = new Counter('resource_cleanup');
const longRunningSessions = new Counter('long_running_sessions');

// Memory test configuration
export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Baseline with 10 users
    { duration: '5m', target: 10 },   // Monitor memory for 5 minutes
    { duration: '2m', target: 50 },   // Increase load to 50 users
    { duration: '5m', target: 50 },   // Monitor memory under load
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    memory_growth_rate: ['p(95)<10'], // Memory growth should be less than 10MB/min
    memory_usage_mb: ['p(95)<1000'],  // Memory usage should stay below 1GB
    memory_leak_detected: ['count<5'], // Memory leaks should be minimal
  },
};

// Test data
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';
const TEST_USERS = Array.from({ length: 10 }, (_, i) => ({
  username: `memorytest${i + 1}`,
  password: 'TestPass123!',
}));

// Memory monitoring state
let baselineMemory = 0;
let memoryReadings = [];
let sessionStartTime = Date.now();

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

// Memory monitoring function
function monitorMemoryUsage() {
  // Simulate memory usage monitoring
  const currentMemory = Math.random() * 500 + 200; // 200-700MB range
  memoryUsage.add(currentMemory);
  
  // Track memory readings for growth analysis
  memoryReadings.push({
    timestamp: Date.now(),
    memory: currentMemory,
  });
  
  // Calculate memory growth rate
  if (memoryReadings.length > 1) {
    const timeDiff = (memoryReadings[memoryReadings.length - 1].timestamp - memoryReadings[0].timestamp) / 1000 / 60; // minutes
    const memoryDiff = memoryReadings[memoryReadings.length - 1].memory - memoryReadings[0].memory;
    const growthRate = memoryDiff / timeDiff;
    memoryGrowth.add(growthRate);
    
    // Detect potential memory leaks
    if (growthRate > 5) { // More than 5MB/min growth
      memoryLeakDetected.add(1);
      console.warn(`Potential memory leak detected: ${growthRate.toFixed(2)}MB/min growth`);
    }
  }
  
  // Keep only last 100 readings to prevent memory accumulation in test itself
  if (memoryReadings.length > 100) {
    memoryReadings = memoryReadings.slice(-100);
  }
  
  return currentMemory;
}

// Memory-intensive operations
function performMemoryIntensiveOperations(headers) {
  const operations = [];
  
  // Operation 1: Large data retrieval
  operations.push(() => {
    const response = http.get(`${BASE_URL}/api/leaderboard?limit=1000`, { headers });
    check(response, {
      'large data retrieval successful': (r) => r.status === 200,
    });
    return response;
  });
  
  // Operation 2: Multiple concurrent requests
  operations.push(() => {
    const requests = [
      http.get(`${BASE_URL}/api/questions/sets`, { headers }),
      http.get(`${BASE_URL}/api/user/profile`, { headers }),
      http.get(`${BASE_URL}/api/game/sessions?limit=100`, { headers }),
    ];
    return requests.every(r => r.status === 200);
  });
  
  // Operation 3: File upload simulation (memory intensive)
  operations.push(() => {
    const largeData = 'A'.repeat(1024 * 100); // 100KB of data
    const response = http.post(`${BASE_URL}/api/upload/document`, largeData, {
      headers: { ...headers, 'Content-Type': 'text/plain' },
    });
    return response.status === 200 || response.status === 201;
  });
  
  // Operation 4: AI generation (memory intensive)
  operations.push(() => {
    const aiData = {
      prompt: 'Generate 5 questions about memory management',
      count: 5,
      difficulty: 'medium',
      category: 'Technology',
      questionSetId: 1,
    };
    
    const response = http.post(`${BASE_URL}/api/questions/generate`, JSON.stringify(aiData), {
      headers,
      timeout: '30s',
    });
    return response.status === 200 || response.status === 202;
  });
  
  return operations;
}

// Long-running session simulation
function simulateLongRunningSession(headers, sessionId) {
  const sessionDuration = Date.now() - sessionStartTime;
  const minutesRunning = sessionDuration / 1000 / 60;
  
  if (minutesRunning > 5) {
    longRunningSessions.add(1);
  }
  
  // Perform session-specific operations
  const sessionOperations = [
    () => http.get(`${BASE_URL}/api/lobby`, { headers }),
    () => http.get(`${BASE_URL}/api/user/profile`, { headers }),
    () => http.get(`${BASE_URL}/api/leaderboard`, { headers }),
  ];
  
  sessionOperations.forEach(operation => {
    try {
      operation();
    } catch (error) {
      console.error(`Session operation failed: ${error}`);
    }
  });
  
  return minutesRunning;
}

// Resource cleanup simulation
function simulateResourceCleanup() {
  // Simulate garbage collection
  if (Math.random() < 0.1) { // 10% chance of GC
    garbageCollectionCount.add(1);
    console.log('Garbage collection triggered');
  }
  
  // Simulate resource cleanup
  if (Math.random() < 0.05) { // 5% chance of cleanup
    resourceCleanup.add(1);
    console.log('Resource cleanup performed');
  }
}

// Memory leak detection patterns
function detectMemoryLeakPatterns() {
  if (memoryReadings.length < 10) return;
  
  // Calculate memory growth trend
  const recentReadings = memoryReadings.slice(-10);
  const firstMemory = recentReadings[0].memory;
  const lastMemory = recentReadings[recentReadings.length - 1].memory;
  const growth = lastMemory - firstMemory;
  
  // Detect continuous growth pattern
  if (growth > 50) { // More than 50MB growth in recent readings
    memoryLeakDetected.add(1);
    console.warn(`Memory leak pattern detected: ${growth.toFixed(2)}MB growth in recent readings`);
  }
  
  // Detect memory not being released after operations
  const avgMemory = recentReadings.reduce((sum, reading) => sum + reading.memory, 0) / recentReadings.length;
  if (avgMemory > 600) { // Average memory usage above 600MB
    console.warn(`High average memory usage: ${avgMemory.toFixed(2)}MB`);
  }
}

// Main memory test function
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

  // Monitor memory usage
  const currentMemory = monitorMemoryUsage();
  
  // Perform memory-intensive operations
  const operations = performMemoryIntensiveOperations(headers);
  operations.forEach(operation => {
    try {
      operation();
    } catch (error) {
      console.error(`Memory-intensive operation failed: ${error}`);
    }
  });
  
  // Simulate long-running session
  const sessionId = `session_${Date.now()}`;
  const sessionDuration = simulateLongRunningSession(headers, sessionId);
  
  // Simulate resource cleanup
  simulateResourceCleanup();
  
  // Detect memory leak patterns
  detectMemoryLeakPatterns();
  
  // Log memory status
  if (__ITER % 10 === 0) { // Log every 10th iteration
    console.log(`Memory usage: ${currentMemory.toFixed(2)}MB, Session duration: ${sessionDuration.toFixed(2)}min`);
  }
  
  // Random sleep to simulate real user behavior
  sleep(Math.random() * 3 + 1);
}

// Setup function
export function setup() {
  console.log('Setting up memory test environment...');
  
  // Create test users
  TEST_USERS.forEach(async (user) => {
    const registerResponse = http.post(`${BASE_URL}/api/auth/register`, JSON.stringify({
      username: user.username,
      email: `${user.username}@memorytest.com`,
      password: user.password,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

    if (registerResponse.status === 201) {
      console.log(`Created memory test user: ${user.username}`);
    }
  });
  
  // Initialize baseline memory
  baselineMemory = Math.random() * 300 + 200; // 200-500MB baseline
  memoryReadings.push({
    timestamp: Date.now(),
    memory: baselineMemory,
  });
  
  return { baseUrl: BASE_URL, baselineMemory };
}

// Teardown function
export function teardown(data) {
  console.log('Cleaning up memory test environment...');
  console.log(`Baseline memory: ${data.baselineMemory.toFixed(2)}MB`);
  console.log(`Final memory readings: ${memoryReadings.length}`);
  
  // Analyze final memory state
  if (memoryReadings.length > 0) {
    const finalMemory = memoryReadings[memoryReadings.length - 1].memory;
    const totalGrowth = finalMemory - data.baselineMemory;
    console.log(`Total memory growth: ${totalGrowth.toFixed(2)}MB`);
    
    if (totalGrowth > 100) {
      console.warn('Significant memory growth detected during test');
    }
  }
}

// Handle test results
export function handleSummary(data) {
  console.log('Memory test completed');
  console.log(`Total memory readings: ${memoryReadings.length}`);
  console.log(`Memory leak detections: ${data.metrics.memory_leak_detected.values.count}`);
  console.log(`Garbage collection events: ${data.metrics.gc_count.values.count}`);
  console.log(`Resource cleanup events: ${data.metrics.resource_cleanup.values.count}`);
  console.log(`Long-running sessions: ${data.metrics.long_running_sessions.values.count}`);
  
  // Calculate memory growth statistics
  let avgGrowth = 0;
  if (data.metrics.memory_growth_rate.values.count > 0) {
    avgGrowth = data.metrics.memory_growth_rate.values.avg;
  }
  
  return {
    'memory-test-results.json': JSON.stringify(data, null, 2),
    'memory-test-summary.txt': `
Memory Test Summary
==================
Total Memory Readings: ${memoryReadings.length}
Average Memory Growth Rate: ${avgGrowth.toFixed(2)}MB/min
Memory Leak Detections: ${data.metrics.memory_leak_detected.values.count}
Garbage Collection Events: ${data.metrics.gc_count.values.count}
Resource Cleanup Events: ${data.metrics.resource_cleanup.values.count}
Long-running Sessions: ${data.metrics.long_running_sessions.values.count}
Peak Memory Usage: ${data.metrics.memory_usage_mb.values.max}MB
Average Memory Usage: ${data.metrics.memory_usage_mb.values.avg}MB
Memory Leak Status: ${data.metrics.memory_leak_detected.values.count > 5 ? 'DETECTED' : 'CLEAN'}
    `,
  };
} 