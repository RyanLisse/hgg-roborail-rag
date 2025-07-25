/**
 * Test configuration for improved stability
 */

export const TEST_CONFIG = {
  // Timeouts
  timeouts: {
    navigation: 45_000,
    action: 30_000,
    assertion: 20_000,
    pageLoad: 60_000,
    apiResponse: 45_000,
  },

  // Retry configuration
  retries: {
    element: 3,
    message: 3,
    upload: 3,
    navigation: 2,
  },

  // Wait times
  waits: {
    animation: 500,
    uiUpdate: 1000,
    networkSettle: 2000,
    betweenTests: 1500,
  },

  // Test data
  testData: {
    defaultMessage: 'Hello, how can you help me today?',
    complexMessage: 'Explain quantum computing in simple terms',
    imageUploadPath: 'tmp/test-image.png',
    testUserPrefix: 'test-playwright',
  },

  // Stability features
  stability: {
    useStrictSelectors: false,
    waitForNetworkIdle: true,
    clearCacheBeforeTest: false,
    screenshotOnFailure: true,
    videoOnFailure: true,
    traceOnFailure: true,
  },

  // Browser options
  browser: {
    headless: process.env.CI ? true : false,
    slowMo: process.env.CI ? 0 : 100,
    devtools: false,
    viewport: { width: 1280, height: 720 },
  },

  // API configuration
  api: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  },

  // Error patterns to ignore
  ignoredErrors: [
    'ResizeObserver loop limit exceeded',
    'ResizeObserver loop completed',
    'Non-Error promise rejection captured',
    'Hydration failed',
    'Text content does not match',
  ],

  // Selectors
  selectors: {
    chat: {
      input: '[data-testid="multimodal-input"]',
      sendButton: '[data-testid="send-button"]',
      stopButton: '[data-testid="stop-button"]',
      messageUser: '[data-testid="message-user"]',
      messageAssistant: '[data-testid="message-assistant"]',
      messageContent: '[data-testid="message-content"]',
      suggestion: '[data-testid="suggestion"], [data-testid="suggested-actions"] button',
      scrollButton: '[data-testid="scroll-to-bottom"]',
      attachButton: '[data-testid="attachments-button"]',
      modelSelector: '[data-testid="model-selector"]',
      databaseSelector: '[data-testid="database-selector"]',
    },
    auth: {
      emailInput: 'input[type="email"], input[name="email"]',
      passwordInput: 'input[type="password"], input[name="password"]',
      submitButton: 'button[type="submit"]',
      logoutButton: '[data-testid="logout-button"]',
    },
    vector: {
      uploadArea: '[data-testid="upload-area"]',
      fileInput: 'input[type="file"]',
      sourceItem: '[data-testid="source-item"]',
      citation: '[data-testid="citation"]',
    },
  },
};

/**
 * Helper to get selector with fallbacks
 */
export function getSelector(category: keyof typeof TEST_CONFIG.selectors, key: string): string {
  const selectors = TEST_CONFIG.selectors[category];
  return selectors[key as keyof typeof selectors] || `[data-testid="${key}"]`;
}

/**
 * Helper to apply test configuration
 */
export function applyTestConfig(test: any) {
  test.setTimeout(TEST_CONFIG.timeouts.pageLoad);
  
  test.use({
    actionTimeout: TEST_CONFIG.timeouts.action,
    navigationTimeout: TEST_CONFIG.timeouts.navigation,
    viewport: TEST_CONFIG.browser.viewport,
    ignoreHTTPSErrors: true,
    
    // Screenshot/video settings
    screenshot: {
      mode: TEST_CONFIG.stability.screenshotOnFailure ? 'only-on-failure' : 'off',
      fullPage: true,
    },
    video: {
      mode: TEST_CONFIG.stability.videoOnFailure ? 'retain-on-failure' : 'off',
    },
    trace: {
      mode: TEST_CONFIG.stability.traceOnFailure ? 'retain-on-failure' : 'off',
    },
  });
}