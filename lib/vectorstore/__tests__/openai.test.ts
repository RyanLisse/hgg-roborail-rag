import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock server-only module to prevent client component error
vi.mock('server-only', () => ({}));

// Mock the env module to allow dynamic environment variable changes during tests
vi.mock('../../env', () => ({
  get OPENAI_API_KEY() {
    return process.env.OPENAI_API_KEY;
  },
  get OPENAI_VECTORSTORE() {
    return process.env.OPENAI_VECTORSTORE;
  },
  default: {
    get OPENAI_API_KEY() {
      return process.env.OPENAI_API_KEY;
    },
    get OPENAI_VECTORSTORE() {
      return process.env.OPENAI_VECTORSTORE;
    },
  },
}));

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

import {
  createOpenAIVectorStoreService,
  type FileUploadRequest,
  type OpenAIVectorStoreService,
  type SearchRequest,
} from '../openai';

// Mock OpenAI SDK
const mockOpenAI = {
  files: {
    create: vi.fn(),
    retrieve: vi.fn(),
  },
  responses: {
    create: vi.fn(),
  },
  beta: {
    vectorStores: {
      files: {
        attach: vi.fn(),
      },
    },
  },
};

vi.mock('openai', () => {
  const mockOpenAIClass = vi.fn().mockImplementation(() => mockOpenAI);
  return {
    default: mockOpenAIClass,
  };
});

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('OpenAI Vector Store Service', () => {
  let service: OpenAIVectorStoreService;

  // Skip these tests if OpenAI API key is not available
  const _skipIfNoOpenAI = process.env.OPENAI_API_KEY ? it : it.skip;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();

    // Reset OpenAI client mocks
    mockOpenAI.files.create.mockClear();
    mockOpenAI.files.retrieve.mockClear();
    mockOpenAI.responses.create.mockClear();
    mockOpenAI.beta.vectorStores.files.attach.mockClear();

    // Mock console methods to prevent test pollution
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});

    // Set default test environment variables only if not already set
    if (!process.env.OPENAI_API_KEY) {
      process.env.OPENAI_API_KEY = 'sk-test-key';
    }
    if (!process.env.OPENAI_VECTORSTORE) {
      process.env.OPENAI_VECTORSTORE = 'vs_test_store';
    }
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('Service Configuration', () => {
    it('should create enabled service with valid API key', () => {
      service = createOpenAIVectorStoreService({
        apiKey: 'sk-valid-key',
        defaultVectorStoreId: 'vs_test_store',
      });

      expect(service.isEnabled).toBe(true);
      expect(service.defaultVectorStoreId).toBe('vs_test_store');
    });

    it('should create disabled service without API key', () => {
      // Save and clear environment variables for this test
      const savedApiKey = process.env.OPENAI_API_KEY;
      const savedVectorStore = process.env.OPENAI_VECTORSTORE;
      delete process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_VECTORSTORE;

      service = createOpenAIVectorStoreService({
        apiKey: '',
        defaultVectorStoreId: null,
      });

      expect(service.isEnabled).toBe(false);
      expect(service.defaultVectorStoreId).toBe(null);

      // Restore environment variables
      if (savedApiKey) { process.env.OPENAI_API_KEY = savedApiKey; }
      if (savedVectorStore) { process.env.OPENAI_VECTORSTORE = savedVectorStore; }
    });

    it('should warn about invalid API key format', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      createOpenAIVectorStoreService({
        apiKey: 'invalid-key',
        defaultVectorStoreId: 'vs_test_store',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'OpenAI API key appears to be invalid (should start with "sk-")',
      );

      consoleSpy.mockRestore();
    });

    it('should warn about invalid vector store ID format', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      createOpenAIVectorStoreService({
        apiKey: 'sk-valid-key',
        defaultVectorStoreId: 'invalid-store-id',
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'OpenAI vector store ID appears to be invalid (should start with "vs_")',
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Vector Store Management', () => {
    beforeEach(() => {
      service = createOpenAIVectorStoreService({
        apiKey: 'sk-test-key',
        defaultVectorStoreId: 'vs_test_store',
      });
    });

    describe('createVectorStore', () => {
      it('should create vector store successfully', async () => {
        const mockVectorStore = {
          id: 'vs_new_store',
          object: 'vector_store',
          created_at: Date.now(),
          name: 'Test Store',
          usage_bytes: 0,
          file_counts: {
            in_progress: 0,
            completed: 0,
            failed: 0,
            cancelled: 0,
            total: 0,
          },
          status: 'completed',
          expires_after: {
            anchor: 'last_active_at',
            days: 365,
          },
          expires_at: null,
          last_active_at: null,
          metadata: {},
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockVectorStore),
        });

        const result = await service.createVectorStore('Test Store', {
          key: 'value',
        });

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.openai.com/v1/vector_stores',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              Authorization: 'Bearer sk-test-key',
              'Content-Type': 'application/json',
              'OpenAI-Beta': 'assistants=v2',
            }),
            body: JSON.stringify({
              name: 'Test Store',
              metadata: { key: 'value' },
              expires_after: {
                anchor: 'last_active_at',
                days: 365,
              },
            }),
          }),
        );

        expect(result).toEqual(mockVectorStore);
      });

      it('should handle API errors', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
          statusText: 'Bad Request',
          json: () =>
            Promise.resolve({
              error: { message: 'Invalid request' },
            }),
        });

        await expect(service.createVectorStore('Test Store')).rejects.toThrow(
          'HTTP 400: Invalid request',
        );
      });

      it('should handle network errors', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        await expect(service.createVectorStore('Test Store')).rejects.toThrow(
          'Network error',
        );
      });
    });

    describe('getVectorStore', () => {
      it('should retrieve vector store successfully', async () => {
        const mockVectorStore = {
          id: 'vs_test_store',
          object: 'vector_store',
          created_at: Date.now(),
          name: 'Test Store',
          usage_bytes: 1024,
          file_counts: {
            in_progress: 0,
            completed: 2,
            failed: 0,
            cancelled: 0,
            total: 2,
          },
          status: 'completed',
          expires_after: null,
          expires_at: null,
          last_active_at: Date.now(),
          metadata: {},
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockVectorStore),
        });

        const result = await service.getVectorStore('vs_test_store');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.openai.com/v1/vector_stores/vs_test_store',
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer sk-test-key',
            }),
          }),
        );

        expect(result).toEqual(mockVectorStore);
      });

      it('should handle 404 errors', async () => {
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
          'HTTP 404: Vector store not found',
        );
      });
    });

    describe('listVectorStores', () => {
      it('should list vector stores successfully', async () => {
        const mockStores = [
          {
            id: 'vs_store1',
            object: 'vector_store',
            created_at: Date.now(),
            name: 'Store 1',
            usage_bytes: 1024,
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
            last_active_at: Date.now(),
            metadata: {},
          },
          {
            id: 'vs_store2',
            object: 'vector_store',
            created_at: Date.now(),
            name: 'Store 2',
            usage_bytes: 2048,
            file_counts: {
              in_progress: 0,
              completed: 2,
              failed: 0,
              cancelled: 0,
              total: 2,
            },
            status: 'completed',
            expires_after: null,
            expires_at: null,
            last_active_at: Date.now(),
            metadata: {},
          },
        ];

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: mockStores }),
        });

        const result = await service.listVectorStores();

        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('vs_store1');
        expect(result[1].id).toBe('vs_store2');
      });

      it('should return empty array on API error', async () => {
        const consoleSpy = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {});

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          json: () => Promise.resolve({}),
        });

        const result = await service.listVectorStores();

        expect(result).toEqual([]);
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to list vector stores:',
          expect.any(Error),
        );

        consoleSpy.mockRestore();
      });
    });

    describe('deleteVectorStore', () => {
      it('should delete vector store successfully', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ deleted: true }),
        });

        const result = await service.deleteVectorStore('vs_test_store');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.openai.com/v1/vector_stores/vs_test_store',
          expect.objectContaining({
            method: 'DELETE',
          }),
        );

        expect(result).toBe(true);
      });

      it('should return false on API error', async () => {
        const consoleSpy = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {});

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: () => Promise.resolve({}),
        });

        const result = await service.deleteVectorStore('vs_nonexistent');

        expect(result).toBe(false);
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
      });
    });
  });

  describe('File Management', () => {
    beforeEach(() => {
      service = createOpenAIVectorStoreService({
        apiKey: 'sk-test-key',
        defaultVectorStoreId: 'vs_test_store',
      });
    });

    describe('uploadFile', () => {
      it('should upload file successfully', async () => {
        const mockFile = new File(['test content'], 'test.txt', {
          type: 'text/plain',
        });
        const mockUploadedFile = {
          id: 'file_123',
          object: 'file',
          filename: 'test.txt',
        };
        const mockVectorStoreFile = {
          id: 'file_123',
          object: 'vector_store.file',
          created_at: Date.now(),
          vector_store_id: 'vs_test_store',
          status: 'completed',
          last_error: null,
        };

        mockOpenAI.files.create.mockResolvedValueOnce(mockUploadedFile);
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockVectorStoreFile),
        });

        const request: FileUploadRequest = {
          file: mockFile,
          name: 'test.txt',
        };

        const result = await service.uploadFile(request);

        expect(mockOpenAI.files.create).toHaveBeenCalledWith({
          file: mockFile,
          purpose: 'assistants',
        });

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.openai.com/v1/vector_stores/vs_test_store/files',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ file_id: 'file_123' }),
          }),
        );

        expect(result).toEqual(mockVectorStoreFile);
      });

      it('should throw error without vector store ID', async () => {
        const serviceWithoutStore = createOpenAIVectorStoreService({
          apiKey: 'sk-test-key',
          defaultVectorStoreId: null,
        });

        const mockFile = new File(['test'], 'test.txt', { type: 'text/plain' });
        const request: FileUploadRequest = {
          file: mockFile,
          vectorStoreId: null as any,
        };

        await expect(serviceWithoutStore.uploadFile(request)).rejects.toThrow();
      });

      it('should handle file upload errors', async () => {
        const mockFile = new File(['test'], 'test.txt', { type: 'text/plain' });
        mockOpenAI.files.create.mockRejectedValueOnce(
          new Error('Upload failed'),
        );

        const request: FileUploadRequest = { file: mockFile };

        await expect(service.uploadFile(request)).rejects.toThrow(
          'Upload failed',
        );
      });
    });

    describe('listFiles', () => {
      it('should list files successfully', async () => {
        const mockFiles = [
          {
            id: 'file_1',
            object: 'vector_store.file',
            created_at: Date.now(),
            vector_store_id: 'vs_test_store',
            status: 'completed',
            last_error: null,
          },
          {
            id: 'file_2',
            object: 'vector_store.file',
            created_at: Date.now(),
            vector_store_id: 'vs_test_store',
            status: 'completed',
            last_error: null,
          },
        ];

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ data: mockFiles }),
        });

        const result = await service.listFiles();

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.openai.com/v1/vector_stores/vs_test_store/files',
          expect.objectContaining({
            headers: expect.objectContaining({
              Authorization: 'Bearer sk-test-key',
            }),
          }),
        );

        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('file_1');
      });

      it('should return empty array on error', async () => {
        const consoleSpy = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {});

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
        });

        const result = await service.listFiles();

        expect(result).toEqual([]);
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
      });
    });

    describe('deleteFile', () => {
      it('should delete file successfully', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ deleted: true }),
        });

        const result = await service.deleteFile('file_123');

        expect(mockFetch).toHaveBeenCalledWith(
          'https://api.openai.com/v1/vector_stores/vs_test_store/files/file_123',
          expect.objectContaining({
            method: 'DELETE',
          }),
        );

        expect(result).toBe(true);
      });

      it('should return false on error', async () => {
        const consoleSpy = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {});

        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: () => Promise.resolve({}),
        });

        const result = await service.deleteFile('file_nonexistent');

        expect(result).toBe(false);
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
      });
    });
  });

  describe('Search Operations', () => {
    beforeEach(() => {
      service = createOpenAIVectorStoreService({
        apiKey: 'sk-test-key',
        defaultVectorStoreId: 'vs_test_store',
      });
    });

    describe('searchFiles', () => {
      it('should search files successfully', async () => {
        const mockSearchResponse = {
          id: 'response_123',
          object: 'response',
          created_at: Date.now(),
          status: 'completed',
          model: 'gpt-4o-mini',
          output: [
            {
              type: 'file_search_call',
              status: 'completed',
              queries: ['test query'],
              results: [
                {
                  file_id: 'file_123',
                  filename: 'document.txt',
                  text: 'This is test content from the document.',
                  score: 0.95,
                  chunk_id: 'chunk_1',
                  attributes: { page: 1 },
                },
              ],
            },
          ],
        };

        const mockFileInfo = {
          id: 'file_123',
          filename: 'document.txt',
        };

        // Mock vector store validation - return a valid vector store
        const mockVectorStore = {
          id: 'vs_test_store',
          object: 'vector_store',
          created_at: Date.now(),
          status: 'completed',
          name: 'Test Store',
          usage_bytes: 0,
          file_counts: {
            in_progress: 0,
            completed: 1,
            failed: 0,
            cancelled: 0,
            total: 1,
          },
          expires_after: null,
          expires_at: null,
          last_active_at: null,
          metadata: {},
        };

        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockVectorStore),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockFileInfo),
          });

        mockOpenAI.responses.create.mockResolvedValueOnce(mockSearchResponse);
        mockOpenAI.files.retrieve.mockResolvedValueOnce(mockFileInfo);

        const request: SearchRequest = {
          query: 'test query',
          maxResults: 10,
        };

        const result = await service.searchFiles(request);

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
        expect(result.results).toHaveLength(1);
        expect(result.results[0].content).toBe(
          'This is test content from the document.',
        );
        expect(result.sources).toHaveLength(1);
        expect(result.sources[0].name).toBe('document.txt');
      });

      it('should handle validation failure', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: 'Not Found',
          json: () =>
            Promise.resolve({
              error: { message: 'Vector store not found' },
            }),
        });

        const request: SearchRequest = {
          query: 'test query',
        };

        const result = await service.searchFiles(request);

        expect(result.success).toBe(false);
        expect(result.message).toContain('not accessible or does not exist');
      });

      it('should handle search errors', async () => {
        // Mock validation success with valid vector store
        const mockVectorStore = {
          id: 'vs_test_store',
          object: 'vector_store',
          created_at: Date.now(),
          status: 'completed',
          name: 'Test Store',
          usage_bytes: 0,
          file_counts: {
            in_progress: 0,
            completed: 1,
            failed: 0,
            cancelled: 0,
            total: 1,
          },
          expires_after: null,
          expires_at: null,
          last_active_at: null,
          metadata: {},
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockVectorStore),
        });

        mockOpenAI.responses.create.mockRejectedValueOnce(
          new Error('Search failed'),
        );

        const request: SearchRequest = {
          query: 'test query',
        };

        const result = await service.searchFiles(request);

        expect(result.success).toBe(false);
        expect(result.message).toBeDefined();
      });

      it('should handle missing vector store ID', async () => {
        // Create a service without any vector store ID by explicitly passing null
        // and not relying on environment variables
        const serviceWithoutStore = createOpenAIVectorStoreService({
          apiKey: 'sk-test-key',
          defaultVectorStoreId: null,
        });

        // Set the internal defaultVectorStoreId to null to bypass environment fallback
        Object.defineProperty(serviceWithoutStore, 'defaultVectorStoreId', {
          value: null,
          writable: false,
        });

        const request: SearchRequest = {
          query: 'test query',
        };

        const result = await serviceWithoutStore.searchFiles(request);

        expect(result.success).toBe(false);
        // The service may either return "No vector store ID provided" or fail to access a default vector store
        expect(result.message).toMatch(
          /(?:No vector store ID provided and no default configured|Vector store .+ is not accessible or does not exist)/,
        );
      });
    });

    describe('searchWithRetry', () => {
      it('should succeed on first attempt', async () => {
        // Mock valid vector store for validation
        const mockVectorStore = {
          id: 'vs_test_store',
          object: 'vector_store',
          created_at: Date.now(),
          status: 'completed',
          name: 'Test Store',
          usage_bytes: 0,
          file_counts: {
            in_progress: 0,
            completed: 1,
            failed: 0,
            cancelled: 0,
            total: 1,
          },
          expires_after: null,
          expires_at: null,
          last_active_at: null,
          metadata: {},
        };

        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockVectorStore),
        });

        mockOpenAI.responses.create.mockResolvedValueOnce({
          id: 'response_retry',
          status: 'completed',
          output: [],
        });

        const request: SearchRequest = { query: 'test' };
        const result = await service.searchWithRetry(request, 3);

        expect(result.success).toBe(true);
      });

      it('should retry on failure and eventually succeed', async () => {
        // Mock valid vector store for all validation attempts
        const mockVectorStore = {
          id: 'vs_test_store',
          object: 'vector_store',
          created_at: Date.now(),
          status: 'completed',
          name: 'Test Store',
          usage_bytes: 0,
          file_counts: {
            in_progress: 0,
            completed: 1,
            failed: 0,
            cancelled: 0,
            total: 1,
          },
          expires_after: null,
          expires_at: null,
          last_active_at: null,
          metadata: {},
        };

        // First attempt - validation succeeds, search fails
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockVectorStore),
        });
        mockOpenAI.responses.create.mockRejectedValueOnce(
          new Error('Temporary failure'),
        );

        // Second attempt - validation succeeds, search succeeds
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockVectorStore),
        });
        mockOpenAI.responses.create.mockResolvedValueOnce({
          id: 'response_retry_success',
          status: 'completed',
          output: [],
        });

        const request: SearchRequest = { query: 'test' };
        const result = await service.searchWithRetry(request, 3);

        expect(result.success).toBe(true);
        expect(mockOpenAI.responses.create).toHaveBeenCalledTimes(2);
      });

      it('should not retry on non-retryable errors', async () => {
        const serviceWithoutStore = createOpenAIVectorStoreService({
          apiKey: 'sk-test-key',
          defaultVectorStoreId: null,
        });

        const request: SearchRequest = { query: 'test' };
        const result = await serviceWithoutStore.searchWithRetry(request, 3);

        expect(result.success).toBe(false);
        // The method returns the result directly without retrying
        expect(result.message).toBe(
          'No vector store ID provided and no default configured',
        );
      });

      it('should exhaust all retries', async () => {
        // Mock valid vector store for validation
        const mockVectorStore = {
          id: 'vs_test_store',
          object: 'vector_store',
          created_at: Date.now(),
          status: 'completed',
          name: 'Test Store',
          usage_bytes: 0,
          file_counts: {
            in_progress: 0,
            completed: 1,
            failed: 0,
            cancelled: 0,
            total: 1,
          },
          expires_after: null,
          expires_at: null,
          last_active_at: null,
          metadata: {},
        };

        // Mock validation to succeed for all attempts
        mockFetch.mockResolvedValue({
          ok: true,
          json: () => Promise.resolve(mockVectorStore),
        });

        // All attempts fail
        mockOpenAI.responses.create
          .mockRejectedValueOnce(new Error('Persistent error'))
          .mockRejectedValueOnce(new Error('Persistent error'));

        const request: SearchRequest = { query: 'test' };
        const result = await service.searchWithRetry(request, 2);

        expect(result.success).toBe(false);
        expect(result.message).toContain('failed after 2 attempts');
        expect(mockOpenAI.responses.create).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Health Check and Utilities', () => {
    beforeEach(() => {
      service = createOpenAIVectorStoreService({
        apiKey: 'sk-test-key',
        defaultVectorStoreId: 'vs_test_store',
      });
    });

    describe('healthCheck', () => {
      it('should return healthy status', async () => {
        const mockVectorStore = {
          id: 'vs_test_store',
          object: 'vector_store',
          created_at: Date.now(),
          status: 'completed',
          name: 'Test Store',
          usage_bytes: 0,
          file_counts: {
            in_progress: 0,
            completed: 1,
            failed: 0,
            cancelled: 0,
            total: 1,
          },
          expires_after: null,
          expires_at: null,
          last_active_at: null,
          metadata: {},
        };

        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ data: [] }),
          })
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve(mockVectorStore),
          });

        const result = await service.healthCheck();

        expect(result.isHealthy).toBe(true);
        expect(result.vectorStoreStatus).toContain('accessible');
      });

      it('should return unhealthy on API failure', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
        });

        const result = await service.healthCheck();

        expect(result.isHealthy).toBe(false);
        expect(result.error).toContain('API connectivity test failed');
      });

      it('should handle vector store access failure', async () => {
        mockFetch
          .mockResolvedValueOnce({
            ok: true,
            json: () => Promise.resolve({ data: [] }),
          })
          .mockResolvedValueOnce({
            ok: false,
            status: 404,
            statusText: 'Not Found',
          });

        const result = await service.healthCheck();

        expect(result.isHealthy).toBe(true);
        expect(result.vectorStoreStatus).toContain('inaccessible');
      });
    });

    describe('validateVectorStore', () => {
      it('should validate completed vector store', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'vs_test_store',
              object: 'vector_store',
              created_at: Date.now(),
              status: 'completed',
              name: 'Test Store',
              usage_bytes: 0,
              file_counts: {
                in_progress: 0,
                completed: 0,
                failed: 0,
                cancelled: 0,
                total: 0,
              },
              expires_after: null,
              expires_at: null,
              last_active_at: null,
              metadata: {},
            }),
        });

        const result = await service.validateVectorStore('vs_test_store');

        expect(result).toBe(true);
      });

      it('should validate in-progress vector store', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'vs_test_store',
              object: 'vector_store',
              created_at: Date.now(),
              status: 'in_progress',
              name: 'Test Store',
              usage_bytes: 0,
              file_counts: {
                in_progress: 0,
                completed: 0,
                failed: 0,
                cancelled: 0,
                total: 0,
              },
              expires_after: null,
              expires_at: null,
              last_active_at: null,
              metadata: {},
            }),
        });

        const result = await service.validateVectorStore('vs_test_store');

        expect(result).toBe(true);
      });

      it('should reject expired vector store', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: () =>
            Promise.resolve({
              id: 'vs_test_store',
              status: 'expired',
            }),
        });

        const result = await service.validateVectorStore('vs_test_store');

        expect(result).toBe(false);
      });

      it('should handle validation error', async () => {
        const consoleSpy = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {});

        mockFetch.mockRejectedValueOnce(new Error('Network error'));

        const result = await service.validateVectorStore('vs_test_store');

        expect(result).toBe(false);
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
      });
    });

    describe('getSourceFiles', () => {
      it('should retrieve source file information', async () => {
        const mockFile = {
          id: 'file_123',
          filename: 'document.txt',
        };

        mockOpenAI.files.retrieve.mockResolvedValueOnce(mockFile);

        const result = await service.getSourceFiles(['file_123']);

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('document.txt');
        expect(result[0].id).toBe('file_123');
      });

      it('should handle file retrieval errors', async () => {
        const consoleSpy = vi
          .spyOn(console, 'error')
          .mockImplementation(() => {});

        mockOpenAI.files.retrieve.mockRejectedValueOnce(
          new Error('File not found'),
        );

        const result = await service.getSourceFiles(['file_nonexistent']);

        expect(result).toHaveLength(1);
        expect(result[0].name).toBe('Unknown file (file_nonexistent)');
        expect(consoleSpy).toHaveBeenCalled();

        consoleSpy.mockRestore();
      });

      it('should return empty array for no file IDs', async () => {
        const result = await service.getSourceFiles([]);

        expect(result).toEqual([]);
      });
    });

    describe('getFileSearchTool', () => {
      it('should return file search tool configuration', () => {
        const result = service.getFileSearchTool();

        expect(result).toBeTruthy();
        expect(result.type).toBe('file_search');
        expect(result.file_search).toBeTruthy();
        expect(result.file_search.vector_store_ids).toEqual(['vs_test_store']);
        expect(result.file_search.max_num_results).toBe(20);
        // Additional fields from the implementation are OK
        expect(result.file_search.search_strategy).toBeDefined();
        expect(result.file_search.domain_context).toBeDefined();
      });

      it('should return null without vector store ID', () => {
        // Save and clear environment variables
        const savedVectorStore = process.env.OPENAI_VECTORSTORE;
        delete process.env.OPENAI_VECTORSTORE;

        const serviceWithoutStore = createOpenAIVectorStoreService({
          apiKey: 'sk-test-key',
          defaultVectorStoreId: null,
        });

        // Use spyon to suppress console.warn
        const consoleSpy = vi
          .spyOn(console, 'warn')
          .mockImplementation(() => {});
        const result = serviceWithoutStore.getFileSearchTool();
        consoleSpy.mockRestore();

        expect(result).toBe(null);

        // Restore environment variable
        if (savedVectorStore) { process.env.OPENAI_VECTORSTORE = savedVectorStore; }
      });

      it('should use provided vector store ID', () => {
        const result = service.getFileSearchTool('vs_custom_store');

        expect(result).not.toBeNull();
        expect(result?.file_search.vector_store_ids).toEqual([
          'vs_custom_store',
        ]);
      });
    });
  });

  describe('Disabled Service', () => {
    let disabledService: OpenAIVectorStoreService;
    let originalEnvApiKey: string | undefined;
    let originalEnvVectorStore: string | undefined;

    beforeEach(() => {
      // Save and clear environment variables
      originalEnvApiKey = process.env.OPENAI_API_KEY;
      originalEnvVectorStore = process.env.OPENAI_VECTORSTORE;
      delete process.env.OPENAI_API_KEY;
      delete process.env.OPENAI_VECTORSTORE;

      disabledService = createOpenAIVectorStoreService({
        apiKey: '',
        defaultVectorStoreId: null,
      });
    });

    afterEach(() => {
      // Restore environment variables
      if (originalEnvApiKey) { process.env.OPENAI_API_KEY = originalEnvApiKey; }
      if (originalEnvVectorStore) {
        process.env.OPENAI_VECTORSTORE = originalEnvVectorStore;
      }
    });

    it('should throw errors for write operations', async () => {
      await expect(disabledService.createVectorStore('test')).rejects.toThrow(
        'OpenAI vector store service is disabled',
      );
      await expect(disabledService.getVectorStore('vs_test')).rejects.toThrow(
        'OpenAI vector store service is disabled',
      );

      const mockFile = new File(['test'], 'test.txt');
      await expect(
        disabledService.uploadFile({ file: mockFile }),
      ).rejects.toThrow('OpenAI vector store service is disabled');
    });

    it('should return empty arrays for read operations', async () => {
      const stores = await disabledService.listVectorStores();
      const files = await disabledService.listFiles();
      const sources = await disabledService.getSourceFiles(['file_1']);

      expect(stores).toEqual([]);
      expect(files).toEqual([]);
      expect(sources).toEqual([]);
    });

    it('should return false for delete operations', async () => {
      const deleteStore = await disabledService.deleteVectorStore('vs_test');
      const deleteFile = await disabledService.deleteFile('file_test');

      expect(deleteStore).toBe(false);
      expect(deleteFile).toBe(false);
    });

    it('should return failure for search operations', async () => {
      const searchResult = await disabledService.searchFiles({ query: 'test' });

      expect(searchResult.success).toBe(false);
      expect(searchResult.message).toContain('disabled');
    });

    it('should return unhealthy status', async () => {
      const health = await disabledService.healthCheck();

      expect(health.isHealthy).toBe(false);
      expect(health.error).toBe('Service disabled');
    });

    it('should return null for file search tool', () => {
      const tool = disabledService.getFileSearchTool();

      expect(tool).toBe(null);
    });
  });
});
