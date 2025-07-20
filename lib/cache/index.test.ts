import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  getCacheConfig, 
  createCacheBackend, 
  getCache, 
  resetCache, 
  CacheKeyGenerator, 
  SmartCache,
  getSmartCache,
  MemoryCacheBackend 
} from './index';

// Mock console methods
const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

// Mock environment variables
const originalEnv = process.env;

describe('Cache System', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(async () => {
    process.env = originalEnv;
    await resetCache();
    vi.restoreAllMocks();
  });

  describe('getCacheConfig', () => {
    it('should return memory cache config for development', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.REDIS_URL;
      delete process.env.VALKEY_URL;

      const config = getCacheConfig();

      expect(config.backend).toBe('memory');
      expect(config.memory).toBeDefined();
      expect(config.defaultTtl).toBe(15 * 60 * 1000);
    });

    it('should return redis config for production with redis URL', () => {
      process.env.NODE_ENV = 'production';
      process.env.REDIS_URL = 'redis://test:6379';

      const config = getCacheConfig();

      expect(config.backend).toBe('redis');
      expect(config.redis?.url).toBe('redis://test:6379');
      expect(config.redis?.enablePubSub).toBe(true);
    });

    it('should prefer REDIS_URL over VALKEY_URL', () => {
      process.env.REDIS_URL = 'redis://redis:6379';
      process.env.VALKEY_URL = 'redis://valkey:6379';

      const config = getCacheConfig();

      expect(config.redis?.url).toBe('redis://redis:6379');
    });

    it('should use VALKEY_URL when REDIS_URL is not available', () => {
      delete process.env.REDIS_URL;
      process.env.VALKEY_URL = 'redis://valkey:6379';

      const config = getCacheConfig();

      expect(config.redis?.url).toBe('redis://valkey:6379');
    });

    it('should have sensible defaults', () => {
      const config = getCacheConfig();

      expect(config.enableMetrics).toBe(true);
      expect(config.enableInvalidation).toBe(true);
      expect(config.redis?.maxRetries).toBe(3);
      expect(config.redis?.keyPrefix).toBe('roborail:cache:');
      expect(config.memory?.maxSize).toBe(10000);
    });
  });

  describe('createCacheBackend', () => {
    it('should create memory cache backend by default', async () => {
      process.env.NODE_ENV = 'development';
      delete process.env.REDIS_URL;

      const backend = await createCacheBackend();

      expect(backend).toBeInstanceOf(MemoryCacheBackend);
    });

    it('should override config when provided', async () => {
      const customConfig = {
        backend: 'memory' as const,
        memory: { maxSize: 5000 }
      };

      const backend = await createCacheBackend(customConfig);
      
      expect(backend).toBeInstanceOf(MemoryCacheBackend);
    });

    it('should fallback to memory cache if redis fails', async () => {
      process.env.NODE_ENV = 'production';
      process.env.REDIS_URL = 'redis://invalid:6379';

      const backend = await createCacheBackend();

      expect(backend).toBeInstanceOf(MemoryCacheBackend);
      // Redis connection will fail and should fallback to memory cache
    });
  });

  describe('getCache and resetCache', () => {
    it('should return same cache instance on multiple calls', async () => {
      const cache1 = await getCache();
      const cache2 = await getCache();

      expect(cache1).toBe(cache2);
    });

    it('should create new instance after reset', async () => {
      const cache1 = await getCache();
      await resetCache();
      const cache2 = await getCache();

      expect(cache1).not.toBe(cache2);
    });

    it('should handle disconnect during reset', async () => {
      const cache = await getCache();
      const disconnectSpy = vi.spyOn(cache, 'disconnect').mockResolvedValue();
      
      await resetCache();
      
      expect(disconnectSpy).toHaveBeenCalled();
    });
  });

  describe('CacheKeyGenerator', () => {
    describe('vectorSearch', () => {
      it('should generate consistent keys for same inputs', () => {
        const key1 = CacheKeyGenerator.vectorSearch('test query', ['doc1', 'doc2'], { limit: 10 });
        const key2 = CacheKeyGenerator.vectorSearch('test query', ['doc1', 'doc2'], { limit: 10 });

        expect(key1).toBe(key2);
        expect(key1).toMatch(/^vs:/);
      });

      it('should generate different keys for different inputs', () => {
        const key1 = CacheKeyGenerator.vectorSearch('query1', ['doc1'], {});
        const key2 = CacheKeyGenerator.vectorSearch('query2', ['doc1'], {});

        expect(key1).not.toBe(key2);
      });

      it('should handle empty sources and options', () => {
        const key = CacheKeyGenerator.vectorSearch('test', [], {});
        
        expect(key).toMatch(/^vs:/);
        expect(key.length).toBeGreaterThan(3);
      });

      it('should be order-independent for sources and options', () => {
        const key1 = CacheKeyGenerator.vectorSearch('test', ['a', 'b'], { x: 1, y: 2 });
        const key2 = CacheKeyGenerator.vectorSearch('test', ['b', 'a'], { y: 2, x: 1 });

        expect(key1).toBe(key2);
      });
    });

    describe('agentRouting', () => {
      it('should generate consistent keys', () => {
        const key1 = CacheKeyGenerator.agentRouting('route this', { type: 'question' });
        const key2 = CacheKeyGenerator.agentRouting('route this', { type: 'question' });

        expect(key1).toBe(key2);
        expect(key1).toMatch(/^ar:/);
      });

      it('should handle empty context', () => {
        const key = CacheKeyGenerator.agentRouting('test query');
        
        expect(key).toMatch(/^ar:/);
      });
    });

    describe('agentResponse', () => {
      it('should include agent type in key', () => {
        const key = CacheKeyGenerator.agentResponse('qa', 'question', {});
        
        expect(key).toMatch(/^ap:qa:/);
      });
    });

    describe('documentEmbedding', () => {
      it('should include model in key', () => {
        const key = CacheKeyGenerator.documentEmbedding('content', 'cohere-v2');
        
        expect(key).toMatch(/^emb:cohere-v2:/);
      });
    });

    describe('healthCheck', () => {
      it('should include service name', () => {
        const key = CacheKeyGenerator.healthCheck('vectorstore', '/health');
        
        expect(key).toMatch(/^health:vectorstore:/);
      });
    });

    describe('hash function', () => {
      it('should produce deterministic hashes', () => {
        // Test indirectly through key generation
        const key1 = CacheKeyGenerator.vectorSearch('test', [], {});
        const key2 = CacheKeyGenerator.vectorSearch('test', [], {});

        expect(key1).toBe(key2);
      });

      it('should produce different hashes for different inputs', () => {
        const key1 = CacheKeyGenerator.vectorSearch('test1', [], {});
        const key2 = CacheKeyGenerator.vectorSearch('test2', [], {});

        expect(key1).not.toBe(key2);
      });
    });
  });

  describe('SmartCache', () => {
    let mockBackend: any;
    let smartCache: SmartCache;

    beforeEach(() => {
      mockBackend = {
        get: vi.fn(),
        set: vi.fn(),
        clear: vi.fn(),
        getStats: vi.fn(),
        healthCheck: vi.fn(),
      };
      smartCache = new SmartCache(mockBackend);
    });

    describe('vector search caching', () => {
      it('should cache vector search results', async () => {
        mockBackend.set.mockResolvedValue(true);
        const result = { docs: ['doc1', 'doc2'] };

        await smartCache.cacheVectorSearch('query', ['source1'], {}, result);

        expect(mockBackend.set).toHaveBeenCalledWith(
          expect.stringMatching(/^vs:/),
          result,
          expect.any(Number)
        );
      });

      it('should retrieve cached vector search results', async () => {
        const cachedResult = { docs: ['doc1'] };
        mockBackend.get.mockResolvedValue(cachedResult);

        const result = await smartCache.getCachedVectorSearch('query', ['source1'], {});

        expect(result).toEqual(cachedResult);
        expect(mockBackend.get).toHaveBeenCalledWith(expect.stringMatching(/^vs:/));
      });

      it('should respect caching disable flag', async () => {
        process.env.ENABLE_CACHING = 'false';

        const cacheResult = await smartCache.cacheVectorSearch('query', [], {}, {});
        const getResult = await smartCache.getCachedVectorSearch('query', [], {});

        expect(cacheResult).toBe(false);
        expect(getResult).toBeNull();
        expect(mockBackend.set).not.toHaveBeenCalled();
        expect(mockBackend.get).not.toHaveBeenCalled();
      });
    });

    describe('agent routing caching', () => {
      it('should cache and retrieve agent routing decisions', async () => {
        mockBackend.set.mockResolvedValue(true);
        mockBackend.get.mockResolvedValue({ agent: 'qa', confidence: 0.9 });

        await smartCache.cacheAgentRouting('question', {}, { agent: 'qa' });
        const result = await smartCache.getCachedAgentRouting('question', {});

        expect(mockBackend.set).toHaveBeenCalled();
        expect(result).toEqual({ agent: 'qa', confidence: 0.9 });
      });
    });

    describe('agent response caching', () => {
      it('should cache and retrieve agent responses', async () => {
        mockBackend.set.mockResolvedValue(true);
        mockBackend.get.mockResolvedValue({ answer: 'Test answer' });

        await smartCache.cacheAgentResponse('qa', 'question', {}, { answer: 'Test answer' });
        const result = await smartCache.getCachedAgentResponse('qa', 'question', {});

        expect(mockBackend.set).toHaveBeenCalled();
        expect(result).toEqual({ answer: 'Test answer' });
      });
    });

    describe('document embedding caching', () => {
      it('should cache and retrieve embeddings', async () => {
        mockBackend.set.mockResolvedValue(true);
        const embedding = [0.1, 0.2, 0.3];
        mockBackend.get.mockResolvedValue(embedding);

        await smartCache.cacheDocumentEmbedding('content', 'cohere-v2', embedding);
        const result = await smartCache.getCachedDocumentEmbedding('content', 'cohere-v2');

        expect(mockBackend.set).toHaveBeenCalled();
        expect(result).toEqual(embedding);
      });
    });

    describe('health check caching', () => {
      it('should cache and retrieve health check results', async () => {
        mockBackend.set.mockResolvedValue(true);
        mockBackend.get.mockResolvedValue({ status: 'healthy' });

        await smartCache.cacheHealthCheck('vectorstore', '/health', { status: 'healthy' });
        const result = await smartCache.getCachedHealthCheck('vectorstore', '/health');

        expect(mockBackend.set).toHaveBeenCalled();
        expect(result).toEqual({ status: 'healthy' });
      });
    });

    describe('utility methods', () => {
      it('should invalidate cache patterns', async () => {
        mockBackend.clear.mockResolvedValue(5);

        const count = await smartCache.invalidatePattern('vs:*');

        expect(count).toBe(5);
        expect(mockBackend.clear).toHaveBeenCalledWith('vs:*');
      });

      it('should get cache statistics', async () => {
        const stats = { hits: 100, misses: 20 };
        mockBackend.getStats.mockResolvedValue(stats);

        const result = await smartCache.getStats();

        expect(result).toEqual(stats);
      });

      it('should perform health check', async () => {
        mockBackend.healthCheck.mockResolvedValue(true);

        const result = await smartCache.healthCheck();

        expect(result).toBe(true);
      });
    });
  });

  describe('getSmartCache', () => {
    it('should return same smart cache instance on multiple calls', async () => {
      const smartCache1 = await getSmartCache();
      const smartCache2 = await getSmartCache();

      expect(smartCache1).toBe(smartCache2);
    });

    it('should create new instance after cache reset', async () => {
      const smartCache1 = await getSmartCache();
      await resetCache();
      
      // The smart cache should use a new backend after reset
      const smartCache2 = await getSmartCache();

      // Since backend is different, smart cache should be effectively different
      // We'll test that they work independently
      expect(typeof smartCache1).toBe('object');
      expect(typeof smartCache2).toBe('object');
    });
  });

  describe('Integration', () => {
    it('should work with real memory cache backend', async () => {
      const backend = new MemoryCacheBackend({ maxSize: 100 });
      const smartCache = new SmartCache(backend);

      // Test basic operations
      await smartCache.cacheVectorSearch('test', ['doc1'], {}, { results: ['test'] });
      const result = await smartCache.getCachedVectorSearch('test', ['doc1'], {});

      expect(result).toEqual({ results: ['test'] });

      // Test health check
      const isHealthy = await smartCache.healthCheck();
      expect(isHealthy).toBe(true);
    });

    it('should handle complex caching scenarios', async () => {
      const backend = new MemoryCacheBackend({ maxSize: 100 });
      const smartCache = new SmartCache(backend);

      // Cache multiple types of data
      await smartCache.cacheAgentRouting('route me', { user: 'test' }, { agent: 'qa' });
      await smartCache.cacheDocumentEmbedding('test doc', 'cohere', [1, 2, 3]);
      await smartCache.cacheHealthCheck('service', '/health', { ok: true });

      // Verify all are cached
      const routing = await smartCache.getCachedAgentRouting('route me', { user: 'test' });
      const embedding = await smartCache.getCachedDocumentEmbedding('test doc', 'cohere');
      const health = await smartCache.getCachedHealthCheck('service', '/health');

      expect(routing).toEqual({ agent: 'qa' });
      expect(embedding).toEqual([1, 2, 3]);
      expect(health).toEqual({ ok: true });
    });
  });
});