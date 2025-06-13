/**
 * OpenAI Vector Store class for DI container
 */

import { BaseVectorStoreService } from './core/base-service';
import { getOpenAIVectorStoreService, type OpenAIVectorStoreService } from './openai';

export class OpenAIVectorStore extends BaseVectorStoreService {
  private service: Promise<OpenAIVectorStoreService>;

  constructor() {
    super('openai-vector-store');
    this.service = getOpenAIVectorStoreService();
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