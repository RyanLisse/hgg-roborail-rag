/**
 * Cache System Types and Interfaces
 * Comprehensive caching types for vector searches, agent responses, and system operations
 */

export interface CacheKey {
  prefix: string;
  key: string;
  version?: string;
}

export interface CacheEntry<T = any> {
  value: T;
  expiresAt: number;
  createdAt: number;
  hits: number;
  metadata?: Record<string, any>;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalKeys: number;
  memoryUsage: number;
  evictions: number;
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum number of entries
  serialize?: boolean; // Whether to serialize values
  namespace?: string; // Cache namespace for isolation
}

export interface CacheBackend {
  name: string;
  isConnected: boolean;
  
  // Core operations
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<boolean>;
  delete(key: string): Promise<boolean>;
  clear(pattern?: string): Promise<number>;
  
  // Advanced operations
  mget<T>(keys: string[]): Promise<Array<T | null>>;
  mset<T>(entries: Array<{ key: string; value: T; ttl?: number }>): Promise<boolean>;
  
  // Stats and health
  getStats(): Promise<CacheStats>;
  healthCheck(): Promise<boolean>;
  
  // Lifecycle
  connect?(): Promise<void>;
  disconnect?(): Promise<void>;
}

export interface DistributedCacheBackend extends CacheBackend {
  // Distributed operations
  publish(channel: string, message: any): Promise<boolean>;
  subscribe(channel: string, handler: (message: any) => void): Promise<void>;
  unsubscribe(channel: string): Promise<void>;
  
  // Distributed invalidation
  invalidatePattern(pattern: string): Promise<number>;
  notifyInvalidation(pattern: string): Promise<boolean>;
}

// Cache key types for different data types
export type VectorSearchCacheKey = {
  type: 'vector_search';
  query: string;
  sources: string[];
  options: string; // JSON serialized options
};

export type AgentRoutingCacheKey = {
  type: 'agent_routing';
  query: string;
  context: string; // JSON serialized context
};

export type AgentResponseCacheKey = {
  type: 'agent_response';
  agentType: string;
  query: string;
  context: string;
};

export type DocumentEmbeddingCacheKey = {
  type: 'document_embedding';
  content: string;
  model: string;
};

export type HealthCheckCacheKey = {
  type: 'health_check';
  service: string;
  endpoint: string;
};

export type CacheKeyTypes = 
  | VectorSearchCacheKey
  | AgentRoutingCacheKey
  | AgentResponseCacheKey
  | DocumentEmbeddingCacheKey
  | HealthCheckCacheKey;

// Cache configuration presets
export const CACHE_PRESETS = {
  VECTOR_SEARCH: {
    ttl: 15 * 60 * 1000, // 15 minutes
    namespace: 'vector_search',
    serialize: true,
  },
  AGENT_ROUTING: {
    ttl: 30 * 60 * 1000, // 30 minutes
    namespace: 'agent_routing',
    serialize: true,
  },
  AGENT_RESPONSE: {
    ttl: 10 * 60 * 1000, // 10 minutes
    namespace: 'agent_response',
    serialize: true,
  },
  DOCUMENT_EMBEDDING: {
    ttl: 24 * 60 * 60 * 1000, // 24 hours
    namespace: 'embedding',
    serialize: true,
  },
  HEALTH_CHECK: {
    ttl: 5 * 60 * 1000, // 5 minutes
    namespace: 'health',
    serialize: false,
  },
} as const;

// Environment-based cache configuration
export interface CacheConfig {
  backend: 'memory' | 'redis';
  redis?: {
    url: string;
    maxRetries: number;
    retryDelayMs: number;
    keyPrefix: string;
    enablePubSub: boolean;
  };
  memory?: {
    maxSize: number;
    maxMemoryMB: number;
    cleanupIntervalMs: number;
  };
  defaultTtl: number;
  enableMetrics: boolean;
  enableInvalidation: boolean;
}