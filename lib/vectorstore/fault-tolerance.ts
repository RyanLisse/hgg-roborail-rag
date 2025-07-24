import 'server-only';

import { z } from 'zod';
import {
  CircuitBreaker,
  CircuitBreakerConfig,
  type ClassifiedError,
  ErrorCategory,
  ErrorClassifier,
  RetryConfig,
  RetryMechanism,
} from './error-handling';
import {
  FallbackConfig,
  FallbackManager,
  GracefulDegradation,
  type ServiceProvider,
} from './fallback';

// ====================================
// FAULT TOLERANCE CONFIGURATION
// ====================================

export const FaultToleranceConfig = z.object({
  enableRetry: z.boolean().default(true),
  enableCircuitBreaker: z.boolean().default(true),
  enableFallback: z.boolean().default(true),
  enableGracefulDegradation: z.boolean().default(true),
  retryConfig: RetryConfig.optional(),
  circuitBreakerConfig: CircuitBreakerConfig.optional(),
  fallbackConfig: FallbackConfig.optional(),
  healthCheckIntervalMs: z.number().min(10_000).max(300_000).default(60_000),
  metricsRetentionMs: z
    .number()
    .min(300_000)
    .max(86_400_000)
    .default(3_600_000),
});

export type FaultToleranceConfig = z.infer<typeof FaultToleranceConfig>;

// Alias for backward compatibility
export type FaultTolerantOptions = FaultToleranceConfig;

// ====================================
// METRICS COLLECTION
// ====================================

export interface OperationMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  retriedRequests: number;
  circuitBreakerTrips: number;
  fallbackActivations: number;
  averageLatency: number;
  errorsByCategory: Record<string, number>;
  lastUpdated: number;
}

// ====================================
// FAULT TOLERANT SERVICE WRAPPER
// ====================================

export class FaultTolerantService<T> {
  private config: FaultToleranceConfig;
  private retryMechanism: RetryMechanism;
  private circuitBreaker: CircuitBreaker;
  private fallbackManager: FallbackManager<T>;
  private gracefulDegradation: GracefulDegradation;
  private metrics: OperationMetrics;
  private healthCheckTimer?: NodeJS.Timeout;

  constructor(
    private serviceName: string,
    config?: Partial<FaultToleranceConfig>,
  ) {
    this.config = FaultToleranceConfig.parse(config || {});

    // Initialize components
    this.retryMechanism = new RetryMechanism(this.config.retryConfig);
    this.circuitBreaker = new CircuitBreaker(
      serviceName,
      this.config.circuitBreakerConfig,
    );
    this.fallbackManager = new FallbackManager<T>(this.config.fallbackConfig);
    this.gracefulDegradation = new GracefulDegradation();

    // Initialize metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      retriedRequests: 0,
      circuitBreakerTrips: 0,
      fallbackActivations: 0,
      averageLatency: 0,
      errorsByCategory: {},
      lastUpdated: Date.now(),
    };

    // Start health monitoring
    this.startHealthMonitoring();
  }

  /**
   * Add a service provider for fallback
   */
  addProvider(provider: ServiceProvider<T>): void {
    this.fallbackManager.addProvider(provider);
  }

  /**
   * Execute an operation with full fault tolerance
   */
  async execute<R>(
    operation: () => Promise<R>,
    context?: {
      operationName?: string;
      cacheKey?: string;
      timeout?: number;
      bypassCircuitBreaker?: boolean;
      bypassRetry?: boolean;
      requiredServiceLevel?: number;
    },
  ): Promise<R> {
    const startTime = Date.now();
    const operationName = context?.operationName || 'unknown_operation';

    this.metrics.totalRequests++;

    try {
      // Check service degradation level
      if (
        context?.requiredServiceLevel !== undefined &&
        !this.gracefulDegradation.canPerformOperation(
          context.requiredServiceLevel,
        )
      ) {
        throw new Error(
          `Service degraded: operation requires level ${context.requiredServiceLevel}, current level is ${this.gracefulDegradation.getCurrentLevel()}`,
        );
      }

      let result: R;

      // Apply circuit breaker if enabled
      if (this.config.enableCircuitBreaker && !context?.bypassCircuitBreaker) {
        result = await this.circuitBreaker.execute(async () => {
          // Apply retry mechanism if enabled
          if (this.config.enableRetry && !context?.bypassRetry) {
            return await this.retryMechanism.execute(operation, {
              operationName,
              serviceName: this.serviceName,
              ...context,
            });
          } else {
            return await operation();
          }
        });
      } else {
        // Apply retry mechanism if enabled
        if (this.config.enableRetry && !context?.bypassRetry) {
          result = await this.retryMechanism.execute(operation, {
            operationName,
            serviceName: this.serviceName,
            ...context,
          });
        } else {
          result = await operation();
        }
      }

      // Record success metrics
      this.metrics.successfulRequests++;
      this.updateLatencyMetrics(Date.now() - startTime);

      // Attempt service recovery on success
      if (this.gracefulDegradation.isDegraded()) {
        this.gracefulDegradation.recover();
      }

      return result;
    } catch (error) {
      this.metrics.failedRequests++;
      const classifiedError = ErrorClassifier.classify(
        error instanceof Error ? error : new Error(String(error)),
      );

      // Update error metrics
      this.updateErrorMetrics(classifiedError);

      // Check if we should degrade service
      this.handleServiceDegradation(classifiedError, operationName);

      // Try fallback if enabled and error is suitable for fallback
      if (
        this.config.enableFallback &&
        this.shouldUseFallback(classifiedError)
      ) {
        try {

          // Use fallback manager to try alternative approaches
          const fallbackResult = await this.fallbackManager.execute(
            operationName,
            [], // No args for now - could be enhanced
            context?.cacheKey,
          );

          this.metrics.fallbackActivations++;

          return fallbackResult as R;
        } catch (_fallbackError) {
          // Continue to throw original error
        }
      }

      // If we reach here, all fault tolerance mechanisms have been exhausted
      this.updateLatencyMetrics(Date.now() - startTime);
      throw error;
    }
  }

  /**
   * Execute with fallback providers
   */
  async executeWithProviders(
    operationName: string,
    args: any[] = [],
    cacheKey?: string,
  ): Promise<T> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    try {
      const result = await this.fallbackManager.execute(
        operationName,
        args,
        cacheKey,
      );
      this.metrics.successfulRequests++;
      this.updateLatencyMetrics(Date.now() - startTime);
      return result;
    } catch (error) {
      this.metrics.failedRequests++;
      this.updateLatencyMetrics(Date.now() - startTime);
      throw error;
    }
  }

  /**
   * Health check for the service and all providers
   */
  async healthCheck(): Promise<{
    serviceName: string;
    healthy: boolean;
    degradationStatus: any;
    circuitBreakerStatus: any;
    fallbackStatus: any;
    metrics: OperationMetrics;
    timestamp: number;
  }> {
    const fallbackHealth = await this.fallbackManager.healthCheck();
    const circuitBreakerMetrics = this.circuitBreaker.getMetrics();

    const overallHealthy =
      fallbackHealth.healthy &&
      circuitBreakerMetrics.state !== 'OPEN' &&
      !this.gracefulDegradation.isDegraded();

    return {
      serviceName: this.serviceName,
      healthy: overallHealthy,
      degradationStatus: this.gracefulDegradation.getStatus(),
      circuitBreakerStatus: circuitBreakerMetrics,
      fallbackStatus: fallbackHealth,
      metrics: { ...this.metrics },
      timestamp: Date.now(),
    };
  }

  /**
   * Get current metrics
   */
  getMetrics(): OperationMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset all fault tolerance components
   */
  reset(): void {
    this.gracefulDegradation.reset();
    this.fallbackManager.clearCache();

    // Reset metrics
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      retriedRequests: 0,
      circuitBreakerTrips: 0,
      fallbackActivations: 0,
      averageLatency: 0,
      errorsByCategory: {},
      lastUpdated: Date.now(),
    };
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
  }

  // ====================================
  // PRIVATE METHODS
  // ====================================

  private shouldUseFallback(classifiedError: ClassifiedError): boolean {
    const fallbackableCategories = [
      ErrorCategory.NETWORK,
      ErrorCategory.TIMEOUT,
      ErrorCategory.SERVICE_UNAVAILABLE,
      ErrorCategory.RATE_LIMIT,
      ErrorCategory.TEMPORARY_FAILURE,
    ];

    return fallbackableCategories.includes(classifiedError.category);
  }

  private handleServiceDegradation(
    classifiedError: ClassifiedError,
    operationName: string,
  ): void {
    if (!this.config.enableGracefulDegradation) {
      return;
    }

    const degradationTriggers = [
      ErrorCategory.SERVICE_UNAVAILABLE,
      ErrorCategory.RATE_LIMIT,
      ErrorCategory.TIMEOUT,
    ];

    if (degradationTriggers.includes(classifiedError.category)) {
      const reason = `${operationName} failed: ${classifiedError.category}`;
      this.gracefulDegradation.degrade(reason);
    }
  }

  private updateErrorMetrics(classifiedError: ClassifiedError): void {
    const category = classifiedError.category.toString();
    this.metrics.errorsByCategory[category] =
      (this.metrics.errorsByCategory[category] || 0) + 1;
    this.metrics.lastUpdated = Date.now();
  }

  private updateLatencyMetrics(latency: number): void {
    // Simple moving average
    const alpha = 0.1; // Smoothing factor
    this.metrics.averageLatency =
      this.metrics.averageLatency === 0
        ? latency
        : alpha * latency + (1 - alpha) * this.metrics.averageLatency;

    this.metrics.lastUpdated = Date.now();
  }

  private startHealthMonitoring(): void {
    this.healthCheckTimer = setInterval(async () => {
      try {
        await this.performPeriodicHealthCheck();
      } catch (_error) {
      }
    }, this.config.healthCheckIntervalMs);
  }

  private async performPeriodicHealthCheck(): Promise<void> {
    const health = await this.healthCheck();

    // Log health status periodically
    if (!health.healthy) {
    }

    // Auto-recovery logic
    if (health.healthy && this.gracefulDegradation.isDegraded()) {
      this.gracefulDegradation.recover();
    }
  }
}

// ====================================
// FAULT TOLERANCE FACTORY
// ====================================

// biome-ignore lint/complexity/noStaticOnlyClass: Utility class pattern for organized functionality
export class FaultToleranceFactory {
  private static services = new Map<string, FaultTolerantService<any>>();

  static createService<T>(
    serviceName: string,
    config?: Partial<FaultToleranceConfig>,
  ): FaultTolerantService<T> {
    const existingService = FaultToleranceFactory.services.get(serviceName);
    if (existingService) {
      return existingService;
    }

    const service = new FaultTolerantService<T>(serviceName, config);
    FaultToleranceFactory.services.set(serviceName, service);
    return service;
  }

  static getService<T>(serviceName: string): FaultTolerantService<T> | null {
    return FaultToleranceFactory.services.get(serviceName) || null;
  }

  static async getSystemHealth(): Promise<{
    healthy: boolean;
    services: Array<{
      name: string;
      healthy: boolean;
      status: any;
    }>;
    timestamp: number;
  }> {
    const serviceHealthChecks = await Promise.all(
      Array.from(FaultToleranceFactory.services.entries()).map(
        async ([name, service]) => {
          try {
            const health = await service.healthCheck();
            return {
              name,
              healthy: health.healthy,
              status: health,
            };
          } catch (error) {
            return {
              name,
              healthy: false,
              status: {
                error: error instanceof Error ? error.message : String(error),
              },
            };
          }
        },
      ),
    );

    const overallHealthy = serviceHealthChecks.every((s) => s.healthy);

    return {
      healthy: overallHealthy,
      services: serviceHealthChecks,
      timestamp: Date.now(),
    };
  }

  static resetAll(): void {
    for (const service of FaultToleranceFactory.services.values()) {
      service.reset();
    }
  }

  static destroyAll(): void {
    for (const service of FaultToleranceFactory.services.values()) {
      service.destroy();
    }
    FaultToleranceFactory.services.clear();
  }
}

// ====================================
// FAULT TOLERANCE DECORATORS
// ====================================

export function withFaultTolerance<T extends any[], R>(
  serviceName: string,
  config?: Partial<FaultToleranceConfig>,
) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    const faultTolerantService = FaultToleranceFactory.createService<R>(
      serviceName,
      config,
    );

    descriptor.value = async function (...args: T): Promise<R> {
      return faultTolerantService.execute(
        () => originalMethod.apply(this, args),
        {
          operationName: `${target.constructor.name}.${propertyKey}`,
          cacheKey: `${serviceName}:${propertyKey}:${JSON.stringify(args).slice(0, 100)}`,
        },
      );
    };

    return descriptor;
  };
}

// Export everything needed
export {
  CircuitBreaker,
  type CircuitBreakerConfig,
  type ClassifiedError,
  ErrorCategory,
  ErrorClassifier,
  type RetryConfig,
  RetryMechanism,
} from './error-handling';

export type { FallbackConfig, ServiceProvider } from './fallback';

export { FallbackManager, FallbackMode, GracefulDegradation } from './fallback';
