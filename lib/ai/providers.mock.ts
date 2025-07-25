import type {
  LanguageModelV1,
  EmbeddingModel,
} from 'ai';
import { chatModels, getModelById } from './models';

// Mock language model for testing
export class MockLanguageModel implements LanguageModelV1 {
  readonly specificationVersion = 'v1' as const;
  readonly modelId: string;
  readonly provider: string;
  readonly defaultObjectGenerationMode = 'tool' as const;
  readonly supportsImageUrls = true;
  readonly supportsUrl = (url: URL) => false;

  constructor(modelId: string) {
    this.modelId = modelId;
    this.provider = 'mock';
  }

  async doGenerate(options: any): Promise<any> {
    // Simulate thinking for reasoning models
    const isReasoning = this.modelId.includes('reasoning');
    const thinking = isReasoning
      ? '<thinking>This is a test thinking process.</thinking>\n\n'
      : '';

    return {
      text: `${thinking}This is a mock response from the ${this.modelId} model for testing purposes. The grass is green due to chlorophyll.`,
      usage: {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      },
      finishReason: 'stop',
      toolCalls: [],
      toolResults: [],
    };
  }

  async doStream(options: any): Promise<any> {
    const response = await this.doGenerate(options);

    return {
      stream: new ReadableStream({
        async start(controller) {
          // Simulate streaming by chunking the response
          const chunks = response.text.match(/.{1,20}/g) || [];
          for (const chunk of chunks) {
            controller.enqueue({
              type: 'text-delta',
              textDelta: chunk,
            });
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
          controller.enqueue({
            type: 'finish',
            finishReason: 'stop',
            usage: response.usage,
          });
          controller.close();
        },
      }),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    };
  }
}

// Mock embedding model for testing
export class MockEmbeddingModel implements EmbeddingModel<any> {
  readonly specificationVersion = 'v1' as const;
  readonly modelId: string;
  readonly provider: string;
  readonly maxEmbeddingsPerCall = 2048;
  readonly supportsParallelCalls = true;

  constructor(modelId: string) {
    this.modelId = modelId;
    this.provider = 'mock';
  }

  async doEmbed(options: any): Promise<any> {
    // Generate consistent fake embeddings based on input
    const embeddings = options.values.map((value: string) => {
      const hash = value.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0);
        return a & a;
      }, 0);
      
      // Generate 1536-dimensional embedding (OpenAI's dimension)
      return Array.from({ length: 1536 }, (_, i) => 
        Math.sin(hash + i) * 0.5 + 0.5
      );
    });

    return {
      embeddings,
      usage: {
        inputTokens: options.values.join('').length,
        totalTokens: options.values.join('').length,
      },
    };
  }
}

// Mock providers for testing
export const aiProviders = {
  openai: Object.assign((modelId: string) => new MockLanguageModel(modelId), {
    embedding: (modelId: string) => new MockEmbeddingModel(modelId),
  }),
  google: Object.assign((modelId: string) => new MockLanguageModel(modelId), {
    embedding: (modelId: string) => new MockEmbeddingModel(modelId),
  }),
  anthropic: Object.assign((modelId: string) => new MockLanguageModel(modelId), {
    embedding: (modelId: string) => new MockEmbeddingModel(modelId),
  }),
  cohere: Object.assign((modelId: string) => new MockLanguageModel(modelId), {
    embedding: (modelId: string) => new MockEmbeddingModel(modelId),
  }),
  groq: Object.assign((modelId: string) => new MockLanguageModel(modelId), {
    embedding: (modelId: string) => new MockEmbeddingModel(modelId),
  }),
  xai: Object.assign((modelId: string) => new MockLanguageModel(modelId), {
    embedding: (modelId: string) => new MockEmbeddingModel(modelId),
  }),
} as const;

// Get model instance by model ID
export function getModelInstance(modelId: string) {
  const model = getModelById(modelId);
  if (!model) {
    // Return a default mock model for unknown IDs in test mode
    return new MockLanguageModel(modelId);
  }
  return new MockLanguageModel(modelId);
}

// Get embedding model instance
export function getEmbeddingModelInstance(modelId: string) {
  return new MockEmbeddingModel(modelId);
}

// Helper function to identify reasoning models
export function isReasoningModel(modelId: string): boolean {
  const reasoningPatterns = [
    'o1-', 'o1.', 'o3-', 'o3.', 'o4-', 'o4.',
    'reasoning', 'think', 'step-by-step',
  ];
  return reasoningPatterns.some((pattern) =>
    modelId.toLowerCase().includes(pattern)
  );
}

// Enhanced language model creation for testing
function createDynamicLanguageModel(modelId: string): LanguageModelV1 {
  return new MockLanguageModel(modelId);
}

// Create all language models for testing
function createAllLanguageModels(): Record<string, LanguageModelV1> {
  const models: Record<string, LanguageModelV1> = {};
  
  // Primary models with fallbacks
  const primaryModels = {
    'chat-model': 'openai-gpt-4.1',
    'chat-model-fast': 'openai-gpt-4.1-mini',
    'chat-model-reasoning': 'openai-o3-mini',
    'chat-model-advanced-reasoning': 'openai-o4-mini',
    'title-model': 'openai-gpt-4.1-nano',
    'artifact-model': 'openai-gpt-4.1',
    'research-model': 'google-gemini-2.5-pro-latest',
    'rewrite-model': 'openai-gpt-4.1',
  };

  // Create models
  for (const [alias, modelId] of Object.entries(primaryModels)) {
    models[alias] = createDynamicLanguageModel(modelId);
  }

  // Add all individual models from chatModels
  for (const model of chatModels) {
    models[model.id] = createDynamicLanguageModel(model.id);
  }

  return models;
}

// Main provider object for testing - compatible with customProvider
export const myProvider = {
  languageModels: createAllLanguageModels(),
  
  // Add a method to get a specific model
  languageModel(modelId?: string): LanguageModelV1 {
    const models = this.languageModels;
    const selectedModelId = modelId || 'chat-model';
    
    if (models[selectedModelId]) {
      return models[selectedModelId];
    }
    
    // Return default mock model
    return new MockLanguageModel(selectedModelId);
  }
};

// Export additional utilities for compatibility
export const customProvider = () => aiProviders;
export const extractReasoningMiddleware = () => ({
  tagName: 'thinking',
  separator: '\n\n',
});
export const wrapLanguageModel = (config: any) => config.model;

// Export individual providers for compatibility
export const openai = aiProviders.openai;
export const google = aiProviders.google;