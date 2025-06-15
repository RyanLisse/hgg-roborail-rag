/**
 * Fault-Tolerant Neon Vector Store Service
 * Replaces 471 lines of duplicated code with a simple wrapper
 */

import 'server-only';

import {
  type NeonVectorStoreService,
  createNeonVectorStoreService,
} from '../neon';
import {
  createServiceSpecificWrapper,
  type GenericFaultTolerantService,
} from './generic-wrapper';

/**
 * Fault-tolerant Neon service using the generic wrapper
 */
export class FaultTolerantNeonVectorStoreService {
  private wrapper: GenericFaultTolerantService<NeonVectorStoreService>;

  constructor(baseService?: NeonVectorStoreService) {
    const service = baseService || createNeonVectorStoreService();
    this.wrapper = createServiceSpecificWrapper(service, 'neon');
  }

  // Expose wrapped methods with proper typing
  search = this.wrapper.wrapMethod('search', {
    operationName: 'neon_search',
    fallbackValue: [],
  });

  upload = this.wrapper.wrapMethod('upload', {
    operationName: 'neon_upload',
  });

  delete = this.wrapper.wrapMethod('delete', {
    operationName: 'neon_delete',
  });

  healthCheck = this.wrapper.wrapMethod('healthCheck', {
    operationName: 'neon_health',
    fallbackValue: { status: 'unhealthy', timestamp: Date.now() },
  });

  getStats = this.wrapper.wrapMethod('getStats', {
    operationName: 'neon_stats',
    fallbackValue: { documentsCount: 0, lastUpdated: new Date() },
  });

  // Utility methods
  getMetrics = () => this.wrapper.getMetrics();
  reset = () => this.wrapper.reset();
  getConfig = () => this.wrapper.getConfig();
  getBaseService = () => this.wrapper.getBaseService();
}

/**
 * Factory function for creating fault-tolerant Neon services
 */
export function createFaultTolerantNeonService(
  baseService?: NeonVectorStoreService,
): FaultTolerantNeonVectorStoreService {
  return new FaultTolerantNeonVectorStoreService(baseService);
}
