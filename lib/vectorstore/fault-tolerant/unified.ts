/**
 * Fault-Tolerant Unified Vector Store Service
 * Replaces 756 lines of duplicated code with a simple wrapper
 */

import 'server-only';

import {
  type UnifiedVectorStoreService,
  createUnifiedVectorStoreService,
} from '../unified';
import {
  createServiceSpecificWrapper,
  type GenericFaultTolerantService,
} from './generic-wrapper';

/**
 * Fault-tolerant Unified service using the generic wrapper
 */
export class FaultTolerantUnifiedVectorStoreService {
  private wrapper: GenericFaultTolerantService<UnifiedVectorStoreService>;

  constructor(baseService?: UnifiedVectorStoreService) {
    const service = baseService || createUnifiedVectorStoreService();
    this.wrapper = createServiceSpecificWrapper(service, 'unified');
  }

  // Expose wrapped methods with proper typing
  search = this.wrapper.wrapMethod('search', {
    operationName: 'unified_search',
    fallbackValue: [],
  });

  searchEnhanced = this.wrapper.wrapMethod('searchEnhanced', {
    operationName: 'unified_search_enhanced',
    fallbackValue: {
      results: [],
      totalResults: 0,
      processingTime: 0,
      query: '',
      rerankingApplied: false,
      diversificationApplied: false,
      hybridSearchUsed: false,
      scoringStrategy: 'fallback',
      performance: { searchTime: 0, totalTime: 0 },
    },
  });

  upload = this.wrapper.wrapMethod('upload', {
    operationName: 'unified_upload',
  });

  delete = this.wrapper.wrapMethod('delete', {
    operationName: 'unified_delete',
  });

  healthCheck = this.wrapper.wrapMethod('healthCheck', {
    operationName: 'unified_health',
    fallbackValue: { status: 'unhealthy', timestamp: Date.now() },
  });

  getStats = this.wrapper.wrapMethod('getStats', {
    operationName: 'unified_stats',
    fallbackValue: { documentsCount: 0, lastUpdated: new Date() },
  });

  // Additional unified-specific methods
  rerankResults = this.wrapper.wrapMethod('rerankResults', {
    operationName: 'unified_rerank',
    fallbackValue: {
      scoredDocuments: [],
      diversificationApplied: false,
      strategy: 'fallback',
    },
  });

  hybridSearch = this.wrapper.wrapMethod('hybridSearch', {
    operationName: 'unified_hybrid_search',
    fallbackValue: [],
  });

  recordUserFeedback = this.wrapper.wrapMethod('recordUserFeedback', {
    operationName: 'unified_record_feedback',
  });

  getUserPreferences = this.wrapper.wrapMethod('getUserPreferences', {
    operationName: 'unified_get_preferences',
    fallbackValue: {},
  });

  updateUserPreferences = this.wrapper.wrapMethod('updateUserPreferences', {
    operationName: 'unified_update_preferences',
  });

  // Utility methods
  getMetrics = () => this.wrapper.getMetrics();
  reset = () => this.wrapper.reset();
  getConfig = () => this.wrapper.getConfig();
  getBaseService = () => this.wrapper.getBaseService();
}

/**
 * Factory function for creating fault-tolerant Unified services
 */
export function createFaultTolerantUnifiedService(
  baseService?: UnifiedVectorStoreService,
): FaultTolerantUnifiedVectorStoreService {
  return new FaultTolerantUnifiedVectorStoreService(baseService);
}
