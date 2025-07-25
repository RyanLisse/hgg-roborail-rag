import {
  calculateRetryDelay,
  classifyError,
  logError,
  shouldRetryError,
} from './errors';
import type {
  BaseServiceConfig,
  ClassifiedError,
  HealthCheckResult,
  ServiceMetrics,
  ServiceStatus,
  VectorStoreService,
} from './types';
import {
  BaseServiceConfig as BaseConfigSchema,
  ServiceStatus as ServiceStatusEnum,
} from './types';

/**
 * Abstract base class for all vector store services
 * Provides common functionality like error handling, monitoring, and health checks
 */
export abstract class BaseVectorStoreService<
  TConfig extends BaseServiceConfig = BaseServiceConfig,
  TSearchRequest = any,
  TSearchResult = any,
> implements VectorStoreService<TSearchRequest, TSearchResult>
{
  protected readonly config: TConfig;
  protected readonly _serviceName: string;
  protected _status: ServiceStatus;
  protected _metrics: ServiceMetrics[] = [];
  protected _lastHealthCheck?: HealthCheckResult;

  constructor(serviceName: string, config?: TConfig) {
    this._serviceName = serviceName;

    // Provide default config if none is provided
    if (config) {
      this.config = config;
    } else {
      // In test environments, services are typically disabled by default for safety
      const isTestEnv = process.env.NODE_ENV === 'test';
      const defaultConfig = BaseConfigSchema.parse({
        isEnabled: !isTestEnv, // Disabled in test by default, enabled otherwise
      });
      this.config = defaultConfig as TConfig;
    }

    this._status = this.config.isEnabled
      ? ServiceStatusEnum.ENABLED
      : ServiceStatusEnum.DISABLED;
  }

  // Public getters
  get serviceName(): string {
    return this._serviceName;
  }

  get isEnabled(): boolean {
    return this.config.isEnabled && this._status === ServiceStatusEnum.ENABLED;
  }

  get status(): ServiceStatus {
    return this._status;
  }

  // Abstract methods that must be implemented by subclasses
  protected abstract searchImplementation(
    request: TSearchRequest,
  ): Promise<TSearchResult[]>;
  protected abstract performHealthCheck(): Promise<void>;

  /**
   * Main search method with error handling and monitoring
   */
  async search(request: TSearchRequest): Promise<TSearchResult[]> {
    if (!this.isEnabled) {
      throw new Error(`${this._serviceName} service is disabled`);
    }

    const startTime = Date.now();
    let success = false;
    let error: ClassifiedError | undefined;

    try {
      const results = await this.withRetry(
        () => this.searchImplementation(request),
        'search',
      );
      success = true;
      return results;
    } catch (err) {
      error = classifyError(err as Error);
      logError(this._serviceName, 'search', error, {
        request,
      });
      throw err;
    } finally {
      this.recordMetric('search', success, Date.now() - startTime, error);
    }
  }

  /**
   * Health check with caching and monitoring
   */
  async healthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const now = new Date();

    try {
      if (!this.isEnabled) {
        const result: HealthCheckResult = {
          isHealthy: false,
          message: `${this._serviceName} service is disabled`,
          responseTime: 0,
          lastChecked: now,
        };
        this._lastHealthCheck = result;
        return result;
      }

      await this.performHealthCheck();

      const result: HealthCheckResult = {
        isHealthy: true,
        message: `${this._serviceName} service is healthy`,
        responseTime: Date.now() - startTime,
        lastChecked: now,
      };

      this._lastHealthCheck = result;
      this._status = ServiceStatusEnum.ENABLED;
      return result;
    } catch (err) {
      const error = classifyError(err as Error);
      logError(this._serviceName, 'healthCheck', error);

      const result: HealthCheckResult = {
        isHealthy: false,
        message: error.message,
        responseTime: Date.now() - startTime,
        error: error.originalError.message,
        lastChecked: now,
      };

      this._lastHealthCheck = result;
      this._status = ServiceStatusEnum.ERROR;
      return result;
    }
  }

  /**
   * Get service metrics
   */
  async getMetrics(): Promise<ServiceMetrics[]> {
    return [...this._metrics];
  }

  /**
   * Clear metrics (useful for testing)
   */
  clearMetrics(): void {
    this._metrics = [];
  }

  /**
   * Get last health check result
   */
  getLastHealthCheck(): HealthCheckResult | undefined {
    return this._lastHealthCheck;
  }

  /**
   * Retry logic with exponential backoff
   */
  protected async withRetry<T>(
    operation: () => Promise<T>,
    _operationName: string,
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (err) {
        lastError = err as Error;
        const classifiedError = classifyError(lastError);

        if (
          !shouldRetryError(classifiedError, attempt, this.config.maxRetries)
        ) {
          throw lastError;
        }

        const delay = calculateRetryDelay(
          classifiedError,
          attempt,
          this.config.retryDelay,
        );

        await this.sleep(delay);
      }
    }

    throw lastError || new Error('Operation failed after retries');
  }

  /**
   * Record performance metrics
   */
  protected recordMetric(
    operationName: string,
    success: boolean,
    duration: number,
    error?: ClassifiedError,
  ): void {
    const metric: ServiceMetrics = {
      operationName,
      success,
      duration,
      errorType: error?.type,
      timestamp: new Date(),
      serviceName: this._serviceName,
    };

    this._metrics.push(metric);

    // Keep only last 100 metrics to prevent memory leaks
    if (this._metrics.length > 100) {
      this._metrics = this._metrics.slice(-100);
    }
  }

  /**
   * Validate configuration with helpful error messages
   */
  protected static validateApiKey(
    apiKey: string | undefined,
    expectedPrefix: string,
    _serviceName: string,
  ): boolean {
    if (!apiKey) {
      return false;
    }

    if (!apiKey.startsWith(expectedPrefix)) {
      return false;
    }

    return true;
  }

  /**
   * Validate URL with helpful error messages
   */
  protected static validateUrl(
    url: string | undefined,
    _serviceName: string,
  ): boolean {
    if (!url) {
      return false;
    }

    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Sleep utility for retry delays
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Create a disabled service stub with helpful error messages
   */
  protected static createDisabledService<T extends VectorStoreService>(
    serviceName: string,
    reason: string,
  ): T {
    const disabledError = () => {
      throw new Error(`${serviceName} service is disabled: ${reason}`);
    };

    return {
      serviceName,
      isEnabled: false,
      status: ServiceStatusEnum.DISABLED,
      search: disabledError,
      healthCheck: async () => ({
        isHealthy: false,
        message: `${serviceName} service is disabled: ${reason}`,
        responseTime: 0,
        lastChecked: new Date(),
      }),
      getMetrics: async () => [],
    } as unknown as T;
  }
}
