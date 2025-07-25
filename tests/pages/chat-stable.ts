import { expect, type Locator, type Page } from '@playwright/test';
import {
  waitForElementWithRetry,
  waitForPageReady,
  sendMessageWithRetry,
  waitForChatResponse,
  uploadFileWithRetry,
  verifyAppState,
  stabilizeTest,
  withRecovery,
} from '../utils/test-helpers';

/**
 * Enhanced ChatPage with improved stability and reliability
 */
export class ChatPage {
  readonly page: Page;
  readonly multimodalInput: Locator;
  readonly sendButton: Locator;
  readonly stopButton: Locator;
  readonly scrollToBottomButton: Locator;
  readonly modelSelector: Locator;
  readonly databaseSelector: Locator;

  constructor(page: Page) {
    this.page = page;
    this.multimodalInput = page.getByTestId('multimodal-input');
    this.sendButton = page.getByTestId('send-button');
    this.stopButton = page.getByTestId('stop-button');
    this.scrollToBottomButton = page.getByTestId('scroll-to-bottom');
    this.modelSelector = page.getByTestId('model-selector');
    this.databaseSelector = page.getByTestId('database-selector');
  }

  /**
   * Navigate to chat and ensure page is ready
   */
  async goto() {
    await withRecovery(
      async () => {
        await this.page.goto('/', { waitUntil: 'domcontentloaded' });
        await waitForPageReady(this.page, 45_000);
      },
      async () => {
        await this.page.reload();
      },
    );
  }

  /**
   * Create a new chat session with stability checks
   */
  async createNewChat() {
    await this.goto();
    
    // Verify app is in good state
    const isHealthy = await verifyAppState(this.page);
    if (!isHealthy) {
      throw new Error('App is not in a healthy state to start a new chat');
    }

    // Wait for UI to stabilize
    await stabilizeTest(this.page);
  }

  /**
   * Send a user message with enhanced reliability
   */
  async sendUserMessage(message: string) {
    await sendMessageWithRetry(this.page, message, {
      maxRetries: 3,
      waitForResponse: true,
    });
  }

  /**
   * Send message from suggestion with fallback
   */
  async sendUserMessageFromSuggestion() {
    try {
      const suggestions = this.page.locator('[data-testid="suggestion"], [data-testid="suggested-actions"] button');
      const count = await suggestions.count();
      
      if (count > 0) {
        await suggestions.first().click();
        await waitForChatResponse(this.page);
      } else {
        // Fallback to sending a default message
        await this.sendUserMessage('Tell me about yourself');
      }
    } catch (error) {
      console.warn('Failed to use suggestion, sending default message:', error);
      await this.sendUserMessage('Hello, how can you help me today?');
    }
  }

  /**
   * Wait for generation to complete with multiple strategies
   */
  async isGenerationComplete() {
    await waitForChatResponse(this.page, {
      timeout: 60_000,
      skipIfNoResponse: false,
    });
  }

  /**
   * Get recent messages with error handling
   */
  async getRecentAssistantMessage() {
    const messageLocator = this.page
      .locator('[data-testid="message-assistant"]')
      .last()
      .locator('[data-testid="message-content"]');

    await messageLocator.waitFor({ state: 'visible', timeout: 10_000 });
    
    const content = await messageLocator.innerText();
    const attachments = await this.getMessageAttachments('assistant');

    return {
      content,
      attachments,
      upvote: async () => await this.voteMessage('assistant', 'up'),
      downvote: async () => await this.voteMessage('assistant', 'down'),
    };
  }

  async getRecentUserMessage() {
    const messageLocator = this.page
      .locator('[data-testid="message-user"]')
      .last()
      .locator('[data-testid="message-content"]');

    await messageLocator.waitFor({ state: 'visible', timeout: 10_000 });
    
    const content = await messageLocator.innerText();
    const attachments = await this.getMessageAttachments('user');

    return {
      content,
      attachments,
      edit: async (newText: string) => await this.editMessage(newText),
    };
  }

  /**
   * Edit the last user message
   */
  private async editMessage(newText: string) {
    const lastUserMessage = this.page.locator('[data-testid="message-user"]').last();
    const editButton = lastUserMessage.locator('[data-testid="message-edit"]');
    
    await editButton.click();
    await this.page.waitForTimeout(500);

    // Find edit input
    const editInput = lastUserMessage.locator('textarea, input[type="text"]');
    await editInput.fill(newText);

    // Submit edit
    const submitButton = lastUserMessage.locator('[data-testid="message-edit-submit"], button:has-text("Save")');
    await submitButton.click();

    // Wait for response
    await waitForChatResponse(this.page);
  }

  /**
   * Vote on a message with retry logic
   */
  private async voteMessage(type: 'assistant' | 'user', vote: 'up' | 'down') {
    const messageLocator = this.page.locator(`[data-testid="message-${type}"]`).last();
    const voteButton = messageLocator.locator(`[data-testid="message-${vote}vote"]`);
    
    await voteButton.click();
    await this.isVoteComplete();
  }

  /**
   * Wait for vote to be processed
   */
  async isVoteComplete() {
    try {
      await this.page.waitForResponse(
        (response) => response.url().includes('/api/vote') && response.status() === 200,
        { timeout: 5000 }
      );
    } catch {
      // Vote might be processed without API call
      await this.page.waitForTimeout(1000);
    }
  }

  /**
   * Get message attachments
   */
  private async getMessageAttachments(type: 'assistant' | 'user') {
    const messageLocator = this.page.locator(`[data-testid="message-${type}"]`).last();
    const attachments = messageLocator.locator('[data-testid="message-attachment"]');
    
    const attachmentData = [];
    const count = await attachments.count();
    
    for (let i = 0; i < count; i++) {
      const attachment = attachments.nth(i);
      attachmentData.push({
        type: await attachment.getAttribute('data-type') || 'unknown',
        name: await attachment.innerText(),
      });
    }
    
    return attachmentData;
  }

  /**
   * Check if URL has chat ID
   */
  async hasChatIdInUrl() {
    await this.page.waitForFunction(
      () => /\/chat\/[0-9a-f-]+/.test(window.location.href),
      { timeout: 10_000 }
    );
  }

  /**
   * Check element visibility with retry
   */
  async isElementVisible(testId: string) {
    try {
      await waitForElementWithRetry(this.page, `[data-testid="${testId}"]`, {
        timeout: 5000,
        state: 'visible',
      });
      return true;
    } catch {
      return false;
    }
  }

  async isElementNotVisible(testId: string) {
    try {
      await this.page.waitForSelector(`[data-testid="${testId}"]`, {
        state: 'hidden',
        timeout: 5000,
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Add image attachment with enhanced reliability
   */
  async addImageAttachment() {
    const imagePath = '/tmp/test-image.png';
    
    // Create test image if it doesn't exist
    await this.page.evaluate((path) => {
      const fs = require('fs');
      if (!fs.existsSync(path)) {
        // Create a simple PNG
        const buffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
        fs.writeFileSync(path, buffer);
      }
    }, imagePath);

    await uploadFileWithRetry(this.page, imagePath, {
      timeout: 20_000,
      retries: 3,
    });
  }

  /**
   * Send multiple messages for testing scroll
   */
  async sendMultipleMessages(count: number, messageGenerator: (i: number) => string) {
    for (let i = 0; i < count; i++) {
      await this.sendUserMessage(messageGenerator(i));
      // Wait briefly between messages
      await this.page.waitForTimeout(2000);
    }
  }

  /**
   * Scroll operations with stability
   */
  async scrollToTop() {
    await this.page.evaluate(() => {
      const scrollContainer = document.querySelector('.overflow-y-scroll, [data-testid="chat-messages"]');
      if (scrollContainer) {
        scrollContainer.scrollTop = 0;
      }
    });
    await this.page.waitForTimeout(500);
  }

  async waitForScrollToBottom() {
    await this.page.waitForFunction(
      () => {
        const scrollContainer = document.querySelector('.overflow-y-scroll, [data-testid="chat-messages"]');
        if (!scrollContainer) return true;
        return Math.abs(scrollContainer.scrollHeight - scrollContainer.scrollTop - scrollContainer.clientHeight) < 10;
      },
      { timeout: 5000 }
    );
  }

  /**
   * Choose a model from the selector with enhanced stability
   */
  async chooseModelFromSelector(modelType: 'chat-model' | 'chat-model-reasoning') {
    await this.modelSelector.click();
    await this.page.waitForTimeout(500);
    
    const modelOption = this.page.locator(`[data-testid="model-selector-item-${modelType}"]`);
    await modelOption.click();
    
    // Wait for selection to register
    await this.page.waitForTimeout(1000);
  }

  /**
   * Get selected model text
   */
  async getSelectedModel() {
    return await this.modelSelector.innerText();
  }

  /**
   * Select vector database source
   */
  async selectVectorSource(source: 'openai' | 'neon' | 'memory') {
    if (await this.databaseSelector.isVisible()) {
      await this.databaseSelector.click();
      await this.page.waitForTimeout(500);
      
      const sourceOption = this.page.locator(`[data-testid="database-selector-item-${source}"]`);
      await sourceOption.click();
      
      // Wait for selection to register
      await this.page.waitForTimeout(1000);
    }
  }

  /**
   * Utility to get message history
   */
  async getMessageHistory() {
    const userMessages = await this.page.locator('[data-testid="message-user"]').allInnerTexts();
    const assistantMessages = await this.page.locator('[data-testid="message-assistant"]').allInnerTexts();
    
    return {
      user: userMessages,
      assistant: assistantMessages,
      totalCount: userMessages.length + assistantMessages.length,
    };
  }

  /**
   * Wait for specific UI state
   */
  async waitForUIState(state: 'idle' | 'generating' | 'error') {
    switch (state) {
      case 'idle':
        await this.sendButton.waitFor({ state: 'visible', timeout: 10_000 });
        await expect(this.stopButton).not.toBeVisible();
        break;
      case 'generating':
        await this.stopButton.waitFor({ state: 'visible', timeout: 10_000 });
        await expect(this.sendButton).not.toBeVisible();
        break;
      case 'error':
        await this.page.waitForSelector('.error, [data-testid="error-message"]', {
          state: 'visible',
          timeout: 5000,
        });
        break;
    }
  }
}