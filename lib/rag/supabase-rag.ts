import { embed } from 'ai';
import { sql } from 'drizzle-orm';
import { getEmbeddingModelInstance } from '../ai/providers';
import { getDb } from '../db/queries';
import { document as documentTable, embedding } from '../db/schema';
import type { Document as ChunkingDocument } from './chunking';
import { createChunkingService } from './chunking';

export interface SupabaseRAGDocument {
  id: string;
  title: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface EmbeddingResult {
  id: string;
  content: string;
  similarity: number;
  metadata: Record<string, unknown>;
  documentId: string;
}

export class SupabaseRAGService {
  private readonly chunkingService = createChunkingService();
  private readonly embeddingModel =
    getEmbeddingModelInstance('cohere-embed-v4.0');

  /**
   * Upload a document and generate embeddings
   */
  async uploadDocument(
    doc: SupabaseRAGDocument,
    userId: string,
  ): Promise<{ id: string; title: string }> {
    // Validate input
    if (!doc.content || doc.content.trim() === '') {
      throw new Error('Document content cannot be empty');
    }

    const database = getDb();
    if (!database) {
      throw new Error('Database not available');
    }

    // First, save the document
    const [savedDoc] = await database
      .insert(documentTable)
      .values({
        id: doc.id,
        title: doc.title,
        content: doc.content,
        kind: 'text',
        userId,
        createdAt: new Date(),
      })
      .returning();

    // Chunk the document
    const chunkingDoc: ChunkingDocument = {
      id: doc.id,
      content: doc.content,
      type: 'text',
      metadata: {
        title: doc.title,
        ...(doc.metadata || {}),
      },
    };

    const chunkingResult =
      await this.chunkingService.chunkDocument(chunkingDoc);

    // Generate embeddings for each chunk in parallel
    const embeddingPromises = chunkingResult.chunks.map(async (chunk, i) => {
      try {
        // Generate embedding using AI SDK
        const { embedding: embeddingVector } = await embed({
          model: this.embeddingModel,
          value: chunk.content,
        });

        return {
          documentId: savedDoc.id,
          documentCreatedAt: savedDoc.createdAt,
          content: chunk.content,
          embedding: embeddingVector,
          metadata: {
            ...chunk.metadata,
            chunkIndex: i,
            title: doc.title,
          },
        };
      } catch (error) {
        throw new Error('Failed to generate embedding');
      }
    });

    let embeddingValues;
    try {
      embeddingValues = await Promise.all(embeddingPromises);
    } catch (error) {
      throw new Error('Failed to generate embedding');
    }

    // Store all embeddings in Supabase
    try {
      await database.insert(embedding).values(embeddingValues);
    } catch (error) {
      throw new Error('Failed to insert document');
    }

    return { id: savedDoc.id, title: savedDoc.title };
  }

  /**
   * Search for similar content using vector similarity
   */
  async searchSimilar(
    query: string,
    limit = 5,
    similarityThreshold = 0.7,
  ): Promise<EmbeddingResult[]> {
    const database = getDb();
    if (!database) {
      throw new Error('Database not available');
    }

    // Generate embedding for the query
    let queryEmbedding;
    try {
      const result = await embed({
        model: this.embeddingModel,
        value: query,
      });
      queryEmbedding = result.embedding;
    } catch (error) {
      throw new Error('Failed to generate query embedding');
    }

    // Perform vector similarity search
    let results;
    try {
      results = await database.execute(sql`
        SELECT 
          e.id,
          e.content,
          e.metadata,
          e."documentId",
          (1 - (e.embedding <=> ${JSON.stringify(queryEmbedding)}::vector)) as similarity
        FROM "Embedding" e
        WHERE (1 - (e.embedding <=> ${JSON.stringify(queryEmbedding)}::vector)) > ${similarityThreshold}
        ORDER BY e.embedding <=> ${JSON.stringify(queryEmbedding)}::vector
        LIMIT ${limit}
      `);
    } catch (error) {
      throw new Error('Search failed');
    }

    return results.rows.map(
      (row: {
        id: string;
        content: string;
        similarity: string;
        metadata: Record<string, unknown>;
        documentId: string;
      }) => ({
        id: row.id,
        content: row.content,
        similarity: Number.parseFloat(row.similarity),
        metadata: row.metadata || {},
        documentId: row.documentId,
      }),
    );
  }

  /**
   * Generate response with RAG context
   */
  async generateRAGResponse(
    question: string,
    _chatHistory: Array<{ role: string; content: string }> = [],
  ): Promise<{
    response: string;
    sources: EmbeddingResult[];
  }> {
    // Search for relevant context
    const sources = await this.searchSimilar(question, 5);

    if (sources.length === 0) {
      return {
        response:
          "I don't have enough information to answer your question based on the available documents.",
        sources: [],
      };
    }

    // Prepare context from sources
    const context = sources
      .map((source, index) => `[${index + 1}] ${source.content}`)
      .join('\n\n');

    // For now, return the context and sources
    // In a full implementation, you'd use generateText() here with the system prompt
    const response = `Based on the available documents, here's what I found:\n\n${context}`;

    return {
      response,
      sources,
    };
  }

  /**
   * Get document by ID
   */
  async getDocument(documentId: string): Promise<any | null> {
    const database = getDb();
    if (!database) {
      throw new Error('Database not available');
    }

    try {
      const [doc] = await database
        .select()
        .from(documentTable)
        .where(sql`${documentTable.id} = ${documentId}`);
      
      return doc || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * List documents with pagination
   */
  async listDocuments(limit: number = 10, offset: number = 0): Promise<any[]> {
    const database = getDb();
    if (!database) {
      throw new Error('Database not available');
    }

    try {
      const documents = await database
        .select()
        .from(documentTable)
        .orderBy(sql`${documentTable.createdAt} DESC`)
        .limit(limit)
        .offset(offset);
      
      return documents;
    } catch (error) {
      return [];
    }
  }

  /**
   * Delete all embeddings for a document
   */
  async deleteDocument(documentId: string): Promise<boolean> {
    const database = getDb();
    if (!database) {
      throw new Error('Database not available');
    }

    try {
      await database
        .delete(embedding)
        .where(sql`${embedding.documentId} = ${documentId}`);
      
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get document statistics
   */
  async getStats(): Promise<{
    totalDocuments: number;
    totalEmbeddings: number;
  }> {
    const database = getDb();
    if (!database) {
      throw new Error('Database not available');
    }

    try {
      const [docCount] = await database
        .select({ count: sql`count(*)` })
        .from(documentTable);

      const [embeddingCount] = await database
        .select({ count: sql`count(*)` })
        .from(embedding);

      return {
        totalDocuments: Number(docCount.count),
        totalEmbeddings: Number(embeddingCount.count),
      };
    } catch (error) {
      throw new Error('Failed to get statistics');
    }
  }

  /**
   * Health check for the RAG service
   */
  async healthCheck(): Promise<{
    isHealthy: boolean;
    responseTime: number;
    error?: string;
  }> {
    const startTime = performance.now();
    const database = getDb();
    
    if (!database) {
      return {
        isHealthy: false,
        responseTime: performance.now() - startTime,
        error: 'Database not available',
      };
    }

    try {
      await database
        .select({ count: sql`count(*)` })
        .from(documentTable)
        .limit(1);

      return {
        isHealthy: true,
        responseTime: performance.now() - startTime,
      };
    } catch (error) {
      return {
        isHealthy: false,
        responseTime: performance.now() - startTime,
        error: `Health check failed: ${error}`,
      };
    }
  }

  /**
   * Upload multiple documents in batch
   */
  async uploadDocumentsBatch(
    docs: SupabaseRAGDocument[],
    userId: string,
  ): Promise<{ id: string; title: string }[]> {
    const database = getDb();
    if (!database) {
      throw new Error('Database not available');
    }

    try {
      const results = await Promise.all(
        docs.map(doc => this.uploadDocument(doc, userId))
      );
      return results;
    } catch (error) {
      throw new Error('Batch upload failed');
    }
  }
}

// Export singleton instance
export const supabaseRAG = new SupabaseRAGService();
