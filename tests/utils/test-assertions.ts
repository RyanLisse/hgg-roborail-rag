import { expect } from 'vitest';
import { TEST_CONFIG, TEST_CONSTANTS } from './test-config';

/**
 * Custom test assertions and matchers
 * Provides reusable assertion utilities for common test patterns
 */

// Extended matchers for common patterns
export const customMatchers = {
  // Validate UUID format
  toBeValidUUID: (received: string) => {
    const pass = TEST_CONFIG.patterns.uuid.test(received);
    return {
      pass,
      message: () =>
        `expected ${received} ${pass ? 'not ' : ''}to be a valid UUID`,
    };
  },

  // Validate email format
  toBeValidEmail: (received: string) => {
    const pass = TEST_CONFIG.patterns.email.test(received);
    return {
      pass,
      message: () =>
        `expected ${received} ${pass ? 'not ' : ''}to be a valid email`,
    };
  },

  // Validate timestamp format
  toBeValidTimestamp: (received: string) => {
    const pass = TEST_CONFIG.patterns.timestamp.test(received);
    return {
      pass,
      message: () =>
        `expected ${received} ${pass ? 'not ' : ''}to be a valid timestamp`,
    };
  },

  // Validate API key format
  toBeValidAPIKey: (received: string) => {
    const pass = TEST_CONFIG.patterns.apiKey.test(received);
    return {
      pass,
      message: () =>
        `expected ${received} ${pass ? 'not ' : ''}to be a valid API key format`,
    };
  },

  // Check if execution time is within expected range
  toCompleteWithin: (received: number, expected: number, tolerance = 100) => {
    const pass = Math.abs(received - expected) <= tolerance;
    return {
      pass,
      message: () =>
        `expected execution time ${received}ms ${pass ? 'not ' : ''}to be within ${tolerance}ms of ${expected}ms`,
    };
  },

  // Validate response structure
  toHaveValidResponseStructure: (received: any, expectedKeys: string[]) => {
    const hasAllKeys = expectedKeys.every((key) => key in received);
    const pass =
      hasAllKeys && typeof received === 'object' && received !== null;
    return {
      pass,
      message: () =>
        `expected response ${pass ? 'not ' : ''}to have valid structure with keys: ${expectedKeys.join(', ')}`,
    };
  },

  // Validate array of specific type
  toBeArrayOfType: (received: any[], expectedType: string) => {
    const pass =
      Array.isArray(received) &&
      received.every((item) => typeof item === expectedType);
    return {
      pass,
      message: () =>
        `expected ${received} ${pass ? 'not ' : ''}to be an array of ${expectedType}`,
    };
  },

  // Validate HTTP status code is in success range
  toBeSuccessStatus: (received: number) => {
    const pass = received >= 200 && received < 300;
    return {
      pass,
      message: () =>
        `expected status ${received} ${pass ? 'not ' : ''}to be a success status (200-299)`,
    };
  },

  // Validate error response structure
  toBeValidErrorResponse: (received: any) => {
    const hasRequiredFields = 'code' in received && 'message' in received;
    const hasValidCode = typeof received.code === 'string';
    const hasValidMessage = typeof received.message === 'string';
    const pass = hasRequiredFields && hasValidCode && hasValidMessage;

    return {
      pass,
      message: () =>
        `expected ${JSON.stringify(received)} ${pass ? 'not ' : ''}to be a valid error response with code and message`,
    };
  },
};

// Assertion utilities for common test scenarios
export const assertUtils = {
  // Assert user object structure
  assertValidUser: (user: any) => {
    expect(user).toBeDefined();
    expect(user).toHaveProperty('id');
    expect(user).toHaveProperty('name');
    expect(user).toHaveProperty('email');
    expect(user).toHaveProperty('type');
    expect(TEST_CONSTANTS.userTypes).toContain(user.type);
    expect(user.email).toMatch(TEST_CONFIG.patterns.email);
  },

  // Assert message object structure
  assertValidMessage: (message: any) => {
    expect(message).toBeDefined();
    expect(message).toHaveProperty('id');
    expect(message).toHaveProperty('role');
    expect(message).toHaveProperty('content');
    expect(message).toHaveProperty('createdAt');
    expect(TEST_CONSTANTS.messageRoles).toContain(message.role);
    expect(message.content).toBeTypeOf('string');
    expect(message.createdAt).toMatch(TEST_CONFIG.patterns.timestamp);
  },

  // Assert API response structure
  assertValidAPIResponse: (response: any, expectedStatus = 200) => {
    expect(response).toBeDefined();
    expect(response.status).toBe(expectedStatus);

    if (expectedStatus >= 200 && expectedStatus < 300) {
      expect(response.ok).toBe(true);
    } else {
      expect(response.ok).toBe(false);
    }
  },

  // Assert vector search result structure
  assertValidVectorSearchResult: (result: any) => {
    expect(result).toBeDefined();
    expect(result).toHaveProperty('id');
    expect(result).toHaveProperty('content');
    expect(result).toHaveProperty('metadata');
    expect(result).toHaveProperty('score');
    expect(result.score).toBeTypeOf('number');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  },

  // Assert embedding structure
  assertValidEmbedding: (embedding: any) => {
    expect(embedding).toBeDefined();
    expect(embedding).toHaveProperty('embedding');
    expect(Array.isArray(embedding.embedding)).toBe(true);
    expect(embedding.embedding).toHaveLength(
      TEST_CONSTANTS.vectorStore.dimensions,
    );
    embedding.embedding.forEach((value: any) => {
      expect(value).toBeTypeOf('number');
    });
  },

  // Assert performance metrics structure
  assertValidPerformanceMetrics: (metrics: any) => {
    expect(metrics).toBeDefined();
    expect(metrics).toHaveProperty('provider');
    expect(metrics).toHaveProperty('totalRequests');
    expect(metrics).toHaveProperty('successRate');
    expect(metrics).toHaveProperty('averageLatency');
    expect(metrics).toHaveProperty('errorRate');
    expect(metrics.successRate).toBeGreaterThanOrEqual(0);
    expect(metrics.successRate).toBeLessThanOrEqual(1);
    expect(metrics.errorRate).toBeGreaterThanOrEqual(0);
    expect(metrics.errorRate).toBeLessThanOrEqual(1);
  },

  // Assert health status structure
  assertValidHealthStatus: (status: any) => {
    expect(status).toBeDefined();
    expect(status).toHaveProperty('provider');
    expect(status).toHaveProperty('isHealthy');
    expect(status).toHaveProperty('lastChecked');
    expect(status.isHealthy).toBeTypeOf('boolean');
    expect(status.lastChecked).toMatch(TEST_CONFIG.patterns.timestamp);

    if (status.isHealthy) {
      expect(status).toHaveProperty('latency');
      expect(status.latency).toBeTypeOf('number');
    } else {
      expect(status).toHaveProperty('errorMessage');
      expect(status.errorMessage).toBeTypeOf('string');
    }
  },

  // Assert database query result structure
  assertValidDatabaseResult: (result: any, expectedRowCount?: number) => {
    expect(result).toBeDefined();
    expect(result).toHaveProperty('rows');
    expect(Array.isArray(result.rows)).toBe(true);

    if (expectedRowCount !== undefined) {
      expect(result.rows).toHaveLength(expectedRowCount);
    }

    if ('rowCount' in result) {
      expect(result.rowCount).toBe(result.rows.length);
    }
  },

  // Assert error structure
  assertValidError: (error: any, expectedCode?: string) => {
    expect(error).toBeDefined();
    expect(error).toBeInstanceOf(Error);
    expect(error).toHaveProperty('message');
    expect(error.message).toBeTypeOf('string');

    if (expectedCode) {
      expect(error).toHaveProperty('code');
      expect(error.code).toBe(expectedCode);
    }
  },

  // Assert array contains valid items
  assertArrayContainsValidItems: <T>(
    array: T[],
    validator: (item: T) => void,
    minLength = 0,
  ) => {
    expect(Array.isArray(array)).toBe(true);
    expect(array.length).toBeGreaterThanOrEqual(minLength);
    array.forEach(validator);
  },

  // Assert async operation completes within timeout
  assertCompletesWithinTimeout: async <T>(
    operation: Promise<T>,
    timeout: number = TEST_CONFIG.timeouts.medium,
  ): Promise<T> => {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error(`Operation timed out after ${timeout}ms`)),
        timeout,
      );
    });

    return Promise.race([operation, timeoutPromise]);
  },

  // Assert operation performance
  assertPerformance: <T>(
    result: { result: T; duration: number },
    maxDuration: number,
    operation = 'Operation',
  ) => {
    expect(result).toBeDefined();
    expect(result).toHaveProperty('result');
    expect(result).toHaveProperty('duration');
    expect(result.duration).toBeLessThanOrEqual(maxDuration);

    if (result.duration > maxDuration * 0.8) {
      console.warn(
        `⚠️ ${operation} took ${result.duration}ms (close to timeout of ${maxDuration}ms)`,
      );
    }
  },
};

// Snapshot testing utilities
export const snapshotUtils = {
  // Create normalized snapshot data
  normalizeForSnapshot: (data: any): any => {
    if (data === null || data === undefined) {
      return data;
    }

    if (Array.isArray(data)) {
      return data.map(snapshotUtils.normalizeForSnapshot);
    }

    if (typeof data === 'object') {
      const normalized: any = {};

      for (const [key, value] of Object.entries(data)) {
        // Replace dynamic values with predictable ones
        if (key === 'id' && typeof value === 'string') {
          normalized[key] = '[DYNAMIC_ID]';
        } else if (
          key === 'createdAt' ||
          key === 'updatedAt' ||
          key === 'timestamp'
        ) {
          normalized[key] = '[DYNAMIC_TIMESTAMP]';
        } else if (key === 'duration' && typeof value === 'number') {
          normalized[key] = '[DYNAMIC_DURATION]';
        } else {
          normalized[key] = snapshotUtils.normalizeForSnapshot(value);
        }
      }

      return normalized;
    }

    return data;
  },

  // Assert against normalized snapshot
  toMatchNormalizedSnapshot: (received: any) => {
    const normalized = snapshotUtils.normalizeForSnapshot(received);
    expect(normalized).toMatchSnapshot();
  },
};

// Export all utilities
export default {
  matchers: customMatchers,
  assert: assertUtils,
  snapshot: snapshotUtils,
};
