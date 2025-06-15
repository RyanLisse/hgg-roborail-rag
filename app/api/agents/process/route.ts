import { processQuery, processQueryStream } from '@/lib/agents';
import {
  withStreamingApiErrorHandling,
  ApiResponses,
} from '@/lib/api/error-handling';
import { z } from 'zod';

export const maxDuration = 60;

const requestSchema = z.object({
  query: z.string().min(1, 'Query is required'),
  chatHistory: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant', 'system']),
        content: z.string(),
      }),
    )
    .optional()
    .default([]),
  sources: z
    .array(z.enum(['openai', 'neon', 'memory']))
    .optional()
    .default(['memory']),
  modelId: z.string().optional(),
  streaming: z.boolean().optional().default(false),
});

export const POST = withStreamingApiErrorHandling(
  async (request, { session, validatedBody }) => {
    const { query, chatHistory, sources, modelId, streaming } = validatedBody;

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
                  content: chunk,
                });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              } else {
                // Stream final response
                const data = JSON.stringify({
                  type: 'final-response',
                  response: chunk,
                });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              }
            }

            controller.close();
          } catch (error) {
            console.error('Agent streaming error:', error);
            const errorData = JSON.stringify({
              type: 'error',
              error: 'An error occurred while processing your request',
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
          Connection: 'keep-alive',
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

      return ApiResponses.success(response);
    }
  },
  {
    requireAuth: true,
    requireRateLimit: true,
    requestSchema,
  },
);
