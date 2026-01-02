#!/usr/bin/env node

/**
 * Test script for Stripe webhook endpoint
 * This simulates a Stripe webhook call to verify the endpoint is working
 */

const crypto = require('crypto');
const https = require('https');
const http = require('http');
require('dotenv').config({ path: '.env-prod' });

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
const WEBHOOK_URL = 'http://localhost:3004/api/stripe/webhook';

// Sample checkout.session.completed event
const event = {
    id: 'evt_test_webhook',
    object: 'event',
    api_version: '2024-11-20.acacia',
    created: Math.floor(Date.now() / 1000),
    data: {
        object: {
            id: 'cs_test_123',
            object: 'checkout.session',
            amount_total: 1000,
            currency: 'usd',
            customer: 'cus_test_123',
            metadata: {
                userId: 'test-user-123',
                amountCoins: '10'
            },
            payment_status: 'paid',
            status: 'complete'
        }
    },
    livemode: false,
    pending_webhooks: 1,
    request: {
        id: null,
        idempotency_key: null
    },
    type: 'checkout.session.completed'
};

const payload = JSON.stringify(event);
const timestamp = Math.floor(Date.now() / 1000);

// Generate Stripe signature
function generateStripeSignature(payload, secret) {
    const signedPayload = `${timestamp}.${payload}`;
    const signature = crypto
        .createHmac('sha256', secret)
        .update(signedPayload)
        .digest('hex');

    return `t=${timestamp},v1=${signature}`;
}

const signature = generateStripeSignature(payload, WEBHOOK_SECRET);

console.log('🧪 Testing Stripe Webhook Endpoint');
console.log('==================================');
console.log('URL:', WEBHOOK_URL);
console.log('Event Type:', event.type);
console.log('User ID:', event.data.object.metadata.userId);
console.log('Amount Coins:', event.data.object.metadata.amountCoins);
console.log('');

const url = new URL(WEBHOOK_URL);
const options = {
    hostname: url.hostname,
    port: url.port || (url.protocol === 'https:' ? 443 : 80),
    path: url.pathname,
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'Stripe-Signature': signature
    }
};

const client = url.protocol === 'https:' ? https : http;

const req = client.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        console.log('📊 Response Status:', res.statusCode);
        console.log('📊 Response Headers:', JSON.stringify(res.headers, null, 2));

        if (data) {
            console.log('📊 Response Body:', data);
        }

        if (res.statusCode === 200) {
            console.log('');
            console.log('✅ Webhook test PASSED!');
            console.log('   The webhook endpoint is working correctly.');
        } else {
            console.log('');
            console.log('❌ Webhook test FAILED!');
            console.log('   Expected status 200, got', res.statusCode);
        }
    });
});

req.on('error', (error) => {
    console.error('');
    console.error('❌ Request Error:', error.message);
    console.error('   Make sure the payment service is running on port 3004');
});

req.write(payload);
req.end();
