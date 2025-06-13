import { auth } from '@/app/(auth)/auth';
import { processQuery, processQueryStream } from '@/lib/agents';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { getMessageCountByUserId } from '@/lib/db/queries';
import { ChatSDKError } from '@/lib/errors';
import { z } from 'zod';

export const maxDuration = 60;

const requestSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  chatHistory: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
  })).optional().default([]),
  sources: z.array(z.enum(['openai', 'neon', 'memory'])).optional().default(['memory']),
  modelId: z.string().optional(),
  streaming: z.boolean().optional().default(false),
});

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const userType = session.user.type;

    // Check rate limits
    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError('rate_limit:chat').toResponse();
    }

    // Parse and validate request body
    const json = await request.json();
    const { query, chatHistory, sources, modelId, streaming } = requestSchema.parse(json);

    if (streaming) {
      // Return streaming response
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const agentStream = processQueryStream(query, {
              chatHistory,
              sources,
              modelId,
            });

            for await (const chunk of agentStream) {
              if (typeof chunk === 'string') {
                // Stream text chunk
                const data = JSON.stringify({ 
                  type: 'text-delta',
                  content: chunk 
                });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              } else {
                // Stream final response
                const data = JSON.stringify({ 
                  type: 'final-response',
                  response: chunk 
                });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              }
            }

            controller.close();
          } catch (error) {
            console.error('Agent streaming error:', error);
            const errorData = JSON.stringify({ 
              type: 'error',
              error: 'An error occurred while processing your request' 
            });
            controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      // Return non-streaming response
      const response = await processQuery(query, {
        chatHistory,
        sources,
        modelId,
        streaming: false,
      });

      return Response.json(response);
    }

  } catch (error) {
    console.error('Agent API error:', error);
    
    if (error instanceof z.ZodError) {
      return new Response(
        JSON.stringify({ 
          code: 'bad_request:validation',
          message: 'Invalid request parameters',
          details: error.errors 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }
    
    return new Response(
      JSON.stringify({ 
        code: 'internal_server_error:agent',
        message: 'An unexpected error occurred while processing your request' 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}