import type { Agent, AgentRequest, AgentResponse, AgentType, AgentConfig } from './types';
import { AgentConfig as AgentConfigSchema, AgentRequest as AgentRequestSchema } from './types';
import { QAAgent } from './qa-agent';
import { RewriteAgent } from './rewrite-agent';
import { PlannerAgent } from './planner-agent';
import { ResearchAgent } from './research-agent';
import { SmartAgentRouter } from './router';

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
        validatedRequest.context
      );
      
      console.log(`Agent routing: ${routingDecision.selectedAgent} (confidence: ${routingDecision.confidence})`);
      
      // Enhance request with routing insights
      const enhancedRequest: AgentRequest = {
        ...validatedRequest,
        context: {
          ...validatedRequest.context,
          sources: routingDecision.suggestedSources,
          complexity: routingDecision.estimatedComplexity,
        },
        options: {
          ...validatedRequest.options,
          modelId: validatedRequest.options?.modelId || this.config.defaultModel,
        },
      };

      // Execute with selected agent
      let response = await this.executeWithAgent(
        routingDecision.selectedAgent,
        enhancedRequest
      );

      // Try fallback if primary agent failed and we have a fallback
      if (response.errorDetails && routingDecision.fallbackAgent) {
        console.log(`Primary agent failed, trying fallback: ${routingDecision.fallbackAgent}`);
        
        const fallbackResponse = await this.executeWithAgent(
          routingDecision.fallbackAgent,
          enhancedRequest
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
      console.error('Orchestrator error:', error);
      
      // Return error response
      return {
        content: 'I encountered an error processing your request. Please try again.',
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
  async* processRequestStream(request: AgentRequest): AsyncGenerator<string, AgentResponse, unknown> {
    try {
      // Validate request
      const validatedRequest = AgentRequestSchema.parse(request);
      
      // Route to appropriate agent
      const routingDecision = await this.router.routeQuery(
        validatedRequest.query,
        validatedRequest.context
      );
      
      // Check if agent supports streaming
      const agent = this.agents.get(routingDecision.selectedAgent);
      if (!agent?.capability.supportsStreaming || !agent.processRequestStream) {
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
          sources: routingDecision.suggestedSources,
          complexity: routingDecision.estimatedComplexity,
        },
        options: {
          ...validatedRequest.options,
          modelId: validatedRequest.options?.modelId || this.config.defaultModel,
          streaming: true,
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
            console.log('Streaming failed, trying fallback agent');
            const fallbackResponse = await fallbackAgent.processRequest(enhancedRequest);
            yield fallbackResponse.content;
            return fallbackResponse;
          }
        }
        throw streamError;
      }

      return finalResponse || {
        content: '',
        agent: routingDecision.selectedAgent,
        metadata: { modelUsed: 'unknown' },
        streamingSupported: true,
      };

    } catch (error) {
      console.error('Orchestrator streaming error:', error);
      
      const errorMessage = 'I encountered an error processing your request. Please try again.';
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
  private async executeWithAgent(agentType: AgentType, request: AgentRequest): Promise<AgentResponse> {
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
            setTimeout(() => reject(new Error('Agent timeout')), this.config.timeout)
          ),
        ]);
        
        return response;
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`Agent ${agentType} attempt ${attempt + 1} failed:`, lastError.message);
        
        // Don't retry on the last attempt
        if (attempt < this.config.maxRetries - 1) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    // All retries failed
    throw lastError || new Error(`Agent ${agentType} failed after ${this.config.maxRetries} attempts`);
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
   * Check system health
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    agents: Record<AgentType, { status: 'available' | 'error'; lastChecked: string }>;
  }> {
    const agentStatuses: Record<string, { status: 'available' | 'error'; lastChecked: string }> = {};
    let healthyCount = 0;

    // Test each agent with a simple request
    const testRequest: AgentRequest = {
      query: 'Hello',
      options: { modelId: this.config.fallbackModel, streaming: false },
    };

    for (const [type, agent] of Array.from(this.agents.entries())) {
      try {
        await agent.processRequest(testRequest);
        agentStatuses[type] = { status: 'available', lastChecked: new Date().toISOString() };
        healthyCount++;
      } catch (error) {
        agentStatuses[type] = { status: 'error', lastChecked: new Date().toISOString() };
        console.warn(`Agent ${type} health check failed:`, error);
      }
    }

    const totalAgents = this.agents.size;
    let status: 'healthy' | 'degraded' | 'unhealthy';
    
    if (healthyCount === totalAgents) {
      status = 'healthy';
    } else if (healthyCount > 0) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return { status, agents: agentStatuses };
  }
}