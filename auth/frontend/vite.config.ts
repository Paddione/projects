import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// Determine the correct path for shared-design-system
// In Docker: /app/frontend -> /app/shared-design-system (up 1 level)
// In local: /projects/auth/frontend -> /projects/shared-design-system (up 2 levels)
const dockerPath = path.resolve(__dirname, '../shared-design-system');
const localPath = path.resolve(__dirname, '../../shared-design-system');
const sharedDesignSystemPath = fs.existsSync(dockerPath) ? dockerPath : localPath;

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
