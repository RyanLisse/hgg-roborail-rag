import "server-only";

import { z } from "zod";

// Monitoring Schemas
export const MetricType = z.enum([
  "search_latency",
  "search_success",
  "search_error",
  "token_usage",
  "file_upload",
  "file_upload_error",
  "vector_store_health",
  "embedding_generation",
  "retrieval_accuracy",
  "cache_hit",
  "cache_miss",
  "connection_error",
  "rate_limit_error",
  "quota_exceeded",
  "service_health",
]);

export const VectorStoreProvider = z.enum([
  "openai",
  "neon",
  "unified",
  "memory",
]);

export const ErrorCategory = z.enum([
  "network_error",
  "authentication_error",
  "rate_limit_error",
  "quota_exceeded",
  "validation_error",
  "service_unavailable",
  "timeout_error",
  "unknown_error",
]);

export const MetricEvent = z.object({
  id: z.string(),
  timestamp: z.date(),
  provider: VectorStoreProvider,
  metricType: MetricType,
  value: z.number(),
  unit: z.string(),
  metadata: z.record(z.any()).optional(),
  tags: z.record(z.string()).optional(),
  errorCategory: ErrorCategory.optional(),
  errorMessage: z.string().optional(),
  duration: z.number().optional(),
  success: z.boolean().optional(),
});

export const HealthCheckResult = z.object({
  provider: VectorStoreProvider,
  isHealthy: z.boolean(),
  latency: z.number().optional(),
  lastChecked: z.date(),
  errorMessage: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

export const PerformanceMetrics = z.object({
  provider: VectorStoreProvider,
  timeWindow: z.string(), // e.g., '1h', '24h', '7d'
  totalRequests: z.number(),
  successRate: z.number(),
  averageLatency: z.number(),
  p95Latency: z.number(),
  p99Latency: z.number(),
  errorRate: z.number(),
  tokensUsed: z.number().optional(),
  costEstimate: z.number().optional(),
  lastUpdated: z.date(),
});

export const AlertRule = z.object({
  id: z.string(),
  name: z.string(),
  provider: VectorStoreProvider.optional(),
  metricType: MetricType,
  threshold: z.number(),
  operator: z.enum(["gt", "lt", "gte", "lte", "eq"]),
  timeWindow: z.string(),
  isActive: z.boolean(),
  lastTriggered: z.date().optional(),
});

export const MonitoringConfig = z.object({
  enabled: z.boolean().default(true),
  metricsRetentionDays: z.number().default(30),
  healthCheckIntervalMs: z.number().default(60_000), // 1 minute
  alertingEnabled: z.boolean().default(true),
  enableDetailedLogging: z.boolean().default(false),
  maxMetricsPerProvider: z.number().default(10_000),
  performanceThresholds: z
    .object({
      maxLatencyMs: z.number().default(5000),
      minSuccessRate: z.number().default(0.95),
      maxErrorRate: z.number().default(0.05),
    })
    .default({
      maxLatencyMs: 5000,
      minSuccessRate: 0.95,
      maxErrorRate: 0.05,
    }),
});

// Types
export type MetricType = z.infer<typeof MetricType>;
export type VectorStoreProvider = z.infer<typeof VectorStoreProvider>;
export type ErrorCategory = z.infer<typeof ErrorCategory>;
export type MetricEvent = z.infer<typeof MetricEvent>;
export type HealthCheckResult = z.infer<typeof HealthCheckResult>;
export type PerformanceMetrics = z.infer<typeof PerformanceMetrics>;
export type AlertRule = z.infer<typeof AlertRule>;
export type MonitoringConfig = z.infer<typeof MonitoringConfig>;

// In-memory storage for metrics (in production, use Redis or database)
class MetricsStore {
  private metrics: Map<string, MetricEvent[]> = new Map();
  private healthStatus: Map<VectorStoreProvider, HealthCheckResult> = new Map();
  public alerts: Map<string, AlertRule> = new Map();
  public config: MonitoringConfig;

  constructor(config?: Partial<MonitoringConfig>) {
    this.config = MonitoringConfig.parse(config || {});
    this.initializeDefaultAlerts();
  }

  private initializeDefaultAlerts() {
    const defaultAlerts: AlertRule[] = [
      {
        id: "high_latency",
        name: "High Search Latency",
        metricType: "search_latency",
        threshold: this.config.performanceThresholds.maxLatencyMs,
        operator: "gt",
        timeWindow: "5m",
        isActive: true,
      },
      {
        id: "low_success_rate",
        name: "Low Success Rate",
        metricType: "search_success",
        threshold: this.config.performanceThresholds.minSuccessRate,
        operator: "lt",
        timeWindow: "10m",
        isActive: true,
      },
      {
        id: "high_error_rate",
        name: "High Error Rate",
        metricType: "search_error",
        threshold: this.config.performanceThresholds.maxErrorRate,
        operator: "gt",
        timeWindow: "10m",
        isActive: true,
      },
    ];

    defaultAlerts.forEach((alert) => {
      this.alerts.set(alert.id, alert);
    });
  }

  addMetric(metric: Omit<MetricEvent, "id" | "timestamp">): MetricEvent {
    const event = MetricEvent.parse({
      ...metric,
      id: crypto.randomUUID(),
      timestamp: new Date(),
    });

    const key = `${metric.provider}_${metric.metricType}`;
    const existing = this.metrics.get(key) || [];
    existing.push(event);

    // Limit metrics per provider to prevent memory issues
    if (existing.length > this.config.maxMetricsPerProvider) {
      existing.splice(0, existing.length - this.config.maxMetricsPerProvider);
    }

    this.metrics.set(key, existing);
    this.checkAlerts(event);

    return event;
  }

  getMetrics(
    provider?: VectorStoreProvider,
    metricType?: MetricType,
    timeWindow?: string,
  ): MetricEvent[] {
    const now = new Date();
    const windowMs = this.parseTimeWindow(timeWindow || "24h");
    const cutoff = new Date(now.getTime() - windowMs);

    const allMetrics: MetricEvent[] = [];

    for (const [key, metrics] of this.metrics.entries()) {
      const [keyProvider, keyMetricType] = key.split("_");

      if (provider && keyProvider !== provider) continue;
      if (metricType && keyMetricType !== metricType) continue;

      const filteredMetrics = metrics.filter((m) => m.timestamp >= cutoff);
      allMetrics.push(...filteredMetrics);
    }

    return allMetrics.sort(
      (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
    );
  }

  updateHealthStatus(result: HealthCheckResult): void {
    this.healthStatus.set(result.provider, result);
  }

  getHealthStatus(provider?: VectorStoreProvider): HealthCheckResult[] {
    if (provider) {
      const status = this.healthStatus.get(provider);
      return status ? [status] : [];
    }
    return Array.from(this.healthStatus.values());
  }

  getPerformanceMetrics(
    provider: VectorStoreProvider,
    timeWindow = "24h",
  ): PerformanceMetrics {
    const metrics = this.getMetrics(provider, undefined, timeWindow);
    const searchMetrics = metrics.filter(
      (m) => m.metricType === "search_latency",
    );
    const successMetrics = metrics.filter(
      (m) => m.metricType === "search_success",
    );
    const errorMetrics = metrics.filter((m) => m.metricType === "search_error");

    const totalRequests = searchMetrics.length;
    const successCount = successMetrics.filter(
      (m) => m.success === true,
    ).length;
    const errorCount = errorMetrics.length;

    const latencies = searchMetrics.map((m) => m.value).sort((a, b) => a - b);
    const averageLatency =
      latencies.length > 0
        ? latencies.reduce((sum, val) => sum + val, 0) / latencies.length
        : 0;

    const p95Index = Math.floor(latencies.length * 0.95);
    const p99Index = Math.floor(latencies.length * 0.99);

    const tokensUsed = metrics
      .filter((m) => m.metricType === "token_usage")
      .reduce((sum, m) => sum + m.value, 0);

    return PerformanceMetrics.parse({
      provider,
      timeWindow,
      totalRequests,
      successRate: totalRequests > 0 ? successCount / totalRequests : 0,
      averageLatency,
      p95Latency: latencies[p95Index] || 0,
      p99Latency: latencies[p99Index] || 0,
      errorRate: totalRequests > 0 ? errorCount / totalRequests : 0,
      tokensUsed: tokensUsed > 0 ? tokensUsed : undefined,
      lastUpdated: new Date(),
    });
  }

  private checkAlerts(metric: MetricEvent): void {
    if (!this.config.alertingEnabled) return;

    for (const alert of this.alerts.values()) {
      if (!alert.isActive) continue;
      if (alert.provider && alert.provider !== metric.provider) continue;
      if (alert.metricType !== metric.metricType) continue;

      const shouldTrigger = this.evaluateAlert(alert, metric);
      if (shouldTrigger) {
        this.triggerAlert(alert, metric);
      }
    }
  }

  private evaluateAlert(alert: AlertRule, metric: MetricEvent): boolean {
    const { threshold, operator } = alert;
    const value = metric.value;

    switch (operator) {
      case "gt":
        return value > threshold;
      case "lt":
        return value < threshold;
      case "gte":
        return value >= threshold;
      case "lte":
        return value <= threshold;
      case "eq":
        return value === threshold;
      default:
        return false;
    }
  }

  private triggerAlert(alert: AlertRule, metric: MetricEvent): void {
    const now = new Date();
    alert.lastTriggered = now;

    console.warn(`🚨 Alert triggered: ${alert.name}`, {
      provider: metric.provider,
      metric: metric.metricType,
      value: metric.value,
      threshold: alert.threshold,
      timestamp: now.toISOString(),
    });

    // In production, you would send notifications here
    // e.g., to Slack, email, PagerDuty, etc.
  }

  private parseTimeWindow(timeWindow: string): number {
    const match = timeWindow.match(/^(\d+)([smhd])$/);
    if (!match) return 24 * 60 * 60 * 1000; // Default to 24 hours

    const [, value, unit] = match;
    const num = Number.parseInt(value, 10);

    switch (unit) {
      case "s":
        return num * 1000;
      case "m":
        return num * 60 * 1000;
      case "h":
        return num * 60 * 60 * 1000;
      case "d":
        return num * 24 * 60 * 60 * 1000;
      default:
        return 24 * 60 * 60 * 1000;
    }
  }

  cleanup(): void {
    const cutoff = new Date(
      Date.now() - this.config.metricsRetentionDays * 24 * 60 * 60 * 1000,
    );

    for (const [key, metrics] of this.metrics.entries()) {
      const filtered = metrics.filter((m) => m.timestamp >= cutoff);
      this.metrics.set(key, filtered);
    }
  }
}

// Performance monitoring decorator
export function withPerformanceMonitoring<T extends any[], R>(
  provider: VectorStoreProvider,
  operation: string,
  fn: (...args: T) => Promise<R>,
) {
  return async function (this: any, ...args: T): Promise<R> {
    const startTime = Date.now();
    let success = false;
    let errorCategory: ErrorCategory | undefined;
    let errorMessage: string | undefined;

    try {
      const result = await fn.call(this, ...args);
      success = true;
      return result;
    } catch (error) {
      success = false;
      errorMessage = error instanceof Error ? error.message : String(error);
      errorCategory = categorizeError(error);
      throw error;
    } finally {
      const duration = Date.now() - startTime;

      // Record performance metrics
      const monitoringService = getVectorStoreMonitoringService();
      monitoringService.recordMetric({
        provider,
        metricType: success ? "search_success" : "search_error",
        value: success ? 1 : 0,
        unit: "count",
        duration,
        success,
        errorCategory,
        errorMessage,
        metadata: {
          operation,
          args: JSON.stringify(args).slice(0, 500), // Limit size
        },
      });

      if (operation.includes("search") || operation.includes("query")) {
        monitoringService.recordMetric({
          provider,
          metricType: "search_latency",
          value: duration,
          unit: "ms",
          metadata: { operation },
        });
      }
    }
  };
}

// Error categorization
function categorizeError(error: any): ErrorCategory {
  if (!error) return "unknown_error";

  const message = error.message?.toLowerCase() || "";
  const code = error.code?.toLowerCase() || "";

  if (message.includes("timeout") || code.includes("timeout")) {
    return "timeout_error";
  }
  if (message.includes("rate limit") || code.includes("rate_limit")) {
    return "rate_limit_error";
  }
  if (message.includes("quota") || message.includes("exceeded")) {
    return "quota_exceeded";
  }
  if (
    message.includes("auth") ||
    message.includes("unauthorized") ||
    code === "invalid_api_key"
  ) {
    return "authentication_error";
  }
  if (
    message.includes("network") ||
    message.includes("connection") ||
    code.includes("econnrefused")
  ) {
    return "network_error";
  }
  if (message.includes("validation") || message.includes("invalid")) {
    return "validation_error";
  }
  if (
    message.includes("unavailable") ||
    message.includes("503") ||
    message.includes("502")
  ) {
    return "service_unavailable";
  }

  return "unknown_error";
}

// Monitoring service interface
export interface VectorStoreMonitoringService {
  config: MonitoringConfig;

  // Metric recording
  recordMetric: (metric: Omit<MetricEvent, "id" | "timestamp">) => MetricEvent;
  recordSearchLatency: (
    provider: VectorStoreProvider,
    latency: number,
    metadata?: Record<string, any>,
  ) => void;
  recordSearchSuccess: (
    provider: VectorStoreProvider,
    metadata?: Record<string, any>,
  ) => void;
  recordSearchError: (
    provider: VectorStoreProvider,
    error: Error,
    metadata?: Record<string, any>,
  ) => void;
  recordTokenUsage: (
    provider: VectorStoreProvider,
    tokens: number,
    metadata?: Record<string, any>,
  ) => void;

  // Health monitoring
  performHealthCheck: (
    provider: VectorStoreProvider,
  ) => Promise<HealthCheckResult>;
  getHealthStatus: (provider?: VectorStoreProvider) => HealthCheckResult[];

  // Performance analytics
  getPerformanceMetrics: (
    provider: VectorStoreProvider,
    timeWindow?: string,
  ) => PerformanceMetrics;
  getMetrics: (
    provider?: VectorStoreProvider,
    metricType?: MetricType,
    timeWindow?: string,
  ) => MetricEvent[];

  // Dashboard data
  getDashboardData: () => Promise<{
    overview: Record<VectorStoreProvider, PerformanceMetrics>;
    healthStatus: HealthCheckResult[];
    recentErrors: MetricEvent[];
    alerts: AlertRule[];
  }>;

  // Utilities
  cleanup: () => void;
  exportMetrics: (timeWindow?: string) => Promise<MetricEvent[]>;
}

// Create monitoring service
export function createVectorStoreMonitoringService(
  config?: Partial<MonitoringConfig>,
): VectorStoreMonitoringService {
  const store = new MetricsStore(config);

  return {
    config: store.config,

    recordMetric(metric: Omit<MetricEvent, "id" | "timestamp">): MetricEvent {
      return store.addMetric(metric);
    },

    recordSearchLatency(
      provider: VectorStoreProvider,
      latency: number,
      metadata?: Record<string, any>,
    ): void {
      this.recordMetric({
        provider,
        metricType: "search_latency",
        value: latency,
        unit: "ms",
        metadata,
      });
    },

    recordSearchSuccess(
      provider: VectorStoreProvider,
      metadata?: Record<string, any>,
    ): void {
      this.recordMetric({
        provider,
        metricType: "search_success",
        value: 1,
        unit: "count",
        success: true,
        metadata,
      });
    },

    recordSearchError(
      provider: VectorStoreProvider,
      error: Error,
      metadata?: Record<string, any>,
    ): void {
      this.recordMetric({
        provider,
        metricType: "search_error",
        value: 1,
        unit: "count",
        success: false,
        errorCategory: categorizeError(error),
        errorMessage: error.message,
        metadata,
      });
    },

    recordTokenUsage(
      provider: VectorStoreProvider,
      tokens: number,
      metadata?: Record<string, any>,
    ): void {
      this.recordMetric({
        provider,
        metricType: "token_usage",
        value: tokens,
        unit: "tokens",
        metadata,
      });
    },

    async performHealthCheck(
      provider: VectorStoreProvider,
    ): Promise<HealthCheckResult> {
      const startTime = Date.now();
      let isHealthy = false;
      let errorMessage: string | undefined;

      try {
        // Health check logic would be implemented per provider
        // This is a placeholder that should be overridden
        isHealthy = true;
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : String(error);
      }

      const result = HealthCheckResult.parse({
        provider,
        isHealthy,
        latency: Date.now() - startTime,
        lastChecked: new Date(),
        errorMessage,
      });

      store.updateHealthStatus(result);
      return result;
    },

    getHealthStatus(provider?: VectorStoreProvider): HealthCheckResult[] {
      return store.getHealthStatus(provider);
    },

    getPerformanceMetrics(
      provider: VectorStoreProvider,
      timeWindow = "24h",
    ): PerformanceMetrics {
      return store.getPerformanceMetrics(provider, timeWindow);
    },

    getMetrics(
      provider?: VectorStoreProvider,
      metricType?: MetricType,
      timeWindow?: string,
    ): MetricEvent[] {
      return store.getMetrics(provider, metricType, timeWindow);
    },

    async getDashboardData() {
      const providers: VectorStoreProvider[] = [
        "openai",
        "neon",
        "unified",
        "memory",
      ];
      const overview: Record<VectorStoreProvider, PerformanceMetrics> =
        {} as any;

      for (const provider of providers) {
        overview[provider] = this.getPerformanceMetrics(provider);
      }

      const healthStatus = this.getHealthStatus();
      const recentErrors = this.getMetrics(undefined, "search_error", "1h");
      const alerts = Array.from(store.alerts.values());

      return {
        overview,
        healthStatus,
        recentErrors,
        alerts,
      };
    },

    cleanup(): void {
      store.cleanup();
    },

    async exportMetrics(timeWindow = "24h"): Promise<MetricEvent[]> {
      return this.getMetrics(undefined, undefined, timeWindow);
    },
  };
}

// Singleton monitoring service
let monitoringServiceInstance: VectorStoreMonitoringService | null = null;

export function getVectorStoreMonitoringService(): VectorStoreMonitoringService {
  if (!monitoringServiceInstance) {
    monitoringServiceInstance = createVectorStoreMonitoringService();
  }
  return monitoringServiceInstance;
}

// Health check scheduler
export function startHealthCheckScheduler(
  service: VectorStoreMonitoringService,
  providers: VectorStoreProvider[] = ["openai", "neon", "unified"],
): () => void {
  const interval = setInterval(async () => {
    for (const provider of providers) {
      try {
        await service.performHealthCheck(provider);
      } catch (error) {
        console.warn(`Health check failed for ${provider}:`, error);
      }
    }
  }, service.config.healthCheckIntervalMs);

  return () => clearInterval(interval);
}

// Cleanup scheduler
export function startCleanupScheduler(
  service: VectorStoreMonitoringService,
): () => void {
  const interval = setInterval(
    () => {
      service.cleanup();
    },
    24 * 60 * 60 * 1000,
  ); // Run daily

  return () => clearInterval(interval);
}
