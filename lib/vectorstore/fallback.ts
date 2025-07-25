import 'server-only';

import { z } from 'zod';

// ====================================
// FALLBACK CONFIGURATION
// ====================================

export enum FallbackMode {
  FAIL_FAST = 'FAIL_FAST', // Fail immediately without fallback
  GRACEFUL = 'GRACEFUL', // Try fallbacks gracefully
  SILENT = 'SILENT', // Return empty/default values
  CACHED = 'CACHED', // Return cached values if available
  PARTIAL = 'PARTIAL', // Return partial results
  RETURN_EMPTY = 'RETURN_EMPTY', // Return empty results when fallback fails
}

export const FallbackConfig = z.object({
  mode: z.nativeEnum(FallbackMode).default(FallbackMode.GRACEFUL),
  enableCaching: z.boolean().default(true),
  cacheRetentionMs: z.number().min(60_000).max(86_400_000).default(3_600_000), // 1 hour
  maxCacheSize: z.number().min(100).max(10_000).default(1000),
  fallbackTimeoutMs: z.number().min(1000).max(30_000).default(10_000),
  enablePartialResults: z.boolean().default(true),
  partialResultsThreshold: z.number().min(0).max(1).default(0.5), // Accept if 50% sources succeed
});

export type FallbackConfig = z.infer<typeof FallbackConfig>;

// ====================================
// CACHE MANAGEMENT
// ====================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
  metadata?: Record<string, any>;
}

export class FallbackCache {
  private cache = new Map<string, CacheEntry<any>>();
  private config: FallbackConfig;

  constructor(config?: Partial<FallbackConfig>) {
    this.config = FallbackConfig.parse(config || {});

    // Cleanup expired entries periodically
    setInterval(() => this.cleanup(), this.config.cacheRetentionMs / 4);
  }

  set<T>(key: string, value: T, customTtlMs?: number): void {
    const now = Date.now();
    const ttl = customTtlMs || this.config.cacheRetentionMs;

    // Enforce cache size limit
    if (this.cache.size >= this.config.maxCacheSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      data: value,
      timestamp: now,
      expiresAt: now + ttl,
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    return entry ? Date.now() <= entry.expiresAt : false;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Number.POSITIVE_INFINITY;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  getStats() {
    const now = Date.now();
    let expired = 0;
    let active = 0;

    for (const entry of this.cache.values()) {
      if (now > entry.expiresAt) {
        expired++;
      } else {
        active++;
      }
    }

    return {
      total: this.cache.size,
      active,
      expired,
      maxSize: this.config.maxCacheSize,
    };
  }
}

// ====================================
// FALLBACK MANAGER
// ====================================

export interface ServiceProvider<T> {
  name: string;
  priority: number; // Lower number = higher priority
  isAvailable: () => Promise<boolean>;
  execute: (...args: any[]) => Promise<T>;
  healthCheck?: () => Promise<boolean>;
  fallbackValue?: T;
}

export class FallbackManager<T> {
  private config: FallbackConfig;
  private cache: FallbackCache;
  private providers: ServiceProvider<T>[] = [];

  constructor(config?: Partial<FallbackConfig>) {
    this.config = FallbackConfig.parse(config || {});
    this.cache = new FallbackCache(this.config);
  }

  addProvider(provider: ServiceProvider<T>): void {
    this.providers.push(provider);
    // Sort by priority (lower number = higher priority)
    this.providers.sort((a, b) => a.priority - b.priority);
  }

  async execute(operation: string, args: any[], cacheKey?: string): Promise<T> {
    // Try to get from cache first
    if (cacheKey && this.config.enableCaching) {
      const cached = this.cache.get<T>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const results: Array<{
      provider: string;
      result: T | null;
      error: Error | null;
    }> = [];
    let lastError: Error | null = null;

    // Try each provider in priority order
    for (const provider of this.providers) {
      try {
        // Check if provider is available
        const isAvailable = await this.timeoutPromise(
          provider.isAvailable(),
          5000, // 5 second timeout for availability check
          false,
        );

        if (!isAvailable) {
          results.push({
            provider: provider.name,
            result: null,
            error: new Error('Provider not available'),
          });
          continue;
        }

        // Execute with timeout
        const result = await this.timeoutPromise(
          provider.execute(...args),
          this.config.fallbackTimeoutMs,
          null,
        );

        if (result !== null) {
          // Cache successful result
          if (cacheKey && this.config.enableCaching) {
            this.cache.set(cacheKey, result);
          }

          results.push({ provider: provider.name, result, error: null });
          return result;
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        lastError = err;
        results.push({ provider: provider.name, result: null, error: err });
      }
    }

    // All providers failed - apply fallback strategy
    return this.applyFallbackStrategy(operation, results, lastError, cacheKey);
  }

  private async applyFallbackStrategy(
    operation: string,
    results: Array<{ provider: string; result: T | null; error: Error | null }>,
    lastError: Error | null,
    cacheKey?: string,
  ): Promise<T> {
    switch (this.config.mode) {
      case FallbackMode.FAIL_FAST:
        throw lastError || new Error(`All providers failed for ${operation}`);

      case FallbackMode.CACHED:
        if (cacheKey) {
          // Try to get any cached value, even if expired
          const cached = this.cache.get<T>(cacheKey);
          if (cached) {
            return cached;
          }
        }
        throw (
          lastError ||
          new Error(`No cached fallback available for ${operation}`)
        );

      case FallbackMode.PARTIAL:
        if (this.config.enablePartialResults) {
          const partialResult = this.buildPartialResult(results);
          if (partialResult !== null) {
            return partialResult;
          }
        }
        throw (
          lastError ||
          new Error(`No partial results available for ${operation}`)
        );

      case FallbackMode.SILENT: {
        const defaultValue = this.getDefaultValue();
        return defaultValue;
      }

      case FallbackMode.GRACEFUL:
      default: {
        // Try cached values first
        if (cacheKey) {
          const cached = this.cache.get<T>(cacheKey);
          if (cached) {
            return cached;
          }
        }

        // Try partial results
        if (this.config.enablePartialResults) {
          const partialResult = this.buildPartialResult(results);
          if (partialResult !== null) {
            return partialResult;
          }
        }

        // Use provider fallback values
        for (const provider of this.providers) {
          if (provider.fallbackValue !== undefined) {
            return provider.fallbackValue;
          }
        }

        // Final fallback to default
        const defaultValue = this.getDefaultValue();
        return defaultValue;
      }
    }
  }

  private buildPartialResult(
    results: Array<{ provider: string; result: T | null; error: Error | null }>,
  ): T | null {
    const successfulResults = results.filter((r) => r.result !== null);
    const successRate = successfulResults.length / results.length;

    if (successRate < this.config.partialResultsThreshold) {
      return null;
    }

    // For search results, combine all successful results
    if (successfulResults.length > 0) {
      const firstResult = successfulResults[0].result;

      // If results are arrays (like search results), combine them
      if (Array.isArray(firstResult)) {
        const combined = [];
        for (const result of successfulResults) {
          if (Array.isArray(result.result)) {
            combined.push(...result.result);
          }
        }
        return combined as T;
      }

      // Otherwise return the first successful result
      return firstResult;
    }

    return null;
  }

  private getDefaultValue(): T {
    // Return appropriate default based on common patterns
    // This would be customized based on the specific service type
    return [] as T; // Default to empty array for search results
  }

  private async timeoutPromise<U>(
    promise: Promise<U>,
    timeoutMs: number,
    defaultValue: U,
  ): Promise<U> {
    const timeoutPromise = new Promise<U>((resolve) => {
      setTimeout(() => resolve(defaultValue), timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } catch (_error) {
      return defaultValue;
    }
  }

  async healthCheck(): Promise<{
    healthy: boolean;
    providers: Array<{ name: string; healthy: boolean; available: boolean }>;
    cache: any;
  }> {
    const providerHealth = await Promise.all(
      this.providers.map(async (provider) => {
        try {
          const available = await this.timeoutPromise(
            provider.isAvailable(),
            5000,
            false,
          );
          const healthy = provider.healthCheck
            ? await this.timeoutPromise(provider.healthCheck(), 5000, false)
            : available;

          return {
            name: provider.name,
            healthy,
            available,
          };
        } catch (_error) {
          return {
            name: provider.name,
            healthy: false,
            available: false,
          };
        }
      }),
    );

    const healthyCount = providerHealth.filter((p) => p.healthy).length;
    const overallHealthy = healthyCount > 0;

    return {
      healthy: overallHealthy,
      providers: providerHealth,
      cache: this.cache.getStats(),
    };
  }

  getConfig(): FallbackConfig {
    return this.config;
  }

  getCacheStats() {
    return this.cache.getStats();
  }

  clearCache(): void {
    this.cache.clear();
  }
}

// ====================================
// GRACEFUL DEGRADATION
// ====================================

export class GracefulDegradation {
  private static readonly degradationLevels = [
    'full_service',
    'reduced_functionality',
    'basic_service',
    'minimal_service',
    'emergency_mode',
  ];

  private currentLevel = 0; // Start with full service
  private degradationReasons: string[] = [];

  degrade(reason: string, level?: number): void {
    this.degradationReasons.push(reason);

    if (level !== undefined) {
      this.currentLevel = Math.max(this.currentLevel, level);
    } else {
      this.currentLevel = Math.min(
        this.currentLevel + 1,
        GracefulDegradation.degradationLevels.length - 1,
      );
    }
  }

  recover(steps = 1): void {
    const previousLevel = this.currentLevel;
    this.currentLevel = Math.max(0, this.currentLevel - steps);

    if (this.currentLevel < previousLevel) {
      // Clear some degradation reasons on recovery
      if (this.currentLevel === 0) {
        this.degradationReasons = [];
      }
    }
  }

  getCurrentLevel(): number {
    return this.currentLevel;
  }

  getCurrentLevelName(): string {
    return (
      GracefulDegradation.degradationLevels[this.currentLevel] || 'unknown'
    );
  }

  isDegraded(): boolean {
    return this.currentLevel > 0;
  }

  canPerformOperation(requiredLevel: number): boolean {
    return this.currentLevel <= requiredLevel;
  }

  getDegradationReasons(): string[] {
    return [...this.degradationReasons];
  }

  getStatus() {
    return {
      level: this.currentLevel,
      levelName: this.getCurrentLevelName(),
      isDegraded: this.isDegraded(),
      reasons: this.getDegradationReasons(),
    };
  }

  reset(): void {
    this.currentLevel = 0;
    this.degradationReasons = [];
  }
}
