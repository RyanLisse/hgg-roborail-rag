/**
 * Supabase Vector Store class for DI container
 */

import { BaseVectorStoreService } from './core/base-service';
import { getSupabaseVectorStoreService, type SupabaseVectorStoreService } from './supabase';

export class SupabaseVectorStore extends BaseVectorStoreService {
  private service: Promise<SupabaseVectorStoreService>;

  constructor() {
    super('supabase-vector-store');
    this.service = getSupabaseVectorStoreService();
  }

  async search(query: string, options?: any) {
    const service = await this.service;
    return this.withRetry(
      () => service.searchSimilar({ query, ...options }),
      'search',
    );
  }

  protected async searchImplementation(request: any): Promise<any[]> {
    const service = await this.service;
    const results = await service.searchSimilar(request);
    return results.map((r) => r.document);
  }

  async upload(documents: any[]) {
    const service = await this.service;
    return this.withRetry(() => service.addDocuments(documents), 'upload');
  }

  protected async performHealthCheck(): Promise<void> {
    const service = await this.service;
    const health = await service.healthCheck();
    if (!health.isHealthy) {
      throw new Error(health.error || 'Supabase service is unhealthy');
    }
  }

  async delete(ids: string[]) {
    const service = await this.service;
    return this.withRetry(
      () => Promise.all(ids.map((id) => service.deleteDocument(id))),
      'delete',
    );
  }

  async healthCheck() {
    const service = await this.service;
    return this.withRetry(async () => {
      const health = await service.healthCheck();
      return {
        message: health.isHealthy ? 'Supabase service is healthy' : 'Supabase service is unhealthy',
        isHealthy: health.isHealthy,
        responseTime: health.responseTime || 0,
        lastChecked: new Date(),
      };
    }, 'healthCheck');
  }

  async getStats() {
    const service = await this.service;
    return this.withRetry(async () => {
      const stats = await service.getStats();
      return {
        documentsCount: stats.totalDocuments,
        lastUpdated: new Date(),
      };
    }, 'getStats');
  }
}