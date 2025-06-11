import 'server-only';

import { z } from 'zod';
import { embed } from 'ai';
import { getEmbeddingModelInstance } from '../ai/providers';
import { drizzle } from 'drizzle-orm/postgres-js';
import { pgTable, text, vector, timestamp, uuid, json } from 'drizzle-orm/pg-core';
import { desc, gt, sql } from 'drizzle-orm';
import postgres from 'postgres';

// Vector document schema for Neon pgvector
export const vectorDocuments = pgTable('vector_documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  content: text('content').notNull(),
  metadata: json('metadata').$type<Record<string, any>>(),
  embedding: vector('embedding', { dimensions: 1536 }), // OpenAI embeddings are 1536 dimensions
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

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
  updateDocument: (id: string, document: Partial<NeonDocumentInsert>) => Promise<NeonDocument>;
  deleteDocument: (id: string) => Promise<boolean>;
  
  // Search operations
  searchSimilar: (request: NeonSearchRequest) => Promise<NeonSearchResult[]>;
  searchSimilarByEmbedding: (embedding: number[], maxResults?: number, threshold?: number) => Promise<NeonSearchResult[]>;
  
  // Utility methods
  generateEmbedding: (text: string) => Promise<number[]>;
  initializeExtensions: () => Promise<void>;
}

// Create Neon vector store service
export function createNeonVectorStoreService(config?: Partial<NeonVectorStoreConfig>): NeonVectorStoreService {
  const validatedConfig: NeonVectorStoreConfig = {
    connectionString: config?.connectionString || process.env.POSTGRES_URL || '',
    embeddingModel: config?.embeddingModel || 'text-embedding-3-small',
    isEnabled: !!(config?.connectionString || process.env.POSTGRES_URL),
  };

  if (!validatedConfig.isEnabled) {
    console.warn('Neon vector store service is disabled - no connection string provided');
    return {
      db: null as any,
      isEnabled: false,
      embeddingModel: validatedConfig.embeddingModel,
      addDocument: async () => { throw new Error('Neon vector store service is disabled'); },
      addDocuments: async () => { throw new Error('Neon vector store service is disabled'); },
      getDocument: async () => { throw new Error('Neon vector store service is disabled'); },
      updateDocument: async () => { throw new Error('Neon vector store service is disabled'); },
      deleteDocument: async () => { throw new Error('Neon vector store service is disabled'); },
      searchSimilar: async () => { throw new Error('Neon vector store service is disabled'); },
      searchSimilarByEmbedding: async () => { throw new Error('Neon vector store service is disabled'); },
      generateEmbedding: async () => { throw new Error('Neon vector store service is disabled'); },
      initializeExtensions: async () => { throw new Error('Neon vector store service is disabled'); },
    };
  }

  const client = postgres(validatedConfig.connectionString);
  const db = drizzle(client);

  return {
    db,
    isEnabled: true,
    embeddingModel: validatedConfig.embeddingModel,

    async initializeExtensions(): Promise<void> {
      try {
        // Enable pgvector extension
        await db.execute(sql`CREATE EXTENSION IF NOT EXISTS vector;`);
        
        // Create index for faster similarity search
        await db.execute(sql`
          CREATE INDEX IF NOT EXISTS vector_documents_embedding_idx 
          ON vector_documents 
          USING ivfflat (embedding vector_cosine_ops) 
          WITH (lists = 100);
        `);
        
        console.log('Neon pgvector extensions initialized successfully');
      } catch (error) {
        console.error('Failed to initialize Neon pgvector extensions:', error);
        throw error;
      }
    },

    async generateEmbedding(text: string): Promise<number[]> {
      try {
        const { embedding } = await embed({
          model: getEmbeddingModelInstance(validatedConfig.embeddingModel),
          value: text,
        });
        return embedding;
      } catch (error) {
        console.error('Failed to generate embedding:', error);
        throw error;
      }
    },

    async addDocument(document: NeonDocumentInsert): Promise<NeonDocument> {
      const validatedDocument = NeonDocumentInsert.parse(document);
      
      try {
        // Generate embedding if not provided
        const embedding = validatedDocument.embedding || await this.generateEmbedding(validatedDocument.content);
        
        const [insertedDocument] = await db
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
      } catch (error) {
        console.error('Failed to add document to Neon vector store:', error);
        throw error;
      }
    },

    async addDocuments(documents: NeonDocumentInsert[]): Promise<NeonDocument[]> {
      const validatedDocuments = documents.map(doc => NeonDocumentInsert.parse(doc));
      
      try {
        // Generate embeddings for documents that don't have them
        const documentsWithEmbeddings = await Promise.all(
          validatedDocuments.map(async (doc) => ({
            ...doc,
            embedding: doc.embedding || await this.generateEmbedding(doc.content),
          }))
        );

        const insertedDocuments = await db
          .insert(vectorDocuments)
          .values(documentsWithEmbeddings.map(doc => ({
            content: doc.content,
            metadata: doc.metadata || {},
            embedding: doc.embedding as any,
          })))
          .returning();

        return insertedDocuments.map((doc, index) => NeonDocument.parse({
          ...doc,
          embedding: documentsWithEmbeddings[index].embedding,
        }));
      } catch (error) {
        console.error('Failed to add documents to Neon vector store:', error);
        throw error;
      }
    },

    async getDocument(id: string): Promise<NeonDocument | null> {
      try {
        const [document] = await db
          .select()
          .from(vectorDocuments)
          .where(sql`${vectorDocuments.id} = ${id}`)
          .limit(1);

        return document ? NeonDocument.parse(document) : null;
      } catch (error) {
        console.error('Failed to get document from Neon vector store:', error);
        throw error;
      }
    },

    async updateDocument(id: string, document: Partial<NeonDocumentInsert>): Promise<NeonDocument> {
      try {
        const updateData: any = {
          ...document,
          updatedAt: new Date(),
        };

        // Generate new embedding if content changed
        if (document.content && !document.embedding) {
          updateData.embedding = await this.generateEmbedding(document.content);
        }

        const [updatedDocument] = await db
          .update(vectorDocuments)
          .set(updateData)
          .where(sql`${vectorDocuments.id} = ${id}`)
          .returning();

        return NeonDocument.parse(updatedDocument);
      } catch (error) {
        console.error('Failed to update document in Neon vector store:', error);
        throw error;
      }
    },

    async deleteDocument(id: string): Promise<boolean> {
      try {
        const result = await db
          .delete(vectorDocuments)
          .where(sql`${vectorDocuments.id} = ${id}`);

        return true;
      } catch (error) {
        console.error('Failed to delete document from Neon vector store:', error);
        return false;
      }
    },

    async searchSimilar(request: NeonSearchRequest): Promise<NeonSearchResult[]> {
      const validatedRequest = NeonSearchRequest.parse(request);
      
      try {
        // Generate embedding for the query
        const queryEmbedding = await this.generateEmbedding(validatedRequest.query);
        return await this.searchSimilarByEmbedding(
          queryEmbedding, 
          validatedRequest.maxResults, 
          validatedRequest.threshold
        );
      } catch (error) {
        console.error('Failed to search similar documents in Neon vector store:', error);
        throw error;
      }
    },

    async searchSimilarByEmbedding(
      embedding: number[], 
      maxResults = 10, 
      threshold = 0.3
    ): Promise<NeonSearchResult[]> {
      try {
        const similarity = sql<number>`1 - (${vectorDocuments.embedding} <=> ${JSON.stringify(embedding)})`;
        
        const results = await db
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

        return results.map(result => {
          const { similarity, ...document } = result;
          return NeonSearchResult.parse({
            document: NeonDocument.parse(document),
            similarity: similarity || 0,
            distance: 1 - (similarity || 0),
          });
        });
      } catch (error) {
        console.error('Failed to search by embedding in Neon vector store:', error);
        throw error;
      }
    },
  };
}

// Singleton service
let neonVectorStoreService: NeonVectorStoreService | null = null;

export async function getNeonVectorStoreService(): Promise<NeonVectorStoreService> {
  if (!neonVectorStoreService) {
    neonVectorStoreService = createNeonVectorStoreService();
    
    // Initialize extensions on first use
    if (neonVectorStoreService.isEnabled) {
      try {
        await neonVectorStoreService.initializeExtensions();
      } catch (error) {
        console.warn('Failed to initialize Neon pgvector extensions:', error);
      }
    }
  }
  return neonVectorStoreService;
}