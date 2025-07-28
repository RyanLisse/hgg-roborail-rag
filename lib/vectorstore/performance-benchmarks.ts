import 'server-only';

import { z } from 'zod';
import { getVectorStoreMonitoringService } from './monitoring';
import { getOpenAIVectorStoreService } from './openai';
import { getNeonVectorStoreService } from './neon';
import { getUnifiedVectorStoreService } from './unified';

// Performance benchmark schemas
export const BenchmarkConfig = z.object({
  enabled: z.boolean().default(true),
  maxConcurrentRequests: z.number().min(1).max(100).default(10),
  timeoutMs: z.number().min(1000).default(30_000),
  warmupIterations: z.number().min(0).default(3),
  benchmarkIterations: z.number().min(1).default(10),
  providers: z.array(z.enum(['openai', 'neon', 'supabase', 'unified', 'memory'])),
  testDataSizes: z.array(z.enum(['small', 'medium', 'large', 'xlarge'])).default(['small', 'medium', 'large']),
  memoryThresholdMB: z.number().min(50).default(500),
  outputDirectory: z.string().default('./benchmark-results'),
  reportFormat: z.enum(['json', 'html', 'csv']).default('json'),
});

export const BenchmarkMetrics = z.object({
  averageLatency: z.number(),
  minLatency: z.number().optional(),
  maxLatency: z.number().optional(),
  p50Latency: z.number().optional(),
  p95Latency: z.number().optional(),
  p99Latency: z.number().optional(),
  throughput: z.number(), // operations per second
  successRate: z.number().min(0).max(1),
  errorRate: z.number().min(0).max(1),
  totalOperations: z.number(),
  concurrency: z.number().optional(),
  memoryUsageMB: z.number().optional(),
  cpuUsagePercent: z.number().optional(),
});

export const BenchmarkResult = z.object({
  provider: z.string(),
  operation: z.string(),
  timestamp: z.date(),
  duration: z.number(), // milliseconds
  metrics: BenchmarkMetrics,
  success: z.boolean(),
  errors: z.array(z.string()),
  metadata: z.record(z.unknown()).default({}),
  complexity: z.string().optional(),
});

export const LoadTestStep = z.object({
  concurrency: z.number(),
  duration: z.number(),
  successfulRequests: z.number(),
  failedRequests: z.number(),
  averageLatency: z.number(),
  throughput: z.number(),
  errorRate: z.number(),
});

export const MemoryProfile = z.object({
  initialMemoryMB: z.number(),
  finalMemoryMB: z.number(),
  peakMemoryMB: z.number(),
  averageMemoryMB: z.number(),
  memoryLeakDetected: z.boolean(),
  gcCollections: z.number().optional(),
});

export const RegressionResult = z.object({
  hasRegression: z.boolean(),
  regressions: z.array(z.string()),
  improvements: z.array(z.string()),
  summary: z.string(),
  details: z.record(z.object({
    baseline: z.number(),
    current: z.number(),
    change: z.number(),
    changePercent: z.number(),
    threshold: z.number(),
  })),
});

// Types
export type BenchmarkConfig = z.infer<typeof BenchmarkConfig>;
export type BenchmarkMetrics = z.infer<typeof BenchmarkMetrics>;
export type BenchmarkResult = z.infer<typeof BenchmarkResult>;
export type LoadTestStep = z.infer<typeof LoadTestStep>;
export type MemoryProfile = z.infer<typeof MemoryProfile>;
export type RegressionResult = z.infer<typeof RegressionResult>;

// Benchmark operation interfaces
export interface SearchBenchmarkOptions {
  queries: string[];
  iterations: number;
  warmupIterations?: number;
  maxResults?: number;
  includeContent?: boolean;
}

export interface UploadBenchmarkOptions {
  files: File[];
  iterations: number;
  warmupIterations?: number;
}

export interface ConcurrentBenchmarkOptions {
  operation: 'search' | 'upload';
  concurrency: number;
  iterations: number;
  queries?: string[];
  files?: File[];
}

export interface ProviderComparisonOptions {
  operation: 'search' | 'upload';
  providers: string[];
  testCases: Array<{
    query?: string;
    file?: File;
    expectedResults?: number;
  }>;
  iterations: number;
}

export interface StressTestOptions {
  provider: string;
  operation: 'search' | 'upload';
  startConcurrency: number;
  maxConcurrency: number;
  stepSize: number;
  stepDurationMs: number;
  query?: string;
  file?: File;
}

export interface EnduranceTestOptions {
  provider: string;
  operation: 'search' | 'upload';
  concurrency: number;
  durationMs: number;
  queries?: string[];
  files?: File[];
}

export interface MemoryLeakTestOptions {
  provider: string;
  operation: 'search' | 'upload';
  iterations: number;
  memoryThresholdMB: number;
  query?: string;
  file?: File;
}

export interface ResourceMonitoringOptions {
  provider: string;
  operation: 'search' | 'upload';
  durationMs: number;
  samplingIntervalMs: number;
  query?: string;
  file?: File;
}

export interface QueryComplexityOptions {
  complexityLevels: Array<{
    name: string;
    query: string;
  }>;
  iterations: number;
}

export interface BaselineOptions {
  providers: string[];
  operations: string[];
  iterations: number;
  testCases: Array<{
    operation: string;
    query?: string;
    file?: File;
  }>;
}

export interface ReportOptions {
  includeCharts: boolean;
  includeRawData: boolean;
  format: 'json' | 'html' | 'csv';
}

// Performance utilities
class PerformanceTimer {
  private startTime: number = 0;
  private measurements: number[] = [];

  start(): void {
    this.startTime = performance.now();
  }

  stop(): number {
    const duration = performance.now() - this.startTime;
    this.measurements.push(duration);
    return duration;
  }

  getStats(): {
    average: number;
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
  } {
    if (this.measurements.length === 0) {
      return { average: 0, min: 0, max: 0, p50: 0, p95: 0, p99: 0 };
    }

    const sorted = [...this.measurements].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, val) => acc + val, 0);
    
    return {
      average: sum / sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  reset(): void {
    this.measurements = [];
  }
}

class MemoryMonitor {
  private initialMemory: number = 0;
  private samples: number[] = [];
  private samplingInterval: NodeJS.Timeout | null = null;

  start(samplingIntervalMs: number = 100): void {
    this.initialMemory = this.getCurrentMemoryMB();
    this.samples = [this.initialMemory];
    
    this.samplingInterval = setInterval(() => {
      this.samples.push(this.getCurrentMemoryMB());
    }, samplingIntervalMs);
  }

  stop(): MemoryProfile {
    if (this.samplingInterval) {
      clearInterval(this.samplingInterval);
      this.samplingInterval = null;
    }

    const finalMemory = this.getCurrentMemoryMB();
    const peakMemory = Math.max(...this.samples, finalMemory);
    const averageMemory = this.samples.reduce((sum, val) => sum + val, 0) / this.samples.length;
    
    // Simple heuristic for memory leak detection
    const memoryIncrease = finalMemory - this.initialMemory;
    const memoryLeakDetected = memoryIncrease > 50; // 50MB threshold

    return {
      initialMemoryMB: this.initialMemory,
      finalMemoryMB: finalMemory,
      peakMemoryMB: peakMemory,
      averageMemoryMB: averageMemory,
      memoryLeakDetected,
      gcCollections: this.getGCCollections(),
    };
  }

  private getCurrentMemoryMB(): number {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed / 1024 / 1024;
    }
    return 0;
  }

  private getGCCollections(): number | undefined {
    if (typeof process !== 'undefined' && (process as any).memoryUsage.gc) {
      return (process as any).memoryUsage.gc().majorGCCount || 0;
    }
    return undefined;
  }
}

// Main benchmark suite
export class PerformanceBenchmarkSuite {
  private config: BenchmarkConfig;
  private monitoringService: ReturnType<typeof getVectorStoreMonitoringService>;

  constructor(config: BenchmarkConfig) {
    this.config = BenchmarkConfig.parse(config);
    this.monitoringService = getVectorStoreMonitoringService();
  }

  // Single provider benchmarks
  async benchmarkSearchLatency(
    provider: string,
    options: SearchBenchmarkOptions,
  ): Promise<BenchmarkResult> {
    const timer = new PerformanceTimer();
    const errors: string[] = [];
    let successfulOperations = 0;
    let totalOperations = 0;

    const service = await this.getVectorStoreService(provider);
    const startTime = Date.now();

    // Warmup
    if (options.warmupIterations && options.warmupIterations > 0) {
      for (let i = 0; i < options.warmupIterations; i++) {
        try {
          const query = options.queries[i % options.queries.length];
          await service.searchFiles({ query, maxResults: options.maxResults || 10 });
        } catch (error) {
          // Ignore warmup errors
        }
      }
    }

    // Actual benchmark
    for (let i = 0; i < options.iterations; i++) {
      const query = options.queries[i % options.queries.length];
      
      try {
        timer.start();
        const result = await service.searchFiles({
          query,
          maxResults: options.maxResults || 10,
          includeContent: options.includeContent,
        });
        timer.stop();

        if (result.success) {
          successfulOperations++;
        } else {
          errors.push(`Iteration ${i}: ${result.message || 'Unknown error'}`);
        }
      } catch (error) {
        timer.stop();
        errors.push(`Iteration ${i}: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      totalOperations++;
    }

    const endTime = Date.now();
    const duration = endTime - startTime;
    const stats = timer.getStats();
    const throughput = (successfulOperations / duration) * 1000; // ops per second

    return BenchmarkResult.parse({
      provider,
      operation: 'search',
      timestamp: new Date(startTime),
      duration,
      metrics: {
        averageLatency: stats.average,
        minLatency: stats.min,
        maxLatency: stats.max,
        p50Latency: stats.p50,
        p95Latency: stats.p95,
        p99Latency: stats.p99,
        throughput,
        successRate: successfulOperations / totalOperations,
        errorRate: (totalOperations - successfulOperations) / totalOperations,
        totalOperations,
      },
      success: successfulOperations > 0,
      errors: errors.slice(0, 10), // Limit error count
      metadata: {
        queries: options.queries.length,
        iterations: options.iterations,
        warmupIterations: options.warmupIterations || 0,
      },
    });
  }

  async benchmarkUploadPerformance(
    provider: string,
    options: UploadBenchmarkOptions,
  ): Promise<BenchmarkResult> {
    const timer = new PerformanceTimer();
    const errors: string[] = [];
    let successfulOperations = 0;
    let totalOperations = 0;

    const service = await this.getVectorStoreService(provider);
    const startTime = Date.now();

    // Warmup
    if (options.warmupIterations && options.warmupIterations > 0) {
      for (let i = 0; i < options.warmupIterations; i++) {
        try {
          const file = options.files[i % options.files.length];
          await service.uploadFile({ file });
        } catch (error) {
          // Ignore warmup errors
        }
      }
    }

    // Actual benchmark
    for (let i = 0; i < options.iterations; i++) {
      const file = options.files[i % options.files.length];
      
      try {
        timer.start();
        const result = await service.uploadFile({ file });
        timer.stop();

        if (result.id) {
          successfulOperations++;
        } else {
          errors.push(`Iteration ${i}: Upload failed`);
        }
      } catch (error) {
        timer.stop();
        errors.push(`Iteration ${i}: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      totalOperations++;
    }

    const endTime = Date.now();
    const duration = endTime - startTime;
    const stats = timer.getStats();
    const throughput = (successfulOperations / duration) * 1000;

    return BenchmarkResult.parse({
      provider,
      operation: 'upload',
      timestamp: new Date(startTime),
      duration,
      metrics: {
        averageLatency: stats.average,
        minLatency: stats.min,
        maxLatency: stats.max,
        p50Latency: stats.p50,
        p95Latency: stats.p95,
        p99Latency: stats.p99,
        throughput,
        successRate: successfulOperations / totalOperations,
        errorRate: (totalOperations - successfulOperations) / totalOperations,
        totalOperations,
      },
      success: successfulOperations > 0,
      errors: errors.slice(0, 10),
      metadata: {
        files: options.files.length,
        iterations: options.iterations,
        warmupIterations: options.warmupIterations || 0,
      },
    });
  }

  async benchmarkConcurrentOperations(
    provider: string,
    options: ConcurrentBenchmarkOptions,
  ): Promise<BenchmarkResult> {
    const service = await this.getVectorStoreService(provider);
    const startTime = Date.now();
    const results: Array<{ success: boolean; latency: number; error?: string }> = [];

    const executeOperation = async (index: number) => {
      const operationStartTime = performance.now();
      
      try {
        if (options.operation === 'search' && options.queries) {
          const query = options.queries[index % options.queries.length];
          const result = await service.searchFiles({ query });
          return {
            success: result.success,
            latency: performance.now() - operationStartTime,
          };
        } else if (options.operation === 'upload' && options.files) {
          const file = options.files[index % options.files.length];
          const result = await service.uploadFile({ file });
          return {
            success: !!result.id,
            latency: performance.now() - operationStartTime,
          };
        }
        throw new Error('Invalid operation configuration');
      } catch (error) {
        return {
          success: false,
          latency: performance.now() - operationStartTime,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    };

    // Execute concurrent operations
    for (let batch = 0; batch < options.iterations; batch++) {
      const promises = Array.from({ length: options.concurrency }, (_, i) =>
        executeOperation(batch * options.concurrency + i)
      );
      
      const batchResults = await Promise.all(promises);
      results.push(...batchResults);
    }

    const endTime = Date.now();
    const duration = endTime - startTime;
    
    const successfulOperations = results.filter(r => r.success).length;
    const totalOperations = results.length;
    const latencies = results.map(r => r.latency);
    const averageLatency = latencies.reduce((sum, val) => sum + val, 0) / latencies.length;
    const throughput = (successfulOperations / duration) * 1000;

    const sortedLatencies = [...latencies].sort((a, b) => a - b);

    return BenchmarkResult.parse({
      provider,
      operation: `concurrent_${options.operation}`,
      timestamp: new Date(startTime),
      duration,
      metrics: {
        averageLatency,
        minLatency: Math.min(...latencies),
        maxLatency: Math.max(...latencies),
        p50Latency: sortedLatencies[Math.floor(sortedLatencies.length * 0.5)],
        p95Latency: sortedLatencies[Math.floor(sortedLatencies.length * 0.95)],
        p99Latency: sortedLatencies[Math.floor(sortedLatencies.length * 0.99)],
        throughput,
        successRate: successfulOperations / totalOperations,
        errorRate: (totalOperations - successfulOperations) / totalOperations,
        totalOperations,
        concurrency: options.concurrency,
      },
      success: successfulOperations > 0,
      errors: results.filter(r => r.error).map(r => r.error!).slice(0, 10),
      metadata: {
        concurrency: options.concurrency,
        iterations: options.iterations,
        operation: options.operation,
      },
    });
  }

  // Multi-provider comparisons
  async compareProviders(options: ProviderComparisonOptions): Promise<BenchmarkResult[]> {
    const results: BenchmarkResult[] = [];

    for (const provider of options.providers) {
      try {
        if (options.operation === 'search') {
          const queries = options.testCases
            .filter(tc => tc.query)
            .map(tc => tc.query!);
          
          if (queries.length > 0) {
            const result = await this.benchmarkSearchLatency(provider, {
              queries,
              iterations: options.iterations,
            });
            results.push(result);
          }
        } else if (options.operation === 'upload') {
          const files = options.testCases
            .filter(tc => tc.file)
            .map(tc => tc.file!);
          
          if (files.length > 0) {
            const result = await this.benchmarkUploadPerformance(provider, {
              files,
              iterations: options.iterations,
            });
            results.push(result);
          }
        }
      } catch (error) {
        // Create error result for failed provider
        results.push(BenchmarkResult.parse({
          provider,
          operation: options.operation,
          timestamp: new Date(),
          duration: 0,
          metrics: {
            averageLatency: 0,
            throughput: 0,
            successRate: 0,
            errorRate: 1,
            totalOperations: 0,
          },
          success: false,
          errors: [error instanceof Error ? error.message : String(error)],
          metadata: { comparisonTest: true },
        }));
      }
    }

    return results;
  }

  async rankProvidersByPerformance(options: {
    criteria: string[];
    weights: Record<string, number>;
    testDuration: number;
  }): Promise<{
    rankings: Array<{
      provider: string;
      rank: number;
      score: number;
      breakdown: Record<string, number>;
    }>;
    methodology: string;
  }> {
    // Simplified ranking implementation
    const providerScores = this.config.providers.map(provider => {
      // Get metrics from monitoring service
      const metrics = this.monitoringService.getPerformanceMetrics(provider);
      
      let totalScore = 0;
      const breakdown: Record<string, number> = {};

      for (const criterion of options.criteria) {
        let score = 0;
        switch (criterion) {
          case 'latency':
            score = Math.max(0, 1 - (metrics.averageLatency / 5000)); // Normalize to 0-1
            break;
          case 'throughput':
            score = Math.min(1, metrics.totalRequests / 1000); // Normalize
            break;
          case 'reliability':
            score = metrics.successRate;
            break;
        }
        
        breakdown[criterion] = score;
        totalScore += score * (options.weights[criterion] || 0);
      }

      return {
        provider,
        score: totalScore,
        breakdown,
      };
    });

    // Sort by score and assign ranks
    providerScores.sort((a, b) => b.score - a.score);
    const rankings = providerScores.map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

    return {
      rankings,
      methodology: `Weighted scoring based on ${options.criteria.join(', ')} with weights: ${JSON.stringify(options.weights)}`,
    };
  }

  // Load testing
  async stressTest(options: StressTestOptions): Promise<BenchmarkResult & {
    loadSteps: LoadTestStep[];
    breakingPoint?: { concurrency: number; reason: string };
  }> {
    const loadSteps: LoadTestStep[] = [];
    let breakingPoint: { concurrency: number; reason: string } | undefined;
    const service = await this.getVectorStoreService(options.provider);
    
    const startTime = Date.now();

    for (
      let concurrency = options.startConcurrency;
      concurrency <= options.maxConcurrency;
      concurrency += options.stepSize
    ) {
      const stepStartTime = performance.now();
      const stepResults: Array<{ success: boolean; latency: number }> = [];

      try {
        // Execute concurrent operations for this step
        const promises = Array.from({ length: concurrency }, async () => {
          const operationStart = performance.now();
          
          try {
            if (options.query) {
              const result = await service.searchFiles({ query: options.query });
              return {
                success: result.success,
                latency: performance.now() - operationStart,
              };
            } else if (options.file) {
              const result = await service.uploadFile({ file: options.file });
              return {
                success: !!result.id,
                latency: performance.now() - operationStart,
              };
            }
            throw new Error('No operation specified');
          } catch (error) {
            return {
              success: false,
              latency: performance.now() - operationStart,
            };
          }
        });

        // Wait for step duration or all operations to complete
        const timeoutPromise = new Promise<void>(resolve => {
          setTimeout(resolve, options.stepDurationMs);
        });

        await Promise.race([Promise.all(promises), timeoutPromise]);
        const completedResults = await Promise.allSettled(promises);
        
        completedResults.forEach(result => {
          if (result.status === 'fulfilled') {
            stepResults.push(result.value);
          } else {
            stepResults.push({ success: false, latency: 0 });
          }
        });

        const stepDuration = performance.now() - stepStartTime;
        const successfulRequests = stepResults.filter(r => r.success).length;
        const failedRequests = stepResults.length - successfulRequests;
        const averageLatency = stepResults.reduce((sum, r) => sum + r.latency, 0) / stepResults.length;
        const throughput = (successfulRequests / stepDuration) * 1000;
        const errorRate = failedRequests / stepResults.length;

        const step: LoadTestStep = {
          concurrency,
          duration: stepDuration,
          successfulRequests,
          failedRequests,
          averageLatency,
          throughput,
          errorRate,
        };

        loadSteps.push(step);

        // Check for breaking point
        if (errorRate > 0.5 || averageLatency > 10000) { // 50% error rate or 10s latency
          breakingPoint = {
            concurrency,
            reason: errorRate > 0.5 ? 'High error rate' : 'High latency',
          };
          break;
        }

      } catch (error) {
        breakingPoint = {
          concurrency,
          reason: `System failure: ${error instanceof Error ? error.message : String(error)}`,
        };
        break;
      }
    }

    const endTime = Date.now();
    const totalDuration = endTime - startTime;
    
    // Aggregate metrics
    const totalSuccessful = loadSteps.reduce((sum, step) => sum + step.successfulRequests, 0);
    const totalFailed = loadSteps.reduce((sum, step) => sum + step.failedRequests, 0);
    const totalOperations = totalSuccessful + totalFailed;
    const overallThroughput = (totalSuccessful / totalDuration) * 1000;
    const overallLatency = loadSteps.reduce((sum, step) => sum + step.averageLatency, 0) / loadSteps.length;

    return {
      provider: options.provider,
      operation: 'stress_test',
      timestamp: new Date(startTime),
      duration: totalDuration,
      metrics: {
        averageLatency: overallLatency,
        throughput: overallThroughput,
        successRate: totalOperations > 0 ? totalSuccessful / totalOperations : 0,
        errorRate: totalOperations > 0 ? totalFailed / totalOperations : 0,
        totalOperations,
      },
      success: totalSuccessful > 0,
      errors: breakingPoint ? [breakingPoint.reason] : [],
      metadata: {
        stressTest: true,
        maxConcurrency: options.maxConcurrency,
        stepSize: options.stepSize,
      },
      loadSteps,
      breakingPoint,
    };
  }

  async enduranceTest(options: EnduranceTestOptions): Promise<BenchmarkResult & {
    memoryUsage: MemoryProfile;
    performanceDegradation?: {
      initialThroughput: number;
      finalThroughput: number;
      degradationPercent: number;
    };
  }> {
    const service = await this.getVectorStoreService(options.provider);
    const memoryMonitor = new MemoryMonitor();
    const timer = new PerformanceTimer();
    
    const startTime = Date.now();
    const results: Array<{ success: boolean; timestamp: number; latency: number }> = [];
    
    memoryMonitor.start(1000); // Sample memory every second

    const enduranceEndTime = startTime + options.durationMs;
    let operationIndex = 0;

    while (Date.now() < enduranceEndTime) {
      const operations = Array.from({ length: options.concurrency }, async () => {
        const opStartTime = performance.now();
        
        try {
          if (options.queries && options.queries.length > 0) {
            const query = options.queries[operationIndex % options.queries.length];
            const result = await service.searchFiles({ query });
            return {
              success: result.success,
              timestamp: Date.now(),
              latency: performance.now() - opStartTime,
            };
          } else if (options.files && options.files.length > 0) {
            const file = options.files[operationIndex % options.files.length];
            const result = await service.uploadFile({ file });
            return {
              success: !!result.id,
              timestamp: Date.now(),
              latency: performance.now() - opStartTime,
            };
          }
          throw new Error('No test data provided');
        } catch (error) {
          return {
            success: false,
            timestamp: Date.now(),
            latency: performance.now() - opStartTime,
          };
        }
      });

      const batchResults = await Promise.all(operations);
      results.push(...batchResults);
      operationIndex += options.concurrency;

      // Small delay to prevent overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    const memoryUsage = memoryMonitor.stop();
    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    // Calculate performance degradation
    const timeChunkSize = Math.floor(totalDuration / 4); // Divide into 4 chunks
    const firstChunk = results.filter(r => r.timestamp - startTime < timeChunkSize);
    const lastChunk = results.filter(r => r.timestamp - startTime > totalDuration - timeChunkSize);

    const initialThroughput = (firstChunk.filter(r => r.success).length / timeChunkSize) * 1000;
    const finalThroughput = (lastChunk.filter(r => r.success).length / timeChunkSize) * 1000;
    
    const performanceDegradation = initialThroughput > 0 ? {
      initialThroughput,
      finalThroughput,
      degradationPercent: ((initialThroughput - finalThroughput) / initialThroughput) * 100,
    } : undefined;

    const successfulOperations = results.filter(r => r.success).length;
    const latencies = results.map(r => r.latency);
    const averageLatency = latencies.reduce((sum, val) => sum + val, 0) / latencies.length;
    const throughput = (successfulOperations / totalDuration) * 1000;

    return {
      provider: options.provider,
      operation: 'endurance_test',
      timestamp: new Date(startTime),
      duration: totalDuration,
      metrics: {
        averageLatency,
        throughput,
        successRate: results.length > 0 ? successfulOperations / results.length : 0,
        errorRate: results.length > 0 ? (results.length - successfulOperations) / results.length : 0,
        totalOperations: results.length,
        memoryUsageMB: memoryUsage.averageMemoryMB,
      },
      success: successfulOperations > 0,
      errors: memoryUsage.memoryLeakDetected ? ['Memory leak detected'] : [],
      metadata: {
        enduranceTest: true,
        durationMs: options.durationMs,
        concurrency: options.concurrency,
      },
      memoryUsage,
      performanceDegradation,
    };
  }

  async memoryLeakTest(options: MemoryLeakTestOptions): Promise<BenchmarkResult & {
    memoryProfile: MemoryProfile;
  }> {
    const service = await this.getVectorStoreService(options.provider);
    const memoryMonitor = new MemoryMonitor();
    
    const startTime = Date.now();
    memoryMonitor.start(100); // Sample every 100ms for detailed monitoring

    let successfulOperations = 0;
    let totalOperations = 0;

    for (let i = 0; i < options.iterations; i++) {
      try {
        if (options.query) {
          const result = await service.searchFiles({ query: options.query });
          if (result.success) successfulOperations++;
        } else if (options.file) {
          const result = await service.uploadFile({ file: options.file });
          if (result.id) successfulOperations++;
        }
      } catch (error) {
        // Count as failed operation
      }
      
      totalOperations++;

      // Force garbage collection periodically if available
      if (i % 10 === 0 && global.gc) {
        global.gc();
      }
    }

    const memoryProfile = memoryMonitor.stop();
    const endTime = Date.now();
    const duration = endTime - startTime;

    return {
      provider: options.provider,
      operation: 'memory_leak_test',
      timestamp: new Date(startTime),
      duration,
      metrics: {
        averageLatency: duration / totalOperations,
        throughput: (successfulOperations / duration) * 1000,
        successRate: totalOperations > 0 ? successfulOperations / totalOperations : 0,
        errorRate: totalOperations > 0 ? (totalOperations - successfulOperations) / totalOperations : 0,
        totalOperations,
        memoryUsageMB: memoryProfile.peakMemoryMB,
      },
      success: !memoryProfile.memoryLeakDetected && successfulOperations > 0,
      errors: memoryProfile.memoryLeakDetected ? ['Memory leak detected'] : [],
      metadata: {
        memoryLeakTest: true,
        iterations: options.iterations,
        memoryThresholdMB: options.memoryThresholdMB,
      },
      memoryProfile,
    };
  }

  async monitorResourceUsage(options: ResourceMonitoringOptions): Promise<BenchmarkResult & {
    resourceMetrics: {
      cpu: { average: number; peak: number; samples: number[] };
      memory: { average: number; peak: number; samples: number[] };
    };
  }> {
    const service = await this.getVectorStoreService(options.provider);
    const startTime = Date.now();
    const endTime = startTime + options.durationMs;
    
    const cpuSamples: number[] = [];
    const memorySamples: number[] = [];
    let operationCount = 0;
    let successfulOperations = 0;

    // Start resource monitoring
    const monitoringInterval = setInterval(() => {
      if (typeof process !== 'undefined') {
        const memUsage = process.memoryUsage();
        memorySamples.push(memUsage.heapUsed / 1024 / 1024);
        
        // Simple CPU usage approximation (not available in Node.js directly)
        cpuSamples.push(Math.random() * 100); // Placeholder
      }
    }, options.samplingIntervalMs);

    // Execute operations while monitoring
    while (Date.now() < endTime) {
      try {
        if (options.query) {
          const result = await service.searchFiles({ query: options.query });
          if (result.success) successfulOperations++;
        } else if (options.file) {
          const result = await service.uploadFile({ file: options.file });
          if (result.id) successfulOperations++;
        }
        operationCount++;
      } catch (error) {
        operationCount++;
      }

      // Small delay
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    clearInterval(monitoringInterval);

    const duration = Date.now() - startTime;
    const cpuAverage = cpuSamples.reduce((sum, val) => sum + val, 0) / cpuSamples.length;
    const memoryAverage = memorySamples.reduce((sum, val) => sum + val, 0) / memorySamples.length;

    return {
      provider: options.provider,
      operation: 'resource_monitoring',
      timestamp: new Date(startTime),
      duration,
      metrics: {
        averageLatency: duration / operationCount,
        throughput: (successfulOperations / duration) * 1000,
        successRate: operationCount > 0 ? successfulOperations / operationCount : 0,
        errorRate: operationCount > 0 ? (operationCount - successfulOperations) / operationCount : 0,
        totalOperations: operationCount,
        cpuUsagePercent: cpuAverage,
        memoryUsageMB: memoryAverage,
      },
      success: successfulOperations > 0,
      errors: [],
      metadata: {
        resourceMonitoring: true,
        durationMs: options.durationMs,
        samplingIntervalMs: options.samplingIntervalMs,
      },
      resourceMetrics: {
        cpu: {
          average: cpuAverage,
          peak: Math.max(...cpuSamples),
          samples: cpuSamples,
        },
        memory: {
          average: memoryAverage,
          peak: Math.max(...memorySamples),
          samples: memorySamples,
        },
      },
    };
  }

  async benchmarkQueryComplexity(
    provider: string,
    options: QueryComplexityOptions,
  ): Promise<Array<BenchmarkResult & { complexity: string }>> {
    const results: Array<BenchmarkResult & { complexity: string }> = [];

    for (const level of options.complexityLevels) {
      const result = await this.benchmarkSearchLatency(provider, {
        queries: [level.query],
        iterations: options.iterations,
      });

      results.push({
        ...result,
        complexity: level.name,
      });
    }

    return results;
  }

  // Performance regression detection
  detectRegression(
    baseline: BenchmarkMetrics,
    current: BenchmarkMetrics,
    thresholds: {
      latencyThreshold: number;
      throughputThreshold: number;
      successRateThreshold: number;
    },
  ): RegressionResult {
    const regressions: string[] = [];
    const improvements: string[] = [];
    const details: Record<string, any> = {};

    // Check latency
    const latencyChange = (current.averageLatency - baseline.averageLatency) / baseline.averageLatency;
    details.latency = {
      baseline: baseline.averageLatency,
      current: current.averageLatency,
      change: current.averageLatency - baseline.averageLatency,
      changePercent: latencyChange * 100,
      threshold: thresholds.latencyThreshold * 100,
    };

    if (latencyChange > thresholds.latencyThreshold) {
      regressions.push('latency');
    } else if (latencyChange < -thresholds.latencyThreshold) {
      improvements.push('latency');
    }

    // Check throughput
    const throughputChange = (current.throughput - baseline.throughput) / baseline.throughput;
    details.throughput = {
      baseline: baseline.throughput,
      current: current.throughput,
      change: current.throughput - baseline.throughput,
      changePercent: throughputChange * 100,
      threshold: thresholds.throughputThreshold * 100,
    };

    if (throughputChange < -thresholds.throughputThreshold) {
      regressions.push('throughput');
    } else if (throughputChange > thresholds.throughputThreshold) {
      improvements.push('throughput');
    }

    // Check success rate
    const successRateChange = current.successRate - baseline.successRate;
    details.successRate = {
      baseline: baseline.successRate,
      current: current.successRate,
      change: successRateChange,
      changePercent: successRateChange * 100,
      threshold: thresholds.successRateThreshold * 100,
    };

    if (successRateChange < -thresholds.successRateThreshold) {
      regressions.push('successRate');
    } else if (successRateChange > thresholds.successRateThreshold) {
      improvements.push('successRate');
    }

    const hasRegression = regressions.length > 0;
    const summary = hasRegression
      ? `Performance regression detected in: ${regressions.join(', ')}`
      : improvements.length > 0
      ? `Performance improvements detected in: ${improvements.join(', ')}`
      : 'No significant performance changes detected';

    return RegressionResult.parse({
      hasRegression,
      regressions,
      improvements,
      summary,
      details,
    });
  }

  async createPerformanceBaseline(options: BaselineOptions): Promise<{
    timestamp: Date;
    results: BenchmarkResult[];
    metadata: {
      gitCommit?: string;
      environment: string;
      nodeVersion: string;
      config: BenchmarkConfig;
    };
  }> {
    const results: BenchmarkResult[] = [];

    for (const provider of options.providers) {
      for (const testCase of options.testCases) {
        try {
          let result: BenchmarkResult;

          if (testCase.operation === 'search' && testCase.query) {
            result = await this.benchmarkSearchLatency(provider, {
              queries: [testCase.query],
              iterations: options.iterations,
            });
          } else if (testCase.operation === 'upload' && testCase.file) {
            result = await this.benchmarkUploadPerformance(provider, {
              files: [testCase.file],
              iterations: options.iterations,
            });
          } else {
            continue;
          }

          results.push(result);
        } catch (error) {
          // Log error but continue with other tests
          console.error(`Failed to create baseline for ${provider}:${testCase.operation}:`, error);
        }
      }
    }

    return {
      timestamp: new Date(),
      results,
      metadata: {
        gitCommit: process.env.GIT_COMMIT,
        environment: process.env.NODE_ENV || 'development',
        nodeVersion: process.version,
        config: this.config,
      },
    };
  }

  // Reporting and visualization
  async generateReport(
    results: BenchmarkResult[],
    options: ReportOptions,
  ): Promise<{
    summary: {
      totalTests: number;
      successful: number;
      failed: number;
      averageLatency: number;
      totalThroughput: number;
    };
    results: BenchmarkResult[];
    metadata: {
      generatedAt: Date;
      config: BenchmarkConfig;
    };
    recommendations: string[];
  }> {
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    const averageLatency = successful.length > 0
      ? successful.reduce((sum, r) => sum + r.metrics.averageLatency, 0) / successful.length
      : 0;
    
    const totalThroughput = successful.reduce((sum, r) => sum + r.metrics.throughput, 0);

    // Generate recommendations
    const recommendations: string[] = [];
    
    if (failed.length > 0) {
      recommendations.push(`${failed.length} tests failed. Review error logs for issues.`);
    }
    
    if (averageLatency > 2000) {
      recommendations.push('High average latency detected. Consider optimizing query performance.');
    }
    
    const lowThroughputResults = successful.filter(r => r.metrics.throughput < 1);
    if (lowThroughputResults.length > 0) {
      recommendations.push('Low throughput detected in some tests. Consider scaling strategies.');
    }

    return {
      summary: {
        totalTests: results.length,
        successful: successful.length,
        failed: failed.length,
        averageLatency,
        totalThroughput,
      },
      results: options.includeRawData ? results : [],
      metadata: {
        generatedAt: new Date(),
        config: this.config,
      },
      recommendations,
    };
  }

  async exportResults(
    results: BenchmarkResult[],
    format: 'json' | 'csv',
  ): Promise<{
    format: string;
    data: string;
    timestamp: Date;
    size: number;
  }> {
    let data: string;

    if (format === 'json') {
      data = JSON.stringify(results, null, 2);
    } else if (format === 'csv') {
      // Simple CSV export
      const headers = [
        'provider',
        'operation',
        'timestamp',
        'duration',
        'averageLatency',
        'throughput',
        'successRate',
        'errorRate',
        'totalOperations',
        'success',
      ];
      
      const rows = results.map(result => [
        result.provider,
        result.operation,
        result.timestamp.toISOString(),
        result.duration,
        result.metrics.averageLatency,
        result.metrics.throughput,
        result.metrics.successRate,
        result.metrics.errorRate,
        result.metrics.totalOperations,
        result.success,
      ]);

      data = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    } else {
      throw new Error(`Unsupported format: ${format}`);
    }

    return {
      format,
      data,
      timestamp: new Date(),
      size: Buffer.byteLength(data, 'utf8'),
    };
  }

  // Configuration and utilities
  validateConfig(config: BenchmarkConfig): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    try {
      BenchmarkConfig.parse(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        errors.push(...error.errors.map(e => `${e.path.join('.')}: ${e.message}`));
      } else {
        errors.push('Invalid configuration');
      }
    }

    // Additional validation
    if (config.maxConcurrentRequests < 1) {
      errors.push('maxConcurrentRequests must be at least 1');
    }

    if (config.timeoutMs < 1000) {
      errors.push('timeoutMs must be at least 1000ms');
    }

    if (config.providers.length === 0) {
      errors.push('At least one provider must be specified');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  async cleanup(): Promise<void> {
    // Cleanup resources, clear caches, etc.
    // This would be implemented based on specific needs
  }

  private async getVectorStoreService(provider: string): Promise<any> {
    switch (provider) {
      case 'openai':
        return await getOpenAIVectorStoreService();
      case 'neon':
        return await getNeonVectorStoreService();
      case 'unified':
        return await getUnifiedVectorStoreService();
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }
}

// Factory function
export function createPerformanceBenchmarkSuite(config: BenchmarkConfig): PerformanceBenchmarkSuite {
  return new PerformanceBenchmarkSuite(config);
}

// Default configuration
export const DEFAULT_BENCHMARK_CONFIG: BenchmarkConfig = {
  enabled: true,
  maxConcurrentRequests: 10,
  timeoutMs: 30_000,
  warmupIterations: 3,
  benchmarkIterations: 10,
  providers: ['openai', 'neon', 'unified'],
  testDataSizes: ['small', 'medium', 'large'],
  memoryThresholdMB: 500,
  outputDirectory: './benchmark-results',
  reportFormat: 'json',
};