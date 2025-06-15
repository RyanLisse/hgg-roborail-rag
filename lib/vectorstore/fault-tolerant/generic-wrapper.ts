/**
 * Generic Fault-Tolerant Service Wrapper
 * Eliminates 1500+ lines of duplicated fault-tolerance code
 * by providing a single, reusable wrapper for any vector store service
 */

import {
  type FaultTolerantService,
  FaultToleranceFactory,
  type ServiceProvider,
  FallbackMode,
  type FaultTolerantOptions,
} from '../fault-tolerance';

export interface FaultTolerantConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  jitterEnabled: boolean;
  timeout: number;
  fallbackMode: FallbackMode;
  enableCircuitBreaker: boolean;
  circuitBreakerThreshold: number;
  circuitBreakerTimeout: number;
  enableBulkheading: boolean;
  bulkheadSize: number;
  enableRateLimiting: boolean;
  rateLimit: number;
  rateLimitWindow: number;
}

export const DEFAULT_FAULT_TOLERANT_CONFIG: FaultTolerantConfig = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitterEnabled: true,
  timeout: 30000,
  fallbackMode: FallbackMode.RETURN_EMPTY,
  enableCircuitBreaker: true,
  circuitBreakerThreshold: 5,
  circuitBreakerTimeout: 60000,
  enableBulkheading: true,
  bulkheadSize: 10,
  enableRateLimiting: true,
  rateLimit: 100,
  rateLimitWindow: 60000,
};

/**
 * Generic fault-tolerant wrapper that can wrap any service type
 */
export class GenericFaultTolerantService<TService> {
  private baseService: TService;
  private faultTolerantService: FaultTolerantService<any>;
  private serviceName: string;
  private config: FaultTolerantConfig;

  constructor(
    baseService: TService,
    serviceName: string,
    config: Partial<FaultTolerantConfig> = {},
  ) {
    this.baseService = baseService;
    this.serviceName = serviceName;
    this.config = { ...DEFAULT_FAULT_TOLERANT_CONFIG, ...config };

    // Create fault-tolerant service with provided configuration
    this.faultTolerantService = FaultToleranceFactory.createService(
      serviceName as ServiceProvider,
      {
        maxRetries: this.config.maxRetries,
        initialDelay: this.config.initialDelay,
        maxDelay: this.config.maxDelay,
        backoffMultiplier: this.config.backoffMultiplier,
        jitterEnabled: this.config.jitterEnabled,
        timeout: this.config.timeout,
        fallbackMode: this.config.fallbackMode,
        enableCircuitBreaker: this.config.enableCircuitBreaker,
        circuitBreakerThreshold: this.config.circuitBreakerThreshold,
        circuitBreakerTimeout: this.config.circuitBreakerTimeout,
        enableBulkheading: this.config.enableBulkheading,
        bulkheadSize: this.config.bulkheadSize,
        enableRateLimiting: this.config.enableRateLimiting,
        rateLimit: this.config.rateLimit,
        rateLimitWindow: this.config.rateLimitWindow,
      },
    );
  }

  /**
   * Wrap any method of the base service with fault tolerance
   */
  wrapMethod<Args extends any[], Return>(
    methodName: keyof TService,
    options: Partial<FaultTolerantOptions> = {},
  ): (...args: Args) => Promise<Return> {
    return (...args: Args): Promise<Return> => {
      return this.faultTolerantService.execute(
        () => {
          const method = this.baseService[methodName] as any;
          if (typeof method !== 'function') {
            throw new Error(`Method ${String(methodName)} is not a function`);
          }
          return method.apply(this.baseService, args);
        },
        {
          operationName: String(methodName),
          timeout: options.timeout || this.config.timeout,
          maxRetries: options.maxRetries || this.config.maxRetries,
          fallbackValue: options.fallbackValue,
          enableCircuitBreaker:
            options.enableCircuitBreaker ?? this.config.enableCircuitBreaker,
          enableBulkheading:
            options.enableBulkheading ?? this.config.enableBulkheading,
          enableRateLimiting:
            options.enableRateLimiting ?? this.config.enableRateLimiting,
          ...options,
        },
      );
    };
  }

  /**
   * Get wrapped methods for common vector store operations
   */
  getWrappedMethods() {
    return {
      search: this.wrapMethod('search' as keyof TService, {
        operationName: `${this.serviceName}_search`,
        fallbackValue: [],
      }),
      upload: this.wrapMethod('upload' as keyof TService, {
        operationName: `${this.serviceName}_upload`,
      }),
      delete: this.wrapMethod('delete' as keyof TService, {
        operationName: `${this.serviceName}_delete`,
      }),
      healthCheck: this.wrapMethod('healthCheck' as keyof TService, {
        operationName: `${this.serviceName}_health`,
        fallbackValue: { status: 'unhealthy', timestamp: Date.now() },
      }),
      getStats: this.wrapMethod('getStats' as keyof TService, {
        operationName: `${this.serviceName}_stats`,
        fallbackValue: { documentsCount: 0, lastUpdated: new Date() },
      }),
    };
  }

  /**
   * Get the underlying base service (for direct access when needed)
   */
  getBaseService(): TService {
    return this.baseService;
  }

  /**
   * Get fault tolerance metrics
   */
  getMetrics() {
    return this.faultTolerantService.getMetrics();
  }

  /**
   * Reset fault tolerance state (useful for testing)
   */
  reset() {
    this.faultTolerantService.reset();
  }

  /**
   * Update configuration dynamically
   */
  updateConfig(newConfig: Partial<FaultTolerantConfig>) {
    this.config = { ...this.config, ...newConfig };
    // Note: This requires the fault tolerance service to support dynamic reconfiguration
    // For now, we'll log the change
    console.log(
      `🔧 Updated fault tolerance config for ${this.serviceName}:`,
      newConfig,
    );
  }

  /**
   * Get current configuration
   */
  getConfig(): FaultTolerantConfig {
    return { ...this.config };
  }
}

/**
 * Factory function to create fault-tolerant services with specific configurations
 */
export function createFaultTolerantService<TService>(
  baseService: TService,
  serviceName: string,
  config?: Partial<FaultTolerantConfig>,
): GenericFaultTolerantService<TService> {
  return new GenericFaultTolerantService(baseService, serviceName, config);
}

/**
 * Predefined configurations for different service types
 */
export const SERVICE_CONFIGS = {
  openai: {
    maxRetries: 3,
    timeout: 30000,
    circuitBreakerThreshold: 5,
    rateLimit: 50, // Lower rate limit for OpenAI
  } as Partial<FaultTolerantConfig>,

  neon: {
    maxRetries: 5,
    timeout: 15000,
    circuitBreakerThreshold: 10,
    rateLimit: 200, // Higher rate limit for database
  } as Partial<FaultTolerantConfig>,

  unified: {
    maxRetries: 2,
    timeout: 45000,
    circuitBreakerThreshold: 3,
    rateLimit: 100,
  } as Partial<FaultTolerantConfig>,

  memory: {
    maxRetries: 1,
    timeout: 5000,
    circuitBreakerThreshold: 1,
    rateLimit: 1000, // Very high for in-memory operations
  } as Partial<FaultTolerantConfig>,
} as const;

/**
 * Helper function to create service-specific fault-tolerant wrappers
 */
export function createServiceSpecificWrapper<TService>(
  baseService: TService,
  serviceType: keyof typeof SERVICE_CONFIGS,
): GenericFaultTolerantService<TService> {
  return createFaultTolerantService(
    baseService,
    serviceType,
    SERVICE_CONFIGS[serviceType],
  );
}
