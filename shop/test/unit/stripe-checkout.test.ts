import { describe, it, expect } from 'vitest'

/**
 * Validation logic extracted from app/api/stripe/checkout/route.ts (line 14):
 *
 *   if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 100 || amount > 10000)
 *
 * Returns true when the amount is valid (passes all checks).
 */
function isValidCheckoutAmount(amount: unknown): boolean {
    return (
        typeof amount === 'number' &&
        Number.isInteger(amount) &&
        amount >= 100 &&
        amount <= 10000
    )
}

describe('Stripe checkout amount validation', () => {
    describe('accepts valid amounts', () => {
        it('accepts minimum amount (100 GoldCoins = 1 EUR)', () => {
            expect(isValidCheckoutAmount(100)).toBe(true)
        })

        it('accepts maximum amount (10000 GoldCoins = 100 EUR)', () => {
            expect(isValidCheckoutAmount(10000)).toBe(true)
        })

        it('accepts a typical mid-range amount', () => {
            expect(isValidCheckoutAmount(500)).toBe(true)
        })

        it('accepts amount just above minimum', () => {
            expect(isValidCheckoutAmount(101)).toBe(true)
        })

        it('accepts amount just below maximum', () => {
            expect(isValidCheckoutAmount(9999)).toBe(true)
        })
    })

    describe('rejects amounts below minimum', () => {
        it('rejects 99 (one below minimum)', () => {
            expect(isValidCheckoutAmount(99)).toBe(false)
        })

        it('rejects 0', () => {
            expect(isValidCheckoutAmount(0)).toBe(false)
        })

        it('rejects negative amounts', () => {
            expect(isValidCheckoutAmount(-100)).toBe(false)
        })

        it('rejects 1', () => {
            expect(isValidCheckoutAmount(1)).toBe(false)
        })
    })

    describe('rejects amounts above maximum', () => {
        it('rejects 10001 (one above maximum)', () => {
            expect(isValidCheckoutAmount(10001)).toBe(false)
        })

        it('rejects very large amounts', () => {
            expect(isValidCheckoutAmount(1_000_000)).toBe(false)
        })
    })

    describe('rejects non-integer amounts', () => {
        it('rejects floating point numbers', () => {
            expect(isValidCheckoutAmount(100.5)).toBe(false)
        })

        it('rejects small decimals', () => {
            expect(isValidCheckoutAmount(500.01)).toBe(false)
        })

        it('rejects Infinity', () => {
            expect(isValidCheckoutAmount(Infinity)).toBe(false)
        })

        it('rejects negative Infinity', () => {
            expect(isValidCheckoutAmount(-Infinity)).toBe(false)
        })

        it('rejects NaN', () => {
            expect(isValidCheckoutAmount(NaN)).toBe(false)
        })
    })

    describe('rejects non-number types', () => {
        it('rejects string representations of valid numbers', () => {
            expect(isValidCheckoutAmount('500')).toBe(false)
        })

        it('rejects null', () => {
            expect(isValidCheckoutAmount(null)).toBe(false)
        })

        it('rejects undefined', () => {
            expect(isValidCheckoutAmount(undefined)).toBe(false)
        })

        it('rejects boolean', () => {
            expect(isValidCheckoutAmount(true)).toBe(false)
        })

        it('rejects objects', () => {
            expect(isValidCheckoutAmount({ amount: 500 })).toBe(false)
        })

        it('rejects arrays', () => {
            expect(isValidCheckoutAmount([500])).toBe(false)
        })
    })
})
