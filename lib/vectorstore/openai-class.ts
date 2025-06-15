/**
 * OpenAI Vector Store class for DI container
 */

import { BaseVectorStoreService } from './core/base-service';
import {
  getOpenAIVectorStoreService,
  type OpenAIVectorStoreService,
} from './openai';

export class OpenAIVectorStore extends BaseVectorStoreService {
  private service: Promise<OpenAIVectorStoreService>;

  constructor() {
    super('openai-vector-store');
    this.service = getOpenAIVectorStoreService();
  }

  async search(query: string, options?: any) {
    const service = await this.service;
    const response = await this.withRetry(
      () => service.searchFiles({ query, ...options }),
      'search',
    );
    return response.results || [];
  }

  protected async searchImplementation(request: any): Promise<any[]> {
    const service = await this.service;
    const response = await service.searchFiles(request);
    return response.results || [];
  }

  protected async performHealthCheck(): Promise<void> {
    const service = await this.service;
    const result = await service.healthCheck();
    if (!result.isHealthy) {
      throw new Error(result.error || 'OpenAI service unhealthy');
    }
  }

  async upload(documents: any[]) {
    const service = await this.service;
    return this.withRetry(() => Promise.all(documents.map(doc => service.uploadFile(doc))), 'upload');
  }

  async delete(ids: string[]) {
    const service = await this.service;
    return this.withRetry(() => Promise.all(ids.map(id => service.deleteFile(id))), 'delete');
  }

  async healthCheck() {
    const service = await this.service;
    const result = await this.withRetry(() => service.healthCheck(), 'healthCheck');
    return {
      message: result.isHealthy ? 'OpenAI service is healthy' : (result.error || 'Service unhealthy'),
      isHealthy: result.isHealthy,
      responseTime: 0,
      lastChecked: new Date(),
    };
  }

  async getStats() {
    const service = await this.service;
    const files = await this.withRetry(() => service.listFiles(), 'getStats');
    return {
      documentsCount: files.length,
      lastUpdated: new Date(),
      isEnabled: service.isEnabled,
    };
  }
}
