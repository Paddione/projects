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

async function testAuthValid() {
  console.log('🔐 Testing Valid Auth Registration...\n');

  const baseOptions = {
    hostname: 'localhost',
    port: 3001,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  try {
    // Test: Valid registration
    console.log('Testing Valid Registration...');
    const testUser = {
      username: 'validuser' + Date.now(),
      email: 'valid' + Date.now() + '@example.com',
      password: 'ValidPassword123!'
    };

    console.log('Sending registration request with data:', testUser);
    
    const registerResponse = await makeRequest({
      ...baseOptions,
      path: '/api/auth/register',
      method: 'POST'
    }, testUser);

    console.log('Registration response status:', registerResponse.status);
    console.log('Registration response data:', registerResponse.data);

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.error('Error details:', error);
  }
}

// Run the test
testAuthValid().catch(console.error);