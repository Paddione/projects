#!/usr/bin/env node

import http from 'http';

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data: body, headers: res.headers });
        }
      });
    });

    req.on('error', reject);
    
    if (data) {
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}

async function testHallOfFame() {
  console.log('🏆 Testing Hall of Fame API...\n');

  const baseOptions = {
    hostname: 'localhost',
    port: 3001,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  try {
    // Test 1: Health Check
    console.log('1. Testing Health Check...');
    const healthResponse = await makeRequest({
      ...baseOptions,
      path: '/api/health',
      method: 'GET'
    });
    console.log('✅ Health check:', healthResponse.status, healthResponse.data.status);
    console.log();

    // Test 2: Hall of Fame
    console.log('2. Testing Hall of Fame...');
    const hofResponse = await makeRequest({
      ...baseOptions,
      path: '/api/hall-of-fame/1',
      method: 'GET'
    });

    console.log('Hall of Fame response status:', hofResponse.status);
    console.log('Hall of Fame response data:', hofResponse.data);

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Run the test
testHallOfFame().catch(console.error);