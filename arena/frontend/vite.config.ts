import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            // Ensure shared-3d's three.js imports resolve to arena's node_modules
            'three': path.resolve(__dirname, 'node_modules/three'),
        },
    },
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
            '/assets/3d': {
                target: 'http://localhost:5200',
                rewrite: (path) => {
                    const match = path.match(/\/assets\/3d\/\w+\/(\w+)\.glb/);
                    return match ? `/api/visual-library/${match[1]}/model` : path;
                },
            },
            '/assets/concepts': {
                target: 'http://localhost:5200',
                rewrite: (path) => {
                    const match = path.match(/\/assets\/concepts\/\w+\/(\w+)\.png/);
                    return match ? `/api/visual-library/${match[1]}/concept` : path;
                },
            },
        },
    },
    build: {
        outDir: 'dist',
        sourcemap: true,
    },
});
