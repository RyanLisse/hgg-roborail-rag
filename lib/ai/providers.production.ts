import { openai, createOpenAI } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { cohere } from '@ai-sdk/cohere';
import { groq } from '@ai-sdk/groq';
import {
  customProvider,
  wrapLanguageModel,
  extractReasoningMiddleware,
  type LanguageModel,
} from 'ai';
import { z } from 'zod';
import { getModelById } from './models';
import {
  OPENAI_API_KEY,
  ANTHROPIC_API_KEY,
  GOOGLE_GENERATIVE_AI_API_KEY,
  COHERE_API_KEY,
  GROQ_API_KEY,
  XAI_API_KEY,
} from '../env';

// xAI provider (using OpenAI SDK with custom base URL)
const xai = createOpenAI({
  baseURL: 'https://api.x.ai/v1',
  apiKey: XAI_API_KEY ?? '',
});

// Provider instances
export const aiProviders = {
  openai: openai,
  anthropic: anthropic,
  google: google,
  cohere: cohere,
  groq: groq,
  xai: xai,
} as const;

// Provider validation schema
const providerSchema = z.enum([
  'openai',
  'anthropic',
  'google',
  'cohere',
  'groq',
  'xai',
]);

// Get model instance by model ID
export function getModelInstance(modelId: string) {
  try {
    const model = getModelById(modelId);
    if (!model) {
      throw new Error(`Model with ID ${modelId} not found`);
    }

    const provider = aiProviders[model.provider];
    if (!provider) {
      throw new Error(`Provider ${model.provider} not configured`);
    }

    return provider(model.modelId);
  } catch (error) {
    console.error(`Failed to get model instance for ${modelId}:`, error);
    throw error;
  }
}

// Get embedding model instance
export function getEmbeddingModelInstance(modelId: string) {
  // For now, use OpenAI text-embedding-3-small for all embeddings
  return openai.embedding('text-embedding-3-small');
}

// Enhanced language model factory with reasoning support
function createDynamicLanguageModel(modelId: string): LanguageModel {
  const baseModel = getModelInstance(modelId);

  // For reasoning models (o1, o3, o4 series), wrap with middleware
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
  const primaryModels = {
    'chat-model': 'openai-gpt-4.1',
    'chat-model-fast': 'openai-gpt-4.1-mini',
    'chat-model-reasoning': 'openai-o3-mini',
    'chat-model-advanced-reasoning': 'openai-o4-mini',
    'title-model': 'openai-gpt-4.1-nano',
    'artifact-model': 'anthropic-claude-sonnet-4-20250514',
    'research-model': 'google-gemini-2.5-pro-latest',
    'rewrite-model': 'anthropic-claude-3-7-sonnet-20250219',
  };

  // Create primary models with fallback logic
  for (const [alias, modelId] of Object.entries(primaryModels)) {
    try {
      models[alias] = createDynamicLanguageModel(modelId);
    } catch (error) {
      console.warn(
        `Failed to create primary model ${modelId}, trying fallback:`,
        error,
      );

      // Fallback to a working model
      const fallbackId = getFallbackModel(modelId);
      if (fallbackId) {
        try {
          models[alias] = createDynamicLanguageModel(fallbackId);
          console.log(`Using fallback model ${fallbackId} for ${alias}`);
        } catch (fallbackError) {
          console.error(`Fallback also failed for ${alias}:`, fallbackError);
        }
      }
    }
  }

  // Dynamically add all available models from the models config
  try {
    const { chatModels } = require('./models');
    const availableProviders = getAvailableProviders();

    chatModels.forEach((model: any) => {
      // Only create models for available providers
      if (availableProviders.includes(model.provider)) {
        try {
          models[model.id] = createDynamicLanguageModel(model.id);
        } catch (error) {
          console.warn(`Skipping unavailable model ${model.id}:`, error);
        }
      }
    });
  } catch (error) {
    console.error('Failed to load chat models configuration:', error);
  }

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
  if (OPENAI_API_KEY) providers.push('openai');
  if (ANTHROPIC_API_KEY) providers.push('anthropic');
  if (GOOGLE_GENERATIVE_AI_API_KEY) providers.push('google');
  if (COHERE_API_KEY) providers.push('cohere');
  if (GROQ_API_KEY) providers.push('groq');
  if (XAI_API_KEY) providers.push('xai');
  return providers;
}

// Smart fallback model selection
function getFallbackModel(originalModelId: string): string | null {
  const availableProviders = getAvailableProviders();

  // Fallback hierarchy based on capabilities and availability
  const fallbacks: Record<string, string[]> = {
    'openai-gpt-4.1': [
      'openai-gpt-4o',
      'anthropic-claude-sonnet-4-20250514',
      'google-gemini-2.5-pro-latest',
    ],
    'openai-o3-mini': [
      'openai-o1-mini',
      'openai-gpt-4.1',
      'anthropic-claude-sonnet-4-20250514',
    ],
    'openai-o4-mini': ['openai-o3-mini', 'openai-o1-mini', 'openai-gpt-4.1'],
    'anthropic-claude-sonnet-4-20250514': [
      'anthropic-claude-3-7-sonnet-20250219',
      'openai-gpt-4.1',
      'google-gemini-2.5-pro-latest',
    ],
    'google-gemini-2.5-pro-latest': [
      'google-gemini-1.5-pro',
      'openai-gpt-4.1',
      'anthropic-claude-sonnet-4-20250514',
    ],
  };

  const modelFallbacks = fallbacks[originalModelId] || [];

  for (const fallback of modelFallbacks) {
    try {
      const model = getModelById(fallback);
      if (model && availableProviders.includes(model.provider)) {
        return fallback;
      }
    } catch {
      continue;
    }
  }

  // Ultimate fallback: any working model
  if (OPENAI_API_KEY) return 'openai-gpt-4o-mini';
  if (ANTHROPIC_API_KEY) return 'anthropic-claude-3-5-haiku-20241022';
  if (GOOGLE_GENERATIVE_AI_API_KEY) return 'google-gemini-1.5-flash';

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
  for (const [providerName, provider] of Object.entries(aiProviders)) {
    try {
      // Simple test call to check provider availability
      providers[providerName] = true;
    } catch (error) {
      providers[providerName] = false;
      console.warn(`Provider ${providerName} is unavailable:`, error);
    }
  }

  // Check model availability
  try {
    const models = createAllLanguageModels();
    availableModels.push(...Object.keys(models));
  } catch (error) {
    console.error('Failed to check model availability:', error);
  }

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
      key: ANTHROPIC_API_KEY,
      name: 'ANTHROPIC_API_KEY',
      provider: 'anthropic',
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
    {
      key: GROQ_API_KEY,
      name: 'GROQ_API_KEY',
      provider: 'groq',
      required: false,
    },
    { key: XAI_API_KEY, name: 'XAI_API_KEY', provider: 'xai', required: false },
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
    console.log(`✅ Available AI providers: ${availableProviders.join(', ')}`);
  }

  if (warnings.length > 0) {
    console.warn('⚠️  Provider configuration warnings:', warnings);
  }

  if (errors.length > 0) {
    console.error('❌ Provider configuration errors:', errors);
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
