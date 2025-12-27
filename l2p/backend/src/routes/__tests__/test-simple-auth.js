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

async function testSimpleAuth() {
  console.log('🔐 Testing Simple Authentication...\n');

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

    // Test 2: Simple registration with minimal data
    console.log('2. Testing Simple Registration...');
    const testUser = {
      username: 'test' + Date.now(),
      email: 'test' + Date.now() + '@example.com',
      password: 'TestPassword123!'
    };

    console.log('Sending registration request...');
    const registerResponse = await makeRequest({
      ...baseOptions,
      path: '/api/auth/register',
      method: 'POST'
    }, testUser);

    console.log('Registration response status:', registerResponse.status);
    console.log('Registration response data:', registerResponse.data);

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Run the test
testSimpleAuth().catch(console.error);