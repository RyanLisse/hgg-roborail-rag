import { NextResponse } from 'next/server';
import { getAgentOrchestrator, getSystemHealth } from '@/lib/agents';
import {
  checkProviderHealth,
  validateProviderConfig,
} from '@/lib/ai/providers';
import { checkEnvironment } from '@/lib/utils/env-check';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Comprehensive agent and system health check endpoint
 * Tests all agents, providers, and system components
 */
export async function GET() {
  try {
    const startTime = Date.now();

    // Check environment configuration
    const envStatus = checkEnvironment();

    // Check provider configuration
    const providerStatus = validateProviderConfig();

    // Get agent system health
    let agentHealth: any;
    try {
      agentHealth = await getSystemHealth();
    } catch (error) {
      agentHealth = {
        status: 'error' as const,
        agents: {},
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Check AI provider health
    let providerHealth: any;
    try {
      providerHealth = await checkProviderHealth();
    } catch (error) {
      providerHealth = {
        status: 'error' as const,
        availableModels: [],
        unavailableModels: [],
        providers: {},
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }

    // Determine overall system status
    const isEnvironmentHealthy = envStatus.isValid;
    const isProvidersHealthy =
      providerStatus.isValid && providerHealth.status !== 'error';
    const isAgentsHealthy = agentHealth.status === 'healthy';

    let overallStatus: 'healthy' | 'degraded' | 'error';
    if (isEnvironmentHealthy && isProvidersHealthy && isAgentsHealthy) {
      overallStatus = 'healthy';
    } else if (
      (isProvidersHealthy && agentHealth.status === 'degraded') ||
      (!isProvidersHealthy && providerHealth.status === 'degraded')
    ) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'error';
    }

    const response = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - startTime,
      environment: {
        status: envStatus.isValid ? 'healthy' : 'error',
        errors: envStatus.errors,
        warnings: envStatus.warnings,
      },
      providers: {
        status: providerStatus.isValid ? 'healthy' : 'error',
        availableProviders: providerStatus.availableProviders,
        errors: providerStatus.errors,
        warnings: providerStatus.warnings,
        modelHealth: providerHealth,
      },
      agents: agentHealth,
      capabilities: {
        streaming: true,
        reasoning: providerHealth.availableModels.some(
          (model) =>
            model.includes('o1-') ||
            model.includes('o3-') ||
            model.includes('o4-'),
        ),
        multimodal: providerHealth.availableModels.some(
          (model) =>
            model.includes('gpt-4o') ||
            model.includes('gemini') ||
            model.includes('claude'),
        ),
        vectorStore: true,
        tools: true,
      },
      version: {
        node: process.version,
        nextjs: '15.3.0',
        ai_sdk: '^3.0.0',
      },
    };

    // Set appropriate HTTP status based on health
    const httpStatus =
      overallStatus === 'healthy'
        ? 200
        : overallStatus === 'degraded'
          ? 206
          : 503;

    return NextResponse.json(response, { status: httpStatus });
  } catch (error) {
    console.error('Health check failed:', error);

    return NextResponse.json(
      {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Health check failed',
        message: 'Unable to perform health check',
      },
      { status: 500 },
    );
  }
}

/**
 * Test a specific agent
 */
export async function POST(request: Request) {
  try {
    const { agentType, query } = await request.json();

    if (!agentType) {
      return NextResponse.json(
        { error: 'agentType is required' },
        { status: 400 },
      );
    }

    const orchestrator = await getAgentOrchestrator();

    const testRequest = {
      query: query || 'Health check test',
      chatHistory: [],
      options: {
        modelId: 'openai-gpt-4.1-nano', // Use fast model for testing
        streaming: false,
        useTools: false,
      },
    };

    const startTime = Date.now();
    const response = await orchestrator.processRequest(testRequest);
    const responseTime = Date.now() - startTime;

    return NextResponse.json({
      status: 'success',
      agentType,
      responseTime,
      response: {
        content: `${response.content.substring(0, 100)}...`,
        agent: response.agent,
        hasError: !!response.errorDetails,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Agent test failed',
      },
      { status: 500 },
    );
  }
}
