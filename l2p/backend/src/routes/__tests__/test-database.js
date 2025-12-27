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

async function testDatabase() {
  console.log('🗄️ Testing Database API...\n');

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

    // Test 2: Database Test
    console.log('2. Testing Database Connection...');
    const dbResponse = await makeRequest({
      ...baseOptions,
      path: '/api/database/test',
      method: 'GET'
    });

    console.log('Database test response status:', dbResponse.status);
    console.log('Database test response data:', dbResponse.data);

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Run the test
testDatabase().catch(console.error);