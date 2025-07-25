/**
 * Redis Cache Backend with Distributed Invalidation
 * Production-ready cache with pub/sub for multi-instance coordination
 */

import type { CacheStats, DistributedCacheBackend } from './types';

export class RedisCacheBackend implements DistributedCacheBackend {
  public readonly name = 'redis';
  public isConnected = false;

  private client: any = null; // Redis client instance
  private subscriber: any = null; // Redis subscriber instance
  private publisher: any = null; // Redis publisher instance

  private stats = {
    hits: 0,
    misses: 0,
    errors: 0,
    reconnects: 0,
  };

  private readonly keyPrefix: string;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private subscriptions = new Map<string, Set<(message: any) => void>>();

  constructor(
    private config: {
      url: string;
      keyPrefix?: string;
      maxRetries?: number;
      retryDelayMs?: number;
      enablePubSub?: boolean;
    },
  ) {
    this.keyPrefix = config.keyPrefix ?? 'roborail:cache:';
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelayMs = config.retryDelayMs ?? 1000;
  }

  async connect(): Promise<void> {
    try {
      // Dynamic import to avoid bundling Redis in client-side code
      const { createClient } = await import('redis');

      // Create main client for cache operations
      this.client = createClient({
        url: this.config.url,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > this.maxRetries) {
              return false;
            }
            this.stats.reconnects++;
            return Math.min(retries * this.retryDelayMs, 5000);
          },
        },
      });

      // Create separate clients for pub/sub if enabled
      if (this.config.enablePubSub) {
        this.subscriber = this.client.duplicate();
        this.publisher = this.client.duplicate();

        await Promise.all([
          this.client.connect(),
          this.subscriber.connect(),
          this.publisher.connect(),
        ]);
      } else {
        await this.client.connect();
      }

      this.isConnected = true;
    } catch (error) {
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await Promise.all(
        [
          this.client?.quit(),
          this.subscriber?.quit(),
          this.publisher?.quit(),
        ].filter(Boolean),
      );

      this.isConnected = false;
      this.subscriptions.clear();
    } catch (_error) {}
  }

  private getKey(key: string): string {
    return `${this.keyPrefix}${key}`;
  }

  async get<T>(key: string): Promise<T | null> {
    if (!(this.isConnected && this.client)) {
      this.stats.misses++;
      return null;
    }

    try {
      const redisKey = this.getKey(key);
      const value = await this.client.get(redisKey);

      if (value === null) {
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      return JSON.parse(value) as T;
    } catch (_error) {
      this.stats.errors++;
      this.stats.misses++;
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    if (!(this.isConnected && this.client)) {
      return false;
    }

    try {
      const redisKey = this.getKey(key);
      const serializedValue = JSON.stringify(value);

      if (ttl) {
        await this.client.setEx(
          redisKey,
          Math.ceil(ttl / 1000),
          serializedValue,
        );
      } else {
        await this.client.set(redisKey, serializedValue);
      }

      return true;
    } catch (_error) {
      this.stats.errors++;
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    if (!(this.isConnected && this.client)) {
      return false;
    }

    try {
      const redisKey = this.getKey(key);
      const result = await this.client.del(redisKey);
      return result > 0;
    } catch (_error) {
      this.stats.errors++;
      return false;
    }
  }

  async clear(pattern?: string): Promise<number> {
    if (!(this.isConnected && this.client)) {
      return 0;
    }

    try {
      let searchPattern: string;

      if (pattern) {
        // Convert pattern to Redis pattern
        searchPattern = this.getKey(pattern.replace(/\*/g, '*'));
      } else {
        searchPattern = `${this.keyPrefix}*`;
      }

      const keys = await this.client.keys(searchPattern);

      if (keys.length === 0) {
        return 0;
      }

      const result = await this.client.del(keys);
      return result;
    } catch (_error) {
      this.stats.errors++;
      return 0;
    }
  }

  async mget<T>(keys: string[]): Promise<Array<T | null>> {
    if (!(this.isConnected && this.client) || keys.length === 0) {
      this.stats.misses += keys.length;
      return new Array(keys.length).fill(null);
    }

    try {
      const redisKeys = keys.map((key) => this.getKey(key));
      const values = await this.client.mGet(redisKeys);

      return values.map((value: string | null) => {
        if (value === null) {
          this.stats.misses++;
          return null;
        }

        try {
          this.stats.hits++;
          return JSON.parse(value) as T;
        } catch {
          this.stats.misses++;
          return null;
        }
      });
    } catch (_error) {
      this.stats.errors++;
      this.stats.misses += keys.length;
      return new Array(keys.length).fill(null);
    }
  }

  async mset<T>(
    entries: Array<{ key: string; value: T; ttl?: number }>,
  ): Promise<boolean> {
    if (!(this.isConnected && this.client) || entries.length === 0) {
      return false;
    }

    try {
      // Use pipeline for better performance
      const pipeline = this.client.multi();

      for (const entry of entries) {
        const redisKey = this.getKey(entry.key);
        const serializedValue = JSON.stringify(entry.value);

        if (entry.ttl) {
          pipeline.setEx(
            redisKey,
            Math.ceil(entry.ttl / 1000),
            serializedValue,
          );
        } else {
          pipeline.set(redisKey, serializedValue);
        }
      }

      await pipeline.exec();
      return true;
    } catch (_error) {
      this.stats.errors++;
      return false;
    }
  }

  async getStats(): Promise<CacheStats> {
    if (!(this.isConnected && this.client)) {
      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate: 0,
        totalKeys: 0,
        memoryUsage: 0,
        evictions: 0,
      };
    }

    try {
      const info = await this.client.info('memory');
      const keyCount = await this.client.dbSize();

      // Parse memory usage from Redis INFO output
      const memoryMatch = info.match(/used_memory:(\d+)/);
      const memoryUsage = memoryMatch ? Number.parseInt(memoryMatch[1], 10) : 0;

      const totalRequests = this.stats.hits + this.stats.misses;
      const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate,
        totalKeys: keyCount,
        memoryUsage,
        evictions: 0, // Redis handles evictions internally
      };
    } catch (_error) {
      this.stats.errors++;
      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        hitRate: 0,
        totalKeys: 0,
        memoryUsage: 0,
        evictions: 0,
      };
    }
  }

  async healthCheck(): Promise<boolean> {
    if (!(this.isConnected && this.client)) {
      return false;
    }

    try {
      const testKey = this.getKey('__health_check__');
      const testValue = { timestamp: Date.now() };

      await this.set(testKey, testValue, 1000); // 1 second TTL
      const retrieved = await this.get(testKey);
      await this.delete(testKey);

      return retrieved !== null;
    } catch (_error) {
      this.stats.errors++;
      return false;
    }
  }

  // Distributed cache methods

  async publish(channel: string, message: any): Promise<boolean> {
    if (!this.publisher) {
      return false;
    }

    try {
      const serializedMessage = JSON.stringify(message);
      await this.publisher.publish(channel, serializedMessage);
      return true;
    } catch (_error) {
      return false;
    }
  }

  async subscribe(
    channel: string,
    handler: (message: any) => void,
  ): Promise<void> {
    if (!this.subscriber) {
      throw new Error('Redis subscriber not available');
    }
    // Track handlers for this channel
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());

      // Subscribe to Redis channel
      await this.subscriber.subscribe(channel, (message: string) => {
        try {
          const parsedMessage = JSON.parse(message);
          const handlers = this.subscriptions.get(channel);

          if (handlers) {
            handlers.forEach((h) => h(parsedMessage));
          }
        } catch (_error) {}
      });
    }

    this.subscriptions.get(channel)?.add(handler);
  }

  async unsubscribe(channel: string): Promise<void> {
    if (!this.subscriber) {
      return;
    }

    try {
      await this.subscriber.unsubscribe(channel);
      this.subscriptions.delete(channel);
    } catch (_error) {}
  }

  async invalidatePattern(pattern: string): Promise<number> {
    const deleted = await this.clear(pattern);

    // Notify other instances about the invalidation
    await this.notifyInvalidation(pattern);

    return deleted;
  }

  async notifyInvalidation(pattern: string): Promise<boolean> {
    return this.publish('cache:invalidation', {
      pattern,
      timestamp: Date.now(),
      source: 'redis-cache',
    });
  }
}
