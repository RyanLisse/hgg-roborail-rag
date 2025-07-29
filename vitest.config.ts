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
      '**/.next/**',
      '**/coverage/**',
      '**/railway-migration/**', // Exclude duplicate tests from railway-migration worktree
      'drizzle.config.test.ts', // Exclude config file without tests
    ],
    // Enhanced timeout configuration using centralized config
    testTimeout: 30_000, // 30 seconds for comprehensive tests including performance benchmarks
    hookTimeout: 10_000,  // 10 seconds for setup/teardown hooks
    // Bail out early on failures in CI
    bail: process.env.CI ? 3 : 0,
    // Enable TypeScript support
    typecheck: {
      enabled: true,
      tsconfig: './tsconfig.test.json',
    },
    // Enhanced reporter configuration
    reporters: process.env.CI 
      ? ['github-actions', 'json'] 
      : ['verbose', 'json'],
    // Output configuration
    outputFile: {
      json: './coverage/test-results.json',
    },
    // Enhanced pool configuration for better test isolation
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        minThreads: 1,
        maxThreads: process.env.CI ? 2 : 4, // Reduce threads in CI
        isolate: true, // Better isolation for mocks
      },
    },
    // Test sequencing
    sequence: {
      shuffle: true, // Randomize test order to catch interdependencies
      seed: 42,      // Consistent seed for reproducible shuffling
    },
    // Enhanced coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        '**/node_modules/**',
        '**/tests/**',
        '**/e2e/**',
        '**/railway-migration/**',
        '**/*.d.ts',
        '**/coverage/**',
        '**/dist/**',
        '**/.next/**',
        '**/vitest.config.ts',
        '**/playwright.config.ts',
        '**/next.config.ts',
        '**/tailwind.config.ts',
        '**/drizzle.config.ts',
      ],
      // Coverage thresholds
      thresholds: {
        global: {
          branches: 70,
          functions: 70,
          lines: 70,
          statements: 70,
        },
      },
      // Include only source files
      include: [
        'app/**/*.{ts,tsx}',
        'components/**/*.{ts,tsx}',
        'lib/**/*.{ts,tsx}',
      ],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
      '@/components': resolve(__dirname, './components'),
      '@/lib': resolve(__dirname, './lib'),
      '@/types': resolve(__dirname, './types'),
      '@/tests': resolve(__dirname, './tests'),
      // Add convenient alias for test utilities
      '@/test-utils': resolve(__dirname, './tests/utils'),
    },
    // Ensure proper module resolution for ES modules
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.json'],
  },
  // Enhanced environment configuration
  define: {
    'process.env.NODE_ENV': '"test"',
    // Define test-specific globals
    '__TEST__': 'true',
    '__DEV__': 'false',
  },
  // Optimize dependencies for faster test startup
  optimizeDeps: {
    include: [
      'vitest',
      '@testing-library/jest-dom',
      '@testing-library/react',
    ],
  },
});
