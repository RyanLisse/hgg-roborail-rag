import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  createPerformanceBenchmarkSuite,
  DEFAULT_BENCHMARK_CONFIG,
  type BenchmarkResult,
} from "@/lib/vectorstore/performance-benchmarks";
import {
  createLoadTestingEngine,
  PREDEFINED_SCENARIOS,
  type LoadTestResult,
} from "@/lib/vectorstore/load-testing";

// Request schemas
const BenchmarkRequest = z.object({
  action: z.enum([
    "search_latency",
    "upload_performance",
    "concurrent_operations",
    "provider_comparison",
    "stress_test",
    "endurance_test",
    "memory_leak_test",
    "load_test",
    "create_baseline",
    "detect_regression",
    "generate_report",
  ]),
  provider: z
    .enum(["openai", "neon", "supabase", "unified", "memory"])
    .optional(),
  config: z
    .object({
      iterations: z.number().min(1).max(100).default(10),
      warmupIterations: z.number().min(0).max(20).default(3),
      concurrency: z.number().min(1).max(50).default(5),
      timeoutMs: z.number().min(1000).max(300_000).default(30_000),
      maxResults: z.number().min(1).max(100).default(10),
    })
    .optional(),
  testData: z
    .object({
      queries: z.array(z.string()).optional(),
      files: z.array(z.string()).optional(),
      complexityLevels: z
        .array(
          z.object({
            name: z.string(),
            query: z.string(),
          }),
        )
        .optional(),
    })
    .optional(),
  loadTestScenario: z.string().optional(), // Predefined scenario name
  baseline: z
    .object({
      averageLatency: z.number(),
      throughput: z.number(),
      successRate: z.number(),
      p95Latency: z.number(),
    })
    .optional(),
  thresholds: z
    .object({
      latencyThreshold: z.number().min(0).max(1).default(0.2),
      throughputThreshold: z.number().min(0).max(1).default(0.15),
      successRateThreshold: z.number().min(0).max(1).default(0.05),
    })
    .optional(),
});

// Default test data
const DEFAULT_TEST_QUERIES = [
  "machine learning algorithms",
  "database optimization techniques",
  "API design best practices",
  "distributed systems architecture",
  "performance monitoring",
];

const DEFAULT_COMPLEXITY_LEVELS = [
  { name: "simple", query: "test" },
  { name: "medium", query: "complex technical documentation search" },
  {
    name: "complex",
    query:
      "comprehensive analysis of distributed systems architecture patterns and implementation strategies",
  },
];

// Helper functions
function createTestFiles(): File[] {
  const files = [
    new File(["Small test content"], "small.txt", { type: "text/plain" }),
    new File(["Medium test content ".repeat(100)], "medium.txt", {
      type: "text/plain",
    }),
    new File(["Large test content ".repeat(1000)], "large.txt", {
      type: "text/plain",
    }),
  ];
  return files;
}

async function handleSearchLatencyBenchmark(
  provider: string,
  config: any,
  testData: any,
): Promise<BenchmarkResult> {
  const benchmarkSuite = createPerformanceBenchmarkSuite(
    DEFAULT_BENCHMARK_CONFIG,
  );

  const queries = testData?.queries || DEFAULT_TEST_QUERIES;
  const iterations = config?.iterations || 10;
  const warmupIterations = config?.warmupIterations || 3;
  const maxResults = config?.maxResults || 10;

  return await benchmarkSuite.benchmarkSearchLatency(provider, {
    queries,
    iterations,
    warmupIterations,
    maxResults,
    includeContent: true,
  });
}

async function handleUploadPerformanceBenchmark(
  provider: string,
  config: any,
): Promise<BenchmarkResult> {
  const benchmarkSuite = createPerformanceBenchmarkSuite(
    DEFAULT_BENCHMARK_CONFIG,
  );

  const files = createTestFiles();
  const iterations = config?.iterations || 5;
  const warmupIterations = config?.warmupIterations || 2;

  return await benchmarkSuite.benchmarkUploadPerformance(provider, {
    files,
    iterations,
    warmupIterations,
  });
}

async function handleConcurrentOperationsBenchmark(
  provider: string,
  config: any,
  testData: any,
): Promise<BenchmarkResult> {
  const benchmarkSuite = createPerformanceBenchmarkSuite(
    DEFAULT_BENCHMARK_CONFIG,
  );

  const queries = testData?.queries || DEFAULT_TEST_QUERIES;
  const concurrency = config?.concurrency || 5;
  const iterations = config?.iterations || 3;

  return await benchmarkSuite.benchmarkConcurrentOperations(provider, {
    operation: "search",
    concurrency,
    iterations,
    queries,
  });
}

async function handleProviderComparison(
  providers: string[],
  config: any,
  testData: any,
): Promise<BenchmarkResult[]> {
  const benchmarkSuite = createPerformanceBenchmarkSuite(
    DEFAULT_BENCHMARK_CONFIG,
  );

  const queries = testData?.queries || DEFAULT_TEST_QUERIES;
  const iterations = config?.iterations || 5;

  const testCases = queries.map((query) => ({ query, expectedResults: 5 }));

  return await benchmarkSuite.compareProviders({
    operation: "search",
    providers,
    testCases,
    iterations,
  });
}

async function handleStressTest(
  provider: string,
  config: any,
  testData: any,
): Promise<any> {
  const benchmarkSuite = createPerformanceBenchmarkSuite(
    DEFAULT_BENCHMARK_CONFIG,
  );

  const query = testData?.queries?.[0] || DEFAULT_TEST_QUERIES[0];

  return await benchmarkSuite.stressTest({
    provider,
    operation: "search",
    startConcurrency: 1,
    maxConcurrency: config?.concurrency || 10,
    stepSize: 2,
    stepDurationMs: 5000,
    query,
  });
}

async function handleEnduranceTest(
  provider: string,
  config: any,
  testData: any,
): Promise<any> {
  const benchmarkSuite = createPerformanceBenchmarkSuite(
    DEFAULT_BENCHMARK_CONFIG,
  );

  const queries = testData?.queries || DEFAULT_TEST_QUERIES;
  const concurrency = config?.concurrency || 3;
  const durationMs = config?.timeoutMs || 30_000;

  return await benchmarkSuite.enduranceTest({
    provider,
    operation: "search",
    concurrency,
    durationMs,
    queries,
  });
}

async function handleMemoryLeakTest(
  provider: string,
  config: any,
  testData: any,
): Promise<any> {
  const benchmarkSuite = createPerformanceBenchmarkSuite(
    DEFAULT_BENCHMARK_CONFIG,
  );

  const query = testData?.queries?.[0] || DEFAULT_TEST_QUERIES[0];
  const iterations = config?.iterations || 50;

  return await benchmarkSuite.memoryLeakTest({
    provider,
    operation: "search",
    iterations,
    memoryThresholdMB: 100,
    query,
  });
}

async function handleLoadTest(scenarioName: string): Promise<LoadTestResult> {
  const loadTestEngine = createLoadTestingEngine();

  const scenario = PREDEFINED_SCENARIOS.find((s) => s.name === scenarioName);
  if (!scenario) {
    throw new Error(`Unknown load test scenario: ${scenarioName}`);
  }

  return await loadTestEngine.runLoadTest(scenario);
}

async function handleCreateBaseline(
  providers: string[],
  config: any,
  testData: any,
): Promise<any> {
  const benchmarkSuite = createPerformanceBenchmarkSuite(
    DEFAULT_BENCHMARK_CONFIG,
  );

  const queries = testData?.queries || DEFAULT_TEST_QUERIES;
  const iterations = config?.iterations || 10;

  const testCases = [
    ...queries.map((query) => ({ operation: "search", query })),
    ...createTestFiles()
      .slice(0, 2)
      .map((file) => ({ operation: "upload", file })),
  ];

  return await benchmarkSuite.createPerformanceBaseline({
    providers,
    operations: ["search", "upload"],
    iterations,
    testCases,
  });
}

function handleDetectRegression(
  baseline: any,
  current: any,
  thresholds: any,
): any {
  const benchmarkSuite = createPerformanceBenchmarkSuite(
    DEFAULT_BENCHMARK_CONFIG,
  );

  return benchmarkSuite.detectRegression(baseline, current, thresholds);
}

async function handleGenerateReport(results: BenchmarkResult[]): Promise<any> {
  const benchmarkSuite = createPerformanceBenchmarkSuite(
    DEFAULT_BENCHMARK_CONFIG,
  );

  return await benchmarkSuite.generateReport(results, {
    includeCharts: false,
    includeRawData: true,
    format: "json",
  });
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  try {
    // Handle simple status and info requests
    const action = searchParams.get("action");

    if (action === "status") {
      return NextResponse.json({
        success: true,
        data: {
          benchmarkingEnabled: true,
          availableProviders: [
            "openai",
            "neon",
            "supabase",
            "unified",
            "memory",
          ],
          availableActions: [
            "search_latency",
            "upload_performance",
            "concurrent_operations",
            "provider_comparison",
            "stress_test",
            "endurance_test",
            "memory_leak_test",
            "load_test",
            "create_baseline",
            "detect_regression",
            "generate_report",
          ],
          predefinedScenarios: PREDEFINED_SCENARIOS.map((s) => ({
            name: s.name,
            description: s.description,
            provider: s.provider,
            operation: s.operation,
            duration: s.duration,
          })),
        },
      });
    }

    if (action === "scenarios") {
      return NextResponse.json({
        success: true,
        data: {
          scenarios: PREDEFINED_SCENARIOS,
          count: PREDEFINED_SCENARIOS.length,
        },
      });
    }

    if (action === "config") {
      return NextResponse.json({
        success: true,
        data: {
          defaultConfig: DEFAULT_BENCHMARK_CONFIG,
          testQueries: DEFAULT_TEST_QUERIES,
          complexityLevels: DEFAULT_COMPLEXITY_LEVELS,
        },
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: "Invalid action. Use POST for benchmark execution.",
        availableActions: ["status", "scenarios", "config"],
      },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 },
    );
  }
}

interface BenchmarkActionOptions {
  action: string;
  provider?: string;
  config?: any;
  testData?: any;
  loadTestScenario?: string;
  baseline?: any;
  thresholds?: any;
  body: any;
}

async function executeProviderBenchmarks(
  options: BenchmarkActionOptions,
): Promise<any> {
  const { action, provider, config, testData } = options;

  if (!provider) {
    throw new Error(`Provider is required for ${action}`);
  }

  switch (action) {
    case "search_latency":
      return await handleSearchLatencyBenchmark(provider, config, testData);
    case "upload_performance":
      return await handleUploadPerformanceBenchmark(provider, config);
    case "concurrent_operations":
      return await handleConcurrentOperationsBenchmark(
        provider,
        config,
        testData,
      );
    case "stress_test":
      return await handleStressTest(provider, config, testData);
    case "endurance_test":
      return await handleEnduranceTest(provider, config, testData);
    case "memory_leak_test":
      return await handleMemoryLeakTest(provider, config, testData);
    default:
      throw new Error(`Unknown provider benchmark: ${action}`);
  }
}

async function executeSystemBenchmarks(
  options: BenchmarkActionOptions,
): Promise<any> {
  const {
    action,
    config,
    testData,
    loadTestScenario,
    baseline,
    thresholds,
    body,
  } = options;

  switch (action) {
    case "provider_comparison": {
      const providers = ["openai", "neon", "unified"];
      return await handleProviderComparison(providers, config, testData);
    }
    case "load_test":
      if (!loadTestScenario) {
        throw new Error("Load test scenario is required");
      }
      return await handleLoadTest(loadTestScenario);
    case "create_baseline": {
      const providers = ["openai", "neon", "unified"];
      return await handleCreateBaseline(providers, config, testData);
    }
    case "detect_regression":
      if (!baseline) {
        throw new Error(
          "Baseline metrics are required for regression detection",
        );
      }
      if (!body.current) {
        throw new Error(
          "Current metrics are required for regression detection",
        );
      }
      return handleDetectRegression(baseline, body.current, thresholds);
    case "generate_report":
      if (!body.results || !Array.isArray(body.results)) {
        throw new Error("Results array is required for report generation");
      }
      return await handleGenerateReport(body.results);
    default:
      throw new Error(`Unknown system benchmark: ${action}`);
  }
}

async function executeBenchmarkAction(
  options: BenchmarkActionOptions,
): Promise<any> {
  const { action } = options;

  const providerActions = [
    "search_latency",
    "upload_performance",
    "concurrent_operations",
    "stress_test",
    "endurance_test",
    "memory_leak_test",
  ];
  const systemActions = [
    "provider_comparison",
    "load_test",
    "create_baseline",
    "detect_regression",
    "generate_report",
  ];

  if (providerActions.includes(action)) {
    return await executeProviderBenchmarks(options);
  }

  if (systemActions.includes(action)) {
    return await executeSystemBenchmarks(options);
  }

  throw new Error(`Unknown action: ${action}`);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const params = BenchmarkRequest.parse(body);

    const {
      action,
      provider,
      config,
      testData,
      loadTestScenario,
      baseline,
      thresholds,
    } = params;

    const result = await executeBenchmarkAction({
      action,
      provider,
      config,
      testData,
      loadTestScenario,
      baseline,
      thresholds,
      body,
    });

    return NextResponse.json({
      success: true,
      data: result,
      timestamp: new Date(),
      action,
      provider,
    });
  } catch (error) {
    console.error("Benchmark API error:", error);

    if (error instanceof Error && error.message.startsWith("Unknown action:")) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          availableActions: [
            "search_latency",
            "upload_performance",
            "concurrent_operations",
            "provider_comparison",
            "stress_test",
            "endurance_test",
            "memory_leak_test",
            "load_test",
            "create_baseline",
            "detect_regression",
            "generate_report",
          ],
        },
        { status: 400 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
        timestamp: new Date(),
      },
      { status: 500 },
    );
  }
}
