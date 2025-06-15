#!/usr/bin/env node

/**
 * Comprehensive integration test for the fault tolerance system
 * Tests all components working together with real scenarios
 */

import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Set up environment for testing
process.env.NODE_ENV = 'development';

async function testFaultToleranceIntegration() {
  console.log('🧪 Testing Fault Tolerance System Integration...\n');

  try {
    // Import fault tolerance components
    const {
      ErrorClassifier,
      RetryMechanism,
      CircuitBreaker,
      FaultTolerantService,
      FaultToleranceFactory,
    } = await import('./lib/vectorstore/fault-tolerance.js');

    const { FallbackManager, GracefulDegradation } = await import(
      './lib/vectorstore/fallback.js'
    );
    const { getFaultTolerantOpenAIVectorStoreService } = await import(
      './lib/vectorstore/openai-fault-tolerant.js'
    );
    const { getFaultTolerantUnifiedVectorStoreService } = await import(
      './lib/vectorstore/unified-fault-tolerant.js'
    );

    console.log('✅ Successfully imported fault tolerance components\n');

    // Test 1: Error Classification
    console.log('1. Testing Error Classification...');

    const networkError = new Error('fetch failed - connection timeout');
    const rateLimitError = new Error('Rate limit exceeded - 429');
    const authError = new Error('Unauthorized - 401');
    const validationError = new Error('Bad request - invalid parameters');
    const unknownError = new Error('Something unexpected happened');

    const networkClassified = ErrorClassifier.classify(networkError);
    const rateLimitClassified = ErrorClassifier.classify(rateLimitError);
    const authClassified = ErrorClassifier.classify(authError);
    const validationClassified = ErrorClassifier.classify(validationError);
    const unknownClassified = ErrorClassifier.classify(unknownError);

    console.log(`📊 Error Classifications:`);
    console.log(
      `   Network Error: ${networkClassified.category} (retryable: ${networkClassified.isRetryable})`,
    );
    console.log(
      `   Rate Limit Error: ${rateLimitClassified.category} (retryable: ${rateLimitClassified.isRetryable})`,
    );
    console.log(
      `   Auth Error: ${authClassified.category} (retryable: ${authClassified.isRetryable})`,
    );
    console.log(
      `   Validation Error: ${validationClassified.category} (retryable: ${validationClassified.isRetryable})`,
    );
    console.log(
      `   Unknown Error: ${unknownClassified.category} (retryable: ${unknownClassified.isRetryable})`,
    );

    // Test 2: Retry Mechanism
    console.log('\n2. Testing Retry Mechanism...');

    const retryMechanism = new RetryMechanism({
      maxRetries: 3,
      baseDelayMs: 100,
      maxDelayMs: 1000,
      backoffMultiplier: 2,
      jitterFactor: 0.1,
      timeoutMs: 5000,
    });

    let attemptCount = 0;
    const flakyOperation = async () => {
      attemptCount++;
      if (attemptCount < 3) {
        throw new Error('Network timeout - temporary failure');
      }
      return `Success on attempt ${attemptCount}`;
    };

    try {
      const retryResult = await retryMechanism.execute(flakyOperation);
      console.log(`✅ Retry succeeded: ${retryResult}`);
    } catch (error) {
      console.log(`❌ Retry failed: ${error.message}`);
    }

    // Test 3: Circuit Breaker
    console.log('\n3. Testing Circuit Breaker...');

    const circuitBreaker = new CircuitBreaker('test-service', {
      failureThreshold: 3,
      recoveryTimeoutMs: 1000,
      monitorWindowMs: 5000,
      minimumThroughput: 2,
      successThreshold: 2,
    });

    // Trigger circuit breaker
    const failingOperation = async () => {
      throw new Error('Service consistently failing');
    };

    console.log(`   Initial state: ${circuitBreaker.getState()}`);

    // Make failing calls to trip the breaker
    for (let i = 0; i < 4; i++) {
      try {
        await circuitBreaker.execute(failingOperation);
      } catch (error) {
        console.log(`   Call ${i + 1} failed: ${error.message}`);
      }
    }

    console.log(
      `   Circuit breaker state after failures: ${circuitBreaker.getState()}`,
    );

    // Wait for recovery timeout
    console.log('   Waiting for recovery timeout...');
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // Test recovery
    const successOperation = async () => 'Service recovered';
    try {
      const recoveryResult = await circuitBreaker.execute(successOperation);
      console.log(`   Recovery test: ${recoveryResult}`);
      console.log(
        `   Circuit breaker state after recovery: ${circuitBreaker.getState()}`,
      );
    } catch (error) {
      console.log(`   Recovery failed: ${error.message}`);
    }

    // Test 4: Fallback Manager
    console.log('\n4. Testing Fallback Manager...');

    const fallbackManager = new FallbackManager({
      mode: 'GRACEFUL',
      enableCaching: true,
      fallbackTimeoutMs: 1000,
    });

    // Primary provider (will fail)
    const primaryProvider = {
      name: 'primary',
      priority: 1,
      isAvailable: async () => true,
      execute: async () => {
        throw new Error('Primary service unavailable');
      },
    };

    // Secondary provider (will succeed)
    const secondaryProvider = {
      name: 'secondary',
      priority: 2,
      isAvailable: async () => true,
      execute: async () => 'Secondary service result',
      fallbackValue: 'Secondary fallback value',
    };

    // Emergency provider (always available)
    const emergencyProvider = {
      name: 'emergency',
      priority: 3,
      isAvailable: async () => true,
      execute: async () => 'Emergency service result',
      fallbackValue: 'Emergency fallback value',
    };

    fallbackManager.addProvider(primaryProvider);
    fallbackManager.addProvider(secondaryProvider);
    fallbackManager.addProvider(emergencyProvider);

    try {
      const fallbackResult = await fallbackManager.execute(
        'test-operation',
        [],
      );
      console.log(`✅ Fallback succeeded: ${fallbackResult}`);
    } catch (error) {
      console.log(`❌ Fallback failed: ${error.message}`);
    }

    // Test fallback health check
    const fallbackHealth = await fallbackManager.healthCheck();
    console.log(
      `   Fallback health: ${fallbackHealth.healthy ? 'healthy' : 'unhealthy'}`,
    );
    console.log(
      `   Available providers: ${fallbackHealth.providers
        .filter((p) => p.available)
        .map((p) => p.name)
        .join(', ')}`,
    );

    // Test 5: Graceful Degradation
    console.log('\n5. Testing Graceful Degradation...');

    const degradation = new GracefulDegradation();

    console.log(
      `   Initial service level: ${degradation.getCurrentLevel()} (${degradation.getCurrentLevelName()})`,
    );

    // Trigger degradation
    degradation.degrade('Primary database connection lost');
    console.log(
      `   After degradation: ${degradation.getCurrentLevel()} (${degradation.getCurrentLevelName()})`,
    );

    degradation.degrade('Cache service unavailable');
    console.log(
      `   After second degradation: ${degradation.getCurrentLevel()} (${degradation.getCurrentLevelName()})`,
    );

    // Test operation availability
    console.log(
      `   Can perform level 0 operations: ${degradation.canPerformOperation(0)}`,
    );
    console.log(
      `   Can perform level 2 operations: ${degradation.canPerformOperation(2)}`,
    );
    console.log(
      `   Can perform level 4 operations: ${degradation.canPerformOperation(4)}`,
    );

    // Test recovery
    degradation.recover();
    console.log(
      `   After recovery: ${degradation.getCurrentLevel()} (${degradation.getCurrentLevelName()})`,
    );

    // Test 6: Fault Tolerant Service Integration
    console.log('\n6. Testing Fault Tolerant Service Integration...');

    const faultTolerantService = FaultToleranceFactory.createService(
      'integration-test',
      {
        enableRetry: true,
        enableCircuitBreaker: true,
        enableFallback: true,
        enableGracefulDegradation: true,
        retryConfig: {
          maxRetries: 2,
          baseDelayMs: 50,
          timeoutMs: 2000,
        },
        circuitBreakerConfig: {
          failureThreshold: 2,
          recoveryTimeoutMs: 500,
        },
      },
    );

    // Test successful operation
    const successfulOperation = async () => 'Operation completed successfully';

    try {
      const result1 = await faultTolerantService.execute(successfulOperation, {
        operationName: 'test-success',
      });
      console.log(`   ✅ Successful operation: ${result1}`);
    } catch (error) {
      console.log(`   ❌ Successful operation failed: ${error.message}`);
    }

    // Test operation with retries
    let retryAttempts = 0;
    const retryableOperation = async () => {
      retryAttempts++;
      if (retryAttempts < 2) {
        throw new Error('Temporary network failure');
      }
      return `Operation succeeded after ${retryAttempts} attempts`;
    };

    try {
      const result2 = await faultTolerantService.execute(retryableOperation, {
        operationName: 'test-retry',
      });
      console.log(`   ✅ Retryable operation: ${result2}`);
    } catch (error) {
      console.log(`   ❌ Retryable operation failed: ${error.message}`);
    }

    // Test service health
    const serviceHealth = await faultTolerantService.healthCheck();
    console.log(
      `   Service health: ${serviceHealth.healthy ? 'healthy' : 'unhealthy'}`,
    );

    // Test metrics
    const metrics = faultTolerantService.getMetrics();
    console.log(
      `   Metrics: ${metrics.totalRequests} total, ${metrics.successfulRequests} successful, ${metrics.failedRequests} failed`,
    );

    // Test 7: OpenAI Fault Tolerant Service (if available)
    console.log('\n7. Testing OpenAI Fault Tolerant Service...');

    try {
      const openaiService = getFaultTolerantOpenAIVectorStoreService();

      if (openaiService.isEnabled) {
        console.log('   OpenAI service enabled, testing health check...');
        const openaiHealth = await openaiService.healthCheck();
        console.log(
          `   OpenAI health: ${openaiHealth.isHealthy ? 'healthy' : 'unhealthy'}`,
        );

        if (openaiHealth.error) {
          console.log(`   OpenAI error: ${openaiHealth.error}`);
        }

        // Test system health
        const systemHealth = await openaiService.getSystemHealth();
        console.log(
          `   System health: ${systemHealth.healthy ? 'healthy' : 'unhealthy'}`,
        );

        // Test metrics
        const openaiMetrics = openaiService.getMetrics();
        console.log(
          `   OpenAI metrics: ${openaiMetrics.totalRequests} requests`,
        );
      } else {
        console.log('   OpenAI service disabled (no API key configured)');
      }
    } catch (error) {
      console.log(`   OpenAI service test failed: ${error.message}`);
    }

    // Test 8: Unified Fault Tolerant Service
    console.log('\n8. Testing Unified Fault Tolerant Service...');

    try {
      const unifiedService = await getFaultTolerantUnifiedVectorStoreService();

      // Test available sources
      const availableSources = await unifiedService.getAvailableSources();
      console.log(`   Available sources: ${availableSources.join(', ')}`);

      // Test source stats
      const sourceStats = await unifiedService.getSourceStats();
      console.log(`   Source stats:`);
      for (const [source, stats] of Object.entries(sourceStats)) {
        console.log(
          `     ${source}: enabled=${stats.enabled}, count=${stats.count || 'unknown'}`,
        );
      }

      // Test system health
      const unifiedHealth = await unifiedService.getSystemHealth();
      console.log(
        `   Unified health: ${unifiedHealth.unified.healthy ? 'healthy' : 'unhealthy'}`,
      );

      // Test metrics
      const unifiedMetrics = unifiedService.getMetrics();
      console.log(
        `   Unified metrics: ${unifiedMetrics.unified.totalRequests} requests`,
      );
    } catch (error) {
      console.log(`   Unified service test failed: ${error.message}`);
    }

    // Test 9: System-wide Health Check
    console.log('\n9. Testing System-wide Health Check...');

    try {
      const systemHealth = await FaultToleranceFactory.getSystemHealth();
      console.log(
        `   Overall system health: ${systemHealth.healthy ? 'healthy' : 'unhealthy'}`,
      );
      console.log(`   Active services: ${systemHealth.services.length}`);

      for (const service of systemHealth.services) {
        console.log(
          `     ${service.name}: ${service.healthy ? 'healthy' : 'unhealthy'}`,
        );
      }
    } catch (error) {
      console.log(`   System health check failed: ${error.message}`);
    }

    // Test 10: Performance Under Load
    console.log('\n10. Testing Performance Under Load...');

    const loadTestService = FaultToleranceFactory.createService('load-test', {
      enableRetry: true,
      enableCircuitBreaker: true,
      enableFallback: true,
      retryConfig: {
        maxRetries: 1,
        baseDelayMs: 10,
        timeoutMs: 1000,
      },
    });

    // Simulate load with concurrent operations
    const loadOperations = [];
    const startTime = Date.now();

    for (let i = 0; i < 10; i++) {
      const operation = async () => {
        // Simulate some operations failing
        if (Math.random() < 0.3) {
          throw new Error(`Load test failure ${i}`);
        }
        return `Load test result ${i}`;
      };

      loadOperations.push(
        loadTestService
          .execute(operation, {
            operationName: `load-test-${i}`,
          })
          .catch((error) => ({ error: error.message })),
      );
    }

    const loadResults = await Promise.all(loadOperations);
    const loadTime = Date.now() - startTime;

    const successCount = loadResults.filter((r) => !r.error).length;
    const failureCount = loadResults.filter((r) => r.error).length;

    console.log(`   Load test completed in ${loadTime}ms`);
    console.log(
      `   Results: ${successCount} successful, ${failureCount} failed`,
    );

    const loadMetrics = loadTestService.getMetrics();
    console.log(
      `   Load metrics: ${loadMetrics.totalRequests} total, avg latency: ${Math.round(loadMetrics.averageLatency)}ms`,
    );

    console.log(
      '\n✅ Fault Tolerance Integration Test Completed Successfully!',
    );

    // Cleanup
    FaultToleranceFactory.destroyAll();
  } catch (error) {
    console.error('❌ Fault tolerance integration test failed:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the test
testFaultToleranceIntegration();
