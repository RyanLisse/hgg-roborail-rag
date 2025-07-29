'use client';

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { fetcher } from '@/lib/utils';

interface BenchmarkResult {
  provider: string;
  operation: string;
  timestamp: string;
  duration: number;
  metrics: {
    averageLatency: number;
    minLatency?: number;
    maxLatency?: number;
    p95Latency?: number;
    p99Latency?: number;
    throughput: number;
    successRate: number;
    errorRate: number;
    totalOperations: number;
    concurrency?: number;
    memoryUsageMB?: number;
  };
  success: boolean;
  errors: string[];
  complexity?: string;
}

interface LoadTestResult {
  scenario: {
    name: string;
    description: string;
    provider: string;
    operation: string;
    duration: number;
  };
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  metrics: {
    avgResponseTime: number;
    p95ResponseTime: number;
    throughput: number;
    errorRate: number;
  };
  passed: boolean;
  summary: string;
}

interface BenchmarkConfig {
  iterations: number;
  warmupIterations: number;
  concurrency: number;
  timeoutMs: number;
  maxResults: number;
}

export function PerformanceBenchmarkDashboard() {
  const [activeProvider, setActiveProvider] = useState<string>('openai');
  const [benchmarkResults, setBenchmarkResults] = useState<BenchmarkResult[]>(
    [],
  );
  const [loadTestResults, setLoadTestResults] = useState<LoadTestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<string>('');

  // Fetch benchmark status and configuration
  const { data: statusData } = useSWR<{
    success: boolean;
    data: {
      benchmarkingEnabled: boolean;
      availableProviders: string[];
      availableActions: string[];
      predefinedScenarios: Array<{
        name: string;
        description: string;
        provider: string;
        operation: string;
        duration: number;
      }>;
    };
  }>('/api/vectorstore/benchmarks?action=status', fetcher);

  const { data: configData } = useSWR<{
    success: boolean;
    data: {
      defaultConfig: BenchmarkConfig;
      testQueries: string[];
      complexityLevels: Array<{ name: string; query: string }>;
    };
  }>('/api/vectorstore/benchmarks?action=config', fetcher);

  const formatLatency = (latency: number) => {
    if (latency < 1000) {
      return `${Math.round(latency)}ms`;
    }
    return `${(latency / 1000).toFixed(1)}s`;
  };

  const formatThroughput = (throughput: number) => {
    return `${throughput.toFixed(1)} ops/s`;
  };

  const formatSuccessRate = (rate: number) => {
    return `${(rate * 100).toFixed(1)}%`;
  };

  const getPerformanceBadge = (successRate: number, avgLatency: number) => {
    if (successRate < 0.9 || avgLatency > 5000) {
      return { variant: 'destructive' as const, label: 'Poor' };
    }
    if (successRate < 0.95 || avgLatency > 2000) {
      return { variant: 'secondary' as const, label: 'Fair' };
    }
    return { variant: 'default' as const, label: 'Good' };
  };

  const runBenchmark = async (
    action: string,
    provider: string = activeProvider,
  ) => {
    setIsRunning(true);
    try {
      const response = await fetch('/api/vectorstore/benchmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          provider,
          config: configData?.data.defaultConfig,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setBenchmarkResults((prev) => [result.data, ...prev].slice(0, 20)); // Keep last 20 results
      }
    } catch (error) {
      console.error('Benchmark failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const runLoadTest = async (scenarioName: string) => {
    setIsRunning(true);
    try {
      const response = await fetch('/api/vectorstore/benchmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'load_test',
          loadTestScenario: scenarioName,
        }),
      });

      const result = await response.json();
      if (result.success) {
        setLoadTestResults((prev) => [result.data, ...prev].slice(0, 10)); // Keep last 10 results
      }
    } catch (error) {
      console.error('Load test failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const runProviderComparison = async () => {
    setIsRunning(true);
    try {
      const response = await fetch('/api/vectorstore/benchmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'provider_comparison',
          config: configData?.data.defaultConfig,
        }),
      });

      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setBenchmarkResults((prev) => [...result.data, ...prev].slice(0, 20));
      }
    } catch (error) {
      console.error('Provider comparison failed:', error);
    } finally {
      setIsRunning(false);
    }
  };

  if (!(statusData && configData)) {
    return (
      <div className="p-6">
        <Card className="p-6">
          <div className="animate-pulse">
            <div className="mb-4 h-4 w-1/4 rounded bg-gray-200" />
            <div className="space-y-2">
              <div className="h-3 rounded bg-gray-200" />
              <div className="h-3 w-3/4 rounded bg-gray-200" />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-bold text-3xl">
            Performance Benchmark Dashboard
          </h1>
          <p className="text-gray-600">
            Monitor and analyze vector store performance across providers
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="rounded border px-3 py-1 text-sm"
            onChange={(e) => setActiveProvider(e.target.value)}
            value={activeProvider}
          >
            {statusData.data.availableProviders.map((provider) => (
              <option key={provider} value={provider}>
                {provider.toUpperCase()}
              </option>
            ))}
          </select>
          <Badge
            variant={
              statusData.data.benchmarkingEnabled ? 'default' : 'destructive'
            }
          >
            {statusData.data.benchmarkingEnabled ? 'Enabled' : 'Disabled'}
          </Badge>
        </div>
      </div>

      <Tabs className="w-full" defaultValue="single">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="single">Single Provider</TabsTrigger>
          <TabsTrigger value="comparison">Provider Comparison</TabsTrigger>
          <TabsTrigger value="load">Load Testing</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        {/* Single Provider Benchmarks */}
        <TabsContent className="space-y-4" value="single">
          <Card>
            <CardHeader>
              <CardTitle>
                Single Provider Benchmarks - {activeProvider.toUpperCase()}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Button
                  className="h-20 flex-col"
                  disabled={isRunning}
                  onClick={() => runBenchmark('search_latency')}
                >
                  <span className="font-medium text-sm">Search Latency</span>
                  <span className="text-gray-500 text-xs">
                    Response time analysis
                  </span>
                </Button>
                <Button
                  className="h-20 flex-col"
                  disabled={isRunning}
                  onClick={() => runBenchmark('concurrent_operations')}
                  variant="outline"
                >
                  <span className="font-medium text-sm">Concurrent Ops</span>
                  <span className="text-gray-500 text-xs">
                    Parallel processing
                  </span>
                </Button>
                <Button
                  className="h-20 flex-col"
                  disabled={isRunning}
                  onClick={() => runBenchmark('stress_test')}
                  variant="outline"
                >
                  <span className="font-medium text-sm">Stress Test</span>
                  <span className="text-gray-500 text-xs">
                    Breaking point analysis
                  </span>
                </Button>
                <Button
                  className="h-20 flex-col"
                  disabled={isRunning}
                  onClick={() => runBenchmark('memory_leak_test')}
                  variant="outline"
                >
                  <span className="font-medium text-sm">Memory Test</span>
                  <span className="text-gray-500 text-xs">
                    Memory leak detection
                  </span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Recent Results Summary */}
          {benchmarkResults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Results Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {benchmarkResults.slice(0, 6).map((result, index) => {
                    const badge = getPerformanceBadge(
                      result.metrics.successRate,
                      result.metrics.averageLatency,
                    );
                    return (
                      <div className="rounded border p-3" key={index}>
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-medium text-sm">
                            {result.provider} - {result.operation}
                          </span>
                          <Badge variant={badge.variant}>{badge.label}</Badge>
                        </div>
                        <div className="space-y-1 text-gray-600 text-xs">
                          <div className="flex justify-between">
                            <span>Avg Latency:</span>
                            <span>
                              {formatLatency(result.metrics.averageLatency)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Throughput:</span>
                            <span>
                              {formatThroughput(result.metrics.throughput)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>Success Rate:</span>
                            <span>
                              {formatSuccessRate(result.metrics.successRate)}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Provider Comparison */}
        <TabsContent className="space-y-4" value="comparison">
          <Card>
            <CardHeader>
              <CardTitle>Provider Performance Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Button
                  className="w-full"
                  disabled={isRunning}
                  onClick={runProviderComparison}
                >
                  {isRunning
                    ? 'Running Comparison...'
                    : 'Run Provider Comparison'}
                </Button>

                {benchmarkResults.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="p-2 text-left">Provider</th>
                          <th className="p-2 text-left">Avg Latency</th>
                          <th className="p-2 text-left">P95 Latency</th>
                          <th className="p-2 text-left">Throughput</th>
                          <th className="p-2 text-left">Success Rate</th>
                          <th className="p-2 text-left">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {benchmarkResults
                          .filter((r) => r.operation === 'search')
                          .slice(0, 5)
                          .map((result, index) => {
                            const badge = getPerformanceBadge(
                              result.metrics.successRate,
                              result.metrics.averageLatency,
                            );
                            return (
                              <tr className="border-b" key={index}>
                                <td className="p-2 font-medium">
                                  {result.provider.toUpperCase()}
                                </td>
                                <td className="p-2">
                                  {formatLatency(result.metrics.averageLatency)}
                                </td>
                                <td className="p-2">
                                  {result.metrics.p95Latency
                                    ? formatLatency(result.metrics.p95Latency)
                                    : 'N/A'}
                                </td>
                                <td className="p-2">
                                  {formatThroughput(result.metrics.throughput)}
                                </td>
                                <td className="p-2">
                                  {formatSuccessRate(
                                    result.metrics.successRate,
                                  )}
                                </td>
                                <td className="p-2">
                                  <Badge variant={badge.variant}>
                                    {badge.label}
                                  </Badge>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Load Testing */}
        <TabsContent className="space-y-4" value="load">
          <Card>
            <CardHeader>
              <CardTitle>Load Testing Scenarios</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <select
                    className="flex-1 rounded border px-3 py-2"
                    onChange={(e) => setSelectedScenario(e.target.value)}
                    value={selectedScenario}
                  >
                    <option value="">Select a load test scenario...</option>
                    {statusData.data.predefinedScenarios.map((scenario) => (
                      <option key={scenario.name} value={scenario.name}>
                        {scenario.name} - {scenario.provider.toUpperCase()}
                      </option>
                    ))}
                  </select>
                  <Button
                    disabled={isRunning || !selectedScenario}
                    onClick={() =>
                      selectedScenario && runLoadTest(selectedScenario)
                    }
                  >
                    {isRunning ? 'Running...' : 'Run Load Test'}
                  </Button>
                </div>

                {selectedScenario && (
                  <div className="rounded bg-gray-50 p-3">
                    {(() => {
                      const scenario = statusData.data.predefinedScenarios.find(
                        (s) => s.name === selectedScenario,
                      );
                      return scenario ? (
                        <div>
                          <h4 className="font-medium">{scenario.name}</h4>
                          <p className="text-gray-600 text-sm">
                            {scenario.description}
                          </p>
                          <div className="mt-2 flex gap-4 text-gray-500 text-xs">
                            <span>
                              Provider: {scenario.provider.toUpperCase()}
                            </span>
                            <span>Operation: {scenario.operation}</span>
                            <span>
                              Duration: {(scenario.duration / 1000).toFixed(0)}s
                            </span>
                          </div>
                        </div>
                      ) : null;
                    })()}
                  </div>
                )}

                {/* Load Test Results */}
                {loadTestResults.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium">Recent Load Test Results</h4>
                    {loadTestResults.slice(0, 3).map((result, index) => (
                      <div className="rounded border p-3" key={index}>
                        <div className="mb-2 flex items-center justify-between">
                          <span className="font-medium">
                            {result.scenario.name}
                          </span>
                          <Badge
                            variant={result.passed ? 'default' : 'destructive'}
                          >
                            {result.passed ? 'Passed' : 'Failed'}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
                          <div>
                            <span className="text-gray-600">
                              Total Requests:
                            </span>
                            <div className="font-medium">
                              {result.totalRequests.toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-600">Success Rate:</span>
                            <div className="font-medium">
                              {formatSuccessRate(
                                result.successfulRequests /
                                  result.totalRequests,
                              )}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-600">Avg Response:</span>
                            <div className="font-medium">
                              {formatLatency(result.metrics.avgResponseTime)}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-600">Throughput:</span>
                            <div className="font-medium">
                              {formatThroughput(result.metrics.throughput)}
                            </div>
                          </div>
                        </div>
                        <Separator className="my-2" />
                        <p className="text-gray-600 text-sm">
                          {result.summary}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Results Archive */}
        <TabsContent className="space-y-4" value="results">
          <Card>
            <CardHeader>
              <CardTitle>Benchmark Results Archive</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Summary Stats */}
                {benchmarkResults.length > 0 && (
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div className="rounded bg-blue-50 p-3">
                      <div className="font-medium text-sm">Total Tests</div>
                      <div className="font-bold text-lg">
                        {benchmarkResults.length}
                      </div>
                    </div>
                    <div className="rounded bg-green-50 p-3">
                      <div className="font-medium text-sm">Success Rate</div>
                      <div className="font-bold text-lg">
                        {formatSuccessRate(
                          benchmarkResults.filter((r) => r.success).length /
                            benchmarkResults.length,
                        )}
                      </div>
                    </div>
                    <div className="rounded bg-yellow-50 p-3">
                      <div className="font-medium text-sm">Avg Latency</div>
                      <div className="font-bold text-lg">
                        {formatLatency(
                          benchmarkResults.reduce(
                            (sum, r) => sum + r.metrics.averageLatency,
                            0,
                          ) / benchmarkResults.length,
                        )}
                      </div>
                    </div>
                    <div className="rounded bg-purple-50 p-3">
                      <div className="font-medium text-sm">Total Ops</div>
                      <div className="font-bold text-lg">
                        {benchmarkResults
                          .reduce(
                            (sum, r) => sum + r.metrics.totalOperations,
                            0,
                          )
                          .toLocaleString()}
                      </div>
                    </div>
                  </div>
                )}

                {/* Detailed Results */}
                <div className="space-y-2">
                  {benchmarkResults.map((result, index) => (
                    <details className="rounded border p-3" key={index}>
                      <summary className="cursor-pointer font-medium">
                        <span className="mr-2">
                          {result.provider.toUpperCase()}
                        </span>
                        <span className="mr-2">-</span>
                        <span className="mr-2">{result.operation}</span>
                        <Badge
                          className="mr-2"
                          variant={result.success ? 'default' : 'destructive'}
                        >
                          {result.success ? 'Success' : 'Failed'}
                        </Badge>
                        <span className="text-gray-500 text-sm">
                          {new Date(result.timestamp).toLocaleString()}
                        </span>
                      </summary>
                      <div className="mt-3 space-y-2 text-sm">
                        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                          <div>
                            <span className="text-gray-600">Duration:</span>
                            <div>{(result.duration / 1000).toFixed(1)}s</div>
                          </div>
                          <div>
                            <span className="text-gray-600">Operations:</span>
                            <div>{result.metrics.totalOperations}</div>
                          </div>
                          <div>
                            <span className="text-gray-600">Avg Latency:</span>
                            <div>
                              {formatLatency(result.metrics.averageLatency)}
                            </div>
                          </div>
                          {result.metrics.p95Latency && (
                            <div>
                              <span className="text-gray-600">
                                P95 Latency:
                              </span>
                              <div>
                                {formatLatency(result.metrics.p95Latency)}
                              </div>
                            </div>
                          )}
                          <div>
                            <span className="text-gray-600">Throughput:</span>
                            <div>
                              {formatThroughput(result.metrics.throughput)}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-600">Success Rate:</span>
                            <div>
                              {formatSuccessRate(result.metrics.successRate)}
                            </div>
                          </div>
                        </div>
                        {result.errors.length > 0 && (
                          <div>
                            <span className="text-gray-600">Errors:</span>
                            <ul className="mt-1 list-inside list-disc text-red-600 text-xs">
                              {result.errors.slice(0, 3).map((error, i) => (
                                <li key={i}>{error}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </details>
                  ))}
                </div>

                {benchmarkResults.length === 0 && (
                  <div className="py-8 text-center text-gray-500">
                    <p>
                      No benchmark results yet. Run some benchmarks to see
                      results here.
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
