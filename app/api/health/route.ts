import { ApiResponses, withApiErrorHandling } from '@/lib/api/error-handling';
import { checkEnvironment, logEnvironmentStatus } from '@/lib/utils/env-check';

export const GET = withApiErrorHandling(
  async () => {
    // Log environment status for debugging
    logEnvironmentStatus();

    const envStatus = checkEnvironment();

    // Test database connection if available
    let dbStatus = 'not_configured';
    if (process.env.POSTGRES_URL) {
      try {
        // Try a simple database query
        const { getDb } = await import('@/lib/db/queries');
        await getDb();
        dbStatus = 'connected';
      } catch (_error) {
        dbStatus = 'error';
      }
    }

    return ApiResponses.success({
      status: 'ok',
      timestamp: new Date().toISOString(),
      environment: {
        node_env: process.env.NODE_ENV,
        isValid: envStatus.isValid,
        availableProviders: envStatus.availableProviders,
        errors: envStatus.errors,
        warnings: envStatus.warnings,
      },
      services: {
        database: dbStatus,
        redis: process.env.REDIS_URL ? 'configured' : 'not_configured',
        blob_storage: process.env.BLOB_READ_WRITE_TOKEN
          ? 'configured'
          : 'not_configured',
      },
    });
  },
  {
    requireAuth: false,
    requireRateLimit: false,
  },
);
