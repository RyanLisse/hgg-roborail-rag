/**
 * Neon Vector Store class for DI container
 */

import { BaseVectorStoreService } from './core/base-service';
import { getNeonVectorStoreService, type NeonVectorStoreService } from './neon';

export class NeonVectorStore extends BaseVectorStoreService {
  private service: Promise<NeonVectorStoreService>;

  constructor() {
    super('neon-vector-store');
    this.service = getNeonVectorStoreService();
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
    // Neon service doesn't have health check method, so just check if enabled
    const service = await this.service;
    if (!service.isEnabled) {
      throw new Error('Neon service is disabled');
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
    return this.withRetry(
      async () => ({
        message: service.isEnabled
          ? 'Neon service is healthy'
          : 'Neon service is disabled',
        isHealthy: service.isEnabled,
        responseTime: 0,
        lastChecked: new Date(),
      }),
      'healthCheck',
    );
  }

  async getStats() {
    const service = await this.service;
    return this.withRetry(
      async () => ({
        documentsCount: 0, // Would need to query DB
        lastUpdated: new Date(),
        isEnabled: service.isEnabled,
      }),
      'getStats',
    );
  }
}
