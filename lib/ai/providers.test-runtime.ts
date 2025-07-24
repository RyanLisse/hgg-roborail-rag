// Test provider for E2E tests

import type { CoreMessage } from 'ai';
import {
  customProvider,
  type LanguageModel,
  type LanguageModelV1CallOptions,
  type LanguageModelV1StreamPart,
} from 'ai';

type LanguageModelV1FinishReason = 'stop' | 'length' | 'content-filter' | 'tool-calls' | 'error' | 'other';
import { getResponseChunksByPrompt } from '@/tests/prompts/utils';

// Create a test language model that returns mocked responses
function createTestLanguageModel(modelId: string): LanguageModel {
  return {
    specificationVersion: 'v1',
    provider: 'test',
    modelId,
    defaultObjectGenerationMode: 'json',
    supportsImageUrls: true,

    doGenerate: async (options: LanguageModelV1CallOptions) => {
      throw new Error('doGenerate not implemented for test model');
    },

    doStream: async (options: LanguageModelV1CallOptions) => {
      // Get the appropriate response chunks based on the prompt
      const chunks = getResponseChunksByPrompt(
        options.prompt as CoreMessage[],
        modelId.includes('reasoning'),
      );

      return {
        stream: new ReadableStream({
          start(controller) {
            chunks.forEach((chunk) => controller.enqueue(chunk));
            controller.close();
          },
        }),
        rawCall: {
          rawPrompt: options.prompt,
          rawSettings: {},
        },
      };
    },
  } as LanguageModel;
}

// Create test models for all model aliases
function createTestLanguageModels(): Record<string, LanguageModel> {
  const models: Record<string, LanguageModel> = {};

  // Test model aliases
  const testModels = [
    'chat-model',
    'chat-model-fast',
    'chat-model-reasoning',
    'chat-model-advanced-reasoning',
    'title-model',
    'artifact-model',
    'research-model',
    'rewrite-model',
    'openai-gpt-4.1',
    'openai-gpt-4.1-mini',
    'openai-o3-mini',
    'openai-o4-mini',
  ];

  for (const modelId of testModels) {
    models[modelId] = createTestLanguageModel(modelId);
  }

  return models;
}

// Export test provider for E2E tests
export const myProvider = customProvider({
  languageModels: createTestLanguageModels(),
});

// Re-export other necessary functions for compatibility
export function getModelInstance(modelId: string) {
  return createTestLanguageModel(modelId);
}

export function getEmbeddingModelInstance(modelId: string) {
  // Return a mock embedding model
  return {
    specificationVersion: 'v1',
    provider: 'test',
    modelId: 'test-embedding',
    maxEmbeddingDimensions: 1536,
    doEmbed: async ({ values }: { values: string[] }) => {
      return {
        embeddings: values.map(() =>
          Array.from({ length: 1536 }, () => Math.random()),
        ),
      };
    },
  };
}

// Export provider instances for compatibility
export const aiProviders = {
  openai: () => createTestLanguageModel('test-openai'),
  anthropic: () => createTestLanguageModel('test-anthropic'),
  google: () => createTestLanguageModel('test-google'),
  cohere: () => createTestLanguageModel('test-cohere'),
  groq: () => createTestLanguageModel('test-groq'),
  xai: () => createTestLanguageModel('test-xai'),
} as const;
