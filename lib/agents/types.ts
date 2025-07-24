import { z } from 'zod';

// Base agent types
export const AgentType = z.enum(['qa', 'rewrite', 'planner', 'research']);

export const AgentCapability = z.object({
  name: z.string(),
  description: z.string(),
  supportsStreaming: z.boolean().default(true),
  requiresTools: z.boolean().default(false),
  maxTokens: z.number().optional(),
  temperature: z.number().min(0).max(2).default(0.1),
});

export const AgentRequest = z.object({
  query: z.string().min(1),
  chatHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string(),
      }),
    )
    .default([]),
  context: z
    .object({
      userIntent: z.string().optional(),
      complexity: z.enum(['simple', 'moderate', 'complex']).default('moderate'),
      domainKeywords: z.array(z.string()).default([]),
      sources: z
        .array(z.enum(['openai', 'neon', 'memory']))
        .default(['openai']),
      requiresCitations: z.boolean().default(false),
      maxResults: z.number().min(1).max(20).default(5),
    })
    .optional(),
  options: z
    .object({
      modelId: z.string().default('anthropic-claude-sonnet-4-20250514'),
      streaming: z.boolean().default(true),
      maxTokens: z.number().optional(),
      temperature: z.number().min(0).max(2).optional(),
      useTools: z.boolean().default(true),
    })
    .optional(),
});

export const AgentResponse = z.object({
  content: z.string(),
  agent: AgentType,
  metadata: z.object({
    modelUsed: z.string(),
    promptTokens: z.number().optional(),
    completionTokens: z.number().optional(),
    totalTokens: z.number().optional(),
    responseTime: z.number().optional(),
    sources: z
      .array(
        z.object({
          id: z.string(),
          content: z.string(),
          score: z.number(),
          metadata: z.record(z.any()).optional(),
        }),
      )
      .optional(),
    citations: z.array(z.string()).optional(),
    subQuestions: z.array(z.string()).optional(),
    confidence: z.number().min(0).max(1).optional(),
    orchestrationTime: z.number().optional(),
    routingDecision: z
      .object({
        selectedAgent: AgentType,
        confidence: z.number(),
        reasoning: z.string(),
      })
      .optional(),
  }),
  streamingSupported: z.boolean(),
  errorDetails: z
    .object({
      code: z.string(),
      message: z.string(),
      retryable: z.boolean(),
    })
    .optional(),
});

export const AgentRoutingDecision = z.object({
  selectedAgent: AgentType,
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  fallbackAgent: AgentType.optional(),
  suggestedSources: z
    .array(z.enum(['openai', 'neon', 'memory']))
    .default(['openai']),
  estimatedComplexity: z.enum(['simple', 'moderate', 'complex']),
});

export const AgentConfig = z.object({
  defaultModel: z.string().default('anthropic-claude-sonnet-4-20250514'),
  fallbackModel: z.string().default('openai-gpt-4.1-mini'),
  timeout: z.number().default(30_000),
  maxRetries: z.number().default(2),
  enableTelemetry: z.boolean().default(true),
  vectorStoreConfig: z
    .object({
      defaultSources: z
        .array(z.enum(['openai', 'neon', 'memory']))
        .default(['openai']),
      searchThreshold: z.number().min(0).max(1).default(0.3),
      maxResults: z.number().min(1).max(50).default(10),
    })
    .default({
      defaultSources: ['openai'],
      searchThreshold: 0.3,
      maxResults: 10,
    }),
});

// Intent classification types
export const UserIntent = z.enum([
  'question_answering',
  'summarization',
  'rewriting',
  'planning',
  'research',
  'comparison',
  'analysis',
  'general_chat',
]);

export const QueryComplexity = z.object({
  level: z.enum(['simple', 'moderate', 'complex']),
  factors: z.object({
    wordCount: z.number(),
    questionCount: z.number(),
    technicalTerms: z.number(),
    requiresMultipleSteps: z.boolean(),
    requiresExternalData: z.boolean(),
    requiresSynthesis: z.boolean(),
  }),
  score: z.number().min(0).max(1),
});

// Export types
export type AgentType = z.infer<typeof AgentType>;
export type AgentCapability = z.infer<typeof AgentCapability>;
export type AgentRequest = z.infer<typeof AgentRequest>;
export type AgentResponse = z.infer<typeof AgentResponse>;
export type AgentRoutingDecision = z.infer<typeof AgentRoutingDecision>;
export type AgentConfig = z.infer<typeof AgentConfig>;
export type UserIntent = z.infer<typeof UserIntent>;
export type QueryComplexity = z.infer<typeof QueryComplexity>;

// Agent interface
export interface Agent {
  type: AgentType;
  capability: AgentCapability;
  processRequest(request: AgentRequest): Promise<AgentResponse>;
  processRequestStream?(
    request: AgentRequest,
  ): AsyncGenerator<string, AgentResponse, unknown>;
  validateRequest(request: unknown): AgentRequest;
}

// Router interface
export interface AgentRouter {
  routeQuery(
    query: string,
    context?: AgentRequest['context'],
  ): Promise<AgentRoutingDecision>;
  classifyIntent(query: string): Promise<UserIntent>;
  analyzeComplexity(query: string): Promise<QueryComplexity>;
  selectAgent(
    intent: UserIntent,
    complexity: QueryComplexity,
    availableSources: z.infer<typeof VectorStoreType>[],
  ): AgentType;
}

// Vector store type definition
export const VectorStoreType = z.enum(['openai', 'neon', 'memory']);
export type VectorStoreType = z.infer<typeof VectorStoreType>;
