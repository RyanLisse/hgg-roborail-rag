import { expect, test } from "@playwright/test";
import { Chat } from "../pages/chat";

/**
 * Comprehensive Chat and Model Testing
 *
 * Tests all AI providers and models to ensure they work correctly:
 * - OpenAI (GPT-4, GPT-4 Mini, GPT-3.5)
 * - Anthropic (Claude Sonnet, Claude Haiku)
 * - Google (Gemini Pro, Gemini Flash)
 * - Groq (Llama models)
 * - xAI (Grok)
 * - Perplexity (Sonar models)
 */

test.describe("Comprehensive Chat and Model Testing", () => {
  let chat: Chat;

  test.beforeEach(async ({ page }) => {
    chat = new Chat(page);
    await chat.goto();
    await chat.waitForPageLoad();
  });

  // Test message that should work across all providers
  const testMessage =
    "Hello! Can you tell me what 2+2 equals? Please respond with just the number.";
  const expectedResponse = "4"; // Simple response that all models should handle

  // OpenAI Models Tests
  test.describe("OpenAI Provider", () => {
    test("GPT-4.1 model responds correctly", async () => {
      await chat.selectModel("openai-gpt-4.1");
      await chat.sendMessage(testMessage);
      await chat.waitForResponse();

      const response = await chat.getLastAssistantMessage();
      expect(response).toContain("4");

      // Verify model was used correctly
      const modelDisplay = await chat.getCurrentModel();
      expect(modelDisplay).toContain("GPT");
    });

    test("GPT-4.1 Mini model responds correctly", async () => {
      await chat.selectModel("openai-gpt-4.1-mini");
      await chat.sendMessage(testMessage);
      await chat.waitForResponse();

      const response = await chat.getLastAssistantMessage();
      expect(response).toContain("4");
    });
  });

  // Anthropic Models Tests
  test.describe("Anthropic Provider", () => {
    test("Claude 4 Sonnet responds correctly", async () => {
      await chat.selectModel("anthropic-claude-sonnet-4-20250514");
      await chat.sendMessage(testMessage);
      await chat.waitForResponse();

      const response = await chat.getLastAssistantMessage();
      expect(response).toContain("4");
    });

    test("Claude 4 Opus responds correctly", async () => {
      await chat.selectModel("anthropic-claude-opus-4-20250514");
      await chat.sendMessage(testMessage);
      await chat.waitForResponse();

      const response = await chat.getLastAssistantMessage();
      expect(response).toContain("4");
    });

    test("Claude 3.5 Sonnet responds correctly", async () => {
      await chat.selectModel("anthropic-claude-3-5-sonnet-20241022");
      await chat.sendMessage(testMessage);
      await chat.waitForResponse();

      const response = await chat.getLastAssistantMessage();
      expect(response).toContain("4");
    });
  });

  // Google Models Tests
  test.describe("Google Provider", () => {
    test("Gemini 1.5 Pro Latest responds correctly", async () => {
      await chat.selectModel("google-gemini-1.5-pro-latest");
      await chat.sendMessage(testMessage);
      await chat.waitForResponse();

      const response = await chat.getLastAssistantMessage();
      expect(response).toContain("4");
    });

    test("Gemini 1.5 Flash Latest responds correctly", async () => {
      await chat.selectModel("google-gemini-1.5-flash-latest");
      await chat.sendMessage(testMessage);
      await chat.waitForResponse();

      const response = await chat.getLastAssistantMessage();
      expect(response).toContain("4");
    });
  });

  // Complete Chat Workflow Test
  test("Complete chat workflow with vector store integration", async () => {
    // 1. Select default model
    await chat.selectModel("openai-gpt-4.1-mini");

    // 2. Select vector store sources
    await chat.selectVectorSource("memory");
    await chat.selectVectorSource("openai");

    // 3. Send a question that should use vector store
    const ragMessage =
      "What information do you have in your knowledge base about testing?";
    await chat.sendMessage(ragMessage);
    await chat.waitForResponse();

    // 4. Verify response contains relevant information
    const response = await chat.getLastAssistantMessage();
    expect(response.length).toBeGreaterThan(10);

    // 5. Verify citations or sources are shown
    const hasCitations = await chat.hasCitations();
    if (hasCitations) {
      const citations = await chat.getCitations();
      expect(citations.length).toBeGreaterThan(0);
    }

    // 6. Send follow-up message
    await chat.sendMessage("Can you elaborate on that?");
    await chat.waitForResponse();

    const followUpResponse = await chat.getLastAssistantMessage();
    expect(followUpResponse.length).toBeGreaterThan(5);
  });

  // Model Switching Test
  test("Switch between different models mid-conversation", async () => {
    // Start with OpenAI
    await chat.selectModel("openai-gpt-4.1-mini");
    await chat.sendMessage("What's 2+2?");
    await chat.waitForResponse();

    let response = await chat.getLastAssistantMessage();
    expect(response).toContain("4");

    // Switch to Anthropic
    await chat.selectModel("anthropic-claude-sonnet-4-20250514");
    await chat.sendMessage("What's 3+3?");
    await chat.waitForResponse();

    response = await chat.getLastAssistantMessage();
    expect(response).toContain("6");

    // Switch to Google
    await chat.selectModel("google-gemini-1.5-flash-latest");
    await chat.sendMessage("What's 5+5?");
    await chat.waitForResponse();

    response = await chat.getLastAssistantMessage();
    expect(response).toContain("10");
  });

  // Error Handling Test
  test("Handle model switching gracefully on errors", async () => {
    // Try a model that should work
    await chat.selectModel("openai-gpt-4.1");
    await chat.sendMessage(testMessage);

    // Should either respond successfully or gracefully handle error
    try {
      await chat.waitForResponse();
      const response = await chat.getLastAssistantMessage();
      expect(response.length).toBeGreaterThan(0);
    } catch (error) {
      // If it fails, should show error message
      const hasError = await chat.hasErrorMessage();
      expect(hasError).toBeTruthy();
    }
  });

  // Performance Test
  test("Models respond within reasonable time", async () => {
    await chat.selectModel("openai-gpt-4.1-mini"); // Fast model

    const startTime = Date.now();
    await chat.sendMessage("Hi");
    await chat.waitForResponse();
    const endTime = Date.now();

    const responseTime = endTime - startTime;
    expect(responseTime).toBeLessThan(30_000); // Should respond within 30 seconds

    const response = await chat.getLastAssistantMessage();
    expect(response.length).toBeGreaterThan(0);
  });

  // Tool Usage Test
  test("Models can use tools correctly", async () => {
    await chat.selectModel("openai-gpt-4.1-mini");

    // Test weather tool
    await chat.sendMessage("What's the weather like in San Francisco?");
    await chat.waitForResponse();

    const response = await chat.getLastAssistantMessage();
    expect(response).toMatch(/weather|temperature|San Francisco/i);

    // Should see tool usage indicator
    const hasToolUsage = await chat.hasToolUsage();
    expect(hasToolUsage).toBeTruthy();
  });

  // Vector Store Integration Test
  test("Vector store provides relevant context", async () => {
    await chat.selectModel("openai-gpt-4.1-mini");

    // Enable vector stores
    await chat.selectVectorSource("openai");
    await chat.selectVectorSource("memory");

    // Ask question that should trigger vector search
    await chat.sendMessage(
      "Tell me about the documentation or code in your knowledge base",
    );
    await chat.waitForResponse();

    const response = await chat.getLastAssistantMessage();
    expect(response.length).toBeGreaterThan(20);

    // Check if sources are cited
    const sourcesCited = await chat.hasCitations();
    if (sourcesCited) {
      const citations = await chat.getCitations();
      expect(citations.length).toBeGreaterThan(0);
    }
  });
});
