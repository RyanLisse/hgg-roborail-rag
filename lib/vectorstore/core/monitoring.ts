import type { ServiceMetrics, VectorStoreService } from './types';

/**
 * Performance monitoring decorator for vector store operations
 */
export class PerformanceMonitor {
  private static metrics: Map<string, ServiceMetrics[]> = new Map();

  /**
   * Wrap a method with performance monitoring
   */
  static wrapMethod<T extends any[], R>(
    serviceName: string,
    methodName: string,
    fn: (...args: T) => Promise<R>
  ): (...args: T) => Promise<R> {
    return async (...args: T): Promise<R> => {
      const startTime = Date.now();
      let success = false;
      let error: Error | undefined;

      try {
        const result = await fn(...args);
        success = true;
        return result;
      } catch (err) {
        error = err as Error;
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

        this.recordMetric(serviceName, metric);
        
        // Log performance if it's unusually slow
        if (duration > 5000) {
          console.warn(
            `⚠️  Slow ${serviceName}.${methodName}: ${duration}ms`,
            { args: args.length > 0 ? args[0] : undefined, error: error?.message }
          );
        }
      }
    };
  }

  /**
   * Create a monitored version of a service
   */
  static wrapService<T extends VectorStoreService>(
    service: T,
    monitoredMethods: (keyof T)[] = ['search', 'healthCheck']
  ): T {
    const wrappedService = { ...service };

    for (const methodName of monitoredMethods) {
      const originalMethod = service[methodName];
      if (typeof originalMethod === 'function') {
        (wrappedService as any)[methodName] = this.wrapMethod(
          service.serviceName,
          String(methodName),
          originalMethod.bind(service)
        );
      }
    }

    return wrappedService;
  }

  /**
   * Record a metric
   */
  private static recordMetric(serviceName: string, metric: ServiceMetrics): void {
    if (!this.metrics.has(serviceName)) {
      this.metrics.set(serviceName, []);
    }

    const serviceMetrics = this.metrics.get(serviceName)!;
    serviceMetrics.push(metric);

    // Keep only last 1000 metrics per service
    if (serviceMetrics.length > 1000) {
      this.metrics.set(serviceName, serviceMetrics.slice(-1000));
    }
  }

  /**
   * Get metrics for a specific service
   */
  static getServiceMetrics(serviceName: string): ServiceMetrics[] {
    return this.metrics.get(serviceName) || [];
  }

  /**
   * Get metrics for all services
   */
  static getAllMetrics(): Record<string, ServiceMetrics[]> {
    const result: Record<string, ServiceMetrics[]> = {};
    for (const [serviceName, metrics] of this.metrics.entries()) {
      result[serviceName] = [...metrics];
    }
    return result;
  }

  /**
   * Clear metrics for a service or all services
   */
  static clearMetrics(serviceName?: string): void {
    if (serviceName) {
      this.metrics.delete(serviceName);
    } else {
      this.metrics.clear();
    }
  }

  /**
   * Get performance summary for a service
   */
  static getPerformanceSummary(serviceName: string, timeWindow?: number): {
    totalRequests: number;
    successRate: number;
    averageResponseTime: number;
    errorRate: number;
    slowestOperation: ServiceMetrics | null;
    fastestOperation: ServiceMetrics | null;
  } {
    const metrics = this.getServiceMetrics(serviceName);
    
    let filteredMetrics = metrics;
    if (timeWindow) {
      const cutoff = Date.now() - timeWindow;
      filteredMetrics = metrics.filter(m => m.timestamp.getTime() > cutoff);
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

    const successful = filteredMetrics.filter(m => m.success);
    const totalRequests = filteredMetrics.length;
    const successRate = (successful.length / totalRequests) * 100;
    const errorRate = ((totalRequests - successful.length) / totalRequests) * 100;
    
    const averageResponseTime = 
      filteredMetrics.reduce((sum, m) => sum + m.duration, 0) / totalRequests;

    const sortedByDuration = [...filteredMetrics].sort((a, b) => a.duration - b.duration);
    const fastestOperation = sortedByDuration[0] || null;
    const slowestOperation = sortedByDuration[sortedByDuration.length - 1] || null;

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
  static logPerformanceSummary(serviceName: string, timeWindow?: number): void {
    const summary = this.getPerformanceSummary(serviceName, timeWindow);
    
    console.log(`📊 Performance Summary for ${serviceName}:`);
    console.log(`   Total Requests: ${summary.totalRequests}`);
    console.log(`   Success Rate: ${summary.successRate.toFixed(1)}%`);
    console.log(`   Error Rate: ${summary.errorRate.toFixed(1)}%`);
    console.log(`   Average Response Time: ${summary.averageResponseTime.toFixed(0)}ms`);
    
    if (summary.fastestOperation) {
      console.log(`   Fastest: ${summary.fastestOperation.duration}ms (${summary.fastestOperation.operationName})`);
    }
    
    if (summary.slowestOperation) {
      console.log(`   Slowest: ${summary.slowestOperation.duration}ms (${summary.slowestOperation.operationName})`);
    }
  }
}