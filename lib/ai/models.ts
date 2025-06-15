export type Provider =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'cohere'
  | 'groq'
  | 'xai';

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
      maxTokens: 1000000,
      contextWindow: 1000000,
    },
  ),
  createModel(
    'openai',
    'gpt-4.1-mini',
    'GPT-4.1 Mini',
    'Fast and cost-effective latest generation model (5x cheaper)',
    {
      maxTokens: 1000000,
      contextWindow: 1000000,
    },
  ),
  createModel(
    'openai',
    'gpt-4.1-nano',
    'GPT-4.1 Nano',
    'Cheapest OpenAI model ($0.10/1M input tokens)',
    {
      maxTokens: 1000000,
      contextWindow: 1000000,
    },
  ),
  createModel(
    'openai',
    'o4',
    'GPT-o4',
    'Most advanced reasoning model (June 2025)',
    {
      maxTokens: 200000,
      contextWindow: 1000000,
    },
  ),
  createModel(
    'openai',
    'o4-mini',
    'GPT-o4 Mini',
    'Latest efficient reasoning model',
    {
      maxTokens: 131072,
      contextWindow: 200000,
    },
  ),
  createModel('openai', 'o3', 'GPT-o3', 'Advanced reasoning model', {
    maxTokens: 131072,
    contextWindow: 200000,
  }),
  createModel(
    'openai',
    'gpt-4o',
    'GPT-4o',
    'Multimodal flagship model with vision and audio capabilities',
    {
      maxTokens: 128000,
      contextWindow: 128000,
    },
  ),
  createModel(
    'openai',
    'gpt-4o-mini',
    'GPT-4o Mini',
    'Fast and efficient model for everyday tasks',
    {
      maxTokens: 128000,
      contextWindow: 128000,
    },
  ),
  createModel(
    'openai',
    'o3-mini',
    'GPT-o3 Mini',
    'Latest reasoning model with enhanced abilities',
    {
      maxTokens: 131072,
      contextWindow: 200000,
    },
  ),
  createModel(
    'openai',
    'o1',
    'GPT-o1',
    'Reasoning model for complex problem solving',
    {
      maxTokens: 131072,
      contextWindow: 200000,
    },
  ),
  createModel(
    'openai',
    'o1-mini',
    'GPT-o1 Mini',
    'Fast reasoning model for coding and math',
    {
      maxTokens: 65536,
      contextWindow: 128000,
    },
  ),

  // Anthropic models - Current as of June 2025
  createModel(
    'anthropic',
    'claude-opus-4-20250514',
    'Claude 4 Opus',
    'Most powerful Claude model for highly complex tasks',
    {
      maxTokens: 200000,
      contextWindow: 200000,
    },
  ),
  createModel(
    'anthropic',
    'claude-sonnet-4-20250514',
    'Claude 4 Sonnet',
    'Latest flagship model with excellent performance',
    {
      maxTokens: 200000,
      contextWindow: 200000,
    },
  ),
  createModel(
    'anthropic',
    'claude-3-7-sonnet-20250219',
    'Claude 3.7 Sonnet',
    'Enhanced version of Claude 3.5 Sonnet',
    {
      maxTokens: 200000,
      contextWindow: 200000,
    },
  ),
  createModel(
    'anthropic',
    'claude-3-5-sonnet-20241022',
    'Claude 3.5 Sonnet',
    'Most capable Claude 3.5 model for complex tasks',
    {
      maxTokens: 200000,
      contextWindow: 200000,
    },
  ),
  createModel(
    'anthropic',
    'claude-3-5-haiku-20241022',
    'Claude 3.5 Haiku',
    'Fast and cost-effective Claude 3.5 model',
    {
      maxTokens: 200000,
      contextWindow: 200000,
    },
  ),
  createModel(
    'anthropic',
    'claude-3-opus-20240229',
    'Claude 3 Opus',
    'Most powerful Claude 3 model for highly complex tasks',
    {
      maxTokens: 200000,
      contextWindow: 200000,
    },
  ),

  // Google models - Current as of June 2025
  createModel(
    'google',
    'gemini-2.5-pro-latest',
    'Gemini 2.5 Pro',
    'Latest most capable multimodal model',
    {
      maxTokens: 2097152,
      contextWindow: 2097152,
    },
  ),
  createModel(
    'google',
    'gemini-2.5-flash-latest',
    'Gemini 2.5 Flash',
    'Latest fast and versatile performance model',
    {
      maxTokens: 1048576,
      contextWindow: 1048576,
    },
  ),
  createModel(
    'google',
    'gemini-1.5-pro',
    'Gemini 1.5 Pro',
    'Previous generation capable multimodal model',
    {
      maxTokens: 2097152,
      contextWindow: 2097152,
    },
  ),
  createModel(
    'google',
    'gemini-1.5-flash',
    'Gemini 1.5 Flash',
    'Previous generation fast performance model',
    {
      maxTokens: 1048576,
      contextWindow: 1048576,
    },
  ),

  // Cohere models - Current as of June 2025
  createModel(
    'cohere',
    'command-r-plus',
    'Command R+',
    'Most capable model for RAG and tool use',
    {
      maxTokens: 128000,
      contextWindow: 128000,
    },
  ),
  createModel(
    'cohere',
    'command-r',
    'Command R',
    'Optimized for RAG and conversations',
    {
      maxTokens: 128000,
      contextWindow: 128000,
    },
  ),
  createModel(
    'cohere',
    'command',
    'Command',
    'Versatile text generation model',
    {
      maxTokens: 4096,
      contextWindow: 4096,
    },
  ),

  // Groq models - Current as of June 2025
  createModel(
    'groq',
    'llama-3.1-405b-reasoning',
    'Llama 3.1 405B',
    'Largest open-source reasoning model',
    {
      maxTokens: 131072,
      contextWindow: 131072,
    },
  ),
  createModel(
    'groq',
    'llama-3.1-70b-versatile',
    'Llama 3.1 70B',
    'High-performance open-source model',
    {
      maxTokens: 131072,
      contextWindow: 131072,
    },
  ),
  createModel(
    'groq',
    'llama-3.1-8b-instant',
    'Llama 3.1 8B',
    'Fast and efficient model',
    {
      maxTokens: 131072,
      contextWindow: 131072,
    },
  ),
  createModel(
    'groq',
    'mixtral-8x7b-32768',
    'Mixtral 8x7B',
    'Mixture of experts model',
    {
      maxTokens: 32768,
      contextWindow: 32768,
    },
  ),

  // xAI models - Current as of June 2025
  createModel(
    'xai',
    'grok-3',
    'Grok-3',
    'Flagship model with enhanced reasoning ($3/1M input, $15/1M output tokens)',
    {
      maxTokens: 131072,
      contextWindow: 131072,
    },
  ),
  createModel(
    'xai',
    'grok-3-mini',
    'Grok-3 Mini',
    'Smaller, faster version ($0.30/1M input, $0.50/1M output)',
    {
      maxTokens: 131072,
      contextWindow: 131072,
    },
  ),
  createModel(
    'xai',
    'grok-4-beta',
    'Grok-4 Beta',
    'Next-generation beta model with advanced capabilities',
    {
      maxTokens: 200000,
      contextWindow: 200000,
    },
  ),
  createModel(
    'xai',
    'grok-beta',
    'Grok Beta',
    'Currently available model (131K token context)',
    {
      maxTokens: 131072,
      contextWindow: 131072,
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
    anthropic: 'anthropic-claude-3-5-haiku-20241022',
    google: 'google-gemini-2.5-flash-latest',
    cohere: 'cohere-command',
    groq: 'groq-llama-3.1-8b-instant',
    xai: 'xai-grok-3-mini',
  };

  return getModelById(fastModels[provider]);
};

// Get most capable models by provider
export const getMostCapableModelByProvider = (
  provider: Provider,
): ChatModel | undefined => {
  const capableModels: Record<Provider, string> = {
    openai: 'openai-gpt-4.1',
    anthropic: 'anthropic-claude-opus-4-20250514',
    google: 'google-gemini-2.5-pro-latest',
    cohere: 'cohere-command-r-plus',
    groq: 'groq-llama-3.1-405b-reasoning',
    xai: 'xai-grok-3',
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
    coding: 'anthropic-claude-sonnet-4-20250514',
    creative: 'anthropic-claude-opus-4-20250514',
    research: 'google-gemini-2.5-pro-latest',
  };

  return getModelById(recommendations[taskType]) || getDefaultModel();
};
