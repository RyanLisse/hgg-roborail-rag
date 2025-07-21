import { expect, test } from "@playwright/test";

test.describe("Vector Store Integration", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app and handle authentication
    await page.goto("/");

    // Wait for the app to load and authenticate as guest if needed
    await page.waitForSelector('[data-testid="multimodal-input"]', {
      timeout: 15_000,
    });
  });

  test("should remove deploy button from chat header", async ({ page }) => {
    // Check that the Deploy with Vercel button is not present
    const deployButton = page.locator("text=Deploy with Vercel");
    await expect(deployButton).not.toBeVisible();
  });

  test("should show database selector in main chat interface", async ({
    page,
  }) => {
    // Should be on main chat already from beforeEach
    await page.waitForSelector('[data-testid="multimodal-input"]', {
      timeout: 15_000,
    });

    // Check if database selector is visible in the main chat
    const databaseSelector = page.locator('text="Data Sources:"');
    await expect(databaseSelector).toBeVisible();

    // Check for the actual selector button
    const selectorButton = page
      .locator(
        '[data-testid="database-selector"], .database-selector, button:has-text("Database"), button:has-text("Data Sources")',
      )
      .first();
    await expect(selectorButton).toBeVisible();
  });

  test("should show vector store sources in database selector", async ({
    page,
  }) => {
    // Should be on main chat already
    await page.waitForSelector('[data-testid="multimodal-input"]', {
      timeout: 15_000,
    });

    // Look for database/source selection interface
    const sourceSelector = page
      .locator(
        '[data-testid="database-selector"], button:has-text("Data Sources")',
      )
      .first();

    if (await sourceSelector.isVisible()) {
      // Click to open the selector if it's a dropdown
      await sourceSelector.click();

      // Wait a bit for dropdown to open
      await page.waitForTimeout(500);

      // Check for vector store options (these might be in a dropdown menu)
      const vectorStoreOptions = page.locator(
        '[role="menuitem"], [role="option"]',
      );
      const optionsCount = await vectorStoreOptions.count();

      // Should have at least one option available
      expect(optionsCount).toBeGreaterThan(0);
    }
  });

  test("should show file upload area in main chat", async ({ page }) => {
    // Should be on main chat already
    await page.waitForSelector('[data-testid="multimodal-input"]', {
      timeout: 15_000,
    });

    // Check for file upload area - this should be part of the multimodal input
    const uploadArea = page.locator(
      '[data-testid="attachments-button"], input[type="file"], button:has-text("attach")',
    );
    await expect(uploadArea.first()).toBeVisible();
  });

  test("should have working chat input in main interface", async ({ page }) => {
    // Should be on main chat already
    await page.waitForSelector('[data-testid="multimodal-input"]', {
      timeout: 15_000,
    });

    // Look for chat input
    const chatInput = page.getByTestId("multimodal-input");
    await expect(chatInput).toBeVisible();

    // Test typing in the input
    await chatInput.fill("Hello, this is a test message");
    await expect(chatInput).toHaveValue("Hello, this is a test message");
  });

  test("should show model selector in chat header", async ({ page }) => {
    // Check main chat page
    await page.goto("/");
    await page.waitForSelector('[data-testid="multimodal-input"]', {
      timeout: 15_000,
    });

    // Look for model selector
    const modelSelector = page.getByTestId("model-selector");
    await expect(modelSelector).toBeVisible();
  });

  test("should redirect RAG page to main chat", async ({ page }) => {
    // Navigate to /rag - should redirect to main chat
    await page.goto("/rag");

    // Should be redirected to main page
    await page.waitForURL("/");
    await page.waitForSelector('[data-testid="multimodal-input"]', {
      timeout: 15_000,
    });

    // Verify we're at main chat with database selector now visible
    const databaseSelector = page.locator('text="Data Sources:"');
    await expect(databaseSelector).toBeVisible();
  });
});
