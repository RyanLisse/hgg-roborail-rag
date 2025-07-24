import { getAgentCapabilities, getSystemHealth } from '@/lib/agents';
import { ApiResponses, withApiErrorHandling } from '@/lib/api/error-handling';

export const maxDuration = 10;

export const GET = withApiErrorHandling(
  async (_request, { session }) => {
    // Get system health and agent capabilities
    const [health, capabilities] = await Promise.all([
      getSystemHealth(),
      getAgentCapabilities(),
    ]);

    return ApiResponses.success({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      health,
      capabilities,
      user: {
        id: session?.user.id,
        type: session?.user.type,
      },
    });
  },
  {
    requireAuth: true,
    requireRateLimit: false,
  },
);
