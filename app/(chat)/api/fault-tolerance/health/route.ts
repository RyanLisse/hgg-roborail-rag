import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { FaultToleranceFactory } from "@/lib/vectorstore/fault-tolerance";
import { getFaultTolerantNeonVectorStoreService } from "@/lib/vectorstore/neon-fault-tolerant";
import { getFaultTolerantOpenAIVectorStoreService } from "@/lib/vectorstore/openai-fault-tolerant";
import { getFaultTolerantUnifiedVectorStoreService } from "@/lib/vectorstore/unified-fault-tolerant";

// Request schemas
const HealthCheckRequest = z.object({
  services: z.array(z.enum(["openai", "neon", "unified", "system"])).optional(),
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

// GET /api/fault-tolerance/health
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const servicesParam = searchParams.get("services");
    const detailedParam = searchParams.get("detailed");

    const requestData = HealthCheckRequest.parse({
      services: servicesParam ? servicesParam.split(",") : undefined,
      detailed: detailedParam === "true",
    });

    const requestedServices = requestData.services || [
      "openai",
      "neon",
      "unified",
      "system",
    ];
    const services: any[] = [];

    // Check individual services
    if (requestedServices.includes("openai")) {
      try {
        const openaiService = getFaultTolerantOpenAIVectorStoreService();
        const health = await openaiService.getSystemHealth();
        const metrics = requestData.detailed
          ? openaiService.getMetrics()
          : undefined;

        services.push({
          name: "openai",
          healthy: health.healthy,
          status: health,
          metrics,
          lastCheck: Date.now(),
        });
      } catch (error) {
        services.push({
          name: "openai",
          healthy: false,
          status: {
            error: error instanceof Error ? error.message : "Unknown error",
          },
          lastCheck: Date.now(),
        });
      }
    }

    if (requestedServices.includes("neon")) {
      try {
        const neonService = await getFaultTolerantNeonVectorStoreService();
        const health = await neonService.getSystemHealth();
        const metrics = requestData.detailed
          ? neonService.getMetrics()
          : undefined;

        services.push({
          name: "neon",
          healthy: health.healthy,
          status: health,
          metrics,
          lastCheck: Date.now(),
        });
      } catch (error) {
        services.push({
          name: "neon",
          healthy: false,
          status: {
            error: error instanceof Error ? error.message : "Unknown error",
          },
          lastCheck: Date.now(),
        });
      }
    }

    if (requestedServices.includes("unified")) {
      try {
        const unifiedService =
          await getFaultTolerantUnifiedVectorStoreService();
        const health = await unifiedService.getSystemHealth();
        const metrics = requestData.detailed
          ? unifiedService.getMetrics()
          : undefined;

        services.push({
          name: "unified",
          healthy: (health.unified as any)?.healthy ?? false,
          status: health,
          metrics,
          lastCheck: Date.now(),
        });
      } catch (error) {
        services.push({
          name: "unified",
          healthy: false,
          status: {
            error: error instanceof Error ? error.message : "Unknown error",
          },
          lastCheck: Date.now(),
        });
      }
    }

    if (requestedServices.includes("system")) {
      try {
        const systemHealth = await FaultToleranceFactory.getSystemHealth();

        services.push({
          name: "system",
          healthy: systemHealth.healthy,
          status: systemHealth,
          lastCheck: Date.now(),
        });
      } catch (error) {
        services.push({
          name: "system",
          healthy: false,
          status: {
            error: error instanceof Error ? error.message : "Unknown error",
          },
          lastCheck: Date.now(),
        });
      }
    }

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
    console.error("Health check API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: {
          message:
            error instanceof Error ? error.message : "Unknown error occurred",
          code: "HEALTH_CHECK_FAILED",
        },
      },
      { status: 500 },
    );
  }
}

// POST /api/fault-tolerance/health - Trigger health checks
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const requestData = HealthCheckRequest.parse(body);

    const requestedServices = requestData.services || ["system"];
    const results: any[] = [];

    // Trigger health checks for requested services
    if (requestedServices.includes("system")) {
      try {
        const systemHealth = await FaultToleranceFactory.getSystemHealth();
        results.push({
          service: "system",
          result: systemHealth,
          triggered: true,
        });
      } catch (error) {
        results.push({
          service: "system",
          result: {
            error: error instanceof Error ? error.message : "Unknown error",
          },
          triggered: false,
        });
      }
    }

    if (requestedServices.includes("openai")) {
      try {
        const openaiService = getFaultTolerantOpenAIVectorStoreService();
        const health = await openaiService.healthCheck();
        results.push({
          service: "openai",
          result: health,
          triggered: true,
        });
      } catch (error) {
        results.push({
          service: "openai",
          result: {
            error: error instanceof Error ? error.message : "Unknown error",
          },
          triggered: false,
        });
      }
    }

    if (requestedServices.includes("neon")) {
      try {
        const neonService = await getFaultTolerantNeonVectorStoreService();
        const health = await neonService.healthCheck();
        results.push({
          service: "neon",
          result: health,
          triggered: true,
        });
      } catch (error) {
        results.push({
          service: "neon",
          result: {
            error: error instanceof Error ? error.message : "Unknown error",
          },
          triggered: false,
        });
      }
    }

    if (requestedServices.includes("unified")) {
      try {
        const unifiedService =
          await getFaultTolerantUnifiedVectorStoreService();
        const availableSources = await unifiedService.getAvailableSources();
        results.push({
          service: "unified",
          result: { availableSources, healthy: availableSources.length > 0 },
          triggered: true,
        });
      } catch (error) {
        results.push({
          service: "unified",
          result: {
            error: error instanceof Error ? error.message : "Unknown error",
          },
          triggered: false,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        results,
        timestamp: Date.now(),
      },
    });
  } catch (error) {
    console.error("Health check trigger API error:", error);

    return NextResponse.json(
      {
        success: false,
        error: {
          message:
            error instanceof Error ? error.message : "Unknown error occurred",
          code: "HEALTH_CHECK_TRIGGER_FAILED",
        },
      },
      { status: 500 },
    );
  }
}
