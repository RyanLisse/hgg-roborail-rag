import { NextResponse } from 'next/server';
import { getAgentOrchestrator, getSystemHealth } from '@/lib/agents';
import {
  checkProviderHealth,
  validateProviderConfig,
} from '@/lib/ai/providers';
import { checkEnvironment } from '@/lib/utils/env-check';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// Helper function to get agent health safely
async function getAgentHealthSafely() {
  try {
    return await getSystemHealth();
  } catch (error) {
    return {
      status: 'error' as const,
      agents: {},
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Helper function to get provider health safely
async function getProviderHealthSafely() {
  try {
    return await checkProviderHealth();
  } catch (error) {
    return {
      status: 'error' as const,
      availableModels: [],
      unavailableModels: [],
      providers: {},
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Helper function to determine overall status
function determineOverallStatus(
  isEnvironmentHealthy: boolean,
  isProvidersHealthy: boolean,
  isAgentsHealthy: boolean,
  agentHealth: any,
  providerHealth: any,
): 'healthy' | 'degraded' | 'error' {
  if (isEnvironmentHealthy && isProvidersHealthy && isAgentsHealthy) {
    return 'healthy';
  }

  if (
    (isProvidersHealthy && agentHealth.status === 'degraded') ||
    (!isProvidersHealthy && providerHealth.status === 'degraded')
  ) {
    return 'degraded';
  }

  return 'error';
}

// Helper function to check model capabilities
function checkModelCapabilities(availableModels: string[]) {
  return {
    reasoning: availableModels.some(
      (model: string) =>
        model.includes('o1-') || model.includes('o3-') || model.includes('o4-'),
    ),
    multimodal: availableModels.some(
      (model: string) =>
        model.includes('gpt-4o') ||
        model.includes('gemini') ||
        model.includes('claude'),
    ),
  };
}

// Helper function to get HTTP status from overall status
function getHttpStatusFromHealth(overallStatus: string): number {
  if (overallStatus === 'healthy') {
    return 200;
  }
  if (overallStatus === 'degraded') {
    return 206;
  }
  return 503;
}

/**
 * Comprehensive agent and system health check endpoint
 * Tests all agents, providers, and system components
 */
export async function GET() {
  try {
    const startTime = Date.now();

    // Check basic configurations
    const envStatus = checkEnvironment();
    const providerStatus = validateProviderConfig();

    // Get health statuses using helper functions
    const agentHealth = await getAgentHealthSafely();
    const providerHealth = await getProviderHealthSafely();

    // Determine system health
    const isEnvironmentHealthy = envStatus.isValid;
    const isProvidersHealthy =
      providerStatus.isValid && providerHealth.status !== 'error';
    const isAgentsHealthy = agentHealth.status === 'healthy';

    const overallStatus = determineOverallStatus(
      isEnvironmentHealthy,
      isProvidersHealthy,
      isAgentsHealthy,
      agentHealth,
      providerHealth,
    );

    const capabilities = checkModelCapabilities(providerHealth.availableModels);

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
        reasoning: capabilities.reasoning,
        multimodal: capabilities.multimodal,
        vectorStore: true,
        tools: true,
      },
      version: {
        node: process.version,
        nextjs: '15.3.0',
        ai_sdk: '^3.0.0',
      },
    };

    const httpStatus = getHttpStatusFromHealth(overallStatus);

    return NextResponse.json(response, { status: httpStatus });
  } catch (error) {
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
