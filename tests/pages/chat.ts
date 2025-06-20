import { type Page } from '@playwright/test';

export class Chat {
  constructor(private page: Page) {}

  // Basic navigation and setup
  async goto() {
    await this.page.goto('/');
  }

  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle', { timeout: 30000 });
    // Wait for essential elements to be visible
    await this.page.waitForSelector('[data-testid="multimodal-input"]', {
      timeout: 10000,
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
  async sendMessage(message: string) {
    const input = this.page.getByTestId('multimodal-input');
    await input.waitFor({ state: 'visible', timeout: 10000 });
    await input.click();
    await input.fill(message);

    const sendButton = this.page.getByTestId('send-button');
    await sendButton.waitFor({ state: 'visible', timeout: 5000 });

    // Ensure send button is enabled
    await this.page.waitForFunction(
      () =>
        !document
          .querySelector('[data-testid="send-button"]')
          ?.hasAttribute('disabled'),
      { timeout: 5000 },
    );

    await sendButton.click();
  }

  async waitForResponse(timeout = 45000) {
    try {
      // Wait for chat API response
      const response = await this.page.waitForResponse(
        (response) => response.url().includes('/api/chat'),
        { timeout },
      );
      await response.finished();

      // Wait for UI to update
      await this.page.waitForTimeout(1000);

      // Wait for send button to be re-enabled (indicating completion)
      await this.page.waitForSelector(
        '[data-testid="send-button"]:not([disabled])',
        { timeout: 10000 },
      );
    } catch (error) {
      console.warn('Response timeout, continuing with UI checks...');
      // Fallback: wait for send button to be enabled
      await this.page
        .waitForSelector('[data-testid="send-button"]:not([disabled])', {
          timeout: 10000,
        })
        .catch(() => {});
    }
  }

  async getLastAssistantMessage() {
    const messageElements = await this.page
      .getByTestId('message-assistant')
      .all();
    if (messageElements.length === 0) {
      throw new Error('No assistant messages found');
    }

    const lastMessage = messageElements[messageElements.length - 1];
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

    const lastMessage = messageElements[messageElements.length - 1];
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

    const lastMessage = messageElements[messageElements.length - 1];
    await lastMessage.getByTestId('message-upvote').click();
  }

  async downvoteLastMessage() {
    const messageElements = await this.page
      .getByTestId('message-assistant')
      .all();
    if (messageElements.length === 0) {
      throw new Error('No assistant messages to vote on');
    }

    const lastMessage = messageElements[messageElements.length - 1];
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
    const url = this.getCurrentUrl();
    return (
      url === 'http://localhost:3000/' ||
      url.includes('http://localhost:3000/#')
    );
  }

  async hasChatId() {
    const url = this.getCurrentUrl();
    return /\/chat\/[0-9a-f-]+/.test(url);
  }
}

// Backward compatibility - export both classes
export class ChatPage extends Chat {}
export { Chat as default };
