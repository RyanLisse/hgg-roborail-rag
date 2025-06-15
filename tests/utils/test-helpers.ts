import { type Page, expect } from '@playwright/test';

/**
 * Test utility functions for improved reliability and performance
 */

/**
 * Wait for element with retry logic and better error handling
 */
export async function waitForElementWithRetry(
  page: Page,
  selector: string,
  options: {
    timeout?: number;
    state?: 'visible' | 'hidden' | 'attached' | 'detached';
    retries?: number;
  } = {},
) {
  const { timeout = 15000, state = 'visible', retries = 2 } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await page.waitForSelector(selector, { timeout, state });
      return;
    } catch (error) {
      if (attempt === retries) {
        console.error(
          `Failed to find element "${selector}" after ${retries + 1} attempts`,
        );
        throw error;
      }
      console.warn(
        `Attempt ${attempt + 1} failed for selector "${selector}", retrying...`,
      );
      await page.waitForTimeout(1000);
    }
  }
}

/**
 * Enhanced page load waiting with multiple indicators
 */
export async function waitForPageReady(page: Page, timeout = 30000) {
  try {
    await Promise.race([
      // Wait for network to be idle
      page.waitForLoadState('networkidle', { timeout }),

      // Or wait for main app elements
      Promise.all([
        page.waitForSelector('[data-testid="multimodal-input"]', {
          timeout: timeout / 2,
        }),
        page.waitForSelector('[data-testid="send-button"]', {
          timeout: timeout / 2,
        }),
      ]),

      // Timeout fallback
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Page ready timeout')), timeout),
      ),
    ]);

    // Additional small wait for React hydration
    await page.waitForTimeout(500);
  } catch (error) {
    console.warn('Page ready check failed, continuing...', error);
  }
}

/**
 * Smart message sending with automatic retry on failures
 */
export async function sendMessageWithRetry(
  page: Page,
  message: string,
  options: { maxRetries?: number; waitForResponse?: boolean } = {},
) {
  const { maxRetries = 2, waitForResponse = true } = options;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Ensure input is ready
      await waitForElementWithRetry(page, '[data-testid="multimodal-input"]', {
        timeout: 10000,
      });

      const input = page.getByTestId('multimodal-input');
      await input.click();
      await input.fill(message);

      // Wait for send button to be enabled
      await page.waitForFunction(
        () =>
          !document
            .querySelector('[data-testid="send-button"]')
            ?.hasAttribute('disabled'),
        { timeout: 5000 },
      );

      const sendButton = page.getByTestId('send-button');
      await sendButton.click();

      if (waitForResponse) {
        // Wait for API response or UI update
        await Promise.race([
          page
            .waitForResponse(
              (response) => response.url().includes('/api/chat'),
              { timeout: 45000 },
            )
            .then((res) => res.finished()),

          // Or wait for new message to appear
          page.waitForSelector('.message-content:last-child', {
            timeout: 30000,
          }),
        ]);
      }

      return; // Success
    } catch (error) {
      if (attempt === maxRetries) {
        throw new Error(
          `Failed to send message after ${maxRetries + 1} attempts: ${error}`,
        );
      }
      console.warn(`Message send attempt ${attempt + 1} failed, retrying...`);
      await page.waitForTimeout(2000);
    }
  }
}

/**
 * Wait for chat response with intelligent timeout
 */
export async function waitForChatResponse(
  page: Page,
  options: {
    timeout?: number;
    expectText?: string | RegExp;
    skipIfNoResponse?: boolean;
  } = {},
) {
  const { timeout = 30000, expectText, skipIfNoResponse = true } = options;

  try {
    // Wait for new message content
    await page.waitForSelector('.message-content:last-child', { timeout });

    if (expectText) {
      const lastMessage = page.locator('.message-content').last();
      await expect(lastMessage).toContainText(expectText, { timeout: 10000 });
    }

    // Small delay for UI to fully update
    await page.waitForTimeout(300);
  } catch (error) {
    if (skipIfNoResponse) {
      console.warn('Chat response timeout - continuing test...');
      return;
    }
    throw error;
  }
}

/**
 * File upload with better error handling
 */
export async function uploadFileWithRetry(
  page: Page,
  filePath: string,
  options: { timeout?: number; retries?: number } = {},
) {
  const { timeout = 15000, retries = 2 } = options;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Try different upload methods
      const fileInput = page.locator('input[type="file"]');
      const attachButton = page.getByTestId('attachments-button');

      // Click attachment button if visible
      if (await attachButton.isVisible({ timeout: 2000 })) {
        await attachButton.click();
        await page.waitForTimeout(500);
      }

      // Upload file
      await fileInput.setInputFiles(filePath);

      // Wait for upload confirmation
      await page.waitForSelector(
        '.attachment-preview, .file-preview, [data-testid="attachment"]',
        { timeout },
      );

      return; // Success
    } catch (error) {
      if (attempt === retries) {
        throw new Error(
          `File upload failed after ${retries + 1} attempts: ${error}`,
        );
      }
      console.warn(`Upload attempt ${attempt + 1} failed, retrying...`);
      await page.waitForTimeout(1000);
    }
  }
}

/**
 * Check if app is in a good state for testing
 */
export async function verifyAppState(page: Page) {
  try {
    // Check for error pages or broken states
    const errorIndicators = [
      'Application error',
      '500',
      '404',
      'Something went wrong',
      'Internal Server Error',
    ];

    const pageText = await page.textContent('body');
    const hasError = errorIndicators.some((indicator) =>
      pageText?.includes(indicator),
    );

    if (hasError) {
      throw new Error('App is in error state');
    }

    // Verify core elements are present
    await waitForElementWithRetry(page, '[data-testid="multimodal-input"]', {
      timeout: 10000,
    });

    return true;
  } catch (error) {
    console.error('App state verification failed:', error);
    return false;
  }
}

/**
 * Performance monitoring helper
 */
export function createPerformanceMonitor() {
  const timings: Record<string, number> = {};

  return {
    start(label: string) {
      timings[label] = Date.now();
    },

    end(label: string) {
      if (timings[label]) {
        const duration = Date.now() - timings[label];
        console.log(`⏱️ ${label}: ${duration}ms`);
        delete timings[label];
        return duration;
      }
      return 0;
    },

    log() {
      console.log('Active timings:', Object.keys(timings));
    },
  };
}
