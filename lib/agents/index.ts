import "server-only";

// Re-export base classes for type definitions (lightweight)
export { BaseAgent } from "./base-agent";
// Core types and interfaces
export type {
  Agent,
  AgentCapability,
  AgentConfig,
  AgentRequest,
  AgentResponse,
  AgentRouter,
  AgentRoutingDecision,
  AgentType,
  QueryComplexity,
  UserIntent,
  VectorStoreType,
} from "./types";

import { ServiceTokens } from "../di/container";
import { createRequestScope, hasService } from "../di/services";
// Import only types and DI utilities (lightweight imports)
import type {
  AgentConfig,
  AgentRequest,
  AgentResponse,
  AgentRoutingDecision,
  AgentType,
  QueryComplexity,
  UserIntent,
} from "./types";

/**
 * Environment flag to enable/disable code splitting for agents
 */
export const AGENT_CODE_SPLITTING_ENABLED =
  process.env.ENABLE_CODE_SPLITTING !== "false";

/**
 * Lazy loading factory functions for agents
 */

/**
 * Create QA Agent with lazy loading
 */
export async function createQAAgent() {
  if (!AGENT_CODE_SPLITTING_ENABLED) {
    const { QAAgent } = require("./qa-agent");
    return new QAAgent();
  }

  const { QAAgent } = await import("./qa-agent");
  return new QAAgent();
}

/**
 * Create Rewrite Agent with lazy loading
 */
export async function createRewriteAgent() {
  if (!AGENT_CODE_SPLITTING_ENABLED) {
    const { RewriteAgent } = require("./rewrite-agent");
    return new RewriteAgent();
  }

  const { RewriteAgent } = await import("./rewrite-agent");
  return new RewriteAgent();
}

/**
 * Create Planner Agent with lazy loading
 */
export async function createPlannerAgent() {
  if (!AGENT_CODE_SPLITTING_ENABLED) {
    const { PlannerAgent } = require("./planner-agent");
    return new PlannerAgent();
  }

  const { PlannerAgent } = await import("./planner-agent");
  return new PlannerAgent();
}

/**
 * Create Research Agent with lazy loading
 */
export async function createResearchAgent() {
  if (!AGENT_CODE_SPLITTING_ENABLED) {
    const { ResearchAgent } = require("./research-agent");
    return new ResearchAgent();
  }

  const { ResearchAgent } = await import("./research-agent");
  return new ResearchAgent();
}

/**
 * Create Smart Agent Router with lazy loading
 */
export async function createSmartAgentRouter() {
  if (!AGENT_CODE_SPLITTING_ENABLED) {
    const { SmartAgentRouter } = require("./router");
    return new SmartAgentRouter();
  }

  const { SmartAgentRouter } = await import("./router");
  return new SmartAgentRouter();
}

/**
 * Create Agent Orchestrator with lazy loading
 */
export async function createAgentOrchestrator(config?: Partial<AgentConfig>) {
  if (!AGENT_CODE_SPLITTING_ENABLED) {
    const { AgentOrchestrator } = require("./orchestrator");
    return new AgentOrchestrator(config);
  }

  const { AgentOrchestrator } = await import("./orchestrator");
  return new AgentOrchestrator(config);
}

/**
 * Dynamic agent factory with lazy loading
 */
export async function createAgent(agentType: AgentType) {
  switch (agentType) {
    case "qa":
      return createQAAgent();
    case "rewrite":
      return createRewriteAgent();
    case "planner":
      return createPlannerAgent();
    case "research":
      return createResearchAgent();
    default:
      throw new Error(`Unknown agent type: ${agentType}`);
  }
}

/**
 * Agent cache for better performance
 */
const agentCache = new Map<AgentType, any>();

/**
 * Get cached agent or create new one with lazy loading
 */
export async function getAgent(agentType: AgentType) {
  if (agentCache.has(agentType)) {
    return agentCache.get(agentType);
  }

  const agent = await createAgent(agentType);
  agentCache.set(agentType, agent);
  return agent;
}

/**
 * Clear agent cache (useful for testing)
 */
export function clearAgentCache() {
  agentCache.clear();
}

/**
 * Preload commonly used agents
 */
export async function preloadAgents(types: AgentType[] = ["qa"]) {
  const loadPromises = types.map((type) => getAgent(type));
  await Promise.allSettled(loadPromises);
}

// Factory functions and utilities
let globalOrchestrator: any | null = null;

/**
 * Get or create the global agent orchestrator instance with lazy loading
 * Uses DI container if services are initialized, otherwise falls back to direct instantiation
 */
export async function getAgentOrchestrator(config?: Partial<AgentConfig>) {
  if (!globalOrchestrator) {
    // Try to get from DI container first
    if (hasService(ServiceTokens.AGENT_ORCHESTRATOR)) {
      const scope = createRequestScope();
      globalOrchestrator = scope.resolve(ServiceTokens.AGENT_ORCHESTRATOR);
    } else {
      // Fallback to lazy-loaded instantiation
      const defaultConfig: Partial<AgentConfig> = {
        vectorStoreConfig: {
          defaultSources: ["memory"],
          searchThreshold: 0.3,
          maxResults: 10,
        },
        ...config,
      };
      globalOrchestrator = await createAgentOrchestrator(defaultConfig);
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
 * Create a new agent orchestrator instance (already implemented above with lazy loading)
 * This is kept for backward compatibility
 */
export async function createAgentOrchestratorLegacy(
  config?: Partial<AgentConfig>,
) {
  return createAgentOrchestrator(config);
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
    chatHistory?: AgentRequest["chatHistory"];
    sources?: ("openai" | "neon" | "memory")[];
    modelId?: string;
    streaming?: boolean;
  },
): Promise<AgentResponse> {
  const orchestrator = await getAgentOrchestrator();

  const request: AgentRequest = {
    query,
    chatHistory: options?.chatHistory || [],
    context: {
      sources: options?.sources || ["memory"],
      maxResults: 10,
      complexity: "moderate",
      domainKeywords: [],
      requiresCitations: true,
    },
    options: {
      modelId: options?.modelId || "anthropic-claude-sonnet-4-20250514",
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
    chatHistory?: AgentRequest["chatHistory"];
    sources?: ("openai" | "neon" | "memory")[];
    modelId?: string;
  },
): AsyncGenerator<string, AgentResponse, unknown> {
  const orchestrator = await getAgentOrchestrator();

  const request: AgentRequest = {
    query,
    chatHistory: options?.chatHistory || [],
    context: {
      sources: options?.sources || ["memory"],
      maxResults: 10,
      complexity: "moderate",
      domainKeywords: [],
      requiresCitations: true,
    },
    options: {
      modelId: options?.modelId || "anthropic-claude-sonnet-4-20250514",
      streaming: true,
      useTools: true,
    },
  };

  const streamGenerator = orchestrator.processRequestStream(request);
  let finalResponse: AgentResponse | undefined;

  for await (const chunk of streamGenerator) {
    if (typeof chunk === "string") {
      yield chunk;
    } else {
      finalResponse = chunk;
    }
  }

  return (
    finalResponse || {
      content: "",
      agent: "qa",
      metadata: { modelUsed: "unknown" },
      streamingSupported: true,
    }
  );
}

/**
 * Use a specific agent directly
 */
export async function useAgent(
  agentType: AgentType,
  query: string,
  options?: {
    chatHistory?: AgentRequest["chatHistory"];
    sources?: ("openai" | "neon" | "memory")[];
    modelId?: string;
  },
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
    // Fallback to lazy-loaded instantiation
    agent = await getAgent(agentType);
  }

  const request: AgentRequest = {
    query,
    chatHistory: options?.chatHistory || [],
    context: {
      sources: options?.sources || ["memory"],
      maxResults: 10,
      complexity: "moderate",
      domainKeywords: [],
      requiresCitations: true,
    },
    options: {
      modelId: options?.modelId || "anthropic-claude-sonnet-4-20250514",
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
 * Router cache for better performance
 */
let routerCache: any = null;

/**
 * Get cached router or create new one with lazy loading
 */
async function getRouter() {
  if (routerCache) {
    return routerCache;
  }

  if (hasService(ServiceTokens.AGENT_ROUTER)) {
    const scope = createRequestScope();
    routerCache = scope.resolve(ServiceTokens.AGENT_ROUTER);
  } else {
    routerCache = await createSmartAgentRouter();
  }

  return routerCache;
}

/**
 * Classify user intent for a query
 */
export async function classifyIntent(query: string): Promise<UserIntent> {
  const router = await getRouter();
  return router.classifyIntent(query);
}

/**
 * Analyze query complexity
 */
export async function analyzeComplexity(
  query: string,
): Promise<QueryComplexity> {
  const router = await getRouter();
  return router.analyzeComplexity(query);
}

/**
 * Get routing decision for a query
 */
export async function getRoutingDecision(
  query: string,
  context?: AgentRequest["context"],
): Promise<AgentRoutingDecision> {
  const router = await getRouter();
  return router.routeQuery(query, context);
}

/**
 * Get system health status
 */
export async function getSystemHealth() {
  const orchestrator = await getAgentOrchestrator();
  return orchestrator.healthCheck();
}

/**
 * Get available agent capabilities
 */
export async function getAgentCapabilities() {
  const orchestrator = await getAgentOrchestrator();
  return orchestrator.getAgentCapabilities();
}

/**
 * Clear all caches (useful for testing)
 */
export function clearAllCaches() {
  clearAgentCache();
  routerCache = null;
  globalOrchestrator = null;
}

// Default export for convenience with lazy loading
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
  // Cache management
  clearAllCaches,
  clearAgentCache,
  // Preloading
  preloadAgents,
  // Factory functions
  createAgent,
  getAgent,
  createQAAgent,
  createRewriteAgent,
  createPlannerAgent,
  createResearchAgent,
  createSmartAgentRouter,
};

export default agentSystem;
