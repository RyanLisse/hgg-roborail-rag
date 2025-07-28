import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getVectorStoreMonitoringService } from '@/lib/vectorstore/monitoring';
import { getNeonVectorStoreService } from '@/lib/vectorstore/neon';
import { getOpenAIVectorStoreService } from '@/lib/vectorstore/openai';
import { getUnifiedVectorStoreService } from '@/lib/vectorstore/unified';

// Request schemas
const HealthCheckRequest = z.object({
  provider: z
    .enum(['openai', 'neon', 'unified', 'all'])
    .optional()
    .default('all'),
});

const MetricsRequest = z.object({
  provider: z.enum(['openai', 'neon', 'unified', 'memory']).optional(),
  metricType: z
    .enum([
      'search_latency',
      'search_success',
      'search_error',
      'token_usage',
      'file_upload',
      'file_upload_error',
      'vector_store_health',
      'embedding_generation',
      'retrieval_accuracy',
      'cache_hit',
      'cache_miss',
      'connection_error',
      'rate_limit_error',
      'quota_exceeded',
      'service_health',
    ])
    .optional(),
  timeWindow: z.string().optional().default('24h'),
});

const PerformanceRequest = z.object({
  provider: z.enum(['openai', 'neon', 'unified', 'memory']),
  timeWindow: z.string().optional().default('24h'),
});

// Helper function to handle health check for all providers
async function handleHealthCheckAll() {
  const [openaiService, neonService, _unifiedService] = await Promise.all([
    getOpenAIVectorStoreService(),
    getNeonVectorStoreService(),
    getUnifiedVectorStoreService(),
  ]);

  const healthChecks = await Promise.all([
    openaiService.healthCheck().catch((error) => ({
      isHealthy: false,
      error: error.message,
    })),
    Promise.resolve({
      isHealthy: neonService.isEnabled,
      error: neonService.isEnabled ? undefined : 'Service disabled',
    }),
    Promise.resolve({
      isHealthy: true, // Unified service is always enabled
    }),
  ]);

  return {
    success: true,
    data: {
      openai: {
        provider: 'openai' as const,
        ...healthChecks[0],
        lastChecked: new Date(),
      },
      neon: {
        provider: 'neon' as const,
        ...healthChecks[1],
        lastChecked: new Date(),
      },
      unified: {
        provider: 'unified' as const,
        ...healthChecks[2],
        lastChecked: new Date(),
      },
    },
  };
}

// Helper function to handle health check for specific provider
async function handleHealthCheckSpecific(provider: string) {
  let healthResult: { isHealthy: boolean; error?: string };

  if (provider === 'openai') {
    const service = await getOpenAIVectorStoreService();
    healthResult = await service.healthCheck();
  } else if (provider === 'neon') {
    const service = await getNeonVectorStoreService();
    healthResult = {
      isHealthy: service.isEnabled,
      error: service.isEnabled ? undefined : 'Service disabled',
    };
  } else {
    healthResult = { isHealthy: true };
  }

  return {
    success: true,
    data: {
      provider,
      ...healthResult,
      lastChecked: new Date(),
    },
  };
}

// Helper function to handle metrics request
function handleMetricsRequest(
  searchParams: URLSearchParams,
  monitoringService: any,
) {
  const params = MetricsRequest.parse({
    provider: searchParams.get('provider'),
    metricType: searchParams.get('metricType'),
    timeWindow: searchParams.get('timeWindow'),
  });

  const metrics = monitoringService.getMetrics(
    params.provider,
    params.metricType,
    params.timeWindow,
  );

  return {
    success: true,
    data: {
      metrics,
      count: metrics.length,
      timeWindow: params.timeWindow,
      provider: params.provider,
      metricType: params.metricType,
    },
  };
}

// Helper function to handle performance request
function handlePerformanceRequest(
  searchParams: URLSearchParams,
  monitoringService: any,
) {
  const params = PerformanceRequest.parse({
    provider: searchParams.get('provider'),
    timeWindow: searchParams.get('timeWindow'),
  });

  const performance = monitoringService.getPerformanceMetrics(
    params.provider,
    params.timeWindow,
  );

  return {
    success: true,
    data: performance,
  };
}

// Helper function to handle dashboard request
async function handleDashboardRequest(monitoringService: any) {
  const dashboardData = await monitoringService.getDashboardData();
  const healthStatus = monitoringService.getHealthStatus();

  return {
    success: true,
    data: {
      ...dashboardData,
      healthStatus,
      timestamp: new Date(),
    },
  };
}

// Helper function to handle export request
async function handleExportRequest(
  searchParams: URLSearchParams,
  monitoringService: any,
) {
  const timeWindow = searchParams.get('timeWindow') || '24h';
  const metrics = await monitoringService.exportMetrics(timeWindow);

  return {
    success: true,
    data: {
      metrics,
      exportedAt: new Date(),
      timeWindow,
      count: metrics.length,
    },
  };
}

// Helper function to handle alerts request
async function handleAlertsRequest(monitoringService: any) {
  const dashboardData = await monitoringService.getDashboardData();

  return {
    success: true,
    data: {
      alerts: dashboardData.alerts,
      recentErrors: dashboardData.recentErrors,
    },
  };
}

export async function GET(request: NextRequest) {
  const monitoringService = getVectorStoreMonitoringService();
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'dashboard';

  try {
    switch (action) {
      case 'health': {
        const params = HealthCheckRequest.parse({
          provider: searchParams.get('provider'),
        });

        if (params.provider === 'all') {
          const result = await handleHealthCheckAll();
          return NextResponse.json(result);
        } else {
          const result = await handleHealthCheckSpecific(params.provider);
          return NextResponse.json(result);
        }
      }

      case 'metrics': {
        const result = handleMetricsRequest(searchParams, monitoringService);
        return NextResponse.json(result);
      }

      case 'performance': {
        const result = handlePerformanceRequest(
          searchParams,
          monitoringService,
        );
        return NextResponse.json(result);
      }

      case 'dashboard': {
        const result = await handleDashboardRequest(monitoringService);
        return NextResponse.json(result);
      }

      case 'export': {
        const result = await handleExportRequest(
          searchParams,
          monitoringService,
        );
        return NextResponse.json(result);
      }

      case 'alerts': {
        const result = await handleAlertsRequest(monitoringService);
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unknown action: ${action}`,
            availableActions: [
              'health',
              'metrics',
              'performance',
              'dashboard',
              'export',
              'alerts',
            ],
          },
          { status: 400 },
        );
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 },
    );
  }
}

// For testing metrics recording
export async function POST(request: NextRequest) {
  const monitoringService = getVectorStoreMonitoringService();

  try {
    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case 'test_search': {
        // Record a test search metric
        const provider = params.provider || 'openai';
        const latency = params.latency || Math.random() * 1000;
        const success = params.success !== false;

        if (success) {
          monitoringService.recordSearchLatency(provider, latency);
          monitoringService.recordSearchSuccess(provider, { test: true });
        } else {
          monitoringService.recordSearchError(
            provider,
            new Error('Test error'),
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Test metric recorded',
          data: { provider, latency, success },
        });
      }

      case 'cleanup': {
        monitoringService.cleanup();
        return NextResponse.json({
          success: true,
          message: 'Metrics cleanup completed',
        });
      }

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unknown action: ${action}`,
            availableActions: ['test_search', 'cleanup'],
          },
          { status: 400 },
        );
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 },
    );
  }
}
