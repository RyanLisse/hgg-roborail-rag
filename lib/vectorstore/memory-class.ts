/**
 * Memory Vector Store class for DI container
 */

import { BaseVectorStoreService } from "./core/base-service";

export class MemoryVectorStore extends BaseVectorStoreService {
  private documents: Map<string, any> = new Map();

  constructor() {
    super("memory-vector-store");
  }

  protected async searchImplementation(request: any): Promise<any[]> {
    const { query, maxResults = 10 } = request;
    return Array.from(this.documents.values())
      .filter((doc) => doc.content.toLowerCase().includes(query.toLowerCase()))
      .slice(0, maxResults);
  }

  protected async performHealthCheck(): Promise<void> {
    // Memory store is always healthy
  }

  async search(query: string, options: any = {}) {
    return this.withRetry(async () => {
      const { maxResults = 10, threshold = 0.3 } = options;

      // Simple keyword-based search for memory store
      const results = Array.from(this.documents.values())
        .filter((doc) =>
          doc.content.toLowerCase().includes(query.toLowerCase()),
        )
        .slice(0, maxResults)
        .map((doc) => ({
          id: doc.id,
          content: doc.content,
          metadata: doc.metadata,
          similarity: 0.8, // Mock similarity score
          source: "memory" as const,
        }));

      return results;
    }, "search");
  }

  async upload(documents: any[]) {
    return this.withRetry(async () => {
      const uploadedIds: string[] = [];

      for (const doc of documents) {
        const id = doc.id || crypto.randomUUID();
        this.documents.set(id, {
          id,
          content: doc.content,
          metadata: doc.metadata || {},
          createdAt: new Date(),
        });
        uploadedIds.push(id);
      }

      return {
        success: true,
        uploadedIds,
        count: uploadedIds.length,
      };
    }, "upload");
  }

  async delete(ids: string[]) {
    return this.withRetry(async () => {
      const deletedIds: string[] = [];

      for (const id of ids) {
        if (this.documents.has(id)) {
          this.documents.delete(id);
          deletedIds.push(id);
        }
      }

      return {
        success: true,
        deletedIds,
        count: deletedIds.length,
      };
    }, "delete");
  }

  async healthCheck() {
    return this.withRetry(
      async () => ({
        message: "Memory store is healthy",
        isHealthy: true,
        responseTime: 0,
        lastChecked: new Date(),
      }),
      "healthCheck",
    );
  }

  async getStats() {
    return this.withRetry(
      async () => ({
        totalDocuments: this.documents.size,
        averageDocumentSize:
          this.documents.size > 0
            ? Array.from(this.documents.values()).reduce(
                (sum, doc) => sum + doc.content.length,
                0,
              ) / this.documents.size
            : 0,
        oldestDocument:
          this.documents.size > 0
            ? Array.from(this.documents.values()).reduce((oldest, doc) =>
                doc.createdAt < oldest.createdAt ? doc : oldest,
              ).createdAt
            : null,
      }),
      "getStats",
    );
  }
}
