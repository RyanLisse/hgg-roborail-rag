import "server-only";

import { z } from "zod";

// ====================================
// ERROR CLASSIFICATION SYSTEM
// ====================================

export enum ErrorCategory {
  // Retryable errors
  NETWORK = "NETWORK",
  TIMEOUT = "TIMEOUT",
  RATE_LIMIT = "RATE_LIMIT",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
  TEMPORARY_FAILURE = "TEMPORARY_FAILURE",

  // Non-retryable errors
  AUTHENTICATION = "AUTHENTICATION",
  AUTHORIZATION = "AUTHORIZATION",
  INVALID_REQUEST = "INVALID_REQUEST",
  NOT_FOUND = "NOT_FOUND",
  CONFIGURATION = "CONFIGURATION",
  VALIDATION = "VALIDATION",

  // System errors
  UNKNOWN = "UNKNOWN",
  CRITICAL = "CRITICAL",
}

export enum ErrorSeverity {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export interface ClassifiedError {
  category: ErrorCategory;
  severity: ErrorSeverity;
  isRetryable: boolean;
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitterFactor: number;
  originalError: Error;
  context?: Record<string, any>;
  recoveryStrategies: RecoveryStrategy[];
}

// ====================================
// RECOVERY STRATEGIES
// ====================================

export enum RecoveryStrategyType {
  RETRY = "RETRY",
  FALLBACK_SERVICE = "FALLBACK_SERVICE",
  CIRCUIT_BREAKER = "CIRCUIT_BREAKER",
  GRACEFUL_DEGRADATION = "GRACEFUL_DEGRADATION",
  CACHE_FALLBACK = "CACHE_FALLBACK",
  PARTIAL_RESULTS = "PARTIAL_RESULTS",
}

export interface RecoveryStrategy {
  type: RecoveryStrategyType;
  priority: number; // Lower number = higher priority
  conditions: string[]; // Conditions when this strategy applies
  action: () => Promise<any>;
  fallbackValue?: any;
}

// ====================================
// RETRY CONFIGURATION
// ====================================

export const RetryConfig = z.object({
  maxRetries: z.number().min(0).max(10).default(3),
  baseDelayMs: z.number().min(100).max(30_000).default(1000),
  maxDelayMs: z.number().min(1000).max(60_000).default(30_000),
  backoffMultiplier: z.number().min(1).max(10).default(2),
  jitterFactor: z.number().min(0).max(1).default(0.1),
  timeoutMs: z.number().min(1000).max(300_000).default(30_000),
});

export type RetryConfig = z.infer<typeof RetryConfig>;

// ====================================
// CIRCUIT BREAKER CONFIGURATION
// ====================================

export enum CircuitBreakerState {
  CLOSED = "CLOSED", // Normal operation
  OPEN = "OPEN", // Blocking calls
  HALF_OPEN = "HALF_OPEN", // Testing if service recovered
}

export const CircuitBreakerConfig = z.object({
  failureThreshold: z.number().min(1).max(100).default(5),
  recoveryTimeoutMs: z.number().min(5000).max(300_000).default(60_000),
  monitorWindowMs: z.number().min(10_000).max(600_000).default(60_000),
  minimumThroughput: z.number().min(1).max(1000).default(10),
  successThreshold: z.number().min(1).max(10).default(3),
});

export type CircuitBreakerConfig = z.infer<typeof CircuitBreakerConfig>;

// ====================================
// ERROR CLASSIFIER
// ====================================

// biome-ignore lint/complexity/noStaticOnlyClass: Utility class pattern for organized functionality
export class ErrorClassifier {
  static classify(
    error: Error,
    context?: Record<string, any>,
  ): ClassifiedError {
    const errorMessage = error.message.toLowerCase();
    const errorName = error.name.toLowerCase();

    // Network and connectivity errors
    if (ErrorClassifier.isNetworkError(error, errorMessage)) {
      return {
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.MEDIUM,
        isRetryable: true,
        maxRetries: 3,
        baseDelayMs: 1000,
        maxDelayMs: 10_000,
        jitterFactor: 0.1,
        originalError: error,
        context,
        recoveryStrategies: [
          {
            type: RecoveryStrategyType.RETRY,
            priority: 1,
            conditions: ["network_retry"],
            action: async () => null,
          },
          {
            type: RecoveryStrategyType.FALLBACK_SERVICE,
            priority: 2,
            conditions: ["service_available"],
            action: async () => null,
          },
        ],
      };
    }

    // Rate limiting errors
    if (ErrorClassifier.isRateLimitError(error, errorMessage)) {
      return {
        category: ErrorCategory.RATE_LIMIT,
        severity: ErrorSeverity.MEDIUM,
        isRetryable: true,
        maxRetries: 5,
        baseDelayMs: 2000,
        maxDelayMs: 30_000,
        jitterFactor: 0.2,
        originalError: error,
        context,
        recoveryStrategies: [
          {
            type: RecoveryStrategyType.RETRY,
            priority: 1,
            conditions: ["rate_limit_retry"],
            action: async () => null,
          },
          {
            type: RecoveryStrategyType.FALLBACK_SERVICE,
            priority: 2,
            conditions: ["alternative_service"],
            action: async () => null,
          },
        ],
      };
    }

    // Authentication errors
    if (ErrorClassifier.isAuthenticationError(error, errorMessage)) {
      return {
        category: ErrorCategory.AUTHENTICATION,
        severity: ErrorSeverity.HIGH,
        isRetryable: false,
        maxRetries: 0,
        baseDelayMs: 0,
        maxDelayMs: 0,
        jitterFactor: 0,
        originalError: error,
        context,
        recoveryStrategies: [
          {
            type: RecoveryStrategyType.GRACEFUL_DEGRADATION,
            priority: 1,
            conditions: ["auth_fallback"],
            action: async () => null,
          },
        ],
      };
    }

    // Timeout errors
    if (ErrorClassifier.isTimeoutError(error, errorMessage)) {
      return {
        category: ErrorCategory.TIMEOUT,
        severity: ErrorSeverity.MEDIUM,
        isRetryable: true,
        maxRetries: 2,
        baseDelayMs: 500,
        maxDelayMs: 5000,
        jitterFactor: 0.1,
        originalError: error,
        context,
        recoveryStrategies: [
          {
            type: RecoveryStrategyType.RETRY,
            priority: 1,
            conditions: ["timeout_retry"],
            action: async () => null,
          },
          {
            type: RecoveryStrategyType.PARTIAL_RESULTS,
            priority: 2,
            conditions: ["partial_acceptable"],
            action: async () => null,
          },
        ],
      };
    }

    // Service unavailable
    if (ErrorClassifier.isServiceUnavailableError(error, errorMessage)) {
      return {
        category: ErrorCategory.SERVICE_UNAVAILABLE,
        severity: ErrorSeverity.HIGH,
        isRetryable: true,
        maxRetries: 3,
        baseDelayMs: 5000,
        maxDelayMs: 30_000,
        jitterFactor: 0.2,
        originalError: error,
        context,
        recoveryStrategies: [
          {
            type: RecoveryStrategyType.CIRCUIT_BREAKER,
            priority: 1,
            conditions: ["circuit_breaker_applicable"],
            action: async () => null,
          },
          {
            type: RecoveryStrategyType.FALLBACK_SERVICE,
            priority: 2,
            conditions: ["fallback_available"],
            action: async () => null,
          },
        ],
      };
    }

    // Validation errors
    if (ErrorClassifier.isValidationError(error, errorMessage)) {
      return {
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.LOW,
        isRetryable: false,
        maxRetries: 0,
        baseDelayMs: 0,
        maxDelayMs: 0,
        jitterFactor: 0,
        originalError: error,
        context,
        recoveryStrategies: [
          {
            type: RecoveryStrategyType.GRACEFUL_DEGRADATION,
            priority: 1,
            conditions: ["validation_fallback"],
            action: async () => null,
          },
        ],
      };
    }

    // Default: Unknown error
    return {
      category: ErrorCategory.UNKNOWN,
      severity: ErrorSeverity.MEDIUM,
      isRetryable: true,
      maxRetries: 1,
      baseDelayMs: 1000,
      maxDelayMs: 5000,
      jitterFactor: 0.1,
      originalError: error,
      context,
      recoveryStrategies: [
        {
          type: RecoveryStrategyType.RETRY,
          priority: 1,
          conditions: ["unknown_retry"],
          action: async () => null,
        },
        {
          type: RecoveryStrategyType.GRACEFUL_DEGRADATION,
          priority: 2,
          conditions: ["unknown_fallback"],
          action: async () => null,
        },
      ],
    };
  }

  private static isNetworkError(error: Error, message: string): boolean {
    const networkPatterns = [
      "fetch failed",
      "network error",
      "connection refused",
      "connection timeout",
      "dns lookup failed",
      "socket hang up",
      "econnreset",
      "enotfound",
      "etimedout",
      "request failed",
      "unable to connect",
    ];

    return (
      networkPatterns.some((pattern) => message.includes(pattern)) ||
      error.name === "NetworkError" ||
      error.name === "FetchError"
    );
  }

  private static isRateLimitError(error: Error, message: string): boolean {
    const rateLimitPatterns = [
      "rate limit",
      "too many requests",
      "quota exceeded",
      "throttled",
      "rate exceeded",
      "limit exceeded",
      "429",
    ];

    return rateLimitPatterns.some((pattern) => message.includes(pattern));
  }

  private static isAuthenticationError(error: Error, message: string): boolean {
    const authPatterns = [
      "unauthorized",
      "authentication failed",
      "invalid api key",
      "access denied",
      "forbidden",
      "invalid credentials",
      "401",
      "403",
    ];

    return authPatterns.some((pattern) => message.includes(pattern));
  }

  private static isTimeoutError(error: Error, message: string): boolean {
    const timeoutPatterns = [
      "timeout",
      "timed out",
      "request timeout",
      "response timeout",
      "operation timeout",
    ];

    return (
      timeoutPatterns.some((pattern) => message.includes(pattern)) ||
      error.name === "TimeoutError"
    );
  }

  private static isServiceUnavailableError(
    error: Error,
    message: string,
  ): boolean {
    const unavailablePatterns = [
      "service unavailable",
      "server error",
      "internal server error",
      "bad gateway",
      "gateway timeout",
      "500",
      "502",
      "503",
      "504",
    ];

    return unavailablePatterns.some((pattern) => message.includes(pattern));
  }

  private static isValidationError(error: Error, message: string): boolean {
    const validationPatterns = [
      "validation",
      "invalid input",
      "bad request",
      "malformed",
      "invalid parameter",
      "400",
    ];

    return (
      validationPatterns.some((pattern) => message.includes(pattern)) ||
      error.name === "ValidationError" ||
      error.name === "ZodError"
    );
  }
}

// ====================================
// RETRY MECHANISM
// ====================================

export class RetryMechanism {
  private config: RetryConfig;

  constructor(config?: Partial<RetryConfig>) {
    this.config = RetryConfig.parse(config || {});
  }

  async execute<T>(
    operation: () => Promise<T>,
    context?: Record<string, any>,
  ): Promise<T> {
    let lastError: Error | null = null;
    let attempt = 0;

    while (attempt <= this.config.maxRetries) {
      try {
        // Add timeout wrapper with cleanup
        let timeoutId: NodeJS.Timeout | null = null;
        const timeoutPromise = new Promise<never>((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error("Operation timeout")),
            this.config.timeoutMs,
          );
        });

        try {
          const result = await Promise.race([operation(), timeoutPromise]);
          // Clear timeout on success
          if (timeoutId) clearTimeout(timeoutId);

          if (attempt > 0) {
            console.log(`✅ Operation succeeded on attempt ${attempt + 1}`);
          }

          return result;
        } catch (error) {
          // Clear timeout on error before rethrowing
          if (timeoutId) clearTimeout(timeoutId);
          throw error;
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempt++;

        // Classify the error
        const classifiedError = ErrorClassifier.classify(lastError, context);

        // Don't retry if error is not retryable
        if (!classifiedError.isRetryable) {
          console.log(`❌ Non-retryable error: ${classifiedError.category}`);
          throw lastError;
        }

        // Don't retry if we've exceeded max retries
        if (attempt > this.config.maxRetries) {
          console.log(`❌ Max retries (${this.config.maxRetries}) exceeded`);
          break;
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(attempt, classifiedError);

        console.log(`⚠️ Attempt ${attempt} failed: ${lastError.message}`);
        console.log(
          `⏳ Retrying in ${delay}ms... (${this.config.maxRetries - attempt} attempts remaining)`,
        );

        await this.sleep(delay);
      }
    }

    throw lastError || new Error("Operation failed after retries");
  }

  private calculateDelay(
    attempt: number,
    classifiedError: ClassifiedError,
  ): number {
    // Use error-specific delay configuration
    const baseDelay = classifiedError.baseDelayMs;
    const maxDelay = classifiedError.maxDelayMs;
    const jitter = classifiedError.jitterFactor;

    // Exponential backoff
    const exponentialDelay = Math.min(
      baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1),
      maxDelay,
    );

    // Add jitter to prevent thundering herd
    const jitterAmount = exponentialDelay * jitter * Math.random();
    const finalDelay = exponentialDelay + jitterAmount;

    return Math.floor(finalDelay);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ====================================
// CIRCUIT BREAKER
// ====================================

export class CircuitBreaker {
  private config: CircuitBreakerConfig;
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime = 0;
  private requestCount = 0;
  private windowStartTime = Date.now();

  constructor(
    private name: string,
    config?: Partial<CircuitBreakerConfig>,
  ) {
    this.config = CircuitBreakerConfig.parse(config || {});
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    // Check if we should reset the monitoring window
    this.checkMonitoringWindow();

    // Check circuit breaker state
    if (this.state === CircuitBreakerState.OPEN) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitBreakerState.HALF_OPEN;
        this.successCount = 0;
        console.log(
          `🔄 Circuit breaker [${this.name}] moved to HALF_OPEN state`,
        );
      } else {
        throw new Error(
          `Circuit breaker [${this.name}] is OPEN - service unavailable`,
        );
      }
    }

    this.requestCount++;

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.successCount++;

      if (this.successCount >= this.config.successThreshold) {
        this.state = CircuitBreakerState.CLOSED;
        this.successCount = 0;
        console.log(`✅ Circuit breaker [${this.name}] moved to CLOSED state`);
      }
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitBreakerState.HALF_OPEN) {
      this.state = CircuitBreakerState.OPEN;
      console.log(`❌ Circuit breaker [${this.name}] moved back to OPEN state`);
    } else if (this.state === CircuitBreakerState.CLOSED && this.shouldTrip()) {
      this.state = CircuitBreakerState.OPEN;
      console.log(
        `🚨 Circuit breaker [${this.name}] TRIPPED - moved to OPEN state`,
      );
    }
  }

  private shouldTrip(): boolean {
    return (
      this.requestCount >= this.config.minimumThroughput &&
      this.failureCount >= this.config.failureThreshold
    );
  }

  private shouldAttemptReset(): boolean {
    return Date.now() - this.lastFailureTime >= this.config.recoveryTimeoutMs;
  }

  private checkMonitoringWindow(): void {
    const now = Date.now();
    if (now - this.windowStartTime >= this.config.monitorWindowMs) {
      this.resetWindow();
    }
  }

  private resetWindow(): void {
    this.windowStartTime = Date.now();
    this.requestCount = 0;
    if (this.state === CircuitBreakerState.CLOSED) {
      this.failureCount = 0;
    }
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  getMetrics() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      requestCount: this.requestCount,
      lastFailureTime: this.lastFailureTime,
    };
  }
}
