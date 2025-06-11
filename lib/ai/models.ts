export type Provider = 'openai' | 'anthropic' | 'google' | 'cohere' | 'groq';

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

const createModel = (
  provider: Provider,
  modelId: string,
  name: string,
  description: string,
  options: Partial<ChatModel> = {}
): ChatModel => ({
  id: `${provider}-${modelId}`,
  name,
  provider,
  modelId,
  description,
  ...options,
});

export const chatModels: ChatModel[] = [
  // OpenAI models
  createModel('openai', 'gpt-4.1', 'GPT-4.1', 'Most capable model, great for complex tasks', {
    maxTokens: 128000,
    contextWindow: 128000,
  }),
  createModel('openai', 'o4-mini', 'O4 Mini', 'Small but capable model for everyday tasks', {
    maxTokens: 32000,
    contextWindow: 32000,
  }),
  createModel('openai', 'o3-pro', 'O3 Pro', 'Balanced performance for most use cases', {
    maxTokens: 64000,
    contextWindow: 128000,
  }),

  // Anthropic models
  createModel('anthropic', 'claude-4-sonnet', 'Claude 4 Sonnet', 'Balanced performance for most tasks', {
    maxTokens: 200000,
    contextWindow: 200000,
  }),
  createModel('anthropic', 'claude-4-opus', 'Claude 4 Opus', 'Most capable model, excelling at highly complex tasks', {
    maxTokens: 200000,
    contextWindow: 200000,
  }),

  // Google models
  createModel('google', 'gemini-1.5-pro-latest', 'Gemini 1.5 Pro', 'Most capable model for complex tasks', {
    maxTokens: 1048576,
    contextWindow: 1048576,
  }),
  createModel('google', 'gemini-1.5-flash-latest', 'Gemini 1.5 Flash', 'Fast and efficient for most tasks', {
    maxTokens: 1048576,
    contextWindow: 1048576,
  }),

  // Cohere models
  createModel('cohere', 'command-a-03-2025', 'Command A 03/2025', 'Command model for complex tasks', {
    maxTokens: 128000,
    contextWindow: 128000,
  }),
  createModel('cohere', 'command-r-plus', 'Command R+', 'Most capable model with reasoning capabilities', {
    maxTokens: 128000,
    contextWindow: 128000,
  }),

  // Groq models
  createModel('groq', 'mixtral-8x7b-32768', 'Mixtral 8x7B', 'Fast and capable open-weight model', {
    maxTokens: 32768,
    contextWindow: 32768,
  }),
  createModel('groq', 'llama3-70b-8192', 'Llama 3 70B', 'Most capable open-weight model', {
    maxTokens: 8192,
    contextWindow: 8192,
  }),
];

export const getModelById = (id: string): ChatModel | undefined =>
  chatModels.find(model => model.id === id);

export const getDefaultModel = (): ChatModel =>
  chatModels.find(model => model.id === DEFAULT_CHAT_MODEL_ID) || chatModels[0];

export const getModelsByProvider = (provider: Provider): ChatModel[] =>
  chatModels.filter(model => model.provider === provider);

export const getProviderFromModelId = (modelId: string): Provider | undefined => {
  const model = getModelById(modelId);
  return model?.provider;
};
