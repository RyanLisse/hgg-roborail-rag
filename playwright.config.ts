import { defineConfig, devices } from '@playwright/test';

/**
 * Set NODE_ENV and read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import { config } from 'dotenv';

// Set test environment
if (!process.env.NODE_ENV) {
  Object.assign(process.env, { NODE_ENV: 'test' });
}
process.env.PLAYWRIGHT = 'true';

config({
  path: '.env.test',
});

/* Use process.env.PORT by default and fallback to port 3000 */
const PORT = process.env.PORT || 3000;

/**
 * Set webServer.url and use.baseURL with the location
 * of the WebServer respecting the correct set port
 */
const baseURL = `http://localhost:${PORT}`;

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  /* Optimize parallel execution */
  fullyParallel: false, // Keep disabled to avoid DB conflicts
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry configuration with exponential backoff */
  retries: process.env.CI ? 2 : 1, // More retries in CI
  /* Optimize workers for stability */
  workers: process.env.CI ? 1 : 2, // Single worker in CI, allow 2 locally
  /* Optimized reporter configuration */
  reporter: [
    ['html'],
    ['list'], // Better CI output
    ...(process.env.CI ? [['github'] as any] : []),
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL,

    /* Optimized trace collection */
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    /* Browser optimizations */
    headless: !!process.env.CI,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,

    /* Optimized timeouts with shorter defaults */
    actionTimeout: 45_000, // Reduced from 60s to 45s
    navigationTimeout: 30_000, // Reduced from 60s to 30s
  },

  /* Reduced global timeout with better error handling */
  timeout: 90 * 1000, // Reduced from 2 minutes to 90 seconds
  expect: {
    timeout: 15 * 1000, // Reduced from 30s to 15s for faster failures
  },

  /* Global setup and teardown - temporarily disabled */
  // globalSetup: './tests/playwright-setup.ts',
  // globalTeardown: './tests/playwright-teardown.ts',

  /* Configure projects with optimized settings */
  projects: [
    {
      name: 'e2e',
      testMatch: /e2e\/(?!stagehand).*.test.ts/, // Exclude stagehand tests
      use: {
        ...devices['Desktop Chrome'],
        // Faster page loads
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-background-networking',
            '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding',
            '--disable-backgrounding-occluded-windows',
          ],
        },
      },
    },
    {
      name: 'stagehand',
      testMatch: /e2e\/stagehand.*.test.ts/, // Only stagehand tests
      use: {
        ...devices['Desktop Chrome'],
        // Stagehand-specific optimizations
        headless: false, // Required for Stagehand
        actionTimeout: 75_000, // Reduced from 90s to 75s
        navigationTimeout: 45_000, // Reduced from 90s to 45s
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-dev-shm-usage',
            '--no-sandbox', // Required for some CI environments
          ],
        },
      },
    },
    {
      name: 'routes',
      testMatch: /routes\/.*.test.ts/,
      use: {
        ...devices['Desktop Chrome'],
        // Fast settings for route tests
        actionTimeout: 10_000,
        navigationTimeout: 15_000,
      },
    },

    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },

    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: { ...devices['Pixel 5'] },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: { ...devices['iPhone 12'] },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: { ...devices['Desktop Edge'], channel: 'msedge' },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'pnpm dev',
    url: `${baseURL}/ping`,
    timeout: 60 * 1000, // Reduced from 120s to 60s
    reuseExistingServer: !process.env.CI,
    env: {
      NODE_ENV: 'test',
      PLAYWRIGHT: 'true',
      // Optimize Next.js startup
      NEXT_TELEMETRY_DISABLED: '1',
      TURBO_CI: '1',
    },
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
