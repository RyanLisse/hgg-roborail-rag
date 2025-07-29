import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock server-only module
vi.mock('server-only', () => ({}));

// Mock dependencies
const mockCreateClient = vi.fn();
const mockSupabaseClient = {
  from: vi.fn(),
  rpc: vi.fn(),
  auth: {
    getSession: vi.fn(),
  },
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
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
          embeddings: values.map(() => Array.from({ length: 1024 }, () => Math.random() - 0.5))
        };
      }
    })
  }
}));

// Mock environment variables
vi.mock('@/lib/env', () => ({
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'test-anon-key',
  OPENAI_API_KEY: 'sk-test-key',
  GOOGLE_GENERATIVE_AI_API_KEY: 'test-google-key',
  COHERE_API_KEY: 'test-cohere-key',
  smartSpawnConfig: {
    maxConnections: 10,
    connectionTimeout: 5000,
    retryAttempts: 3
  }
}));

// Import after mocking
import { createClient } from '@supabase/supabase-js';
import { embed } from 'ai';
import { SupabaseRAGService } from '../supabase-rag';

describe('SupabaseRAGService', () => {
  let ragService: SupabaseRAGService;
  let mockTable: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock table operations
    mockTable = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn(),
    };

    mockSupabaseClient.from.mockReturnValue(mockTable);
    mockSupabaseClient.rpc.mockResolvedValue({ data: [], error: null });
    mockCreateClient.mockReturnValue(mockSupabaseClient);

    ragService = new SupabaseRAGService();
  });

  describe('Document Upload', () => {
    it('should upload document with embedding generation', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      (embed as any).mockResolvedValue({ embedding: mockEmbedding });

      mockTable.single.mockResolvedValue({
        data: { id: 'doc-123', title: 'Test Document' },
        error: null,
      });

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

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('documents');
      expect(mockTable.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: document.id,
          title: document.title,
          content: document.content,
          embedding: mockEmbedding,
          metadata: document.metadata,
          user_id: 'user-123',
        }),
      );

      expect(result).toEqual({
        id: 'doc-123',
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

      mockTable.single.mockResolvedValue({
        data: null,
        error: { message: 'Insert failed' },
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

      mockTable.single.mockResolvedValue({
        data: { id: 'doc-long', title: 'Long Document' },
        error: null,
      });

      const document = {
        id: 'doc-long',
        title: 'Long Document',
        content: longContent,
        metadata: { type: 'research' },
      };

      const result = await ragService.uploadDocument(document, 'user-123');

      expect(result).toEqual({
        id: 'doc-long',
        title: 'Long Document',
      });

      // Should still process the document even if it's long
      expect(mockTable.insert).toHaveBeenCalled();
    });
  });

  describe('Vector Search', () => {
    it('should search for similar documents', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      (embed as any).mockResolvedValue({ embedding: mockEmbedding });

      const mockSearchResults = [
        {
          id: 'doc-1',
          title: 'Similar Document 1',
          content: 'Content that matches query',
          similarity: 0.95,
          metadata: { source: 'test' },
        },
        {
          id: 'doc-2',
          title: 'Similar Document 2',
          content: 'Another matching content',
          similarity: 0.87,
          metadata: { source: 'test' },
        },
      ];

      mockSupabaseClient.rpc.mockResolvedValue({
        data: mockSearchResults,
        error: null,
      });

      const results = await ragService.searchSimilar('test query', 5, 0.7);

      expect(embed).toHaveBeenCalledWith(
        expect.objectContaining({
          value: 'test query',
        }),
      );

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('search_documents', {
        query_embedding: mockEmbedding,
        similarity_threshold: 0.7,
        match_count: 5,
      });

      expect(results).toEqual(mockSearchResults);
    });

    it('should handle search with no results', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      (embed as any).mockResolvedValue({ embedding: mockEmbedding });

      mockSupabaseClient.rpc.mockResolvedValue({
        data: [],
        error: null,
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

      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC function failed' },
      });

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

      mockSupabaseClient.rpc.mockResolvedValue({
        data: [{ id: 'high-similarity', similarity: 0.95 }],
        error: null,
      });

      await ragService.searchSimilar('precise query', 3, 0.9);

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('search_documents', {
        query_embedding: mockEmbedding,
        similarity_threshold: 0.9,
        match_count: 3,
      });
    });

    it('should search with different result limits', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      (embed as any).mockResolvedValue({ embedding: mockEmbedding });

      mockSupabaseClient.rpc.mockResolvedValue({
        data: [],
        error: null,
      });

      await ragService.searchSimilar('test query', 20, 0.5);

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('search_documents', {
        query_embedding: mockEmbedding,
        similarity_threshold: 0.5,
        match_count: 20,
      });
    });
  });

  describe('Document Management', () => {
    it('should get document by ID', async () => {
      const mockDocument = {
        id: 'doc-123',
        title: 'Test Document',
        content: 'Document content',
        metadata: { source: 'test' },
        created_at: '2024-01-01T00:00:00Z',
      };

      mockTable.single.mockResolvedValue({
        data: mockDocument,
        error: null,
      });

      const result = await ragService.getDocument('doc-123');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('documents');
      expect(mockTable.select).toHaveBeenCalled();
      expect(mockTable.eq).toHaveBeenCalledWith('id', 'doc-123');
      expect(result).toEqual(mockDocument);
    });

    it('should handle document not found', async () => {
      mockTable.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }, // Not found error code
      });

      const result = await ragService.getDocument('nonexistent');

      expect(result).toBeNull();
    });

    it('should delete document by ID', async () => {
      mockTable.single.mockResolvedValue({
        data: { id: 'doc-123' },
        error: null,
      });

      const result = await ragService.deleteDocument('doc-123');

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('documents');
      expect(mockTable.delete).toHaveBeenCalled();
      expect(mockTable.eq).toHaveBeenCalledWith('id', 'doc-123');
      expect(result).toBe(true);
    });

    it('should handle deletion errors', async () => {
      mockTable.single.mockResolvedValue({
        data: null,
        error: { message: 'Delete failed' },
      });

      const result = await ragService.deleteDocument('doc-123');

      expect(result).toBe(false);
    });

    it('should list documents with pagination', async () => {
      const mockDocuments = [
        { id: 'doc-1', title: 'Document 1' },
        { id: 'doc-2', title: 'Document 2' },
      ];

      mockTable.mockResolvedValue({
        data: mockDocuments,
        error: null,
      });

      const result = await ragService.listDocuments(10, 0);

      expect(mockSupabaseClient.from).toHaveBeenCalledWith('documents');
      expect(mockTable.select).toHaveBeenCalled();
      expect(mockTable.order).toHaveBeenCalledWith('created_at', {
        ascending: false,
      });
      expect(mockTable.limit).toHaveBeenCalledWith(10);
      expect(result).toEqual(mockDocuments);
    });
  });

  describe('Statistics and Health', () => {
    it('should get vector store statistics', async () => {
      const mockStats = {
        totalDocuments: 150,
        totalSize: 50000,
        avgSimilarity: 0.75,
      };

      mockSupabaseClient.rpc.mockResolvedValue({
        data: [mockStats],
        error: null,
      });

      const result = await ragService.getStats();

      expect(mockSupabaseClient.rpc).toHaveBeenCalledWith('get_document_stats');
      expect(result).toEqual(mockStats);
    });

    it('should handle stats RPC errors', async () => {
      mockSupabaseClient.rpc.mockResolvedValue({
        data: null,
        error: { message: 'RPC failed' },
      });

      await expect(ragService.getStats()).rejects.toThrow(
        'Failed to get statistics',
      );
    });

    it('should perform health check', async () => {
      // Mock successful table query for health check
      mockTable.mockResolvedValue({
        data: [{ count: 10 }],
        error: null,
      });

      const result = await ragService.healthCheck();

      expect(result.isHealthy).toBe(true);
      expect(result.responseTime).toBeGreaterThan(0);
    });

    it('should detect health check failures', async () => {
      mockTable.mockResolvedValue({
        data: null,
        error: { message: 'Connection failed' },
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

      mockTable.mockResolvedValue({
        data: [
          { id: 'doc-1', title: 'Document 1' },
          { id: 'doc-2', title: 'Document 2' },
        ],
        error: null,
      });

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
      expect(mockTable.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 'doc-1' }),
          expect.objectContaining({ id: 'doc-2' }),
        ]),
      );

      expect(result).toEqual([
        { id: 'doc-1', title: 'Document 1' },
        { id: 'doc-2', title: 'Document 2' },
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

      mockTable.single.mockResolvedValue({
        data: { id: 'doc-large', title: 'Large Embedding' },
        error: null,
      });

      const document = {
        id: 'doc-large',
        title: 'Document with Large Embedding',
        content: 'Test content',
        metadata: {},
      };

      const result = await ragService.uploadDocument(document, 'user-123');

      expect(result.id).toBe('doc-large');
      expect(mockTable.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          embedding: largeEmbedding,
        }),
      );
    });

    it('should handle malformed metadata', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      (embed as any).mockResolvedValue({ embedding: mockEmbedding });

      mockTable.single.mockResolvedValue({
        data: { id: 'doc-meta', title: 'Metadata Test' },
        error: null,
      });

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

      expect(result.id).toBe('doc-meta');
      // Should handle complex metadata without errors
    });

    it('should handle concurrent search requests', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];
      (embed as any).mockResolvedValue({ embedding: mockEmbedding });

      mockSupabaseClient.rpc.mockResolvedValue({
        data: [{ id: 'result-1', similarity: 0.8 }],
        error: null,
      });

      // Simulate concurrent requests
      const searchPromises = Array.from({ length: 5 }, (_, i) =>
        ragService.searchSimilar(`query ${i}`, 5, 0.7),
      );

      const results = await Promise.all(searchPromises);

      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result).toEqual([{ id: 'result-1', similarity: 0.8 }]);
      });
    });
  });
});
