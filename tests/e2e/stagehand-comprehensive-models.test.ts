import { expect, test } from "@playwright/test";
import { StagehandChat } from "../pages/stagehand-chat";

/**
 * Stagehand Comprehensive Model Testing
 *
 * Uses Stagehand AI to test all models and chat functionality
 * This provides more robust testing as Stagehand can adapt to UI changes
 */

test.describe("Stagehand Comprehensive Model Testing", () => {
  let stagehandChat: StagehandChat;

  test.beforeEach(async ({ page }) => {
    stagehandChat = new StagehandChat(page);
    await stagehandChat.goto();
    await stagehandChat.waitForLoad();
  });

  const testMessage =
    "Hello! Please respond with exactly: TEST_RESPONSE_CONFIRMED";
  const expectedResponse = "TEST_RESPONSE_CONFIRMED";

  // OpenAI Provider Tests with Stagehand
  test.describe("OpenAI Models with Stagehand", () => {
    test("OpenAI GPT-4 Mini model works correctly", async () => {
      await stagehandChat.selectModelUsingAI("GPT-4 Mini");
      await stagehandChat.sendMessageUsingAI(testMessage);
      await stagehandChat.waitForResponseUsingAI();

      const response = await stagehandChat.getLastResponseUsingAI();
      expect(response).toContain("TEST_RESPONSE_CONFIRMED");
    });

    test("OpenAI GPT-4 model works correctly", async () => {
      await stagehandChat.selectModelUsingAI("GPT-4");
      await stagehandChat.sendMessageUsingAI(testMessage);
      await stagehandChat.waitForResponseUsingAI();

      const response = await stagehandChat.getLastResponseUsingAI();
      expect(response).toContain("TEST_RESPONSE_CONFIRMED");
    });
  });

  // Anthropic Provider Tests with Stagehand
  test.describe("Anthropic Models with Stagehand", () => {
    test("Claude 3.5 Sonnet works correctly", async () => {
      await stagehandChat.selectModelUsingAI("Claude 3.5 Sonnet");
      await stagehandChat.sendMessageUsingAI(testMessage);
      await stagehandChat.waitForResponseUsingAI();

      const response = await stagehandChat.getLastResponseUsingAI();
      expect(response).toContain("TEST_RESPONSE_CONFIRMED");
    });

    test("Claude 3.5 Haiku works correctly", async () => {
      await stagehandChat.selectModelUsingAI("Claude 3.5 Haiku");
      await stagehandChat.sendMessageUsingAI(testMessage);
      await stagehandChat.waitForResponseUsingAI();

      const response = await stagehandChat.getLastResponseUsingAI();
      expect(response).toContain("TEST_RESPONSE_CONFIRMED");
    });
  });

  // Google Provider Tests with Stagehand
  test.describe("Google Models with Stagehand", () => {
    test("Gemini 1.5 Pro works correctly", async () => {
      await stagehandChat.selectModelUsingAI("Gemini 1.5 Pro");
      await stagehandChat.sendMessageUsingAI(testMessage);
      await stagehandChat.waitForResponseUsingAI();

      const response = await stagehandChat.getLastResponseUsingAI();
      expect(response).toContain("TEST_RESPONSE_CONFIRMED");
    });

    test("Gemini 1.5 Flash works correctly", async () => {
      await stagehandChat.selectModelUsingAI("Gemini 1.5 Flash");
      await stagehandChat.sendMessageUsingAI(testMessage);
      await stagehandChat.waitForResponseUsingAI();

      const response = await stagehandChat.getLastResponseUsingAI();
      expect(response).toContain("TEST_RESPONSE_CONFIRMED");
    });
  });

  // Complete workflow test with Stagehand
  test("Complete chat workflow with vector store using Stagehand AI", async () => {
    // 1. Select model using AI
    await stagehandChat.selectModelUsingAI("GPT-4 Mini");

    // 2. Configure vector stores using AI
    await stagehandChat.configureVectorStoresUsingAI(["memory", "openai"]);

    // 3. Send a RAG question using AI
    const ragQuestion =
      "What technical documentation or code examples do you have in your knowledge base?";
    await stagehandChat.sendMessageUsingAI(ragQuestion);
    await stagehandChat.waitForResponseUsingAI();

    // 4. Verify response using AI
    const hasRelevantResponse =
      await stagehandChat.verifyResponseRelevanceUsingAI();
    expect(hasRelevantResponse).toBeTruthy();

    // 5. Check for citations using AI
    const hasCitations = await stagehandChat.checkForCitationsUsingAI();
    if (hasCitations) {
      const citationCount = await stagehandChat.countCitationsUsingAI();
      expect(citationCount).toBeGreaterThan(0);
    }

    // 6. Send follow-up using AI
    await stagehandChat.sendMessageUsingAI(
      "Can you elaborate on the first point?",
    );
    await stagehandChat.waitForResponseUsingAI();

    const followUpResponse = await stagehandChat.getLastResponseUsingAI();
    expect(followUpResponse.length).toBeGreaterThan(10);
  });

  // Multi-model conversation test
  test("Switch between multiple models during conversation", async () => {
    const models = ["GPT-4 Mini", "Claude 3.5 Haiku", "Gemini 1.5 Flash"];
    const questions = ["What is 2 + 2?", "What is 3 + 3?", "What is 5 + 5?"];
    const expectedAnswers = ["4", "6", "10"];

    for (let i = 0; i < models.length; i++) {
      await stagehandChat.selectModelUsingAI(models[i]);
      await stagehandChat.sendMessageUsingAI(questions[i]);
      await stagehandChat.waitForResponseUsingAI();

      const response = await stagehandChat.getLastResponseUsingAI();
      expect(response).toContain(expectedAnswers[i]);
    }
  });

  // Error handling test with Stagehand
  test("Handle errors gracefully across models", async () => {
    const models = ["GPT-4", "Claude 3.5 Sonnet", "Gemini 1.5 Pro"];

    for (const model of models) {
      try {
        await stagehandChat.selectModelUsingAI(model);
        await stagehandChat.sendMessageUsingAI("Hello, are you working?");

        // Either should get a response or handle error gracefully
        const hasResponse = await stagehandChat.waitForResponseOrErrorUsingAI();
        expect(hasResponse).toBeTruthy(); // Should either respond or show error
      } catch (error) {
        // If model fails, should show error message
        const hasErrorMessage = await stagehandChat.checkForErrorUsingAI();
        expect(hasErrorMessage).toBeTruthy();
      }
    }
  });

  // Performance test with Stagehand
  test("Models respond within reasonable time using AI monitoring", async () => {
    await stagehandChat.selectModelUsingAI("GPT-4 Mini");

    const startTime = Date.now();
    await stagehandChat.sendMessageUsingAI("Hi, please respond quickly.");
    await stagehandChat.waitForResponseUsingAI();
    const endTime = Date.now();

    const responseTime = endTime - startTime;
    expect(responseTime).toBeLessThan(30_000); // 30 second timeout

    const response = await stagehandChat.getLastResponseUsingAI();
    expect(response.length).toBeGreaterThan(0);
  });

  // Tool usage test with Stagehand
  test("Models can use tools correctly with AI verification", async () => {
    await stagehandChat.selectModelUsingAI("GPT-4 Mini");

    // Test weather tool
    await stagehandChat.sendMessageUsingAI(
      "What's the current weather in New York City?",
    );
    await stagehandChat.waitForResponseUsingAI();

    // Use AI to verify the response mentions weather/temperature
    const hasWeatherInfo = await stagehandChat.verifyWeatherResponseUsingAI();
    expect(hasWeatherInfo).toBeTruthy();

    // Check for tool usage indicators using AI
    const hasToolUsage = await stagehandChat.checkForToolUsageUsingAI();
    expect(hasToolUsage).toBeTruthy();
  });
});

// Provider-specific comprehensive test
test.describe("All Providers Comprehensive Test", () => {
  let stagehandChat: StagehandChat;

  test.beforeEach(async ({ page }) => {
    stagehandChat = new StagehandChat(page);
    await stagehandChat.goto();
    await stagehandChat.waitForLoad();
  });

  test("Test all available providers respond correctly", async () => {
    // Define all models to test
    const modelsToTest = [
      {
        provider: "OpenAI",
        model: "GPT-4 Mini",
        testQuestion: "What is AI?",
        expectedKeyword: "artificial intelligence",
      },
      {
        provider: "OpenAI",
        model: "GPT-4",
        testQuestion: "What is machine learning?",
        expectedKeyword: "learning",
      },
      {
        provider: "Anthropic",
        model: "Claude 3.5 Sonnet",
        testQuestion: "What is deep learning?",
        expectedKeyword: "neural",
      },
      {
        provider: "Anthropic",
        model: "Claude 3.5 Haiku",
        testQuestion: "What is NLP?",
        expectedKeyword: "language",
      },
      {
        provider: "Google",
        model: "Gemini 1.5 Pro",
        testQuestion: "What is computer vision?",
        expectedKeyword: "vision",
      },
      {
        provider: "Google",
        model: "Gemini 1.5 Flash",
        testQuestion: "What is robotics?",
        expectedKeyword: "robot",
      },
    ];

    const results = [];

    for (const {
      provider,
      model,
      testQuestion,
      expectedKeyword,
    } of modelsToTest) {
      try {
        console.log(`Testing ${provider} - ${model}`);

        // Select model using Stagehand AI
        await stagehandChat.selectModelUsingAI(model);

        // Send test question
        await stagehandChat.sendMessageUsingAI(testQuestion);

        // Wait for response with timeout
        const hasResponse = await stagehandChat.waitForResponseUsingAI(30_000);

        if (hasResponse) {
          const response = await stagehandChat.getLastResponseUsingAI();
          const hasExpectedContent = response
            .toLowerCase()
            .includes(expectedKeyword.toLowerCase());

          results.push({
            provider,
            model,
            success: true,
            hasExpectedContent,
            responseLength: response.length,
            testQuestion,
            response: `${response.substring(0, 100)}...`, // Truncated for logging
          });
        } else {
          results.push({
            provider,
            model,
            success: false,
            error: "No response received",
            testQuestion,
          });
        }

        // Brief pause between tests
        await stagehandChat.page.waitForTimeout(1000);
      } catch (error) {
        results.push({
          provider,
          model,
          success: false,
          error: error.message,
          testQuestion,
        });
      }
    }

    // Log results
    console.log("Model Testing Results:");
    console.table(results);

    // Verify at least 80% of models responded successfully
    const successfulTests = results.filter((r) => r.success).length;
    const successRate = successfulTests / results.length;

    expect(successRate).toBeGreaterThan(0.8); // At least 80% success rate

    // Verify that successful responses contain expected content
    const relevantResponses = results.filter(
      (r) => r.success && r.hasExpectedContent,
    ).length;
    expect(relevantResponses).toBeGreaterThan(0); // At least some responses should be relevant
  });
});
