import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock server-only module
vi.mock('server-only', () => ({}));

// Mock the AI providers
vi.mock('@/lib/ai/providers', () => ({
  getEmbeddingModelInstance: vi.fn(() => ({
    specificationVersion: 'v1',
    provider: 'cohere',
    modelId: 'embed-english-v3.0',
  })),
}));

// Mock OpenAI embeddings
const mockEmbeddings = {
  embeddings: {
    create: vi.fn(),
  },
};

vi.mock('openai', () => ({
  default: vi.fn(() => mockEmbeddings),
}));

// Mock AI SDK with customProvider
vi.mock('ai', () => ({
  embed: vi.fn(),
  customProvider: vi.fn().mockImplementation((config: any) => ({
    languageModels: config.languageModels || {},
  })),
}));

// Mock @ai-sdk/cohere to fix textEmbeddingModel issue
vi.mock('@ai-sdk/cohere', () => ({
  cohere: {
    textEmbeddingModel: vi.fn().mockReturnValue({
      specificationVersion: 'v1',
      provider: 'cohere',
      modelId: 'embed-english-v3.0',
      maxEmbeddingsPerCall: 96,
      supportsParallelCalls: true,
      doEmbed: async ({ values }: { values: string[] }) => {
        return {
          embeddings: values.map(() =>
            Array.from({ length: 1024 }, () => Math.random() - 0.5),
          ),
        };
      },
    }),
  },
}));

// Mock environment variables
vi.mock('@/lib/env', () => ({
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key',
  OPENAI_API_KEY: 'sk-test-key',
  GOOGLE_GENERATIVE_AI_API_KEY: 'test-google-key',
  COHERE_API_KEY: 'test-cohere-key',
  POSTGRES_URL: 'postgresql://test:test@localhost:5432/test',
  smartSpawnConfig: {
    maxConnections: 10,
    connectionTimeout: 5000,
    retryAttempts: 3,
  },
}));

// Mock the database queries module
const mockDatabase = {
  insert: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  execute: vi.fn().mockReturnThis(),
  from: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  offset: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([{ id: 'test-id', title: 'Test Doc' }]),
};

vi.mock('@/lib/db/queries', () => ({
  getDb: vi.fn(() => mockDatabase),
}));

// Import after mocking
import { embed } from 'ai';
import { SupabaseRAGService } from '../supabase-rag';
import { getDb } from '@/lib/db/queries';

describe('SupabaseRAGService', () => {
  let ragService: SupabaseRAGService;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset all mock database methods
    Object.keys(mockDatabase).forEach(key => {
      if (typeof mockDatabase[key] === 'function') {
        mockDatabase[key].mockClear();
        if (key !== 'returning') {
          mockDatabase[key].mockReturnThis();
        }
      }
    });

    // Set up default successful responses
    mockDatabase.returning.mockResolvedValue([{ 
      id: 'test-id', 
      title: 'Test Document',
      createdAt: new Date(),
    }]);
    
    mockDatabase.execute.mockResolvedValue({
      rows: [
        {
          id: 'result-1',
          content: 'Test content',
          similarity: '0.85',
          metadata: { source: 'test' },
          documentId: 'doc-1',
        },
      ],
    });

    ragService = new SupabaseRAGService();
  });

  describe('Document Upload', () => {
    it('should upload document with embedding generation', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      (embed as any).mockResolvedValue({ embedding: mockEmbedding });

      // Mock already set up in beforeEach

      const document = {
        id: 'doc-123',
        title: 'Test Document',
        content: 'This is test content for vector storage',
        metadata: { source: 'test' },
      };

      const result = await ragService.uploadDocument(document, 'user-123');

      expect(embed).toHaveBeenCalledWith(
        expect.objectContaining({
          value: document.content,
        }),
      );

      expect(mockDatabase.insert).toHaveBeenCalledWith(
        expect.any(Object), // The table schema object
      );
      
      expect(mockDatabase.values).toHaveBeenCalledWith({
        id: document.id,
        title: document.title,
        content: document.content,
        kind: 'text',
        userId: 'user-123',
        createdAt: expect.any(Date),
      });

      expect(result).toEqual({
        id: 'test-id',
        title: 'Test Document',
      });
    });

    it('should handle embedding generation errors', async () => {
      (embed as any).mockRejectedValue(new Error('Embedding failed'));

      const document = {
        id: 'doc-123',
        title: 'Test Document',
        content: 'Test content',
        metadata: {},
      };

      await expect(
        ragService.uploadDocument(document, 'user-123'),
      ).rejects.toThrow('Failed to generate embedding');
    });

    it('should handle document insertion errors', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      (embed as any).mockResolvedValue({ embedding: mockEmbedding });

      // Mock database insert to throw an error
      mockDatabase.insert.mockImplementationOnce(() => {
        const chainable = {
          values: vi.fn().mockImplementationOnce(() => {
            const returning = {
              returning: vi.fn().mockRejectedValue(new Error('Failed to insert document')),
            };
            return returning;
          }),
        };
        return chainable;
      });

      const document = {
        id: 'doc-123',
        title: 'Test Document',
        content: 'Test content',
        metadata: {},
      };

      await expect(
        ragService.uploadDocument(document, 'user-123'),
      ).rejects.toThrow('Failed to insert document');
    });

    it('should upload document with long content requiring chunking', async () => {
      const longContent = 'This is a very long document. '.repeat(1000);
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      (embed as any).mockResolvedValue({ embedding: mockEmbedding });

      const document = {
        id: 'doc-long',
        title: 'Long Document',
        content: longContent,
        metadata: { type: 'research' },
      };

      const result = await ragService.uploadDocument(document, 'user-123');

      expect(result).toEqual({
        id: 'test-id',
        title: 'Test Document',
      });

      // Should still process the document even if it's long
      expect(mockDatabase.insert).toHaveBeenCalled();
    });
  });

  describe('Vector Search', () => {
    it('should search for similar documents', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      (embed as any).mockResolvedValue({ embedding: mockEmbedding });

      const mockSearchResults = [
        {
          id: 'doc-1',
          content: 'Content that matches query',
          similarity: 0.95,
          metadata: { source: 'test' },
          documentId: 'doc-1',
        },
        {
          id: 'doc-2',
          content: 'Another matching content',
          similarity: 0.87,
          metadata: { source: 'test' },
          documentId: 'doc-2',
        },
      ];

      mockDatabase.execute.mockResolvedValue({
        rows: mockSearchResults.map(result => ({
          ...result,
          similarity: result.similarity.toString(),
        })),
      });

      const results = await ragService.searchSimilar('test query', 5, 0.7);

      expect(embed).toHaveBeenCalledWith(
        expect.objectContaining({
          value: 'test query',
        }),
      );

      expect(mockDatabase.execute).toHaveBeenCalled();
      expect(results).toEqual(mockSearchResults);
    });

    it('should handle search with no results', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      (embed as any).mockResolvedValue({ embedding: mockEmbedding });

      mockDatabase.execute.mockResolvedValue({
        rows: [],
      });

      const results = await ragService.searchSimilar(
        'no matches query',
        5,
        0.8,
      );

      expect(results).toEqual([]);
    });

    it('should handle search RPC errors', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      (embed as any).mockResolvedValue({ embedding: mockEmbedding });

      mockDatabase.execute.mockRejectedValue(new Error('RPC function failed'));

      await expect(
        ragService.searchSimilar('test query', 5, 0.7),
      ).rejects.toThrow('Search failed');
    });

    it('should handle query embedding errors', async () => {
      (embed as any).mockRejectedValue(new Error('Embedding failed'));

      await expect(
        ragService.searchSimilar('test query', 5, 0.7),
      ).rejects.toThrow('Failed to generate query embedding');
    });

    it('should search with different similarity thresholds', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      (embed as any).mockResolvedValue({ embedding: mockEmbedding });

      mockDatabase.execute.mockResolvedValue({
        rows: [{ id: 'high-similarity', similarity: '0.95' }],
      });

      const results = await ragService.searchSimilar('precise query', 3, 0.9);

      expect(mockDatabase.execute).toHaveBeenCalled();
      expect(results).toHaveLength(1);
      expect(results[0].similarity).toBe(0.95);
    });

    it('should search with different result limits', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      (embed as any).mockResolvedValue({ embedding: mockEmbedding });

      mockDatabase.execute.mockResolvedValue({
        rows: [],
      });

      const results = await ragService.searchSimilar('test query', 20, 0.5);

      expect(mockDatabase.execute).toHaveBeenCalled();
      expect(results).toEqual([]);
    });
  });

  describe('Document Management', () => {
    it('should get document by ID', async () => {
      const mockDocument = {
        id: 'doc-123',
        title: 'Test Document',
        content: 'Document content',
        metadata: { source: 'test' },
        createdAt: '2024-01-01T00:00:00Z',
      };

      mockDatabase.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([mockDocument]),
        }),
      });

      const result = await ragService.getDocument('doc-123');

      expect(mockDatabase.select).toHaveBeenCalled();
      expect(result).toEqual(mockDocument);
    });

    it('should handle document not found', async () => {
      mockDatabase.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
        }),
      });

      const result = await ragService.getDocument('nonexistent');

      expect(result).toBeNull();
    });

    it('should delete document by ID', async () => {
      mockDatabase.delete.mockReturnValue({
        where: vi.fn().mockResolvedValue({ success: true }),
      });

      const result = await ragService.deleteDocument('doc-123');

      expect(mockDatabase.delete).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should handle deletion errors', async () => {
      mockDatabase.delete.mockReturnValue({
        where: vi.fn().mockRejectedValue(new Error('Delete failed')),
      });

      const result = await ragService.deleteDocument('doc-123');

      expect(result).toBe(false);
    });

    it('should list documents with pagination', async () => {
      const mockDocuments = [
        { id: 'doc-1', title: 'Document 1' },
        { id: 'doc-2', title: 'Document 2' },
      ];

      mockDatabase.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue(mockDocuments),
            }),
          }),
        }),
      });

      const result = await ragService.listDocuments(10, 0);

      expect(mockDatabase.select).toHaveBeenCalled();
      expect(result).toEqual(mockDocuments);
    });
  });

  describe('Statistics and Health', () => {
    it('should get vector store statistics', async () => {
      const mockStats = {
        totalDocuments: 150,
        totalEmbeddings: 150,
      };

      mockDatabase.select.mockReturnValue({
        from: vi.fn().mockResolvedValue([{ count: 150 }]),
      });

      const result = await ragService.getStats();

      expect(mockDatabase.select).toHaveBeenCalled();
      expect(result).toEqual(mockStats);
    });

    it('should handle stats RPC errors', async () => {
      mockDatabase.select.mockReturnValue({
        from: vi.fn().mockRejectedValue(new Error('RPC failed')),
      });

      await expect(ragService.getStats()).rejects.toThrow(
        'Failed to get statistics',
      );
    });

    it('should perform health check', async () => {
      // Mock successful table query for health check
      mockDatabase.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ count: 10 }]),
        }),
      });

      const result = await ragService.healthCheck();

      expect(result.isHealthy).toBe(true);
      expect(result.responseTime).toBeGreaterThan(0);
    });

    it('should detect health check failures', async () => {
      mockDatabase.select.mockReturnValue({
        from: vi.fn().mockReturnValue({
          limit: vi.fn().mockRejectedValue(new Error('Connection failed')),
        }),
      });

      const result = await ragService.healthCheck();

      expect(result.isHealthy).toBe(false);
      expect(result.error).toContain('Health check failed');
    });
  });

  describe('Bulk Operations', () => {
    it('should upload multiple documents in batch', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      (embed as any).mockResolvedValue({ embedding: mockEmbedding });

      // Mock already set up in beforeEach for batch operations

      const documents = [
        {
          id: 'doc-1',
          title: 'Document 1',
          content: 'Content 1',
          metadata: {},
        },
        {
          id: 'doc-2',
          title: 'Document 2',
          content: 'Content 2',
          metadata: {},
        },
      ];

      const result = await ragService.uploadDocumentsBatch(
        documents,
        'user-123',
      );

      expect(embed).toHaveBeenCalledTimes(2);
      expect(mockDatabase.insert).toHaveBeenCalledTimes(4);

      expect(result).toEqual([
        { id: 'test-id', title: 'Test Document' },
        { id: 'test-id', title: 'Test Document' },
      ]);
    });

    it('should handle partial batch upload failures', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      (embed as any)
        .mockResolvedValueOnce({ embedding: mockEmbedding })
        .mockRejectedValueOnce(new Error('Embedding failed'));

      const documents = [
        {
          id: 'doc-1',
          title: 'Document 1',
          content: 'Content 1',
          metadata: {},
        },
        {
          id: 'doc-2',
          title: 'Document 2',
          content: 'Content 2',
          metadata: {},
        },
      ];

      await expect(
        ragService.uploadDocumentsBatch(documents, 'user-123'),
      ).rejects.toThrow('Batch upload failed');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty content gracefully', async () => {
      const document = {
        id: 'doc-empty',
        title: 'Empty Document',
        content: '',
        metadata: {},
      };

      await expect(
        ragService.uploadDocument(document, 'user-123'),
      ).rejects.toThrow('Document content cannot be empty');
    });

    it('should handle very large embeddings', async () => {
      const largeEmbedding = Array.from({ length: 1536 }, (_, i) => i / 1536);
      (embed as any).mockResolvedValue({ embedding: largeEmbedding });

      // Mock already set up in beforeEach

      const document = {
        id: 'doc-large',
        title: 'Document with Large Embedding',
        content: 'Test content',
        metadata: {},
      };

      const result = await ragService.uploadDocument(document, 'user-123');

      expect(result.id).toBe('test-id');
      expect(mockDatabase.insert).toHaveBeenCalled();
    });

    it('should handle malformed metadata', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      (embed as any).mockResolvedValue({ embedding: mockEmbedding });

      // Mock already set up in beforeEach

      const document = {
        id: 'doc-meta',
        title: 'Document with Complex Metadata',
        content: 'Test content',
        metadata: {
          nested: { deep: { value: 'test' } },
          array: [1, 2, 3],
          nullValue: null,
          undefinedValue: undefined,
        },
      };

      const result = await ragService.uploadDocument(document, 'user-123');

      expect(result.id).toBe('test-id');
      // Should handle complex metadata without errors
    });

    it('should handle concurrent search requests', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      (embed as any).mockResolvedValue({ embedding: mockEmbedding });

      mockDatabase.execute.mockResolvedValue({
        rows: [{ id: 'result-1', similarity: '0.8' }],
      });

      // Simulate concurrent requests
      const searchPromises = Array.from({ length: 5 }, (_, i) =>
        ragService.searchSimilar(`query ${i}`, 5, 0.7),
      );

      const results = await Promise.all(searchPromises);

      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result).toEqual([{ id: 'result-1', similarity: 0.8, content: undefined, metadata: {}, documentId: undefined }]);
      });
    });
  });
});
