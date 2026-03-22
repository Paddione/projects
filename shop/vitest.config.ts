import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
    plugins: [react()],
    test: {
        environment: 'jsdom',
        setupFiles: ['./test/setup-env.ts'],
        alias: {
            '@': path.resolve(__dirname, './')
        },
        include: ['**/*.test.{ts,tsx}'],
        coverage: {
            provider: 'v8',
            include: ['lib/**/*.ts', 'app/api/**/*.ts'],
            exclude: ['**/*.test.{ts,tsx}', 'test/**'],
            thresholds: {
                'lib/actions/auth.ts': { lines: 85, functions: 85, branches: 80, statements: 85 },
                'lib/ledger.ts': { lines: 90, functions: 90, branches: 85, statements: 90 },
                'lib/booking.ts': { lines: 85, functions: 85, branches: 80, statements: 85 },
                'lib/actions/order.ts': { lines: 80, functions: 80, branches: 75, statements: 80 },
                'lib/actions/product.ts': { lines: 85, functions: 85, branches: 80, statements: 85 },
            },
        },
    },
})
