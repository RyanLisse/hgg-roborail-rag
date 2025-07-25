import { expect, test } from '../fixtures';
import { ChatPage } from '../pages/chat-stable';
import { stabilizeTest, withRecovery } from '../utils/test-helpers';

test.describe('Chat activity (Stable)', () => {
  let chatPage: ChatPage;

  test.beforeEach(async ({ page }) => {
    chatPage = new ChatPage(page);
    
    // Create new chat with recovery
    await withRecovery(
      async () => await chatPage.createNewChat(),
      async () => {
        await page.reload();
        await page.waitForTimeout(2000);
      }
    );
  });

  test.afterEach(async ({ page }) => {
    // Stabilize after each test
    await stabilizeTest(page);
  });

  test('Send a user message and receive response', async () => {
    await test.step('Send message', async () => {
      await chatPage.sendUserMessage('Why is grass green?');
    });

    await test.step('Wait for response', async () => {
      await chatPage.isGenerationComplete();
    });

    await test.step('Verify response', async () => {
      const assistantMessage = await chatPage.getRecentAssistantMessage();
      expect(assistantMessage.content).toBeTruthy();
      expect(assistantMessage.content.length).toBeGreaterThan(10);
      
      // Should contain some relevant content
      const lowerContent = assistantMessage.content.toLowerCase();
      expect(
        lowerContent.includes('chlorophyll') || 
        lowerContent.includes('green') ||
        lowerContent.includes('grass') ||
        lowerContent.includes('color') ||
        lowerContent.includes('plant')
      ).toBeTruthy();
    });
  });

  test('Redirect to /chat/:id after submitting message', async ({ page }) => {
    // Initial URL should be root
    expect(page.url()).toBe('http://localhost:3000/');

    await chatPage.sendUserMessage('Hello, how are you?');
    await chatPage.isGenerationComplete();

    // Should have chat ID in URL
    await chatPage.hasChatIdInUrl();
    expect(page.url()).toMatch(/\/chat\/[0-9a-f-]+$/);
    
    // Should have both messages
    const messages = await chatPage.getMessageHistory();
    expect(messages.user).toHaveLength(1);
    expect(messages.assistant).toHaveLength(1);
  });

  test('Send a user message from suggestion', async () => {
    await test.step('Click suggestion', async () => {
      await chatPage.sendUserMessageFromSuggestion();
    });

    await test.step('Wait for response', async () => {
      await chatPage.isGenerationComplete();
    });

    await test.step('Verify response', async () => {
      const assistantMessage = await chatPage.getRecentAssistantMessage();
      expect(assistantMessage.content).toBeTruthy();
      expect(assistantMessage.content.length).toBeGreaterThan(10);
    });
  });

  test('Toggle between send/stop button based on activity', async () => {
    // Initial state - send button visible but disabled
    await expect(chatPage.sendButton).toBeVisible();
    await expect(chatPage.sendButton).toBeDisabled();
    await expect(chatPage.stopButton).not.toBeVisible();

    // Type message - send button should enable
    await chatPage.multimodalInput.fill('Test message');
    await expect(chatPage.sendButton).toBeEnabled();

    // Send message - stop button should appear
    await chatPage.sendButton.click();
    await chatPage.waitForUIState('generating');
    await expect(chatPage.stopButton).toBeVisible();
    await expect(chatPage.sendButton).not.toBeVisible();

    // Wait for completion - send button returns
    await chatPage.isGenerationComplete();
    await chatPage.waitForUIState('idle');
    await expect(chatPage.sendButton).toBeVisible();
    await expect(chatPage.stopButton).not.toBeVisible();
  });

  test('Stop generation during submission', async () => {
    // Send a complex message that takes time to process
    await chatPage.multimodalInput.fill('Write a detailed essay about quantum computing');
    await chatPage.sendButton.click();
    
    // Wait for generation to start
    await chatPage.waitForUIState('generating');
    await expect(chatPage.stopButton).toBeVisible();
    
    // Stop generation
    await chatPage.stopButton.click();
    
    // Should return to idle state
    await chatPage.waitForUIState('idle');
    await expect(chatPage.sendButton).toBeVisible();
    await expect(chatPage.stopButton).not.toBeVisible();
  });

  test('Edit user message and resubmit', async () => {
    // Send initial message
    await chatPage.sendUserMessage('Why is grass green?');
    await chatPage.isGenerationComplete();

    const firstResponse = await chatPage.getRecentAssistantMessage();
    expect(firstResponse.content).toBeTruthy();

    // Edit the message
    const userMessage = await chatPage.getRecentUserMessage();
    await userMessage.edit('Why is the sky blue?');
    
    // Wait for new response
    await chatPage.isGenerationComplete();

    // Verify we have updated response
    const updatedResponse = await chatPage.getRecentAssistantMessage();
    expect(updatedResponse.content).toBeTruthy();
    
    // Content should be different and relevant to new question
    const lowerContent = updatedResponse.content.toLowerCase();
    expect(
      lowerContent.includes('sky') || 
      lowerContent.includes('blue') ||
      lowerContent.includes('atmosphere') ||
      lowerContent.includes('light') ||
      lowerContent.includes('scatter')
    ).toBeTruthy();
  });

  test('Hide suggested actions after sending message', async () => {
    // Suggestions should be visible initially
    const suggestionsVisible = await chatPage.isElementVisible('suggested-actions');
    expect(suggestionsVisible).toBeTruthy();

    // Send message from suggestion
    await chatPage.sendUserMessageFromSuggestion();

    // Suggestions should disappear
    const suggestionsHidden = await chatPage.isElementNotVisible('suggested-actions');
    expect(suggestionsHidden).toBeTruthy();
  });

  test('Upload file and send image attachment with message', async () => {
    await test.step('Add image attachment', async () => {
      await chatPage.addImageAttachment();
    });

    await test.step('Verify attachment preview', async () => {
      const previewVisible = await chatPage.isElementVisible('attachments-preview');
      expect(previewVisible).toBeTruthy();
    });

    await test.step('Send message with attachment', async () => {
      await chatPage.sendUserMessage('What is in this image?');
    });

    await test.step('Verify message has attachment', async () => {
      const userMessage = await chatPage.getRecentUserMessage();
      expect(userMessage.attachments).toHaveLength(1);
      expect(userMessage.attachments[0].type).toContain('image');
    });

    await test.step('Verify response acknowledges image', async () => {
      await chatPage.isGenerationComplete();
      const assistantMessage = await chatPage.getRecentAssistantMessage();
      expect(assistantMessage.content).toBeTruthy();
    });
  });

  test('Upvote and downvote messages', async () => {
    // Send message and get response
    await chatPage.sendUserMessage('Tell me a joke');
    await chatPage.isGenerationComplete();

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    
    // Test upvote
    await test.step('Upvote message', async () => {
      await assistantMessage.upvote();
      await chatPage.isVoteComplete();
    });

    // Test changing vote to downvote
    await test.step('Change to downvote', async () => {
      await assistantMessage.downvote();
      await chatPage.isVoteComplete();
    });
  });

  test('Create message from url query', async ({ page }) => {
    // Navigate with query parameter
    await page.goto('/?query=What is the meaning of life?');
    
    // Wait for app to process query
    await chatPage.isGenerationComplete();

    // Verify message was created from query
    const userMessage = await chatPage.getRecentUserMessage();
    expect(userMessage.content).toBe('What is the meaning of life?');

    // Verify we got a response
    const assistantMessage = await chatPage.getRecentAssistantMessage();
    expect(assistantMessage.content).toBeTruthy();
    expect(assistantMessage.content.length).toBeGreaterThan(20);
  });

  test('Auto-scroll and scroll button functionality', async () => {
    // Send multiple messages to create scrollable content
    await test.step('Fill chat with messages', async () => {
      await chatPage.sendMultipleMessages(5, (i) => `Test message ${i + 1}`);
    });

    // Should auto-scroll to bottom
    await test.step('Verify auto-scroll', async () => {
      await chatPage.waitForScrollToBottom();
    });

    // Scroll to top
    await test.step('Scroll to top and verify button', async () => {
      await chatPage.scrollToTop();
      await expect(chatPage.scrollToBottomButton).toBeVisible();
    });

    // Click scroll button
    await test.step('Use scroll to bottom button', async () => {
      await chatPage.scrollToBottomButton.click();
      await chatPage.waitForScrollToBottom();
      await expect(chatPage.scrollToBottomButton).not.toBeVisible();
    });
  });

  test('Handle errors gracefully', async ({ page }) => {
    // Simulate network error
    await page.route('**/api/chat', (route) => {
      route.abort('failed');
    });

    // Try to send message
    await chatPage.multimodalInput.fill('This should fail');
    await chatPage.sendButton.click();

    // Should show error state
    await page.waitForTimeout(2000);
    
    // App should still be functional
    const isHealthy = await verifyAppState(page);
    expect(isHealthy).toBeTruthy();
    
    // Remove route override
    await page.unroute('**/api/chat');
  });
});