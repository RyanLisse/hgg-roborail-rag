import { embed } from 'ai';
import { sql } from 'drizzle-orm';
import { getEmbeddingModelInstance } from '../ai/providers';
import { getDb } from '../db/queries';
import { embedding, document as documentTable } from '../db/schema';
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
  ): Promise<void> {
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
    });

    const embeddingValues = await Promise.all(embeddingPromises);

    // Store all embeddings in Supabase
    await database.insert(embedding).values(embeddingValues);
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
    const { embedding: queryEmbedding } = await embed({
      model: this.embeddingModel,
      value: query,
    });

    // Perform vector similarity search
    const results = await database.execute(sql`
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
   * Delete all embeddings for a document
   */
  async deleteDocument(documentId: string): Promise<void> {
    const database = getDb();
    if (!database) {
      throw new Error('Database not available');
    }

    await database
      .delete(embedding)
      .where(sql`${embedding.documentId} = ${documentId}`);
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
  }
}

// Export singleton instance
export const supabaseRAG = new SupabaseRAGService();
