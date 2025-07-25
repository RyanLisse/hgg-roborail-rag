import 'server-only';

import {
  getVectorStoreMonitoringService,
  startCleanupScheduler,
  startHealthCheckScheduler,
  type VectorStoreProvider,
} from './monitoring';
import { getNeonVectorStoreService } from './neon';
import { getOpenAIVectorStoreService } from './openai';

// Global monitoring state
let monitoringInitialized = false;
let healthCheckCleanup: (() => void) | null = null;
let cleanupSchedulerCleanup: (() => void) | null = null;

/**
 * Initialize the vector store monitoring system
 */
export async function initializeVectorStoreMonitoring(): Promise<void> {
  if (monitoringInitialized) {
    return;
  }

  // Get monitoring service
  const monitoringService = getVectorStoreMonitoringService();

  // Get vector store services to check availability
  const [openaiService, neonService] = await Promise.all([
    getOpenAIVectorStoreService(),
    getNeonVectorStoreService(),
  ]);

  // Determine which providers to monitor
  const providersToMonitor: VectorStoreProvider[] = ['unified']; // Always monitor unified

  if (openaiService.isEnabled) {
    providersToMonitor.push('openai');
  } else {
  }

  if (neonService.isEnabled) {
    providersToMonitor.push('neon');
  } else {
  }

  // Enhanced health check with provider-specific implementations
  const enhancedHealthCheck = async (provider: VectorStoreProvider) => {
    const startTime = Date.now();

    try {
      let result: any;

      switch (provider) {
        case 'openai':
          if (openaiService.isEnabled) {
            result = await openaiService.healthCheck();
          } else {
            result = { isHealthy: false, error: 'Service disabled' };
          }
          break;

        case 'neon':
          if (neonService.isEnabled) {
            // Test database connection
            try {
              await neonService.db.execute('SELECT 1 as test');
              result = {
                isHealthy: true,
                vectorStoreStatus: 'Database connection active',
              };
            } catch (error) {
              result = {
                isHealthy: false,
                error: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
              };
            }
          } else {
            result = { isHealthy: false, error: 'Service disabled' };
          }
          break;

        case 'unified': {
          // Test unified service by checking if any underlying services are available
          const hasAvailableServices =
            openaiService.isEnabled || neonService.isEnabled;
          result = {
            isHealthy: hasAvailableServices,
            vectorStoreStatus: hasAvailableServices
              ? 'At least one vector store service available'
              : 'No vector store services available',
            error: hasAvailableServices
              ? undefined
              : 'No underlying services enabled',
          };
          break;
        }

        default:
          result = { isHealthy: false, error: 'Unknown provider' };
      }

      // Update monitoring service with result
      const _healthResult = {
        provider,
        isHealthy: result.isHealthy,
        latency: Date.now() - startTime,
        lastChecked: new Date(),
        errorMessage: result.error,
        metadata: {
          vectorStoreStatus: result.vectorStoreStatus,
        },
      };

      monitoringService.recordMetric({
        provider,
        metricType: 'service_health',
        value: result.isHealthy ? 1 : 0,
        unit: 'status',
        success: result.isHealthy,
        errorMessage: result.error,
        duration: Date.now() - startTime,
        metadata: {
          vectorStoreStatus: result.vectorStoreStatus,
        },
      });

      return monitoringService.performHealthCheck(provider);
    } catch (error) {
      monitoringService.recordMetric({
        provider,
        metricType: 'service_health',
        value: 0,
        unit: 'status',
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      });

      return monitoringService.performHealthCheck(provider);
    }
  };

  // Override the monitoring service health check method
  const _originalPerformHealthCheck = monitoringService.performHealthCheck;
  monitoringService.performHealthCheck = enhancedHealthCheck;
  healthCheckCleanup = startHealthCheckScheduler(
    monitoringService,
    providersToMonitor,
  );
  cleanupSchedulerCleanup = startCleanupScheduler(monitoringService);
  const initialHealthChecks = await Promise.allSettled(
    providersToMonitor.map((provider) => enhancedHealthCheck(provider)),
  );

  initialHealthChecks.forEach((result, index) => {
    const _provider = providersToMonitor[index];
    if (result.status === 'fulfilled') {
    } else {
    }
  });

  monitoringInitialized = true;
}

/**
 * Cleanup monitoring resources
 */
export function cleanupVectorStoreMonitoring(): void {
  if (!monitoringInitialized) {
    return;
  }

  if (healthCheckCleanup) {
    healthCheckCleanup();
    healthCheckCleanup = null;
  }

  if (cleanupSchedulerCleanup) {
    cleanupSchedulerCleanup();
    cleanupSchedulerCleanup = null;
  }

  monitoringInitialized = false;
}

/**
 * Get monitoring initialization status
 */
export function isMonitoringInitialized(): boolean {
  return monitoringInitialized;
}

/**
 * Force re-initialization of monitoring
 */
export async function reinitializeVectorStoreMonitoring(): Promise<void> {
  cleanupVectorStoreMonitoring();
  await initializeVectorStoreMonitoring();
}

// Graceful shutdown handling
if (typeof process !== 'undefined') {
  const shutdownHandler = () => {
    cleanupVectorStoreMonitoring();
  };

  process.on('SIGTERM', shutdownHandler);
  process.on('SIGINT', shutdownHandler);
  process.on('exit', shutdownHandler);
}
