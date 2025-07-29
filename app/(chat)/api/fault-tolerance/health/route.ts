import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { FaultToleranceFactory } from '@/lib/vectorstore/fault-tolerance';
import { getFaultTolerantNeonVectorStoreService } from '@/lib/vectorstore/neon-fault-tolerant';
import { getFaultTolerantOpenAIVectorStoreService } from '@/lib/vectorstore/openai-fault-tolerant';
import { getFaultTolerantUnifiedVectorStoreService } from '@/lib/vectorstore/unified-fault-tolerant';

// Request schemas
const HealthCheckRequest = z.object({
  services: z.array(z.enum(['openai', 'neon', 'unified', 'system'])).optional(),
  detailed: z.boolean().default(false),
});

// Response schemas
const ServiceHealth = z.object({
  name: z.string(),
  healthy: z.boolean(),
  status: z.record(z.any()),
  metrics: z.record(z.any()).optional(),
  lastCheck: z.number(),
});

const SystemHealthResponse = z.object({
  healthy: z.boolean(),
  services: z.array(ServiceHealth),
  summary: z.object({
    totalServices: z.number(),
    healthyServices: z.number(),
    degradedServices: z.number(),
    failedServices: z.number(),
  }),
  timestamp: z.number(),
});

// Helper function to check OpenAI service health
async function checkOpenAIHealth(detailed: boolean): Promise<any> {
  try {
    const openaiService = getFaultTolerantOpenAIVectorStoreService();
    const health = await openaiService.getSystemHealth();
    const metrics = detailed ? openaiService.getMetrics() : undefined;

    return {
      name: 'openai',
      healthy: health.healthy,
      status: health,
      metrics,
      lastCheck: Date.now(),
    };
  } catch (error) {
    return {
      name: 'openai',
      healthy: false,
      status: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      lastCheck: Date.now(),
    };
  }
}

// Helper function to check Neon service health
async function checkNeonHealth(detailed: boolean): Promise<any> {
  try {
    const neonService = await getFaultTolerantNeonVectorStoreService();
    const health = await neonService.getSystemHealth();
    const metrics = detailed ? neonService.getMetrics() : undefined;

    return {
      name: 'neon',
      healthy: health.healthy,
      status: health,
      metrics,
      lastCheck: Date.now(),
    };
  } catch (error) {
    return {
      name: 'neon',
      healthy: false,
      status: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      lastCheck: Date.now(),
    };
  }
}

// Helper function to check Unified service health
async function checkUnifiedHealth(detailed: boolean): Promise<any> {
  try {
    const unifiedService = await getFaultTolerantUnifiedVectorStoreService();
    const health = await unifiedService.getSystemHealth();
    const metrics = detailed ? unifiedService.getMetrics() : undefined;

    return {
      name: 'unified',
      healthy: (health.unified as any)?.healthy ?? false,
      status: health,
      metrics,
      lastCheck: Date.now(),
    };
  } catch (error) {
    return {
      name: 'unified',
      healthy: false,
      status: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      lastCheck: Date.now(),
    };
  }
}

// Helper function to check System health
async function checkSystemHealth(): Promise<any> {
  try {
    const systemHealth = await FaultToleranceFactory.getSystemHealth();

    return {
      name: 'system',
      healthy: systemHealth.healthy,
      status: systemHealth,
      lastCheck: Date.now(),
    };
  } catch (error) {
    return {
      name: 'system',
      healthy: false,
      status: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      lastCheck: Date.now(),
    };
  }
}

// Helper function to gather all health checks
async function gatherHealthChecks(
  requestedServices: string[],
  detailed: boolean,
): Promise<any[]> {
  const services: any[] = [];
  const healthChecks: Promise<any>[] = [];

  if (requestedServices.includes('openai')) {
    healthChecks.push(checkOpenAIHealth(detailed));
  }

  if (requestedServices.includes('neon')) {
    healthChecks.push(checkNeonHealth(detailed));
  }

  if (requestedServices.includes('unified')) {
    healthChecks.push(checkUnifiedHealth(detailed));
  }

  if (requestedServices.includes('system')) {
    healthChecks.push(checkSystemHealth());
  }

  const results = await Promise.all(healthChecks);
  services.push(...results);

  return services;
}

// GET /api/fault-tolerance/health
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const servicesParam = searchParams.get('services');
    const detailedParam = searchParams.get('detailed');

    const requestData = HealthCheckRequest.parse({
      services: servicesParam ? servicesParam.split(',') : undefined,
      detailed: detailedParam === 'true',
    });

    const requestedServices = requestData.services ?? [
      'openai',
      'neon',
      'unified',
      'system',
    ];

    const services = await gatherHealthChecks(
      requestedServices,
      requestData.detailed,
    );

    // Calculate summary
    const totalServices = services.length;
    const healthyServices = services.filter((s) => s.healthy).length;
    const failedServices = services.filter((s) => !s.healthy).length;
    const degradedServices = 0; // Could be enhanced to detect degraded state

    const overall = healthyServices === totalServices;

    const response = SystemHealthResponse.parse({
      healthy: overall,
      services,
      summary: {
        totalServices,
        healthyServices,
        degradedServices,
        failedServices,
      },
      timestamp: Date.now(),
    });

    return NextResponse.json({
      success: true,
      data: response,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message:
            error instanceof Error ? error.message : 'Unknown error occurred',
          code: 'HEALTH_CHECK_FAILED',
        },
      },
      { status: 500 },
    );
  }
}

// Helper function to trigger system health check
async function triggerSystemHealthCheck(): Promise<any> {
  try {
    const systemHealth = await FaultToleranceFactory.getSystemHealth();
    return {
      service: 'system',
      result: systemHealth,
      triggered: true,
    };
  } catch (error) {
    return {
      service: 'system',
      result: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      triggered: false,
    };
  }
}

// Helper function to trigger OpenAI health check
async function triggerOpenAIHealthCheck(): Promise<any> {
  try {
    const openaiService = getFaultTolerantOpenAIVectorStoreService();
    const health = await openaiService.healthCheck();
    return {
      service: 'openai',
      result: health,
      triggered: true,
    };
  } catch (error) {
    return {
      service: 'openai',
      result: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      triggered: false,
    };
  }
}

// Helper function to trigger Neon health check
async function triggerNeonHealthCheck(): Promise<any> {
  try {
    const neonService = await getFaultTolerantNeonVectorStoreService();
    const health = await neonService.healthCheck();
    return {
      service: 'neon',
      result: health,
      triggered: true,
    };
  } catch (error) {
    return {
      service: 'neon',
      result: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      triggered: false,
    };
  }
}

// Helper function to trigger Unified health check
async function triggerUnifiedHealthCheck(): Promise<any> {
  try {
    const unifiedService = await getFaultTolerantUnifiedVectorStoreService();
    const availableSources = await unifiedService.getAvailableSources();
    return {
      service: 'unified',
      result: { availableSources, healthy: availableSources.length > 0 },
      triggered: true,
    };
  } catch (error) {
    return {
      service: 'unified',
      result: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      triggered: false,
    };
  }
}

// Helper function to gather all health check triggers
function gatherHealthCheckTriggers(
  requestedServices: string[],
): Promise<any[]> {
  const triggerPromises: Promise<any>[] = [];

  if (requestedServices.includes('system')) {
    triggerPromises.push(triggerSystemHealthCheck());
  }

  if (requestedServices.includes('openai')) {
    triggerPromises.push(triggerOpenAIHealthCheck());
  }

  if (requestedServices.includes('neon')) {
    triggerPromises.push(triggerNeonHealthCheck());
  }

  if (requestedServices.includes('unified')) {
    triggerPromises.push(triggerUnifiedHealthCheck());
  }

  return Promise.all(triggerPromises);
}

// POST /api/fault-tolerance/health - Trigger health checks
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const requestData = HealthCheckRequest.parse(body);

    const requestedServices = requestData.services ?? ['system'];
    const results = await gatherHealthCheckTriggers(requestedServices);

    return NextResponse.json({
      success: true,
      data: {
        results,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: {
          message:
            error instanceof Error ? error.message : 'Unknown error occurred',
          code: 'HEALTH_CHECK_TRIGGER_FAILED',
        },
      },
      { status: 500 },
    );
  }
}
