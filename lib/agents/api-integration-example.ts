/**
 * Example API Integration for Multi-Agent System
 * 
 * This file demonstrates how to integrate the agent system into an API route.
 * You can use this as a template for creating agent-powered endpoints.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { 
  processQuery, 
  processQueryStream, 
  getRoutingDecision,
  getSystemHealth,
} from './index';

// Request schema for API validation
const AgentAPIRequestSchema = z.object({
  query: z.string().min(1).max(2000),
  chatHistory: z.array(z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
  })).optional(),
  options: z.object({
    modelId: z.string().optional(),
    streaming: z.boolean().default(false),
    sources: z.array(z.enum(['openai', 'neon', 'memory'])).optional(),
    agentType: z.enum(['qa', 'rewrite', 'planner', 'research']).optional(),
    maxTokens: z.number().min(50).max(4000).optional(),
    temperature: z.number().min(0).max(2).optional(),
  }).optional(),
});

type AgentAPIRequest = z.infer<typeof AgentAPIRequestSchema>;

/**
 * Main agent processing endpoint
 * 
 * POST /api/agents/process
 * 
 * Features:
 * - Automatic agent selection
 * - Streaming support
 * - Error handling
 * - Request validation
 */
export async function processAgentRequest(request: NextRequest) {
  try {
    // Parse and validate request
    const body = await request.json();
    const validatedRequest = AgentAPIRequestSchema.parse(body);

    const { query, chatHistory = [], options = {} } = validatedRequest;

    // Check if streaming is requested
    if (options.streaming) {
      return handleStreamingRequest(query, chatHistory, options);
    }

    // Process non-streaming request
    const response = await processQuery(query, {
      chatHistory,
      sources: options.sources,
      modelId: options.modelId,
      streaming: false,
    });

    return NextResponse.json({
      success: true,
      data: {
        content: response.content,
        agent: response.agent,
        metadata: {
          ...response.metadata,
          processingTime: response.metadata.responseTime,
          model: response.metadata.modelUsed,
          sources: response.metadata.sources?.length || 0,
        },
      },
    });

  } catch (error) {
    console.error('Agent API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: {
          code: 'validation_error',
          message: 'Invalid request format',
          details: error.errors,
        },
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: {
        code: 'internal_error',
        message: 'An unexpected error occurred',
      },
    }, { status: 500 });
  }
}

/**
 * Handle streaming responses
 */
async function handleStreamingRequest(
  query: string, 
  chatHistory: any[], 
  options: AgentAPIRequest['options'] = {}
) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Get routing decision first
        const routingDecision = await getRoutingDecision(query);
        
        // Send routing info
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({
            type: 'routing',
            agent: routingDecision.selectedAgent,
            confidence: routingDecision.confidence,
            reasoning: routingDecision.reasoning,
          })}\n\n`)
        );

        // Start streaming response
        let fullContent = '';
        const streamGenerator = processQueryStream(query, {
          chatHistory,
          sources: options.sources,
          modelId: options.modelId,
        });

        for await (const chunk of streamGenerator) {
          if (typeof chunk === 'string') {
            fullContent += chunk;
            
            // Send content chunk
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'content',
                chunk,
              })}\n\n`)
            );
          } else {
            // Final response with metadata
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                type: 'complete',
                content: fullContent,
                metadata: chunk.metadata,
              })}\n\n`)
            );
          }
        }

        controller.close();

      } catch (error) {
        console.error('Streaming error:', error);
        
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            message: 'Streaming failed',
          })}\n\n`)
        );
        
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
}

/**
 * Agent routing analysis endpoint
 * 
 * POST /api/agents/analyze
 */
export async function analyzeQuery(request: NextRequest) {
  try {
    const body = await request.json();
    const { query } = z.object({ query: z.string().min(1) }).parse(body);

    const decision = await getRoutingDecision(query);

    return NextResponse.json({
      success: true,
      data: {
        selectedAgent: decision.selectedAgent,
        confidence: decision.confidence,
        reasoning: decision.reasoning,
        complexity: decision.estimatedComplexity,
        suggestedSources: decision.suggestedSources,
        fallbackAgent: decision.fallbackAgent,
      },
    });

  } catch (error) {
    console.error('Analysis error:', error);
    
    return NextResponse.json({
      success: false,
      error: {
        code: 'analysis_error',
        message: 'Failed to analyze query',
      },
    }, { status: 500 });
  }
}

/**
 * System health endpoint
 * 
 * GET /api/agents/health
 */
export async function getAgentSystemHealth() {
  try {
    const health = await getSystemHealth();

    return NextResponse.json({
      success: true,
      data: {
        status: health.status,
        agents: health.agents,
        timestamp: new Date().toISOString(),
      },
    });

  } catch (error) {
    console.error('Health check error:', error);
    
    return NextResponse.json({
      success: false,
      data: {
        status: 'unhealthy',
        error: 'Health check failed',
        timestamp: new Date().toISOString(),
      },
    }, { status: 503 });
  }
}

/**
 * Usage examples for client-side integration
 */

// Example: Non-streaming request
async function exampleNonStreamingCall() {
  const response = await fetch('/api/agents/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'What is machine learning?',
      options: {
        sources: ['openai'],
        modelId: 'anthropic-claude-sonnet-4-20250514',
      },
    }),
  });

  const result = await response.json();
  console.log(result.data.content);
}

// Example: Streaming request
async function exampleStreamingCall() {
  const response = await fetch('/api/agents/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'Explain neural networks in detail',
      options: {
        streaming: true,
        sources: ['openai', 'neon'],
      },
    }),
  });

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));
          
          switch (data.type) {
            case 'routing':
              console.log(`Using ${data.agent} agent (${data.confidence} confidence)`);
              break;
            case 'content':
              process.stdout.write(data.chunk);
              break;
            case 'complete':
              console.log('\nProcessing complete');
              break;
            case 'error':
              console.error('Error:', data.message);
              break;
          }
        }
      }
    }
  }
}

// Example: Query analysis
async function exampleAnalysis() {
  const response = await fetch('/api/agents/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: 'Create a comprehensive plan for learning data science',
    }),
  });

  const result = await response.json();
  console.log(`Recommended agent: ${result.data.selectedAgent}`);
  console.log(`Complexity: ${result.data.complexity}`);
  console.log(`Reasoning: ${result.data.reasoning}`);
}

// Example: Health check
async function exampleHealthCheck() {
  const response = await fetch('/api/agents/health');
  const result = await response.json();
  
  console.log(`System status: ${result.data.status}`);
  console.log('Agent status:', result.data.agents);
}