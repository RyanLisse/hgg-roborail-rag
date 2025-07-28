import { NextResponse } from 'next/server';

/**
 * Simple ping endpoint for health checks and test server readiness
 */
export function GET() {
  return NextResponse.json(
    {
      status: 'ok',
      timestamp: new Date().toISOString(),
      message: 'Server is running',
    },
    { status: 200 },
  );
}
