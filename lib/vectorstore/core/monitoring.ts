import type { ServiceMetrics, VectorStoreService } from './types';

/**
 * Performance monitoring state
 */
const metrics: Map<string, ServiceMetrics[]> = new Map();

/**
 * Wrap a method with performance monitoring
 */
export function wrapMethodWithMonitoring<T extends any[], R>(
  serviceName: string,
  methodName: string,
  fn: (...args: T) => Promise<R>,
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    const startTime = Date.now();
    let success = false;
    let _error: Error | undefined;

    try {
      const result = await fn(...args);
      success = true;
      return result;
    } catch (err) {
      _error = err as Error;
      throw err;
    } finally {
      const duration = Date.now() - startTime;

      const metric: ServiceMetrics = {
        operationName: methodName,
        success,
        duration,
        timestamp: new Date(),
        serviceName,
      };

      recordMetric(serviceName, metric);

      // Log performance if it's unusually slow
      if (duration > 5000) {
      }
    }
  };
}

/**
 * Create a monitored version of a service
 */
export function wrapServiceWithMonitoring<T extends VectorStoreService>(
  service: T,
  monitoredMethods: (keyof T)[] = ['search', 'healthCheck'],
): T {
  const wrappedService = { ...service };

  for (const methodName of monitoredMethods) {
    const originalMethod = service[methodName];
    if (typeof originalMethod === 'function') {
      (wrappedService as any)[methodName] = wrapMethodWithMonitoring(
        service.serviceName,
        String(methodName),
        originalMethod.bind(service),
      );
    }
  }

  return wrappedService;
}

/**
 * Record a metric
 */
function recordMetric(serviceName: string, metric: ServiceMetrics): void {
  if (!metrics.has(serviceName)) {
    metrics.set(serviceName, []);
  }

  const serviceMetrics = metrics.get(serviceName);
  if (!serviceMetrics) { return; }
  serviceMetrics.push(metric);

  // Keep only last 1000 metrics per service
  if (serviceMetrics.length > 1000) {
    metrics.set(serviceName, serviceMetrics.slice(-1000));
  }
}

/**
 * Get metrics for a specific service
 */
export function getServiceMetrics(serviceName: string): ServiceMetrics[] {
  return metrics.get(serviceName) || [];
}

/**
 * Get metrics for all services
 */
export function getAllMetrics(): Record<string, ServiceMetrics[]> {
  const result: Record<string, ServiceMetrics[]> = {};
  for (const [serviceName, serviceMetrics] of metrics.entries()) {
    result[serviceName] = [...serviceMetrics];
  }
  return result;
}

/**
 * Clear metrics for a service or all services
 */
export function clearMetrics(serviceName?: string): void {
  if (serviceName) {
    metrics.delete(serviceName);
  } else {
    metrics.clear();
  }
}

/**
 * Get performance summary for a service
 */
export function getPerformanceSummary(
  serviceName: string,
  timeWindow?: number,
): {
  totalRequests: number;
  successRate: number;
  averageResponseTime: number;
  errorRate: number;
  slowestOperation: ServiceMetrics | null;
  fastestOperation: ServiceMetrics | null;
} {
  const serviceMetrics = getServiceMetrics(serviceName);

  let filteredMetrics = serviceMetrics;
  if (timeWindow) {
    const cutoff = Date.now() - timeWindow;
    filteredMetrics = serviceMetrics.filter(
      (m) => m.timestamp.getTime() > cutoff,
    );
  }

  if (filteredMetrics.length === 0) {
    return {
      totalRequests: 0,
      successRate: 0,
      averageResponseTime: 0,
      errorRate: 0,
      slowestOperation: null,
      fastestOperation: null,
    };
  }

  const successful = filteredMetrics.filter((m) => m.success);
  const totalRequests = filteredMetrics.length;
  const successRate = (successful.length / totalRequests) * 100;
  const errorRate = ((totalRequests - successful.length) / totalRequests) * 100;

  const averageResponseTime =
    filteredMetrics.reduce((sum, m) => sum + m.duration, 0) / totalRequests;

  const sortedByDuration = [...filteredMetrics].sort(
    (a, b) => a.duration - b.duration,
  );
  const fastestOperation = sortedByDuration[0] || null;
  const slowestOperation =
    sortedByDuration.at(-1) || null;

  return {
    totalRequests,
    successRate,
    averageResponseTime,
    errorRate,
    slowestOperation,
    fastestOperation,
  };
}

/**
 * Log performance summary
 */
export function logPerformanceSummary(
  serviceName: string,
  timeWindow?: number,
): void {
  const summary = getPerformanceSummary(serviceName, timeWindow);

  if (summary.fastestOperation) {
  }

  if (summary.slowestOperation) {
  }
}

// Re-export functions for backward compatibility
export const PerformanceMonitor = {
  wrapMethod: wrapMethodWithMonitoring,
  wrapService: wrapServiceWithMonitoring,
  getServiceMetrics,
  getAllMetrics,
  clearMetrics,
  getPerformanceSummary,
  logPerformanceSummary,
};
