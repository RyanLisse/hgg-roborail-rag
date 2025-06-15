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

  constructor(stores?: any[]) {
    super('unified-vector-store');
    this.service = getUnifiedVectorStoreService();
  }

  async search(query: string, options?: any) {
    const service = await this.service;
    return this.withErrorHandling(
      () => service.search({ query, ...options }),
      'search',
    );
  }

  async upload(documents: any[]) {
    const service = await this.service;
    return this.withErrorHandling(() => service.upload(documents), 'upload');
  }

  async delete(ids: string[]) {
    const service = await this.service;
    return this.withErrorHandling(() => service.delete(ids), 'delete');
  }

  async healthCheck() {
    const service = await this.service;
    return this.withErrorHandling(() => service.healthCheck(), 'healthCheck');
  }

  async getStats() {
    const service = await this.service;
    return this.withErrorHandling(() => service.getStats(), 'getStats');
  }
}
