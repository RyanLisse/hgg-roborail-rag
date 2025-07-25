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
          // Perform health checks for all providers
          const [openaiService, neonService, _unifiedService] =
            await Promise.all([
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

          return NextResponse.json({
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
          });
        } else {
          // Perform health check for specific provider
          let healthResult: { isHealthy: boolean; error?: string };

          if (params.provider === 'openai') {
            const service = await getOpenAIVectorStoreService();
            healthResult = await service.healthCheck();
          } else if (params.provider === 'neon') {
            const service = await getNeonVectorStoreService();
            healthResult = {
              isHealthy: service.isEnabled,
              error: service.isEnabled ? undefined : 'Service disabled',
            };
          } else {
            healthResult = { isHealthy: true };
          }

          return NextResponse.json({
            success: true,
            data: {
              provider: params.provider,
              ...healthResult,
              lastChecked: new Date(),
            },
          });
        }
      }

      case 'metrics': {
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

        return NextResponse.json({
          success: true,
          data: {
            metrics,
            count: metrics.length,
            timeWindow: params.timeWindow,
            provider: params.provider,
            metricType: params.metricType,
          },
        });
      }

      case 'performance': {
        const params = PerformanceRequest.parse({
          provider: searchParams.get('provider'),
          timeWindow: searchParams.get('timeWindow'),
        });

        const performance = monitoringService.getPerformanceMetrics(
          params.provider,
          params.timeWindow,
        );

        return NextResponse.json({
          success: true,
          data: performance,
        });
      }

      case 'dashboard': {
        const dashboardData = await monitoringService.getDashboardData();

        // Add real-time health status
        const healthStatus = monitoringService.getHealthStatus();

        return NextResponse.json({
          success: true,
          data: {
            ...dashboardData,
            healthStatus,
            timestamp: new Date(),
          },
        });
      }

      case 'export': {
        const timeWindow = searchParams.get('timeWindow') || '24h';
        const metrics = await monitoringService.exportMetrics(timeWindow);

        return NextResponse.json({
          success: true,
          data: {
            metrics,
            exportedAt: new Date(),
            timeWindow,
            count: metrics.length,
          },
        });
      }

      case 'alerts': {
        const dashboardData = await monitoringService.getDashboardData();

        return NextResponse.json({
          success: true,
          data: {
            alerts: dashboardData.alerts,
            recentErrors: dashboardData.recentErrors,
          },
        });
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
