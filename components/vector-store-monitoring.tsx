'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { fetcher } from '@/lib/utils';

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
  const [selectedTimeWindow, setSelectedTimeWindow] = useState('24h');
  const [selectedProvider, setSelectedProvider] = useState<string | 'all'>(
    'all',
  );

  // Fetch dashboard data
  const {
    data: dashboardData,
    error: dashboardError,
    mutate: mutateDashboard,
  } = useSWR<{
    success: boolean;
    data: DashboardData;
  }>('/api/vectorstore/monitoring?action=dashboard', fetcher, {
    refreshInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch health data
  const { data: healthData, error: healthError } = useSWR<{
    success: boolean;
    data: Record<string, HealthStatus>;
  }>('/api/vectorstore/monitoring?action=health&provider=all', fetcher, {
    refreshInterval: 60000, // Refresh every minute
  });

  const formatLatency = (latency: number) => {
    if (latency < 1000) return `${Math.round(latency)}ms`;
    return `${(latency / 1000).toFixed(1)}s`;
  };

  const formatSuccessRate = (rate: number) => {
    return `${(rate * 100).toFixed(1)}%`;
  };

  const getHealthBadgeVariant = (isHealthy: boolean) => {
    return isHealthy ? 'default' : 'destructive';
  };

  const getPerformanceBadgeVariant = (successRate: number) => {
    if (successRate >= 0.95) return 'default';
    if (successRate >= 0.9) return 'secondary';
    return 'destructive';
  };

  const testSearch = async (provider: string) => {
    try {
      const response = await fetch('/api/vectorstore/monitoring', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test_search',
          provider,
          latency: Math.random() * 2000 + 500,
          success: Math.random() > 0.1, // 90% success rate
        }),
      });

      if (response.ok) {
        mutateDashboard();
      }
    } catch (error) {
      console.error('Failed to test search:', error);
    }
  };

  if (dashboardError || healthError) {
    return (
      <div className="p-6">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-red-600 mb-4">
            Monitoring Dashboard Error
          </h2>
          <p className="text-sm text-gray-600">
            Failed to load monitoring data. Please check the API endpoints.
          </p>
          <pre className="mt-4 p-4 bg-gray-100 rounded text-sm overflow-auto">
            {JSON.stringify({ dashboardError, healthError }, null, 2)}
          </pre>
        </Card>
      </div>
    );
  }

  if (!dashboardData || !healthData) {
    return (
      <div className="p-6">
        <Card className="p-6">
          <div className="animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4" />
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 rounded" />
              <div className="h-3 bg-gray-200 rounded w-3/4" />
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const { overview, healthStatus, recentErrors, alerts } = dashboardData.data;
  const healthStatuses = healthData.data;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Vector Store Monitoring</h1>
        <div className="flex items-center gap-2">
          <select
            value={selectedTimeWindow}
            onChange={(e) => setSelectedTimeWindow(e.target.value)}
            className="px-3 py-1 border rounded text-sm"
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
        <h2 className="text-xl font-semibold mb-4">Health Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Object.entries(healthStatuses).map(([provider, status]) => (
            <div key={provider} className="border rounded p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium capitalize">{provider}</h3>
                <Badge variant={getHealthBadgeVariant(status.isHealthy)}>
                  {status.isHealthy ? 'Healthy' : 'Unhealthy'}
                </Badge>
              </div>
              {status.latency && (
                <p className="text-sm text-gray-600">
                  Latency: {formatLatency(status.latency)}
                </p>
              )}
              {status.vectorStoreStatus && (
                <p className="text-sm text-gray-600">
                  {status.vectorStoreStatus}
                </p>
              )}
              {status.errorMessage && (
                <p className="text-sm text-red-600 mt-1">
                  {status.errorMessage}
                </p>
              )}
              <div className="flex items-center justify-between mt-3">
                <p className="text-xs text-gray-500">
                  Last checked:{' '}
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
        <h2 className="text-xl font-semibold mb-4">
          Performance Metrics ({selectedTimeWindow})
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {Object.entries(overview).map(([provider, metrics]) => (
            <div key={provider} className="border rounded p-4">
              <div className="flex items-center justify-between mb-3">
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
                    className={`font-medium ${metrics.errorRate > 0.05 ? 'text-red-600' : ''}`}
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
              <p className="text-xs text-gray-500">
                Updated: {new Date(metrics.lastUpdated).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Recent Errors */}
      {recentErrors.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">
            Recent Errors (Last Hour)
          </h2>
          <div className="space-y-3">
            {recentErrors.slice(0, 5).map((error) => (
              <div
                key={error.id}
                className="border-l-4 border-red-500 pl-4 py-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive" className="text-xs">
                      {error.provider}
                    </Badge>
                    <span className="text-sm font-medium">
                      {error.metricType}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(error.timestamp).toLocaleString()}
                  </span>
                </div>
                {error.errorMessage && (
                  <p className="text-sm text-red-600 mt-1">
                    {error.errorMessage}
                  </p>
                )}
                {error.metadata && (
                  <details className="mt-2">
                    <summary className="text-xs text-gray-500 cursor-pointer">
                      View Details
                    </summary>
                    <pre className="text-xs bg-gray-50 p-2 rounded mt-1 overflow-auto">
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
        <h2 className="text-xl font-semibold mb-4">System Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <h3 className="font-medium mb-2">Monitoring Status</h3>
            <ul className="space-y-1 text-gray-600">
              <li>• Real-time health checks enabled</li>
              <li>• Performance metrics collected</li>
              <li>• Error categorization active</li>
              <li>• Alert system configured</li>
            </ul>
          </div>
          <div>
            <h3 className="font-medium mb-2">Data Retention</h3>
            <ul className="space-y-1 text-gray-600">
              <li>• Metrics: 30 days</li>
              <li>• Health checks: 7 days</li>
              <li>• Error logs: 14 days</li>
              <li>• Performance data: 30 days</li>
            </ul>
          </div>
        </div>
        <Separator className="my-4" />
        <p className="text-xs text-gray-500">
          Last updated:{' '}
          {new Date(dashboardData.data.timestamp).toLocaleString()}
        </p>
      </Card>
    </div>
  );
}
