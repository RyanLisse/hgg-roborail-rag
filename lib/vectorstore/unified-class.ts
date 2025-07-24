/**
 * Simple UnifiedVectorStore class for DI container
 * Wrapper around the existing service-based implementation
 */

import { BaseVectorStoreService } from './core/base-service';
import {
  getUnifiedVectorStoreService,
  type UnifiedVectorStoreService,
} from './unified';

export class UnifiedVectorStore extends BaseVectorStoreService {
  private service: Promise<UnifiedVectorStoreService>;

  constructor(_stores?: any[]) {
    super('unified-vector-store');
    this.service = getUnifiedVectorStoreService();
  }

  async search(query: string, options?: any) {
    const service = await this.service;
    return this.withRetry(
      () => service.searchAcrossSources({ query, ...options }),
      'search',
    );
  }

  protected async searchImplementation(request: any): Promise<any[]> {
    const service = await this.service;
    return service.searchAcrossSources(request);
  }

  protected async performHealthCheck(): Promise<void> {
    // Unified service doesn't have direct health check, so check available sources
    const service = await this.service;
    const sources = await service.getAvailableSources();
    if (sources.length === 0) {
      throw new Error('No vector store sources available');
    }
  }

  async upload(documents: any[]) {
    const service = await this.service;
    return this.withRetry(
      () => Promise.all(documents.map((doc) => service.addDocument(doc))),
      'upload',
    );
  }

  async delete(ids: string[]) {
    const service = await this.service;
    return this.withRetry(
      () => Promise.all(ids.map((id) => service.deleteDocument(id, 'unified'))),
      'delete',
    );
  }

  async healthCheck() {
    const service = await this.service;
    return this.withRetry(async () => {
      const sources = await service.getAvailableSources();
      return {
        message:
          sources.length > 0
            ? 'Unified service is healthy'
            : 'No sources available',
        isHealthy: sources.length > 0,
        responseTime: 0,
        lastChecked: new Date(),
      };
    }, 'healthCheck');
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
    }, 'getStats');
  }
}
