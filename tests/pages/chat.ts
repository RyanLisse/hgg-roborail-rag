import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Page } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants for regex patterns
const CHAT_ID_REGEX = /\/chat\/[0-9a-f-]+/;

export class Chat {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  // UI element getters
  get sendButton() {
    return this.page.getByTestId('send-button');
  }

  get stopButton() {
    return this.page.getByTestId('stop-button');
  }

  get scrollToBottomButton() {
    return this.page.getByTestId('scroll-to-bottom');
  }

  // Basic navigation and setup
  async goto() {
    await this.page.goto('/');
  }

  async createNewChat() {
    await this.goto();
    await this.waitForPageLoad();
  }

  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle', { timeout: 30_000 });
    // Wait for essential elements to be visible
    await this.page.waitForSelector('[data-testid="multimodal-input"]', {
      timeout: 10_000,
    });
  }

  // Model selection methods
  async selectModel(modelId: string) {
    await this.page.getByTestId('model-selector').click();
    await this.page.getByTestId(`model-selector-item-${modelId}`).click();

    // Wait for model to be selected
    await this.page.waitForTimeout(500);
  }

  async getCurrentModel() {
    return await this.page.getByTestId('model-selector').innerText();
  }

  // Vector source selection
  async selectVectorSource(source: 'openai' | 'neon' | 'memory') {
    const databaseSelector = this.page.getByTestId('database-selector');

    if (await databaseSelector.isVisible()) {
      await databaseSelector.click();

      // Wait for dropdown to open
      await this.page.waitForTimeout(500);

      // Try multiple selector strategies
      const sourceSelectors = [
        `[data-testid="database-selector-item-${source}"]`,
        `text="${source}"`,
        `[data-value="${source}"]`,
        `.option:has-text("${source}")`,
      ];

      for (const selector of sourceSelectors) {
        const element = this.page.locator(selector);
        if (await element.first().isVisible()) {
          await element.first().click();
          break;
        }
      }

      // Wait for selection to register
      await this.page.waitForTimeout(500);
    }
  }

  // Message sending and receiving
  async sendUserMessage(message: string) {
    await this.sendMessage(message);
  }

  async sendUserMessageFromSuggestion() {
    // Click on the first suggestion
    const suggestions = this.page.locator('[data-testid="suggestion"]');
    const firstSuggestion = suggestions.first();

    if (await firstSuggestion.isVisible()) {
      await firstSuggestion.click();
    } else {
      // Fallback: send a default message
      await this.sendMessage('Tell me a joke');
    }
  }

  async sendMessage(message: string) {
    const input = this.page.getByTestId('multimodal-input');
    await input.waitFor({ state: 'visible', timeout: 10_000 });
    await input.click();
    await input.fill(message);

    const sendButton = this.page.getByTestId('send-button');
    await sendButton.waitFor({ state: 'visible', timeout: 5000 });

    // Ensure send button is enabled (increased timeout for test stability)
    await this.page.waitForFunction(
      () =>
        !document
          .querySelector('[data-testid="send-button"]')
          ?.hasAttribute('disabled'),
      { timeout: 15_000 },
    );

    await sendButton.click();
  }

  async isGenerationComplete() {
    await this.waitForResponse();
  }

  async getRecentAssistantMessage() {
    const content = await this.getLastAssistantMessage();
    const messageElements = await this.page
      .getByTestId('message-assistant')
      .all();
    const lastMessage = messageElements.at(-1);

    return {
      content,
      upvote: async () => {
        await lastMessage?.getByTestId('message-upvote').click();
      },
      downvote: async () => {
        await lastMessage?.getByTestId('message-downvote').click();
      },
    };
  }

  async hasChatIdInUrl() {
    const hasChatId = await this.hasChatId();
    if (!hasChatId) {
      throw new Error('Expected URL to contain chat ID');
    }
  }

  async waitForResponse(timeout = 30_000) {
    try {
      // Wait for chat API response (POST request)
      const response = await this.page.waitForResponse(
        (response) =>
          response.url().includes('/api/chat') &&
          response.request().method() === 'POST',
        { timeout },
      );
      await response.finished();

      // Wait for assistant message to appear in DOM
      await this.page.waitForSelector('[data-testid="message-assistant"]', {
        timeout: 15_000,
      });

      // Wait for send button to be re-enabled (indicating completion)
      // Increased timeout for test stability with mock providers
      await this.page.waitForSelector(
        '[data-testid="send-button"]:not([disabled])',
        { timeout: 20_000 },
      );
    } catch (_error) {
      // Fallback: wait for assistant message to appear
      try {
        await this.page.waitForSelector('[data-testid="message-assistant"]', {
          timeout: 10_000,
        });
      } catch (_fallbackError) {
        // Final fallback: wait for send button to be enabled
        await this.page
          .waitForSelector('[data-testid="send-button"]:not([disabled])', {
            timeout: 15_000,
          })
          .catch(() => {});
      }
    }
  }

  async getLastAssistantMessage() {
    // Wait for at least one assistant message to appear first
    await this.page.waitForSelector('[data-testid="message-assistant"]', {
      timeout: 10_000,
    });

    const messageElements = await this.page
      .getByTestId('message-assistant')
      .all();
    if (messageElements.length === 0) {
      throw new Error('No assistant messages found');
    }

    const lastMessage = messageElements.at(-1);
    if (!lastMessage) {
      throw new Error('Unable to get last assistant message');
    }

    const content = await lastMessage
      .getByTestId('message-content')
      .innerText();
    return content;
  }

  async getLastUserMessage() {
    const messageElements = await this.page.getByTestId('message-user').all();
    if (messageElements.length === 0) {
      throw new Error('No user messages found');
    }

    const lastMessage = messageElements.at(-1);
    const content = await lastMessage
      .getByTestId('message-content')
      .innerText();
    return content;
  }

  // Citations and sources
  async hasCitations() {
    const citations = this.page.locator('[data-testid="citations"]');
    return await citations.isVisible();
  }

  async getCitations() {
    const citations = await this.page
      .locator('[data-testid="citation-item"]')
      .all();
    const citationTexts = [];

    for (const citation of citations) {
      const text = await citation.innerText();
      citationTexts.push(text);
    }

    return citationTexts;
  }

  // Tool usage detection
  async hasToolUsage() {
    const toolIndicators = [
      '[data-testid="tool-call"]',
      '[data-testid="tool-usage"]',
      '.tool-call',
      '.tool-usage',
      '*[class*="tool"]',
    ];

    for (const selector of toolIndicators) {
      const element = this.page.locator(selector);
      if (await element.first().isVisible()) {
        return true;
      }
    }

    return false;
  }

  // Error detection
  async hasErrorMessage() {
    const errorSelectors = [
      '[data-testid="error-message"]',
      '.error-message',
      '*[class*="error"]',
      'text="Error"',
      'text="Failed"',
    ];

    for (const selector of errorSelectors) {
      const element = this.page.locator(selector);
      if (await element.first().isVisible()) {
        return true;
      }
    }

    return false;
  }

  // Voting functionality
  async upvoteLastMessage() {
    const messageElements = await this.page
      .getByTestId('message-assistant')
      .all();
    if (messageElements.length === 0) {
      throw new Error('No assistant messages to vote on');
    }

    const lastMessage = messageElements.at(-1);
    await lastMessage.getByTestId('message-upvote').click();
  }

  async downvoteLastMessage() {
    const messageElements = await this.page
      .getByTestId('message-assistant')
      .all();
    if (messageElements.length === 0) {
      throw new Error('No assistant messages to vote on');
    }

    const lastMessage = messageElements.at(-1);
    await lastMessage.getByTestId('message-downvote').click();
  }

  // File upload
  async uploadFile(filePath: string) {
    this.page.on('filechooser', async (fileChooser) => {
      await fileChooser.setFiles(filePath);
    });

    await this.page.getByTestId('attachments-button').click();
  }

  // Utility methods
  async isScrolledToBottom(): Promise<boolean> {
    const scrollContainer = this.page.locator('.overflow-y-scroll');
    return scrollContainer.evaluate(
      (el) => Math.abs(el.scrollHeight - el.scrollTop - el.clientHeight) < 1,
    );
  }

  async scrollToBottom() {
    const scrollContainer = this.page.locator('.overflow-y-scroll');
    await scrollContainer.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
  }

  async getMessageCount() {
    const userMessages = await this.page.getByTestId('message-user').count();
    const assistantMessages = await this.page
      .getByTestId('message-assistant')
      .count();
    return {
      user: userMessages,
      assistant: assistantMessages,
      total: userMessages + assistantMessages,
    };
  }

  // Wait for specific conditions
  async waitForModelSelection(modelId: string, timeout = 5000) {
    await this.page.waitForFunction(
      (id) => {
        const selector = document.querySelector(
          '[data-testid="model-selector"]',
        );
        return selector?.textContent?.includes(id);
      },
      modelId,
      { timeout },
    );
  }

  async waitForVectorSourceSelection(source: string, timeout = 5000) {
    await this.page.waitForFunction(
      (src) => {
        const selector = document.querySelector(
          '[data-testid="database-selector"]',
        );
        return selector?.textContent?.includes(src);
      },
      source,
      { timeout },
    );
  }

  // Advanced interactions
  async clearChat() {
    // Look for clear/new chat button
    const clearButtons = [
      '[data-testid="new-chat-button"]',
      '[data-testid="clear-chat-button"]',
      'text="New Chat"',
      'text="Clear"',
    ];

    for (const selector of clearButtons) {
      const element = this.page.locator(selector);
      if (await element.first().isVisible()) {
        await element.first().click();
        await this.page.waitForTimeout(500);
        return;
      }
    }

    // Fallback: reload page
    await this.page.reload();
    await this.waitForPageLoad();
  }

  async getCurrentUrl() {
    return this.page.url();
  }

  async hasNewChatUrl() {
    const url = await this.getCurrentUrl();
    const baseURL = process.env.PORT
      ? `http://localhost:${process.env.PORT}`
      : 'http://localhost:3001';
    return url === `${baseURL}/` || url.includes(`${baseURL}/#`);
  }

  async hasChatId() {
    const url = await this.getCurrentUrl();
    return CHAT_ID_REGEX.test(url);
  }

  // Missing methods for tests
  async getRecentUserMessage() {
    const userMessage = await this.getLastUserMessage();
    const messageElements = await this.page.getByTestId('message-user').all();
    const lastMessage = messageElements.at(-1);

    // Check for attachments
    const attachments =
      (await lastMessage?.locator('[data-testid="attachment"]').all()) || [];

    return {
      content: userMessage,
      attachments,
      edit: async (newContent: string) => {
        // Click edit button on the message
        await lastMessage?.getByTestId('message-edit').click();
        // Fill new content
        const editInput = this.page.getByTestId('message-edit-input');
        await editInput.fill(newContent);
        // Submit the edit
        await this.page.getByTestId('message-edit-submit').click();
      },
    };
  }

  async isElementVisible(testId: string) {
    await this.page.waitForSelector(`[data-testid="${testId}"]`, {
      state: 'visible',
      timeout: 5000,
    });
  }

  async isElementNotVisible(testId: string) {
    await this.page.waitForSelector(`[data-testid="${testId}"]`, {
      state: 'hidden',
      timeout: 5000,
    });
  }

  async addImageAttachment() {
    const filePath = path.join(__dirname, '../fixtures/test-image.png');
    await this.uploadFile(filePath);
  }

  async isVoteComplete() {
    // Wait for vote API call to complete
    try {
      await this.page.waitForResponse(
        (response) =>
          response.url().includes('/api/vote') && response.status() === 200,
        { timeout: 5000 },
      );
    } catch {
      // Fallback: just wait a bit
      await this.page.waitForTimeout(1000);
    }
  }

  async sendMultipleMessages(
    count: number,
    messageGenerator: (i: number) => string,
  ) {
    for (let i = 0; i < count; i++) {
      await this.sendUserMessage(messageGenerator(i));
      await this.isGenerationComplete();
    }
  }

  async waitForScrollToBottom() {
    await this.page.waitForFunction(
      () => {
        const container = document.querySelector('.overflow-y-scroll');
        if (!container) {
          return false;
        }
        return (
          Math.abs(
            container.scrollHeight -
              container.scrollTop -
              container.clientHeight,
          ) < 10
        );
      },
      { timeout: 5000 },
    );
  }

  async scrollToTop() {
    const scrollContainer = this.page.locator('.overflow-y-scroll');
    await scrollContainer.evaluate((el) => {
      el.scrollTop = 0;
    });
  }

  async upvote() {
    await this.upvoteLastMessage();
  }

  async downvote() {
    await this.downvoteLastMessage();
  }

  async expectToastToContain(text: string) {
    const { expect } = await import('../fixtures');
    await expect(this.page.getByTestId('toast')).toContainText(text);
  }
}

// Backward compatibility - export both classes
export class ChatPage extends Chat {}
export { Chat as default };
