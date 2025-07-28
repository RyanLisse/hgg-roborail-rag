import "server-only";

import { z } from "zod";
import { getVectorStoreMonitoringService } from "./monitoring";
import {
  createPerformanceBenchmarkSuite,
  type BenchmarkConfig,
} from "./performance-benchmarks";

// Load testing specific schemas
export const LoadTestScenario = z.object({
  name: z.string(),
  description: z.string(),
  provider: z.enum(["openai", "neon", "supabase", "unified", "memory"]),
  operation: z.enum(["search", "upload", "mixed"]),
  loadPattern: z.enum(["constant", "ramp_up", "spike", "stress", "soak"]),
  duration: z.number().min(1000), // milliseconds
  users: z.object({
    initial: z.number().min(1),
    peak: z.number().min(1),
    rampUpTime: z.number().min(0),
    rampDownTime: z.number().min(0),
  }),
  thresholds: z.object({
    avgResponseTime: z.number().default(2000),
    p95ResponseTime: z.number().default(5000),
    errorRate: z.number().min(0).max(1).default(0.05),
    throughput: z.number().min(0).default(1),
  }),
  testData: z.object({
    queries: z.array(z.string()).optional(),
    files: z.array(z.string()).optional(), // File paths or content
    weights: z.record(z.number()).optional(), // Operation weights for mixed tests
  }),
});

export const LoadTestResult = z.object({
  scenario: LoadTestScenario,
  startTime: z.date(),
  endTime: z.date(),
  duration: z.number(),
  totalRequests: z.number(),
  successfulRequests: z.number(),
  failedRequests: z.number(),
  metrics: z.object({
    avgResponseTime: z.number(),
    minResponseTime: z.number(),
    maxResponseTime: z.number(),
    p50ResponseTime: z.number(),
    p95ResponseTime: z.number(),
    p99ResponseTime: z.number(),
    throughput: z.number(),
    errorRate: z.number(),
    requestsPerSecond: z.array(z.number()),
    responseTimesOverTime: z.array(
      z.object({
        timestamp: z.number(),
        avgResponseTime: z.number(),
      }),
    ),
    errorsByType: z.record(z.number()),
  }),
  thresholdViolations: z.array(
    z.object({
      metric: z.string(),
      threshold: z.number(),
      actual: z.number(),
      severity: z.enum(["warning", "critical"]),
    }),
  ),
  resourceUsage: z.object({
    cpu: z.object({
      avg: z.number(),
      peak: z.number(),
    }),
    memory: z.object({
      avg: z.number(),
      peak: z.number(),
    }),
  }),
  passed: z.boolean(),
  summary: z.string(),
});

export const ConcurrentUserSimulation = z.object({
  userId: z.string(),
  scenario: z.string(),
  operations: z.array(
    z.object({
      operation: z.string(),
      startTime: z.number(),
      endTime: z.number(),
      success: z.boolean(),
      responseTime: z.number(),
      error: z.string().optional(),
    }),
  ),
  totalOperations: z.number(),
  successfulOperations: z.number(),
  avgResponseTime: z.number(),
});

// Types
export type LoadTestScenario = z.infer<typeof LoadTestScenario>;
export type LoadTestResult = z.infer<typeof LoadTestResult>;
export type ConcurrentUserSimulation = z.infer<typeof ConcurrentUserSimulation>;

// Virtual user simulation
class VirtualUser {
  private readonly id: string;
  private readonly scenario: LoadTestScenario;
  private readonly vectorStoreService: any;
  private readonly operations: Array<{
    operation: string;
    startTime: number;
    endTime: number;
    success: boolean;
    responseTime: number;
    error?: string;
  }> = [];
  private isRunning = false;

  constructor(id: string, scenario: LoadTestScenario, vectorStoreService: any) {
    this.id = id;
    this.scenario = scenario;
    this.vectorStoreService = vectorStoreService;
  }

  async start(): Promise<void> {
    this.isRunning = true;
    const endTime = Date.now() + this.scenario.duration;

    while (this.isRunning && Date.now() < endTime) {
      const operation = this.selectOperation();
      await this.executeOperation(operation);

      // Think time between operations (1-3 seconds)
      const thinkTime = Math.random() * 2000 + 1000;
      await this.sleep(thinkTime);
    }
  }

  stop(): void {
    this.isRunning = false;
  }

  getResults(): ConcurrentUserSimulation {
    const successfulOperations = this.operations.filter(
      (op) => op.success,
    ).length;
    const avgResponseTime =
      this.operations.length > 0
        ? this.operations.reduce((sum, op) => sum + op.responseTime, 0) /
          this.operations.length
        : 0;

    return {
      userId: this.id,
      scenario: this.scenario.name,
      operations: this.operations,
      totalOperations: this.operations.length,
      successfulOperations,
      avgResponseTime,
    };
  }

  private selectOperation(): string {
    if (this.scenario.operation === "mixed" && this.scenario.testData.weights) {
      // Weighted random selection
      const weights = this.scenario.testData.weights;
      const totalWeight = Object.values(weights).reduce(
        (sum, weight) => sum + weight,
        0,
      );
      let random = Math.random() * totalWeight;

      for (const [operation, weight] of Object.entries(weights)) {
        random -= weight;
        if (random <= 0) {
          return operation;
        }
      }
    }

    return this.scenario.operation;
  }

  private async executeOperation(operation: string): Promise<void> {
    const startTime = Date.now();
    let success = false;
    let error: string | undefined;

    try {
      if (operation === "search" || this.scenario.operation === "search") {
        const queries = this.scenario.testData.queries || [
          "default search query",
        ];
        const query = queries[Math.floor(Math.random() * queries.length)];
        const result = await this.vectorStoreService.searchFiles({ query });
        success = result.success;
        if (!success) {
          error = result.message || "Search failed";
        }
      } else if (
        operation === "upload" ||
        this.scenario.operation === "upload"
      ) {
        // Create a test file for upload
        const content = `Test file content ${Math.random()}`;
        const file = new File([content], `test-${Date.now()}.txt`, {
          type: "text/plain",
        });
        const result = await this.vectorStoreService.uploadFile({ file });
        success = !!result.id;
        if (!success) {
          error = "Upload failed";
        }
      }
    } catch (err) {
      success = false;
      error = err instanceof Error ? err.message : String(err);
    }

    const endTime = Date.now();
    this.operations.push({
      operation,
      startTime,
      endTime,
      success,
      responseTime: endTime - startTime,
      error,
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Load pattern generators
class LoadPatternGenerator {
  static generateUserCount(
    pattern: LoadTestScenario["loadPattern"],
    users: LoadTestScenario["users"],
    currentTime: number,
    totalDuration: number,
  ): number {
    const progress = currentTime / totalDuration;

    switch (pattern) {
      case "constant":
        return users.peak;

      case "ramp_up":
        if (currentTime < users.rampUpTime) {
          const rampProgress = currentTime / users.rampUpTime;
          return Math.floor(
            users.initial + (users.peak - users.initial) * rampProgress,
          );
        }
        return users.peak;

      case "spike": {
        // Quick ramp up, then constant load
        const spikeRampTime = totalDuration * 0.1; // 10% of total time
        if (currentTime < spikeRampTime) {
          const spikeProgress = currentTime / spikeRampTime;
          return Math.floor(
            users.initial + (users.peak - users.initial) * spikeProgress,
          );
        }
        return users.peak;
      }

      case "stress": {
        // Gradually increase load beyond peak
        const stressMultiplier = 1 + progress;
        return Math.floor(users.peak * stressMultiplier);
      }

      case "soak":
        // Long duration constant load
        return users.peak;

      default:
        return users.peak;
    }
  }
}

// Resource monitoring during load tests
class LoadTestResourceMonitor {
  private readonly cpuSamples: number[] = [];
  private readonly memorySamples: number[] = [];
  private interval: NodeJS.Timeout | null = null;

  start(samplingInterval: number = 1000): void {
    this.interval = setInterval(() => {
      this.collectSample();
    }, samplingInterval);
  }

  stop(): {
    cpu: { avg: number; peak: number };
    memory: { avg: number; peak: number };
  } {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    const cpuAvg =
      this.cpuSamples.length > 0
        ? this.cpuSamples.reduce((sum, val) => sum + val, 0) /
          this.cpuSamples.length
        : 0;
    const cpuPeak =
      this.cpuSamples.length > 0 ? Math.max(...this.cpuSamples) : 0;

    const memoryAvg =
      this.memorySamples.length > 0
        ? this.memorySamples.reduce((sum, val) => sum + val, 0) /
          this.memorySamples.length
        : 0;
    const memoryPeak =
      this.memorySamples.length > 0 ? Math.max(...this.memorySamples) : 0;

    return {
      cpu: { avg: cpuAvg, peak: cpuPeak },
      memory: { avg: memoryAvg, peak: memoryPeak },
    };
  }

  private collectSample(): void {
    // CPU usage approximation (Node.js doesn't provide direct CPU usage)
    // Note: This is a placeholder implementation
    this.cpuSamples.push(Math.random() * 100);

    // Memory usage
    if (typeof process !== "undefined" && process.memoryUsage) {
      const memUsage = process.memoryUsage();
      this.memorySamples.push(memUsage.heapUsed / 1024 / 1024); // MB
    } else {
      this.memorySamples.push(0);
    }
  }
}

// Main load testing engine
export class LoadTestingEngine {
  private readonly monitoringService: ReturnType<
    typeof getVectorStoreMonitoringService
  >;
  private readonly benchmarkSuite: ReturnType<
    typeof createPerformanceBenchmarkSuite
  >;

  constructor(benchmarkConfig?: BenchmarkConfig) {
    this.monitoringService = getVectorStoreMonitoringService();
    this.benchmarkSuite = createPerformanceBenchmarkSuite(
      benchmarkConfig || {
        enabled: true,
        maxConcurrentRequests: 50,
        timeoutMs: 60_000,
        warmupIterations: 0,
        benchmarkIterations: 1,
        providers: ["openai", "neon", "unified"],
        testDataSizes: ["small", "medium", "large"],
        memoryThresholdMB: 1000,
        outputDirectory: "./benchmark-results",
        reportFormat: "json",
      },
    );
  }

  async runLoadTest(scenario: LoadTestScenario): Promise<LoadTestResult> {
    const startTime = new Date();
    const resourceMonitor = new LoadTestResourceMonitor();
    const virtualUsers: VirtualUser[] = [];
    const allOperations: Array<{
      startTime: number;
      endTime: number;
      success: boolean;
      responseTime: number;
      error?: string;
    }> = [];

    // Get vector store service
    const vectorStoreService = await this.getVectorStoreService(
      scenario.provider,
    );

    resourceMonitor.start(1000);

    try {
      // Run load test based on pattern
      await this.executeLoadPattern(
        scenario,
        vectorStoreService,
        virtualUsers,
        allOperations,
      );

      // Collect results from all virtual users
      const { totalRequests, successfulRequests } = this.collectUserResults(
        virtualUsers,
        allOperations,
      );
      const failedRequests = totalRequests - successfulRequests;

      // Calculate metrics
      const metrics = this.calculateMetrics(
        allOperations,
        startTime,
        successfulRequests,
        totalRequests,
        failedRequests,
      );

      // Check threshold violations
      const thresholdViolations = this.checkThresholdViolations(
        scenario,
        metrics,
      );

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      const resourceUsage = resourceMonitor.stop();
      const passed =
        thresholdViolations.filter((v) => v.severity === "critical").length ===
        0;

      const summary = passed
        ? `Load test passed. ${successfulRequests}/${totalRequests} requests successful.`
        : `Load test failed. ${thresholdViolations.length} threshold violations detected.`;

      return LoadTestResult.parse({
        scenario,
        startTime,
        endTime,
        duration,
        totalRequests,
        successfulRequests,
        failedRequests,
        metrics,
        thresholdViolations,
        resourceUsage,
        passed,
        summary,
      });
    } finally {
      // Cleanup
      virtualUsers.forEach((user) => user.stop());
      resourceMonitor.stop();
    }
  }

  private collectUserResults(
    virtualUsers: VirtualUser[],
    allOperations: Array<any>,
  ): { totalRequests: number; successfulRequests: number } {
    let totalRequests = 0;
    let successfulRequests = 0;

    for (const user of virtualUsers) {
      const userResults = user.getResults();
      totalRequests += userResults.totalOperations;
      successfulRequests += userResults.successfulOperations;
      allOperations.push(...userResults.operations);
    }

    return { totalRequests, successfulRequests };
  }

  private calculateMetrics(
    allOperations: Array<any>,
    startTime: Date,
    successfulRequests: number,
    totalRequests: number,
    failedRequests: number,
  ): any {
    const responseTimes = allOperations.map((op) => op.responseTime);
    const sortedResponseTimes = [...responseTimes].sort((a, b) => a - b);

    const avgResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((sum, time) => sum + time, 0) /
          responseTimes.length
        : 0;

    const minResponseTime = sortedResponseTimes[0] || 0;
    const maxResponseTime =
      sortedResponseTimes[sortedResponseTimes.length - 1] || 0;
    const p50ResponseTime =
      sortedResponseTimes[Math.floor(sortedResponseTimes.length * 0.5)] || 0;
    const p95ResponseTime =
      sortedResponseTimes[Math.floor(sortedResponseTimes.length * 0.95)] || 0;
    const p99ResponseTime =
      sortedResponseTimes[Math.floor(sortedResponseTimes.length * 0.99)] || 0;

    const duration = Date.now() - startTime.getTime();
    const throughput =
      duration > 0 ? (successfulRequests / duration) * 1000 : 0;
    const errorRate = totalRequests > 0 ? failedRequests / totalRequests : 0;

    // Generate time-series data
    const { requestsPerSecond, responseTimesOverTime } =
      this.generateTimeSeriesData(allOperations, startTime, duration);

    // Count errors by type
    const errorsByType: Record<string, number> = {};
    allOperations.forEach((op) => {
      if (op.error) {
        errorsByType[op.error] = (errorsByType[op.error] || 0) + 1;
      }
    });

    return {
      avgResponseTime,
      minResponseTime,
      maxResponseTime,
      p50ResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      throughput,
      errorRate,
      requestsPerSecond,
      responseTimesOverTime,
      errorsByType,
    };
  }

  private generateTimeSeriesData(
    allOperations: Array<any>,
    startTime: Date,
    duration: number,
  ): {
    requestsPerSecond: number[];
    responseTimesOverTime: Array<{
      timestamp: number;
      avgResponseTime: number;
    }>;
  } {
    const requestsPerSecond: number[] = [];
    const responseTimesOverTime: Array<{
      timestamp: number;
      avgResponseTime: number;
    }> = [];

    const timeWindow = 5000; // 5-second windows
    for (let time = 0; time < duration; time += timeWindow) {
      const windowStart = startTime.getTime() + time;
      const windowEnd = windowStart + timeWindow;

      const windowOperations = allOperations.filter(
        (op) => op.startTime >= windowStart && op.startTime < windowEnd,
      );

      requestsPerSecond.push((windowOperations.length / timeWindow) * 1000);

      const windowAvgResponseTime =
        windowOperations.length > 0
          ? windowOperations.reduce((sum, op) => sum + op.responseTime, 0) /
            windowOperations.length
          : 0;

      responseTimesOverTime.push({
        timestamp: windowStart,
        avgResponseTime: windowAvgResponseTime,
      });
    }

    return { requestsPerSecond, responseTimesOverTime };
  }

  private checkThresholdViolations(
    scenario: LoadTestScenario,
    metrics: any,
  ): Array<{
    metric: string;
    threshold: number;
    actual: number;
    severity: "warning" | "critical";
  }> {
    const thresholdViolations: Array<{
      metric: string;
      threshold: number;
      actual: number;
      severity: "warning" | "critical";
    }> = [];

    if (metrics.avgResponseTime > scenario.thresholds.avgResponseTime) {
      thresholdViolations.push({
        metric: "avgResponseTime",
        threshold: scenario.thresholds.avgResponseTime,
        actual: metrics.avgResponseTime,
        severity:
          metrics.avgResponseTime > scenario.thresholds.avgResponseTime * 1.5
            ? "critical"
            : "warning",
      });
    }

    if (metrics.p95ResponseTime > scenario.thresholds.p95ResponseTime) {
      thresholdViolations.push({
        metric: "p95ResponseTime",
        threshold: scenario.thresholds.p95ResponseTime,
        actual: metrics.p95ResponseTime,
        severity:
          metrics.p95ResponseTime > scenario.thresholds.p95ResponseTime * 1.5
            ? "critical"
            : "warning",
      });
    }

    if (metrics.errorRate > scenario.thresholds.errorRate) {
      thresholdViolations.push({
        metric: "errorRate",
        threshold: scenario.thresholds.errorRate,
        actual: metrics.errorRate,
        severity:
          metrics.errorRate > scenario.thresholds.errorRate * 2
            ? "critical"
            : "warning",
      });
    }

    if (metrics.throughput < scenario.thresholds.throughput) {
      thresholdViolations.push({
        metric: "throughput",
        threshold: scenario.thresholds.throughput,
        actual: metrics.throughput,
        severity:
          metrics.throughput < scenario.thresholds.throughput * 0.5
            ? "critical"
            : "warning",
      });
    }

    return thresholdViolations;
  }

  private async executeLoadPattern(
    scenario: LoadTestScenario,
    vectorStoreService: any,
    virtualUsers: VirtualUser[],
    allOperations: Array<any>,
  ): Promise<void> {
    const startTime = Date.now();
    const endTime = startTime + scenario.duration;
    const checkInterval = 1000; // Check every second

    while (Date.now() < endTime) {
      const currentTime = Date.now() - startTime;
      const remainingTime = endTime - Date.now();

      const targetUserCount = LoadPatternGenerator.generateUserCount(
        scenario.loadPattern,
        scenario.users,
        currentTime,
        scenario.duration,
      );

      // Adjust user count
      while (virtualUsers.length < targetUserCount) {
        const userId = `user-${virtualUsers.length + 1}`;
        const user = new VirtualUser(userId, scenario, vectorStoreService);
        virtualUsers.push(user);

        // Start user with remaining time
        user.start().catch((error) => {
          console.error(`Virtual user ${userId} error:`, error);
        });
      }

      // Stop excess users
      while (virtualUsers.length > targetUserCount) {
        const user = virtualUsers.pop();
        if (user) {
          user.stop();
        }
      }

      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(checkInterval, remainingTime)),
      );
    }
  }

  async runMultipleScenarios(
    scenarios: LoadTestScenario[],
  ): Promise<LoadTestResult[]> {
    const results: LoadTestResult[] = [];

    for (const scenario of scenarios) {
      try {
        console.log(`Running load test scenario: ${scenario.name}`);
        const result = await this.runLoadTest(scenario);
        results.push(result);

        // Brief pause between scenarios
        await new Promise((resolve) => setTimeout(resolve, 5000));
      } catch (error) {
        console.error(`Failed to run scenario ${scenario.name}:`, error);

        // Create failed result
        results.push(
          LoadTestResult.parse({
            scenario,
            startTime: new Date(),
            endTime: new Date(),
            duration: 0,
            totalRequests: 0,
            successfulRequests: 0,
            failedRequests: 0,
            metrics: {
              avgResponseTime: 0,
              minResponseTime: 0,
              maxResponseTime: 0,
              p50ResponseTime: 0,
              p95ResponseTime: 0,
              p99ResponseTime: 0,
              throughput: 0,
              errorRate: 1,
              requestsPerSecond: [],
              responseTimesOverTime: [],
              errorsByType: { scenario_failure: 1 },
            },
            thresholdViolations: [
              {
                metric: "scenario_execution",
                threshold: 1,
                actual: 0,
                severity: "critical",
              },
            ],
            resourceUsage: {
              cpu: { avg: 0, peak: 0 },
              memory: { avg: 0, peak: 0 },
            },
            passed: false,
            summary: `Scenario failed: ${error instanceof Error ? error.message : String(error)}`,
          }),
        );
      }
    }

    return results;
  }

  generateLoadTestReport(results: LoadTestResult[]): {
    summary: {
      totalScenarios: number;
      passedScenarios: number;
      failedScenarios: number;
      totalRequests: number;
      overallSuccessRate: number;
      averageResponseTime: number;
    };
    scenarios: Array<{
      name: string;
      passed: boolean;
      summary: string;
      keyMetrics: {
        totalRequests: number;
        successRate: number;
        avgResponseTime: number;
        throughput: number;
      };
    }>;
    recommendations: string[];
  } {
    const totalScenarios = results.length;
    const passedScenarios = results.filter((r) => r.passed).length;
    const failedScenarios = totalScenarios - passedScenarios;

    const totalRequests = results.reduce((sum, r) => sum + r.totalRequests, 0);
    const totalSuccessful = results.reduce(
      (sum, r) => sum + r.successfulRequests,
      0,
    );
    const overallSuccessRate =
      totalRequests > 0 ? totalSuccessful / totalRequests : 0;

    const averageResponseTime =
      results.length > 0
        ? results.reduce((sum, r) => sum + r.metrics.avgResponseTime, 0) /
          results.length
        : 0;

    const scenarios = results.map((result) => ({
      name: result.scenario.name,
      passed: result.passed,
      summary: result.summary,
      keyMetrics: {
        totalRequests: result.totalRequests,
        successRate:
          result.totalRequests > 0
            ? result.successfulRequests / result.totalRequests
            : 0,
        avgResponseTime: result.metrics.avgResponseTime,
        throughput: result.metrics.throughput,
      },
    }));

    // Generate recommendations
    const recommendations: string[] = [];

    if (failedScenarios > 0) {
      recommendations.push(
        `${failedScenarios} out of ${totalScenarios} scenarios failed. Review threshold violations.`,
      );
    }

    if (overallSuccessRate < 0.95) {
      recommendations.push(
        "Overall success rate is below 95%. Investigate error causes.",
      );
    }

    if (averageResponseTime > 2000) {
      recommendations.push(
        "High average response time detected. Consider performance optimizations.",
      );
    }

    const highErrorRateScenarios = results.filter(
      (r) => r.metrics.errorRate > 0.1,
    );
    if (highErrorRateScenarios.length > 0) {
      recommendations.push(
        `${highErrorRateScenarios.length} scenarios have error rates above 10%.`,
      );
    }

    return {
      summary: {
        totalScenarios,
        passedScenarios,
        failedScenarios,
        totalRequests,
        overallSuccessRate,
        averageResponseTime,
      },
      scenarios,
      recommendations,
    };
  }

  private async getVectorStoreService(provider: string): Promise<any> {
    // This would be implemented to return the appropriate service
    // For now, we'll use a mock implementation
    return {
      searchFiles: async ({ query }: { query: string }) => {
        // Simulate varying response times and occasional failures
        const responseTime = Math.random() * 2000 + 100;
        await new Promise((resolve) => setTimeout(resolve, responseTime));

        const success = Math.random() > 0.05; // 95% success rate
        return {
          success,
          results: success
            ? [{ id: "1", content: `Result for: ${query}` }]
            : [],
          message: success ? "Success" : "Search failed",
        };
      },
      uploadFile: async ({ file }: { file: File }) => {
        const responseTime = Math.random() * 3000 + 200;
        await new Promise((resolve) => setTimeout(resolve, responseTime));

        const success = Math.random() > 0.03; // 97% success rate
        return success ? { id: `file-${Date.now()}` } : null;
      },
    };
  }
}

// Predefined load test scenarios
export const PREDEFINED_SCENARIOS: LoadTestScenario[] = [
  {
    name: "Basic Search Load Test",
    description: "Tests basic search functionality under moderate load",
    provider: "openai",
    operation: "search",
    loadPattern: "constant",
    duration: 60_000, // 1 minute
    users: {
      initial: 5,
      peak: 10,
      rampUpTime: 10_000,
      rampDownTime: 10_000,
    },
    thresholds: {
      avgResponseTime: 2000,
      p95ResponseTime: 5000,
      errorRate: 0.05,
      throughput: 5,
    },
    testData: {
      queries: [
        "machine learning algorithms",
        "database optimization techniques",
        "API design best practices",
        "cloud architecture patterns",
        "security vulnerabilities",
      ],
    },
  },
  {
    name: "Spike Test - Search",
    description: "Tests system behavior under sudden load spikes",
    provider: "unified",
    operation: "search",
    loadPattern: "spike",
    duration: 120_000, // 2 minutes
    users: {
      initial: 2,
      peak: 25,
      rampUpTime: 5_000,
      rampDownTime: 15_000,
    },
    thresholds: {
      avgResponseTime: 3000,
      p95ResponseTime: 8000,
      errorRate: 0.1,
      throughput: 10,
    },
    testData: {
      queries: [
        "complex distributed systems",
        "microservices architecture",
        "performance optimization",
      ],
    },
  },
  {
    name: "Stress Test - Mixed Operations",
    description: "Tests system limits with mixed search and upload operations",
    provider: "openai",
    operation: "mixed",
    loadPattern: "stress",
    duration: 180_000, // 3 minutes
    users: {
      initial: 5,
      peak: 30,
      rampUpTime: 30_000,
      rampDownTime: 30_000,
    },
    thresholds: {
      avgResponseTime: 4000,
      p95ResponseTime: 10_000,
      errorRate: 0.15,
      throughput: 8,
    },
    testData: {
      queries: [
        "system integration",
        "data processing pipelines",
        "real-time analytics",
      ],
      weights: {
        search: 0.8,
        upload: 0.2,
      },
    },
  },
  {
    name: "Soak Test - Extended Load",
    description: "Tests system stability over extended periods",
    provider: "unified",
    operation: "search",
    loadPattern: "soak",
    duration: 600_000, // 10 minutes
    users: {
      initial: 8,
      peak: 12,
      rampUpTime: 60_000,
      rampDownTime: 60_000,
    },
    thresholds: {
      avgResponseTime: 2500,
      p95ResponseTime: 6000,
      errorRate: 0.08,
      throughput: 6,
    },
    testData: {
      queries: [
        "long running processes",
        "memory management",
        "resource optimization",
        "concurrent operations",
      ],
    },
  },
];

// Factory function
export function createLoadTestingEngine(
  benchmarkConfig?: BenchmarkConfig,
): LoadTestingEngine {
  return new LoadTestingEngine(benchmarkConfig);
}
