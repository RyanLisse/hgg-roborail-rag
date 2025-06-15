import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  ErrorClassifier,
  RetryMechanism,
  CircuitBreaker,
  ErrorCategory,
  CircuitBreakerState,
} from './error-handling';
import {
  FallbackManager,
  type ServiceProvider,
  FallbackMode,
  GracefulDegradation,
} from './fallback';
import { FaultTolerantService, FaultToleranceFactory } from './fault-tolerance';

// Mock timers globally for all tests
vi.mock('server-only', () => ({}));

// ====================================
// ERROR CLASSIFICATION TESTS
// ====================================

describe('ErrorClassifier', () => {
  test('should classify network errors correctly', () => {
    const networkError = new Error('fetch failed');
    const classified = ErrorClassifier.classify(networkError);

    expect(classified.category).toBe(ErrorCategory.NETWORK);
    expect(classified.isRetryable).toBe(true);
    expect(classified.maxRetries).toBeGreaterThan(0);
  });

  test('should classify rate limit errors correctly', () => {
    const rateLimitError = new Error('Rate limit exceeded');
    const classified = ErrorClassifier.classify(rateLimitError);

    expect(classified.category).toBe(ErrorCategory.RATE_LIMIT);
    expect(classified.isRetryable).toBe(true);
    expect(classified.baseDelayMs).toBeGreaterThan(1000); // Should have longer delay
  });

  test('should classify authentication errors as non-retryable', () => {
    const authError = new Error('Unauthorized - 401');
    const classified = ErrorClassifier.classify(authError);

    expect(classified.category).toBe(ErrorCategory.AUTHENTICATION);
    expect(classified.isRetryable).toBe(false);
    expect(classified.maxRetries).toBe(0);
  });

  test('should classify timeout errors correctly', () => {
    const timeoutError = new Error('Request timeout');
    const classified = ErrorClassifier.classify(timeoutError);

    expect(classified.category).toBe(ErrorCategory.TIMEOUT);
    expect(classified.isRetryable).toBe(true);
  });

  test('should classify validation errors as non-retryable', () => {
    const validationError = new Error('Bad request - 400');
    const classified = ErrorClassifier.classify(validationError);

    expect(classified.category).toBe(ErrorCategory.VALIDATION);
    expect(classified.isRetryable).toBe(false);
  });

  test('should handle unknown errors with default classification', () => {
    const unknownError = new Error('Something weird happened');
    const classified = ErrorClassifier.classify(unknownError);

    expect(classified.category).toBe(ErrorCategory.UNKNOWN);
    expect(classified.isRetryable).toBe(true);
    expect(classified.maxRetries).toBe(1);
  });
});

// ====================================
// RETRY MECHANISM TESTS
// ====================================

describe('RetryMechanism', { timeout: 10000 }, () => {
  let retryMechanism: RetryMechanism;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    retryMechanism = new RetryMechanism({
      maxRetries: 3,
      baseDelayMs: 100,
      maxDelayMs: 1000,
      backoffMultiplier: 2,
      jitterFactor: 0.1,
      timeoutMs: 5000,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('should succeed on first attempt', async () => {
    const mockOperation = vi.fn().mockResolvedValue('success');

    const promise = retryMechanism.execute(mockOperation);
    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result).toBe('success');
    expect(mockOperation).toHaveBeenCalledTimes(1);
  });

  test('should retry on retryable errors', async () => {
    const mockOperation = vi
      .fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValue('success');

    const promise = retryMechanism.execute(mockOperation);

    // Run all timers to completion
    await vi.runAllTimersAsync();

    const result = await promise;

    expect(result).toBe('success');
    expect(mockOperation).toHaveBeenCalledTimes(3);
  });

  test('should not retry on non-retryable errors', async () => {
    const mockOperation = vi
      .fn()
      .mockRejectedValue(new Error('Unauthorized - 401'));

    await expect(retryMechanism.execute(mockOperation)).rejects.toThrow(
      'Unauthorized - 401',
    );

    expect(mockOperation).toHaveBeenCalledTimes(1);
  });

  test('should respect max retries limit', async () => {
    const mockOperation = vi.fn().mockRejectedValue(new Error('network error'));

    const promise = retryMechanism.execute(mockOperation);

    // Run all timers to completion
    await vi.runAllTimersAsync();

    await expect(promise).rejects.toThrow('network error');
    expect(mockOperation).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
  });

  test(
    'should timeout long-running operations',
    { timeout: 20000 },
    async () => {
      // Use real timers for this specific test as it's testing timeout behavior
      vi.useRealTimers();

      const slowOperation = vi.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(() => resolve('never'), 10000);
          }),
      );

      const shortTimeoutRetry = new RetryMechanism({ timeoutMs: 1000 });

      await expect(shortTimeoutRetry.execute(slowOperation)).rejects.toThrow(
        'Operation timeout',
      );

      // Re-enable fake timers for subsequent tests
      vi.useFakeTimers();
    },
  );
});

// ====================================
// CIRCUIT BREAKER TESTS
// ====================================

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    circuitBreaker = new CircuitBreaker('test', {
      failureThreshold: 3,
      recoveryTimeoutMs: 5000, // Changed from 1000 to meet minimum
      monitorWindowMs: 10000, // Changed from 5000 to meet minimum
      minimumThroughput: 2,
      successThreshold: 2,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('should start in CLOSED state', () => {
    expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
  });

  test('should trip to OPEN after failure threshold', async () => {
    const failingOperation = vi
      .fn()
      .mockRejectedValue(new Error('service error'));

    // Execute enough failing operations to trip the breaker
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(failingOperation);
      } catch {
        // Expected to fail
      }
    }

    expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);
  });

  test('should reject calls when OPEN', async () => {
    const failingOperation = vi
      .fn()
      .mockRejectedValue(new Error('service error'));

    // Trip the breaker
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(failingOperation);
      } catch {
        // Expected to fail
      }
    }

    // Next call should be rejected without calling the operation
    await expect(circuitBreaker.execute(failingOperation)).rejects.toThrow(
      'Circuit breaker',
    );
    expect(failingOperation).toHaveBeenCalledTimes(3); // Only the initial calls
  });

  test('should transition to HALF_OPEN after recovery timeout', async () => {
    const failingOperation = vi
      .fn()
      .mockRejectedValue(new Error('service error'));

    // Trip the breaker
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(failingOperation);
      } catch {
        // Expected to fail
      }
    }

    expect(circuitBreaker.getState()).toBe(CircuitBreakerState.OPEN);

    // Wait for recovery timeout
    vi.advanceTimersByTime(5100); // Updated to match new recovery timeout

    // Next call should move to HALF_OPEN
    const successOperation = vi.fn().mockResolvedValue('success');
    const result = await circuitBreaker.execute(successOperation);

    expect(result).toBe('success');
    expect(circuitBreaker.getState()).toBe(CircuitBreakerState.HALF_OPEN);
  });

  test('should close after successful operations in HALF_OPEN', async () => {
    // Trip the breaker first
    const failingOperation = vi
      .fn()
      .mockRejectedValue(new Error('service error'));
    for (let i = 0; i < 3; i++) {
      try {
        await circuitBreaker.execute(failingOperation);
      } catch {
        // Expected to fail
      }
    }

    // Wait for recovery
    vi.advanceTimersByTime(5100); // Updated to match new recovery timeout

    // Execute successful operations
    const successOperation = vi.fn().mockResolvedValue('success');

    await circuitBreaker.execute(successOperation); // Move to HALF_OPEN
    await circuitBreaker.execute(successOperation); // Should close the circuit

    expect(circuitBreaker.getState()).toBe(CircuitBreakerState.CLOSED);
  });
});

// ====================================
// FALLBACK MANAGER TESTS
// ====================================

describe('FallbackManager', { timeout: 10000 }, () => {
  let fallbackManager: FallbackManager<string>;
  let primaryProvider: ServiceProvider<string>;
  let secondaryProvider: ServiceProvider<string>;
  let emergencyProvider: ServiceProvider<string>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fallbackManager = new FallbackManager<string>({
      mode: FallbackMode.GRACEFUL,
      enableCaching: true,
      fallbackTimeoutMs: 1000,
    });

    primaryProvider = {
      name: 'primary',
      priority: 1,
      isAvailable: vi.fn().mockResolvedValue(true),
      execute: vi.fn().mockResolvedValue('primary-result'),
    };

    secondaryProvider = {
      name: 'secondary',
      priority: 2,
      isAvailable: vi.fn().mockResolvedValue(true),
      execute: vi.fn().mockResolvedValue('secondary-result'),
      fallbackValue: 'secondary-fallback',
    };

    emergencyProvider = {
      name: 'emergency',
      priority: 3,
      isAvailable: vi.fn().mockResolvedValue(true),
      execute: vi.fn().mockResolvedValue('emergency-result'),
      fallbackValue: 'emergency-fallback',
    };

    fallbackManager.addProvider(primaryProvider);
    fallbackManager.addProvider(secondaryProvider);
    fallbackManager.addProvider(emergencyProvider);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('should use primary provider when available', async () => {
    const result = await fallbackManager.execute('test-operation', []);

    expect(result).toBe('primary-result');
    expect(primaryProvider.execute).toHaveBeenCalled();
    expect(secondaryProvider.execute).not.toHaveBeenCalled();
  });

  test('should fallback to secondary when primary fails', async () => {
    vi.mocked(primaryProvider.execute).mockRejectedValue(
      new Error('primary failed'),
    );

    const result = await fallbackManager.execute('test-operation', []);

    expect(result).toBe('secondary-result');
    expect(primaryProvider.execute).toHaveBeenCalled();
    expect(secondaryProvider.execute).toHaveBeenCalled();
  });

  test('should use emergency provider when all others fail', async () => {
    vi.mocked(primaryProvider.execute).mockRejectedValue(
      new Error('primary failed'),
    );
    vi.mocked(secondaryProvider.execute).mockRejectedValue(
      new Error('secondary failed'),
    );

    const result = await fallbackManager.execute('test-operation', []);

    expect(result).toBe('emergency-result');
    expect(emergencyProvider.execute).toHaveBeenCalled();
  });

  test('should respect provider availability', async () => {
    vi.mocked(primaryProvider.isAvailable).mockResolvedValue(false);

    const result = await fallbackManager.execute('test-operation', []);

    expect(result).toBe('secondary-result');
    expect(primaryProvider.execute).not.toHaveBeenCalled();
    expect(secondaryProvider.execute).toHaveBeenCalled();
  });

  test('should cache successful results', async () => {
    const cacheKey = 'test-cache-key';

    // First call
    const result1 = await fallbackManager.execute(
      'test-operation',
      [],
      cacheKey,
    );
    expect(result1).toBe('primary-result');

    // Mock primary to fail
    vi.mocked(primaryProvider.execute).mockRejectedValue(
      new Error('primary failed'),
    );

    // Second call should use cache
    const result2 = await fallbackManager.execute(
      'test-operation',
      [],
      cacheKey,
    );
    expect(result2).toBe('primary-result'); // From cache, not secondary
  });

  test('should handle provider timeouts', { timeout: 20000 }, async () => {
    // Create a promise that never resolves to simulate a timeout
    let primaryResolve: any;
    vi.mocked(primaryProvider.execute).mockImplementation(
      () =>
        new Promise((resolve) => {
          primaryResolve = resolve;
          // Never call resolve to simulate hanging
        }),
    );

    const promise = fallbackManager.execute('test-operation', []);

    // Advance timers to trigger fallback timeout
    await vi.advanceTimersByTimeAsync(1100);

    const result = await promise;

    // Should timeout and use secondary provider
    expect(result).toBe('secondary-result');
    expect(primaryProvider.execute).toHaveBeenCalled();
    expect(secondaryProvider.execute).toHaveBeenCalled();

    // Clean up - resolve the hanging promise
    if (primaryResolve) {
      primaryResolve('cleanup');
    }
  });
});

// ====================================
// GRACEFUL DEGRADATION TESTS
// ====================================

describe('GracefulDegradation', () => {
  let degradation: GracefulDegradation;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    degradation = new GracefulDegradation();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('should start at full service level', () => {
    expect(degradation.getCurrentLevel()).toBe(0);
    expect(degradation.getCurrentLevelName()).toBe('full_service');
    expect(degradation.isDegraded()).toBe(false);
  });

  test('should degrade service level', () => {
    degradation.degrade('Test failure');

    expect(degradation.getCurrentLevel()).toBe(1);
    expect(degradation.getCurrentLevelName()).toBe('reduced_functionality');
    expect(degradation.isDegraded()).toBe(true);
  });

  test('should track degradation reasons', () => {
    degradation.degrade('Network failure');
    degradation.degrade('Database timeout');

    const reasons = degradation.getDegradationReasons();
    expect(reasons).toContain('Network failure');
    expect(reasons).toContain('Database timeout');
  });

  test('should allow recovery', () => {
    degradation.degrade('Test failure');
    degradation.degrade('Another failure');

    expect(degradation.getCurrentLevel()).toBe(2);

    degradation.recover();
    expect(degradation.getCurrentLevel()).toBe(1);

    degradation.recover();
    expect(degradation.getCurrentLevel()).toBe(0);
    expect(degradation.isDegraded()).toBe(false);
  });

  test('should check operation availability', () => {
    degradation.degrade('Test failure');
    degradation.degrade('Another failure'); // Level 2

    expect(degradation.canPerformOperation(3)).toBe(true); // Basic operations allowed
    expect(degradation.canPerformOperation(1)).toBe(false); // Advanced operations blocked
    expect(degradation.canPerformOperation(0)).toBe(false); // Full service operations blocked
  });

  test('should reset completely', () => {
    degradation.degrade('Test failure');
    degradation.degrade('Another failure');

    degradation.reset();

    expect(degradation.getCurrentLevel()).toBe(0);
    expect(degradation.isDegraded()).toBe(false);
    expect(degradation.getDegradationReasons()).toHaveLength(0);
  });
});

// ====================================
// FAULT TOLERANT SERVICE TESTS
// ====================================

describe('FaultTolerantService', { timeout: 10000 }, () => {
  let faultTolerantService: FaultTolerantService<string>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    faultTolerantService = new FaultTolerantService<string>('test-service', {
      enableRetry: true,
      enableCircuitBreaker: true,
      enableFallback: true,
      enableGracefulDegradation: true,
      healthCheckIntervalMs: 60000, // Set to a high value to avoid frequent health checks in tests
      retryConfig: {
        maxRetries: 2,
        baseDelayMs: 100, // Changed from 50 to meet minimum
        timeoutMs: 1000,
      },
      circuitBreakerConfig: {
        failureThreshold: 2,
        recoveryTimeoutMs: 5000, // Changed from 500 to meet minimum
        monitorWindowMs: 10000, // Added to meet minimum requirement
      },
    });
  });

  afterEach(() => {
    faultTolerantService.destroy();
    vi.useRealTimers();
  });

  test('should execute successful operations', { timeout: 20000 }, async () => {
    const operation = vi.fn().mockResolvedValue('success');

    const result = await faultTolerantService.execute(operation);

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(1);
  });

  test('should retry failed operations', async () => {
    const operation = vi
      .fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValue('success');

    const promise = faultTolerantService.execute(operation);
    await vi.advanceTimersByTimeAsync(1100); // Advance for retry delay
    const result = await promise;

    expect(result).toBe('success');
    expect(operation).toHaveBeenCalledTimes(2);
  });

  test(
    'should enforce service level requirements',
    { timeout: 20000 },
    async () => {
      const operation = vi.fn().mockResolvedValue('success');

      // Degrade service to level 2 by causing failures
      const failOperation = vi
        .fn()
        .mockRejectedValue(new Error('service unavailable'));

      // First failure - degrade to level 1
      try {
        const promise1 = faultTolerantService.execute(failOperation, {
          bypassRetry: true,
        });
        await vi.runAllTimersAsync();
        await promise1;
      } catch {
        // Expected to fail
      }

      // Second failure - degrade to level 2
      try {
        const promise2 = faultTolerantService.execute(failOperation, {
          bypassRetry: true,
        });
        await vi.runAllTimersAsync();
        await promise2;
      } catch {
        // Expected to fail
      }

      // Operation requiring level 0 should fail
      await expect(
        faultTolerantService.execute(operation, { requiredServiceLevel: 0 }),
      ).rejects.toThrow('Service degraded');

      // Operation requiring level 3 should succeed
      const result = await faultTolerantService.execute(operation, {
        requiredServiceLevel: 3,
      });
      expect(result).toBe('success');
    },
  );

  test('should collect metrics', { timeout: 20000 }, async () => {
    const successOperation = vi.fn().mockResolvedValue('success');
    const failOperation = vi.fn().mockRejectedValue(new Error('failure'));

    // Execute successful operations
    await faultTolerantService.execute(successOperation);
    await faultTolerantService.execute(successOperation);

    // Execute failing operation
    try {
      await faultTolerantService.execute(failOperation, { bypassRetry: true });
    } catch {
      // Expected to fail
    }

    const metrics = faultTolerantService.getMetrics();

    expect(metrics.totalRequests).toBe(3);
    expect(metrics.successfulRequests).toBe(2);
    expect(metrics.failedRequests).toBe(1);
    expect(metrics.averageLatency).toBeGreaterThanOrEqual(0); // Can be 0 in fast tests
  });

  test('should perform health checks', async () => {
    const provider: ServiceProvider<string> = {
      name: 'test-provider',
      priority: 1,
      isAvailable: vi.fn().mockResolvedValue(true),
      execute: vi.fn().mockResolvedValue('test-result'),
      healthCheck: vi.fn().mockResolvedValue(true),
    };

    faultTolerantService.addProvider(provider);

    const health = await faultTolerantService.healthCheck();

    expect(health.serviceName).toBe('test-service');
    expect(health.healthy).toBe(true);
    expect(health.fallbackStatus.healthy).toBe(true);
  });
});

// ====================================
// FAULT TOLERANCE FACTORY TESTS
// ====================================

describe('FaultToleranceFactory', { timeout: 10000 }, () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    FaultToleranceFactory.destroyAll();
    vi.useRealTimers();
  });

  test('should create and cache services', () => {
    const service1 = FaultToleranceFactory.createService('test-service');
    const service2 = FaultToleranceFactory.createService('test-service');

    expect(service1).toBe(service2); // Should be the same instance
  });

  test('should create different services for different names', () => {
    const service1 = FaultToleranceFactory.createService('service-1');
    const service2 = FaultToleranceFactory.createService('service-2');

    expect(service1).not.toBe(service2);
  });

  test('should get system health', async () => {
    FaultToleranceFactory.createService('service-1');
    FaultToleranceFactory.createService('service-2');

    const systemHealth = await FaultToleranceFactory.getSystemHealth();

    expect(systemHealth.services).toHaveLength(2);
    expect(systemHealth.services[0].name).toBe('service-1');
    expect(systemHealth.services[1].name).toBe('service-2');
  });

  test('should reset all services', () => {
    const service1 = FaultToleranceFactory.createService('service-1');
    const service2 = FaultToleranceFactory.createService('service-2');

    const resetSpy1 = vi.spyOn(service1, 'reset');
    const resetSpy2 = vi.spyOn(service2, 'reset');

    FaultToleranceFactory.resetAll();

    expect(resetSpy1).toHaveBeenCalled();
    expect(resetSpy2).toHaveBeenCalled();
  });
});
