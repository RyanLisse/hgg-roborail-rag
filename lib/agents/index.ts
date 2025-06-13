import 'server-only';

// Core types and interfaces
export type {
  Agent,
  AgentRouter,
  AgentType,
  AgentCapability,
  AgentRequest,
  AgentResponse,
  AgentRoutingDecision,
  AgentConfig,
  UserIntent,
  QueryComplexity,
  VectorStoreType,
} from './types';

// Agent implementations
export { BaseAgent } from './base-agent';
export { QAAgent } from './qa-agent';
export { RewriteAgent } from './rewrite-agent';
export { PlannerAgent } from './planner-agent';
export { ResearchAgent } from './research-agent';

// Router and orchestrator
export { SmartAgentRouter } from './router';
export { AgentOrchestrator } from './orchestrator';

// Import concrete classes
import { AgentOrchestrator } from './orchestrator';
import { QAAgent } from './qa-agent';
import { RewriteAgent } from './rewrite-agent';
import { PlannerAgent } from './planner-agent';
import { ResearchAgent } from './research-agent';
import { SmartAgentRouter } from './router';
import type { AgentConfig, AgentRequest, AgentResponse, AgentType, UserIntent, QueryComplexity, AgentRoutingDecision } from './types';
import { getService, hasService, ServiceTokens, createRequestScope } from '../di/services';

// Factory functions and utilities
let globalOrchestrator: AgentOrchestrator | null = null;

/**
 * Get or create the global agent orchestrator instance
 * Uses DI container if services are initialized, otherwise falls back to direct instantiation
 */
export function getAgentOrchestrator(config?: Partial<AgentConfig>): AgentOrchestrator {
  if (!globalOrchestrator) {
    // Try to get from DI container first
    if (hasService(ServiceTokens.AGENT_ORCHESTRATOR)) {
      const scope = createRequestScope();
      globalOrchestrator = scope.resolve(ServiceTokens.AGENT_ORCHESTRATOR);
    } else {
      // Fallback to direct instantiation
      const defaultConfig: Partial<AgentConfig> = {
        vectorStoreConfig: {
          defaultSources: ['memory'],
          searchThreshold: 0.3,
          maxResults: 10,
        },
        ...config
      };
      globalOrchestrator = new AgentOrchestrator(defaultConfig);
    }
  }
  return globalOrchestrator;
}

/**
 * Reset the global orchestrator (mainly for testing)
 */
export function resetGlobalOrchestrator(): void {
  globalOrchestrator = null;
}

/**
 * Create a new agent orchestrator instance
 */
export function createAgentOrchestrator(config?: Partial<AgentConfig>): AgentOrchestrator {
  const defaultConfig: Partial<AgentConfig> = {
    vectorStoreConfig: {
      defaultSources: ['memory'],
      searchThreshold: 0.3,
      maxResults: 10,
    },
    ...config
  };
  return new AgentOrchestrator(defaultConfig);
}

/**
 * Quick agent functions for common use cases
 */

/**
 * Process a query using the most appropriate agent
 */
export async function processQuery(
  query: string,
  options?: {
    chatHistory?: AgentRequest['chatHistory'];
    sources?: ('openai' | 'neon' | 'memory')[];
    modelId?: string;
    streaming?: boolean;
  }
): Promise<AgentResponse> {
  const orchestrator = getAgentOrchestrator();
  
  const request: AgentRequest = {
    query,
    chatHistory: options?.chatHistory || [],
    context: {
      sources: options?.sources || ['memory'],
      maxResults: 10,
      complexity: 'moderate',
      domainKeywords: [],
      requiresCitations: true,
    },
    options: {
      modelId: options?.modelId || 'anthropic-claude-sonnet-4-20250514',
      streaming: options?.streaming ?? false,
      useTools: true,
    },
  };

  return orchestrator.processRequest(request);
}

/**
 * Process a query with streaming support
 */
export async function* processQueryStream(
  query: string,
  options?: {
    chatHistory?: AgentRequest['chatHistory'];
    sources?: ('openai' | 'neon' | 'memory')[];
    modelId?: string;
  }
): AsyncGenerator<string, AgentResponse, unknown> {
  const orchestrator = getAgentOrchestrator();
  
  const request: AgentRequest = {
    query,
    chatHistory: options?.chatHistory || [],
    context: {
      sources: options?.sources || ['memory'],
      maxResults: 10,
      complexity: 'moderate',
      domainKeywords: [],
      requiresCitations: true,
    },
    options: {
      modelId: options?.modelId || 'anthropic-claude-sonnet-4-20250514',
      streaming: true,
      useTools: true,
    },
  };

  const streamGenerator = orchestrator.processRequestStream(request);
  let finalResponse: AgentResponse | undefined;

  for await (const chunk of streamGenerator) {
    if (typeof chunk === 'string') {
      yield chunk;
    } else {
      finalResponse = chunk;
    }
  }

  return finalResponse || {
    content: '',
    agent: 'qa',
    metadata: { modelUsed: 'unknown' },
    streamingSupported: true,
  };
}

/**
 * Use a specific agent directly
 */
export async function useAgent(
  agentType: AgentType,
  query: string,
  options?: {
    chatHistory?: AgentRequest['chatHistory'];
    sources?: ('openai' | 'neon' | 'memory')[];
    modelId?: string;
  }
): Promise<AgentResponse> {
  // Try to get from DI container first
  const agentTokens = {
    qa: ServiceTokens.QA_AGENT,
    rewrite: ServiceTokens.REWRITE_AGENT,
    planner: ServiceTokens.PLANNER_AGENT,
    research: ServiceTokens.RESEARCH_AGENT,
  };

  let agent: any;
  const token = agentTokens[agentType];
  
  if (hasService(token)) {
    const scope = createRequestScope();
    agent = scope.resolve(token);
  } else {
    // Fallback to direct instantiation
    const agentClasses = {
      qa: () => new QAAgent(),
      rewrite: () => new RewriteAgent(),
      planner: () => new PlannerAgent(),
      research: () => new ResearchAgent(),
    };
    agent = agentClasses[agentType]();
  }
  
  const request: AgentRequest = {
    query,
    chatHistory: options?.chatHistory || [],
    context: {
      sources: options?.sources || ['memory'],
      maxResults: 10,
      complexity: 'moderate',
      domainKeywords: [],
      requiresCitations: true,
    },
    options: {
      modelId: options?.modelId || 'anthropic-claude-sonnet-4-20250514',
      streaming: false,
      useTools: true,
    },
  };

  return agent.processRequest(request);
}

/**
 * Utility functions
 */

/**
 * Classify user intent for a query
 */
export async function classifyIntent(query: string): Promise<UserIntent> {
  let router: any;
  if (hasService(ServiceTokens.AGENT_ROUTER)) {
    const scope = createRequestScope();
    router = scope.resolve(ServiceTokens.AGENT_ROUTER);
  } else {
    router = new SmartAgentRouter();
  }
  return router.classifyIntent(query);
}

/**
 * Analyze query complexity
 */
export async function analyzeComplexity(query: string): Promise<QueryComplexity> {
  let router: any;
  if (hasService(ServiceTokens.AGENT_ROUTER)) {
    const scope = createRequestScope();
    router = scope.resolve(ServiceTokens.AGENT_ROUTER);
  } else {
    router = new SmartAgentRouter();
  }
  return router.analyzeComplexity(query);
}

/**
 * Get routing decision for a query
 */
export async function getRoutingDecision(
  query: string,
  context?: AgentRequest['context']
): Promise<AgentRoutingDecision> {
  let router: any;
  if (hasService(ServiceTokens.AGENT_ROUTER)) {
    const scope = createRequestScope();
    router = scope.resolve(ServiceTokens.AGENT_ROUTER);
  } else {
    router = new SmartAgentRouter();
  }
  return router.routeQuery(query, context);
}

/**
 * Get system health status
 */
export async function getSystemHealth() {
  const orchestrator = getAgentOrchestrator();
  return orchestrator.healthCheck();
}

/**
 * Get available agent capabilities
 */
export function getAgentCapabilities() {
  const orchestrator = getAgentOrchestrator();
  return orchestrator.getAgentCapabilities();
}

// Default export for convenience
const agentSystem = {
  processQuery,
  processQueryStream,
  useAgent,
  classifyIntent,
  analyzeComplexity,
  getRoutingDecision,
  getSystemHealth,
  getAgentCapabilities,
  getOrchestrator: getAgentOrchestrator,
  createOrchestrator: createAgentOrchestrator,
};

export default agentSystem;