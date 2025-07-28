# Performance Benchmarking Framework

This document provides comprehensive guidance on using the performance benchmarking framework for vector search operations in the RRA application.

## Overview

The performance benchmarking framework provides tools to:

- **Benchmark individual providers** (OpenAI, Neon, Supabase, Unified)
- **Compare performance** across multiple providers
- **Conduct load testing** with realistic user scenarios
- **Monitor memory usage** and detect memory leaks
- **Perform stress testing** to find breaking points
- **Generate detailed reports** with actionable insights
- **Detect performance regressions** against baselines

## Architecture

### Core Components

1. **Performance Benchmark Suite** (`lib/vectorstore/performance-benchmarks.ts`)

   - Main benchmarking engine
   - Metrics collection and analysis
   - Report generation

2. **Load Testing Engine** (`lib/vectorstore/load-testing.ts`)

   - Concurrent user simulation
   - Realistic load patterns
   - Resource monitoring

3. **Benchmark API** (`app/(chat)/api/vectorstore/benchmarks/route.ts`)

   - RESTful API for benchmark execution
   - Configuration management
   - Result persistence

4. **Dashboard Component** (`components/performance-benchmark-dashboard.tsx`)
   - Interactive UI for running benchmarks
   - Real-time results visualization
   - Historical data analysis

## Quick Start

### 1. Access the Dashboard

Navigate to the monitoring section and access the Performance Benchmark Dashboard:

```typescript
import { PerformanceBenchmarkDashboard } from '@/components/performance-benchmark-dashboard';

// Use in your page/component
<PerformanceBenchmarkDashboard />
```

### 2. Run Your First Benchmark

```typescript
// Example: Search latency benchmark
const response = await fetch("/api/vectorstore/benchmarks", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    action: "search_latency",
    provider: "openai",
    config: {
      iterations: 10,
      warmupIterations: 3,
      maxResults: 10,
    },
    testData: {
      queries: [
        "machine learning algorithms",
        "database optimization techniques",
        "API design best practices",
      ],
    },
  }),
});
```

## Benchmark Types

### 1. Search Latency Benchmarking

Measures response times for search operations:

```typescript
// Configuration
{
  action: 'search_latency',
  provider: 'openai', // 'neon', 'supabase', 'unified'
  config: {
    iterations: 10,        // Number of test iterations
    warmupIterations: 3,   // Warmup runs (not measured)
    maxResults: 10         // Results per search
  },
  testData: {
    queries: [
      'simple query',
      'complex technical query',
      'long detailed query with multiple terms'
    ]
  }
}

// Results
{
  provider: 'openai',
  operation: 'search',
  metrics: {
    averageLatency: 234,    // milliseconds
    minLatency: 123,
    maxLatency: 456,
    p95Latency: 400,
    p99Latency: 450,
    throughput: 4.27,       // operations per second
    successRate: 0.95,      // 95% success rate
    errorRate: 0.05,
    totalOperations: 10
  }
}
```

### 2. Concurrent Operations Testing

Tests performance under parallel load:

```typescript
{
  action: 'concurrent_operations',
  provider: 'openai',
  config: {
    concurrency: 5,        // Simultaneous operations
    iterations: 3,         // Batches to run
  },
  testData: {
    queries: ['test query 1', 'test query 2']
  }
}
```

### 3. Provider Comparison

Compares multiple providers with identical workloads:

```typescript
{
  action: 'provider_comparison',
  config: {
    iterations: 5
  },
  testData: {
    queries: [
      'machine learning',
      'database optimization',
      'distributed systems'
    ]
  }
}

// Results: Array of benchmark results for each provider
```

### 4. Load Testing

Simulates realistic user traffic patterns:

```typescript
{
  action: 'load_test',
  loadTestScenario: 'Basic Search Load Test' // Predefined scenario
}

// Available scenarios:
// - 'Basic Search Load Test'
// - 'Spike Test - Search'
// - 'Stress Test - Mixed Operations'
// - 'Soak Test - Extended Load'
```

### 5. Stress Testing

Finds system breaking points:

```typescript
{
  action: 'stress_test',
  provider: 'openai',
  config: {
    concurrency: 20        // Maximum concurrent users
  },
  testData: {
    queries: ['stress test query']
  }
}

// Results include breaking point analysis
{
  loadSteps: [
    {
      concurrency: 1,
      successfulRequests: 10,
      failedRequests: 0,
      averageLatency: 200,
      throughput: 5.0,
      errorRate: 0.0
    },
    // ... more steps until breaking point
  ],
  breakingPoint: {
    concurrency: 15,
    reason: 'High error rate'
  }
}
```

### 6. Memory Leak Testing

Detects memory leaks during extended operations:

```typescript
{
  action: 'memory_leak_test',
  provider: 'openai',
  config: {
    iterations: 100        // Number of operations
  },
  testData: {
    queries: ['memory test query']
  }
}

// Results include memory profile
{
  memoryProfile: {
    initialMemoryMB: 45.2,
    finalMemoryMB: 47.8,
    peakMemoryMB: 52.1,
    averageMemoryMB: 48.5,
    memoryLeakDetected: false
  }
}
```

## Configuration Options

### Default Configuration

```typescript
const DEFAULT_BENCHMARK_CONFIG = {
  enabled: true,
  maxConcurrentRequests: 10,
  timeoutMs: 30_000,
  warmupIterations: 3,
  benchmarkIterations: 10,
  providers: ["openai", "neon", "unified"],
  testDataSizes: ["small", "medium", "large"],
  memoryThresholdMB: 500,
  outputDirectory: "./benchmark-results",
  reportFormat: "json",
};
```

### Custom Configuration

```typescript
{
  config: {
    iterations: 20,           // Override default iterations
    warmupIterations: 5,      // More warmup for accuracy
    concurrency: 8,           // Concurrent operations
    timeoutMs: 60_000,        // 60 second timeout
    maxResults: 20            // More results per search
  }
}
```

## Load Test Scenarios

### Predefined Scenarios

1. **Basic Search Load Test**

   - Duration: 60 seconds
   - Users: 5-10 concurrent
   - Pattern: Constant load
   - Operation: Search only

2. **Spike Test**

   - Duration: 120 seconds
   - Users: 2-25 rapid increase
   - Pattern: Sudden spike
   - Tests system resilience

3. **Stress Test**

   - Duration: 180 seconds
   - Users: 5-30 gradual increase
   - Pattern: Increasing load
   - Mixed search/upload operations

4. **Soak Test**
   - Duration: 600 seconds (10 minutes)
   - Users: 8-12 steady
   - Pattern: Extended constant load
   - Tests stability over time

### Custom Scenarios

```typescript
const customScenario = {
  name: "Custom API Test",
  description: "Tests API under custom conditions",
  provider: "unified",
  operation: "search",
  loadPattern: "ramp_up",
  duration: 120_000, // 2 minutes
  users: {
    initial: 3,
    peak: 15,
    rampUpTime: 30_000, // 30 seconds
    rampDownTime: 30_000,
  },
  thresholds: {
    avgResponseTime: 2500, // 2.5 second max
    p95ResponseTime: 5000, // 5 second max P95
    errorRate: 0.08, // 8% max error rate
    throughput: 5, // 5 ops/sec minimum
  },
  testData: {
    queries: ["custom test query 1", "custom test query 2"],
  },
};
```

## Performance Metrics

### Core Metrics

- **Average Latency**: Mean response time across all operations
- **P95/P99 Latency**: 95th/99th percentile response times
- **Throughput**: Operations per second
- **Success Rate**: Percentage of successful operations
- **Error Rate**: Percentage of failed operations
- **Concurrency**: Number of simultaneous operations

### Memory Metrics

- **Initial Memory**: Memory usage at test start
- **Peak Memory**: Maximum memory usage during test
- **Final Memory**: Memory usage at test end
- **Memory Leak Detection**: Automatic leak detection

### Load Test Metrics

- **Requests Per Second**: Time-series throughput data
- **Response Times Over Time**: Latency trends
- **Error Distribution**: Error types and frequencies
- **Resource Usage**: CPU and memory consumption

## API Reference

### GET Endpoints

```typescript
// Get benchmark status
GET /api/vectorstore/benchmarks?action=status

// Get available scenarios
GET /api/vectorstore/benchmarks?action=scenarios

// Get default configuration
GET /api/vectorstore/benchmarks?action=config
```

### POST Endpoints

All benchmark operations use POST with JSON bodies:

```typescript
POST /api/vectorstore/benchmarks
Content-Type: application/json

{
  "action": "search_latency",     // Required: benchmark type
  "provider": "openai",           // Required for provider-specific tests
  "config": { ... },              // Optional: override defaults
  "testData": { ... },            // Optional: custom test data
  "loadTestScenario": "...",      // Required for load tests
  "baseline": { ... },            // Required for regression detection
  "thresholds": { ... }           // Optional: custom thresholds
}
```

### Response Format

```typescript
{
  "success": true,
  "data": {
    // Benchmark result object
    "provider": "openai",
    "operation": "search",
    "timestamp": "2024-01-01T12:00:00Z",
    "duration": 5000,
    "metrics": { ... },
    "success": true,
    "errors": [],
    "metadata": { ... }
  },
  "timestamp": "2024-01-01T12:00:00Z",
  "action": "search_latency",
  "provider": "openai"
}
```

## Performance Regression Detection

### Creating Baselines

```typescript
{
  action: 'create_baseline',
  config: {
    iterations: 10
  },
  testData: {
    queries: ['baseline query 1', 'baseline query 2']
  }
}

// Results
{
  timestamp: '2024-01-01T12:00:00Z',
  results: [/* benchmark results */],
  metadata: {
    gitCommit: 'abc123',
    environment: 'production',
    nodeVersion: 'v18.0.0'
  }
}
```

### Detecting Regressions

```typescript
{
  action: 'detect_regression',
  baseline: {
    averageLatency: 500,
    throughput: 10,
    successRate: 0.95,
    p95Latency: 800
  },
  current: {
    averageLatency: 750,    // 50% slower
    throughput: 8,          // 20% slower
    successRate: 0.92,      // 3% lower
    p95Latency: 1200        // 50% slower
  },
  thresholds: {
    latencyThreshold: 0.2,      // 20% threshold
    throughputThreshold: 0.15,   // 15% threshold
    successRateThreshold: 0.05   // 5% threshold
  }
}

// Results
{
  hasRegression: true,
  regressions: ['latency', 'throughput'],
  improvements: [],
  summary: 'Performance regression detected in: latency, throughput',
  details: {
    latency: {
      baseline: 500,
      current: 750,
      change: 250,
      changePercent: 50,
      threshold: 20
    }
  }
}
```

## Report Generation

### Basic Reports

```typescript
{
  action: 'generate_report',
  results: [/* array of benchmark results */]
}

// Results
{
  summary: {
    totalTests: 10,
    successful: 9,
    failed: 1,
    averageLatency: 456,
    totalThroughput: 45.2
  },
  results: [/* detailed results */],
  recommendations: [
    'High average latency detected. Consider optimizing query performance.',
    'Low throughput detected in some tests. Consider scaling strategies.'
  ]
}
```

### Export Formats

```typescript
// Export to JSON
const jsonExport = await benchmarkSuite.exportResults(results, "json");

// Export to CSV
const csvExport = await benchmarkSuite.exportResults(results, "csv");
```

## Best Practices

### Test Design

1. **Use Realistic Data**: Test with queries and files similar to production
2. **Include Warmup**: Always use warmup iterations for accurate results
3. **Multiple Iterations**: Run multiple iterations for statistical significance
4. **Gradual Load Increase**: Use gradual load patterns to find breaking points

### Performance Thresholds

1. **Latency Targets**:

   - Excellent: < 500ms average
   - Good: 500ms - 2000ms average
   - Acceptable: 2000ms - 5000ms average
   - Poor: > 5000ms average

2. **Success Rate Targets**:

   - Excellent: > 99%
   - Good: 95% - 99%
   - Acceptable: 90% - 95%
   - Poor: < 90%

3. **Throughput Targets**:
   - Depends on hardware and complexity
   - Baseline with simple queries first
   - Compare relative performance

### Monitoring and Alerting

1. **Regular Benchmarking**: Run benchmarks weekly or after major changes
2. **Regression Detection**: Compare against established baselines
3. **Performance Budgets**: Set and enforce performance budgets
4. **Automated Testing**: Integrate into CI/CD pipelines

### Troubleshooting

1. **High Latency**:

   - Check network connectivity
   - Verify API key validity
   - Review query complexity
   - Check system resources

2. **Low Throughput**:

   - Increase concurrency carefully
   - Check rate limits
   - Verify connection pooling
   - Monitor memory usage

3. **High Error Rates**:
   - Check API quotas
   - Verify authentication
   - Review error messages
   - Check service status

## Integration Examples

### CI/CD Integration

```yaml
# GitHub Actions example
name: Performance Tests
on: [push, pull_request]

jobs:
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run Performance Tests
        run: |
          curl -X POST http://localhost:3000/api/vectorstore/benchmarks \
            -H "Content-Type: application/json" \
            -d '{
              "action": "provider_comparison",
              "config": {"iterations": 5}
            }'
```

### Monitoring Integration

```typescript
// Custom monitoring hook
export function usePerformanceMonitoring() {
  const runWeeklyBenchmarks = async () => {
    const results = await fetch("/api/vectorstore/benchmarks", {
      method: "POST",
      body: JSON.stringify({
        action: "provider_comparison",
        config: { iterations: 10 },
      }),
    });

    // Send to monitoring service
    await sendToMonitoring(results);
  };

  return { runWeeklyBenchmarks };
}
```

## Troubleshooting

### Common Issues

1. **Timeouts**: Increase `timeoutMs` in configuration
2. **Memory Issues**: Reduce `iterations` or `concurrency`
3. **Rate Limits**: Add delays between operations
4. **Authentication**: Verify API keys and permissions

### Debug Mode

Enable detailed logging by setting:

```typescript
const config = {
  ...DEFAULT_BENCHMARK_CONFIG,
  enableDetailedLogging: true,
};
```

### Performance Tips

1. **Start Small**: Begin with low iterations and concurrency
2. **Monitor Resources**: Watch CPU and memory usage during tests
3. **Use Appropriate Hardware**: Ensure sufficient system resources
4. **Network Considerations**: Test on similar network conditions to production

## Support and Contributing

### Getting Help

1. Check the troubleshooting section
2. Review API error messages
3. Check system logs
4. Verify configuration

### Contributing

1. Add new benchmark types in `performance-benchmarks.ts`
2. Extend load test scenarios in `load-testing.ts`
3. Improve dashboard visualizations
4. Add new providers or operations

This framework provides comprehensive performance testing capabilities for vector search operations. Use it regularly to maintain optimal performance and catch regressions early.
