/**
 * Simple UnifiedVectorStore class for DI container
 * Wrapper around the existing service-based implementation
 */

import { BaseVectorStoreService } from "./core/base-service";
import {
  getUnifiedVectorStoreService,
  type UnifiedVectorStoreService,
} from "./unified";
import type { QueryContext, PromptConfig } from "./prompt-optimization";

type VectorStoreSource = "openai" | "neon" | "memory" | "unified";

export class UnifiedVectorStore extends BaseVectorStoreService {
  private readonly service: Promise<UnifiedVectorStoreService>;

  private constructor(service: Promise<UnifiedVectorStoreService>) {
    super("unified-vector-store");
    this.service = service;
  }

  static create(_stores?: unknown[]): UnifiedVectorStore {
    const service = getUnifiedVectorStoreService();
    return new UnifiedVectorStore(service);
  }

  async search(query: string, options?: Record<string, unknown>) {
    const service = await this.service;
    const searchRequest = {
      query,
      sources: (options?.sources as VectorStoreSource[]) || [
        "openai",
        "neon",
        "memory",
      ],
      maxResults: (options?.maxResults as number) || 10,
      threshold: (options?.threshold as number) || 0.3,
      optimizePrompts: (options?.optimizePrompts as boolean) || false,
      metadata: options?.metadata as Record<string, unknown> | undefined,
      queryContext: options?.queryContext as QueryContext | undefined,
      promptConfig: options?.promptConfig as PromptConfig | undefined,
    };
    return this.withRetry(
      () => service.searchAcrossSources(searchRequest),
      "search",
    );
  }

  protected async searchImplementation(request: unknown): Promise<unknown[]> {
    const service = await this.service;
    const requestObj = request as Record<string, unknown>;
    const searchRequest =
      typeof request === "object" && request !== null
        ? {
            query: String(requestObj.query || ""),
            sources: (requestObj.sources as VectorStoreSource[]) || [
              "openai",
              "neon",
              "memory",
            ],
            maxResults: Number(requestObj.maxResults) || 10,
            threshold: Number(requestObj.threshold) || 0.3,
            optimizePrompts: Boolean(requestObj.optimizePrompts) || false,
            metadata: requestObj.metadata as
              | Record<string, unknown>
              | undefined,
            queryContext: requestObj.queryContext as QueryContext | undefined,
            promptConfig: requestObj.promptConfig as PromptConfig | undefined,
          }
        : {
            query: String(request),
            sources: ["openai", "neon", "memory"] as VectorStoreSource[],
            maxResults: 10,
            threshold: 0.3,
            optimizePrompts: false,
          };
    return service.searchAcrossSources(searchRequest);
  }

  protected async performHealthCheck(): Promise<void> {
    // Unified service doesn't have direct health check, so check available sources
    const service = await this.service;
    const sources = await service.getAvailableSources();
    if (sources.length === 0) {
      throw new Error("No vector store sources available");
    }
  }

  async upload(documents: unknown[]) {
    const service = await this.service;
    return this.withRetry(
      () =>
        Promise.all(
          documents.map((doc) => {
            const docObj = doc as Record<string, unknown>;
            const uploadRequest = {
              content: String(docObj.content || ""),
              targetSources: (docObj.targetSources as VectorStoreSource[]) || [
                "openai",
                "neon",
                "memory",
              ],
              metadata: docObj.metadata as Record<string, unknown> | undefined,
              file: docObj.file as File | undefined,
            };
            return service.addDocument(uploadRequest);
          }),
        ),
      "upload",
    );
  }

  async delete(ids: string[]) {
    const service = await this.service;
    return this.withRetry(
      () => Promise.all(ids.map((id) => service.deleteDocument(id, "unified"))),
      "delete",
    );
  }

  async healthCheck() {
    const service = await this.service;
    return this.withRetry(async () => {
      const sources = await service.getAvailableSources();
      return {
        message:
          sources.length > 0
            ? "Unified service is healthy"
            : "No sources available",
        isHealthy: sources.length > 0,
        responseTime: 0,
        lastChecked: new Date(),
      };
    }, "healthCheck");
  }

  async getStats() {
    const service = await this.service;
    return this.withRetry(async () => {
      const sourceStats = await service.getSourceStats();
      return {
        documentsCount: Object.values(sourceStats).reduce(
          (sum, stat) => sum + (stat.count || 0),
          0,
        ),
        lastUpdated: new Date(),
        sources: sourceStats,
      };
    }, "getStats");
  }
}
