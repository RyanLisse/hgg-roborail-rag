/**
 * In-Memory Cache Backend with LRU Eviction
 * Optimized for development and single-instance deployments
 */

import type { CacheBackend, CacheEntry, CacheStats } from './types';

export class MemoryCacheBackend implements CacheBackend {
  public readonly name = 'memory';
  public isConnected = true;

  private cache = new Map<string, CacheEntry>();
  private accessOrder = new Map<string, number>(); // LRU tracking
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
  };

  private readonly maxSize: number;
  private readonly maxMemoryMB: number;
  private currentAccessTime = 0;
  private cleanupInterval?: NodeJS.Timeout;

  constructor(
    options: {
      maxSize?: number;
      maxMemoryMB?: number;
      cleanupIntervalMs?: number;
    } = {},
  ) {
    this.maxSize = options.maxSize ?? 10_000;
    this.maxMemoryMB = options.maxMemoryMB ?? 100;

    // Periodic cleanup of expired entries
    if (options.cleanupIntervalMs) {
      this.cleanupInterval = setInterval(() => {
        this.cleanupExpired();
      }, options.cleanupIntervalMs);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check expiration
    if (entry.expiresAt <= Date.now()) {
      this.cache.delete(key);
      this.accessOrder.delete(key);
      this.stats.misses++;
      return null;
    }

    // Update access tracking for LRU
    this.currentAccessTime++;
    this.accessOrder.set(key, this.currentAccessTime);
    entry.hits++;
    this.stats.hits++;

    return entry.value as T;
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<boolean> {
    try {
      // Calculate expiration time
      const expiresAt = ttl ? Date.now() + ttl : Number.MAX_SAFE_INTEGER;

      // Create cache entry
      const entry: CacheEntry<T> = {
        value,
        expiresAt,
        createdAt: Date.now(),
        hits: 0,
      };

      // Check if we need to evict entries
      if (this.cache.size >= this.maxSize) {
        await this.evictLRU();
      }

      // Check memory usage (approximate)
      const estimatedMemoryUsage = this.getEstimatedMemoryUsage();
      const maxMemoryBytes = this.maxMemoryMB * 1024 * 1024;

      if (estimatedMemoryUsage > maxMemoryBytes) {
        await this.evictOldest();
      }

      // Set the entry
      this.cache.set(key, entry);
      this.currentAccessTime++;
      this.accessOrder.set(key, this.currentAccessTime);

      return true;
    } catch (_error) {
      return false;
    }
  }

  async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    this.accessOrder.delete(key);
    return deleted;
  }

  async clear(pattern?: string): Promise<number> {
    if (!pattern) {
      const count = this.cache.size;
      this.cache.clear();
      this.accessOrder.clear();
      return count;
    }

    // Pattern-based deletion
    let deleted = 0;
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        this.accessOrder.delete(key);
        deleted++;
      }
    }

    return deleted;
  }

  async mget<T>(keys: string[]): Promise<Array<T | null>> {
    const results: Array<T | null> = [];

    for (const key of keys) {
      results.push(await this.get<T>(key));
    }

    return results;
  }

  async mset<T>(
    entries: Array<{ key: string; value: T; ttl?: number }>,
  ): Promise<boolean> {
    try {
      for (const entry of entries) {
        await this.set(entry.key, entry.value, entry.ttl);
      }
      return true;
    } catch (_error) {
      return false;
    }
  }

  async getStats(): Promise<CacheStats> {
    const totalRequests = this.stats.hits + this.stats.misses;
    const hitRate = totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate,
      totalKeys: this.cache.size,
      memoryUsage: this.getEstimatedMemoryUsage(),
      evictions: this.stats.evictions,
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      // Simple health check - try to set and get a test value
      const testKey = '__health_check__';
      const testValue = { timestamp: Date.now() };

      await this.set(testKey, testValue, 1000); // 1 second TTL
      const retrieved = await this.get(testKey);
      await this.delete(testKey);

      return retrieved !== null;
    } catch (_error) {
      return false;
    }
  }

  /**
   * Cleanup expired entries
   */
  private cleanupExpired(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt <= now) {
        this.cache.delete(key);
        this.accessOrder.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
    }
  }

  /**
   * Evict least recently used entries
   */
  private async evictLRU(): Promise<void> {
    if (this.accessOrder.size === 0) { return; }

    // Find the entry with the oldest access time
    let oldestKey: string | null = null;
    let oldestTime = Number.MAX_SAFE_INTEGER;

    for (const [key, accessTime] of this.accessOrder.entries()) {
      if (accessTime < oldestTime) {
        oldestTime = accessTime;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      this.accessOrder.delete(oldestKey);
      this.stats.evictions++;
    }
  }

  /**
   * Evict oldest entries by creation time
   */
  private async evictOldest(): Promise<void> {
    if (this.cache.size === 0) { return; }

    // Find entries to evict (oldest 10% of cache)
    const entriesToEvict = Math.max(1, Math.floor(this.cache.size * 0.1));
    const sortedEntries = Array.from(this.cache.entries()).sort(
      ([, a], [, b]) => a.createdAt - b.createdAt,
    );

    for (let i = 0; i < entriesToEvict && i < sortedEntries.length; i++) {
      const [key] = sortedEntries[i];
      this.cache.delete(key);
      this.accessOrder.delete(key);
      this.stats.evictions++;
    }
  }

  /**
   * Estimate memory usage (rough approximation)
   */
  private getEstimatedMemoryUsage(): number {
    let totalSize = 0;

    for (const [key, entry] of this.cache.entries()) {
      // Rough estimation: key size + value size
      totalSize += key.length * 2; // Unicode characters are 2 bytes
      totalSize += this.estimateValueSize(entry.value);
      totalSize += 64; // Overhead for entry metadata
    }

    return totalSize;
  }

  /**
   * Estimate size of a value in bytes
   */
  private estimateValueSize(value: any): number {
    if (value === null || value === undefined) { return 0; }

    if (typeof value === 'string') {
      return value.length * 2;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return 8;
    }

    // For objects, estimate based on JSON serialization
    try {
      return JSON.stringify(value).length * 2;
    } catch {
      return 1024; // Default estimate for complex objects
    }
  }

  /**
   * Cleanup resources
   */
  async disconnect(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }

    this.cache.clear();
    this.accessOrder.clear();
    this.isConnected = false;
  }
}
