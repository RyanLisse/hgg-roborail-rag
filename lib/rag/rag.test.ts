import { describe, it, expect, beforeEach, } from 'vitest';
import { 
  type RAGService, 
  DocumentChunk, 
  RAGQuery, 
  createRAGService,
  embedDocument,
  searchSimilarChunks,
  generateRAGResponse
} from './rag';

describe('RAG Service', () => {
  let ragService: RAGService;
  
  beforeEach(() => {
    ragService = createRAGService({
      vectorStore: 'memory',
      embeddingModel: 'openai-text-embedding-3-small',
      chatModel: 'openai-gpt-4.1',
    });
  });

  describe('Document Processing', () => {
    it('should embed document and create chunks', async () => {
      const document = {
        id: 'test-doc-1',
        content: 'This is a test document with some content about AI and machine learning.',
        metadata: { title: 'Test Document', source: 'test' }
      };

      const chunks = await embedDocument(ragService, document);
      
      expect(chunks).toBeDefined();
      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBeGreaterThan(0);
      
      chunks.forEach(chunk => {
        expect(chunk).toHaveProperty('id');
        expect(chunk).toHaveProperty('content');
        expect(chunk).toHaveProperty('embedding');
        expect(chunk).toHaveProperty('metadata');
        expect(Array.isArray(chunk.embedding)).toBe(true);
        expect(chunk.embedding.length).toBeGreaterThan(0);
      });
    });

    it('should validate document chunk schema', () => {
      const validChunk: DocumentChunk = {
        id: 'chunk-1',
        documentId: 'doc-1',
        content: 'Sample content',
        embedding: [0.1, 0.2, 0.3],
        metadata: {
          title: 'Sample',
          chunkIndex: 0,
          source: 'test'
        }
      };

      expect(() => DocumentChunk.parse(validChunk)).not.toThrow();
    });

    it('should handle large documents by chunking appropriately', async () => {
      const largeContent = 'This is a sentence. '.repeat(1000);
      const document = {
        id: 'large-doc',
        content: largeContent,
        metadata: { title: 'Large Document', source: 'test' }
      };

      const chunks = await embedDocument(ragService, document);
      
      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach(chunk => {
        expect(chunk.content.length).toBeLessThanOrEqual(2000); // Max chunk size
      });
    });
  });

  describe('Vector Search', () => {
    beforeEach(async () => {
      // Add some test documents
      const documents = [
        {
          id: 'doc-ai',
          content: 'Artificial Intelligence and machine learning are transforming technology.',
          metadata: { title: 'AI Overview', source: 'tech' }
        },
        {
          id: 'doc-cooking',
          content: 'Cooking pasta requires boiling water and adding salt for flavor.',
          metadata: { title: 'Cooking Guide', source: 'food' }
        },
        {
          id: 'doc-programming',
          content: 'TypeScript provides type safety for JavaScript development.',
          metadata: { title: 'Programming Guide', source: 'tech' }
        }
      ];

      for (const doc of documents) {
        await embedDocument(ragService, doc);
      }
    });

    it('should find relevant chunks for a query', async () => {
      const query = 'Tell me about artificial intelligence';
      const results = await searchSimilarChunks(ragService, query, { limit: 5 });

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
      
      // First result should be most relevant (AI document)
      expect(results[0].content).toContain('Artificial Intelligence');
      expect(results[0].score).toBeGreaterThan(0.5);
    });

    it('should return results sorted by relevance score', async () => {
      const query = 'programming languages';
      const results = await searchSimilarChunks(ragService, query, { limit: 3 });

      for (let i = 1; i < results.length; i++) {
        expect(results[i-1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it('should respect limit parameter', async () => {
      const query = 'technology';
      const results = await searchSimilarChunks(ragService, query, { limit: 2 });

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should filter by metadata if provided', async () => {
      const query = 'guide';
      const results = await searchSimilarChunks(ragService, query, { 
        limit: 5,
        filter: { source: 'tech' }
      });

      results.forEach(result => {
        expect(result.metadata.source).toBe('tech');
      });
    });
  });

  describe('RAG Response Generation', () => {
    beforeEach(async () => {
      const document = {
        id: 'rag-test-doc',
        content: 'Next.js is a React framework that provides server-side rendering, static site generation, and many other features for building modern web applications.',
        metadata: { title: 'Next.js Guide', source: 'docs' }
      };
      
      await embedDocument(ragService, document);
    });

    it('should generate response using retrieved context', async () => {
      const query: RAGQuery = {
        question: 'What is Next.js?',
        chatHistory: [],
        modelId: 'openai-gpt-4.1'
      };

      const response = await generateRAGResponse(ragService, query);

      expect(response).toBeDefined();
      expect(response.answer).toBeDefined();
      expect(response.answer.length).toBeGreaterThan(0);
      expect(response.sources).toBeDefined();
      expect(response.sources.length).toBeGreaterThan(0);
      expect(response.sources[0]).toHaveProperty('documentId');
      expect(response.sources[0]).toHaveProperty('content');
      expect(response.sources[0]).toHaveProperty('score');
    });

    it('should validate RAG query schema', () => {
      const validQuery: RAGQuery = {
        question: 'What is TypeScript?',
        chatHistory: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' }
        ],
        modelId: 'openai-gpt-4.1',
        options: {
          maxSources: 5,
          minRelevanceScore: 0.7
        }
      };

      expect(() => RAGQuery.parse(validQuery)).not.toThrow();
    });

    it('should include chat history in context', async () => {
      const query: RAGQuery = {
        question: 'Can you elaborate on that?',
        chatHistory: [
          { role: 'user', content: 'Tell me about Next.js' },
          { role: 'assistant', content: 'Next.js is a React framework...' }
        ],
        modelId: 'openai-gpt-4.1'
      };

      const response = await generateRAGResponse(ragService, query);

      expect(response.answer).toBeDefined();
      expect(response.answer.length).toBeGreaterThan(0);
    });

    it('should handle queries with no relevant context', async () => {
      const query: RAGQuery = {
        question: 'What is the weather like on Mars?',
        chatHistory: [],
        modelId: 'openai-gpt-4.1'
      };

      const response = await generateRAGResponse(ragService, query);

      expect(response).toBeDefined();
      expect(response.answer).toBeDefined();
      expect(response.sources.length).toBe(0);
    });
  });

  describe('Service Configuration', () => {
    it('should create RAG service with valid configuration', () => {
      const config = {
        vectorStore: 'memory' as const,
        embeddingModel: 'openai-text-embedding-3-small',
        chatModel: 'anthropic-claude-4-sonnet',
        options: {
          chunkSize: 1000,
          chunkOverlap: 200,
          maxRetrievalLimit: 10
        }
      };

      const service = createRAGService(config);
      expect(service).toBeDefined();
      expect(service.config).toEqual(config);
    });

    it('should throw error for invalid configuration', () => {
      expect(() => {
        createRAGService({
          vectorStore: 'invalid' as any,
          embeddingModel: 'invalid-model',
          chatModel: 'invalid-model'
        });
      }).toThrow();
    });
  });
});