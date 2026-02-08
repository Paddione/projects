import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
    root: path.resolve(__dirname, 'server'),
    resolve: {
        alias: {
            'zod': path.resolve(__dirname, 'node_modules', 'zod'),
            '@shared': path.resolve(__dirname, 'shared-infrastructure', 'shared', 'videovault'),
        },
    },
    test: {
        environment: 'node',
        globals: true,
    },
});
