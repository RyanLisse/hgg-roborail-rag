import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  type CohereEmbeddingService,
  createCohereEmbeddingService,
  embedText,
  embedImage,
  embedDocuments,
  type TextEmbeddingRequest,
  type ImageEmbeddingRequest
} from './cohere';

// Mock Cohere client
vi.mock('cohere-ai', () => ({
  CohereClient: vi.fn().mockImplementation(() => ({
    v2: {
      embed: vi.fn().mockResolvedValue({
        embeddings: [
          {
            values: Array.from({ length: 1024 }, () => Math.random()),
          },
        ],
      }),
    },
  })),
}));

// Mock fetch for image processing
global.fetch = vi.fn() as any;

describe('Cohere Embedding Service', () => {
  let cohereService: CohereEmbeddingService;

  beforeEach(() => {
    cohereService = createCohereEmbeddingService({
      apiKey: 'test-api-key',
    });
    
    vi.clearAllMocks();
  });

  describe('Service Creation', () => {
    it('should create Cohere service with valid configuration', () => {
      expect(cohereService).toBeDefined();
      expect(cohereService.isEnabled).toBe(true);
    });

    it('should handle missing API key gracefully', () => {
      const service = createCohereEmbeddingService({
        apiKey: '',
      });
      
      expect(service.isEnabled).toBe(false);
    });
  });

  describe('Text Embeddings', () => {
    it('should embed single text successfully', async () => {
      const request: TextEmbeddingRequest = {
        texts: ['Hello world'],
        model: 'embed-v4.0',
        inputType: 'search_query',
      };

      const embeddings = await embedText(cohereService, request);

      expect(embeddings).toBeDefined();
      expect(embeddings.length).toBe(1);
      expect(embeddings[0].length).toBe(1024);
      expect(cohereService.client.v2.embed).toHaveBeenCalledWith({
        texts: ['Hello world'],
        model: 'embed-v4.0',
        inputType: 'search_query',
        embeddingTypes: ['float'],
      });
    });

    it('should embed multiple texts successfully', async () => {
      const request: TextEmbeddingRequest = {
        texts: ['Hello', 'World', 'Test'],
        model: 'embed-v4.0',
        inputType: 'classification',
      };

      cohereService.client.v2.embed = vi.fn().mockResolvedValue({
        embeddings: [
          { values: Array.from({ length: 1024 }, () => Math.random()) },
          { values: Array.from({ length: 1024 }, () => Math.random()) },
          { values: Array.from({ length: 1024 }, () => Math.random()) },
        ],
      });

      const embeddings = await embedText(cohereService, request);

      expect(embeddings).toBeDefined();
      expect(embeddings.length).toBe(3);
      embeddings.forEach(embedding => {
        expect(embedding.length).toBe(1024);
      });
    });

    it('should handle text embedding errors', async () => {
      cohereService.client.v2.embed = vi.fn().mockRejectedValue(new Error('API Error'));

      const request: TextEmbeddingRequest = {
        texts: ['Hello world'],
        model: 'embed-v4.0',
        inputType: 'search_query',
      };

      await expect(embedText(cohereService, request)).rejects.toThrow('API Error');
    });
  });

  describe('Image Embeddings', () => {
    beforeEach(() => {
      (global.fetch as any).mockResolvedValue({
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
        headers: {
          get: (name: string) => name === 'content-type' ? 'image/png' : null,
        },
      });
    });

    it('should embed image from URL successfully', async () => {
      const request: ImageEmbeddingRequest = {
        images: ['https://example.com/image.png'],
        model: 'embed-v4.0',
      };

      const embeddings = await embedImage(cohereService, request);

      expect(embeddings).toBeDefined();
      expect(embeddings.length).toBe(1);
      expect(embeddings[0].length).toBe(1024);
      
      expect(global.fetch).toHaveBeenCalledWith('https://example.com/image.png');
      expect(cohereService.client.v2.embed).toHaveBeenCalledWith({
        model: 'embed-v4.0',
        inputType: 'image',
        embeddingTypes: ['float'],
        images: [expect.stringMatching(/^data:image\/png;base64,/)],
      });
    });

    it('should embed multiple images successfully', async () => {
      const request: ImageEmbeddingRequest = {
        images: [
          'https://example.com/image1.png',
          'https://example.com/image2.jpg',
        ],
        model: 'embed-v4.0',
      };

      cohereService.client.v2.embed = vi.fn().mockResolvedValue({
        embeddings: [
          { values: Array.from({ length: 1024 }, () => Math.random()) },
          { values: Array.from({ length: 1024 }, () => Math.random()) },
        ],
      });

      const embeddings = await embedImage(cohereService, request);

      expect(embeddings).toBeDefined();
      expect(embeddings.length).toBe(2);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });

    it('should handle base64 images directly', async () => {
      const base64Image = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
      
      const request: ImageEmbeddingRequest = {
        images: [base64Image],
        model: 'embed-v4.0',
      };

      const embeddings = await embedImage(cohereService, request);

      expect(embeddings).toBeDefined();
      expect(embeddings.length).toBe(1);
      expect(global.fetch).not.toHaveBeenCalled(); // Should not fetch for base64
      expect(cohereService.client.v2.embed).toHaveBeenCalledWith({
        model: 'embed-v4.0',
        inputType: 'image',
        embeddingTypes: ['float'],
        images: [base64Image],
      });
    });

    it('should handle image fetch errors', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network Error'));

      const request: ImageEmbeddingRequest = {
        images: ['https://example.com/image.png'],
        model: 'embed-v4.0',
      };

      await expect(embedImage(cohereService, request)).rejects.toThrow('Network Error');
    });
  });

  describe('Document Embeddings', () => {
    it('should embed mixed documents (text and images)', async () => {
      const documents = [
        { type: 'text' as const, content: 'Hello world', metadata: { title: 'Text Doc' } },
        { type: 'image' as const, content: 'https://example.com/image.png', metadata: { title: 'Image Doc' } },
      ];

      // Mock both text and image embedding responses
      cohereService.client.v2.embed = vi.fn()
        .mockResolvedValueOnce({
          embeddings: [{ values: Array.from({ length: 1024 }, () => Math.random()) }],
        })
        .mockResolvedValueOnce({
          embeddings: [{ values: Array.from({ length: 1024 }, () => Math.random()) }],
        });

      const embeddings = await embedDocuments(cohereService, documents);

      expect(embeddings).toBeDefined();
      expect(embeddings.length).toBe(2);
      expect(embeddings[0].type).toBe('text');
      expect(embeddings[1].type).toBe('image');
      expect(cohereService.client.v2.embed).toHaveBeenCalledTimes(2);
    });

    it('should batch text documents efficiently', async () => {
      const documents = [
        { type: 'text' as const, content: 'Doc 1', metadata: { title: 'Document 1' } },
        { type: 'text' as const, content: 'Doc 2', metadata: { title: 'Document 2' } },
        { type: 'text' as const, content: 'Doc 3', metadata: { title: 'Document 3' } },
      ];

      cohereService.client.v2.embed = vi.fn().mockResolvedValue({
        embeddings: [
          { values: Array.from({ length: 1024 }, () => Math.random()) },
          { values: Array.from({ length: 1024 }, () => Math.random()) },
          { values: Array.from({ length: 1024 }, () => Math.random()) },
        ],
      });

      const embeddings = await embedDocuments(cohereService, documents);

      expect(embeddings.length).toBe(3);
      expect(cohereService.client.v2.embed).toHaveBeenCalledTimes(1); // Batched
    });
  });

  describe('Disabled Service', () => {
    beforeEach(() => {
      cohereService = createCohereEmbeddingService({
        apiKey: '',
      });
    });

    it('should throw error when trying to embed text with disabled service', async () => {
      const request: TextEmbeddingRequest = {
        texts: ['Hello world'],
        model: 'embed-v4.0',
        inputType: 'search_query',
      };

      await expect(embedText(cohereService, request)).rejects.toThrow('Cohere service is not enabled');
    });

    it('should throw error when trying to embed images with disabled service', async () => {
      const request: ImageEmbeddingRequest = {
        images: ['https://example.com/image.png'],
        model: 'embed-v4.0',
      };

      await expect(embedImage(cohereService, request)).rejects.toThrow('Cohere service is not enabled');
    });
  });
});