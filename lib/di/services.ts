/**
 * Service Registration for Dependency Injection
 * Registers all application services with the DI container
 */

import { 
  getContainer, 
  ServiceTokens, 
  registerSingleton, 
  registerTransient, 
  registerScoped 
} from './container';
import { OpenAIVectorStore } from '../vectorstore/openai-class';
import { NeonVectorStore } from '../vectorstore/neon-class';
import { MemoryVectorStore } from '../vectorstore/memory-class';
import { UnifiedVectorStore } from '../vectorstore/unified-class';
import { AgentOrchestrator } from '../agents';
import { SmartAgentRouter } from '../agents/router';
import { QAAgent } from '../agents/qa-agent';
import { RewriteAgent } from '../agents/rewrite-agent';
import { PlannerAgent } from '../agents/planner-agent';
import { ResearchAgent } from '../agents/research-agent';
import { VectorStoreMonitoring } from '../vectorstore/core/monitoring';
import { getDb } from '../db/queries';

/**
 * Initialize all application services
 * Call this on application startup
 */
export function initializeServices(): void {
  const container = getContainer();

  // Database Services
  registerSingleton(ServiceTokens.DATABASE_CLIENT, () => getDb());

  // Vector Store Services
  registerSingleton(ServiceTokens.OPENAI_VECTOR_STORE, () => new OpenAIVectorStore());
  registerSingleton(ServiceTokens.NEON_VECTOR_STORE, () => new NeonVectorStore());
  registerSingleton(ServiceTokens.MEMORY_VECTOR_STORE, () => new MemoryVectorStore());
  
  registerSingleton(ServiceTokens.UNIFIED_VECTOR_STORE, (container) => {
    const openai = container.resolve(ServiceTokens.OPENAI_VECTOR_STORE);
    const neon = container.resolve(ServiceTokens.NEON_VECTOR_STORE);
    const memory = container.resolve(ServiceTokens.MEMORY_VECTOR_STORE);
    return new UnifiedVectorStore([openai, neon, memory]);
  });

  // Monitoring Services
  registerSingleton(ServiceTokens.VECTOR_STORE_MONITORING, () => new VectorStoreMonitoring());

  // Agent Services
  registerScoped(ServiceTokens.QA_AGENT, (container) => {
    const vectorStore = container.resolve(ServiceTokens.UNIFIED_VECTOR_STORE);
    return new QAAgent({ vectorStore });
  });

  registerScoped(ServiceTokens.REWRITE_AGENT, (container) => {
    const vectorStore = container.resolve(ServiceTokens.UNIFIED_VECTOR_STORE);
    return new RewriteAgent({ vectorStore });
  });

  registerScoped(ServiceTokens.PLANNER_AGENT, (container) => {
    const vectorStore = container.resolve(ServiceTokens.UNIFIED_VECTOR_STORE);
    return new PlannerAgent({ vectorStore });
  });

  registerScoped(ServiceTokens.RESEARCH_AGENT, (container) => {
    const vectorStore = container.resolve(ServiceTokens.UNIFIED_VECTOR_STORE);
    return new ResearchAgent({ vectorStore });
  });

  registerScoped(ServiceTokens.AGENT_ROUTER, (container) => {
    const qaAgent = container.resolve(ServiceTokens.QA_AGENT);
    const rewriteAgent = container.resolve(ServiceTokens.REWRITE_AGENT);
    const plannerAgent = container.resolve(ServiceTokens.PLANNER_AGENT);
    const researchAgent = container.resolve(ServiceTokens.RESEARCH_AGENT);
    
    return new SmartAgentRouter({
      qaAgent,
      rewriteAgent,
      plannerAgent,
      researchAgent,
    });
  });

  registerScoped(ServiceTokens.AGENT_ORCHESTRATOR, (container) => {
    const router = container.resolve(ServiceTokens.AGENT_ROUTER);
    const vectorStore = container.resolve(ServiceTokens.UNIFIED_VECTOR_STORE);
    
    return new AgentOrchestrator({
      router,
      vectorStoreConfig: {
        defaultSources: ['memory', 'neon', 'openai'],
        searchThreshold: 0.3,
        maxResults: 10,
      },
    });
  });

  // Configuration
  registerSingleton(ServiceTokens.CONFIG, () => ({
    vectorStore: {
      defaultSources: ['memory', 'neon', 'openai'],
      searchThreshold: 0.3,
      maxResults: 10,
    },
    agents: {
      defaultTimeout: 30000,
      maxRetries: 3,
    },
  }));
}

/**
 * Get a service instance from the container
 */
export function getService<T>(token: string | symbol): T {
  return getContainer().resolve<T>(token);
}

/**
 * Check if a service is registered
 */
export function hasService(token: string | symbol): boolean {
  return getContainer().isRegistered(token);
}

/**
 * Create a scoped container for request-level services
 */
export function createRequestScope() {
  return getContainer().createScope();
}