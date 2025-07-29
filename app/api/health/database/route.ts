import { NextResponse } from 'next/server';
import {
  checkDatabaseHealth,
  formatHealthCheckResults,
} from '@/lib/db/health-check';

export async function GET() {
  try {
    const health = await checkDatabaseHealth();

    // Return JSON response with health status
    return NextResponse.json(
      {
        ...health,
        timestamp: new Date().toISOString(),
      },
      {
        status:
          health.status === 'healthy'
            ? 200
            : health.status === 'degraded'
              ? 503
              : 500,
      },
    );
  } catch (error: any) {
    return NextResponse.json(
      {
        status: 'error',
        isConnected: false,
        error: error.message || 'Failed to check database health',
        timestamp: new Date().toISOString(),
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST() {
  try {
    const health = await checkDatabaseHealth();
    const formattedOutput = formatHealthCheckResults(health);

    // Return formatted text output for debugging
    return new Response(formattedOutput, {
      status:
        health.status === 'healthy'
          ? 200
          : health.status === 'degraded'
            ? 503
            : 500,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  } catch (error: any) {
    return new Response(`❌ Health check failed: ${error.message}`, {
      status: 500,
      headers: {
        'Content-Type': 'text/plain',
      },
    });
  }
}
