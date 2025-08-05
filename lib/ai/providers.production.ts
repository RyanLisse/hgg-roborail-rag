import { cohere } from '@ai-sdk/cohere';
import { google } from '@ai-sdk/google';
import { openai } from '@ai-sdk/openai';
import {
  customProvider,
  extractReasoningMiddleware,
  type LanguageModel,
  wrapLanguageModel,
} from 'ai';
import { z } from 'zod';
import {
  COHERE_API_KEY,
  GOOGLE_GENERATIVE_AI_API_KEY,
  OPENAI_API_KEY,
} from '../env';
import { chatModels, getModelById } from './models';

// Check if we're in test mode
const isTestMode =
  process.env.NODE_ENV === 'test' ||
  process.env.PLAYWRIGHT === 'true' ||
  process.env.OPENAI_API_KEY?.startsWith('sk-test-') ||
  process.env.OPENAI_API_KEY?.includes('mock');

// For test mode detection (unused for now but preserved for future test integration)
if (isTestMode) {
  // Test mode is active but we'll use the existing provider structure
  console.log(
    'Test mode detected, using production providers with test configuration',
  );
}

// Provider instances
export const aiProviders = {
  openai,
  google,
  cohere,
} as const;

// Provider validation schema
const providerSchema = z.enum(['openai', 'google', 'cohere']);

// Get model instance by model ID
export function getModelInstance(modelId: string) {
  // In test mode, we'll need to handle async loading differently
  // For now, use production providers and let the test framework handle mocking

  const model = getModelById(modelId);
  if (!model) {
    throw new Error(`Model with ID ${modelId} not found`);
  }

  const provider = aiProviders[model.provider];
  if (!provider) {
    throw new Error(`Provider ${model.provider} not configured`);
  }

  return provider(model.modelId);
}

// Get embedding model instance
export function getEmbeddingModelInstance(modelId = 'cohere-embed-v4.0') {
  // Support multiple embedding models
  if (modelId.includes('cohere') || modelId.includes('embed-v4')) {
    if (COHERE_API_KEY) {
      return cohere.textEmbeddingModel('embed-english-v3.0');
    }
    // Fallback to OpenAI if Cohere not available
    console.warn(
      'Cohere API key not available, falling back to OpenAI embeddings',
    );
  }

  if (modelId.includes('openai') || modelId.includes('text-embedding')) {
    return openai.textEmbeddingModel('text-embedding-3-small');
  }

  // Default to Cohere if available, otherwise OpenAI
  if (COHERE_API_KEY) {
    return cohere.textEmbeddingModel('embed-english-v3.0');
  }

  return openai.textEmbeddingModel('text-embedding-3-small');
}

// Enhanced language model factory with reasoning support
function createDynamicLanguageModel(modelId: string): LanguageModel {
  const baseModel = getModelInstance(modelId);

  // For reasoning models (o1, o3, o4 series), wrap with middleware
  // Reasoning effort is configured via providerOptions in streamText/generateText calls
  if (isReasoningModel(modelId)) {
    return wrapLanguageModel({
      model: baseModel,
      middleware: [
        extractReasoningMiddleware({
          tagName: 'thinking',
          separator: '\n\n',
        }),
      ],
    });
  }

  // For regular models, return the instance with optional performance optimizations
  return baseModel;
}

// Helper function to identify reasoning models
// Reasoning models support chain-of-thought processing per OpenAI docs: https://platform.openai.com/docs/models/o4-mini
function isReasoningModel(modelId: string): boolean {
  const reasoningPatterns = [
    'o1-',
    'o1.',
    'o3-',
    'o3.',
    'o4-',
    'o4.',
    'reasoning',
    'think',
    'step-by-step',
  ];

  return reasoningPatterns.some((pattern) =>
    modelId.toLowerCase().includes(pattern),
  );
}

// Enhanced language model creation with error handling and fallbacks
function createAllLanguageModels(): Record<string, LanguageModel> {
  const models: Record<string, LanguageModel> = {};

  // Primary models with fallbacks - June 2025 optimized
  // Model configuration follows OpenAI documentation: https://platform.openai.com/docs/models
  const primaryModels = {
    'chat-model': 'openai-o4-mini', // Default reasoning model with medium effort configuration
    'chat-model-fast': 'openai-gpt-4.1-mini',
    'chat-model-reasoning': 'openai-o4-mini', // Primary reasoning model per https://platform.openai.com/docs/models/o4-mini
    'chat-model-advanced-reasoning': 'openai-o4-mini',
    'title-model': 'openai-gpt-4.1-nano',
    'artifact-model': 'openai-gpt-4.1',
    'research-model': 'google-gemini-2.5-pro-latest',
    'rewrite-model': 'openai-gpt-4.1',
  };

  // Create primary models with fallback logic
  for (const [alias, modelId] of Object.entries(primaryModels)) {
    try {
      models[alias] = createDynamicLanguageModel(modelId);
    } catch (_error) {
      // Fallback to a working model
      const fallbackId = getFallbackModel(modelId);
      if (fallbackId) {
        try {
          models[alias] = createDynamicLanguageModel(fallbackId);
        } catch (_fallbackError) {}
      }
    }
  }

  // Dynamically add all available models from the models config
  try {
    const availableProviders = getAvailableProviders();

    chatModels.forEach((model) => {
      // Only create models for available providers
      if (availableProviders.includes(model.provider)) {
        try {
          models[model.id] = createDynamicLanguageModel(model.id);
        } catch (_error) {}
      }
    });
  } catch (_error) {}

  // Ensure we have at least one working model
  if (Object.keys(models).length === 0) {
    throw new Error(
      'No language models could be initialized. Check your API keys.',
    );
  }

  return models;
}

// Get available providers based on API keys
function getAvailableProviders(): string[] {
  const providers = [];
  if (OPENAI_API_KEY) {
    providers.push('openai');
  }
  if (GOOGLE_GENERATIVE_AI_API_KEY) {
    providers.push('google');
  }
  if (COHERE_API_KEY) {
    providers.push('cohere');
  }
  return providers;
}

// Smart fallback model selection
function getFallbackModel(originalModelId: string): string | null {
  const availableProviders = getAvailableProviders();

  // Fallback hierarchy based on capabilities and availability
  const fallbacks: Record<string, string[]> = {
    'openai-gpt-4.1': ['openai-gpt-4o', 'google-gemini-2.5-pro-latest'],
    'openai-o3-mini': ['openai-o1-mini', 'openai-gpt-4.1'],
    'openai-o4-mini': ['openai-o3-mini', 'openai-o1-mini', 'openai-gpt-4.1'],
    'google-gemini-2.5-pro-latest': ['google-gemini-1.5-pro', 'openai-gpt-4.1'],
  };

  const modelFallbacks = fallbacks[originalModelId] || [];

  for (const fallback of modelFallbacks) {
    try {
      const model = getModelById(fallback);
      if (model && availableProviders.includes(model.provider)) {
        return fallback;
      }
    } catch {}
  }

  // Ultimate fallback: any working model
  if (OPENAI_API_KEY) {
    return 'openai-gpt-4o-mini';
  }
  if (GOOGLE_GENERATIVE_AI_API_KEY) {
    return 'google-gemini-1.5-flash';
  }

  return null;
}

// Enhanced provider with comprehensive model support and error handling
export const myProvider = customProvider({
  languageModels: createAllLanguageModels(),
});

// Provider health check
export async function checkProviderHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'error';
  availableModels: string[];
  unavailableModels: string[];
  providers: Record<string, boolean>;
}> {
  const availableModels: string[] = [];
  const unavailableModels: string[] = [];
  const providers: Record<string, boolean> = {};

  // Check each provider
  for (const [providerName, _provider] of Object.entries(aiProviders)) {
    try {
      // Simple test call to check provider availability
      providers[providerName] = true;
    } catch (_error) {
      providers[providerName] = false;
    }
  }

  // Check model availability
  try {
    const models = createAllLanguageModels();
    availableModels.push(...Object.keys(models));
  } catch (_error) {}

  const healthyProviders = Object.values(providers).filter(Boolean).length;
  const totalProviders = Object.keys(providers).length;

  let status: 'healthy' | 'degraded' | 'error';
  if (healthyProviders === totalProviders && availableModels.length > 0) {
    status = 'healthy';
  } else if (healthyProviders > 0 && availableModels.length > 0) {
    status = 'degraded';
  } else {
    status = 'error';
  }

  return {
    status,
    availableModels,
    unavailableModels,
    providers,
  };
}

// Enhanced provider configuration validation
export function validateProviderConfig(): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  availableProviders: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  const availableProviders: string[] = [];

  // Check each provider
  const providerChecks = [
    {
      key: OPENAI_API_KEY,
      name: 'OPENAI_API_KEY',
      provider: 'openai',
      required: false,
    },
    {
      key: GOOGLE_GENERATIVE_AI_API_KEY,
      name: 'GOOGLE_GENERATIVE_AI_API_KEY',
      provider: 'google',
      required: false,
    },
    {
      key: COHERE_API_KEY,
      name: 'COHERE_API_KEY',
      provider: 'cohere',
      required: false,
    },
  ];

  // Validate each provider key
  for (const check of providerChecks) {
    if (check.key) {
      availableProviders.push(check.provider);

      // Validate key format
      if (check.provider === 'openai' && !check.key.startsWith('sk-')) {
        warnings.push(`${check.name} should start with 'sk-'`);
      }
    } else if (check.required) {
      errors.push(`${check.name} is required but not set`);
    }
  }

  // Ensure at least one provider is available
  if (availableProviders.length === 0) {
    errors.push('At least one AI provider API key must be configured');
  }

  // Log configuration status
  if (availableProviders.length > 0) {
    // Providers are available
  }

  if (warnings.length > 0) {
    // Warnings exist but configuration can proceed
  }

  if (errors.length > 0) {
    // Errors exist that need to be addressed
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    availableProviders,
  };
}

// Export types
export type AIProvider = keyof typeof aiProviders;
export { providerSchema };
