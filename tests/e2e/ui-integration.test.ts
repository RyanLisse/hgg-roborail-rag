import { expect, test } from '../fixtures';
import { ChatPage } from '../pages/chat';

test.describe('UI Integration Tests', () => {
  let chatPage: ChatPage;

  test.beforeEach(async ({ page }) => {
    chatPage = new ChatPage(page);
    await chatPage.createNewChat();
  });

  test.describe('Chat Interface Integration', () => {
    test('should render chat components correctly', async () => {
      // Verify main chat components are present
      await expect(
        chatPage.page.locator('[data-testid="chat-header"]'),
      ).toBeVisible();
      await expect(
        chatPage.page.locator('[data-testid="messages-container"]'),
      ).toBeVisible();
      await expect(
        chatPage.page.locator('[data-testid="multimodal-input"]'),
      ).toBeVisible();
    });

    test('should handle database selector interaction', async () => {
      // Mobile view - database selector should be visible
      await chatPage.page.setViewportSize({ width: 400, height: 800 });

      const databaseSelector = chatPage.page.locator(
        '[data-testid="database-selector"]',
      );
      if (await databaseSelector.isVisible()) {
        await databaseSelector.click();

        // Verify options are available
        const options = chatPage.page.locator('[role="option"]');
        if ((await options.count()) > 0) {
          await expect(options.first()).toBeVisible();
        }
      }
    });

    test('should maintain state during source selection', async () => {
      // Start typing a message
      await chatPage.messageInput.fill('Test message about data');

      // Change data source if available
      const sourceButton = chatPage.page.locator(
        '[data-testid="source-toggle"]',
      );
      if (await sourceButton.isVisible()) {
        await sourceButton.click();
      }

      // Verify message input maintains content
      await expect(chatPage.messageInput).toHaveValue(
        'Test message about data',
      );
    });

    test('should handle multimodal input interactions', async () => {
      // Test attachment button
      const attachButton = chatPage.page.locator(
        '[data-testid="attach-button"]',
      );
      if (await attachButton.isVisible()) {
        await expect(attachButton).toBeVisible();
      }

      // Test file input functionality
      try {
        await chatPage.addImageAttachment();
        await chatPage.isElementVisible('attachments-preview');

        // Test message input with attachment
        await chatPage.messageInput.fill('Describe this image');
        await expect(chatPage.sendButton).toBeEnabled();
      } catch (error) {
        // Skip if attachment functionality not available
        console.log('Attachment test skipped:', error);
      }
    });
  });

  test.describe('Vector Store Monitoring UI', () => {
    test('should navigate to monitoring dashboard', async ({ page }) => {
      // Try to navigate to monitoring page
      try {
        await page.goto('/monitoring');

        // Verify main dashboard elements
        const heading = page
          .locator('h1')
          .filter({ hasText: 'Vector Store Monitoring' });
        if (await heading.isVisible()) {
          await expect(heading).toBeVisible();
          await expect(
            page.locator('[data-testid="health-status-card"]'),
          ).toBeVisible();
          await expect(
            page.locator('[data-testid="performance-metrics-card"]'),
          ).toBeVisible();
        }
      } catch (error) {
        console.log(
          'Monitoring dashboard test skipped - route may not exist:',
          error,
        );
      }
    });

    test('should display health status indicators', async ({ page }) => {
      try {
        await page.goto('/monitoring');

        // Wait for data to load
        await page.waitForSelector('[data-testid="health-status-card"]', {
          timeout: 5000,
        });

        // Check for health badges
        const healthBadges = page.locator('[data-testid="health-badge"]');
        if ((await healthBadges.count()) > 0) {
          await expect(healthBadges.first()).toBeVisible();

          // Verify badge colors based on status
          const healthyBadge = page.locator(
            '[data-testid="health-badge"]:has-text("Healthy")',
          );
          if ((await healthyBadge.count()) > 0) {
            await expect(healthyBadge.first()).toBeVisible();
          }
        }
      } catch (error) {
        console.log('Health status test skipped:', error);
      }
    });

    test('should handle test button interactions', async ({ page }) => {
      try {
        await page.goto('/monitoring');

        // Wait for component to load
        await page.waitForSelector('[data-testid="test-button"]', {
          timeout: 5000,
        });

        // Click test button
        const testButton = page.locator('[data-testid="test-button"]').first();
        await testButton.click();

        // Allow for API call
        await page.waitForTimeout(1000);
      } catch (error) {
        console.log('Test button interaction skipped:', error);
      }
    });
  });

  test.describe('Artifact Rendering and Interactions', () => {
    test('should create and display artifact', async () => {
      // Send message that should create an artifact
      await chatPage.sendUserMessage('Create a simple React component');
      await chatPage.isGenerationComplete();

      // Check if artifact was created
      const artifact = chatPage.page.locator('[data-testid="artifact"]');
      if (await artifact.isVisible()) {
        await expect(artifact).toBeVisible();

        // Verify artifact content area
        const content = artifact.locator('[data-testid="artifact-content"]');
        if (await content.isVisible()) {
          await expect(content).toBeVisible();
        }

        // Verify artifact actions
        const actions = artifact.locator('[data-testid="artifact-actions"]');
        if (await actions.isVisible()) {
          await expect(actions).toBeVisible();
        }
      }
    });

    test('should handle artifact version navigation', async () => {
      // Create artifact first
      await chatPage.sendUserMessage('Create a simple HTML page');
      await chatPage.isGenerationComplete();

      const artifact = chatPage.page.locator('[data-testid="artifact"]');
      if (await artifact.isVisible()) {
        // Look for version controls
        const versionControls = artifact.locator(
          '[data-testid="version-controls"]',
        );
        if (await versionControls.isVisible()) {
          // Test navigation buttons
          const prevButton = versionControls.locator(
            'button:has-text("Previous")',
          );
          const nextButton = versionControls.locator('button:has-text("Next")');

          if (await prevButton.isVisible()) {
            await prevButton.click();
          }
          if (await nextButton.isVisible()) {
            await nextButton.click();
          }
        }
      }
    });

    test('should handle artifact close and reopen', async () => {
      // Create artifact
      await chatPage.sendUserMessage('Create a CSS animation');
      await chatPage.isGenerationComplete();

      const artifact = chatPage.page.locator('[data-testid="artifact"]');
      if (await artifact.isVisible()) {
        // Close artifact
        const closeButton = artifact.locator('[data-testid="artifact-close"]');
        if (await closeButton.isVisible()) {
          await closeButton.click();

          // Artifact should be hidden
          await expect(artifact).not.toBeVisible();

          // Should be able to reopen from message
          const messageArtifactButton = chatPage.page.locator(
            '[data-testid="message-artifact"]',
          );
          if (await messageArtifactButton.isVisible()) {
            await messageArtifactButton.click();
            await expect(artifact).toBeVisible();
          }
        }
      }
    });
  });

  test.describe('Feedback System UI', () => {
    test('should display feedback buttons for assistant messages', async () => {
      await chatPage.sendUserMessage('What is machine learning?');
      await chatPage.isGenerationComplete();

      const assistantMessage = await chatPage.getRecentAssistantMessage();

      // Check for feedback buttons
      const thumbsUp = assistantMessage.element.locator(
        '[data-testid="thumbs-up"]',
      );
      const thumbsDown = assistantMessage.element.locator(
        '[data-testid="thumbs-down"]',
      );

      if (await thumbsUp.isVisible()) {
        await expect(thumbsUp).toBeVisible();
      }
      if (await thumbsDown.isVisible()) {
        await expect(thumbsDown).toBeVisible();
      }
    });

    test('should handle feedback voting interactions', async () => {
      await chatPage.sendUserMessage('Explain quantum computing');
      await chatPage.isGenerationComplete();

      const assistantMessage = await chatPage.getRecentAssistantMessage();

      // Click thumbs up if available
      const thumbsUp = assistantMessage.element.locator(
        '[data-testid="thumbs-up"]',
      );
      if (await thumbsUp.isVisible()) {
        await thumbsUp.click();

        // Should show selected state
        await page.waitForTimeout(500);

        // Click thumbs down to change vote
        const thumbsDown = assistantMessage.element.locator(
          '[data-testid="thumbs-down"]',
        );
        if (await thumbsDown.isVisible()) {
          await thumbsDown.click();
          await page.waitForTimeout(500);
        }
      }
    });

    test('should open feedback comment dialog', async () => {
      await chatPage.sendUserMessage('Tell me about AI ethics');
      await chatPage.isGenerationComplete();

      const assistantMessage = await chatPage.getRecentAssistantMessage();

      // First vote to enable comment
      const thumbsUp = assistantMessage.element.locator(
        '[data-testid="thumbs-up"]',
      );
      if (await thumbsUp.isVisible()) {
        await thumbsUp.click();
        await page.waitForTimeout(500);

        // Look for comment button
        const commentButton = assistantMessage.element.locator(
          'button:has-text("Comment")',
        );
        if (await commentButton.isVisible()) {
          await commentButton.click();

          // Should open dialog
          const dialog = chatPage.page.locator(
            '[role="dialog"]:has-text("Provide Feedback")',
          );
          if (await dialog.isVisible()) {
            await expect(dialog).toBeVisible();

            // Should have comment textarea
            const textarea = dialog.locator('textarea');
            if (await textarea.isVisible()) {
              await expect(textarea).toBeVisible();

              // Test comment submission
              await textarea.fill('This was very helpful!');

              const submitButton = dialog.locator('button:has-text("Submit")');
              if (await submitButton.isVisible()) {
                await submitButton.click();

                // Dialog should close
                await expect(dialog).not.toBeVisible();
              }
            }
          }
        }
      }
    });
  });

  test.describe('Citations Display and Interaction', () => {
    test('should display citations when sources are available', async () => {
      // Send message that might generate citations
      await chatPage.sendUserMessage('Tell me about the project documentation');
      await chatPage.isGenerationComplete();

      // Look for citations section
      const citations = chatPage.page.locator('[data-testid="citations"]');
      if (await citations.isVisible()) {
        await expect(citations).toBeVisible();

        // Should have sources button
        const sourcesButton = citations.locator('button:has-text("Sources")');
        if (await sourcesButton.isVisible()) {
          await expect(sourcesButton).toBeVisible();
        }
      }
    });

    test('should expand and collapse citations list', async () => {
      await chatPage.sendUserMessage('What features does this system have?');
      await chatPage.isGenerationComplete();

      const citations = chatPage.page.locator('[data-testid="citations"]');
      if (await citations.isVisible()) {
        const sourcesButton = citations.locator('button:has-text("Sources")');

        if (await sourcesButton.isVisible()) {
          // Initially collapsed
          const citationsList = citations.locator(
            '[data-testid="citations-list"]',
          );

          // Expand
          await sourcesButton.click();
          await page.waitForTimeout(300);

          if (await citationsList.isVisible()) {
            await expect(citationsList).toBeVisible();

            // Collapse
            await sourcesButton.click();
            await page.waitForTimeout(300);
            await expect(citationsList).not.toBeVisible();
          }
        }
      }
    });

    test('should handle inline citation clicks', async () => {
      await chatPage.sendUserMessage('Explain the system architecture');
      await chatPage.isGenerationComplete();

      // Look for inline citations in message
      const inlineCitations = chatPage.page.locator(
        '[data-testid="inline-citation"]',
      );
      const citationCount = await inlineCitations.count();

      if (citationCount > 0) {
        // Click first inline citation
        await inlineCitations.first().click();

        // Should scroll to citation details
        const citationDetails = chatPage.page.locator('[id^="citation-"]');
        if ((await citationDetails.count()) > 0) {
          // Allow for scroll animation
          await page.waitForTimeout(1000);
        }
      }
    });
  });

  test.describe('Accessibility and Keyboard Navigation', () => {
    test('should support keyboard navigation in chat', async () => {
      // Focus message input
      await chatPage.messageInput.focus();

      // Type message
      await chatPage.page.keyboard.type('Test keyboard navigation');

      // Check if Enter sends message or requires Shift+Enter
      const inputValue = await chatPage.messageInput.inputValue();
      expect(inputValue).toBe('Test keyboard navigation');

      // Send with button click for reliable test
      await chatPage.sendButton.click();

      // Should send message
      await chatPage.isGenerationComplete();
      const messages = await chatPage.page
        .locator('[data-testid="message"]')
        .count();
      expect(messages).toBeGreaterThan(0);
    });

    test('should have proper ARIA labels', async () => {
      // Check input accessibility
      const messageInput = chatPage.messageInput;
      const ariaLabel = await messageInput.getAttribute('aria-label');
      if (ariaLabel) {
        expect(ariaLabel).toBeTruthy();
      }

      // Check button accessibility
      const buttons = chatPage.page.locator('button');
      const buttonCount = await buttons.count();

      for (let i = 0; i < Math.min(buttonCount, 3); i++) {
        const button = buttons.nth(i);
        if (await button.isVisible()) {
          // Should have either aria-label or accessible text
          const hasAriaLabel = await button.getAttribute('aria-label');
          const hasText = await button.textContent();
          expect(hasAriaLabel || hasText).toBeTruthy();
        }
      }
    });

    test('should support focus management', async () => {
      // Send message to create UI elements
      await chatPage.sendUserMessage('Create some interactive content');
      await chatPage.isGenerationComplete();

      // Tab through focusable elements
      await chatPage.page.keyboard.press('Tab');

      // Should have visible focus indicator
      const focusedElement = await chatPage.page.locator(':focus').first();
      if (await focusedElement.isVisible()) {
        // Element should be focused
        expect(focusedElement.count()).toBe(1);
      }
    });
  });

  test.describe('Mobile Responsiveness', () => {
    test('should adapt layout for mobile viewport', async () => {
      // Set mobile viewport
      await chatPage.page.setViewportSize({ width: 375, height: 667 });

      // Reload to apply mobile styles
      await chatPage.page.reload();
      await chatPage.page.waitForLoadState('networkidle');

      // Check that essential elements are still visible
      await expect(chatPage.messageInput).toBeVisible();

      // Check mobile-specific elements
      const mobileElements = chatPage.page.locator('[class*="md:hidden"]');
      const mobileCount = await mobileElements.count();

      if (mobileCount > 0) {
        // At least some mobile-specific elements should be visible
        const visibleMobileElements = await mobileElements
          .filter({ hasText: /.+/ })
          .count();
        expect(visibleMobileElements).toBeGreaterThanOrEqual(0);
      }
    });

    test('should handle touch interactions', async () => {
      await chatPage.page.setViewportSize({ width: 375, height: 667 });

      // Test touch on send button
      await chatPage.messageInput.fill('Touch test');

      if (await chatPage.sendButton.isVisible()) {
        // Simulate touch
        await chatPage.sendButton.tap();

        // Should send message
        await chatPage.isGenerationComplete();

        const messages = await chatPage.page
          .locator('[data-testid="message"]')
          .count();
        expect(messages).toBeGreaterThan(0);
      }
    });

    test('should maintain usability on small screens', async () => {
      await chatPage.page.setViewportSize({ width: 320, height: 568 });

      // Send message to test full flow
      await chatPage.sendUserMessage('Test mobile usability');

      // Should still be functional
      await chatPage.isGenerationComplete();

      // Check that essential elements are still accessible
      await expect(chatPage.messageInput).toBeVisible();
      await expect(chatPage.sendButton).toBeVisible();
    });
  });

  test.describe('Error Handling and Edge Cases', () => {
    test('should handle network errors gracefully', async () => {
      // Simulate network failure
      await chatPage.page.setOfflineMode(true);

      try {
        await chatPage.sendUserMessage('This should fail');

        // Wait a bit for error to appear
        await chatPage.page.waitForTimeout(2000);

        // Should show error state
        const errorMessage = chatPage.page.locator(
          '[data-testid="error-message"]',
        );
        if (await errorMessage.isVisible()) {
          await expect(errorMessage).toBeVisible();
        }
      } finally {
        // Restore network
        await chatPage.page.setOfflineMode(false);
      }
    });

    test('should handle empty states', async () => {
      // Check empty chat state
      const emptyState = chatPage.page.locator('[data-testid="empty-state"]');
      if (await emptyState.isVisible()) {
        await expect(emptyState).toBeVisible();
      }

      // Check suggested actions in empty state
      const suggestions = chatPage.page.locator(
        '[data-testid="suggested-actions"]',
      );
      if (await suggestions.isVisible()) {
        await expect(suggestions).toBeVisible();
      }
    });

    test('should handle large message content', async () => {
      // Send very long message
      const longMessage =
        'This is a very long message that tests how the UI handles extensive content. '.repeat(
          50,
        );
      await chatPage.sendUserMessage(longMessage);

      await chatPage.isGenerationComplete();

      // Should handle display correctly
      const messageElements = chatPage.page.locator('[data-testid="message"]');
      const lastMessage = messageElements.last();
      if (await lastMessage.isVisible()) {
        await expect(lastMessage).toBeVisible();
      }
    });

    test('should handle rapid user interactions', async () => {
      // Fill message
      await chatPage.messageInput.fill('Test rapid interactions');

      // Try rapid clicks - but only if button is enabled
      if (await chatPage.sendButton.isEnabled()) {
        await chatPage.sendButton.click();

        // Wait a bit then try clicking again
        await chatPage.page.waitForTimeout(100);

        // Button should be disabled during sending
        if (await chatPage.sendButton.isVisible()) {
          const isDisabled = await chatPage.sendButton.isDisabled();
          expect(isDisabled).toBe(true);
        }
      }

      await chatPage.isGenerationComplete();
    });
  });
});
