import { auth } from '@/app/(auth)/auth';
import { getAgentCapabilities } from '@/lib/agents';
import { ChatSDKError } from '@/lib/errors';

export const maxDuration = 5;

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const capabilities = getAgentCapabilities();

    return Response.json({
      agents: capabilities,
      supportedSources: ['openai', 'neon', 'memory'],
      supportedComplexities: ['simple', 'moderate', 'complex'],
      supportedIntents: [
        'question_answering',
        'summarization',
        'rewriting',
        'planning',
        'research',
        'comparison',
        'analysis',
        'creative_writing',
        'code_generation',
        'data_extraction',
      ],
      features: {
        streaming: true,
        citations: true,
        sourceAttribution: true,
        multimodalSearch: true,
        contextAware: true,
        fallbackRouting: true,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Agent capabilities error:', error);

    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    return new Response(
      JSON.stringify({
        code: 'internal_server_error:capabilities',
        message: 'Failed to retrieve agent capabilities',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
