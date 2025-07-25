import { beforeEach, describe, expect, it } from 'vitest';
import {
  analyzeDocumentChunking,
  createRAGService,
  DocumentChunk,
  embedDocument,
  generateRAGResponse,
  getChunkingConfig,
  RAGQuery,
  type RAGService,
  searchSimilarChunks,
  updateChunkingStrategy,
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
        content:
          'This is a test document with some content about AI and machine learning.',
        metadata: { title: 'Test Document', source: 'test' },
      };

      const chunks = await embedDocument(ragService, document);

      expect(chunks).toBeDefined();
      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBeGreaterThan(0);

      chunks.forEach((chunk) => {
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
          source: 'test',
        },
      };

      expect(() => DocumentChunk.parse(validChunk)).not.toThrow();
    });

    it('should handle large documents by chunking appropriately', async () => {
      const largeContent = 'This is a sentence. '.repeat(1000);
      const document = {
        id: 'large-doc',
        content: largeContent,
        metadata: { title: 'Large Document', source: 'test' },
      };

      const chunks = await embedDocument(ragService, document);

      expect(chunks.length).toBeGreaterThan(1);
      chunks.forEach((chunk) => {
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
          content:
            'Artificial Intelligence and machine learning are transforming technology.',
          metadata: { title: 'AI Overview', source: 'tech' },
        },
        {
          id: 'doc-cooking',
          content:
            'Cooking pasta requires boiling water and adding salt for flavor.',
          metadata: { title: 'Cooking Guide', source: 'food' },
        },
        {
          id: 'doc-programming',
          content:
            'TypeScript provides type safety for JavaScript development.',
          metadata: { title: 'Programming Guide', source: 'tech' },
        },
      ];

      for (const doc of documents) {
        await embedDocument(ragService, doc);
      }
    });

    it('should find relevant chunks for a query', async () => {
      const query = 'Tell me about artificial intelligence';
      const results = await searchSimilarChunks(ragService, query, {
        limit: 5,
      });

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);

      // First result should be most relevant (AI document)
      expect(results[0].content).toContain('Artificial Intelligence');
      expect(results[0].score).toBeGreaterThan(0.5);
    });

    it('should return results sorted by relevance score', async () => {
      const query = 'programming languages';
      const results = await searchSimilarChunks(ragService, query, {
        limit: 3,
      });

      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it('should respect limit parameter', async () => {
      const query = 'technology';
      const results = await searchSimilarChunks(ragService, query, {
        limit: 2,
      });

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should filter by metadata if provided', async () => {
      const query = 'guide';
      const results = await searchSimilarChunks(ragService, query, {
        limit: 5,
        filter: { source: 'tech' },
      });

      results.forEach((result) => {
        expect(result.metadata.source).toBe('tech');
      });
    });
  });

  describe('RAG Response Generation', () => {
    beforeEach(async () => {
      const document = {
        id: 'rag-test-doc',
        content:
          'Next.js is a React framework that provides server-side rendering, static site generation, and many other features for building modern web applications.',
        metadata: { title: 'Next.js Guide', source: 'docs' },
      };

      await embedDocument(ragService, document);
    });

    it('should generate response using retrieved context', async () => {
      const query: RAGQuery = {
        question: 'What is Next.js?',
        chatHistory: [],
        modelId: 'openai-gpt-4.1',
        options: {
          vectorStoreSources: ['memory'],
        },
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
          { role: 'assistant', content: 'Hi there!' },
        ],
        modelId: 'openai-gpt-4.1',
        options: {
          maxSources: 5,
          minRelevanceScore: 0.7,
        },
      };

      expect(() => RAGQuery.parse(validQuery)).not.toThrow();
    });

    it('should include chat history in context', async () => {
      const query: RAGQuery = {
        question: 'Can you elaborate on that?',
        chatHistory: [
          { role: 'user', content: 'Tell me about Next.js' },
          { role: 'assistant', content: 'Next.js is a React framework...' },
        ],
        modelId: 'openai-gpt-4.1',
      };

      const response = await generateRAGResponse(ragService, query);

      expect(response.answer).toBeDefined();
      expect(response.answer.length).toBeGreaterThan(0);
    });

    it('should handle queries with no relevant context', async () => {
      const query: RAGQuery = {
        question: 'What is the weather like on Mars?',
        chatHistory: [],
        modelId: 'openai-gpt-4.1',
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
          maxRetrievalLimit: 10,
          embeddingDimensions: 1536,
        },
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
          chatModel: 'invalid-model',
        });
      }).toThrow();
    });
  });

  describe('Enhanced Chunking Integration', () => {
    it('should use enhanced chunking by default', async () => {
      const document = {
        id: 'enhanced-test-doc',
        content: `
# Document Title

This is a well-structured document with multiple sections.

## Section 1
Content for section 1 with detailed explanations.

## Section 2  
Content for section 2 with more information.
        `.trim(),
        metadata: { title: 'Enhanced Test', source: 'test', type: 'markdown' },
      };

      const chunks = await embedDocument(ragService, document);

      expect(chunks).toBeDefined();
      expect(Array.isArray(chunks)).toBe(true);
      expect(chunks.length).toBeGreaterThan(0);

      // Enhanced chunks should have additional metadata
      chunks.forEach((chunk) => {
        expect(chunk.metadata).toHaveProperty('chunkingStrategy');
        expect(chunk.metadata).toHaveProperty('qualityScore');
        expect(chunk.metadata).toHaveProperty('structurePreserved');
        expect(chunk.metadata).toHaveProperty('boundaries');
      });
    });

    it('should preserve document structure in chunks', async () => {
      const document = {
        id: 'structure-test',
        content: `
# Main Title

Introduction paragraph with important information.

## Subsection A
Detailed content for subsection A.

## Subsection B
Detailed content for subsection B with code examples.

\`\`\`javascript
function example() {
  return "code block";
}
\`\`\`
        `.trim(),
        metadata: { title: 'Structure Test', type: 'markdown' },
      };

      const chunks = await embedDocument(ragService, document);

      // Should have chunks that respect markdown structure
      const hasHeadingChunks = chunks.some(
        (chunk) =>
          chunk.content.includes('# Main Title') ||
          chunk.content.includes('## Subsection'),
      );
      expect(hasHeadingChunks).toBe(true);

      // Should have chunk type metadata
      const chunkTypes = chunks
        .map((chunk) => chunk.metadata.chunkType)
        .filter(Boolean);
      expect(chunkTypes.length).toBeGreaterThan(0);
    });

    it('should analyze document chunking without embedding', async () => {
      const document = {
        id: 'analysis-test',
        content: 'This is a test document for chunking analysis. '.repeat(100),
        metadata: { title: 'Analysis Test' },
      };

      const analysis = await analyzeDocumentChunking(ragService, document);

      expect(analysis).toBeDefined();
      expect(analysis.chunks).toBeDefined();
      expect(analysis.strategy).toBeDefined();
      expect(analysis.qualityMetrics).toBeDefined();
      expect(analysis.totalTokens).toBeGreaterThan(0);
      expect(analysis.avgChunkSize).toBeGreaterThan(0);
    });

    it('should allow chunking strategy updates', () => {
      const originalConfig = getChunkingConfig(ragService);
      expect(originalConfig.strategy).toBe('hybrid');

      updateChunkingStrategy(ragService, 'semantic');

      const updatedConfig = getChunkingConfig(ragService);
      expect(updatedConfig.strategy).toBe('semantic');
    });

    it('should handle different document types appropriately', async () => {
      const documents = [
        {
          id: 'markdown-doc',
          content: '# Title\n\nParagraph with **bold** text.',
          metadata: { type: 'markdown' },
        },
        {
          id: 'code-doc',
          content: 'function test() {\n  return "hello";\n}',
          metadata: { type: 'code' },
        },
        {
          id: 'html-doc',
          content: '<html><body><h1>Title</h1><p>Content</p></body></html>',
          metadata: { type: 'html' },
        },
      ];

      for (const doc of documents) {
        const chunks = await embedDocument(ragService, doc);
        expect(chunks.length).toBeGreaterThan(0);

        // Each chunk should have appropriate metadata
        chunks.forEach((chunk) => {
          expect(chunk.metadata.chunkingStrategy).toBeDefined();
        });
      }
    });

    it('should maintain quality metrics across chunks', async () => {
      const document = {
        id: 'quality-metrics-test',
        content: `
High-quality document with proper structure.

Each paragraph contains complete thoughts and proper grammar.
The content is well-organized and coherent.

Another section with meaningful content that demonstrates
quality validation in the chunking process.
        `.trim(),
        metadata: { title: 'Quality Test' },
      };

      const chunks = await embedDocument(ragService, document);

      // All chunks should have quality metrics
      chunks.forEach((chunk) => {
        if (chunk.metadata.qualityScore !== undefined) {
          expect(chunk.metadata.qualityScore).toBeGreaterThanOrEqual(0);
          expect(chunk.metadata.qualityScore).toBeLessThanOrEqual(1);
        }
      });
    });

    it('should handle configuration with chunking options', () => {
      const ragServiceWithChunking = createRAGService({
        vectorStore: 'memory',
        embeddingModel: 'openai-text-embedding-3-small',
        chatModel: 'openai-gpt-4.1',
        chunking: {
          strategy: 'semantic',
          preserveStructure: true,
          enableQualityValidation: true,
          minChunkSize: 200,
          maxChunkSize: 2000,
        },
      });

      const config = getChunkingConfig(ragServiceWithChunking);
      expect(config.strategy).toBe('semantic');
      expect(config.preserveStructure).toBe(true);
      expect(config.enableQualityValidation).toBe(true);
      expect(config.minChunkSize).toBe(200);
      expect(config.maxChunkSize).toBe(2000);
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain compatibility with existing code', async () => {
      // Test that existing tests still pass with enhanced chunking
      const document = {
        id: 'compat-test',
        content: 'Simple test document for compatibility.',
        metadata: { title: 'Compatibility Test' },
      };

      const chunks = await embedDocument(ragService, document);

      // Should still have basic properties
      chunks.forEach((chunk) => {
        expect(chunk).toHaveProperty('id');
        expect(chunk).toHaveProperty('content');
        expect(chunk).toHaveProperty('embedding');
        expect(chunk).toHaveProperty('metadata');
        expect(chunk.metadata).toHaveProperty('chunkIndex');
      });
    });

    it('should work with legacy search functionality', async () => {
      const document = {
        id: 'search-compat',
        content: 'Document about artificial intelligence and machine learning.',
        metadata: { title: 'AI Document' },
      };

      await embedDocument(ragService, document);

      const results = await searchSimilarChunks(
        ragService,
        'artificial intelligence',
      );

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      expect(results[0]).toHaveProperty('score');
      expect(results[0]).toHaveProperty('content');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle empty documents gracefully', async () => {
      const document = {
        id: 'empty-test',
        content: '',
        metadata: { title: 'Empty Document' },
      };

      const chunks = await embedDocument(ragService, document);
      expect(chunks).toHaveLength(0);
    });

    it('should handle very large documents', async () => {
      const document = {
        id: 'large-test',
        content: 'Large document content. '.repeat(1000), // ~23,000 characters
        metadata: { title: 'Large Document' },
      };

      const chunks = await embedDocument(ragService, document);

      expect(chunks.length).toBeGreaterThan(1);

      // All chunks should be within reasonable size limits
      chunks.forEach((chunk) => {
        expect(chunk.content.length).toBeLessThanOrEqual(3000);
      });
    });

    it('should handle documents with special characters', async () => {
      const document = {
        id: 'special-chars-test',
        content:
          'Document with émojis 🚀, ünïcödé characters, and symbols: @#$%^&*()',
        metadata: { title: 'Special Characters' },
      };

      const chunks = await embedDocument(ragService, document);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].content).toContain('émojis');
      expect(chunks[0].content).toContain('🚀');
    });
  });
});
