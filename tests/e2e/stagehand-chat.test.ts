import { expect, test } from '../fixtures';
import { StagehandChatPage } from '../pages/stagehand-chat';

test.describe('Stagehand Chat Activity', () => {
  let chatPage: StagehandChatPage;

  test.beforeEach(async ({ page }) => {
    chatPage = new StagehandChatPage(page);

    if (!chatPage.isAvailable()) {
      test.skip();
    }

    await chatPage.init();
    await chatPage.createNewChat();
  });

  test('Send a user message and receive response', async () => {
    await chatPage.sendUserMessage('Why is grass green?');
    await chatPage.isGenerationComplete();

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    // More flexible assertion since AI responses may vary
    expect(assistantMessage.content).toBeTruthy();
    expect(assistantMessage.content.length).toBeGreaterThan(10);
  });

  test('Redirect to /chat/:id after submitting message', async () => {
    await chatPage.sendUserMessage('Tell me about NextJS');
    await chatPage.isGenerationComplete();

    // Check that URL contains a chat ID
    await chatPage.hasChatIdInUrl();
  });

  test('Send a user message from suggestion', async () => {
    await chatPage.sendUserMessageFromSuggestion();
    await chatPage.isGenerationComplete();

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    expect(assistantMessage.content).toBeTruthy();
    expect(assistantMessage.content.length).toBeGreaterThan(10);
  });

  test('Toggle between send/stop button based on activity', async () => {
    // Check initial state
    const isSendButtonVisible = await chatPage.isSendButtonVisible();
    const isSendButtonDisabled = await chatPage.isSendButtonDisabled();

    expect(isSendButtonVisible).toBeTruthy();
    expect(isSendButtonDisabled).toBeTruthy();

    // Start sending a message
    await chatPage.sendUserMessage('What is artificial intelligence?');

    // During generation, stop button should be visible
    const isStopButtonVisible = await chatPage.isStopButtonVisible();
    expect(isStopButtonVisible).toBeTruthy();

    // Wait for completion
    await chatPage.isGenerationComplete();

    // After completion, stop button should not be visible
    const isStopButtonVisibleAfter = await chatPage.isStopButtonVisible();
    expect(isStopButtonVisibleAfter).toBeFalsy();
  });

  test('Vote on assistant message', async () => {
    await chatPage.sendUserMessage('Explain machine learning in simple terms');
    await chatPage.isGenerationComplete();

    const assistantMessage = await chatPage.getRecentAssistantMessage();

    // Test upvoting
    await assistantMessage.upvote();

    // Could add assertions here to check vote feedback if UI provides it
  });

  test('Edit user message', async () => {
    await chatPage.sendUserMessage('Tell me about cats');
    await chatPage.isGenerationComplete();

    const originalUserMessage = await chatPage.getRecentUserMessage();
    expect(originalUserMessage.content).toContain('cats');

    // Edit the message
    await originalUserMessage.edit('Tell me about dogs instead');
    await chatPage.isGenerationComplete();

    // Check that the message was edited
    const editedUserMessage = await chatPage.getRecentUserMessage();
    expect(editedUserMessage.content).toContain('dogs');
  });

  test('Model selection', async () => {
    // Test model selection using natural language
    await chatPage.chooseModelFromSelector('Reasoning model');

    const selectedModel = await chatPage.getSelectedModel();
    expect(selectedModel).toContain('Reasoning');
  });

  test('Visibility selection', async () => {
    // Test visibility selection
    await chatPage.chooseVisibilityFromSelector('public');

    const selectedVisibility = await chatPage.getSelectedVisibility();
    expect(selectedVisibility.toLowerCase()).toContain('public');
  });

  test('Multiple messages conversation', async () => {
    // Send multiple messages to test conversation flow
    await chatPage.sendMultipleMessages(
      3,
      (i) => `Question ${i + 1}: What is ${i + 1} + ${i + 1}?`,
    );

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    expect(assistantMessage.content).toBeTruthy();
  });

  test('Scroll functionality', async () => {
    // Send enough messages to trigger scrolling
    await chatPage.sendMultipleMessages(
      5,
      (i) => `Message number ${i + 1} to test scrolling`,
    );

    // Scroll to top
    await chatPage.scrollToTop();

    // Check scroll state
    const isAtBottom = await chatPage.isScrolledToBottom();
    expect(isAtBottom).toBeFalsy();
  });
});
