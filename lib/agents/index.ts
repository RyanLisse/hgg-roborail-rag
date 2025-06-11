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

// Factory functions and utilities
let globalOrchestrator: AgentOrchestrator | null = null;

/**
 * Get or create the global agent orchestrator instance
 */
export function getAgentOrchestrator(config?: Partial<AgentConfig>): AgentOrchestrator {
  if (!globalOrchestrator) {
    globalOrchestrator = new AgentOrchestrator(config);
  }
  return globalOrchestrator;
}

/**
 * Create a new agent orchestrator instance
 */
export function createAgentOrchestrator(config?: Partial<AgentConfig>): AgentOrchestrator {
  return new AgentOrchestrator(config);
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
    sources?: AgentRequest['context']['sources'];
    modelId?: string;
    streaming?: boolean;
  }
): Promise<AgentResponse> {
  const orchestrator = getAgentOrchestrator();
  
  const request: AgentRequest = {
    query,
    chatHistory: options?.chatHistory || [],
    context: {
      sources: options?.sources || ['openai'],
    },
    options: {
      modelId: options?.modelId,
      streaming: options?.streaming ?? false,
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
    sources?: AgentRequest['context']['sources'];
    modelId?: string;
  }
): AsyncGenerator<string, AgentResponse, unknown> {
  const orchestrator = getAgentOrchestrator();
  
  const request: AgentRequest = {
    query,
    chatHistory: options?.chatHistory || [],
    context: {
      sources: options?.sources || ['openai'],
    },
    options: {
      modelId: options?.modelId,
      streaming: true,
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
    sources?: AgentRequest['context']['sources'];
    modelId?: string;
  }
): Promise<AgentResponse> {
  const agents = {
    qa: () => new QAAgent(),
    rewrite: () => new RewriteAgent(),
    planner: () => new PlannerAgent(),
    research: () => new ResearchAgent(),
  };

  const agent = agents[agentType]();
  
  const request: AgentRequest = {
    query,
    chatHistory: options?.chatHistory || [],
    context: {
      sources: options?.sources || ['openai'],
    },
    options: {
      modelId: options?.modelId,
      streaming: false,
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
  const router = new SmartAgentRouter();
  return router.classifyIntent(query);
}

/**
 * Analyze query complexity
 */
export async function analyzeComplexity(query: string): Promise<QueryComplexity> {
  const router = new SmartAgentRouter();
  return router.analyzeComplexity(query);
}

/**
 * Get routing decision for a query
 */
export async function getRoutingDecision(
  query: string,
  context?: AgentRequest['context']
): Promise<AgentRoutingDecision> {
  const router = new SmartAgentRouter();
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