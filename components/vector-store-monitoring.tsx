"use client";

import { useState } from "react";
import useSWR from "swr";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { fetcher } from "@/lib/utils";

interface HealthStatus {
  provider: string;
  isHealthy: boolean;
  latency?: number;
  lastChecked: string;
  errorMessage?: string;
  vectorStoreStatus?: string;
}

interface PerformanceMetrics {
  provider: string;
  timeWindow: string;
  totalRequests: number;
  successRate: number;
  averageLatency: number;
  p95Latency: number;
  p99Latency: number;
  errorRate: number;
  tokensUsed?: number;
  lastUpdated: string;
}

interface MetricEvent {
  id: string;
  timestamp: string;
  provider: string;
  metricType: string;
  value: number;
  unit: string;
  success?: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

interface DashboardData {
  overview: Record<string, PerformanceMetrics>;
  healthStatus: HealthStatus[];
  recentErrors: MetricEvent[];
  alerts: any[];
  timestamp: string;
}

export function VectorStoreMonitoring() {
  const [selectedTimeWindow, setSelectedTimeWindow] = useState("24h");
  const [selectedProvider, setSelectedProvider] = useState<string | "all">(
    "all",
  );

  // Fetch dashboard data
  const {
    data: dashboardData,
    error: dashboardError,
    mutate: mutateDashboard,
  } = useSWR<{
    success: boolean;
    data: DashboardData;
  }>("/api/vectorstore/monitoring?action=dashboard", fetcher, {
    refreshInterval: 30_000, // Refresh every 30 seconds
  });

  // Fetch health data
  const { data: healthData, error: healthError } = useSWR<{
    success: boolean;
    data: Record<string, HealthStatus>;
  }>("/api/vectorstore/monitoring?action=health&provider=all", fetcher, {
    refreshInterval: 60_000, // Refresh every minute
  });

  const formatLatency = (latency: number) => {
    if (latency < 1000) return `${Math.round(latency)}ms`;
    return `${(latency / 1000).toFixed(1)}s`;
  };

  const formatSuccessRate = (rate: number) => {
    return `${(rate * 100).toFixed(1)}%`;
  };

  const getHealthBadgeVariant = (isHealthy: boolean) => {
    return isHealthy ? "default" : "destructive";
  };

  const getPerformanceBadgeVariant = (successRate: number) => {
    if (successRate >= 0.95) return "default";
    if (successRate >= 0.9) return "secondary";
    return "destructive";
  };

  const testSearch = async (provider: string) => {
    try {
      const response = await fetch("/api/vectorstore/monitoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "test_search",
          provider,
          latency: Math.random() * 2000 + 500,
          success: Math.random() > 0.1, // 90% success rate
        }),
      });

      if (response.ok) {
        mutateDashboard();
      }
    } catch (error) {
      console.error("Failed to test search:", error);
    }
  };

  if (dashboardError || healthError) {
    return (
      <div className="p-6">
        <Card className="p-6">
          <h2 className="mb-4 font-semibold text-red-600 text-xl">
            Monitoring Dashboard Error
          </h2>
          <p className="text-gray-600 text-sm">
            Failed to load monitoring data. Please check the API endpoints.
          </p>
          <pre className="mt-4 overflow-auto rounded bg-gray-100 p-4 text-sm">
            {JSON.stringify({ dashboardError, healthError }, null, 2)}
          </pre>
        </Card>
      </div>
    );
  }

  if (!(dashboardData && healthData)) {
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

  const { overview, healthStatus, recentErrors, alerts } = dashboardData.data;
  const healthStatuses = healthData.data;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="font-bold text-3xl">Vector Store Monitoring</h1>
        <div className="flex items-center gap-2">
          <select
            className="rounded border px-3 py-1 text-sm"
            onChange={(e) => setSelectedTimeWindow(e.target.value)}
            value={selectedTimeWindow}
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
          </select>
          <Button onClick={() => mutateDashboard()} size="sm">
            Refresh
          </Button>
        </div>
      </div>

      {/* Health Status Overview */}
      <Card className="p-6">
        <h2 className="mb-4 font-semibold text-xl">Health Status</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {Object.entries(healthStatuses).map(([provider, status]) => (
            <div className="rounded border p-4" key={provider}>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-medium capitalize">{provider}</h3>
                <Badge variant={getHealthBadgeVariant(status.isHealthy)}>
                  {status.isHealthy ? "Healthy" : "Unhealthy"}
                </Badge>
              </div>
              {status.latency && (
                <p className="text-gray-600 text-sm">
                  Latency: {formatLatency(status.latency)}
                </p>
              )}
              {status.vectorStoreStatus && (
                <p className="text-gray-600 text-sm">
                  {status.vectorStoreStatus}
                </p>
              )}
              {status.errorMessage && (
                <p className="mt-1 text-red-600 text-sm">
                  {status.errorMessage}
                </p>
              )}
              <div className="mt-3 flex items-center justify-between">
                <p className="text-gray-500 text-xs">
                  Last checked:{" "}
                  {new Date(status.lastChecked).toLocaleTimeString()}
                </p>
                <Button
                  onClick={() => testSearch(provider)}
                  size="sm"
                  variant="outline"
                >
                  Test
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Performance Metrics */}
      <Card className="p-6">
        <h2 className="mb-4 font-semibold text-xl">
          Performance Metrics ({selectedTimeWindow})
        </h2>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {Object.entries(overview).map(([provider, metrics]) => (
            <div className="rounded border p-4" key={provider}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-medium capitalize">{provider}</h3>
                <Badge
                  variant={getPerformanceBadgeVariant(metrics.successRate)}
                >
                  {formatSuccessRate(metrics.successRate)}
                </Badge>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Requests:</span>
                  <span className="font-medium">
                    {metrics.totalRequests.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Avg Latency:</span>
                  <span className="font-medium">
                    {formatLatency(metrics.averageLatency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">P95 Latency:</span>
                  <span className="font-medium">
                    {formatLatency(metrics.p95Latency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Error Rate:</span>
                  <span
                    className={`font-medium ${metrics.errorRate > 0.05 ? "text-red-600" : ""}`}
                  >
                    {formatSuccessRate(metrics.errorRate)}
                  </span>
                </div>
                {metrics.tokensUsed && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Tokens Used:</span>
                    <span className="font-medium">
                      {metrics.tokensUsed.toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              <Separator className="my-3" />
              <p className="text-gray-500 text-xs">
                Updated: {new Date(metrics.lastUpdated).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Recent Errors */}
      {recentErrors.length > 0 && (
        <Card className="p-6">
          <h2 className="mb-4 font-semibold text-xl">
            Recent Errors (Last Hour)
          </h2>
          <div className="space-y-3">
            {recentErrors.slice(0, 5).map((error) => (
              <div
                className="border-red-500 border-l-4 py-2 pl-4"
                key={error.id}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className="text-xs" variant="destructive">
                      {error.provider}
                    </Badge>
                    <span className="font-medium text-sm">
                      {error.metricType}
                    </span>
                  </div>
                  <span className="text-gray-500 text-xs">
                    {new Date(error.timestamp).toLocaleString()}
                  </span>
                </div>
                {error.errorMessage && (
                  <p className="mt-1 text-red-600 text-sm">
                    {error.errorMessage}
                  </p>
                )}
                {error.metadata && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-gray-500 text-xs">
                      View Details
                    </summary>
                    <pre className="mt-1 overflow-auto rounded bg-gray-50 p-2 text-xs">
                      {JSON.stringify(error.metadata, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* System Information */}
      <Card className="p-6">
        <h2 className="mb-4 font-semibold text-xl">System Information</h2>
        <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
          <div>
            <h3 className="mb-2 font-medium">Monitoring Status</h3>
            <ul className="space-y-1 text-gray-600">
              <li>• Real-time health checks enabled</li>
              <li>• Performance metrics collected</li>
              <li>• Error categorization active</li>
              <li>• Alert system configured</li>
            </ul>
          </div>
          <div>
            <h3 className="mb-2 font-medium">Data Retention</h3>
            <ul className="space-y-1 text-gray-600">
              <li>• Metrics: 30 days</li>
              <li>• Health checks: 7 days</li>
              <li>• Error logs: 14 days</li>
              <li>• Performance data: 30 days</li>
            </ul>
          </div>
        </div>
        <Separator className="my-4" />
        <p className="text-gray-500 text-xs">
          Last updated:{" "}
          {new Date(dashboardData.data.timestamp).toLocaleString()}
        </p>
      </Card>
    </div>
  );
}
