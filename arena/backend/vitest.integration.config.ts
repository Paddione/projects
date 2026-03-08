import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.integration.test.ts'],
        // Integration tests can take longer — generous timeout
        testTimeout: 15000,
        hookTimeout: 15000,
        // Run integration tests sequentially to avoid shared-server port conflicts
        sequence: {
            concurrent: false,
        },
        reporter: 'verbose',
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
});
