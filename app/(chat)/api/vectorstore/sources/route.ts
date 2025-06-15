import { NextResponse } from 'next/server';
import { getUnifiedVectorStoreService } from '@/lib/vectorstore/unified';

export async function GET() {
  try {
    // Check for required environment variables
    if (!process.env.COHERE_API_KEY) {
      console.warn(
        'COHERE_API_KEY not configured, vector store may be limited',
      );
    }

    if (!process.env.POSTGRES_URL) {
      return NextResponse.json({
        availableSources: ['memory'],
        sourceStats: {
          memory: { documents: 0, lastUpdated: new Date().toISOString() },
        },
      });
    }

    const vectorStoreService = await getUnifiedVectorStoreService();

    const [availableSources, sourceStats] = await Promise.all([
      vectorStoreService.getAvailableSources(),
      vectorStoreService.getSourceStats(),
    ]);

    return NextResponse.json({
      availableSources,
      sourceStats,
    });
  } catch (error) {
    console.error('Failed to get vector store sources:', error);

    // Return fallback response instead of 500 error
    return NextResponse.json({
      availableSources: ['memory'],
      sourceStats: {
        memory: {
          documents: 0,
          lastUpdated: new Date().toISOString(),
          error: 'Service temporarily unavailable',
        },
      },
    });
  }
}
