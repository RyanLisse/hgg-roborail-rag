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
type _AsyncServiceFactory<T> = () => Promise<T>;

/**
 * Initialize all application services
 * Call this on application startup
 */
export async function initializeServices(): Promise<void> {
  if (DI_LAZY_LOADING_ENABLED) {
    initializeLazyServices();
  } else {
    await initializeSyncServices();
  }
}

/**
 * Initialize services with synchronous imports (original behavior)
 */
async function initializeSyncServices(): Promise<void> {
  const { OpenAIVectorStore } = await import('../vectorstore/openai-class');
  const { SupabaseVectorStore } = await import('../vectorstore/supabase-class');
  const { MemoryVectorStore } = await import('../vectorstore/memory-class');
  const { UnifiedVectorStore } = await import('../vectorstore/unified-class');
  const { AgentOrchestrator } = await import('../agents/orchestrator');
  const { SmartAgentRouter } = await import('../agents/router');
  const { QAAgent } = await import('../agents/qa-agent');
  const { RewriteAgent } = await import('../agents/rewrite-agent');
  const { PlannerAgent } = await import('../agents/planner-agent');
  const { ResearchAgent } = await import('../agents/research-agent');
  const { PerformanceMonitor } = await import('../vectorstore/core/monitoring');

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
    ServiceTokens.SUPABASE_VECTOR_STORE,
    () => new SupabaseVectorStore(),
  );
  registerSingleton(
    ServiceTokens.MEMORY_VECTOR_STORE,
    () => new MemoryVectorStore(),
  );

  registerSingleton(ServiceTokens.UNIFIED_VECTOR_STORE, (container) => {
    const openai = container.resolve(ServiceTokens.OPENAI_VECTOR_STORE);
    const supabase = container.resolve(ServiceTokens.SUPABASE_VECTOR_STORE);
    const memory = container.resolve(ServiceTokens.MEMORY_VECTOR_STORE);
    return UnifiedVectorStore.create([openai, supabase, memory]);
  });

  // Monitoring Services
  registerSingleton(
    ServiceTokens.VECTOR_STORE_MONITORING,
    () => PerformanceMonitor,
  );

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

  // Agent Services
  registerScoped(ServiceTokens.QA_AGENT, (container) => {
    const vectorStore = container.resolve(ServiceTokens.UNIFIED_VECTOR_STORE);
    return new QAAgent();
  });

  registerScoped(ServiceTokens.REWRITE_AGENT, (container) => {
    const vectorStore = container.resolve(ServiceTokens.UNIFIED_VECTOR_STORE);
    return new RewriteAgent();
  });

  registerScoped(ServiceTokens.PLANNER_AGENT, (container) => {
    const vectorStore = container.resolve(ServiceTokens.UNIFIED_VECTOR_STORE);
    return new PlannerAgent();
  });

  registerScoped(ServiceTokens.RESEARCH_AGENT, (container) => {
    const vectorStore = container.resolve(ServiceTokens.UNIFIED_VECTOR_STORE);
    return new ResearchAgent();
  });

  registerScoped(ServiceTokens.AGENT_ROUTER, (container) => {
    const qaAgent = container.resolve(ServiceTokens.QA_AGENT);
    const rewriteAgent = container.resolve(ServiceTokens.REWRITE_AGENT);
    const plannerAgent = container.resolve(ServiceTokens.PLANNER_AGENT);
    const researchAgent = container.resolve(ServiceTokens.RESEARCH_AGENT);

    return new SmartAgentRouter();
  });

  registerScoped(ServiceTokens.AGENT_ORCHESTRATOR, (container) => {
    const router = container.resolve(ServiceTokens.AGENT_ROUTER);
    const _vectorStore = container.resolve(ServiceTokens.UNIFIED_VECTOR_STORE);

    return new AgentOrchestrator({
      vectorStoreConfig: {
        defaultSources: ['memory', 'supabase', 'openai'],
        searchThreshold: 0.3,
        maxResults: 10,
      },
    });
  });

  // Stream Context Service
  registerSingleton(ServiceTokens.STREAM_CONTEXT, async () => {
    const { createResumableStreamContext } = await import('resumable-stream');
    const { after } = await import('next/server');

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
      defaultSources: ['memory', 'supabase', 'openai'],
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
  registerSingleton(ServiceTokens.STREAM_CONTEXT, async () => {
    const { createResumableStreamContext } = await import('resumable-stream');
    const { after } = await import('next/server');

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
      defaultSources: ['memory', 'supabase', 'openai'],
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

  registerSingleton(ServiceTokens.SUPABASE_VECTOR_STORE, async () => {
    const { SupabaseVectorStore } = await import('../vectorstore/supabase-class');
    return new SupabaseVectorStore();
  });

  registerSingleton(ServiceTokens.MEMORY_VECTOR_STORE, async () => {
    const { MemoryVectorStore } = await import('../vectorstore/memory-class');
    return new MemoryVectorStore();
  });

  registerSingleton(ServiceTokens.UNIFIED_VECTOR_STORE, async (container) => {
    const { UnifiedVectorStore } = await import('../vectorstore/unified-class');
    const openai = await container.resolve(ServiceTokens.OPENAI_VECTOR_STORE);
    const supabase = await container.resolve(ServiceTokens.SUPABASE_VECTOR_STORE);
    const memory = await container.resolve(ServiceTokens.MEMORY_VECTOR_STORE);
    return UnifiedVectorStore.create([openai, supabase, memory]);
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
        defaultSources: ['memory', 'supabase', 'openai'],
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
