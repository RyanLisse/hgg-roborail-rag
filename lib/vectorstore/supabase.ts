import 'server-only';

import { embed } from 'ai';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { getEmbeddingModelInstance } from '../ai/providers';
import { supabaseConfig } from '../env';
import {
  getVectorStoreMonitoringService,
  withPerformanceMonitoring,
} from './monitoring';

// Schemas for Supabase vector store operations
export const SupabaseDocument = z.object({
  id: z.string(),
  content: z.string(),
  metadata: z.record(z.any()).optional(),
  embedding: z.array(z.number()).optional(),
  createdAt: z.date(),
  updatedAt: z.date().optional(),
});

export const SupabaseDocumentInsert = z.object({
  content: z.string().min(1),
  metadata: z.record(z.any()).optional(),
  embedding: z.array(z.number()).optional(),
});

export const SupabaseSearchRequest = z.object({
  query: z.string().min(1),
  maxResults: z.number().min(1).max(100).default(10),
  threshold: z.number().min(0).max(1).default(0.3),
  metadata: z.record(z.any()).optional(),
});

export const SupabaseSearchResult = z.object({
  document: SupabaseDocument,
  similarity: z.number(),
  distance: z.number(),
});

// Types
export type SupabaseDocument = z.infer<typeof SupabaseDocument>;
export type SupabaseDocumentInsert = z.infer<typeof SupabaseDocumentInsert>;
export type SupabaseSearchRequest = z.infer<typeof SupabaseSearchRequest>;
export type SupabaseSearchResult = z.infer<typeof SupabaseSearchResult>;

export interface SupabaseVectorStoreConfig {
  url: string;
  anonKey: string;
  serviceRoleKey?: string;
  embeddingModel: string;
  isEnabled: boolean;
}

export interface SupabaseVectorStoreService {
  client: SupabaseClient;
  isEnabled: boolean;
  embeddingModel: string;

  // Document management
  addDocument: (document: SupabaseDocumentInsert) => Promise<SupabaseDocument>;
  addDocuments: (documents: SupabaseDocumentInsert[]) => Promise<SupabaseDocument[]>;
  getDocument: (id: string) => Promise<SupabaseDocument | null>;
  updateDocument: (
    id: string,
    document: Partial<SupabaseDocumentInsert>,
  ) => Promise<SupabaseDocument>;
  deleteDocument: (id: string) => Promise<boolean>;

  // Search operations
  searchSimilar: (request: SupabaseSearchRequest) => Promise<SupabaseSearchResult[]>;
  searchSimilarByEmbedding: (
    embedding: number[],
    maxResults?: number,
    threshold?: number,
  ) => Promise<SupabaseSearchResult[]>;

  // Utility methods
  generateEmbedding: (text: string) => Promise<number[]>;
  healthCheck: () => Promise<{
    isHealthy: boolean;
    responseTime?: number;
    error?: string;
  }>;
}

// Create Supabase vector store service
export function createSupabaseVectorStoreService(
  config?: Partial<SupabaseVectorStoreConfig>,
): SupabaseVectorStoreService {
  // Check if we're in test mode first
  const isTestMode =
    process.env.NODE_ENV === 'test' || process.env.PLAYWRIGHT === 'true';

  const validatedConfig: SupabaseVectorStoreConfig = {
    url: config?.url || supabaseConfig.url,
    anonKey: config?.anonKey || supabaseConfig.anonKey,
    serviceRoleKey: config?.serviceRoleKey || supabaseConfig.serviceRoleKey,
    embeddingModel: config?.embeddingModel || 'text-embedding-3-small',
    isEnabled: !isTestMode && !!(config?.url || supabaseConfig.url) && !!(config?.anonKey || supabaseConfig.anonKey),
  };

  // In test mode or when disabled, return disabled service
  if (isTestMode || !validatedConfig.isEnabled) {
    return {
      client: null as any,
      isEnabled: false,
      embeddingModel: validatedConfig.embeddingModel,
      addDocument: async () => {
        throw new Error('Supabase vector store service is disabled');
      },
      addDocuments: async () => {
        throw new Error('Supabase vector store service is disabled');
      },
      getDocument: async () => {
        throw new Error('Supabase vector store service is disabled');
      },
      updateDocument: async () => {
        throw new Error('Supabase vector store service is disabled');
      },
      deleteDocument: async () => {
        throw new Error('Supabase vector store service is disabled');
      },
      searchSimilar: async () => {
        throw new Error('Supabase vector store service is disabled');
      },
      searchSimilarByEmbedding: async () => {
        throw new Error('Supabase vector store service is disabled');
      },
      generateEmbedding: async () => {
        throw new Error('Supabase vector store service is disabled');
      },
      healthCheck: async () => ({
        isHealthy: false,
        error: 'Service disabled',
      }),
    };
  }

  // Use service role key for server-side operations, fallback to anon key
  const apiKey = validatedConfig.serviceRoleKey || validatedConfig.anonKey;
  const client = createClient(validatedConfig.url, apiKey);

  return {
    client,
    isEnabled: true,
    embeddingModel: validatedConfig.embeddingModel,

    generateEmbedding: withPerformanceMonitoring(
      'supabase',
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
            provider: 'supabase',
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
            provider: 'supabase',
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

    async addDocument(document: SupabaseDocumentInsert): Promise<SupabaseDocument> {
      const validatedDocument = SupabaseDocumentInsert.parse(document);
      
      // Generate embedding if not provided
      const embedding =
        validatedDocument.embedding ||
        (await this.generateEmbedding(validatedDocument.content));

      const { data, error } = await client
        .from('documents')
        .insert({
          content: validatedDocument.content,
          metadata: validatedDocument.metadata || {},
          embedding: embedding,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to insert document: ${error.message}`);
      }

      return SupabaseDocument.parse({
        ...data,
        embedding,
        createdAt: new Date(data.created_at),
        updatedAt: data.updated_at ? new Date(data.updated_at) : undefined,
      });
    },

    async addDocuments(
      documents: SupabaseDocumentInsert[],
    ): Promise<SupabaseDocument[]> {
      const validatedDocuments = documents.map((doc) =>
        SupabaseDocumentInsert.parse(doc),
      );

      // Generate embeddings for documents that don't have them
      const documentsWithEmbeddings = await Promise.all(
        validatedDocuments.map(async (doc) => ({
          ...doc,
          embedding:
            doc.embedding || (await this.generateEmbedding(doc.content)),
        })),
      );

      const { data, error } = await client
        .from('documents')
        .insert(
          documentsWithEmbeddings.map((doc) => ({
            content: doc.content,
            metadata: doc.metadata || {},
            embedding: doc.embedding,
            created_at: new Date().toISOString(),
          })),
        )
        .select();

      if (error) {
        throw new Error(`Failed to insert documents: ${error.message}`);
      }

      return data.map((item, index) =>
        SupabaseDocument.parse({
          ...item,
          embedding: documentsWithEmbeddings[index].embedding,
          createdAt: new Date(item.created_at),
          updatedAt: item.updated_at ? new Date(item.updated_at) : undefined,
        }),
      );
    },

    async getDocument(id: string): Promise<SupabaseDocument | null> {
      const { data, error } = await client
        .from('documents')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found
          return null;
        }
        throw new Error(`Failed to get document: ${error.message}`);
      }

      return data ? SupabaseDocument.parse({
        ...data,
        createdAt: new Date(data.created_at),
        updatedAt: data.updated_at ? new Date(data.updated_at) : undefined,
      }) : null;
    },

    async updateDocument(
      id: string,
      document: Partial<SupabaseDocumentInsert>,
    ): Promise<SupabaseDocument> {
      const updateData: any = {
        ...document,
        updated_at: new Date().toISOString(),
      };

      // Generate new embedding if content changed
      if (document.content && !document.embedding) {
        updateData.embedding = await this.generateEmbedding(document.content);
      }

      const { data, error } = await client
        .from('documents')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update document: ${error.message}`);
      }

      return SupabaseDocument.parse({
        ...data,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      });
    },

    async deleteDocument(id: string): Promise<boolean> {
      try {
        const { error } = await client
          .from('documents')
          .delete()
          .eq('id', id);

        return !error;
      } catch (_error) {
        return false;
      }
    },

    searchSimilar: withPerformanceMonitoring(
      'supabase',
      'searchSimilar',
      async function (
        this: any,
        request: SupabaseSearchRequest,
      ): Promise<SupabaseSearchResult[]> {
        const monitoringService = getVectorStoreMonitoringService();
        const validatedRequest = SupabaseSearchRequest.parse(request);
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
          monitoringService.recordSearchLatency('supabase', executionTime, {
            query: validatedRequest.query,
            resultsCount: results.length,
            threshold: validatedRequest.threshold,
          });
          monitoringService.recordSearchSuccess('supabase', {
            query: validatedRequest.query,
            resultsCount: results.length,
          });

          return results;
        } catch (error) {
          // Record search error
          monitoringService.recordSearchError('supabase', error as Error, {
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
    ): Promise<SupabaseSearchResult[]> {
      // Use Supabase RPC function for vector similarity search
      // This assumes you have a PostgreSQL function that handles vector similarity
      const { data, error } = await client.rpc('search_documents', {
        query_embedding: embedding,
        similarity_threshold: threshold,
        match_count: maxResults,
      });

      if (error) {
        throw new Error(`Search failed: ${error.message}`);
      }

      return (data || []).map((result: any) =>
        SupabaseSearchResult.parse({
          document: SupabaseDocument.parse({
            id: result.id,
            content: result.content,
            metadata: result.metadata || {},
            embedding: result.embedding,
            createdAt: new Date(result.created_at),
            updatedAt: result.updated_at ? new Date(result.updated_at) : undefined,
          }),
          similarity: result.similarity || 0,
          distance: 1 - (result.similarity || 0),
        }),
      );
    },

    async healthCheck(): Promise<{
      isHealthy: boolean;
      responseTime?: number;
      error?: string;
    }> {
      const startTime = Date.now();
      
      try {
        // Test basic connectivity with a simple query
        const { error } = await client
          .from('documents')
          .select('count')
          .limit(1);

        const responseTime = Date.now() - startTime;

        if (error) {
          return {
            isHealthy: false,
            responseTime,
            error: `Health check failed: ${error.message}`,
          };
        }

        return {
          isHealthy: true,
          responseTime,
        };
      } catch (error) {
        return {
          isHealthy: false,
          responseTime: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  };
}

// Singleton service
let supabaseVectorStoreService: SupabaseVectorStoreService | null = null;

export async function getSupabaseVectorStoreService(): Promise<SupabaseVectorStoreService> {
  if (!supabaseVectorStoreService) {
    supabaseVectorStoreService = createSupabaseVectorStoreService();
  }
  return supabaseVectorStoreService;
}