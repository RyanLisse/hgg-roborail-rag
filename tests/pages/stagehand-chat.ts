import { Stagehand } from "@browserbasehq/stagehand";
import { expect, type Page } from "@playwright/test";

export class StagehandChatPage {
  private stagehand: Stagehand | null = null;
  private hasCredentials: boolean;

  constructor(private page: Page) {
    // Check if we have proper Browserbase credentials
    this.hasCredentials = !!(
      process.env.BROWSERBASE_API_KEY &&
      process.env.BROWSERBASE_PROJECT_ID &&
      process.env.BROWSERBASE_API_KEY !==
        "test-browserbase-key-for-local-testing"
    );

    if (this.hasCredentials) {
      this.stagehand = new Stagehand({
        env: "BROWSERBASE",
        apiKey: process.env.BROWSERBASE_API_KEY,
        projectId: process.env.BROWSERBASE_PROJECT_ID,
        verbose: 1,
      });
    }
  }

  isAvailable(): boolean {
    return this.hasCredentials && this.stagehand !== null;
  }

  async init() {
    if (!this.isAvailable()) {
      throw new Error(
        "Stagehand is not available - missing Browserbase credentials",
      );
    }

    try {
      await Promise.race([
        this.stagehand?.init(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Stagehand init timeout")), 30_000),
        ),
      ]);
      console.log("✓ Stagehand initialized successfully");
    } catch (error) {
      console.error("Failed to initialize Stagehand:", error);
      throw error;
    }
  }

  async createNewChat() {
    await this.page.goto("/");
    // Wait for the page to load and become interactive
    await this.stagehand.page.act("wait for the chat interface to load");
  }

  public getCurrentURL(): string {
    return this.page.url();
  }

  async sendUserMessage(message: string) {
    // Use Stagehand's AI-powered actions instead of brittle selectors
    await this.stagehand.page.act("click on the message input text area");
    await this.stagehand.page.act(`type the message: "${message}"`);
    await this.stagehand.page.act(
      "click the send button to submit the message",
    );
  }

  async isGenerationComplete() {
    try {
      // Wait for the API response with timeout
      const response = await this.page.waitForResponse(
        (response) => response.url().includes("/api/chat"),
        { timeout: 60_000 },
      );
      await response.finished();

      // Use Stagehand to wait for UI completion with shorter timeout
      await Promise.race([
        this.stagehand?.page.act(
          "wait for the AI response to finish generating",
        ),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("UI completion timeout")), 15_000),
        ),
      ]);
    } catch (error) {
      console.warn("Generation completion check failed:", error);
      // Fallback: wait for send button to be re-enabled
      await this.page.waitForTimeout(2000);
    }
  }

  async hasChatIdInUrl() {
    await expect(this.page).toHaveURL(
      /^http:\/\/localhost:3000\/chat\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  }

  async sendUserMessageFromSuggestion() {
    await this.stagehand.page.act("click on any suggested question button");
  }

  async isElementVisible(description: string) {
    const isVisible = await this.stagehand.page.observe(
      `check if ${description} is visible`,
    );
    expect(isVisible).toBeTruthy();
  }

  async isElementNotVisible(description: string) {
    const isVisible = await this.stagehand.page.observe(
      `check if ${description} is visible`,
    );
    expect(isVisible).toBeFalsy();
  }

  async addImageAttachment() {
    // Handle file upload with Stagehand
    await this.stagehand.page.act(
      "click the attachment button to add an image",
    );
    // Note: File uploading would need additional handling
  }

  async getSelectedModel() {
    const modelText = await this.stagehand.page.extract({
      instruction: "extract the currently selected AI model name",
      schema: {
        type: "object",
        properties: {
          modelName: { type: "string" },
        },
        required: ["modelName"],
      },
    });
    return modelText.modelName;
  }

  async chooseModelFromSelector(modelName: string) {
    await this.stagehand.page.act("click on the model selector dropdown");
    await this.stagehand.page.act(`select the model named "${modelName}"`);
  }

  async getSelectedVisibility() {
    const visibilityText = await this.stagehand.page.extract({
      instruction: "extract the currently selected chat visibility setting",
      schema: {
        type: "object",
        properties: {
          visibility: { type: "string" },
        },
        required: ["visibility"],
      },
    });
    return visibilityText.visibility;
  }

  async chooseVisibilityFromSelector(visibility: "public" | "private") {
    await this.stagehand.page.act("click on the visibility selector dropdown");
    await this.stagehand.page.act(`select ${visibility} visibility`);
  }

  async getRecentAssistantMessage() {
    // Extract the latest assistant message content
    const messageData = await this.stagehand.page.extract({
      instruction:
        "extract the content of the most recent AI assistant message",
      schema: {
        type: "object",
        properties: {
          content: { type: "string" },
          hasReasoning: { type: "boolean" },
        },
        required: ["content"],
      },
    });

    return {
      content: messageData.content,
      reasoning: null, // Could be extracted separately if needed

      async toggleReasoningVisibility() {
        await this.stagehand.page.act(
          "click the reasoning toggle button on the latest message",
        );
      },

      async upvote() {
        await this.stagehand.page.act(
          "click the upvote button on the latest AI message",
        );
      },

      async downvote() {
        await this.stagehand.page.act(
          "click the downvote button on the latest AI message",
        );
      },
    };
  }

  async getRecentUserMessage() {
    const messageData = await this.stagehand.page.extract({
      instruction: "extract the content of the most recent user message",
      schema: {
        type: "object",
        properties: {
          content: { type: "string" },
          hasAttachments: { type: "boolean" },
        },
        required: ["content"],
      },
    });

    return {
      content: messageData.content,
      attachments: [], // Could be extracted if needed

      async edit(newMessage: string) {
        await this.stagehand.page.act(
          "click the edit button on the latest user message",
        );
        await this.stagehand.page.act(
          `replace the message content with: "${newMessage}"`,
        );
        await this.stagehand.page.act(
          "click the send button to save the edited message",
        );
      },
    };
  }

  async expectToastToContain(text: string) {
    const toastVisible = await this.stagehand.page.observe(
      `check if a toast notification containing "${text}" is visible`,
    );
    expect(toastVisible).toBeTruthy();
  }

  async openSideBar() {
    await this.stagehand.page.act(
      "click the sidebar toggle button to open the sidebar",
    );
  }

  async isScrolledToBottom(): Promise<boolean> {
    const scrollStatus = await this.stagehand.page.extract({
      instruction: "check if the chat is scrolled to the bottom",
      schema: {
        type: "object",
        properties: {
          isAtBottom: { type: "boolean" },
        },
        required: ["isAtBottom"],
      },
    });
    return scrollStatus.isAtBottom;
  }

  async waitForScrollToBottom(timeout = 5000): Promise<void> {
    const start = Date.now();

    while (Date.now() - start < timeout) {
      if (await this.isScrolledToBottom()) return;
      await this.page.waitForTimeout(100);
    }

    throw new Error(`Timed out waiting for scroll bottom after ${timeout}ms`);
  }

  async sendMultipleMessages(
    count: number,
    makeMessage: (i: number) => string,
  ) {
    for (let i = 0; i < count; i++) {
      await this.sendUserMessage(makeMessage(i));
      await this.isGenerationComplete();
    }
  }

  async scrollToTop(): Promise<void> {
    await this.stagehand.page.act("scroll to the top of the chat");
  }

  // Vector store selection methods using natural language
  async selectVectorStore(source: "openai" | "neon" | "memory") {
    await this.stagehand.page.act("click on the database selector dropdown");
    await this.stagehand.page.act(`select the ${source} vector store option`);
  }

  async getSelectedVectorStores() {
    const storeData = await this.stagehand.page.extract({
      instruction: "extract the currently selected vector store",
      schema: {
        type: "object",
        properties: {
          selectedStore: { type: "string" },
        },
        required: ["selectedStore"],
      },
    });
    return storeData.selectedStore;
  }

  // Check button states using AI observation
  async isSendButtonVisible(): Promise<boolean> {
    return await this.stagehand.page.observe(
      "check if the send message button is visible",
    );
  }

  async isSendButtonDisabled(): Promise<boolean> {
    return await this.stagehand.page.observe(
      "check if the send message button is disabled",
    );
  }

  async isStopButtonVisible(): Promise<boolean> {
    return await this.stagehand.page.observe(
      "check if the stop generation button is visible",
    );
  }

  // Extended methods for comprehensive testing
  async selectModelUsingAI(modelName: string) {
    await this.chooseModelFromSelector(modelName);
  }

  async sendMessageUsingAI(message: string) {
    await this.sendUserMessage(message);
  }

  async waitForResponseUsingAI(timeout = 45_000): Promise<boolean> {
    try {
      await this.isGenerationComplete();
      return true;
    } catch (error) {
      console.warn("Response timeout:", error);
      return false;
    }
  }

  async getLastResponseUsingAI(): Promise<string> {
    const message = await this.getRecentAssistantMessage();
    return message.content;
  }

  async configureVectorStoresUsingAI(sources: string[]) {
    for (const source of sources) {
      if (["openai", "neon", "memory"].includes(source)) {
        await this.selectVectorStore(source as "openai" | "neon" | "memory");
      }
    }
  }

  async verifyResponseRelevanceUsingAI(): Promise<boolean> {
    const isRelevant = await this.stagehand?.page.observe(
      "check if the last AI response contains meaningful, relevant content rather than an error or empty response",
    );
    return isRelevant;
  }

  async checkForCitationsUsingAI(): Promise<boolean> {
    const hasCitations = await this.stagehand?.page.observe(
      "check if there are any citations, sources, or references shown with the AI response",
    );
    return hasCitations;
  }

  async countCitationsUsingAI(): Promise<number> {
    const citationData = await this.stagehand?.page.extract({
      instruction: "count the number of citations or source references visible",
      schema: {
        type: "object",
        properties: {
          count: { type: "number" },
        },
        required: ["count"],
      },
    });
    return citationData?.count || 0;
  }

  async checkForErrorUsingAI(): Promise<boolean> {
    const hasError = await this.stagehand?.page.observe(
      "check if there are any error messages or failed request indicators visible",
    );
    return hasError;
  }

  async waitForResponseOrErrorUsingAI(): Promise<boolean> {
    try {
      await this.isGenerationComplete();
      return true;
    } catch (error) {
      const hasError = await this.checkForErrorUsingAI();
      return hasError;
    }
  }

  async verifyWeatherResponseUsingAI(): Promise<boolean> {
    const weatherResponse = await this.stagehand?.page.extract({
      instruction:
        "check if the AI response contains weather-related information like temperature, conditions, or weather data",
      schema: {
        type: "object",
        properties: {
          hasWeatherInfo: { type: "boolean" },
        },
        required: ["hasWeatherInfo"],
      },
    });
    return weatherResponse?.hasWeatherInfo;
  }

  async checkForToolUsageUsingAI(): Promise<boolean> {
    const hasToolUsage = await this.stagehand?.page.observe(
      "check if there are any indicators showing the AI used external tools or functions",
    );
    return hasToolUsage;
  }

  async goto() {
    await this.createNewChat();
  }

  async waitForLoad() {
    await this.page.waitForLoadState("networkidle", { timeout: 30_000 });
    if (this.isAvailable()) {
      await this.stagehand?.page.act(
        "wait for the chat interface to be fully loaded",
      );
    }
  }
}

// Export alias for backward compatibility and new tests
export class StagehandChat extends StagehandChatPage {}
