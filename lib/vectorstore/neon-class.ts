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
    return this.withErrorHandling(
      () => service.search({ query, ...options }),
      'search'
    );
  }

  async upload(documents: any[]) {
    const service = await this.service;
    return this.withErrorHandling(
      () => service.upload(documents),
      'upload'
    );
  }

  async delete(ids: string[]) {
    const service = await this.service;
    return this.withErrorHandling(
      () => service.delete(ids),
      'delete'
    );
  }

  async healthCheck() {
    const service = await this.service;
    return this.withErrorHandling(
      () => service.healthCheck(),
      'healthCheck'
    );
  }

  async getStats() {
    const service = await this.service;
    return this.withErrorHandling(
      () => service.getStats(),
      'getStats'
    );
  }
}