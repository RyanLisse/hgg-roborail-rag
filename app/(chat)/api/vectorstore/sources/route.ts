import { NextResponse } from 'next/server';
import { getUnifiedVectorStoreService } from '@/lib/vectorstore/unified';

export async function GET() {
  try {
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
    return NextResponse.json(
      { error: 'Failed to get vector store sources' },
      { status: 500 }
    );
  }
}