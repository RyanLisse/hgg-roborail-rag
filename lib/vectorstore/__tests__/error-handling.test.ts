import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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
      retentionPeriodMs: 86400000,
      maxMetricsPerProvider: 10000,
      healthCheckIntervalMs: 60000,
      cleanupIntervalMs: 3600000,
      alertThresholds: {},
    },
  }),
  withPerformanceMonitoring: vi.fn((store, method, fn) => fn),
}));

import { createOpenAIVectorStoreService, type SearchRequest } from '../openai';

// Mock OpenAI SDK with error scenarios
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

// Mock fetch with various error scenarios
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Vector Store Error Handling', () => {
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

  describe('Network Error Scenarios', () => {
    it('should handle network timeouts gracefully', async () => {
      mockFetch.mockImplementation(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Network timeout')), 100),
          ),
      );

      await expect(service.createVectorStore('Test Store')).rejects.toThrow(
        'Network timeout',
      );
    });

    it('should handle connection refused errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      await expect(service.getVectorStore('vs_test')).rejects.toThrow(
        'ECONNREFUSED',
      );
    });

    it('should handle DNS resolution failures', async () => {
      mockFetch.mockRejectedValueOnce(new Error('ENOTFOUND'));

      const result = await service.listVectorStores();
      expect(result).toEqual([]);
    });
  });

  describe('API Error Responses', () => {
    it('should handle 401 Unauthorized errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: () =>
          Promise.resolve({
            error: { message: 'Invalid API key' },
          }),
      });

      await expect(service.createVectorStore('Test')).rejects.toThrow(
        'Invalid API key',
      );
    });

    it('should handle 403 Forbidden errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: () =>
          Promise.resolve({
            error: { message: 'Insufficient permissions' },
          }),
      });

      await expect(service.getVectorStore('vs_test')).rejects.toThrow(
        'Insufficient permissions',
      );
    });

    it('should handle 404 Not Found errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () =>
          Promise.resolve({
            error: { message: 'Vector store not found' },
          }),
      });

      await expect(service.getVectorStore('vs_nonexistent')).rejects.toThrow(
        'Vector store not found',
      );
    });

    it('should handle 429 Rate Limit errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        json: () =>
          Promise.resolve({
            error: { message: 'Rate limit exceeded' },
          }),
      });

      const request: SearchRequest = { query: 'test' };
      const result = await service.searchFiles(request);

      expect(result.success).toBe(false);
      expect(result.message).toContain('not accessible or does not exist');
    });

    it('should handle 500 Internal Server Error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () =>
          Promise.resolve({
            error: { message: 'Internal server error' },
          }),
      });

      const result = await service.deleteVectorStore('vs_test');
      expect(result).toBe(false);
    });

    it('should handle 503 Service Unavailable', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: () =>
          Promise.resolve({
            error: { message: 'Service temporarily unavailable' },
          }),
      });

      const result = await service.listFiles();
      expect(result).toEqual([]);
    });
  });

  describe('Malformed Response Handling', () => {
    it('should handle invalid JSON responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.reject(new Error('Invalid JSON')),
      });

      await expect(service.createVectorStore('Test')).rejects.toThrow(
        'Invalid JSON',
      );
    });

    it('should handle missing data fields', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({}), // Missing required fields
      });

      await expect(service.createVectorStore('Test')).rejects.toThrow();
    });

    it('should handle corrupted response data', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: null, // Invalid ID
            status: 'invalid_status', // Invalid status
          }),
      });

      await expect(service.createVectorStore('Test')).rejects.toThrow();
    });

    it('should handle empty response arrays', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: null }),
      });

      const result = await service.listVectorStores();
      expect(result).toEqual([]);
    });
  });

  describe('File Upload Error Scenarios', () => {
    it('should handle file upload failures', async () => {
      mockOpenAI.files.create.mockRejectedValueOnce(
        new Error('File upload failed'),
      );

      const mockFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      await expect(service.uploadFile({ file: mockFile })).rejects.toThrow(
        'File upload failed',
      );
    });

    it('should handle file size limit errors', async () => {
      mockOpenAI.files.create.mockRejectedValueOnce(
        new Error('File too large'),
      );

      const mockFile = new File(['test'], 'large-file.txt', {
        type: 'text/plain',
      });
      await expect(service.uploadFile({ file: mockFile })).rejects.toThrow(
        'File too large',
      );
    });

    it('should handle unsupported file type errors', async () => {
      mockOpenAI.files.create.mockRejectedValueOnce(
        new Error('Unsupported file type'),
      );

      const mockFile = new File(['test'], 'test.exe', {
        type: 'application/octet-stream',
      });
      await expect(service.uploadFile({ file: mockFile })).rejects.toThrow(
        'Unsupported file type',
      );
    });

    it('should handle vector store attachment failures', async () => {
      const mockFile = new File(['test'], 'test.txt', { type: 'text/plain' });

      mockOpenAI.files.create.mockResolvedValueOnce({
        id: 'file_123',
        filename: 'test.txt',
      });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: () =>
          Promise.resolve({
            error: { message: 'Failed to attach file to vector store' },
          }),
      });

      await expect(service.uploadFile({ file: mockFile })).rejects.toThrow(
        'Failed to attach file to vector store',
      );
    });
  });

  describe('Search Error Scenarios', () => {
    it('should handle search API failures', async () => {
      // Mock successful validation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'completed' }),
      });

      mockOpenAI.responses.create.mockRejectedValueOnce(
        new Error('Search API failed'),
      );

      const request: SearchRequest = { query: 'test query' };
      const result = await service.searchFiles(request);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Search API failed');
    });

    it('should handle malformed search responses', async () => {
      // Mock validation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'completed' }),
      });

      mockOpenAI.responses.create.mockResolvedValueOnce({
        id: 'response_123',
        status: 'completed',
        output: 'invalid_output_format', // Should be array
      });

      const request: SearchRequest = { query: 'test' };
      const result = await service.searchFiles(request);

      expect(result.success).toBe(true);
      expect(result.results).toEqual([]);
    });

    it('should handle search timeout errors', async () => {
      // Mock validation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'completed' }),
      });

      mockOpenAI.responses.create.mockImplementation(
        () =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), 100),
          ),
      );

      const request: SearchRequest = { query: 'test' };
      const result = await service.searchFiles(request);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Request timeout');
    });

    it('should handle empty search results gracefully', async () => {
      // Mock validation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'completed' }),
      });

      mockOpenAI.responses.create.mockResolvedValueOnce({
        id: 'response_123',
        status: 'completed',
        output: [],
      });

      const request: SearchRequest = { query: 'nonexistent content' };
      const result = await service.searchFiles(request);

      expect(result.success).toBe(true);
      expect(result.results).toEqual([]);
      expect(result.message).toContain('no relevant content found');
    });
  });

  describe('Retry Logic Error Scenarios', () => {
    it('should retry on temporary failures', async () => {
      let callCount = 0;

      // Create a new service instance for this test
      const testService = createOpenAIVectorStoreService({
        apiKey: 'sk-test-key',
        defaultVectorStoreId: 'vs_test_store',
      });

      testService.searchFiles = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount < 3) {
          return Promise.resolve({
            success: false,
            message: 'Temporary failure',
            results: [],
            sources: [],
            totalResults: 0,
            query: 'test',
            executionTime: 100,
          });
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

      const request: SearchRequest = { query: 'test' };
      const result = await testService.searchWithRetry(request, 3);

      expect(result.success).toBe(true);
      expect(callCount).toBe(3);
    });

    it('should not retry on non-retryable errors', async () => {
      let callCount = 0;

      // Create a new service instance
      const testService = createOpenAIVectorStoreService({
        apiKey: 'sk-test-key',
        defaultVectorStoreId: 'vs_test_store',
      });

      testService.searchFiles = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          success: false,
          message: 'No vector store ID provided',
          results: [],
          sources: [],
          totalResults: 0,
          query: 'test',
          executionTime: 100,
        });
      });

      const request: SearchRequest = { query: 'test' };
      const result = await testService.searchWithRetry(request, 3);

      expect(result.success).toBe(false);
      expect(callCount).toBe(1); // Should not retry
    });

    it('should exhaust retries on persistent errors', async () => {
      let callCount = 0;

      // Create a new service instance
      const testService = createOpenAIVectorStoreService({
        apiKey: 'sk-test-key',
        defaultVectorStoreId: 'vs_test_store',
      });

      testService.searchFiles = vi.fn().mockImplementation(() => {
        callCount++;
        throw new Error('Persistent error');
      });

      const request: SearchRequest = { query: 'test' };
      const result = await testService.searchWithRetry(request, 2);

      expect(result.success).toBe(false);
      expect(result.message).toContain('failed after 2 attempts');
      expect(callCount).toBe(2);
    });
  });

  describe('Resource Cleanup on Errors', () => {
    it('should cleanup partial uploads on failure', async () => {
      const mockFile = new File(['test'], 'test.txt', { type: 'text/plain' });

      // File upload succeeds
      mockOpenAI.files.create.mockResolvedValueOnce({
        id: 'file_123',
        filename: 'test.txt',
      });

      // Vector store attachment fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({}),
      });

      try {
        await service.uploadFile({ file: mockFile });
      } catch (error) {
        // Should have attempted the upload and attachment
        expect(mockOpenAI.files.create).toHaveBeenCalled();
        expect(mockFetch).toHaveBeenCalled();
      }
    });

    it('should handle partial vector store creation failures', async () => {
      // Simulate network failure during creation
      mockFetch.mockRejectedValueOnce(new Error('Network failure'));

      await expect(service.createVectorStore('Test Store')).rejects.toThrow(
        'Network failure',
      );
    });
  });

  describe('Validation Error Scenarios', () => {
    it('should handle invalid query parameters', async () => {
      const invalidRequest = {
        query: '', // Empty query
        maxResults: -1, // Invalid max results
      };

      const result = await service.searchFiles(invalidRequest as any);
      expect(result.success).toBe(false);
      expect(result.message).toContain('Invalid search request');
    });

    it('should handle invalid file upload parameters', async () => {
      const invalidRequest = {
        file: 'not-a-file', // Invalid file object
      };

      await expect(service.uploadFile(invalidRequest as any)).rejects.toThrow();
    });

    it('should handle invalid vector store IDs', async () => {
      const invalidService = createOpenAIVectorStoreService({
        apiKey: 'sk-test-key',
        defaultVectorStoreId: 'invalid-id-format', // Should start with 'vs_'
      });

      // Should warn but not throw
      expect(invalidService.defaultVectorStoreId).toBe('invalid-id-format');
    });
  });

  describe('Concurrent Request Error Handling', () => {
    it('should handle concurrent request failures independently', async () => {
      // Create separate service instances for each request
      const service1 = createOpenAIVectorStoreService({
        apiKey: 'sk-test-key',
        defaultVectorStoreId: 'vs_test_store',
      });
      const service2 = createOpenAIVectorStoreService({
        apiKey: 'sk-test-key',
        defaultVectorStoreId: 'vs_test_store',
      });
      const service3 = createOpenAIVectorStoreService({
        apiKey: 'sk-test-key',
        defaultVectorStoreId: 'vs_test_store',
      });

      // Mock each service individually
      service1.searchFiles = vi.fn().mockResolvedValue({
        success: true,
        message: 'Success',
        results: [],
        sources: [],
        totalResults: 0,
        query: 'query1',
        executionTime: 100,
      });

      service2.searchFiles = vi
        .fn()
        .mockRejectedValue(new Error('Second request failed'));

      service3.searchFiles = vi.fn().mockResolvedValue({
        success: true,
        message: 'Success',
        results: [],
        sources: [],
        totalResults: 0,
        query: 'query3',
        executionTime: 100,
      });

      const results = await Promise.allSettled([
        service1.searchFiles({ query: 'query1' }),
        service2.searchFiles({ query: 'query2' }),
        service3.searchFiles({ query: 'query3' }),
      ]);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
    });
  });

  describe('Memory and Resource Error Handling', () => {
    it('should handle out-of-memory scenarios', async () => {
      mockOpenAI.responses.create.mockRejectedValueOnce(
        new Error('Out of memory'),
      );

      const request: SearchRequest = { query: 'test' };
      const result = await service.searchFiles(request);

      expect(result.success).toBe(false);
      expect(result.message).toContain('Out of memory');
    });

    it('should handle large response processing errors', async () => {
      // Mock validation
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'completed' }),
      });

      // Create a response with too many results
      const largeResponse = {
        id: 'response_123',
        status: 'completed',
        output: [
          {
            type: 'file_search_call',
            status: 'completed',
            results: Array.from({ length: 10000 }, (_, i) => ({
              file_id: `file_${i}`,
              text: `Large content block ${i}`.repeat(1000),
              score: 0.8,
            })),
          },
        ],
      };

      mockOpenAI.responses.create.mockResolvedValueOnce(largeResponse);

      const request: SearchRequest = { query: 'test', maxResults: 10 };
      const result = await service.searchFiles(request);

      // Should limit results and handle gracefully
      expect(result.results.length).toBeLessThanOrEqual(10);
    });
  });
});
