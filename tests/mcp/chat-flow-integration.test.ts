import { expect, test } from "@playwright/test";

/**
 * MCP Tools Integration Test for Complete Chat Flow
 * Tests the full chat experience using browser automation
 */

test.describe("Complete Chat Flow with MCP Tools", () => {
  test.beforeEach(async ({ page }) => {
    // Start local dev server if needed
    await page.goto("http://localhost:3000");
    await page.waitForLoadState("networkidle");
  });

  test("should handle complete chat workflow with reasoning models", async ({
    page,
  }) => {
    // Test new chat creation
    await page.click('[data-testid="new-chat-button"]');
    await expect(page.locator("h1")).toContainText("New Chat");

    // Test reasoning model selection
    await page.click('[data-testid="model-selector"]');
    await page.click('[data-testid="model-openai-o3-mini"]');

    // Send a complex reasoning query
    const userInput = page.locator('[data-testid="chat-input"]');
    await userInput.fill(
      "Solve this step by step: If a train travels 120 miles in 2 hours, and then 180 miles in 3 hours, what is the average speed for the entire journey?",
    );

    await page.click('[data-testid="send-button"]');

    // Wait for reasoning response
    await expect(
      page.locator('[data-testid="thinking-indicator"]'),
    ).toBeVisible();
    await expect(page.locator('[data-testid="thinking-indicator"]')).toBeHidden(
      { timeout: 30_000 },
    );

    // Verify reasoning is shown
    const reasoningSection = page.locator('[data-testid="message-reasoning"]');
    await expect(reasoningSection).toBeVisible();

    // Test reasoning toggle
    await page.click('[data-testid="reasoning-toggle"]');
    await expect(reasoningSection).toBeHidden();

    await page.click('[data-testid="reasoning-toggle"]');
    await expect(reasoningSection).toBeVisible();

    // Verify the mathematical answer is correct
    const assistantMessage = page
      .locator('[data-testid="assistant-message"]')
      .last();
    await expect(assistantMessage).toContainText("60 mph");
  });

  test("should test multi-agent routing and capabilities", async ({ page }) => {
    // Test QA Agent
    await page.goto("http://localhost:3000");
    await page.click('[data-testid="new-chat-button"]');

    const userInput = page.locator('[data-testid="chat-input"]');
    await userInput.fill("What is the capital of France?");
    await page.click('[data-testid="send-button"]');

    await page.waitForSelector('[data-testid="assistant-message"]');
    const qaResponse = page.locator('[data-testid="assistant-message"]').last();
    await expect(qaResponse).toContainText("Paris");

    // Test Research Agent with complex query
    await userInput.fill(
      "Compare the economic impact of renewable energy vs fossil fuels in developing countries",
    );
    await page.click('[data-testid="send-button"]');

    await page.waitForSelector('[data-testid="assistant-message"]', {
      timeout: 30_000,
    });
    const researchResponse = page
      .locator('[data-testid="assistant-message"]')
      .last();
    await expect(researchResponse).toContainText(/economic|renewable|fossil/i);

    // Test Rewrite Agent
    await userInput.fill(
      'Rewrite this text to be more professional: "Hey dude, the meeting was totally awesome and we got a lot done"',
    );
    await page.click('[data-testid="send-button"]');

    await page.waitForSelector('[data-testid="assistant-message"]');
    const rewriteResponse = page
      .locator('[data-testid="assistant-message"]')
      .last();
    await expect(rewriteResponse).not.toContainText(/dude|totally awesome/i);
    await expect(rewriteResponse).toContainText(
      /professional|meeting|productive/i,
    );
  });

  test("should test vector store integration and RAG", async ({ page }) => {
    // Navigate to document upload
    await page.goto("http://localhost:3000");
    await page.click('[data-testid="documents-tab"]');

    // Test document upload
    const fileInput = page.locator('input[type="file"]');

    // Create a test document
    const testContent = `
      AI Safety Guidelines:
      1. Always verify model outputs
      2. Implement proper rate limiting
      3. Use reasoning models for complex tasks
      4. Monitor for bias and harmful content
    `;

    await page.evaluate((content) => {
      const file = new File([content], "ai-guidelines.txt", {
        type: "text/plain",
      });
      const dt = new DataTransfer();
      dt.items.add(file);
      document.querySelector('input[type="file"]').files = dt.files;
    }, testContent);

    await page.click('[data-testid="upload-button"]');
    await page.waitForSelector('[data-testid="upload-success"]');

    // Test RAG query
    await page.click('[data-testid="chat-tab"]');
    await page.click('[data-testid="new-chat-button"]');

    const userInput = page.locator('[data-testid="chat-input"]');
    await userInput.fill(
      "What are the AI safety guidelines for rate limiting?",
    );
    await page.click('[data-testid="send-button"]');

    await page.waitForSelector('[data-testid="assistant-message"]');
    const ragResponse = page
      .locator('[data-testid="assistant-message"]')
      .last();
    await expect(ragResponse).toContainText(/rate limiting/i);

    // Verify sources are cited
    await expect(page.locator('[data-testid="source-citation"]')).toBeVisible();
  });

  test("should test streaming and real-time features", async ({ page }) => {
    await page.goto("http://localhost:3000");
    await page.click('[data-testid="new-chat-button"]');

    // Enable streaming indicators
    await page.click('[data-testid="settings-button"]');
    await page.check('[data-testid="show-streaming-indicators"]');
    await page.click('[data-testid="close-settings"]');

    const userInput = page.locator('[data-testid="chat-input"]');
    await userInput.fill(
      "Write a detailed explanation of quantum computing principles",
    );
    await page.click('[data-testid="send-button"]');

    // Verify streaming indicators
    await expect(
      page.locator('[data-testid="streaming-indicator"]'),
    ).toBeVisible();
    await expect(
      page.locator('[data-testid="typing-animation"]'),
    ).toBeVisible();

    // Watch for incremental content updates
    const messageContent = page
      .locator('[data-testid="assistant-message-content"]')
      .last();
    let previousLength = 0;

    // Poll for growing content (streaming)
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(500);
      const currentContent = await messageContent.textContent();
      const currentLength = currentContent?.length || 0;

      if (currentLength > previousLength) {
        // Content is growing - streaming is working
        previousLength = currentLength;
      }
    }

    expect(previousLength).toBeGreaterThan(0);

    // Wait for completion
    await expect(
      page.locator('[data-testid="streaming-indicator"]'),
    ).toBeHidden({ timeout: 30_000 });
    await expect(messageContent).toContainText(/quantum/i);
  });

  test("should test error handling and fallbacks", async ({ page }) => {
    await page.goto("http://localhost:3000");
    await page.click('[data-testid="new-chat-button"]');

    // Test with invalid model selection
    await page.click('[data-testid="model-selector"]');
    await page.click('[data-testid="model-invalid-test"]', { force: true });

    const userInput = page.locator('[data-testid="chat-input"]');
    await userInput.fill("Test message with invalid model");
    await page.click('[data-testid="send-button"]');

    // Should fallback to default model
    await page.waitForSelector('[data-testid="assistant-message"]');
    const fallbackResponse = page
      .locator('[data-testid="assistant-message"]')
      .last();
    await expect(fallbackResponse).toBeVisible();

    // Test rate limiting
    for (let i = 0; i < 15; i++) {
      await userInput.fill(`Rate limit test message ${i}`);
      await page.click('[data-testid="send-button"]');
      await page.waitForTimeout(100);
    }

    // Should show rate limit warning
    await expect(
      page.locator('[data-testid="rate-limit-warning"]'),
    ).toBeVisible();
  });

  test("should test agent orchestration health checks", async ({ page }) => {
    // Access health check endpoint
    const response = await page.request.get(
      "http://localhost:3000/api/health/agents",
    );
    expect(response.ok()).toBeTruthy();

    const healthData = await response.json();
    expect(healthData.status).toMatch(/healthy|degraded/);
    expect(healthData.agents).toBeDefined();

    // Verify all agents are available
    const agents = ["qa", "research", "rewrite", "planner"];
    for (const agent of agents) {
      expect(healthData.agents[agent]).toBeDefined();
      expect(healthData.agents[agent].status).toBe("available");
    }
  });
});
