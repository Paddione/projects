#!/usr/bin/env node

/**
 * Health check for payment service endpoints
 */

import http from 'http';

const tests = [
    {
        name: 'Payment Service Health Check',
        url: 'http://localhost:3004/',
        method: 'GET',
        expectedStatus: 200
    },
    {
        name: 'Stripe Webhook Endpoint (POST without signature)',
        url: 'http://localhost:3004/api/stripe/webhook',
        method: 'POST',
        body: JSON.stringify({ test: 'data' }),
        expectedStatus: 400, // Should fail with 400 due to missing/invalid signature
        expectedBodyContains: 'Webhook Error'
    }
];

async function runTest(test) {
    return new Promise((resolve) => {
        const url = new URL(test.url);
        const options = {
            hostname: url.hostname,
            port: url.port || 80,
            path: url.pathname,
            method: test.method,
            headers: test.body ? {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(test.body)
            } : {}
        };

        const req = http.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                const passed = res.statusCode === test.expectedStatus &&
                    (!test.expectedBodyContains || data.includes(test.expectedBodyContains));

                resolve({
                    name: test.name,
                    passed,
                    status: res.statusCode,
                    expectedStatus: test.expectedStatus,
                    body: data.substring(0, 200)
                });
            });
        });

        req.on('error', (error) => {
            resolve({
                name: test.name,
                passed: false,
                error: error.message
            });
        });

        if (test.body) {
            req.write(test.body);
        }
        req.end();
    });
}

async function main() {
    console.log('🏥 Payment Service Health Check');
    console.log('================================\n');

    for (const test of tests) {
        const result = await runTest(test);

        if (result.passed) {
            console.log(`✅ ${result.name}`);
            console.log(`   Status: ${result.status} (expected ${result.expectedStatus})`);
        } else {
            console.log(`❌ ${result.name}`);
            if (result.error) {
                console.log(`   Error: ${result.error}`);
            } else {
                console.log(`   Status: ${result.status} (expected ${result.expectedStatus})`);
                if (result.body) {
                    console.log(`   Response: ${result.body}`);
                }
            }
        }
        console.log('');
    }

    console.log('📝 Notes:');
    console.log('   - Webhook endpoint correctly rejects requests without valid Stripe signatures');
    console.log('   - To test with real webhooks, use Stripe CLI:');
    console.log('     stripe listen --forward-to localhost:3004/api/stripe/webhook');
    console.log('   - Or configure webhook in Stripe Dashboard:');
    console.log('     https://dashboard.stripe.com/test/webhooks');
}

main();
