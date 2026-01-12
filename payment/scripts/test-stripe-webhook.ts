
import Stripe from 'stripe'
import 'dotenv/config'


// Mock env vars if not present, but better to read from .env if possible or just hardcode for the test if we know what the server uses.
// The server uses process.env.STRIPE_WEBHOOK_SECRET. 
// We need to match what the server expects. 
// If the server has a real secret, we need that. If strictly local with "whsec_placeholder", we use that.
// I'll assume we can read .env or use the placeholder if it's what's in .env (which I saw earlier).

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_placeholder'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_mock', {
    apiVersion: '2024-11-20.acacia',
    typescript: true,
})

async function testWebhook() {
    console.log('Testing Stripe Webhook API...')

    const payload = {
        id: 'evt_test_webhook',
        object: 'event',
        type: 'checkout.session.completed',
        created: Math.floor(Date.now() / 1000),
        data: {
            object: {
                id: 'cs_test_session',
                object: 'checkout.session',
                metadata: {
                    userId: 'cmivf1t150002y9f1sokuvndn', // Real user ID from seed
                    amountCoins: '100',
                },
                payment_status: 'paid',
                currency: 'usd',
                amount_total: 100,
            }
        }
    }

    const payloadString = JSON.stringify(payload, null, 2)

    // Generate signature
    const header = stripe.webhooks.generateTestHeaderString({
        payload: payloadString,
        secret: WEBHOOK_SECRET,
    })


    try {
        const res = await fetch('http://localhost:3004/api/stripe/webhook', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Stripe-Signature': header,
            },
            body: payloadString,
        })

        if (!res.ok) {
            console.error('Webhook failed:', res.status, res.statusText)
            const text = await res.text()
            console.error('Response:', text)
            return
        }

        console.log('Webhook processed successfully:', res.status)
    } catch (error) {
        console.error('Error during webhook test:', error)
    }
}

testWebhook()
