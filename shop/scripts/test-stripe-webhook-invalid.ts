

import 'dotenv/config'

async function testInvalidSignature() {
    console.log('Testing Stripe Webhook with Invalid Signature...')

    // Valid payload structure to ensure it's not parsing error
    const payload = JSON.stringify({
        id: 'evt_test_webhook',
        object: 'event',
    })

    try {
        const res = await fetch('http://localhost:3004/api/stripe/webhook', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Stripe-Signature': 't=123,v1=invalid_signature',
            },
            body: payload,
        })

        if (res.status === 400) {
            console.log('Success: Rejected invalid signature with 400')
            const text = await res.text()
            console.log('Response:', text)
        } else {
            console.error('Failure: Expected 400 but got', res.status)
        }
    } catch (error) {
        console.error('Error during invalid webhook test:', error)
    }
}

testInvalidSignature()
