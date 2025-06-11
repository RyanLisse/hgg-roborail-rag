import { openai } from '@ai-sdk/openai';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { cohere } from '@ai-sdk/cohere';
import { groq } from '@ai-sdk/groq';
import { customProvider, wrapLanguageModel, extractReasoningMiddleware } from 'ai';
import { z } from 'zod';
import { getModelById } from './models';

// Provider instances
export const aiProviders = {
  openai: openai,
  anthropic: anthropic,
  google: google,
  cohere: cohere,
  groq: groq,
} as const;

// Provider validation schema
const providerSchema = z.enum(['openai', 'anthropic', 'google', 'cohere', 'groq']);

// Get model instance by model ID
export function getModelInstance(modelId: string) {
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
export function getEmbeddingModelInstance(modelId: string) {
  // For now, use OpenAI text-embedding-3-small for all embeddings
  return openai.embedding('text-embedding-3-small');
}

// Enhanced provider with middleware support - simplified for production
export const myProvider = customProvider({
  languageModels: {
    'chat-model': getModelInstance('openai-gpt-4.1'),
    'chat-model-reasoning': wrapLanguageModel({
      model: getModelInstance('openai-gpt-4.1'),
      middleware: [extractReasoningMiddleware({ tagName: 'think' })],
    }),
    'title-model': getModelInstance('openai-gpt-4.1'),
    'artifact-model': getModelInstance('openai-gpt-4.1'),
  },
});

// Validate provider configuration
export function validateProviderConfig() {
  const missingKeys = [];
  
  if (!process.env.OPENAI_API_KEY) missingKeys.push('OPENAI_API_KEY');
  if (!process.env.ANTHROPIC_API_KEY) missingKeys.push('ANTHROPIC_API_KEY');
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) missingKeys.push('GOOGLE_GENERATIVE_AI_API_KEY');
  if (!process.env.COHERE_API_KEY) missingKeys.push('COHERE_API_KEY');
  if (!process.env.GROQ_API_KEY) missingKeys.push('GROQ_API_KEY');

  if (missingKeys.length > 0) {
    console.warn(`Missing API keys: ${missingKeys.join(', ')}`);
  }

  return missingKeys.length === 0;
}

// Export types
export type AIProvider = keyof typeof aiProviders;
export { providerSchema };