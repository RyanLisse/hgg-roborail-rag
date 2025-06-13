/**
 * Unified Cache System
 * Environment-aware cache with automatic backend selection and smart caching strategies
 */

import type { CacheBackend, CacheConfig } from './types';
import { CACHE_PRESETS } from './types';
import { MemoryCacheBackend } from './memory-cache';

export * from './types';

// Global cache instance
let globalCache: CacheBackend | null = null;

/**
 * Get cache configuration from environment
 */
export function getCacheConfig(): CacheConfig {
  const isProduction = process.env.NODE_ENV === 'production';
  const hasRedis = Boolean(process.env.REDIS_URL || process.env.VALKEY_URL);
  
  return {
    backend: hasRedis && isProduction ? 'redis' : 'memory',
    redis: {
      url: process.env.REDIS_URL || process.env.VALKEY_URL || 'redis://localhost:6379',
      maxRetries: 3,
      retryDelayMs: 1000,
      keyPrefix: 'roborail:cache:',
      enablePubSub: isProduction,
    },
    memory: {
      maxSize: 10000,
      maxMemoryMB: 100,
      cleanupIntervalMs: 5 * 60 * 1000, // 5 minutes
    },
    defaultTtl: 15 * 60 * 1000, // 15 minutes
    enableMetrics: true,
    enableInvalidation: true,
  };
}

/**
 * Create cache backend instance
 */
export async function createCacheBackend(config?: Partial<CacheConfig>): Promise<CacheBackend> {
  const fullConfig = { ...getCacheConfig(), ...config };
  
  if (fullConfig.backend === 'redis' && fullConfig.redis) {
    try {
      // Dynamic import to avoid bundling Redis in environments that don't need it
      const { RedisCacheBackend } = await import('./redis-cache');
      const redisCache = new RedisCacheBackend(fullConfig.redis);
      
      // Try to connect
      await redisCache.connect();
      console.log('✅ Using Redis cache backend');
      return redisCache;
    } catch (error) {
      console.warn('⚠️ Redis cache unavailable, falling back to memory cache:', error);
    }
  }
  
  // Fallback to memory cache
  const memoryCache = new MemoryCacheBackend(fullConfig.memory);
  console.log('✅ Using memory cache backend');
  return memoryCache;
}

/**
 * Get or create global cache instance
 */
export async function getCache(): Promise<CacheBackend> {
  if (!globalCache) {
    globalCache = await createCacheBackend();
  }
  return globalCache;
}

/**
 * Reset global cache instance (useful for testing)
 */
export async function resetCache(): Promise<void> {
  if (globalCache) {
    await globalCache.disconnect?.();
    globalCache = null;
  }
}

/**
 * Smart cache key generator for semantic caching
 */
export namespace CacheKeyGenerator {
  export function vectorSearch(query: string, sources: string[], options: any = {}): string {
    const optionsHash = JSON.stringify(options, Object.keys(options).sort());
    const sourcesStr = sources.sort().join(',');
    return `vs:${hash(query)}:${hash(sourcesStr)}:${hash(optionsHash)}`;
  }
  
  export function agentRouting(query: string, context: any = {}): string {
    const contextHash = JSON.stringify(context, Object.keys(context).sort());
    return `ar:${hash(query)}:${hash(contextHash)}`;
  }
  
  export function agentResponse(agentType: string, query: string, context: any = {}): string {
    const contextHash = JSON.stringify(context, Object.keys(context).sort());
    return `ap:${agentType}:${hash(query)}:${hash(contextHash)}`;
  }
  
  export function documentEmbedding(content: string, model: string): string {
    return `emb:${model}:${hash(content)}`;
  }
  
  export function healthCheck(service: string, endpoint: string): string {
    return `health:${service}:${hash(endpoint)}`;
  }
  
  function hash(input: string): string {
    // Simple hash function for cache keys
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}

/**
 * High-level cache utilities with semantic caching
 */
export class SmartCache {
  private backend: CacheBackend;
  
  constructor(backend: CacheBackend) {
    this.backend = backend;
  }
  
  /**
   * Cache vector search results with semantic key
   */
  async cacheVectorSearch<T>(
    query: string,
    sources: string[],
    options: any,
    result: T,
    ttl?: number
  ): Promise<boolean> {
    if (process.env.ENABLE_CACHING === 'false') return false;
    
    const key = CacheKeyGenerator.vectorSearch(query, sources, options);
    const cacheTtl = ttl ?? CACHE_PRESETS.VECTOR_SEARCH.ttl;
    
    return this.backend.set(key, result, cacheTtl);
  }
  
  /**
   * Get cached vector search results
   */
  async getCachedVectorSearch<T>(
    query: string,
    sources: string[],
    options: any
  ): Promise<T | null> {
    if (process.env.ENABLE_CACHING === 'false') return null;
    
    const key = CacheKeyGenerator.vectorSearch(query, sources, options);
    return this.backend.get<T>(key);
  }
  
  /**
   * Cache agent routing decision
   */
  async cacheAgentRouting<T>(
    query: string,
    context: any,
    decision: T,
    ttl?: number
  ): Promise<boolean> {
    if (process.env.ENABLE_CACHING === 'false') return false;
    
    const key = CacheKeyGenerator.agentRouting(query, context);
    const cacheTtl = ttl ?? CACHE_PRESETS.AGENT_ROUTING.ttl;
    
    return this.backend.set(key, decision, cacheTtl);
  }
  
  /**
   * Get cached agent routing decision
   */
  async getCachedAgentRouting<T>(query: string, context: any): Promise<T | null> {
    if (process.env.ENABLE_CACHING === 'false') return null;
    
    const key = CacheKeyGenerator.agentRouting(query, context);
    return this.backend.get<T>(key);
  }
  
  /**
   * Cache agent response
   */
  async cacheAgentResponse<T>(
    agentType: string,
    query: string,
    context: any,
    response: T,
    ttl?: number
  ): Promise<boolean> {
    if (process.env.ENABLE_CACHING === 'false') return false;
    
    const key = CacheKeyGenerator.agentResponse(agentType, query, context);
    const cacheTtl = ttl ?? CACHE_PRESETS.AGENT_RESPONSE.ttl;
    
    return this.backend.set(key, response, cacheTtl);
  }
  
  /**
   * Get cached agent response
   */
  async getCachedAgentResponse<T>(
    agentType: string,
    query: string,
    context: any
  ): Promise<T | null> {
    if (process.env.ENABLE_CACHING === 'false') return null;
    
    const key = CacheKeyGenerator.agentResponse(agentType, query, context);
    return this.backend.get<T>(key);
  }
  
  /**
   * Cache document embedding
   */
  async cacheDocumentEmbedding(
    content: string,
    model: string,
    embedding: number[],
    ttl?: number
  ): Promise<boolean> {
    if (process.env.ENABLE_CACHING === 'false') return false;
    
    const key = CacheKeyGenerator.documentEmbedding(content, model);
    const cacheTtl = ttl ?? CACHE_PRESETS.DOCUMENT_EMBEDDING.ttl;
    
    return this.backend.set(key, embedding, cacheTtl);
  }
  
  /**
   * Get cached document embedding
   */
  async getCachedDocumentEmbedding(
    content: string,
    model: string
  ): Promise<number[] | null> {
    if (process.env.ENABLE_CACHING === 'false') return null;
    
    const key = CacheKeyGenerator.documentEmbedding(content, model);
    return this.backend.get<number[]>(key);
  }
  
  /**
   * Cache health check result
   */
  async cacheHealthCheck(
    service: string,
    endpoint: string,
    result: any,
    ttl?: number
  ): Promise<boolean> {
    if (process.env.ENABLE_CACHING === 'false') return false;
    
    const key = CacheKeyGenerator.healthCheck(service, endpoint);
    const cacheTtl = ttl ?? CACHE_PRESETS.HEALTH_CHECK.ttl;
    
    return this.backend.set(key, result, cacheTtl);
  }
  
  /**
   * Get cached health check result
   */
  async getCachedHealthCheck(service: string, endpoint: string): Promise<any> {
    if (process.env.ENABLE_CACHING === 'false') return null;
    
    const key = CacheKeyGenerator.healthCheck(service, endpoint);
    return this.backend.get(key);
  }
  
  /**
   * Invalidate cache patterns
   */
  async invalidatePattern(pattern: string): Promise<number> {
    return this.backend.clear(pattern);
  }
  
  /**
   * Get cache statistics
   */
  async getStats() {
    return this.backend.getStats();
  }
  
  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    return this.backend.healthCheck();
  }
}

/**
 * Global smart cache instance
 */
let globalSmartCache: SmartCache | null = null;

/**
 * Get or create global smart cache
 */
export async function getSmartCache(): Promise<SmartCache> {
  if (!globalSmartCache) {
    const backend = await getCache();
    globalSmartCache = new SmartCache(backend);
  }
  return globalSmartCache;
}

// Export specific implementations for direct use
export { MemoryCacheBackend };