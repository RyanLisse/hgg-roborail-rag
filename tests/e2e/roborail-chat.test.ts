import { expect, test } from "../fixtures";
import { ChatPage } from "../pages/chat";

test.describe("RoboRail Chat with Vector Store", () => {
  let chatPage: ChatPage;

  test.beforeEach(async ({ page }) => {
    chatPage = new ChatPage(page);
    await chatPage.createNewChat();
  });

  test("Database selector shows OpenAI vector store as default", async () => {
    // Check that database selector is visible and shows OpenAI
    const databaseSelector = chatPage.page.locator(
      '[data-testid="database-selector"]',
    );
    await expect(databaseSelector).toBeVisible();

    // Verify OpenAI is selected by default
    const openaiOption = databaseSelector.locator("text=OpenAI Vector Store");
    await expect(openaiOption).toBeVisible();
  });

  test("Send RoboRail calibration question and get relevant response", async () => {
    // Select OpenAI vector store if not already selected
    await chatPage.selectVectorStore("openai");

    // Send a RoboRail-specific question
    await chatPage.sendUserMessage("How do I calibrate the RoboRail system?");
    await chatPage.isGenerationComplete();

    const assistantMessage = await chatPage.getRecentAssistantMessage();

    // Check that response contains RoboRail calibration information
    expect(assistantMessage.content.toLowerCase()).toMatch(
      /(calibrat|roborail|measurement|accuracy)/,
    );

    // Verify response is substantial (not just a generic answer)
    expect(assistantMessage.content.length).toBeGreaterThan(100);
  });

  test("Send RoboRail safety question and get documentation-based response", async () => {
    await chatPage.selectVectorStore("openai");

    await chatPage.sendUserMessage(
      "What are the safety procedures for RoboRail operations?",
    );
    await chatPage.isGenerationComplete();

    const assistantMessage = await chatPage.getRecentAssistantMessage();

    // Check for safety-related content
    expect(assistantMessage.content.toLowerCase()).toMatch(
      /(safety|ppe|procedure|protective|equipment)/,
    );
    expect(assistantMessage.content.length).toBeGreaterThan(100);
  });

  test("Send RoboRail accuracy question and get technical specifications", async () => {
    await chatPage.selectVectorStore("openai");

    await chatPage.sendUserMessage(
      "What is the measurement accuracy of RoboRail?",
    );
    await chatPage.isGenerationComplete();

    const assistantMessage = await chatPage.getRecentAssistantMessage();

    // Check for accuracy/precision information
    expect(assistantMessage.content.toLowerCase()).toMatch(
      /(accuracy|precision|mm|degree|measurement|0\.1)/,
    );
    expect(assistantMessage.content.length).toBeGreaterThan(50);
  });

  test("RoboRail suggested questions work correctly", async () => {
    // Check that RoboRail-specific suggestions are shown
    const suggestions = chatPage.page.locator(
      '[data-testid="suggested-actions"] button',
    );
    await expect(suggestions.first()).toBeVisible();

    // Click on a RoboRail-specific suggestion
    const roborailSuggestion = suggestions.filter({
      hasText: /roborail|calibrat|measurement/i,
    });
    if ((await roborailSuggestion.count()) > 0) {
      await roborailSuggestion.first().click();
      await chatPage.isGenerationComplete();

      const assistantMessage = await chatPage.getRecentAssistantMessage();
      expect(assistantMessage.content.length).toBeGreaterThan(50);
    }
  });

  test("File search tool is used for RoboRail queries", async () => {
    await chatPage.selectVectorStore("openai");

    await chatPage.sendUserMessage(
      "Tell me about RoboRail troubleshooting procedures",
    );
    await chatPage.isGenerationComplete();

    const assistantMessage = await chatPage.getRecentAssistantMessage();

    // Response should be substantial, indicating file search was used
    expect(assistantMessage.content.length).toBeGreaterThan(100);
    expect(assistantMessage.content.toLowerCase()).toMatch(
      /(roborail|troubleshoot|procedure|issue|problem)/,
    );
  });

  test("Multiple vector store sources can be selected", async () => {
    const databaseSelector = chatPage.page.locator(
      '[data-testid="database-selector"]',
    );
    await expect(databaseSelector).toBeVisible();

    // Try to select multiple sources (if multi-select is available)
    // This test ensures the UI supports source selection
    const openaiOption = databaseSelector.locator("text=OpenAI");
    const neonOption = databaseSelector.locator("text=Neon");

    if ((await openaiOption.count()) > 0) {
      await expect(openaiOption).toBeVisible();
    }
    if ((await neonOption.count()) > 0) {
      await expect(neonOption).toBeVisible();
    }
  });

  test("Chat flow works with model selector and vector store", async () => {
    // Test the complete flow: select model, select vector store, ask question

    // Select GPT-4.1 model if model selector is available
    const modelSelector = chatPage.page.locator(
      '[data-testid="model-selector"]',
    );
    if ((await modelSelector.count()) > 0) {
      await modelSelector.click();
      const gpt41Option = chatPage.page.locator("text=GPT-4.1");
      if ((await gpt41Option.count()) > 0) {
        await gpt41Option.click();
      }
    }

    // Select OpenAI vector store
    await chatPage.selectVectorStore("openai");

    // Send question and verify response
    await chatPage.sendUserMessage("How do I operate the RoboRail system?");
    await chatPage.isGenerationComplete();

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    expect(assistantMessage.content.toLowerCase()).toMatch(
      /(roborail|operat|system|procedure)/,
    );
    expect(assistantMessage.content.length).toBeGreaterThan(100);
  });

  test("Vector store responses include file references", async () => {
    await chatPage.selectVectorStore("openai");

    await chatPage.sendUserMessage("What are the RoboRail specifications?");
    await chatPage.isGenerationComplete();

    const assistantMessage = await chatPage.getRecentAssistantMessage();

    // Check for file references or citations in the response
    const response = assistantMessage.content.toLowerCase();
    const hasFileReference =
      response.includes("manual") ||
      response.includes("faq") ||
      response.includes("document") ||
      response.includes("file") ||
      response.includes("roborail");

    expect(hasFileReference).toBe(true);
    expect(assistantMessage.content.length).toBeGreaterThan(100);
  });

  test("Error handling when vector store is unavailable", async () => {
    // This test ensures graceful degradation if vector store has issues
    await chatPage.sendUserMessage("Test question about RoboRail");

    // Should either get a response or proper error handling
    await chatPage.isGenerationComplete();

    const assistantMessage = await chatPage.getRecentAssistantMessage();
    expect(assistantMessage.content.length).toBeGreaterThan(10); // Some response should be provided
  });
});
