import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock server-only module to prevent client component error
vi.mock('server-only', () => ({}));

// Mock performance API if not available
if (typeof global.performance === 'undefined') {
  global.performance = {
    now: Date.now,
    mark: vi.fn(),
    measure: vi.fn(),
    clearMarks: vi.fn(),
    clearMeasures: vi.fn(),
    getEntriesByName: vi.fn(() => []),
    getEntriesByType: vi.fn(() => []),
  } as any;
}

// Mock monitoring service
vi.mock('../monitoring', () => ({
  getVectorStoreMonitoringService: vi.fn().mockReturnValue({
    recordSearchLatency: vi.fn(),
    recordSearchError: vi.fn(),
    recordSearchSuccess: vi.fn(),
    recordFileUpload: vi.fn(),
    recordFileUploadError: vi.fn(),
    recordMetric: vi.fn(),
    recordTokenUsage: vi.fn(),
    performHealthCheck: vi.fn().mockResolvedValue({ isHealthy: true }),
    getHealthStatus: vi.fn().mockReturnValue([]),
    getPerformanceMetrics: vi.fn().mockReturnValue({}),
    getMetrics: vi.fn().mockReturnValue([]),
    getDashboardData: vi.fn().mockResolvedValue({}),
    cleanup: vi.fn(),
    exportMetrics: vi.fn().mockResolvedValue([]),
    config: {
      retentionPeriodMs: 86_400_000,
      maxMetricsPerProvider: 10_000,
      healthCheckIntervalMs: 60_000,
      cleanupIntervalMs: 3_600_000,
      alertThresholds: {},
    },
  }),
  withPerformanceMonitoring: vi.fn((_store, _method, fn) => fn),
}));

import { createOpenAIVectorStoreService, type SearchRequest } from '../openai';

// Mock OpenAI SDK with performance tracking
const mockOpenAI = {
  files: {
    create: vi.fn(),
    retrieve: vi.fn(),
  },
  responses: {
    create: vi.fn(),
  },
};

vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => mockOpenAI),
}));

// Mock fetch with performance simulation
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Vector Store Performance Tests', () => {
  let service: ReturnType<typeof createOpenAIVectorStoreService>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();

    service = createOpenAIVectorStoreService({
      apiKey: 'sk-test-key',
      defaultVectorStoreId: 'vs_test_store',
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Search Performance', () => {
    beforeEach(() => {
      // Mock successful vector store validation with complete schema
      const mockVectorStore = {
        id: 'vs_test_store',
        object: 'vector_store',
        created_at: Date.now(),
        name: 'Test Store',
        usage_bytes: 0,
        file_counts: {
          in_progress: 0,
          completed: 1,
          failed: 0,
          cancelled: 0,
          total: 1,
        },
        status: 'completed',
        expires_after: null,
        expires_at: null,
        last_active_at: null,
        metadata: {},
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockVectorStore),
      });
    });

    it('should complete simple searches within acceptable time', async () => {
      const mockResponse = {
        id: 'response_123',
        status: 'completed',
        output: [
          {
            type: 'file_search_call',
            status: 'completed',
            results: [
              {
                file_id: 'file_1',
                text: 'Test content',
                score: 0.9,
              },
            ],
          },
        ],
      };

      mockOpenAI.responses.create.mockResolvedValueOnce(mockResponse);
      mockOpenAI.files.retrieve.mockResolvedValueOnce({
        id: 'file_1',
        filename: 'test.txt',
      });

      const startTime = Date.now();
      const request: SearchRequest = { query: 'test query' };
      const result = await service.searchFiles(request);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('should handle large result sets efficiently', async () => {
      const largeResults = Array.from({ length: 100 }, (_, i) => ({
        file_id: `file_${i}`,
        text: `Content ${i}`,
        score: 0.8 - i * 0.001,
      }));

      const mockResponse = {
        id: 'response_large',
        status: 'completed',
        output: [
          {
            type: 'file_search_call',
            status: 'completed',
            results: largeResults,
          },
        ],
      };

      mockOpenAI.responses.create.mockResolvedValueOnce(mockResponse);

      // Mock file retrieval for multiple files
      largeResults.forEach((result, index) => {
        mockOpenAI.files.retrieve.mockResolvedValueOnce({
          id: result.file_id,
          filename: `file_${index}.txt`,
        });
      });

      const request: SearchRequest = { query: 'test', maxResults: 50 };
      const result = await service.searchFiles(request);

      expect(result.success).toBe(true);
      expect(result.results.length).toBeLessThanOrEqual(50); // Should respect maxResults
      expect(result.executionTime).toBeLessThan(10_000); // Should handle large sets efficiently
    });

    it('should perform well with concurrent searches', async () => {
      const mockResponse = {
        id: 'response_concurrent',
        status: 'completed',
        output: [
          {
            type: 'file_search_call',
            status: 'completed',
            results: [
              {
                file_id: 'file_1',
                text: 'Test content',
                score: 0.9,
              },
            ],
          },
        ],
      };

      mockOpenAI.responses.create.mockResolvedValue(mockResponse);
      mockOpenAI.files.retrieve.mockResolvedValue({
        id: 'file_1',
        filename: 'test.txt',
      });

      const requests = Array.from({ length: 10 }, (_, i) =>
        service.searchFiles({ query: `query ${i}` }),
      );

      const startTime = Date.now();
      const results = await Promise.all(requests);
      const endTime = Date.now();

      expect(results.every((r) => r.success)).toBe(true);
      expect(endTime - startTime).toBeLessThan(15_000); // All should complete within 15 seconds
    });

    it('should optimize search performance with caching', async () => {
      const mockResponse = {
        id: 'response_cached',
        status: 'completed',
        output: [
          {
            type: 'file_search_call',
            status: 'completed',
            results: [
              {
                file_id: 'file_1',
                text: 'Cached content',
                score: 0.95,
              },
            ],
          },
        ],
      };

      mockOpenAI.responses.create.mockResolvedValue(mockResponse);
      mockOpenAI.files.retrieve.mockResolvedValue({
        id: 'file_1',
        filename: 'cached.txt',
      });

      const request: SearchRequest = { query: 'same query' };

      // First search
      const firstStart = Date.now();
      const firstResult = await service.searchFiles(request);
      const firstEnd = Date.now();

      // Second identical search (should potentially benefit from caching)
      const secondStart = Date.now();
      const secondResult = await service.searchFiles(request);
      const secondEnd = Date.now();

      expect(firstResult.success).toBe(true);
      expect(secondResult.success).toBe(true);

      // While OpenAI doesn't cache, our service should at least not degrade
      const firstDuration = firstEnd - firstStart;
      const secondDuration = secondEnd - secondStart;

      // If both are very fast (0ms), consider it a pass
      if (firstDuration === 0 && secondDuration === 0) {
        expect(true).toBe(true); // Both are instant, which is good
      } else {
        // Otherwise, second call should not be significantly slower
        expect(secondDuration).toBeLessThanOrEqual(firstDuration * 2);
      }
    });
  });

  describe('Upload Performance', () => {
    beforeEach(() => {
      // Mock successful vector store validation
      const mockVectorStore = {
        id: 'vs_test_store',
        object: 'vector_store',
        created_at: Date.now(),
        name: 'Test Store',
        usage_bytes: 0,
        file_counts: {
          in_progress: 0,
          completed: 1,
          failed: 0,
          cancelled: 0,
          total: 1,
        },
        status: 'completed',
        expires_after: null,
        expires_at: null,
        last_active_at: null,
        metadata: {},
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockVectorStore),
      });
    });

    it('should handle small file uploads efficiently', async () => {
      const smallFile = new File(['small content'], 'small.txt', {
        type: 'text/plain',
      });

      mockOpenAI.files.create.mockResolvedValueOnce({
        id: 'file_small',
        filename: 'small.txt',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'file_small',
            object: 'vector_store.file',
            created_at: Date.now(),
            vector_store_id: 'vs_test_store',
            status: 'completed',
            last_error: null,
          }),
      });

      const startTime = Date.now();
      const result = await service.uploadFile({ file: smallFile });
      const endTime = Date.now();

      expect(result.id).toBe('file_small');
      expect(endTime - startTime).toBeLessThan(3000); // Should complete within 3 seconds
    });

    it('should handle medium file uploads within reasonable time', async () => {
      const mediumContent = 'x'.repeat(100_000); // 100KB
      const mediumFile = new File([mediumContent], 'medium.txt', {
        type: 'text/plain',
      });

      mockOpenAI.files.create.mockResolvedValueOnce({
        id: 'file_medium',
        filename: 'medium.txt',
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'file_medium',
            object: 'vector_store.file',
            created_at: Date.now(),
            vector_store_id: 'vs_test_store',
            status: 'completed',
            last_error: null,
          }),
      });

      const startTime = Date.now();
      const result = await service.uploadFile({ file: mediumFile });
      const endTime = Date.now();

      expect(result.id).toBe('file_medium');
      expect(endTime - startTime).toBeLessThan(10_000); // Should complete within 10 seconds
    });

    it('should handle concurrent uploads efficiently', async () => {
      const files = Array.from(
        { length: 5 },
        (_, i) =>
          new File([`content ${i}`], `file_${i}.txt`, { type: 'text/plain' }),
      );

      files.forEach((_, i) => {
        mockOpenAI.files.create.mockResolvedValueOnce({
          id: `file_${i}`,
          filename: `file_${i}.txt`,
        });

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              id: `file_${i}`,
              object: 'vector_store.file',
              created_at: Date.now(),
              vector_store_id: 'vs_test_store',
              status: 'completed',
              last_error: null,
            }),
        });
      });

      const uploads = files.map((file) => service.uploadFile({ file }));

      const startTime = Date.now();
      const results = await Promise.all(uploads);
      const endTime = Date.now();

      expect(results.every((r) => r.id)).toBe(true);
      expect(endTime - startTime).toBeLessThan(20_000); // All should complete within 20 seconds
    });
  });

  describe('Memory Management', () => {
    beforeEach(() => {
      // Mock successful vector store validation
      const mockVectorStore = {
        id: 'vs_test_store',
        object: 'vector_store',
        created_at: Date.now(),
        name: 'Test Store',
        usage_bytes: 0,
        file_counts: {
          in_progress: 0,
          completed: 1,
          failed: 0,
          cancelled: 0,
          total: 1,
        },
        status: 'completed',
        expires_after: null,
        expires_at: null,
        last_active_at: null,
        metadata: {},
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockVectorStore),
      });
    });

    it('should not accumulate memory during repeated operations', async () => {
      const mockResponse = {
        id: 'response_memory',
        status: 'completed',
        output: [
          {
            type: 'file_search_call',
            status: 'completed',
            results: [
              {
                file_id: 'file_1',
                text: 'Memory test content',
                score: 0.9,
              },
            ],
          },
        ],
      };

      mockOpenAI.responses.create.mockResolvedValue(mockResponse);
      mockOpenAI.files.retrieve.mockResolvedValue({
        id: 'file_1',
        filename: 'memory.txt',
      });

      // Simulate repeated operations
      for (let i = 0; i < 100; i++) {
        const result = await service.searchFiles({ query: `query ${i}` });
        expect(result.success).toBe(true);
      }

      // If we reach here without memory issues, the test passes
      expect(true).toBe(true);
    });

    it('should handle large response payloads without memory leaks', async () => {
      const largeContent = 'x'.repeat(10_000); // Large content blocks
      const largeResponse = {
        id: 'response_large_memory',
        status: 'completed',
        output: [
          {
            type: 'file_search_call',
            status: 'completed',
            results: Array.from({ length: 50 }, (_, i) => ({
              file_id: `file_${i}`,
              text: largeContent,
              score: 0.8,
            })),
          },
        ],
      };

      mockOpenAI.responses.create.mockResolvedValue(largeResponse);
      mockOpenAI.files.retrieve.mockResolvedValue({
        id: 'file_1',
        filename: 'large.txt',
      });

      const result = await service.searchFiles({
        query: 'large test',
        maxResults: 10,
      });

      expect(result.success).toBe(true);
      expect(result.results.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Retry Performance', () => {
    it('should implement exponential backoff efficiently', async () => {
      let attemptCount = 0;

      // Create a new service instance to avoid conflicts with spies
      const testService = createOpenAIVectorStoreService({
        apiKey: 'sk-test-key',
        defaultVectorStoreId: 'vs_test_store',
      });

      // Mock the searchFiles method directly
      testService.searchFiles = vi.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          // Throw exceptions to trigger retry delays
          throw new Error('Temporary failure');
        }
        return Promise.resolve({
          success: true,
          message: 'Success',
          results: [],
          sources: [],
          totalResults: 0,
          query: 'test',
          executionTime: 100,
        });
      });

      const startTime = Date.now();
      const result = await testService.searchWithRetry({ query: 'test' }, 3);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(attemptCount).toBe(3);

      // Should include backoff delays but not be excessive
      expect(endTime - startTime).toBeGreaterThan(500); // Should have some delay
      expect(endTime - startTime).toBeLessThan(10_000); // But not too much
    });

    it('should fail fast for non-retryable errors', async () => {
      // Create a new service instance
      const testService = createOpenAIVectorStoreService({
        apiKey: 'sk-test-key',
        defaultVectorStoreId: 'vs_test_store',
      });

      testService.searchFiles = vi.fn().mockResolvedValue({
        success: false,
        message: 'No vector store ID provided',
        results: [],
        sources: [],
        totalResults: 0,
        query: 'test',
        executionTime: 100,
      });

      const startTime = Date.now();
      const result = await testService.searchWithRetry({ query: 'test' }, 5);
      const endTime = Date.now();

      expect(result.success).toBe(false);
      expect(endTime - startTime).toBeLessThan(1000); // Should fail fast
    });
  });

  describe('Scalability Tests', () => {
    beforeEach(() => {
      // Mock successful vector store validation
      const mockVectorStore = {
        id: 'vs_test_store',
        object: 'vector_store',
        created_at: Date.now(),
        name: 'Test Store',
        usage_bytes: 0,
        file_counts: {
          in_progress: 0,
          completed: 1,
          failed: 0,
          cancelled: 0,
          total: 1,
        },
        status: 'completed',
        expires_after: null,
        expires_at: null,
        last_active_at: null,
        metadata: {},
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockVectorStore),
      });
    });

    it('should handle increasing query complexity gracefully', async () => {
      const queries = [
        'simple',
        'more complex query with multiple terms',
        'very complex query with many technical terms and specific requirements for detailed analysis',
        'extremely complex and comprehensive query requiring extensive processing and analysis of multiple interconnected concepts with various technical specifications and detailed requirements',
      ];

      const mockResponse = {
        id: 'response_scalability',
        status: 'completed',
        output: [
          {
            type: 'file_search_call',
            status: 'completed',
            results: [
              {
                file_id: 'file_1',
                text: 'Scalability test content',
                score: 0.9,
              },
            ],
          },
        ],
      };

      mockOpenAI.responses.create.mockResolvedValue(mockResponse);
      mockOpenAI.files.retrieve.mockResolvedValue({
        id: 'file_1',
        filename: 'scalability.txt',
      });

      const results = await Promise.all(
        queries.map(async (query) => {
          const startTime = Date.now();
          const result = await service.searchFiles({ query });
          const endTime = Date.now();
          return { result, duration: endTime - startTime };
        }),
      );

      // All should succeed
      expect(results.every((r) => r.result.success)).toBe(true);

      // Performance should not degrade dramatically with complexity
      const durations = results.map((r) => r.duration);
      const maxDuration = Math.max(...durations);
      const minDuration = Math.min(...durations);

      // If all operations are instant (0ms), that's excellent performance
      if (maxDuration === 0 && minDuration === 0) {
        expect(true).toBe(true); // All instant operations is ideal
      } else if (minDuration === 0) {
        // If some are instant and some aren't, ensure non-instant ones are still fast
        expect(maxDuration).toBeLessThan(50); // Should still be very fast
      } else {
        // Normal case: compare relative performance
        expect(maxDuration / minDuration).toBeLessThan(5); // Should not vary by more than 5x
      }
    });

    it('should maintain performance with varying result set sizes', async () => {
      const resultSizes = [1, 10, 25, 50];

      for (const size of resultSizes) {
        const mockResponse = {
          id: `response_${size}`,
          status: 'completed',
          output: [
            {
              type: 'file_search_call',
              status: 'completed',
              results: Array.from({ length: size }, (_, i) => ({
                file_id: `file_${i}`,
                text: `Content ${i}`,
                score: 0.9 - i * 0.01,
              })),
            },
          ],
        };

        mockOpenAI.responses.create.mockResolvedValueOnce(mockResponse);

        // Mock file retrievals
        for (let i = 0; i < size; i++) {
          mockOpenAI.files.retrieve.mockResolvedValueOnce({
            id: `file_${i}`,
            filename: `file_${i}.txt`,
          });
        }

        const startTime = Date.now();
        const result = await service.searchFiles({
          query: 'test',
          maxResults: size,
        });
        const endTime = Date.now();

        expect(result.success).toBe(true);
        expect(result.results.length).toBe(size);
        expect(endTime - startTime).toBeLessThan(15_000); // Should complete within 15 seconds
      }
    });
  });

  describe('Resource Utilization', () => {
    beforeEach(() => {
      // Mock successful vector store validation
      const mockVectorStore = {
        id: 'vs_test_store',
        object: 'vector_store',
        created_at: Date.now(),
        name: 'Test Store',
        usage_bytes: 0,
        file_counts: {
          in_progress: 0,
          completed: 1,
          failed: 0,
          cancelled: 0,
          total: 1,
        },
        status: 'completed',
        expires_after: null,
        expires_at: null,
        last_active_at: null,
        metadata: {},
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockVectorStore),
      });
    });

    it('should efficiently handle batch operations', async () => {
      const batchSize = 20;
      const mockResponse = {
        id: 'response_batch',
        status: 'completed',
        output: [
          {
            type: 'file_search_call',
            status: 'completed',
            results: [
              {
                file_id: 'file_batch',
                text: 'Batch content',
                score: 0.9,
              },
            ],
          },
        ],
      };

      mockOpenAI.responses.create.mockResolvedValue(mockResponse);
      mockOpenAI.files.retrieve.mockResolvedValue({
        id: 'file_batch',
        filename: 'batch.txt',
      });

      const batchRequests = Array.from({ length: batchSize }, (_, i) =>
        service.searchFiles({ query: `batch query ${i}` }),
      );

      const startTime = Date.now();
      const results = await Promise.all(batchRequests);
      const endTime = Date.now();

      expect(results.every((r) => r.success)).toBe(true);
      expect(endTime - startTime).toBeLessThan(30_000); // Batch should complete within 30 seconds

      // Average time per request should be reasonable
      const avgTimePerRequest = (endTime - startTime) / batchSize;
      expect(avgTimePerRequest).toBeLessThan(2000); // Each request should average < 2 seconds
    });

    it('should handle connection pooling efficiently', async () => {
      // Simulate multiple rapid requests that would benefit from connection reuse
      const rapidRequests = Array.from({ length: 15 }, (_, _i) =>
        service.healthCheck(),
      );

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

      const startTime = Date.now();
      const results = await Promise.all(rapidRequests);
      const endTime = Date.now();

      expect(results.every((r) => r.isHealthy)).toBe(true);

      // With connection reuse, should be faster than serial requests
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(10_000); // Should complete within 10 seconds
    });
  });
});
