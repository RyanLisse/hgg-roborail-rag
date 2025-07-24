import { CohereClient } from 'cohere-ai';
import { z } from 'zod';
import { COHERE_API_KEY } from '../env';

// Configuration schema
export const CohereConfig = z.object({
  apiKey: z.string(),
  timeout: z.number().default(30_000),
});

// Embedding request schemas
export const TextEmbeddingRequest = z.object({
  texts: z.array(z.string()).min(1).max(96), // Cohere's batch limit
  model: z.string().default('embed-v4.0'),
  inputType: z
    .enum(['search_query', 'search_document', 'classification', 'clustering'])
    .default('search_document'),
  truncate: z.enum(['START', 'END']).optional(),
});

export const ImageEmbeddingRequest = z.object({
  images: z.array(z.string()).min(1).max(96), // URLs or base64 strings
  model: z.string().default('embed-v4.0'),
  truncate: z.enum(['START', 'END']).optional(),
});

// Document types for mixed embedding
export const DocumentItem = z.object({
  type: z.enum(['text', 'image']),
  content: z.string(), // Text content or image URL/base64
  metadata: z.record(z.any()).optional(),
});

// Types
export type CohereConfig = z.infer<typeof CohereConfig>;
export type TextEmbeddingRequest = z.infer<typeof TextEmbeddingRequest>;
export type ImageEmbeddingRequest = z.infer<typeof ImageEmbeddingRequest>;
export type DocumentItem = z.infer<typeof DocumentItem>;

export interface CohereEmbeddingService {
  client: CohereClient;
  isEnabled: boolean;
}

export interface EmbeddedDocument {
  type: 'text' | 'image';
  content: string;
  embedding: number[];
  metadata?: Record<string, any>;
}

// Create Cohere embedding service
export function createCohereEmbeddingService(
  config: CohereConfig,
): CohereEmbeddingService {
  const validatedConfig = CohereConfig.parse(config);

  if (!validatedConfig.apiKey) {
    return {
      client: null as any,
      isEnabled: false,
    };
  }

  try {
    const client = new CohereClient({
      token: validatedConfig.apiKey,
    });

    return {
      client,
      isEnabled: true,
    };
  } catch (_error) {
    return {
      client: null as any,
      isEnabled: false,
    };
  }
}

// Embed text using Cohere
export async function embedText(
  service: CohereEmbeddingService,
  request: TextEmbeddingRequest,
): Promise<number[][]> {
  if (!service.isEnabled) {
    throw new Error('Cohere service is not enabled');
  }

  const validatedRequest = TextEmbeddingRequest.parse(request);
    const response = await service.client.v2.embed({
      texts: validatedRequest.texts,
      model: validatedRequest.model,
      inputType: validatedRequest.inputType,
      embeddingTypes: ['float'],
      truncate: validatedRequest.truncate,
    });

    return response.embeddings.float || [];
}

// Embed images using Cohere
export async function embedImage(
  service: CohereEmbeddingService,
  request: ImageEmbeddingRequest,
): Promise<number[][]> {
  if (!service.isEnabled) {
    throw new Error('Cohere service is not enabled');
  }

  const validatedRequest = ImageEmbeddingRequest.parse(request);
    // Process images to base64 format
    const processedImages = await Promise.all(
      validatedRequest.images.map(async (image) => {
        if (image.startsWith('data:')) {
          // Already base64 encoded
          return image;
        }

        // Fetch image and convert to base64
        const response = await fetch(image);
        const buffer = await response.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const contentType =
          response.headers.get('content-type') || 'image/jpeg';
        return `data:${contentType};base64,${base64}`;
      }),
    );

    const response = await service.client.v2.embed({
      model: validatedRequest.model,
      inputType: 'image',
      embeddingTypes: ['float'],
      images: processedImages,
      truncate: validatedRequest.truncate,
    });

    return response.embeddings.float || [];
}

// Embed mixed documents (text and images)
export async function embedDocuments(
  service: CohereEmbeddingService,
  documents: DocumentItem[],
): Promise<EmbeddedDocument[]> {
  if (!service.isEnabled) {
    throw new Error('Cohere service is not enabled');
  }

  const validatedDocuments = documents.map((doc) => DocumentItem.parse(doc));

  // Separate text and image documents
  const textDocs = validatedDocuments.filter((doc) => doc.type === 'text');
  const imageDocs = validatedDocuments.filter((doc) => doc.type === 'image');

  const results: EmbeddedDocument[] = [];

  // Embed text documents in batches
  if (textDocs.length > 0) {
    const texts = textDocs.map((doc) => doc.content);
    const textEmbeddings = await embedText(service, {
      texts,
      model: 'embed-v4.0',
      inputType: 'search_document',
    });

    textDocs.forEach((doc, index) => {
      results.push({
        type: 'text',
        content: doc.content,
        embedding: textEmbeddings[index],
        metadata: doc.metadata,
      });
    });
  }

  // Embed image documents in batches
  if (imageDocs.length > 0) {
    const images = imageDocs.map((doc) => doc.content);
    const imageEmbeddings = await embedImage(service, {
      images,
      model: 'embed-v4.0',
    });

    imageDocs.forEach((doc, index) => {
      results.push({
        type: 'image',
        content: doc.content,
        embedding: imageEmbeddings[index],
        metadata: doc.metadata,
      });
    });
  }

  // Return results in original order
  const orderedResults: EmbeddedDocument[] = [];
  let _textIndex = 0;
  let _imageIndex = 0;

  validatedDocuments.forEach((doc) => {
    if (doc.type === 'text') {
      const textResult = results.find(
        (r) => r.type === 'text' && r.content === doc.content,
      );
      if (textResult) {
        orderedResults.push(textResult);
        _textIndex++;
      }
    } else {
      const imageResult = results.find(
        (r) => r.type === 'image' && r.content === doc.content,
      );
      if (imageResult) {
        orderedResults.push(imageResult);
        _imageIndex++;
      }
    }
  });

  return orderedResults;
}

// Utility function to check if string is a valid image URL or base64
export function isImageContent(content: string): boolean {
  if (content.startsWith('data:image/')) {
    return true;
  }

  const imageExtensions = [
    '.jpg',
    '.jpeg',
    '.png',
    '.gif',
    '.webp',
    '.bmp',
    '.svg',
  ];
  const lowerContent = content.toLowerCase();

  return (
    imageExtensions.some((ext) => lowerContent.includes(ext)) ||
    content.startsWith('http://') ||
    content.startsWith('https://')
  );
}

// Singleton service instance
let cohereService: CohereEmbeddingService | null = null;

export function getCohereEmbeddingService(): CohereEmbeddingService {
  if (!cohereService) {
    cohereService = createCohereEmbeddingService({
      apiKey: COHERE_API_KEY || '',
      timeout: 30_000,
    });
  }

  return cohereService;
}

// Calculate cosine similarity between embeddings
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) { return 0; }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) { return 0; }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
