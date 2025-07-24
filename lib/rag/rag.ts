import { openai } from '@ai-sdk/openai';
import { embed, generateText } from 'ai';
import { AISDKExporter } from 'langsmith/vercel';
import { z } from 'zod';
import { getEmbeddingModelInstance, getModelInstance } from '../ai/providers';
import {
  type DocumentItem,
  embedDocuments,
  getCohereEmbeddingService,
  isImageContent,
} from '../embeddings/cohere';
import { isLangSmithEnabled } from '../env';
import {
  getUnifiedVectorStoreService,
  type VectorStoreType,
} from '../vectorstore/unified';
import {
  type ChunkingConfig,
  type Document as ChunkingDocument,
  type ChunkingResult,
  type ChunkingStrategy,
  createChunkingService,
  type DocumentChunkingService,
} from './chunking';

// Schemas
export const DocumentChunk = z.object({
  id: z.string(),
  documentId: z.string(),
  content: z.string(),
  embedding: z.array(z.number()),
  metadata: z
    .object({
      title: z.string().optional(),
      source: z.string().optional(),
      chunkIndex: z.number().optional(),
      timestamp: z.date().optional(),
    })
    .passthrough(),
});

export const RAGQuery = z.object({
  question: z.string().min(1),
  chatHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string(),
      }),
    )
    .default([]),
  modelId: z.string(),
  options: z
    .object({
      maxSources: z.number().default(5),
      minRelevanceScore: z.number().default(0.3),
      includeMetadata: z.boolean().default(true),
      useWebSearch: z.boolean().default(false),
      previousResponseId: z.string().optional(),
      vectorStoreSources: z
        .array(z.enum(['openai', 'neon', 'memory']))
        .default(['openai']),
      useFileSearch: z.boolean().default(true),
    })
    .optional(),
});

export const RAGResponse = z.object({
  answer: z.string(),
  sources: z.array(
    z.object({
      documentId: z.string(),
      content: z.string(),
      score: z.number(),
      metadata: z.record(z.any()).optional(),
    }),
  ),
  model: z.string(),
  usage: z
    .object({
      promptTokens: z.number().optional(),
      completionTokens: z.number().optional(),
      totalTokens: z.number().optional(),
    })
    .optional(),
  runId: z.string().optional(), // LangSmith run ID for feedback correlation
  responseId: z.string().optional(), // OpenAI response ID for continuity
});

export const RAGConfig = z.object({
  vectorStore: z.enum(['memory', 'postgres', 'pinecone']),
  embeddingModel: z.string(),
  chatModel: z.string(),
  options: z
    .object({
      chunkSize: z.number().default(1500),
      chunkOverlap: z.number().default(200),
      maxRetrievalLimit: z.number().default(20),
      embeddingDimensions: z.number().default(1536),
    })
    .optional(),
  chunking: z
    .object({
      strategy: z
        .enum([
          'character',
          'semantic',
          'recursive',
          'hybrid',
          'sentence',
          'paragraph',
          'markdown',
          'code',
        ])
        .default('hybrid'),
      preserveStructure: z.boolean().default(true),
      enableQualityValidation: z.boolean().default(true),
      minChunkSize: z.number().default(100),
      maxChunkSize: z.number().default(3000),
    })
    .optional(),
});

// Types
export type DocumentChunk = z.infer<typeof DocumentChunk>;
export type RAGQuery = z.infer<typeof RAGQuery>;
export type RAGResponse = z.infer<typeof RAGResponse>;
export type RAGConfig = z.infer<typeof RAGConfig>;

export interface Document {
  id: string;
  content: string;
  type?: 'text' | 'image' | 'markdown' | 'code' | 'html';
  metadata: Record<string, unknown>;
}

export interface SearchOptions {
  limit?: number;
  filter?: Record<string, unknown>;
  minScore?: number;
}

export interface SearchResult extends DocumentChunk {
  score: number;
}

// In-memory vector store for testing/development
class MemoryVectorStore {
  private chunks: Map<string, DocumentChunk> = new Map();

  async addChunks(chunks: DocumentChunk[]): Promise<void> {
    for (const chunk of chunks) {
      this.chunks.set(chunk.id, chunk);
    }
  }

  async searchSimilar(
    queryEmbedding: number[],
    options: SearchOptions = {},
  ): Promise<SearchResult[]> {
    const { limit = 10, minScore = 0.3, filter } = options;
    const results: SearchResult[] = [];

    for (const chunk of Array.from(this.chunks.values())) {
      // Apply metadata filter if provided
      if (filter) {
        const matchesFilter = Object.entries(filter).every(
          ([key, value]) => chunk.metadata[key] === value,
        );
        if (!matchesFilter) { continue; }
      }

      const score = cosineSimilarity(queryEmbedding, chunk.embedding);
      if (score >= minScore) {
        results.push({ ...chunk, score });
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, limit);
  }

  async deleteByDocumentId(documentId: string): Promise<void> {
    for (const [id, chunk] of Array.from(this.chunks.entries())) {
      if (chunk.documentId === documentId) {
        this.chunks.delete(id);
      }
    }
  }
}

// RAG Service
export class RAGService {
  private chunkingService: DocumentChunkingService;

  constructor(
    public config: RAGConfig,
    private vectorStore: MemoryVectorStore = new MemoryVectorStore(),
  ) {
    // Initialize chunking service with configuration
    const chunkingConfig: ChunkingConfig = {
      strategy: config.chunking?.strategy || 'hybrid',
      chunkSize: config.options?.chunkSize || 1500,
      chunkOverlap: config.options?.chunkOverlap || 200,
      preserveStructure: config.chunking?.preserveStructure ?? true,
      respectBoundaries: true, // Default value since not in RAGConfig
      enableQualityValidation: config.chunking?.enableQualityValidation ?? true,
      minChunkSize: config.chunking?.minChunkSize || 100,
      maxChunkSize: config.chunking?.maxChunkSize || 3000,
    };

    this.chunkingService = createChunkingService(chunkingConfig);
  }

  async embedDocument(document: Document): Promise<DocumentChunk[]> {
    // Detect document type if not specified
    const documentType =
      document.type || (isImageContent(document.content) ? 'image' : 'text');

    // Try to use Cohere for mixed or image documents
    const cohereService = getCohereEmbeddingService();
    if (cohereService.isEnabled && documentType === 'image') {
      return await this.embedDocumentWithCohere(document, documentType);
    }

    // Use enhanced chunking for text documents
    return await this.embedTextDocumentEnhanced(document);
  }

  private async embedDocumentWithCohere(
    document: Document,
    documentType: 'text' | 'image',
  ): Promise<DocumentChunk[]> {
    const cohereService = getCohereEmbeddingService();

    if (documentType === 'image') {
      // Embed image directly
      const documentItem: DocumentItem = {
        type: 'image',
        content: document.content,
        metadata: document.metadata,
      };

      const embeddedDocuments = await embedDocuments(cohereService, [
        documentItem,
      ]);
      const embeddedDoc = embeddedDocuments[0];

      const chunk: DocumentChunk = {
        id: `${document.id}-image`,
        documentId: document.id,
        content: document.content,
        embedding: embeddedDoc.embedding,
        metadata: {
          ...document.metadata,
          type: 'image',
          timestamp: new Date(),
        },
      };

      await this.vectorStore.addChunks([chunk]);
      return [chunk];
    } else {
      // Use enhanced chunking and embed text using Cohere
      const chunkingDocument: ChunkingDocument = {
        id: document.id,
        content: document.content,
        type: this.detectDocumentType(document),
        metadata: document.metadata,
      };

      const chunkingResult =
        await this.chunkingService.chunkDocument(chunkingDocument);
      const documentItems: DocumentItem[] = chunkingResult.chunks.map(
        (chunk) => ({
          type: 'text',
          content: chunk.content,
          metadata: chunk.metadata,
        }),
      );

      const embeddedDocuments = await embedDocuments(
        cohereService,
        documentItems,
      );
      const embeddedChunks: DocumentChunk[] = embeddedDocuments.map(
        (embeddedDoc, i) => ({
          id: chunkingResult.chunks[i].id,
          documentId: document.id,
          content: embeddedDoc.content,
          embedding: embeddedDoc.embedding,
          metadata: {
            ...chunkingResult.chunks[i].metadata,
            timestamp: new Date(),
            chunkingStrategy: chunkingResult.strategy,
            qualityScore: chunkingResult.chunks[i].metadata.quality?.score,
          },
        }),
      );

      await this.vectorStore.addChunks(embeddedChunks);
      return embeddedChunks;
    }
  }

  private async embedTextDocumentEnhanced(
    document: Document,
  ): Promise<DocumentChunk[]> {
    // Use enhanced chunking service
    const chunkingDocument: ChunkingDocument = {
      id: document.id,
      content: document.content,
      type: this.detectDocumentType(document),
      metadata: document.metadata,
    };

    const chunkingResult =
      await this.chunkingService.chunkDocument(chunkingDocument);
    const embeddedChunks: DocumentChunk[] = [];

    for (const enhancedChunk of chunkingResult.chunks) {
      const { embedding } = await embed({
        model: getEmbeddingModelInstance(this.config.embeddingModel),
        value: enhancedChunk.content,
      });

      const chunk: DocumentChunk = {
        id: enhancedChunk.id,
        documentId: document.id,
        content: enhancedChunk.content,
        embedding,
        metadata: {
          ...enhancedChunk.metadata,
          timestamp: new Date(),
          chunkingStrategy: chunkingResult.strategy,
          qualityScore: enhancedChunk.metadata.quality?.score,
          structurePreserved: enhancedChunk.boundaries.preservedStructure,
          boundaries: {
            start: enhancedChunk.boundaries.start,
            end: enhancedChunk.boundaries.end,
          },
        },
      };

      embeddedChunks.push(chunk);
    }

    await this.vectorStore.addChunks(embeddedChunks);
    return embeddedChunks;
  }

  private detectDocumentType(
    document: Document,
  ): 'text' | 'markdown' | 'code' | 'html' {
    // Check metadata first
    if (document.metadata.type) {
      return document.metadata.type as 'text' | 'markdown' | 'code' | 'html';
    }

    const content = document.content.toLowerCase();

    // Check for markdown indicators
    if (
      content.includes('```') ||
      content.match(/^#{1,6}\s/) ||
      content.includes('![')
    ) {
      return 'markdown';
    }

    // Check for HTML indicators
    if (
      content.includes('<html') ||
      content.includes('<!doctype') ||
      content.match(/<\w+/)
    ) {
      return 'html';
    }

    // Check for code indicators
    if (
      content.includes('function ') ||
      content.includes('class ') ||
      content.includes('import ') ||
      content.includes('const ') ||
      content.includes('def ') ||
      content.includes('public class')
    ) {
      return 'code';
    }

    return 'text';
  }

  async searchSimilar(
    query: string,
    options: SearchOptions = {},
    queryType?: 'text' | 'image',
    vectorStoreSources: VectorStoreType[] = ['memory'],
  ): Promise<SearchResult[]> {
    // If using external vector stores, delegate to unified service
    if (vectorStoreSources.some((source) => source !== 'memory')) {
      return await this.searchUnifiedVectorStores(
        query,
        options,
        vectorStoreSources,
      );
    }

    // Original in-memory search for backward compatibility
    const detectedType =
      queryType || (isImageContent(query) ? 'image' : 'text');

    let embedding: number[];

    // Use Cohere for image queries or when preferred
    const cohereService = getCohereEmbeddingService();
    if (cohereService.isEnabled && detectedType === 'image') {
      if (detectedType === 'image') {
        const embeddings = await embedDocuments(cohereService, [
          {
            type: 'image',
            content: query,
            metadata: {},
          },
        ]);
        embedding = embeddings[0].embedding;
      } else {
        const embeddings = await embedDocuments(cohereService, [
          {
            type: 'text',
            content: query,
            metadata: {},
          },
        ]);
        embedding = embeddings[0].embedding;
      }
    } else {
      // Fallback to standard text embedding
      const result = await embed({
        model: getEmbeddingModelInstance(this.config.embeddingModel),
        value: query,
      });
      embedding = result.embedding;
    }

    return await this.vectorStore.searchSimilar(embedding, options);
  }

  private async searchUnifiedVectorStores(
    query: string,
    options: SearchOptions,
    vectorStoreSources: VectorStoreType[],
  ): Promise<SearchResult[]> {
    try {
      const unifiedService = await getUnifiedVectorStoreService();

      const results = await unifiedService.searchAcrossSources({
        query,
        sources: vectorStoreSources,
        maxResults: options.limit || 10,
        threshold: options.minScore || 0.3,
        metadata: options.filter,
        optimizePrompts: false,
      });

      // Convert unified results to RAG search results
      return results.map((result) => ({
        id: result.document.id,
        documentId: result.document.id,
        content: result.document.content,
        embedding: [], // Not needed for unified results
        metadata: result.document.metadata || {},
        score: result.similarity,
      }));
    } catch (_error) {
      return [];
    }
  }

  async generateResponse(query: RAGQuery): Promise<RAGResponse> {
    const validatedQuery = RAGQuery.parse(query);
    const { question, chatHistory, modelId, options } = validatedQuery;

    // Retrieve relevant context from selected vector stores
    const searchResults = await this.searchSimilar(
      question,
      {
        limit: options?.maxSources || 5,
        minScore: options?.minRelevanceScore || 0.3,
      },
      undefined,
      options?.vectorStoreSources || ['openai'],
    );

    // Prepare context for generation
    const context = searchResults
      .map(
        (result) =>
          `Source: ${result.metadata.title || result.documentId}\n${result.content}`,
      )
      .join('\n\n---\n\n');

    // Generate response
    const systemPrompt = `You are a helpful AI assistant that answers questions based on the provided context. 
Use the context below to answer the user's question. If the context doesn't contain relevant information, 
say so clearly and provide a general response.

Context:
${context}

Instructions:
- Answer based primarily on the provided context
- If context is insufficient, acknowledge this limitation
- Be concise and accurate
- Cite sources when relevant`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...chatHistory.map((msg) => ({
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      })),
      { role: 'user' as const, content: question },
    ];

    // Get telemetry settings for LangSmith tracing
    const telemetrySettings = isLangSmithEnabled
      ? AISDKExporter.getSettings()
      : undefined;

    // Check if we should use OpenAI responses API
    const shouldUseResponses =
      options?.useWebSearch ||
      options?.previousResponseId ||
      options?.useFileSearch;
    const modelInstance =
      shouldUseResponses && modelId.startsWith('openai-')
        ? openai.responses(modelId.replace('openai-', ''))
        : getModelInstance(modelId);

    // Configure tools for OpenAI responses
    const tools: any = {};

    if (shouldUseResponses) {
      if (options?.useWebSearch) {
        tools.web_search_preview = openai.tools.webSearchPreview();
      }

      if (
        options?.useFileSearch &&
        options?.vectorStoreSources?.includes('openai')
      ) {
        try {
          const unifiedService = await getUnifiedVectorStoreService();
          const fileSearchTool =
            unifiedService.openaiService.getFileSearchTool();
          tools.file_search = fileSearchTool;
        } catch (_error) {
        }
      }
    }

    // Only pass tools if we have any
    const finalTools = Object.keys(tools).length > 0 ? tools : undefined;

    // Configure provider options for response continuity
    const providerOptions = options?.previousResponseId
      ? {
          openai: {
            previousResponseId: options.previousResponseId,
          },
        }
      : undefined;

    const {
      text,
      usage,
      response: aiResponse,
    } = await generateText({
      model: modelInstance,
      messages,
      maxTokens: 1000,
      temperature: 0.1,
      experimental_telemetry: telemetrySettings,
      tools: finalTools,
      providerOptions,
    });

    const response = RAGResponse.parse({
      answer: text,
      sources: searchResults.map((result) => ({
        documentId: result.documentId,
        content: `${result.content.substring(0, 200)}...`,
        score: result.score,
        metadata: options?.includeMetadata ? result.metadata : undefined,
      })),
      model: modelId,
      usage,
      runId: aiResponse?.id || crypto.randomUUID(), // Use AI response ID or generate one
      responseId: (aiResponse as any)?.providerMetadata?.openai?.responseId, // OpenAI response ID for continuity
    });

    // LangSmith tracking is now handled automatically by the AI SDK instrumentation

    return response;
  }

  private chunkDocument(document: Document): string[] {
    const { chunkSize = 1500, chunkOverlap = 200 } = this.config.options || {};
    const chunks: string[] = [];
    const content = document.content;

    if (content.length <= chunkSize) {
      return [content];
    }

    let start = 0;
    while (start < content.length) {
      const end = Math.min(start + chunkSize, content.length);
      let chunk = content.slice(start, end);

      // Try to break at sentence boundaries
      if (end < content.length) {
        const lastPeriod = chunk.lastIndexOf('.');
        const lastNewline = chunk.lastIndexOf('\n');
        const breakPoint = Math.max(lastPeriod, lastNewline);

        if (breakPoint > start + chunkSize * 0.5) {
          chunk = content.slice(start, breakPoint + 1);
        }
      }

      chunks.push(chunk.trim());
      start = end - chunkOverlap;
    }

    return chunks.filter((chunk) => chunk.length > 0);
  }

  // Enhanced chunking methods
  async analyzeDocumentChunking(document: Document): Promise<ChunkingResult> {
    const chunkingDocument: ChunkingDocument = {
      id: document.id,
      content: document.content,
      type: this.detectDocumentType(document),
      metadata: document.metadata,
    };

    return await this.chunkingService.chunkDocument(chunkingDocument);
  }

  updateChunkingStrategy(strategy: ChunkingStrategy): void {
    this.chunkingService.updateConfig({ strategy });
  }

  getChunkingConfig(): ChunkingConfig {
    return this.chunkingService.getConfig();
  }

  async getChunkQualityMetrics(_documentId: string): Promise<{
    avgQuality: number;
    totalChunks: number;
    structurePreservation: number;
    chunkingStrategy: string;
  } | null> {
    // This would need to be implemented based on how chunks are stored
    // For now, return a basic implementation
    return null;
  }
}

// Utility functions
function cosineSimilarity(a: number[], b: number[]): number {
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

// Factory functions
export function createRAGService(config: RAGConfig): RAGService {
  const validatedConfig = RAGConfig.parse(config);
  return new RAGService(validatedConfig);
}

export async function embedDocument(
  service: RAGService,
  document: Document,
): Promise<DocumentChunk[]> {
  return await service.embedDocument(document);
}

export async function searchSimilarChunks(
  service: RAGService,
  query: string,
  options?: SearchOptions,
): Promise<SearchResult[]> {
  return await service.searchSimilar(query, options);
}

export async function generateRAGResponse(
  service: RAGService,
  query: RAGQuery,
): Promise<RAGResponse> {
  return await service.generateResponse(query);
}

// Enhanced chunking exports
export {
  type ChunkingConfig,
  type ChunkingResult,
  type ChunkingStrategy,
  chunkDocument as createEnhancedChunks,
  createChunkingService,
  type DocumentChunk as EnhancedDocumentChunk,
  DocumentChunkingService,
} from './chunking';

export async function analyzeDocumentChunking(
  service: RAGService,
  document: Document,
): Promise<ChunkingResult> {
  return await service.analyzeDocumentChunking(document);
}

export function updateChunkingStrategy(
  service: RAGService,
  strategy: ChunkingStrategy,
): void {
  service.updateChunkingStrategy(strategy);
}

export function getChunkingConfig(service: RAGService): ChunkingConfig {
  return service.getChunkingConfig();
}
