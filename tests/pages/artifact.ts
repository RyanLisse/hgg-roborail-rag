import { expect, type Page } from '@playwright/test';

export class ArtifactPage {
  constructor(private page: Page) {}

  public get artifact() {
    return this.page.getByTestId('artifact');
  }

  public get sendButton() {
    return this.artifact.getByTestId('send-button');
  }

  public get stopButton() {
    return this.page.getByTestId('stop-button');
  }

  public get multimodalInput() {
    return this.page.getByTestId('multimodal-input');
  }

  async isGenerationComplete() {
    const response = await this.page.waitForResponse((response) =>
      response.url().includes('/api/chat'),
    );

    await response.finished();
  }

  async waitForArtifactToBeReady() {
    // Wait for the artifact to be visible
    await expect(this.artifact).toBeVisible({ timeout: 15000 });

    // Wait for the artifact to finish streaming (no more loading indicators)
    await this.page.waitForFunction(
      () => {
        const artifact = document.querySelector('[data-testid="artifact"]');
        if (!artifact) return false;

        // Check if there are any loading indicators still active
        const loadingElements = artifact.querySelectorAll(
          '.animate-pulse, .animate-spin',
        );
        return loadingElements.length === 0;
      },
      { timeout: 10000 },
    );

    // Extra buffer for content to fully populate
    await this.page.waitForTimeout(1000);
  }

  async sendUserMessage(message: string) {
    await this.artifact.getByTestId('multimodal-input').click();
    await this.artifact.getByTestId('multimodal-input').fill(message);
    await this.artifact.getByTestId('send-button').click();
  }

  async getRecentAssistantMessage() {
    const messageElements = await this.artifact
      .getByTestId('message-assistant')
      .all();
    const lastMessageElement = messageElements[messageElements.length - 1];

    if (!lastMessageElement) {
      throw new Error('No assistant message found');
    }

    const content = await lastMessageElement
      .getByTestId('message-content')
      .innerText()
      .catch(() => null);

    const reasoningElement = await lastMessageElement
      .getByTestId('message-reasoning')
      .isVisible()
      .then(async (visible) =>
        visible
          ? await lastMessageElement
              .getByTestId('message-reasoning')
              .innerText()
          : null,
      )
      .catch(() => null);

    return {
      element: lastMessageElement,
      content,
      reasoning: reasoningElement,
      async toggleReasoningVisibility() {
        await lastMessageElement
          .getByTestId('message-reasoning-toggle')
          .click();
      },
    };
  }

  async getRecentUserMessage() {
    const messageElements = await this.artifact
      .getByTestId('message-user')
      .all();
    const lastMessageElement = messageElements[messageElements.length - 1];

    if (!lastMessageElement) {
      throw new Error('No user message found');
    }

    const content = await lastMessageElement.innerText();

    const hasAttachments = await lastMessageElement
      .getByTestId('message-attachments')
      .isVisible()
      .catch(() => false);

    const attachments = hasAttachments
      ? await lastMessageElement.getByTestId('message-attachments').all()
      : [];

    const page = this.artifact;

    return {
      element: lastMessageElement,
      content,
      attachments,
      async edit(newMessage: string) {
        await page.getByTestId('message-edit-button').click();
        await page.getByTestId('message-editor').fill(newMessage);
        await page.getByTestId('message-editor-send-button').click();
        await expect(
          page.getByTestId('message-editor-send-button'),
        ).not.toBeVisible();
      },
    };
  }

  async closeArtifact() {
    return this.page.getByTestId('artifact-close-button').click();
  }
}
