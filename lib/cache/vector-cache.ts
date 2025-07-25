/**
 * Vector Store Cache Integration
 * Caching layer specifically designed for vector search operations
 */

import { getSmartCache, type SmartCache } from './index';

/**
 * Cache wrapper for vector store operations
 */
export class VectorStoreCache {
  private cache: SmartCache | null = null;
  private enabled: boolean;

  constructor(enabled = process.env.ENABLE_CACHING !== 'false') {
    this.enabled = enabled;
  }

  /**
   * Initialize cache (lazy loading)
   */
  private async getCache(): Promise<SmartCache | null> {
    if (!this.enabled) {
      return null;
    }

    if (!this.cache) {
      try {
        this.cache = await getSmartCache();
      } catch (_error) {
        this.enabled = false;
        return null;
      }
    }

    return this.cache;
  }

  /**
   * Wrap vector search with caching
   */
  async wrapVectorSearch<T>(
    searchFn: () => Promise<T>,
    query: string,
    sources: string[],
    options: any = {},
    ttl?: number,
  ): Promise<T> {
    const cache = await this.getCache();

    if (cache) {
      // Try to get from cache first
      const cached = await cache.getCachedVectorSearch<T>(
        query,
        sources,
        options,
      );
      if (cached !== null) {
        return cached;
      }
    }
    const result = await searchFn();

    // Cache the result if cache is available
    if (cache && result) {
      await cache.cacheVectorSearch(query, sources, options, result, ttl);
    }

    return result;
  }

  /**
   * Wrap agent routing with caching
   */
  async wrapAgentRouting<T>(
    routingFn: () => Promise<T>,
    query: string,
    context: any = {},
    ttl?: number,
  ): Promise<T> {
    const cache = await this.getCache();

    if (cache) {
      // Try to get from cache first
      const cached = await cache.getCachedAgentRouting<T>(query, context);
      if (cached !== null) {
        return cached;
      }
    }
    const result = await routingFn();

    // Cache the result if cache is available
    if (cache && result) {
      await cache.cacheAgentRouting(query, context, result, ttl);
    }

    return result;
  }

  /**
   * Wrap agent processing with caching
   */
  async wrapAgentResponse<T>(
    processFn: () => Promise<T>,
    agentType: string,
    query: string,
    context: any = {},
    ttl?: number,
  ): Promise<T> {
    const cache = await this.getCache();

    if (cache) {
      // Try to get from cache first
      const cached = await cache.getCachedAgentResponse<T>(
        agentType,
        query,
        context,
      );
      if (cached !== null) {
        return cached;
      }
    }
    const result = await processFn();

    // Cache the result if cache is available
    if (cache && result) {
      await cache.cacheAgentResponse(agentType, query, context, result, ttl);
    }

    return result;
  }

  /**
   * Wrap document embedding with caching
   */
  async wrapDocumentEmbedding(
    embeddingFn: () => Promise<number[]>,
    content: string,
    model: string,
    ttl?: number,
  ): Promise<number[]> {
    const cache = await this.getCache();

    if (cache) {
      // Try to get from cache first
      const cached = await cache.getCachedDocumentEmbedding(content, model);
      if (cached !== null) {
        return cached;
      }
    }
    const result = await embeddingFn();

    // Cache the result if cache is available
    if (cache && result) {
      await cache.cacheDocumentEmbedding(content, model, result, ttl);
    }

    return result;
  }

  /**
   * Wrap health check with caching
   */
  async wrapHealthCheck<T>(
    healthCheckFn: () => Promise<T>,
    service: string,
    endpoint: string,
    ttl?: number,
  ): Promise<T> {
    const cache = await this.getCache();

    if (cache) {
      // Try to get from cache first
      const cached = await cache.getCachedHealthCheck(service, endpoint);
      if (cached !== null) {
        return cached;
      }
    }
    const result = await healthCheckFn();

    // Cache the result if cache is available
    if (cache && result) {
      await cache.cacheHealthCheck(service, endpoint, result, ttl);
    }

    return result;
  }

  /**
   * Invalidate cache patterns
   */
  async invalidatePattern(pattern: string): Promise<number> {
    const cache = await this.getCache();
    if (!cache) {
      return 0;
    }

    const deleted = await cache.invalidatePattern(pattern);
    return deleted;
  }

  /**
   * Invalidate all vector search cache
   */
  async invalidateVectorSearches(): Promise<number> {
    return this.invalidatePattern('vs:*');
  }

  /**
   * Invalidate all agent routing cache
   */
  async invalidateAgentRouting(): Promise<number> {
    return this.invalidatePattern('ar:*');
  }

  /**
   * Invalidate all agent responses
   */
  async invalidateAgentResponses(): Promise<number> {
    return this.invalidatePattern('ap:*');
  }

  /**
   * Invalidate all embeddings
   */
  async invalidateEmbeddings(): Promise<number> {
    return this.invalidatePattern('emb:*');
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    const cache = await this.getCache();
    if (!cache) {
      return {
        enabled: false,
        backend: 'none',
        stats: null,
      };
    }

    const stats = await cache.getStats();
    const health = await cache.healthCheck();

    return {
      enabled: this.enabled,
      backend: 'unknown', // Would need to be passed from backend
      healthy: health,
      stats,
    };
  }

  /**
   * Warm up cache with common queries
   */
  async warmup(
    commonQueries: Array<{ query: string; sources: string[]; options?: any }>,
  ) {
    for (const { query, sources, options } of commonQueries) {
      try {
        // Execute a dummy search to populate cache
        await this.wrapVectorSearch(
          async () => ({ warmed: true, timestamp: Date.now() }),
          query,
          sources,
          options || {},
        );
      } catch (_error) {}
    }
  }
}

/**
 * Global vector store cache instance
 */
let globalVectorCache: VectorStoreCache | null = null;

/**
 * Get or create global vector store cache
 */
export function getVectorStoreCache(): VectorStoreCache {
  if (!globalVectorCache) {
    globalVectorCache = new VectorStoreCache();
  }
  return globalVectorCache;
}

/**
 * Decorator for automatic caching of vector store methods
 */
export function withVectorCache<T extends any[], R>(
  cacheKey: (args: T) => { query: string; sources: string[]; options?: any },
  ttl?: number,
) {
  return (
    _target: any,
    _propertyName: string,
    descriptor: PropertyDescriptor,
  ) => {
    const method = descriptor.value;

    descriptor.value = async function (...args: T): Promise<R> {
      const cache = getVectorStoreCache();
      const { query, sources, options } = cacheKey(args);

      return cache.wrapVectorSearch(
        () => method.apply(this, args),
        query,
        sources,
        options || {},
        ttl,
      );
    };

    return descriptor;
  };
}

/**
 * Decorator for automatic caching of agent methods
 */
export function withAgentCache<T extends any[], R>(
  cacheKey: (args: T) => { agentType: string; query: string; context?: any },
  ttl?: number,
) {
  return (
    _target: any,
    _propertyName: string,
    descriptor: PropertyDescriptor,
  ) => {
    const method = descriptor.value;

    descriptor.value = async function (...args: T): Promise<R> {
      const cache = getVectorStoreCache();
      const { agentType, query, context } = cacheKey(args);

      return cache.wrapAgentResponse(
        () => method.apply(this, args),
        agentType,
        query,
        context || {},
        ttl,
      );
    };

    return descriptor;
  };
}
