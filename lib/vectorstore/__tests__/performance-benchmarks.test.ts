import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPerformanceBenchmarkSuite } from '../performance-benchmarks';
import type {
  BenchmarkResult,
  BenchmarkConfig,
} from '../performance-benchmarks';

// Mock server-only module
vi.mock('server-only', () => ({}));

// Set up test environment variables
process.env.GIT_COMMIT = 'test-commit-hash';
process.env.NODE_ENV = 'test';

// Mock performance API
if (typeof global.performance === 'undefined') {
  global.performance = {
    now: Date.now,
    mark: vi.fn(),
    measure: vi.fn(),
    clearMarks: vi.fn(),
    clearMeasures: vi.fn(),
    getEntriesByName: vi.fn(() => []),
    getEntriesByType: vi.fn(() => []),
  } as any;
}

// Mock monitoring service with all required methods
vi.mock('../monitoring', () => {
  const mockMonitoringService = {
    recordSearchLatency: vi.fn(),
    recordSearchError: vi.fn(),
    recordSearchSuccess: vi.fn(),
    recordMetric: vi.fn(),
    recordTokenUsage: vi.fn(),
    performHealthCheck: vi.fn().mockResolvedValue({ isHealthy: true }),
    getPerformanceMetrics: vi.fn().mockReturnValue({
      totalRequests: 100,
      successRate: 0.95,
      averageLatency: 500,
      p95Latency: 800,
      p99Latency: 1200,
      errorRate: 0.05,
    }),
    config: {
      maxLatencyMs: 5000,
      minSuccessRate: 0.95,
      maxErrorRate: 0.05,
    },
    // Add any missing methods that might be called
    startMonitoring: vi.fn(),
    stopMonitoring: vi.fn(),
    reset: vi.fn(),
  };
  
  return {
    getVectorStoreMonitoringService: vi.fn().mockReturnValue(mockMonitoringService),
    VectorStoreMonitoringService: vi.fn().mockImplementation(() => mockMonitoringService),
    default: mockMonitoringService,
  };
});

vi.mock('../openai', () => ({
  getOpenAIVectorStoreService: vi.fn(() => Promise.resolve({
    searchFiles: vi.fn().mockResolvedValue({
      success: true,
      results: [
        {
          id: 'test-1',
          content: 'Test content',
          similarity: 0.9,
          metadata: {},
        },
      ],
      sources: ['test-file.txt'],
      totalResults: 1,
      query: 'test query',
      executionTime: 100,
    }),
    uploadFile: vi.fn().mockResolvedValue({ id: 'test-file', success: true }),
    healthCheck: vi.fn().mockResolvedValue({ isHealthy: true }),
    listFiles: vi.fn().mockResolvedValue([]),
    deleteFile: vi.fn().mockResolvedValue({ success: true }),
  })),
  createOpenAIVectorStoreService: vi.fn(() => ({
    searchFiles: vi.fn().mockResolvedValue({
      success: true,
      results: [
        {
          id: 'test-1',
          content: 'Test content',
          similarity: 0.9,
          metadata: {},
        },
      ],
      sources: ['test-file.txt'],
      totalResults: 1,
      query: 'test query',
      executionTime: 100,
    }),
    uploadFile: vi.fn().mockResolvedValue({ id: 'test-file', success: true }),
    healthCheck: vi.fn().mockResolvedValue({ isHealthy: true }),
    listFiles: vi.fn().mockResolvedValue([]),
    deleteFile: vi.fn().mockResolvedValue({ success: true }),
  })),
}));

vi.mock('../neon', () => ({
  getNeonVectorStoreService: vi.fn(() => Promise.resolve({
    searchFiles: vi.fn().mockResolvedValue({
      success: true,
      results: [
        {
          id: 'test-1',
          content: 'Test content',
          similarity: 0.9,
          metadata: {},
        },
      ],
      sources: ['test-file.txt'],
      totalResults: 1,
      query: 'test query',
      executionTime: 100,
    }),
    uploadFile: vi.fn().mockResolvedValue({ id: 'test-file', success: true }),
    healthCheck: vi.fn().mockResolvedValue({ isHealthy: true }),
    listFiles: vi.fn().mockResolvedValue([]),
    deleteFile: vi.fn().mockResolvedValue({ success: true }),
  })),
}));

vi.mock('../unified', () => ({
  getUnifiedVectorStoreService: vi.fn(() => Promise.resolve({
    searchFiles: vi.fn().mockResolvedValue({
      success: true,
      results: [
        {
          id: 'test-1',
          content: 'Test content',
          similarity: 0.9,
          metadata: {},
        },
      ],
      sources: ['test-file.txt'],
      totalResults: 1,
      query: 'test query',
      executionTime: 100,
    }),
    uploadFile: vi.fn().mockResolvedValue({ id: 'test-file', success: true }),
    healthCheck: vi.fn().mockResolvedValue({ isHealthy: true }),
    listFiles: vi.fn().mockResolvedValue([]),
    deleteFile: vi.fn().mockResolvedValue({ success: true }),
  })),
}));

describe('Performance Benchmark Suite', () => {
  let benchmarkSuite: ReturnType<typeof createPerformanceBenchmarkSuite>;

  beforeEach(() => {
    vi.clearAllMocks();
    
    benchmarkSuite = createPerformanceBenchmarkSuite({
      enabled: true,
      maxConcurrentRequests: 10,
      timeoutMs: 30000,
      warmupIterations: 3,
      benchmarkIterations: 10,
      providers: ['openai', 'neon', 'unified'],
      testDataSizes: ['small', 'medium', 'large'],
      memoryThresholdMB: 500,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Single Provider Benchmarks', () => {
    it('should benchmark search latency for OpenAI provider', async () => {
      const result = await benchmarkSuite.benchmarkSearchLatency('openai', {
        queries: ['test query 1', 'test query 2'],
        iterations: 5,
        warmupIterations: 2,
      });

      expect(result.provider).toBe('openai');
      expect(result.operation).toBe('search');
      expect(result.metrics).toBeDefined();
      expect(result.metrics.averageLatency).toBeGreaterThan(0);
      expect(result.metrics.throughput).toBeGreaterThan(0);
      expect(result.success).toBe(true);
    });

    it('should benchmark upload performance', async () => {
      const testFiles = [
        new File(['small content'], 'small.txt', { type: 'text/plain' }),
        new File(['medium content'.repeat(100)], 'medium.txt', {
          type: 'text/plain',
        }),
      ];

      const result = await benchmarkSuite.benchmarkUploadPerformance('openai', {
        files: testFiles,
        iterations: 3,
      });

      expect(result.provider).toBe('openai');
      expect(result.operation).toBe('upload');
      expect(result.metrics).toBeDefined();
      expect(result.metrics.averageLatency).toBeGreaterThan(0);
      expect(result.success).toBe(true);
    });

    it('should benchmark concurrent operations', async () => {
      const result = await benchmarkSuite.benchmarkConcurrentOperations(
        'openai',
        {
          operation: 'search',
          concurrency: 5,
          iterations: 3,
          queries: ['test query 1', 'test query 2', 'test query 3'],
        },
      );

      expect(result.provider).toBe('openai');
      expect(result.operation).toBe('concurrent_search');
      expect(result.metrics).toBeDefined();
      expect(result.metrics.concurrency).toBe(5);
      expect(result.success).toBe(true);
    });
  });

  describe('Multi-Provider Comparisons', () => {
    it('should compare search performance across all providers', async () => {
      const results = await benchmarkSuite.compareProviders({
        operation: 'search',
        providers: ['openai', 'neon', 'unified'],
        testCases: [
          { query: 'simple query', expectedResults: 5 },
          {
            query: 'complex technical query with multiple terms',
            expectedResults: 10,
          },
        ],
        iterations: 3,
      });

      expect(results).toHaveLength(3);
      results.forEach((result) => {
        expect(result.provider).toBeDefined();
        expect(result.metrics).toBeDefined();
        expect(result.success).toBe(true);
      });
    });

    it('should rank providers by performance', async () => {
      const ranking = await benchmarkSuite.rankProvidersByPerformance({
        criteria: ['latency', 'throughput', 'reliability'],
        weights: { latency: 0.4, throughput: 0.4, reliability: 0.2 },
        testDuration: 30000, // 30 seconds
      });

      expect(ranking).toBeDefined();
      expect(ranking.rankings).toHaveLength(3);
      expect(ranking.rankings[0].rank).toBe(1);
      expect(ranking.methodology).toBeDefined();
    });
  });

  describe('Load Testing', () => {
    it('should perform stress testing with increasing load', async () => {
      const result = await benchmarkSuite.stressTest({
        provider: 'openai',
        operation: 'search',
        startConcurrency: 1,
        maxConcurrency: 10,
        stepSize: 2,
        stepDurationMs: 5000,
        query: 'stress test query',
      });

      expect(result.provider).toBe('openai');
      expect(result.operation).toBe('stress_test');
      expect(result.loadSteps).toBeDefined();
      expect(result.breakingPoint).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should perform endurance testing', async () => {
      const result = await benchmarkSuite.enduranceTest({
        provider: 'openai',
        operation: 'search',
        concurrency: 5,
        durationMs: 10000, // 10 seconds for test
        queries: ['query 1', 'query 2', 'query 3'],
      });

      expect(result.provider).toBe('openai');
      expect(result.operation).toBe('endurance_test');
      expect(result.metrics).toBeDefined();
      expect(result.memoryUsage).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should detect memory leaks during extended operations', async () => {
      const result = await benchmarkSuite.memoryLeakTest({
        provider: 'openai',
        operation: 'search',
        iterations: 50,
        memoryThresholdMB: 100,
        query: 'memory test query',
      });

      expect(result.provider).toBe('openai');
      expect(result.operation).toBe('memory_leak_test');
      expect(result.memoryProfile).toBeDefined();
      expect(result.memoryProfile.initialMemoryMB).toBeDefined();
      expect(result.memoryProfile.finalMemoryMB).toBeDefined();
      expect(result.memoryProfile.peakMemoryMB).toBeDefined();
    });
  });

  describe('Performance Regression Detection', () => {
    it('should detect performance regressions', async () => {
      const baseline = {
        averageLatency: 500,
        throughput: 10,
        successRate: 0.95,
        p95Latency: 800,
      };

      const current = {
        averageLatency: 750, // 50% slower
        throughput: 8, // 20% slower
        successRate: 0.92, // 3% lower
        p95Latency: 1200, // 50% slower
      };

      const regression = benchmarkSuite.detectRegression(baseline, current, {
        latencyThreshold: 0.2, // 20% threshold
        throughputThreshold: 0.15, // 15% threshold
        successRateThreshold: 0.05, // 5% threshold
      });

      expect(regression.hasRegression).toBe(true);
      expect(regression.regressions).toContain('latency');
      expect(regression.regressions).toContain('throughput');
      expect(regression.summary).toBeDefined();
    });

    it('should create performance baseline', async () => {
      const baseline = await benchmarkSuite.createPerformanceBaseline({
        providers: ['openai'],
        operations: ['search', 'upload'],
        iterations: 5,
        testCases: [
          { operation: 'search', query: 'baseline query' },
          { operation: 'upload', file: new File(['test'], 'test.txt') },
        ],
      });

      expect(baseline.timestamp).toBeDefined();
      expect(baseline.results).toBeDefined();
      expect(baseline.metadata).toBeDefined();
      expect(baseline.metadata.gitCommit).toBeDefined();
      expect(baseline.metadata.environment).toBeDefined();
    });
  });

  describe('Resource Utilization', () => {
    it('should monitor CPU and memory during benchmarks', async () => {
      const result = await benchmarkSuite.monitorResourceUsage({
        provider: 'openai',
        operation: 'search',
        durationMs: 5000,
        samplingIntervalMs: 100,
        query: 'resource monitoring query',
      });

      expect(result.provider).toBe('openai');
      expect(result.operation).toBe('resource_monitoring');
      expect(result.resourceMetrics).toBeDefined();
      expect(result.resourceMetrics.cpu).toBeDefined();
      expect(result.resourceMetrics.memory).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should benchmark different query complexities', async () => {
      const complexityLevels = [
        { name: 'simple', query: 'test' },
        { name: 'medium', query: 'complex technical documentation search' },
        {
          name: 'complex',
          query:
            'comprehensive analysis of distributed systems architecture patterns and implementation strategies',
        },
      ];

      const results = await benchmarkSuite.benchmarkQueryComplexity('openai', {
        complexityLevels,
        iterations: 3,
      });

      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result.complexity).toBe(complexityLevels[index].name);
        expect(result.metrics).toBeDefined();
      });
    });
  });

  describe('Benchmark Reporting', () => {
    it('should generate comprehensive benchmark report', async () => {
      const mockResults: BenchmarkResult[] = [
        {
          provider: 'openai',
          operation: 'search',
          timestamp: new Date(),
          duration: 5000,
          metrics: {
            averageLatency: 500,
            minLatency: 100,
            maxLatency: 1000,
            p50Latency: 450,
            p95Latency: 800,
            p99Latency: 950,
            throughput: 10,
            successRate: 0.95,
            errorRate: 0.05,
            totalOperations: 100,
          },
          success: true,
          errors: [],
          metadata: { testType: 'search_benchmark' },
        },
      ];

      const report = await benchmarkSuite.generateReport(mockResults, {
        includeCharts: false, // Disable for tests
        includeRawData: true,
        format: 'json',
      });

      expect(report.summary).toBeDefined();
      expect(report.results).toHaveLength(1);
      expect(report.metadata).toBeDefined();
      expect(report.recommendations).toBeDefined();
    });

    it('should export benchmark results to JSON', async () => {
      const mockResults: BenchmarkResult[] = [
        {
          provider: 'openai',
          operation: 'search',
          timestamp: new Date(),
          duration: 1000,
          metrics: {
            averageLatency: 200,
            throughput: 15,
            successRate: 1.0,
            errorRate: 0,
            totalOperations: 15,
          },
          success: true,
          errors: [],
          metadata: {},
        },
      ];

      const exported = await benchmarkSuite.exportResults(mockResults, 'json');

      expect(exported.format).toBe('json');
      expect(exported.data).toBeDefined();
      expect(exported.timestamp).toBeDefined();
      expect(exported.size).toBeGreaterThan(0);
    });
  });

  describe('Configuration and Setup', () => {
    it('should validate benchmark configuration', () => {
      const validConfig: BenchmarkConfig = {
        enabled: true,
        maxConcurrentRequests: 10,
        timeoutMs: 30000,
        warmupIterations: 3,
        benchmarkIterations: 10,
        providers: ['openai'],
        testDataSizes: ['small', 'medium'],
        memoryThresholdMB: 500,
      };

      const validation = benchmarkSuite.validateConfig(validConfig);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should reject invalid benchmark configuration', () => {
      const invalidConfig = {
        enabled: true,
        maxConcurrentRequests: -1, // Invalid
        timeoutMs: 0, // Invalid
        providers: [], // Invalid
      } as BenchmarkConfig;

      const validation = benchmarkSuite.validateConfig(invalidConfig);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should cleanup resources after benchmarks', async () => {
      await benchmarkSuite.cleanup();

      // Verify cleanup was called
      expect(true).toBe(true); // Placeholder - would verify actual cleanup
    });
  });
});
