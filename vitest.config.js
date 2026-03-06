import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['tests/**/*.test.js'],
        forceExit: true,
        fileParallelism: false,
        coverage: {
            provider: 'v8',
            include: ['src/**/*.js'],
            exclude: [],
            reporter: ['text', 'html'],
            thresholds: {
                lines: 70,
                functions: 70,
            },
        },
    },
});
