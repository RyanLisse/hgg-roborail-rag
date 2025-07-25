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
  /* Maximum test attempts */
  maxFailures: process.env.CI ? 10 : 5, // Stop after X failures
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

    /* Optimized timeouts for stability */
    actionTimeout: 30_000, // 30s for most actions
    navigationTimeout: 45_000, // 45s for navigation
    
    /* Improved waiting strategies */
    waitForLoadState: 'networkidle',
    waitForNavigation: { waitUntil: 'networkidle' },
    waitForSelector: { strict: false }
  },

  /* Balanced timeouts for reliability */
  timeout: 120 * 1000, // 2 minutes per test
  expect: {
    timeout: 20 * 1000, // 20s for assertions
    toHaveScreenshot: { maxDiffPixels: 100 },
    toMatchSnapshot: { maxDiffPixelRatio: 0.1 },
  },

  /* Global setup and teardown for proper test environment */
  globalSetup: './tests/playwright-setup.ts',
  globalTeardown: './tests/playwright-teardown.ts',

  /* Configure projects with optimized settings */
  projects: [
    {
      name: 'e2e',
      testMatch: /e2e\/(?!stagehand).*.test.ts/, // Exclude stagehand tests
      use: {
        ...devices['Desktop Chrome'],
        // Optimized browser flags for stability
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-background-networking',
            '--disable-background-timer-throttling',
            '--disable-renderer-backgrounding',
            '--disable-backgrounding-occluded-windows',
            '--disable-dev-shm-usage',
            '--disable-setuid-sandbox',
            '--no-sandbox',
            '--disable-gpu',
            '--disable-blink-features=AutomationControlled',
          ],
          ignoreDefaultArgs: ['--enable-automation'],
        },
        // Viewport for consistency
        viewport: { width: 1280, height: 720 },
        // Permissions
        permissions: ['clipboard-read', 'clipboard-write'],
      },
    },
    {
      name: 'stagehand',
      testMatch: /e2e\/stagehand.*.test.ts/, // Only stagehand tests
      use: {
        ...devices['Desktop Chrome'],
        // Stagehand-specific optimizations
        headless: false, // Required for Stagehand
        actionTimeout: 60_000, // 60s for Stagehand actions
        navigationTimeout: 60_000, // 60s for Stagehand navigation
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-dev-shm-usage',
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-gpu',
            '--disable-blink-features=AutomationControlled',
            '--window-size=1280,720',
          ],
          ignoreDefaultArgs: ['--enable-automation'],
          slowMo: 100, // Slow down Stagehand for reliability
        },
        // Stagehand viewport
        viewport: { width: 1280, height: 720 },
        // Extra timeout for Stagehand
        timeout: 150_000,
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
    timeout: 90 * 1000, // 90s for server startup
    reuseExistingServer: !process.env.CI,
    env: {
      NODE_ENV: 'test',
      PLAYWRIGHT: 'true',
      // Optimize Next.js startup
      NEXT_TELEMETRY_DISABLED: '1',
      TURBO_CI: '1',
      // Additional optimizations
      SKIP_ENV_VALIDATION: 'true',
      NEXT_SHARP_PATH: '',
    },
    stdout: 'pipe',
    stderr: 'pipe',
    // Server startup options
    ignoreHTTPSErrors: true,
  },
});
