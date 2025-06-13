import { describe, it, expect } from 'vitest';
import {
  DocumentChunkingService,
  createChunkingService,
  type ChunkingConfig,
  type Document,
  ChunkingConfig as ChunkingConfigSchema,
} from './chunking';

describe('Enhanced Document Chunking - Basic Tests', () => {
  describe('Configuration', () => {
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

    it('should provide default values', () => {
      const parsedConfig = ChunkingConfigSchema.parse({});

      expect(parsedConfig.strategy).toBe('hybrid');
      expect(parsedConfig.chunkSize).toBe(1500);
      expect(parsedConfig.preserveStructure).toBe(true);
    });
  });

  describe('Basic Chunking', () => {
    it('should create chunking service', () => {
      const service = createChunkingService({ strategy: 'character' });
      expect(service).toBeInstanceOf(DocumentChunkingService);
    });

    it('should chunk simple document', async () => {
      const service = createChunkingService({
        strategy: 'character',
        chunkSize: 150,
        chunkOverlap: 10,
      });

      const document: Document = {
        id: 'test-doc',
        content:
          'This is a simple test document. It has multiple sentences. Each sentence adds content.',
        type: 'text',
        metadata: { title: 'Test' },
      };

      const result = await service.chunkDocument(document);

      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.strategy).toBe('character');
      expect(result.chunks[0].content.length).toBeLessThanOrEqual(150);
    });

    it('should preserve metadata', async () => {
      const service = createChunkingService();

      const document: Document = {
        id: 'metadata-test',
        content: 'Test content',
        type: 'text',
        metadata: { title: 'Test Document', author: 'Test Author' },
      };

      const result = await service.chunkDocument(document);

      result.chunks.forEach((chunk) => {
        expect(chunk.metadata.title).toBe('Test Document');
        expect(chunk.metadata.author).toBe('Test Author');
        expect(chunk.metadata.chunkIndex).toBeDefined();
      });
    });
  });

  describe('Strategy Updates', () => {
    it('should allow configuration updates', () => {
      const service = createChunkingService({ strategy: 'character' });
      expect(service.getConfig().strategy).toBe('character');

      service.updateConfig({ strategy: 'semantic' });
      expect(service.getConfig().strategy).toBe('semantic');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty documents', async () => {
      const service = createChunkingService();

      const document: Document = {
        id: 'empty',
        content: '',
        type: 'text',
        metadata: {},
      };

      const result = await service.chunkDocument(document);
      expect(result.chunks).toHaveLength(0);
    });

    it('should handle very short documents', async () => {
      const service = createChunkingService();

      const document: Document = {
        id: 'short',
        content: 'Hi',
        type: 'text',
        metadata: {},
      };

      const result = await service.chunkDocument(document);
      expect(result.chunks.length).toBeGreaterThanOrEqual(1);
    });
  });
});
