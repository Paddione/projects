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

async function testAuthMinimal() {
  console.log('🔐 Testing Minimal Auth...\n');

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

    // Test 2: Try to access auth validate endpoint (should fail without token)
    console.log('2. Testing Auth Validate (should fail)...');
    const validateResponse = await makeRequest({
      ...baseOptions,
      path: '/api/auth/validate',
      method: 'GET'
    });

    console.log('Auth validate response status:', validateResponse.status);
    console.log('Auth validate response data:', validateResponse.data);
    console.log();

    // Test 3: Try registration with invalid data (should return validation error)
    console.log('3. Testing Registration with Invalid Data...');
    const invalidRegResponse = await makeRequest({
      ...baseOptions,
      path: '/api/auth/register',
      method: 'POST'
    }, {
      username: 'a', // Too short
      email: 'invalid-email',
      password: '123' // Too short
    });

    console.log('Invalid registration response status:', invalidRegResponse.status);
    console.log('Invalid registration response data:', invalidRegResponse.data);

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Run the test
testAuthMinimal().catch(console.error);