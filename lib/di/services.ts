/**
 * Service Registration for Dependency Injection
 * Registers all application services with the DI container
 * Supports both synchronous and lazy-loaded (asynchronous) service registration
 */

import { getDb } from '../db/queries';
import {
  getContainer,
  registerScoped,
  registerSingleton,
  ServiceTokens,
} from './container';

/**
 * Environment flag to enable/disable lazy loading in DI
 */
export const DI_LAZY_LOADING_ENABLED =
  process.env.ENABLE_CODE_SPLITTING !== 'false';

/**
 * Async service factory type
 */
type AsyncServiceFactory<T> = () => Promise<T>;

/**
 * Initialize all application services
 * Call this on application startup
 */
export function initializeServices(): void {
  if (DI_LAZY_LOADING_ENABLED) {
    initializeLazyServices();
  } else {
    initializeSyncServices();
  }
}

/**
 * Initialize services with synchronous imports (original behavior)
 */
function initializeSyncServices(): void {
  const { OpenAIVectorStore } = require('../vectorstore/openai-class');
  const { NeonVectorStore } = require('../vectorstore/neon-class');
  const { MemoryVectorStore } = require('../vectorstore/memory-class');
  const { UnifiedVectorStore } = require('../vectorstore/unified-class');
  const { AgentOrchestrator } = require('../agents/orchestrator');
  const { SmartAgentRouter } = require('../agents/router');
  const { QAAgent } = require('../agents/qa-agent');
  const { RewriteAgent } = require('../agents/rewrite-agent');
  const { PlannerAgent } = require('../agents/planner-agent');
  const { ResearchAgent } = require('../agents/research-agent');
  const { VectorStoreMonitoring } = require('../vectorstore/core/monitoring');

  const _container = getContainer();

  // Database Services (with test mode support)
  registerSingleton(ServiceTokens.DATABASE_CLIENT, () => {
    const isTestMode =
      process.env.NODE_ENV === 'test' || process.env.PLAYWRIGHT === 'true';
    if (isTestMode) {
      return null;
    }
    return getDb();
  });

  // Vector Store Services
  registerSingleton(
    ServiceTokens.OPENAI_VECTOR_STORE,
    () => new OpenAIVectorStore(),
  );
  registerSingleton(
    ServiceTokens.NEON_VECTOR_STORE,
    () => new NeonVectorStore(),
  );
  registerSingleton(
    ServiceTokens.MEMORY_VECTOR_STORE,
    () => new MemoryVectorStore(),
  );

  registerSingleton(ServiceTokens.UNIFIED_VECTOR_STORE, (container) => {
    const openai = container.resolve(ServiceTokens.OPENAI_VECTOR_STORE);
    const neon = container.resolve(ServiceTokens.NEON_VECTOR_STORE);
    const memory = container.resolve(ServiceTokens.MEMORY_VECTOR_STORE);
    return new UnifiedVectorStore([openai, neon, memory]);
  });

  // Monitoring Services
  registerSingleton(
    ServiceTokens.VECTOR_STORE_MONITORING,
    () => new VectorStoreMonitoring(),
  );

  // Cache Services (lazy loaded to avoid circular dependencies)
  registerSingleton(ServiceTokens.CACHE_BACKEND, async () => {
    const { getCache } = require('../cache');
    return await getCache();
  });

  registerSingleton(ServiceTokens.SMART_CACHE, async (_container) => {
    const { getSmartCache } = require('../cache');
    return await getSmartCache();
  });

  registerSingleton(ServiceTokens.VECTOR_STORE_CACHE, () => {
    const { getVectorStoreCache } = require('../cache/vector-cache');
    return getVectorStoreCache();
  });

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
    const _vectorStore = container.resolve(ServiceTokens.UNIFIED_VECTOR_STORE);

    return new AgentOrchestrator({
      router,
      vectorStoreConfig: {
        defaultSources: ['memory', 'neon', 'openai'],
        searchThreshold: 0.3,
        maxResults: 10,
      },
    });
  });

  // Stream Context Service
  registerSingleton(ServiceTokens.STREAM_CONTEXT, () => {
    const { createResumableStreamContext } = require('resumable-stream');
    const { after } = require('next/server');

    try {
      return createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes('REDIS_URL')) {
      } else {
      }
      return null;
    }
  });

  // Configuration
  registerSingleton(ServiceTokens.CONFIG, () => ({
    vectorStore: {
      defaultSources: ['memory', 'neon', 'openai'],
      searchThreshold: 0.3,
      maxResults: 10,
    },
    agents: {
      defaultTimeout: 30_000,
      maxRetries: 3,
    },
  }));
}

/**
 * Initialize services with lazy loading (async imports)
 */
function initializeLazyServices(): void {
  const _container = getContainer();

  // Database Services (these are lightweight, keep sync, with test mode support)
  registerSingleton(ServiceTokens.DATABASE_CLIENT, () => {
    const isTestMode =
      process.env.NODE_ENV === 'test' || process.env.PLAYWRIGHT === 'true';
    if (isTestMode) {
      return null;
    }
    return getDb();
  });

  // Stream Context Service (lightweight, keep sync)
  registerSingleton(ServiceTokens.STREAM_CONTEXT, () => {
    const { createResumableStreamContext } = require('resumable-stream');
    const { after } = require('next/server');

    try {
      return createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes('REDIS_URL')) {
      } else {
      }
      return null;
    }
  });

  // Configuration (lightweight, keep sync)
  registerSingleton(ServiceTokens.CONFIG, () => ({
    vectorStore: {
      defaultSources: ['memory', 'neon', 'openai'],
      searchThreshold: 0.3,
      maxResults: 10,
    },
    agents: {
      defaultTimeout: 30_000,
      maxRetries: 3,
    },
  }));

  // Vector Store Services with lazy loading
  registerSingleton(ServiceTokens.OPENAI_VECTOR_STORE, async () => {
    const { OpenAIVectorStore } = await import('../vectorstore/openai-class');
    return new OpenAIVectorStore();
  });

  registerSingleton(ServiceTokens.NEON_VECTOR_STORE, async () => {
    const { NeonVectorStore } = await import('../vectorstore/neon-class');
    return new NeonVectorStore();
  });

  registerSingleton(ServiceTokens.MEMORY_VECTOR_STORE, async () => {
    const { MemoryVectorStore } = await import('../vectorstore/memory-class');
    return new MemoryVectorStore();
  });

  registerSingleton(ServiceTokens.UNIFIED_VECTOR_STORE, async (container) => {
    const { UnifiedVectorStore } = await import('../vectorstore/unified-class');
    const openai = await container.resolve(ServiceTokens.OPENAI_VECTOR_STORE);
    const neon = await container.resolve(ServiceTokens.NEON_VECTOR_STORE);
    const memory = await container.resolve(ServiceTokens.MEMORY_VECTOR_STORE);
    return new UnifiedVectorStore([openai, neon, memory]);
  });

  // Monitoring Services with lazy loading
  registerSingleton(ServiceTokens.VECTOR_STORE_MONITORING, async () => {
    const { PerformanceMonitor } = await import(
      '../vectorstore/core/monitoring'
    );
    return PerformanceMonitor;
  });

  // Agent Services with lazy loading
  registerScoped(ServiceTokens.QA_AGENT, async () => {
    const { QAAgent } = await import('../agents/qa-agent');
    return new QAAgent();
  });

  registerScoped(ServiceTokens.REWRITE_AGENT, async () => {
    const { RewriteAgent } = await import('../agents/rewrite-agent');
    return new RewriteAgent();
  });

  registerScoped(ServiceTokens.PLANNER_AGENT, async () => {
    const { PlannerAgent } = await import('../agents/planner-agent');
    return new PlannerAgent();
  });

  registerScoped(ServiceTokens.RESEARCH_AGENT, async () => {
    const { ResearchAgent } = await import('../agents/research-agent');
    return new ResearchAgent();
  });

  registerScoped(ServiceTokens.AGENT_ROUTER, async () => {
    const { SmartAgentRouter } = await import('../agents/router');
    return new SmartAgentRouter();
  });

  registerScoped(ServiceTokens.AGENT_ORCHESTRATOR, async () => {
    const { AgentOrchestrator } = await import('../agents/orchestrator');

    return new AgentOrchestrator({
      vectorStoreConfig: {
        defaultSources: ['memory', 'neon', 'openai'],
        searchThreshold: 0.3,
        maxResults: 10,
      },
    });
  });

  // Cache Services (lazy loaded to avoid circular dependencies)
  registerSingleton(ServiceTokens.CACHE_BACKEND, async () => {
    const { getCache } = await import('../cache');
    return await getCache();
  });

  registerSingleton(ServiceTokens.SMART_CACHE, async (_container) => {
    const { getSmartCache } = await import('../cache');
    return await getSmartCache();
  });

  registerSingleton(ServiceTokens.VECTOR_STORE_CACHE, async () => {
    const { getVectorStoreCache } = await import('../cache/vector-cache');
    return getVectorStoreCache();
  });
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
