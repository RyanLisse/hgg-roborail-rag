export type Provider = 'openai' | 'google';

export interface ChatModel {
  id: string;
  name: string;
  provider: Provider;
  modelId: string;
  description: string;
  maxTokens?: number;
  contextWindow?: number;
}

export const DEFAULT_CHAT_MODEL_ID = 'openai-gpt-4.1';
export const DEFAULT_CHAT_MODEL = 'openai-gpt-4.1';
export const DEFAULT_REASONING_MODEL = 'openai-o4-mini';
export const DEFAULT_FAST_MODEL = 'openai-gpt-4.1-nano';

const createModel = (
  provider: Provider,
  modelId: string,
  name: string,
  description: string,
  options: Partial<ChatModel> = {},
): ChatModel => ({
  id: `${provider}-${modelId}`,
  name,
  provider,
  modelId,
  description,
  ...options,
});

export const chatModels: ChatModel[] = [
  // OpenAI models - Current as of June 2025
  createModel(
    'openai',
    'gpt-4.1',
    'GPT-4.1',
    'Latest flagship model with improved coding and long context',
    {
      maxTokens: 1_000_000,
      contextWindow: 1_000_000,
    },
  ),
  createModel(
    'openai',
    'gpt-4.1-mini',
    'GPT-4.1 Mini',
    'Fast and cost-effective latest generation model (5x cheaper)',
    {
      maxTokens: 1_000_000,
      contextWindow: 1_000_000,
    },
  ),
  createModel(
    'openai',
    'gpt-4.1-nano',
    'GPT-4.1 Nano',
    'Cheapest OpenAI model ($0.10/1M input tokens)',
    {
      maxTokens: 1_000_000,
      contextWindow: 1_000_000,
    },
  ),
  createModel(
    'openai',
    'o4',
    'GPT-o4',
    'Most advanced reasoning model (June 2025)',
    {
      maxTokens: 200_000,
      contextWindow: 1_000_000,
    },
  ),
  createModel(
    'openai',
    'o4-mini',
    'GPT-o4 Mini',
    'Latest efficient reasoning model',
    {
      maxTokens: 131_072,
      contextWindow: 200_000,
    },
  ),
  createModel('openai', 'o3', 'GPT-o3', 'Advanced reasoning model', {
    maxTokens: 131_072,
    contextWindow: 200_000,
  }),
  createModel(
    'openai',
    'gpt-4o',
    'GPT-4o',
    'Multimodal flagship model with vision and audio capabilities',
    {
      maxTokens: 128_000,
      contextWindow: 128_000,
    },
  ),
  createModel(
    'openai',
    'gpt-4o-mini',
    'GPT-4o Mini',
    'Fast and efficient model for everyday tasks',
    {
      maxTokens: 128_000,
      contextWindow: 128_000,
    },
  ),
  createModel(
    'openai',
    'o3-mini',
    'GPT-o3 Mini',
    'Latest reasoning model with enhanced abilities',
    {
      maxTokens: 131_072,
      contextWindow: 200_000,
    },
  ),
  createModel(
    'openai',
    'o1',
    'GPT-o1',
    'Reasoning model for complex problem solving',
    {
      maxTokens: 131_072,
      contextWindow: 200_000,
    },
  ),
  createModel(
    'openai',
    'o1-mini',
    'GPT-o1 Mini',
    'Fast reasoning model for coding and math',
    {
      maxTokens: 65_536,
      contextWindow: 128_000,
    },
  ),

  // Google models - Current as of June 2025
  createModel(
    'google',
    'gemini-2.5-pro-latest',
    'Gemini 2.5 Pro',
    'Latest most capable multimodal model',
    {
      maxTokens: 2_097_152,
      contextWindow: 2_097_152,
    },
  ),
  createModel(
    'google',
    'gemini-2.5-flash-latest',
    'Gemini 2.5 Flash',
    'Latest fast and versatile performance model',
    {
      maxTokens: 1_048_576,
      contextWindow: 1_048_576,
    },
  ),
  createModel(
    'google',
    'gemini-1.5-pro',
    'Gemini 1.5 Pro',
    'Previous generation capable multimodal model',
    {
      maxTokens: 2_097_152,
      contextWindow: 2_097_152,
    },
  ),
  createModel(
    'google',
    'gemini-1.5-flash',
    'Gemini 1.5 Flash',
    'Previous generation fast performance model',
    {
      maxTokens: 1_048_576,
      contextWindow: 1_048_576,
    },
  ),
];

// Enhanced model utility functions
export const getModelById = (id: string): ChatModel | undefined =>
  chatModels.find((model) => model.id === id);

export const getDefaultModel = (): ChatModel =>
  chatModels.find((model) => model.id === DEFAULT_CHAT_MODEL_ID) ||
  chatModels[0];

export const getModelsByProvider = (provider: Provider): ChatModel[] =>
  chatModels.filter((model) => model.provider === provider);

export const getProviderFromModelId = (
  modelId: string,
): Provider | undefined => {
  const model = getModelById(modelId);
  return model?.provider;
};

export const getAllModelIds = (): string[] =>
  chatModels.map((model) => model.id);

// Get reasoning models (o1, o3, o4 series)
export const getReasoningModels = (): ChatModel[] =>
  chatModels.filter(
    (model) =>
      model.id.includes('o1-') ||
      model.id.includes('o3-') ||
      model.id.includes('o4-') ||
      model.id.includes('o1') ||
      model.id.includes('o3') ||
      model.id.includes('o4'),
  );

// Get fastest models by provider
export const getFastestModelByProvider = (
  provider: Provider,
): ChatModel | undefined => {
  const fastModels: Record<Provider, string> = {
    openai: 'openai-gpt-4.1-nano',
    google: 'google-gemini-2.5-flash-latest',
  };

  return getModelById(fastModels[provider]);
};

// Get most capable models by provider
export const getMostCapableModelByProvider = (
  provider: Provider,
): ChatModel | undefined => {
  const capableModels: Record<Provider, string> = {
    openai: 'openai-gpt-4.1',
    google: 'google-gemini-2.5-pro-latest',
  };

  return getModelById(capableModels[provider]);
};

// Check if model supports reasoning
export const isReasoningModel = (modelId: string): boolean => {
  const reasoningPatterns = [
    'o1-',
    'o1.',
    'o3-',
    'o3.',
    'o4-',
    'o4.',
    'reasoning',
  ];
  return reasoningPatterns.some((pattern) =>
    modelId.toLowerCase().includes(pattern),
  );
};

// Get model context window
export const getModelContextWindow = (modelId: string): number => {
  const model = getModelById(modelId);
  return model?.contextWindow || 4096;
};

// Get recommended model for task type
export const getRecommendedModelForTask = (
  taskType: 'reasoning' | 'fast' | 'coding' | 'creative' | 'research',
): ChatModel => {
  const recommendations: Record<string, string> = {
    reasoning: 'openai-o4-mini',
    fast: 'openai-gpt-4.1-nano',
    coding: 'openai-gpt-4.1',
    creative: 'openai-gpt-4.1',
    research: 'google-gemini-2.5-pro-latest',
  };

  return getModelById(recommendations[taskType]) || getDefaultModel();
};
