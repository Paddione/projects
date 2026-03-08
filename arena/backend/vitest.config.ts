import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'lcov', 'html'],
            include: ['src/services/**/*.ts'],
            exclude: ['src/services/SocketService.ts', 'src/services/DatabaseService.ts'],
            thresholds: {
                lines: 90,
                functions: 90,
                branches: 80,
                statements: 90,
            },
        },
        include: ['src/**/*.test.ts'],
    },
    resolve: {
        // Support .js extensions for ESM imports
        extensions: ['.ts', '.js'],
    },
});
