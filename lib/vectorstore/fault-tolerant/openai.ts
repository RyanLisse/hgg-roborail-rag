/**
 * Fault-Tolerant OpenAI Vector Store Service
 * Replaces 444 lines of duplicated code with a simple wrapper
 */

import 'server-only';

import {
  type OpenAIVectorStoreService,
  createOpenAIVectorStoreService,
} from '../openai';
import {
  createServiceSpecificWrapper,
  type GenericFaultTolerantService,
} from './generic-wrapper';

/**
 * Fault-tolerant OpenAI service using the generic wrapper
 */
export class FaultTolerantOpenAIVectorStoreService {
  private wrapper: GenericFaultTolerantService<OpenAIVectorStoreService>;

  constructor(baseService?: OpenAIVectorStoreService) {
    const service = baseService || createOpenAIVectorStoreService();
    this.wrapper = createServiceSpecificWrapper(service, 'openai');
  }

  // Expose wrapped methods with proper typing
  search = this.wrapper.wrapMethod('search', {
    operationName: 'openai_search',
    fallbackValue: [],
  });

  upload = this.wrapper.wrapMethod('upload', {
    operationName: 'openai_upload',
  });

  delete = this.wrapper.wrapMethod('delete', {
    operationName: 'openai_delete',
  });

  healthCheck = this.wrapper.wrapMethod('healthCheck', {
    operationName: 'openai_health',
    fallbackValue: { status: 'unhealthy', timestamp: Date.now() },
  });

  getStats = this.wrapper.wrapMethod('getStats', {
    operationName: 'openai_stats',
    fallbackValue: { documentsCount: 0, lastUpdated: new Date() },
  });

  // Utility methods
  getMetrics = () => this.wrapper.getMetrics();
  reset = () => this.wrapper.reset();
  getConfig = () => this.wrapper.getConfig();
  getBaseService = () => this.wrapper.getBaseService();
}

/**
 * Factory function for creating fault-tolerant OpenAI services
 */
export function createFaultTolerantOpenAIService(
  baseService?: OpenAIVectorStoreService,
): FaultTolerantOpenAIVectorStoreService {
  return new FaultTolerantOpenAIVectorStoreService(baseService);
}
