import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { getUnifiedVectorStoreService } from '@/lib/vectorstore/unified';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { query, sources, maxResults, threshold, metadata } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    const vectorStoreService = await getUnifiedVectorStoreService();
    
    const results = await vectorStoreService.searchAcrossSources({
      query,
      sources: sources || ['memory'],
      maxResults: maxResults || 10,
      threshold: threshold || 0.3,
      metadata,
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Failed to search vector stores:', error);
    return NextResponse.json(
      { error: 'Failed to search vector stores' },
      { status: 500 }
    );
  }
}