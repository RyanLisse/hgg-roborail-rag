import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    exclude: [
      '**/e2e/**',
      '**/routes/**',
      '**/mcp/**',
      '**/node_modules/**',
      '**/dist/**',
    ],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
});
