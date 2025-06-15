import 'server-only';

import {
  getVectorStoreMonitoringService,
  startHealthCheckScheduler,
  startCleanupScheduler,
  type VectorStoreProvider,
} from './monitoring';
import { getOpenAIVectorStoreService } from './openai';
import { getNeonVectorStoreService } from './neon';

// Global monitoring state
let monitoringInitialized = false;
let healthCheckCleanup: (() => void) | null = null;
let cleanupSchedulerCleanup: (() => void) | null = null;

/**
 * Initialize the vector store monitoring system
 */
export async function initializeVectorStoreMonitoring(): Promise<void> {
  if (monitoringInitialized) {
    console.log('Vector store monitoring already initialized');
    return;
  }

  try {
    console.log('🔧 Initializing vector store monitoring system...');

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
      console.log('✅ OpenAI vector store monitoring enabled');
    } else {
      console.log('⚠️ OpenAI vector store monitoring disabled (no API key)');
    }

    if (neonService.isEnabled) {
      providersToMonitor.push('neon');
      console.log('✅ Neon vector store monitoring enabled');
    } else {
      console.log(
        '⚠️ Neon vector store monitoring disabled (no connection string)',
      );
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
        const healthResult = {
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
        console.error(`Health check failed for ${provider}:`, error);

        monitoringService.recordMetric({
          provider,
          metricType: 'service_health',
          value: 0,
          unit: 'status',
          success: false,
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - startTime,
        });

        return monitoringService.performHealthCheck(provider);
      }
    };

    // Override the monitoring service health check method
    const originalPerformHealthCheck = monitoringService.performHealthCheck;
    monitoringService.performHealthCheck = enhancedHealthCheck;

    // Start health check scheduler
    console.log(
      `🩺 Starting health check scheduler for providers: ${providersToMonitor.join(', ')}`,
    );
    healthCheckCleanup = startHealthCheckScheduler(
      monitoringService,
      providersToMonitor,
    );

    // Start cleanup scheduler
    console.log('🧹 Starting metrics cleanup scheduler');
    cleanupSchedulerCleanup = startCleanupScheduler(monitoringService);

    // Perform initial health checks
    console.log('🔍 Performing initial health checks...');
    const initialHealthChecks = await Promise.allSettled(
      providersToMonitor.map((provider) => enhancedHealthCheck(provider)),
    );

    initialHealthChecks.forEach((result, index) => {
      const provider = providersToMonitor[index];
      if (result.status === 'fulfilled') {
        console.log(
          `✅ Initial health check for ${provider}: ${result.value.isHealthy ? 'Healthy' : 'Unhealthy'}`,
        );
      } else {
        console.error(
          `❌ Initial health check failed for ${provider}:`,
          result.reason,
        );
      }
    });

    monitoringInitialized = true;
    console.log('🎯 Vector store monitoring system initialized successfully');

    // Log monitoring configuration
    console.log('📊 Monitoring configuration:', {
      enabled: monitoringService.config.enabled,
      healthCheckInterval: `${monitoringService.config.healthCheckIntervalMs}ms`,
      metricsRetention: `${monitoringService.config.metricsRetentionDays} days`,
      alertingEnabled: monitoringService.config.alertingEnabled,
      providersMonitored: providersToMonitor.length,
    });
  } catch (error) {
    console.error('❌ Failed to initialize vector store monitoring:', error);
    throw error;
  }
}

/**
 * Cleanup monitoring resources
 */
export function cleanupVectorStoreMonitoring(): void {
  if (!monitoringInitialized) {
    return;
  }

  console.log('🧹 Cleaning up vector store monitoring...');

  if (healthCheckCleanup) {
    healthCheckCleanup();
    healthCheckCleanup = null;
  }

  if (cleanupSchedulerCleanup) {
    cleanupSchedulerCleanup();
    cleanupSchedulerCleanup = null;
  }

  monitoringInitialized = false;
  console.log('✅ Vector store monitoring cleanup completed');
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
    console.log('🛑 Received shutdown signal, cleaning up monitoring...');
    cleanupVectorStoreMonitoring();
  };

  process.on('SIGTERM', shutdownHandler);
  process.on('SIGINT', shutdownHandler);
  process.on('exit', shutdownHandler);
}
