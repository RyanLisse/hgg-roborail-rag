import { openai, createOpenAI } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { cohere } from '@ai-sdk/cohere';
import { groq } from '@ai-sdk/groq';
import { customProvider, wrapLanguageModel, extractReasoningMiddleware } from 'ai';
import { z } from 'zod';
import { getModelById } from './models';
import { 
  OPENAI_API_KEY,
  ANTHROPIC_API_KEY, 
  GOOGLE_GENERATIVE_AI_API_KEY,
  COHERE_API_KEY,
  GROQ_API_KEY,
  XAI_API_KEY
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
const providerSchema = z.enum(['openai', 'anthropic', 'google', 'cohere', 'groq', 'xai']);

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

// Dynamic language model function
function createDynamicLanguageModel(modelId: string) {
  // For reasoning models, wrap with middleware
  if (modelId.includes('o1-') || modelId.includes('o3-')) {
    return wrapLanguageModel({
      model: getModelInstance(modelId),
      middleware: [extractReasoningMiddleware({ tagName: 'think' })],
    });
  }
  
  // For regular models, return the instance
  return getModelInstance(modelId);
}

// Create all language models dynamically
function createAllLanguageModels() {
  const models: Record<string, any> = {
    // Static models for backward compatibility - Current models
    'chat-model': getModelInstance('openai-gpt-4.1'),
    'chat-model-reasoning': wrapLanguageModel({
      model: getModelInstance('openai-o3-mini'),
      middleware: [extractReasoningMiddleware({ tagName: 'think' })],
    }),
    'title-model': getModelInstance('openai-gpt-4.1-mini'),
    'artifact-model': getModelInstance('anthropic-claude-sonnet-4-20250514'),
  };

  // Add all available models from the models config
  try {
    const { chatModels } = require('./models');
    chatModels.forEach((model: any) => {
      try {
        models[model.id] = createDynamicLanguageModel(model.id);
      } catch (error) {
        console.error(`Failed to create model ${model.id}:`, error);
        // Skip this model but don't fail the entire initialization
      }
    });
  } catch (error) {
    console.error('Failed to load chat models:', error);
    // Continue with just the static models
  }

  return models;
}

// Enhanced provider with middleware support - simplified for production
export const myProvider = customProvider({
  languageModels: createAllLanguageModels(),
});

// Validate provider configuration
export function validateProviderConfig() {
  // Using imported variables directly instead of destructuring env

  const missingKeys = [];
  
  if (!OPENAI_API_KEY) missingKeys.push('OPENAI_API_KEY');
  if (!ANTHROPIC_API_KEY) missingKeys.push('ANTHROPIC_API_KEY');
  if (!GOOGLE_GENERATIVE_AI_API_KEY) missingKeys.push('GOOGLE_GENERATIVE_AI_API_KEY');
  if (!COHERE_API_KEY) missingKeys.push('COHERE_API_KEY');
  if (!GROQ_API_KEY) missingKeys.push('GROQ_API_KEY');
  if (!XAI_API_KEY) missingKeys.push('XAI_API_KEY');

  if (missingKeys.length > 0) {
    console.warn(`Missing API keys: ${missingKeys.join(', ')}`);
  }

  return missingKeys.length === 0;
}

// Export types
export type AIProvider = keyof typeof aiProviders;
export { providerSchema };