import { beforeEach, describe, expect, it } from 'vitest';
import {
  type ChunkingConfig,
  ChunkingConfig as ChunkingConfigSchema,
  chunkDocument,
  createChunkingService,
  type Document,
  DocumentChunkingService,
} from './chunking';

describe('Enhanced Document Chunking', () => {
  let chunkingService: DocumentChunkingService;

  beforeEach(() => {
    chunkingService = createChunkingService({
      strategy: 'hybrid',
      chunkSize: 1000,
      chunkOverlap: 100,
      preserveStructure: true,
      enableQualityValidation: true,
    });
  });

  describe('Configuration Validation', () => {
    it('should validate chunking configuration schema', () => {
      const validConfig: ChunkingConfig = {
        strategy: 'semantic',
        chunkSize: 1500,
        chunkOverlap: 200,
        preserveStructure: true,
        respectBoundaries: true,
        minChunkSize: 100,
        maxChunkSize: 3000,
        enableQualityValidation: true,
      };

      expect(() => ChunkingConfigSchema.parse(validConfig)).not.toThrow();
    });

    it('should provide default values for optional config', () => {
      const minimalConfig = {};
      const parsedConfig = ChunkingConfigSchema.parse(minimalConfig);

      expect(parsedConfig.strategy).toBe('hybrid');
      expect(parsedConfig.chunkSize).toBe(1500);
      expect(parsedConfig.chunkOverlap).toBe(200);
      expect(parsedConfig.preserveStructure).toBe(true);
    });

    it('should reject invalid configurations', () => {
      expect(() => {
        ChunkingConfigSchema.parse({
          strategy: 'invalid',
          chunkSize: -100,
        });
      }).toThrow();
    });
  });

  describe('Character-based Chunking', () => {
    it('should chunk text by character count', async () => {
      const document: Document = {
        id: 'char-test',
        content: 'A'.repeat(2500), // 2500 characters
        type: 'text',
        metadata: { title: 'Character Test' },
      };

      const service = createChunkingService({
        strategy: 'character',
        chunkSize: 1000,
        chunkOverlap: 100,
      });

      const result = await service.chunkDocument(document);

      expect(result.chunks.length).toBeGreaterThan(1);
      expect(result.strategy).toBe('character');
      expect(result.chunks[0].content.length).toBeLessThanOrEqual(1000);
    });

    it('should handle overlap correctly', async () => {
      const document: Document = {
        id: 'overlap-test',
        content: '1234567890'.repeat(200), // 2000 characters
        type: 'text',
        metadata: {},
      };

      const service = createChunkingService({
        strategy: 'character',
        chunkSize: 800,
        chunkOverlap: 200,
      });

      const result = await service.chunkDocument(document);

      expect(result.chunks.length).toBeGreaterThan(1);

      // Check for overlap between consecutive chunks
      if (result.chunks.length > 1) {
        const firstChunkEnd = result.chunks[0].content.slice(-200); // Get last 200 chars (overlap size)
        const secondChunkStart = result.chunks[1].content.slice(0, 200); // Get first 200 chars
        // The end of first chunk should match the start of second chunk (overlap)
        expect(firstChunkEnd).toBe(secondChunkStart);
      }
    });
  });

  describe('Semantic Chunking', () => {
    it('should respect paragraph boundaries', async () => {
      const document: Document = {
        id: 'semantic-test',
        content: `
# Introduction
This is the first paragraph about artificial intelligence.

## Machine Learning
This is a paragraph about machine learning. It explains how computers can learn from data.

### Deep Learning
Deep learning is a subset of machine learning. It uses neural networks with multiple layers.

## Natural Language Processing
NLP helps computers understand human language. It has many applications.
        `.trim(),
        type: 'markdown',
        metadata: { title: 'AI Overview' },
      };

      const service = createChunkingService({
        strategy: 'semantic',
        chunkSize: 500,
        preserveStructure: true,
      });

      const result = await service.chunkDocument(document);

      expect(result.chunks.length).toBeGreaterThan(1);
      expect(result.strategy).toBe('semantic');

      // Check that chunks respect heading boundaries
      const hasHeadingChunks = result.chunks.some(
        (chunk) =>
          chunk.content.includes('# Introduction') ||
          chunk.content.includes('## Machine Learning'),
      );
      expect(hasHeadingChunks).toBe(true);
    });

    it('should detect different chunk types', async () => {
      const document: Document = {
        id: 'type-test',
        content: `
# Main Heading

This is a paragraph of text.

- First list item
- Second list item
- Third list item

\`\`\`javascript
function test() {
  return "code block";
}
\`\`\`
        `.trim(),
        type: 'markdown',
        metadata: {},
      };

      // Use a smaller chunk size to force multiple chunks
      const service = createChunkingService({
        strategy: 'hybrid',
        chunkSize: 100,
        minChunkSize: 10,
        preserveStructure: true,
        enableQualityValidation: true,
      });

      const result = await service.chunkDocument(document);

      const chunkTypes = result.chunks.map((chunk) => chunk.metadata.chunkType);
      expect(chunkTypes).toContain('heading');
      expect(chunkTypes).toContain('paragraph');
    });
  });

  describe('Recursive Chunking', () => {
    it('should break down large chunks recursively', async () => {
      const document: Document = {
        id: 'recursive-test',
        content: 'This is a very long sentence. '.repeat(200), // ~5400 characters
        type: 'text',
        metadata: {},
      };

      const service = createChunkingService({
        strategy: 'recursive',
        chunkSize: 1000,
        maxChunkSize: 1500,
      });

      const result = await service.chunkDocument(document);

      expect(result.chunks.length).toBeGreaterThan(1);
      expect(result.strategy).toBe('recursive');

      // All chunks should be within size limits
      result.chunks.forEach((chunk) => {
        expect(chunk.content.length).toBeLessThanOrEqual(1500);
      });
    });

    it('should try multiple separators', async () => {
      const document: Document = {
        id: 'separator-test',
        content: `
Section 1 has enough content to meet the minimum chunk size requirement

---

Section 2 with more content that goes on for a while and contains multiple sentences. This helps test the recursive splitting behavior.

***

Section 3 with even more content that definitely exceeds the chunk size limit and should be split appropriately.
        `.trim(),
        type: 'text',
        metadata: {},
      };

      const service = createChunkingService({
        strategy: 'recursive',
        chunkSize: 100,
        minChunkSize: 10,
        customSeparators: ['\n---\n', '\n***\n', '\n\n', '. '],
      });

      const result = await service.chunkDocument(document);

      expect(result.chunks.length).toBeGreaterThan(1);

      // Should respect separator boundaries where possible
      const hasStructuredSplits = result.chunks.some(
        (chunk) =>
          chunk.content.includes('Section 1') ||
          chunk.content.includes('Section 2'),
      );
      expect(hasStructuredSplits).toBe(true);
    });
  });

  describe('Hybrid Chunking', () => {
    it('should combine semantic and recursive strategies', async () => {
      const document: Document = {
        id: 'hybrid-test',
        content: `
# Large Document

## Introduction
This is a very long introduction section that contains multiple paragraphs and will definitely exceed the normal chunk size limits. We need to test how the hybrid approach handles this situation.

The introduction continues with more detailed explanations about the topic. This paragraph adds even more content to ensure we exceed chunk size limits.

## Main Content
This section contains the bulk of the document content. It has multiple subsections and detailed explanations.

### Subsection 1
Detailed content for subsection 1. This content is moderately long and should fit within a reasonable chunk size.

### Subsection 2  
This subsection has extremely long content that goes on and on with detailed explanations, examples, and comprehensive coverage of the topic. The content is intentionally verbose to test the chunking behavior when dealing with large sections that exceed normal chunk size limits.

## Conclusion
A brief conclusion that wraps up the document.
        `.trim(),
        type: 'markdown',
        metadata: { title: 'Hybrid Test Doc' },
      };

      const service = createChunkingService({
        strategy: 'hybrid',
        chunkSize: 300,
        maxChunkSize: 500,
      });

      const result = await service.chunkDocument(document);

      expect(result.chunks.length).toBeGreaterThan(3);
      expect(result.strategy).toBe('hybrid');

      // Should preserve some structure while respecting size limits
      result.chunks.forEach((chunk) => {
        expect(chunk.content.length).toBeLessThanOrEqual(500);
        expect(chunk.metadata.chunkType).toBeDefined();
      });

      // Should have preserved some headings
      const hasHeadings = result.chunks.some((chunk) =>
        chunk.content.includes('#'),
      );
      expect(hasHeadings).toBe(true);
    });
  });

  describe('Specialized Chunking Strategies', () => {
    it('should chunk by sentences', async () => {
      const document: Document = {
        id: 'sentence-test',
        content:
          'First sentence. Second sentence! Third sentence? Fourth sentence. Fifth sentence with more content.',
        type: 'text',
        metadata: {},
      };

      const service = createChunkingService({
        strategy: 'sentence',
        chunkSize: 100,
      });

      const result = await service.chunkDocument(document);

      expect(result.chunks.length).toBeGreaterThan(1);

      // Each chunk should end with sentence punctuation (where possible)
      result.chunks.forEach((chunk) => {
        const trimmed = chunk.content.trim();
        if (trimmed.length > 0) {
          const lastChar = trimmed.at(-1);
          expect(['.', '!', '?']).toContain(lastChar);
        }
      });
    });

    it('should chunk by paragraphs', async () => {
      const document: Document = {
        id: 'paragraph-test',
        content: `
First paragraph with some content.

Second paragraph with different content.

Third paragraph that might be longer and contain more detailed information about the topic.
        `.trim(),
        type: 'text',
        metadata: {},
      };

      const service = createChunkingService({
        strategy: 'paragraph',
        chunkSize: 100,
      });

      const result = await service.chunkDocument(document);

      expect(result.chunks.length).toBeGreaterThan(1);
      expect(result.strategy).toBe('paragraph');
    });

    it('should handle code chunking', async () => {
      const document: Document = {
        id: 'code-test',
        content: `
function firstFunction() {
  return "first";
}

class TestClass {
  constructor() {
    this.value = 42;
  }
  
  method() {
    return this.value;
  }
}

function secondFunction() {
  const result = new TestClass();
  return result.method();
}
        `.trim(),
        type: 'code',
        metadata: { language: 'javascript' },
      };

      const service = createChunkingService({
        strategy: 'code',
        chunkSize: 100,
        minChunkSize: 10,
      });

      const result = await service.chunkDocument(document);

      expect(result.chunks.length).toBeGreaterThan(1);

      // Should try to keep functions/classes together
      const hasFunctionChunks = result.chunks.some(
        (chunk) =>
          chunk.content.includes('function firstFunction') ||
          chunk.content.includes('class TestClass'),
      );
      expect(hasFunctionChunks).toBe(true);
    });
  });

  describe('Quality Validation', () => {
    it('should calculate quality metrics', async () => {
      const document: Document = {
        id: 'quality-test',
        content: `
# Well-Structured Document

This document has proper structure with complete sentences and paragraphs.

## Section 1
Complete thoughts and proper grammar make this a high-quality chunk.

## Section 2  
This section also maintains quality with coherent content.
        `.trim(),
        type: 'markdown',
        metadata: {},
      };

      const service = createChunkingService({
        enableQualityValidation: true,
        chunkSize: 200,
      });

      const result = await service.chunkDocument(document);

      expect(result.qualityMetrics).toBeDefined();
      expect(result.qualityMetrics.avgQualityScore).toBeGreaterThan(0);
      expect(result.qualityMetrics.structurePreservation).toBeGreaterThan(0);
      expect(result.qualityMetrics.boundaryCoverage).toBeGreaterThan(0);

      // Each chunk should have quality metadata
      result.chunks.forEach((chunk) => {
        expect(chunk.metadata.quality).toBeDefined();
        expect(chunk.metadata.quality?.score).toBeGreaterThanOrEqual(0);
        expect(chunk.metadata.quality?.score).toBeLessThanOrEqual(1);
      });
    });

    it('should validate chunk completeness', async () => {
      const document: Document = {
        id: 'completeness-test',
        content:
          'Complete sentence one. Complete sentence two. Complete sentence three.',
        type: 'text',
        metadata: {},
      };

      const result = await chunkingService.chunkDocument(document);

      result.chunks.forEach((chunk) => {
        if (chunk.metadata.quality) {
          expect(chunk.metadata.quality.completeness).toBeGreaterThan(0);
        }
      });
    });
  });

  describe('Boundary and Metadata Preservation', () => {
    it('should preserve document boundaries', async () => {
      const document: Document = {
        id: 'boundary-test',
        content: 'Short document content.',
        type: 'text',
        metadata: { title: 'Test', source: 'test' },
      };

      const result = await chunkingService.chunkDocument(document);

      result.chunks.forEach((chunk) => {
        expect(chunk.boundaries).toBeDefined();
        expect(chunk.boundaries.start).toBeGreaterThanOrEqual(0);
        expect(chunk.boundaries.end).toBeGreaterThan(chunk.boundaries.start);
        expect(chunk.boundaries.preservedStructure).toBeDefined();
      });
    });

    it('should preserve original metadata', async () => {
      const document: Document = {
        id: 'metadata-test',
        content: 'Document with metadata.',
        type: 'text',
        metadata: {
          title: 'Test Document',
          author: 'Test Author',
          tags: ['test', 'metadata'],
          customField: 'custom value',
        },
      };

      const result = await chunkingService.chunkDocument(document);

      result.chunks.forEach((chunk) => {
        expect(chunk.metadata.title).toBe('Test Document');
        expect(chunk.metadata.author).toBe('Test Author');
        expect(chunk.metadata.tags).toEqual(['test', 'metadata']);
        expect(chunk.metadata.customField).toBe('custom value');
        expect(chunk.metadata.chunkIndex).toBeDefined();
        expect(chunk.metadata.totalChunks).toBe(result.chunks.length);
      });
    });
  });

  describe('Configuration Updates', () => {
    it('should allow strategy updates', () => {
      const service = createChunkingService({ strategy: 'character' });
      expect(service.getConfig().strategy).toBe('character');

      service.updateConfig({ strategy: 'semantic' });
      expect(service.getConfig().strategy).toBe('semantic');
    });

    it('should allow parameter updates', () => {
      const service = createChunkingService({ chunkSize: 1000 });
      expect(service.getConfig().chunkSize).toBe(1000);

      service.updateConfig({ chunkSize: 2000, chunkOverlap: 300 });
      expect(service.getConfig().chunkSize).toBe(2000);
      expect(service.getConfig().chunkOverlap).toBe(300);
    });
  });

  describe('Factory Functions', () => {
    it('should create chunking service with factory function', () => {
      const service = createChunkingService({
        strategy: 'hybrid',
        chunkSize: 1200,
      });

      expect(service).toBeInstanceOf(DocumentChunkingService);
      expect(service.getConfig().strategy).toBe('hybrid');
      expect(service.getConfig().chunkSize).toBe(1200);
    });

    it('should chunk document with standalone function', async () => {
      const document: Document = {
        id: 'standalone-test',
        content: 'Test content for standalone function.',
        type: 'text',
        metadata: {},
      };

      const result = await chunkDocument(document, { strategy: 'character' });

      expect(result.chunks).toBeDefined();
      expect(result.strategy).toBe('character');
    });
  });

  describe('Error Handling', () => {
    it('should handle empty documents', async () => {
      const document: Document = {
        id: 'empty-test',
        content: '',
        type: 'text',
        metadata: {},
      };

      const result = await chunkingService.chunkDocument(document);

      expect(result.chunks).toHaveLength(0);
    });

    it('should handle very small documents', async () => {
      const document: Document = {
        id: 'small-test',
        content: 'Hi',
        type: 'text',
        metadata: {},
      };

      const result = await chunkingService.chunkDocument(document);

      // Should return at least one chunk even if below min size
      expect(result.chunks.length).toBeGreaterThanOrEqual(1);
    });

    it('should handle documents with only whitespace', async () => {
      const document: Document = {
        id: 'whitespace-test',
        content: '   \n\n   \t\t   ',
        type: 'text',
        metadata: {},
      };

      const result = await chunkingService.chunkDocument(document);

      // Should filter out empty chunks
      result.chunks.forEach((chunk) => {
        expect(chunk.content.trim().length).toBeGreaterThan(0);
      });
    });
  });

  describe('Performance and Metrics', () => {
    it('should provide performance metrics', async () => {
      const document: Document = {
        id: 'performance-test',
        content: 'Test content. '.repeat(500), // ~6000 characters
        type: 'text',
        metadata: {},
      };

      const result = await chunkingService.chunkDocument(document);

      expect(result.totalTokens).toBeGreaterThan(0);
      expect(result.avgChunkSize).toBeGreaterThan(0);
      expect(result.qualityMetrics).toBeDefined();
    });

    it('should calculate boundary coverage accurately', async () => {
      const document: Document = {
        id: 'coverage-test',
        content: '0123456789'.repeat(10), // 100 characters
        type: 'text',
        metadata: {},
      };

      const result = await chunkingService.chunkDocument(document);

      // Boundary coverage should be close to 1.0 (full coverage)
      expect(result.qualityMetrics.boundaryCoverage).toBeGreaterThan(0.9);
      expect(result.qualityMetrics.boundaryCoverage).toBeLessThanOrEqual(1.0);
    });
  });
});
