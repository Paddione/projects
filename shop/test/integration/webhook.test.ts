/**
 * Integration tests for the Stripe webhook endpoint.
 *
 * These tests verify that the webhook rejects unsigned or invalidly-signed
 * requests — the critical security boundary that prevents forged events.
 *
 * REQUIREMENTS:
 *   - The shop dev server must be running on port 3004 (or set SHOP_TEST_URL).
 *   - Start with: cd shop && npm run dev
 *   - If the server is not running, tests will fail with ECONNREFUSED.
 */
import { describe, it, expect } from 'vitest'

const SHOP_URL = process.env.SHOP_TEST_URL || 'http://localhost:3004'

describe('Stripe webhook endpoint', () => {
    it('rejects requests without Stripe signature', async () => {
        const res = await fetch(`${SHOP_URL}/api/stripe/webhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'checkout.session.completed' }),
        })

        expect(res.status).toBe(400)
        const text = await res.text()
        expect(text).toContain('Webhook Error')
    })

    it('rejects requests with invalid Stripe signature', async () => {
        const res = await fetch(`${SHOP_URL}/api/stripe/webhook`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Stripe-Signature': 't=1234567890,v1=invalid_signature_hash',
            },
            body: JSON.stringify({ type: 'checkout.session.completed' }),
        })

        expect(res.status).toBe(400)
        const text = await res.text()
        expect(text).toContain('Webhook Error')
    })

    it('rejects requests with empty body', async () => {
        const res = await fetch(`${SHOP_URL}/api/stripe/webhook`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Stripe-Signature': 't=1234567890,v1=abc123',
            },
            body: '',
        })

        expect(res.status).toBe(400)
        const text = await res.text()
        expect(text).toContain('Webhook Error')
    })

    it('rejects requests with malformed Stripe-Signature header', async () => {
        const res = await fetch(`${SHOP_URL}/api/stripe/webhook`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Stripe-Signature': 'not-a-valid-signature-format',
            },
            body: JSON.stringify({ type: 'checkout.session.completed' }),
        })

        expect(res.status).toBe(400)
        const text = await res.text()
        expect(text).toContain('Webhook Error')
    })
})
