import { auth } from '@/app/(auth)/auth';
import { getSystemHealth, getAgentCapabilities } from '@/lib/agents';
import { ChatSDKError } from '@/lib/errors';

export const maxDuration = 10;

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    // Get system health and agent capabilities
    const [health, capabilities] = await Promise.all([
      getSystemHealth(),
      getAgentCapabilities(),
    ]);

    return Response.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      health,
      capabilities,
      user: {
        id: session.user.id,
        type: session.user.type,
      },
    });

  } catch (error) {
    console.error('Agent health check error:', error);
    
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    
    return new Response(
      JSON.stringify({ 
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        code: 'internal_server_error:health'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}