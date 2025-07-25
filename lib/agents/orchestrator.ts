import { checkProviderHealth, validateProviderConfig } from '../ai/providers';
import { PlannerAgent } from './planner-agent';
import { QAAgent } from './qa-agent';
import { ResearchAgent } from './research-agent';
import { RewriteAgent } from './rewrite-agent';
import { SmartAgentRouter } from './router';
import type {
  Agent,
  AgentConfig,
  AgentRequest,
  AgentResponse,
  AgentType,
} from './types';
import {
  AgentConfig as AgentConfigSchema,
  AgentRequest as AgentRequestSchema,
} from './types';

/**
 * Multi-Agent Orchestration System
 *
 * Intelligently routes queries to specialized agents and handles:
 * - Agent selection and routing
 * - Error handling and fallbacks
 * - Request validation and configuration
 * - Response aggregation and streaming
 */
export class AgentOrchestrator {
  private agents: Map<AgentType, Agent> = new Map();
  private router: SmartAgentRouter;
  private config: AgentConfig;

  constructor(config?: Partial<AgentConfig>) {
    this.config = AgentConfigSchema.parse(config || {});
    this.router = new SmartAgentRouter();

    // Initialize all agents
    this.initializeAgents();
  }

  private initializeAgents(): void {
    this.agents.set('qa', new QAAgent());
    this.agents.set('rewrite', new RewriteAgent());
    this.agents.set('planner', new PlannerAgent());
    this.agents.set('research', new ResearchAgent());
  }

  /**
   * Process a request through the appropriate agent
   */
  async processRequest(request: AgentRequest): Promise<AgentResponse> {
    const startTime = Date.now();

    try {
      // Validate request
      const validatedRequest = AgentRequestSchema.parse(request);

      // Route to appropriate agent
      const routingDecision = await this.router.routeQuery(
        validatedRequest.query,
        validatedRequest.context,
      );

      // Enhance request with routing insights
      const enhancedRequest: AgentRequest = {
        ...validatedRequest,
        context: {
          maxResults: validatedRequest.context?.maxResults || 10,
          sources: routingDecision.suggestedSources,
          complexity: routingDecision.estimatedComplexity,
          domainKeywords: validatedRequest.context?.domainKeywords || [],
          requiresCitations:
            validatedRequest.context?.requiresCitations ?? true,
          userIntent: validatedRequest.context?.userIntent,
        },
        options: {
          ...validatedRequest.options,
          modelId:
            validatedRequest.options?.modelId || this.config.defaultModel,
          streaming: validatedRequest.options?.streaming ?? false,
          useTools: validatedRequest.options?.useTools ?? false,
        },
      };

      // Execute with selected agent
      let response = await this.executeWithAgent(
        routingDecision.selectedAgent,
        enhancedRequest,
      );

      // Try fallback if primary agent failed and we have a fallback
      if (response.errorDetails && routingDecision.fallbackAgent) {
        const fallbackResponse = await this.executeWithAgent(
          routingDecision.fallbackAgent,
          enhancedRequest,
        );

        // Use fallback response if it succeeded
        if (!fallbackResponse.errorDetails) {
          response = fallbackResponse;
        }
      }

      // Add orchestration metadata
      response.metadata = {
        ...response.metadata,
        orchestrationTime: Date.now() - startTime,
        routingDecision: {
          selectedAgent: routingDecision.selectedAgent,
          confidence: routingDecision.confidence,
          reasoning: routingDecision.reasoning,
        },
      };

      return response;
    } catch (error) {
      // Return error response
      return {
        content:
          'I encountered an error processing your request. Please try again.',
        agent: 'qa', // Default to QA for error responses
        metadata: {
          modelUsed: 'unknown',
          responseTime: Date.now() - startTime,
        },
        streamingSupported: false,
        errorDetails: {
          code: 'orchestration_error',
          message: error instanceof Error ? error.message : 'Unknown error',
          retryable: true,
        },
      };
    }
  }

  /**
   * Process a request with streaming support
   */
  async *processRequestStream(
    request: AgentRequest,
  ): AsyncGenerator<string, AgentResponse, unknown> {
    try {
      // Validate request
      const validatedRequest = AgentRequestSchema.parse(request);

      // Route to appropriate agent
      const routingDecision = await this.router.routeQuery(
        validatedRequest.query,
        validatedRequest.context,
      );

      // Check if agent supports streaming
      const agent = this.agents.get(routingDecision.selectedAgent);
      if (
        !(agent?.capability.supportsStreaming && agent.processRequestStream)
      ) {
        // Fall back to non-streaming
        const response = await this.processRequest(validatedRequest);
        yield response.content;
        return response;
      }

      // Enhance request with routing insights
      const enhancedRequest: AgentRequest = {
        ...validatedRequest,
        context: {
          ...validatedRequest.context,
          maxResults: validatedRequest.context?.maxResults || 10,
          sources: routingDecision.suggestedSources,
          complexity: routingDecision.estimatedComplexity,
          domainKeywords: validatedRequest.context?.domainKeywords || [],
          requiresCitations:
            validatedRequest.context?.requiresCitations ?? true,
          userIntent: validatedRequest.context?.userIntent,
        },
        options: {
          ...validatedRequest.options,
          modelId:
            validatedRequest.options?.modelId || this.config.defaultModel,
          streaming: true,
          useTools: validatedRequest.options?.useTools ?? false,
        },
      };

      // Stream from selected agent
      const streamGenerator = agent.processRequestStream(enhancedRequest);
      let finalResponse: AgentResponse | undefined;

      try {
        for await (const chunk of streamGenerator) {
          if (typeof chunk === 'string') {
            yield chunk;
          } else {
            finalResponse = chunk;
          }
        }
      } catch (streamError) {
        // If streaming fails and we have a fallback, try it
        if (routingDecision.fallbackAgent) {
          const fallbackAgent = this.agents.get(routingDecision.fallbackAgent);
          if (fallbackAgent) {
            const fallbackResponse =
              await fallbackAgent.processRequest(enhancedRequest);
            yield fallbackResponse.content;
            return fallbackResponse;
          }
        }
        throw streamError;
      }

      return (
        finalResponse || {
          content: '',
          agent: routingDecision.selectedAgent,
          metadata: { modelUsed: 'unknown' },
          streamingSupported: true,
        }
      );
    } catch (error) {
      const errorMessage =
        'I encountered an error processing your request. Please try again.';
      yield errorMessage;

      return {
        content: errorMessage,
        agent: 'qa',
        metadata: { modelUsed: 'unknown' },
        streamingSupported: false,
        errorDetails: {
          code: 'streaming_error',
          message: error instanceof Error ? error.message : 'Unknown error',
          retryable: true,
        },
      };
    }
  }

  /**
   * Execute request with a specific agent with retries
   */
  private async executeWithAgent(
    agentType: AgentType,
    request: AgentRequest,
  ): Promise<AgentResponse> {
    const agent = this.agents.get(agentType);

    if (!agent) {
      throw new Error(`Agent ${agentType} not found`);
    }

    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const response = await Promise.race([
          agent.processRequest(request),
          new Promise<AgentResponse>((_, reject) =>
            setTimeout(
              () => reject(new Error('Agent timeout')),
              this.config.timeout,
            ),
          ),
        ]);

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');

        // Don't retry on the last attempt
        if (attempt < this.config.maxRetries - 1) {
          // Exponential backoff
          await new Promise((resolve) =>
            setTimeout(resolve, Math.pow(2, attempt) * 1000),
          );
        }
      }
    }

    // All retries failed
    throw (
      lastError ||
      new Error(
        `Agent ${agentType} failed after ${this.config.maxRetries} attempts`,
      )
    );
  }

  /**
   * Get agent capabilities
   */
  getAgentCapabilities(): Record<AgentType, any> {
    const capabilities: Record<string, any> = {};

    for (const [type, agent] of Array.from(this.agents.entries())) {
      capabilities[type] = {
        ...agent.capability,
        available: true,
      };
    }

    return capabilities;
  }

  /**
   * Enhanced system health check with provider validation
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    agents: Record<
      AgentType,
      { status: 'available' | 'error'; lastChecked: string; error?: string }
    >;
    providers: {
      status: 'healthy' | 'degraded' | 'error';
      details: any;
    };
    performance: {
      averageResponseTime: number;
      totalTests: number;
      successRate: number;
    };
  }> {
    const _startTime = Date.now();
    const agentStatuses: Record<
      string,
      { status: 'available' | 'error'; lastChecked: string; error?: string }
    > = {};
    let healthyCount = 0;
    const responseTimes: number[] = [];

    // Check provider health first
    const providerValidation = validateProviderConfig();
    let providerHealth: any;
    try {
      providerHealth = await checkProviderHealth();
    } catch (error) {
      providerHealth = {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Test each agent with appropriate models
    const testQueries = [
      { query: 'Hello', expected: 'greeting' },
      { query: 'What is 2+2?', expected: 'math' },
      { query: 'Rewrite: "hi there"', expected: 'rewrite' },
    ];

    for (const [type, agent] of Array.from(this.agents.entries())) {
      const agentStartTime = Date.now();

      try {
        // Use different test queries for different agents
        const testQuery =
          testQueries[Math.floor(Math.random() * testQueries.length)];

        const testRequest: AgentRequest = {
          query: testQuery.query,
          chatHistory: [],
          options: {
            modelId: this.config.fallbackModel,
            streaming: false,
            useTools: false,
          },
        };

        const response = await Promise.race([
          agent.processRequest(testRequest),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), 5000),
          ),
        ]);

        const responseTime = Date.now() - agentStartTime;
        responseTimes.push(responseTime);

        // Validate response quality
        if (!response.content || response.content.length < 3) {
          throw new Error('Invalid response content');
        }

        agentStatuses[type] = {
          status: 'available',
          lastChecked: new Date().toISOString(),
        };
        healthyCount++;
      } catch (error) {
        agentStatuses[type] = {
          status: 'error',
          lastChecked: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    // Calculate performance metrics
    const averageResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0;
    const successRate =
      responseTimes.length / (this.agents.size * testQueries.length);

    const totalAgents = this.agents.size;
    let agentStatus: 'healthy' | 'degraded' | 'unhealthy';

    if (healthyCount === totalAgents) {
      agentStatus = 'healthy';
    } else if (healthyCount > 0) {
      agentStatus = 'degraded';
    } else {
      agentStatus = 'unhealthy';
    }

    // Determine overall status considering both agents and providers
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    const isProvidersHealthy =
      providerValidation.isValid && providerHealth.status !== 'error';

    if (agentStatus === 'healthy' && isProvidersHealthy) {
      overallStatus = 'healthy';
    } else if (
      agentStatus === 'degraded' ||
      (!isProvidersHealthy && providerHealth.status === 'degraded')
    ) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'unhealthy';
    }

    return {
      status: overallStatus,
      agents: agentStatuses,
      providers: {
        status: isProvidersHealthy ? (providerHealth.status as any) : 'error',
        details: {
          validation: providerValidation,
          health: providerHealth,
        },
      },
      performance: {
        averageResponseTime: Math.round(averageResponseTime),
        totalTests: responseTimes.length,
        successRate: Math.round(successRate * 100) / 100,
      },
    };
  }
}
