import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    root: path.resolve(__dirname, 'server'),
    test: {
        environment: 'node',
        globals: true,
    },
});
