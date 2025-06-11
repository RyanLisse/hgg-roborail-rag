import { describe, it, expect, } from 'vitest';
import { z } from 'zod';
import { aiProviders, getModelInstance } from './providers';
import { chatModels } from './models';

describe('AI Providers', () => {
  describe('aiProviders', () => {
    it('should contain all expected providers', () => {
      const expectedProviders = ['openai', 'anthropic', 'google', 'cohere', 'groq'];
      expectedProviders.forEach(provider => {
        expect(aiProviders).toHaveProperty(provider);
        expect(aiProviders[provider]).toBeDefined();
      });
    });

    it('should have valid model configurations for each provider', () => {
      const modelSchema = z.object({
        id: z.string(),
        name: z.string(),
        provider: z.enum(['openai', 'anthropic', 'google', 'cohere', 'groq']),
        modelId: z.string(),
        description: z.string(),
        maxTokens: z.number().optional(),
        contextWindow: z.number().optional(),
      });

      chatModels.forEach(model => {
        expect(() => modelSchema.parse(model)).not.toThrow();
      });
    });
  });

  describe('getModelInstance', () => {
    it('should throw error for invalid model ID', () => {
      expect(() => getModelInstance('invalid-model-id')).toThrow('Model with ID invalid-model-id not found');
    });

    it('should find valid models in the models list', () => {
      // Test that models exist and have the right structure
      const openAIModel = chatModels.find(m => m.id === 'openai-gpt-4.1');
      expect(openAIModel).toBeDefined();
      expect(openAIModel?.provider).toBe('openai');
      
      const anthropicModel = chatModels.find(m => m.id === 'anthropic-claude-4-sonnet');
      expect(anthropicModel).toBeDefined();
      expect(anthropicModel?.provider).toBe('anthropic');
    });

    it('should validate provider exists for model', () => {
      const model = chatModels.find(m => m.id === 'openai-gpt-4.1');
      expect(model).toBeDefined();
      expect(aiProviders[model?.provider]).toBeDefined();
    });
  });
});