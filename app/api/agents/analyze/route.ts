import { z } from 'zod';
import { auth } from '@/app/(auth)/auth';
import {
  analyzeComplexity,
  classifyIntent,
  getRoutingDecision,
} from '@/lib/agents';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { getMessageCountByUserId } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';

export const maxDuration = 30;

const requestSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  sources: z
    .array(z.enum(['openai', 'supabase', 'memory']))
    .optional()
    .default(['memory']),
  includeComplexity: z.boolean().optional().default(true),
  includeIntent: z.boolean().optional().default(true),
});

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const userType = session.user.type;

    // Check rate limits (analysis requests count towards message quota)
    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError('rate_limit:chat').toResponse();
    }

    // Parse and validate request body
    const json = await request.json();
    const { query, sources, includeComplexity, includeIntent } =
      requestSchema.parse(json);

    // Perform analysis in parallel
    const [routingDecision, intent, complexity] = await Promise.all([
      getRoutingDecision(query, {
        sources,
        maxResults: 10,
        complexity: 'moderate',
        domainKeywords: [],
        requiresCitations: true,
      }),
      includeIntent ? classifyIntent(query) : Promise.resolve(null),
      includeComplexity ? analyzeComplexity(query) : Promise.resolve(null),
    ]);

    return Response.json({
      query,
      routing: routingDecision,
      intent,
      complexity,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({
          code: 'bad_request:validation',
          message: 'Invalid request parameters',
          details: error.errors,
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    return new Response(
      JSON.stringify({
        code: 'internal_server_error:agent',
        message: 'An unexpected error occurred while analyzing your query',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
