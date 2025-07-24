import { generateText, streamText, tool } from 'ai';
import { z } from 'zod';
import { getModelInstance } from '../ai/providers';
import { getUnifiedVectorStoreService } from '../vectorstore/unified';
import type {
  Agent,
  AgentCapability,
  AgentRequest,
  AgentResponse,
  AgentType,
} from './types';
import {
  AgentRequest as AgentRequestSchema,
  AgentResponse as AgentResponseSchema,
} from './types';

// Base agent implementation
export abstract class BaseAgent implements Agent {
  public readonly type: AgentType;
  public readonly capability: AgentCapability;

  constructor(type: AgentType, capability: AgentCapability) {
    this.type = type;
    this.capability = capability;
  }

  validateRequest(request: unknown): AgentRequest {
    return AgentRequestSchema.parse(request);
  }

  abstract getSystemPrompt(request: AgentRequest): string;

  protected getTools(request: AgentRequest): Record<string, any> | undefined {
    if (!(this.capability.requiresTools && request.options?.useTools)) {
      return;
    }

    // Enhanced AI SDK tool patterns
    return {
      searchDocuments: tool({
        description: 'Search through uploaded documents and knowledge base',
        parameters: z.object({
          query: z.string().describe('Search query'),
          maxResults: z
            .number()
            .optional()
            .describe('Maximum number of results'),
        }),
        execute: async ({ query, maxResults = 5 }) => {
          try {
            const unifiedService = await getUnifiedVectorStoreService();
            const results = await unifiedService.searchAcrossSources({
              query,
              sources: request.context?.sources || ['openai'],
              maxResults,
              threshold: 0.3,
              optimizePrompts: false,
            });

            return {
              results: results.map((r) => ({
                content: r.document.content.substring(0, 500),
                score: r.similarity,
                metadata: r.document.metadata,
              })),
              totalFound: results.length,
            };
          } catch (error) {
            return {
              error: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            };
          }
        },
      }),

      analyzeComplexity: tool({
        description: 'Analyze the complexity of a query or task',
        parameters: z.object({
          task: z.string().describe('Task or query to analyze'),
        }),
        execute: async ({ task }) => {
          // Simple complexity analysis
          const wordCount = task.split(' ').length;
          const questionCount = (task.match(/\?/g) || []).length;
          const technicalTerms = (
            task.match(
              /\b(algorithm|machine learning|quantum|neural|AI|API|database)\b/gi,
            ) || []
          ).length;

          let complexity: 'simple' | 'moderate' | 'complex' = 'simple';
          if (wordCount > 50 || questionCount > 2 || technicalTerms > 2) {
            complexity = 'complex';
          } else if (
            wordCount > 20 ||
            questionCount > 1 ||
            technicalTerms > 0
          ) {
            complexity = 'moderate';
          }

          return {
            complexity,
            factors: {
              wordCount,
              questionCount,
              technicalTerms,
              requiresMultipleSteps: wordCount > 30,
              requiresExternalData:
                task.includes('current') || task.includes('latest'),
              requiresSynthesis: questionCount > 1 || task.includes('compare'),
            },
            score: Math.min(
              (wordCount + questionCount * 10 + technicalTerms * 5) / 100,
              1,
            ),
          };
        },
      }),
    };
  }

  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now();
    const validatedRequest = this.validateRequest(request);

    try {
      // Get relevant context if sources are specified
      const sources = await this.retrieveContext(validatedRequest);

      // Prepare messages
      const systemPrompt = this.getSystemPrompt(validatedRequest);
      const messages = [
        { role: 'system' as const, content: systemPrompt },
        ...validatedRequest.chatHistory.map((msg) => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
        })),
        { role: 'user' as const, content: validatedRequest.query },
      ];

      // Configure model options
      const modelId =
        validatedRequest.options?.modelId ||
        this.capability.temperature !== undefined
          ? 'anthropic-claude-sonnet-4-20250514'
          : 'openai-gpt-4.1';

      const modelInstance = getModelInstance(modelId);
      const tools = this.getTools(validatedRequest);

      // Generate response
      const { text, usage, response } = await generateText({
        model: modelInstance,
        messages,
        maxTokens:
          validatedRequest.options?.maxTokens ||
          this.capability.maxTokens ||
          1000,
        temperature:
          validatedRequest.options?.temperature ||
          this.capability.temperature ||
          0.1,
        tools,
      });

      const responseTime = Date.now() - startTime;

      return AgentResponseSchema.parse({
        content: text,
        agent: this.type,
        metadata: {
          modelUsed: modelId,
          promptTokens: usage?.promptTokens,
          completionTokens: usage?.completionTokens,
          totalTokens: usage?.totalTokens,
          responseTime,
          sources: sources.map((source) => ({
            id: source.document.id,
            content: `${source.document.content.substring(0, 200)}...`,
            score: source.similarity,
            metadata: source.document.metadata,
          })),
          confidence: this.calculateConfidence(sources, text),
        },
        streamingSupported: this.capability.supportsStreaming,
      });
    } catch (error) {

      return AgentResponseSchema.parse({
        content: this.getErrorMessage(error),
        agent: this.type,
        metadata: {
          modelUsed: validatedRequest.options?.modelId || 'unknown',
          responseTime: Date.now() - startTime,
        },
        streamingSupported: this.capability.supportsStreaming,
        errorDetails: {
          code: 'processing_error',
          message:
            error instanceof Error ? error.message : 'Unknown error occurred',
          retryable: true,
        },
      });
    }
  }

  async *processRequestStream(
    request: AgentRequest,
  ): AsyncGenerator<string, AgentResponse, unknown> {
    if (!this.capability.supportsStreaming) {
      const response = await this.processRequest(request);
      yield response.content;
      return response;
    }

    const startTime = Date.now();
    const validatedRequest = this.validateRequest(request);
    let fullContent = '';

    try {
      // Get relevant context if sources are specified
      const sources = await this.retrieveContext(validatedRequest);

      // Prepare messages
      const systemPrompt = this.getSystemPrompt(validatedRequest);
      const messages = [
        { role: 'system' as const, content: systemPrompt },
        ...validatedRequest.chatHistory.map((msg) => ({
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
        })),
        { role: 'user' as const, content: validatedRequest.query },
      ];

      // Configure model options
      const modelId =
        validatedRequest.options?.modelId ||
        'anthropic-claude-sonnet-4-20250514';
      const modelInstance = getModelInstance(modelId);
      const tools = this.getTools(validatedRequest);

      // Stream response
      const {
        textStream,
        usage: usagePromise,
        response,
      } = await streamText({
        model: modelInstance,
        messages,
        maxTokens:
          validatedRequest.options?.maxTokens ||
          this.capability.maxTokens ||
          1000,
        temperature:
          validatedRequest.options?.temperature ||
          this.capability.temperature ||
          0.1,
        tools,
      });

      for await (const chunk of textStream) {
        fullContent += chunk;
        yield chunk;
      }

      const usage = await usagePromise;
      const responseTime = Date.now() - startTime;

      return AgentResponseSchema.parse({
        content: fullContent,
        agent: this.type,
        metadata: {
          modelUsed: modelId,
          promptTokens: usage?.promptTokens,
          completionTokens: usage?.completionTokens,
          totalTokens: usage?.totalTokens,
          responseTime,
          sources: sources.map((source) => ({
            id: source.document.id,
            content: `${source.document.content.substring(0, 200)}...`,
            score: source.similarity,
            metadata: source.document.metadata,
          })),
          confidence: this.calculateConfidence(sources, fullContent),
        },
        streamingSupported: true,
      });
    } catch (error) {

      const errorMessage = this.getErrorMessage(error);
      yield errorMessage;

      return AgentResponseSchema.parse({
        content: errorMessage,
        agent: this.type,
        metadata: {
          modelUsed: validatedRequest.options?.modelId || 'unknown',
          responseTime: Date.now() - startTime,
        },
        streamingSupported: true,
        errorDetails: {
          code: 'streaming_error',
          message:
            error instanceof Error ? error.message : 'Unknown error occurred',
          retryable: true,
        },
      });
    }
  }

  private async retrieveContext(request: AgentRequest) {
    if (!request.context?.sources?.length) {
      return [];
    }

    try {
      const unifiedService = await getUnifiedVectorStoreService();
      const results = await unifiedService.searchAcrossSources({
        query: request.query,
        sources: request.context.sources,
        maxResults: request.context.maxResults || 5,
        threshold: 0.3,
        optimizePrompts: false,
      });

      return results;
    } catch (_error) {
      return [];
    }
  }

  private calculateConfidence(sources: any[], content: string): number {
    // Simple confidence calculation based on source quality and content length
    const sourceScore =
      sources.length > 0
        ? Math.min(
            sources.reduce((acc, s) => acc + s.similarity, 0) / sources.length,
            1,
          )
        : 0.5;
    const contentScore = Math.min(content.length / 500, 1); // Normalize by expected length
    return sourceScore * 0.6 + contentScore * 0.4;
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return `I encountered an error while processing your request: ${error.message}. Please try again or rephrase your question.`;
    }
    return 'I encountered an unexpected error. Please try again.';
  }
}
