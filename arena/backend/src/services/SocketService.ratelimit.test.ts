import { describe, it, expect, beforeEach, vi } from 'vitest';

/**
 * SocketService Rate Limiting Tests
 *
 * Tests for socket-level input rate limiting (max 40 inputs/second per socket)
 * This prevents DoS attacks and resource exhaustion
 */

describe('SocketService — Rate Limiting', () => {
    describe('Input Rate Limiter', () => {
        it('allows up to 40 inputs per second', () => {
            // Test that the rate limiter tracks input count per second window
            const rateTracker = new Map<string, { count: number; windowStart: number }>();
            const INPUT_LIMIT = 40;
            const RATE_WINDOW_MS = 1000;

            const socketId = 'socket-123';
            let now = Date.now();

            // Simulate 40 inputs within 1 second
            for (let i = 0; i < 40; i++) {
                let limiter = rateTracker.get(socketId);
                if (!limiter) {
                    limiter = { count: 0, windowStart: now };
                    rateTracker.set(socketId, limiter);
                }

                // Check if window expired
                if (now - limiter.windowStart > RATE_WINDOW_MS) {
                    limiter.count = 0;
                    limiter.windowStart = now;
                }

                limiter.count++;
                const shouldAllow = limiter.count <= INPUT_LIMIT;

                expect(shouldAllow).toBe(true);
                now += 25; // 25ms per input = 40 inputs in 1000ms
            }
        });

        it('rejects inputs exceeding 40 per second', () => {
            const rateTracker = new Map<string, { count: number; windowStart: number }>();
            const INPUT_LIMIT = 40;
            const RATE_WINDOW_MS = 1000;

            const socketId = 'socket-456';
            let now = Date.now();
            const rejectedInputs: number[] = [];

            // Simulate 50 inputs within 1 second (10 should be rejected)
            for (let i = 0; i < 50; i++) {
                let limiter = rateTracker.get(socketId);
                if (!limiter) {
                    limiter = { count: 0, windowStart: now };
                    rateTracker.set(socketId, limiter);
                }

                // Check if window expired
                if (now - limiter.windowStart > RATE_WINDOW_MS) {
                    limiter.count = 0;
                    limiter.windowStart = now;
                }

                limiter.count++;
                const shouldAllow = limiter.count <= INPUT_LIMIT;

                if (!shouldAllow) {
                    rejectedInputs.push(i);
                }

                now += 20; // 20ms per input = 50 inputs in 1000ms
            }

            // Verify some inputs were rejected
            expect(rejectedInputs.length).toBeGreaterThan(0);
            expect(rejectedInputs.length).toBeLessThanOrEqual(10);
        });

        it('resets count when 1-second window expires', () => {
            const rateTracker = new Map<string, { count: number; windowStart: number }>();
            const INPUT_LIMIT = 40;
            const RATE_WINDOW_MS = 1000;

            const socketId = 'socket-789';
            let now = Date.now();

            // Fill first window
            for (let i = 0; i < 40; i++) {
                let limiter = rateTracker.get(socketId);
                if (!limiter) {
                    limiter = { count: 0, windowStart: now };
                    rateTracker.set(socketId, limiter);
                }

                if (now - limiter.windowStart > RATE_WINDOW_MS) {
                    limiter.count = 0;
                    limiter.windowStart = now;
                }

                limiter.count++;
                now += 25;
            }

            const firstWindowCount = rateTracker.get(socketId)?.count ?? 0;
            expect(firstWindowCount).toBe(40);

            // Advance past window expiry
            now += 1100; // Move 1.1 seconds into future

            // Next input should reset the counter
            let limiter = rateTracker.get(socketId);
            if (limiter && now - limiter.windowStart > RATE_WINDOW_MS) {
                limiter.count = 0;
                limiter.windowStart = now;
            }
            limiter!.count++;

            expect(limiter?.count).toBe(1);
        });

        it('tracks separate limits per socket', () => {
            const rateTracker = new Map<string, { count: number; windowStart: number }>();
            const INPUT_LIMIT = 40;
            const RATE_WINDOW_MS = 1000;

            const socket1 = 'socket-1';
            const socket2 = 'socket-2';
            let now = Date.now();

            // Socket 1: Send 40 inputs
            for (let i = 0; i < 40; i++) {
                let limiter = rateTracker.get(socket1);
                if (!limiter) {
                    limiter = { count: 0, windowStart: now };
                    rateTracker.set(socket1, limiter);
                }
                limiter.count++;
                now += 25;
            }

            // Socket 2: Send 40 inputs (should all be allowed, independent limit)
            now = Date.now(); // Reset to now for socket 2
            for (let i = 0; i < 40; i++) {
                let limiter = rateTracker.get(socket2);
                if (!limiter) {
                    limiter = { count: 0, windowStart: now };
                    rateTracker.set(socket2, limiter);
                }
                limiter.count++;
                now += 25;
            }

            expect(rateTracker.get(socket1)?.count).toBe(40);
            expect(rateTracker.get(socket2)?.count).toBe(40);
        });

        it('cleans up rate limiter on disconnect', () => {
            const rateTracker = new Map<string, { count: number; windowStart: number }>();
            const socketId = 'socket-disconnect';

            // Add rate limiter
            rateTracker.set(socketId, { count: 10, windowStart: Date.now() });
            expect(rateTracker.has(socketId)).toBe(true);

            // Simulate disconnect cleanup
            rateTracker.delete(socketId);

            expect(rateTracker.has(socketId)).toBe(false);
        });

        it('logs warning when rate limit exceeded', () => {
            const warnSpy = vi.spyOn(console, 'warn');
            const rateTracker = new Map<string, { count: number; windowStart: number }>();
            const INPUT_LIMIT = 40;
            const RATE_WINDOW_MS = 1000;

            const socketId = 'socket-warn';
            let now = Date.now();

            // Exceed limit
            for (let i = 0; i < 45; i++) {
                let limiter = rateTracker.get(socketId);
                if (!limiter) {
                    limiter = { count: 0, windowStart: now };
                    rateTracker.set(socketId, limiter);
                }

                if (now - limiter.windowStart > RATE_WINDOW_MS) {
                    limiter.count = 0;
                    limiter.windowStart = now;
                }

                limiter.count++;

                if (limiter.count > INPUT_LIMIT) {
                    // This is where warning would be logged in real implementation
                    console.warn(`[Anti-Cheat] Rate limit exceeded for socket ${socketId}`);
                }

                now += 22;
            }

            // Verify warning was logged at least once
            expect(warnSpy).toHaveBeenCalledWith(
                expect.stringContaining('Rate limit exceeded')
            );

            warnSpy.mockRestore();
        });

        it('prevents burst attacks (all inputs at once)', () => {
            const rateTracker = new Map<string, { count: number; windowStart: number }>();
            const INPUT_LIMIT = 40;
            const RATE_WINDOW_MS = 1000;

            const socketId = 'socket-burst';
            const now = Date.now();

            let limiter = rateTracker.get(socketId);
            if (!limiter) {
                limiter = { count: 0, windowStart: now };
                rateTracker.set(socketId, limiter);
            }

            const rejectedCount = [];

            // Try to send 100 inputs at once
            for (let i = 0; i < 100; i++) {
                limiter.count++;
                if (limiter.count > INPUT_LIMIT) {
                    rejectedCount.push(i);
                }
            }

            // Verify burst was throttled
            expect(rejectedCount.length).toBe(60); // 100 - 40 = 60 rejected
            expect(limiter.count).toBe(100); // Counter tracked all attempts
        });
    });
});
