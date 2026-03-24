import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// Shared design system CSS is now inlined in styles/
const sharedDesignSystemPath = path.resolve(__dirname, 'styles');

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared-design-system': sharedDesignSystemPath,
    },
  },
  server: {
    port: 5501,
    proxy: {
      '/api': {
        target: 'http://localhost:5500',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: '../dist/public',
    emptyOutDir: true,
  },
});
