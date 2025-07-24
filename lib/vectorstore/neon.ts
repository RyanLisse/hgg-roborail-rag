import 'server-only';

import { embed } from 'ai';
import { desc, gt, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { z } from 'zod';
import { getEmbeddingModelInstance } from '../ai/providers';
import { vectorDocuments } from '../db/schema';
import { POSTGRES_URL } from '../env';
import {
  getVectorStoreMonitoringService,
  withPerformanceMonitoring,
} from './monitoring';

// Schemas
export const NeonDocument = z.object({
  id: z.string(),
  content: z.string(),
  metadata: z.record(z.any()).optional(),
  embedding: z.array(z.number()).optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const NeonDocumentInsert = z.object({
  content: z.string().min(1),
  metadata: z.record(z.any()).optional(),
  embedding: z.array(z.number()).optional(),
});

export const NeonSearchRequest = z.object({
  query: z.string().min(1),
  maxResults: z.number().min(1).max(100).default(10),
  threshold: z.number().min(0).max(1).default(0.3),
  metadata: z.record(z.any()).optional(),
});

export const NeonSearchResult = z.object({
  document: NeonDocument,
  similarity: z.number(),
  distance: z.number(),
});

// Types
export type NeonDocument = z.infer<typeof NeonDocument>;
export type NeonDocumentInsert = z.infer<typeof NeonDocumentInsert>;
export type NeonSearchRequest = z.infer<typeof NeonSearchRequest>;
export type NeonSearchResult = z.infer<typeof NeonSearchResult>;

export interface NeonVectorStoreConfig {
  connectionString: string;
  embeddingModel: string;
  isEnabled: boolean;
}

export interface NeonVectorStoreService {
  db: ReturnType<typeof drizzle>;
  isEnabled: boolean;
  embeddingModel: string;

  // Document management
  addDocument: (document: NeonDocumentInsert) => Promise<NeonDocument>;
  addDocuments: (documents: NeonDocumentInsert[]) => Promise<NeonDocument[]>;
  getDocument: (id: string) => Promise<NeonDocument | null>;
  updateDocument: (
    id: string,
    document: Partial<NeonDocumentInsert>,
  ) => Promise<NeonDocument>;
  deleteDocument: (id: string) => Promise<boolean>;

  // Search operations
  searchSimilar: (request: NeonSearchRequest) => Promise<NeonSearchResult[]>;
  searchSimilarByEmbedding: (
    embedding: number[],
    maxResults?: number,
    threshold?: number,
  ) => Promise<NeonSearchResult[]>;

  // Utility methods
  generateEmbedding: (text: string) => Promise<number[]>;
  initializeExtensions: () => Promise<void>;
}

// Create Neon vector store service
export function createNeonVectorStoreService(
  config?: Partial<NeonVectorStoreConfig>,
): NeonVectorStoreService {
  // Check if we're in test mode first
  const isTestMode =
    process.env.NODE_ENV === 'test' || process.env.PLAYWRIGHT === 'true';

  const validatedConfig: NeonVectorStoreConfig = {
    connectionString: config?.connectionString || POSTGRES_URL || '',
    embeddingModel: config?.embeddingModel || 'text-embedding-3-small',
    isEnabled: !isTestMode && !!(config?.connectionString || POSTGRES_URL),
  };

  // In test mode, always return disabled service
  if (isTestMode || !validatedConfig.isEnabled) {
    if (isTestMode) {
    } else {
    }
    return {
      db: null as any,
      isEnabled: false,
      embeddingModel: validatedConfig.embeddingModel,
      addDocument: async () => {
        throw new Error('Neon vector store service is disabled');
      },
      addDocuments: async () => {
        throw new Error('Neon vector store service is disabled');
      },
      getDocument: async () => {
        throw new Error('Neon vector store service is disabled');
      },
      updateDocument: async () => {
        throw new Error('Neon vector store service is disabled');
      },
      deleteDocument: async () => {
        throw new Error('Neon vector store service is disabled');
      },
      searchSimilar: async () => {
        throw new Error('Neon vector store service is disabled');
      },
      searchSimilarByEmbedding: async () => {
        throw new Error('Neon vector store service is disabled');
      },
      generateEmbedding: async () => {
        throw new Error('Neon vector store service is disabled');
      },
      initializeExtensions: async () => {
        throw new Error('Neon vector store service is disabled');
      },
    };
  }

  const client = postgres(validatedConfig.connectionString);
  const db = drizzle(client);

  return {
    db,
    isEnabled: true,
    embeddingModel: validatedConfig.embeddingModel,

    async initializeExtensions(): Promise<void> {
        // Enable pgvector extension
        await this.db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`);

        // Create index for faster similarity search
        await this.db.execute(sql`
          CREATE INDEX IF NOT EXISTS vector_documents_embedding_idx 
          ON vector_documents 
          USING ivfflat (embedding vector_cosine_ops) 
          WITH (lists = 100);
        `);
    },

    generateEmbedding: withPerformanceMonitoring(
      'neon',
      'generateEmbedding',
      async (text: string): Promise<number[]> => {
        const monitoringService = getVectorStoreMonitoringService();

        try {
          const { embedding } = await embed({
            model: getEmbeddingModelInstance(validatedConfig.embeddingModel),
            value: text,
          });

          // Record embedding generation metrics
          monitoringService.recordMetric({
            provider: 'neon',
            metricType: 'embedding_generation',
            value: 1,
            unit: 'count',
            success: true,
            metadata: {
              textLength: text.length,
              modelName: validatedConfig.embeddingModel,
            },
          });

          return embedding;
        } catch (error) {
          monitoringService.recordMetric({
            provider: 'neon',
            metricType: 'embedding_generation',
            value: 0,
            unit: 'count',
            success: false,
            errorMessage:
              error instanceof Error ? error.message : 'Unknown error',
          });
          throw error;
        }
      },
    ),

    async addDocument(document: NeonDocumentInsert): Promise<NeonDocument> {
      const validatedDocument = NeonDocumentInsert.parse(document);
        // Generate embedding if not provided
        const embedding =
          validatedDocument.embedding ||
          (await this.generateEmbedding(validatedDocument.content));

        const [insertedDocument] = await this.db
          .insert(vectorDocuments)
          .values({
            content: validatedDocument.content,
            metadata: validatedDocument.metadata || {},
            embedding: embedding as any, // Type assertion for pgvector
          })
          .returning();

        return NeonDocument.parse({
          ...insertedDocument,
          embedding,
        });
    },

    async addDocuments(
      documents: NeonDocumentInsert[],
    ): Promise<NeonDocument[]> {
      const validatedDocuments = documents.map((doc) =>
        NeonDocumentInsert.parse(doc),
      );
        // Generate embeddings for documents that don't have them
        const documentsWithEmbeddings = await Promise.all(
          validatedDocuments.map(async (doc) => ({
            ...doc,
            embedding:
              doc.embedding || (await this.generateEmbedding(doc.content)),
          })),
        );

        const insertedDocuments = await this.db
          .insert(vectorDocuments)
          .values(
            documentsWithEmbeddings.map((doc) => ({
              content: doc.content,
              metadata: doc.metadata || {},
              embedding: doc.embedding as any,
            })),
          )
          .returning();

        return insertedDocuments.map((doc, index) =>
          NeonDocument.parse({
            ...doc,
            embedding: documentsWithEmbeddings[index].embedding,
          }),
        );
    },

    async getDocument(id: string): Promise<NeonDocument | null> {
        const [document] = await this.db
          .select()
          .from(vectorDocuments)
          .where(sql`${vectorDocuments.id} = ${id}`)
          .limit(1);

        return document ? NeonDocument.parse(document) : null;
    },

    async updateDocument(
      id: string,
      document: Partial<NeonDocumentInsert>,
    ): Promise<NeonDocument> {
        const updateData: any = {
          ...document,
          updatedAt: new Date(),
        };

        // Generate new embedding if content changed
        if (document.content && !document.embedding) {
          updateData.embedding = await this.generateEmbedding(document.content);
        }

        const [updatedDocument] = await this.db
          .update(vectorDocuments)
          .set(updateData)
          .where(sql`${vectorDocuments.id} = ${id}`)
          .returning();

        return NeonDocument.parse(updatedDocument);
    },

    async deleteDocument(id: string): Promise<boolean> {
      try {
        const _result = await this.db
          .delete(vectorDocuments)
          .where(sql`${vectorDocuments.id} = ${id}`);

        return true;
      } catch (_error) {
        return false;
      }
    },

    searchSimilar: withPerformanceMonitoring(
      'neon',
      'searchSimilar',
      async function (
        this: any,
        request: NeonSearchRequest,
      ): Promise<NeonSearchResult[]> {
        const monitoringService = getVectorStoreMonitoringService();
        const validatedRequest = NeonSearchRequest.parse(request);
        const startTime = Date.now();

        try {
          // Generate embedding for the query
          const queryEmbedding = await this.generateEmbedding(
            validatedRequest.query,
          );
          const results = await this.searchSimilarByEmbedding(
            queryEmbedding,
            validatedRequest.maxResults,
            validatedRequest.threshold,
          );

          const executionTime = Date.now() - startTime;

          // Record successful search metrics
          monitoringService.recordSearchLatency('neon', executionTime, {
            query: validatedRequest.query,
            resultsCount: results.length,
            threshold: validatedRequest.threshold,
          });
          monitoringService.recordSearchSuccess('neon', {
            query: validatedRequest.query,
            resultsCount: results.length,
          });

          return results;
        } catch (error) {
          // Record search error
          monitoringService.recordSearchError('neon', error as Error, {
            query: validatedRequest.query,
          });
          throw error;
        }
      },
    ),

    async searchSimilarByEmbedding(
      embedding: number[],
      maxResults = 10,
      threshold = 0.3,
    ): Promise<NeonSearchResult[]> {
        const similarity = sql<number>`1 - (${vectorDocuments.embedding} <=> ${JSON.stringify(embedding)})`;

        const results = await this.db
          .select({
            id: vectorDocuments.id,
            content: vectorDocuments.content,
            metadata: vectorDocuments.metadata,
            embedding: vectorDocuments.embedding,
            createdAt: vectorDocuments.createdAt,
            updatedAt: vectorDocuments.updatedAt,
            similarity,
          })
          .from(vectorDocuments)
          .where(gt(similarity, threshold))
          .orderBy(desc(similarity))
          .limit(maxResults);

        return results.map((result) => {
          const { similarity, ...document } = result;
          return NeonSearchResult.parse({
            document: NeonDocument.parse(document),
            similarity: similarity || 0,
            distance: 1 - (similarity || 0),
          });
        });
    },
  };
}

// Singleton service
let neonVectorStoreService: NeonVectorStoreService | null = null;

export async function getNeonVectorStoreService(): Promise<NeonVectorStoreService> {
  if (!neonVectorStoreService) {
    neonVectorStoreService = createNeonVectorStoreService();

    // Initialize extensions on first use, but not in test mode
    const isTestMode =
      process.env.NODE_ENV === 'test' || process.env.PLAYWRIGHT === 'true';
    if (neonVectorStoreService.isEnabled && !isTestMode) {
      try {
        await neonVectorStoreService.initializeExtensions();
      } catch (_error) {
      }
    } else if (isTestMode) {
    }
  }
  return neonVectorStoreService;
}
