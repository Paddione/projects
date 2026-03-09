import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    plugins: [react()],
    server: {
        port: 3002,
        middlewareMode: false,
        // Add CSP headers for E2E asset validation testing
        headers: {
            'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; worker-src 'self' blob:; img-src 'self' blob: data:; connect-src 'self' data: ws: wss:; base-uri 'self';",
        },
        proxy: {
            '/api': {
                target: 'http://localhost:3003',
                changeOrigin: true,
            },
            '/socket.io': {
                target: 'http://localhost:3003',
                ws: true,
            },
        },
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
    },
});
