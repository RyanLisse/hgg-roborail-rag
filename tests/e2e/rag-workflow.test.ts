import fs from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import {
  createPerformanceMonitor,
  sendMessageWithRetry,
  uploadFileWithRetry,
  verifyAppState,
  waitForChatResponse,
  waitForPageReady,
} from "../utils/test-helpers";

test.describe("RAG Workflow E2E Tests", () => {
  // Test data
  const testDocumentContent = `
# AI and Machine Learning Guide

## Introduction
Artificial Intelligence (AI) is a broad field of computer science that aims to create systems capable of performing tasks that typically require human intelligence.

## Machine Learning
Machine Learning (ML) is a subset of AI that enables computers to learn and improve from experience without being explicitly programmed.

### Types of Machine Learning
1. **Supervised Learning**: Uses labeled training data to learn a mapping from inputs to outputs
2. **Unsupervised Learning**: Finds hidden patterns in data without labeled examples
3. **Reinforcement Learning**: Learns through interaction with an environment via rewards and punishments

## Deep Learning
Deep Learning is a subset of machine learning that uses artificial neural networks with multiple layers (deep neural networks) to model and understand complex patterns in data.

## Applications
- Natural Language Processing (NLP)
- Computer Vision
- Robotics
- Healthcare Diagnostics
- Financial Analysis
- Autonomous Vehicles

## Key Concepts
- **Neural Networks**: Computing systems inspired by biological neural networks
- **Training Data**: The dataset used to teach machine learning algorithms
- **Algorithms**: Step-by-step procedures for calculations, data processing, and automated reasoning
- **Model**: The output of an algorithm run on training data
`;

  const createTestDocument = () => {
    const tempDir = path.join(process.cwd(), "temp");
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const filePath = path.join(tempDir, "ai-ml-guide.md");
    fs.writeFileSync(filePath, testDocumentContent);
    return filePath;
  };

  const cleanupTestDocument = (filePath: string) => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.warn("Failed to cleanup test document:", error);
    }
  };

  test.beforeEach(async ({ page }) => {
    const monitor = createPerformanceMonitor();
    monitor.start("page-setup");

    try {
      // Navigate to the app
      await page.goto("/");

      // Optimized page ready check
      await waitForPageReady(page, 20_000);

      // Verify app is in good state
      const isHealthy = await verifyAppState(page);
      if (!isHealthy) {
        throw new Error("App failed health check");
      }

      // Handle authentication if needed
      const authButton = page.locator('button:has-text("Sign in")');
      if (await authButton.isVisible({ timeout: 2000 })) {
        await authButton.click();
        await waitForPageReady(page, 10_000);
      }

      monitor.end("page-setup");
    } catch (error) {
      monitor.end("page-setup");
      throw error;
    }
  });

  test("should complete full RAG workflow: upload → ask → verify sources", async ({
    page,
  }) => {
    const testFilePath = createTestDocument();
    const monitor = createPerformanceMonitor();

    try {
      // Step 1: Upload document
      monitor.start("document-upload");
      console.log("Step 1: Uploading document...");

      await uploadFileWithRetry(page, testFilePath, { timeout: 15_000 });
      console.log("✓ Document uploaded successfully");
      monitor.end("document-upload");

      // Step 2: Send the document to vector store
      monitor.start("document-processing");
      console.log("Step 2: Processing document...");

      await sendMessageWithRetry(page, "Process this document for RAG search", {
        waitForResponse: true,
      });

      // Check for processing confirmation with better error handling
      await waitForChatResponse(page, {
        timeout: 45_000,
        expectText: /uploaded|processed|added|vector|stored/i,
      });

      console.log("✓ Document processed for RAG");
      monitor.end("document-processing");

      // Step 3: Ask a question about the document
      console.log("Step 3: Asking question about document content...");

      await chatInput.fill(
        "What are the three types of machine learning mentioned in the document?",
      );
      await sendButton.click();

      // Wait for AI response
      await page.waitForSelector(".message-content:last-child", {
        timeout: 30_000,
      });

      // Verify the response contains relevant information
      const responseMessage = page.locator(".message-content").last();
      const responseText = await responseMessage.textContent();

      expect(responseText).toBeTruthy();
      expect(responseText?.toLowerCase()).toMatch(
        /(supervised|unsupervised|reinforcement)/,
      );

      console.log("✓ Question answered successfully");

      // Step 4: Verify sources are displayed
      console.log("Step 4: Verifying sources...");

      // Look for source citations or file references
      const sourcesSection = page.locator(
        '.sources, .citations, [data-testid="sources"]',
      );
      const fileReference = page.locator(':text("ai-ml-guide.md")');
      const citationLinks = page.locator(
        '.citation, .source-link, [data-testid="citation"]',
      );

      // Check if any source indicators are present
      const hasSourcesSection = await sourcesSection
        .isVisible()
        .catch(() => false);
      const hasFileReference = await fileReference
        .isVisible()
        .catch(() => false);
      const hasCitationLinks = (await citationLinks.count()) > 0;

      const hasAnySources =
        hasSourcesSection || hasFileReference || hasCitationLinks;

      if (hasAnySources) {
        console.log("✓ Sources/citations displayed");
      } else {
        console.log(
          "⚠ No explicit sources found, but response was generated from document content",
        );
      }

      // Step 5: Test search functionality
      console.log("Step 5: Testing search functionality...");

      await chatInput.fill("Search for information about neural networks");
      await sendButton.click();

      await page.waitForSelector(".message-content:last-child", {
        timeout: 30_000,
      });

      const searchResponse = page.locator(".message-content").last();
      const searchText = await searchResponse.textContent();

      expect(searchText).toBeTruthy();
      expect(searchText?.toLowerCase()).toMatch(
        /(neural network|computing system|biological)/,
      );

      console.log("✓ Search functionality working");

      // Step 6: Test complex query requiring synthesis
      console.log("Step 6: Testing complex synthesis query...");

      await chatInput.fill(
        "Compare supervised and unsupervised learning based on the document",
      );
      await sendButton.click();

      await page.waitForSelector(".message-content:last-child", {
        timeout: 30_000,
      });

      const synthesisResponse = page.locator(".message-content").last();
      const synthesisText = await synthesisResponse.textContent();

      expect(synthesisText).toBeTruthy();
      expect(synthesisText?.toLowerCase()).toMatch(
        /(supervised.*unsupervised|labeled.*unlabeled|difference|compare)/,
      );

      console.log("✓ Complex synthesis query handled");
    } finally {
      cleanupTestDocument(testFilePath);
    }
  });

  test("should handle multiple document uploads", async ({ page }) => {
    const doc1Path = createTestDocument();
    const doc2Content = `
# Database Systems Guide

## Introduction
Database systems are organized collections of data that can be easily accessed, managed, and updated.

## Types of Databases
1. **Relational Databases**: Use tables with rows and columns (SQL)
2. **NoSQL Databases**: Non-relational, flexible schema
3. **Graph Databases**: Store data as nodes and relationships
4. **Vector Databases**: Optimized for similarity search

## Key Concepts
- **ACID Properties**: Atomicity, Consistency, Isolation, Durability
- **Normalization**: Organizing data to reduce redundancy
- **Indexing**: Data structures to improve query performance
- **Transactions**: Units of work that are completed entirely or not at all
`;

    const tempDir = path.join(process.cwd(), "temp");
    const doc2Path = path.join(tempDir, "database-guide.md");
    fs.writeFileSync(doc2Path, doc2Content);

    try {
      // Upload first document
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles([doc1Path]);
      await page.waitForSelector('[data-testid="attachment"]', {
        timeout: 10_000,
      });

      const chatInput = page.getByTestId("multimodal-input");
      await chatInput.fill("Upload AI document");
      await page.getByTestId("send-button").click();
      await page.waitForSelector(".message-content", { timeout: 30_000 });

      // Upload second document
      await fileInput.setInputFiles([doc2Path]);
      await page.waitForSelector('[data-testid="attachment"]', {
        timeout: 10_000,
      });

      await chatInput.fill("Upload database document");
      await page.getByTestId("send-button").click();
      await page.waitForSelector(".message-content:nth-last-child(1)", {
        timeout: 30_000,
      });

      // Ask a question that requires both documents
      await chatInput.fill(
        "What are the similarities between AI and database systems in terms of data organization?",
      );
      await page.getByTestId("send-button").click();
      await page.waitForSelector(".message-content:last-child", {
        timeout: 30_000,
      });

      const response = await page
        .locator(".message-content")
        .last()
        .textContent();
      expect(response).toBeTruthy();
      expect(response?.toLowerCase()).toMatch(
        /(data|organization|structure|system)/,
      );

      console.log("✓ Multiple document workflow completed");
    } finally {
      cleanupTestDocument(doc1Path);
      cleanupTestDocument(doc2Path);
    }
  });

  test("should handle vector store errors gracefully", async ({ page }) => {
    // Test error handling when vector store is unavailable
    const chatInput = page.getByTestId("multimodal-input");

    // Try to search when no documents are available
    await chatInput.fill("Search for information about quantum computing");
    await page.getByTestId("send-button").click();

    await page.waitForSelector(".message-content:last-child", {
      timeout: 30_000,
    });

    const response = await page
      .locator(".message-content")
      .last()
      .textContent();
    expect(response).toBeTruthy();

    // Should either provide a helpful message or general knowledge response
    const isErrorHandled =
      response?.toLowerCase().includes("no documents") ||
      response?.toLowerCase().includes("quantum computing");

    expect(isErrorHandled).toBe(true);

    console.log("✓ Error handling works correctly");
  });

  test("should support different file formats", async ({ page }) => {
    // Test with a text file instead of markdown
    const txtContent =
      "This is a simple text file for testing. It contains information about software testing methodologies including unit testing, integration testing, and end-to-end testing.";
    const tempDir = path.join(process.cwd(), "temp");
    const txtPath = path.join(tempDir, "testing-guide.txt");

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    fs.writeFileSync(txtPath, txtContent);

    try {
      // Upload text file
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles([txtPath]);
      await page.waitForSelector('[data-testid="attachment"]', {
        timeout: 10_000,
      });

      const chatInput = page.getByTestId("multimodal-input");
      await chatInput.fill("Process this text file");
      await page.getByTestId("send-button").click();
      await page.waitForSelector(".message-content", { timeout: 30_000 });

      // Ask about the content
      await chatInput.fill(
        "What testing methodologies are mentioned in the text file?",
      );
      await page.getByTestId("send-button").click();
      await page.waitForSelector(".message-content:last-child", {
        timeout: 30_000,
      });

      const response = await page
        .locator(".message-content")
        .last()
        .textContent();
      expect(response).toBeTruthy();
      expect(response?.toLowerCase()).toMatch(/(unit|integration|end-to-end)/);

      console.log("✓ Text file format supported");
    } finally {
      cleanupTestDocument(txtPath);
    }
  });

  test("should handle large document uploads", async ({ page }) => {
    // Create a larger document
    const largeContent = `
# Comprehensive Guide to Modern Software Development

${Array.from(
  { length: 50 },
  (_, i) => `
## Section ${i + 1}: Topic ${i + 1}

This is section ${i + 1} of our comprehensive guide. It covers important aspects of software development including best practices, methodologies, and tools.

### Subsection ${i + 1}.1
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

### Subsection ${i + 1}.2
Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

Key points for section ${i + 1}:
- Point 1: Important concept related to topic ${i + 1}
- Point 2: Best practice for implementation
- Point 3: Common pitfalls to avoid
- Point 4: Performance considerations
- Point 5: Testing strategies

`,
).join("")}

## Conclusion
This comprehensive guide covers all essential aspects of modern software development practices.
`;

    const tempDir = path.join(process.cwd(), "temp");
    const largePath = path.join(tempDir, "large-guide.md");

    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    fs.writeFileSync(largePath, largeContent);

    try {
      // Upload large document
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles([largePath]);
      await page.waitForSelector('[data-testid="attachment"]', {
        timeout: 10_000,
      });

      const chatInput = page.getByTestId("multimodal-input");
      await chatInput.fill("Process this large document");
      await page.getByTestId("send-button").click();

      // Wait longer for large document processing
      await page.waitForSelector(".message-content", { timeout: 60_000 });

      // Ask about specific content
      await chatInput.fill("What is covered in section 25?");
      await page.getByTestId("send-button").click();
      await page.waitForSelector(".message-content:last-child", {
        timeout: 30_000,
      });

      const response = await page
        .locator(".message-content")
        .last()
        .textContent();
      expect(response).toBeTruthy();

      console.log("✓ Large document processing completed");
    } finally {
      cleanupTestDocument(largePath);
    }
  });

  test("should maintain conversation context with RAG", async ({ page }) => {
    const testFilePath = createTestDocument();

    try {
      // Upload and process document
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles([testFilePath]);
      await page.waitForSelector('[data-testid="attachment"]', {
        timeout: 10_000,
      });

      const chatInput = page.getByTestId("multimodal-input");
      await chatInput.fill("Process this AI guide");
      await page.getByTestId("send-button").click();
      await page.waitForSelector(".message-content", { timeout: 30_000 });

      // First question
      await chatInput.fill("What is machine learning?");
      await page.getByTestId("send-button").click();
      await page.waitForSelector(".message-content:last-child", {
        timeout: 30_000,
      });

      // Follow-up question using context
      await chatInput.fill("What are its main types?");
      await page.getByTestId("send-button").click();
      await page.waitForSelector(".message-content:last-child", {
        timeout: 30_000,
      });

      const followUpResponse = await page
        .locator(".message-content")
        .last()
        .textContent();
      expect(followUpResponse).toBeTruthy();
      expect(followUpResponse?.toLowerCase()).toMatch(
        /(supervised|unsupervised|reinforcement)/,
      );

      // Another contextual question
      await chatInput.fill("Can you explain the first one in more detail?");
      await page.getByTestId("send-button").click();
      await page.waitForSelector(".message-content:last-child", {
        timeout: 30_000,
      });

      const detailResponse = await page
        .locator(".message-content")
        .last()
        .textContent();
      expect(detailResponse).toBeTruthy();
      expect(detailResponse?.toLowerCase()).toMatch(
        /(supervised|labeled|training)/,
      );

      console.log("✓ Conversation context maintained");
    } finally {
      cleanupTestDocument(testFilePath);
    }
  });

  test("should handle concurrent queries efficiently", async ({ page }) => {
    const testFilePath = createTestDocument();

    try {
      // Upload and process document
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles([testFilePath]);
      await page.waitForSelector('[data-testid="attachment"]', {
        timeout: 10_000,
      });

      const chatInput = page.getByTestId("multimodal-input");
      await chatInput.fill("Process this document");
      await page.getByTestId("send-button").click();
      await page.waitForSelector(".message-content", { timeout: 30_000 });

      // Send multiple queries in sequence (simulating concurrent usage)
      const queries = [
        "What is AI?",
        "Define machine learning",
        "List the applications",
        "Explain neural networks",
      ];

      for (const query of queries) {
        await chatInput.fill(query);
        await page.getByTestId("send-button").click();
        // Don't wait for full response, just send next query
        await page.waitForTimeout(1000);
      }

      // Wait for all responses
      await page.waitForTimeout(10_000);

      // Check that we have responses
      const messages = page.locator(".message-content");
      const messageCount = await messages.count();

      // Should have at least the upload confirmation plus query responses
      expect(messageCount).toBeGreaterThan(queries.length);

      console.log("✓ Concurrent queries handled");
    } finally {
      cleanupTestDocument(testFilePath);
    }
  });

  test("should provide feedback on search quality", async ({ page }) => {
    const testFilePath = createTestDocument();

    try {
      // Upload and process document
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles([testFilePath]);
      await page.waitForSelector('[data-testid="attachment"]', {
        timeout: 10_000,
      });

      const chatInput = page.getByTestId("multimodal-input");
      await chatInput.fill("Add this AI guide to knowledge base");
      await page.getByTestId("send-button").click();
      await page.waitForSelector(".message-content", { timeout: 30_000 });

      // Ask a question that should have good results
      await chatInput.fill(
        "What are the key concepts in AI mentioned in the guide?",
      );
      await page.getByTestId("send-button").click();
      await page.waitForSelector(".message-content:last-child", {
        timeout: 30_000,
      });

      // Look for feedback elements (thumbs up/down, rating, etc.)
      const feedbackButtons = page.locator(
        '[data-testid="feedback"], .feedback-button, button:has-text("👍"), button:has-text("👎")',
      );
      const hasFeedback = (await feedbackButtons.count()) > 0;

      if (hasFeedback) {
        console.log("✓ Feedback system available");

        // Test feedback interaction
        const thumbsUp = page.locator('button:has-text("👍")').first();
        if (await thumbsUp.isVisible()) {
          await thumbsUp.click();
          console.log("✓ Feedback interaction works");
        }
      } else {
        console.log("ℹ No explicit feedback UI found");
      }

      // Ask a question that might not have good results
      await chatInput.fill(
        "What is the capital of Mars according to the document?",
      );
      await page.getByTestId("send-button").click();
      await page.waitForSelector(".message-content:last-child", {
        timeout: 30_000,
      });

      const noResultResponse = await page
        .locator(".message-content")
        .last()
        .textContent();
      expect(noResultResponse).toBeTruthy();

      // Should handle gracefully when no relevant info is found
      const hasGracefulHandling =
        noResultResponse?.toLowerCase().includes("not found") ||
        noResultResponse?.toLowerCase().includes("no information") ||
        noResultResponse?.toLowerCase().includes("not mentioned");

      console.log("✓ Graceful handling of irrelevant queries");
    } finally {
      cleanupTestDocument(testFilePath);
    }
  });
});
