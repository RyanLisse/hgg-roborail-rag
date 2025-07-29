import { type NextRequest, NextResponse } from 'next/server';
import { auth } from '@/app/(auth)/auth';
import { supabaseRAG } from '@/lib/rag/supabase-rag';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { query, limit = 5, threshold = 0.7 } = await request.json();

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Search for similar content
    const results = await supabaseRAG.searchSimilar(query, limit, threshold);

    return NextResponse.json({
      results,
      query,
      totalResults: results.length,
    });
  } catch (error) {
    // Log structured error for monitoring
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const errorContext = {
      endpoint: '/api/vectorstore/supabase-search',
      method: 'POST',
      error: errorMessage,
      timestamp: new Date().toISOString(),
    };
    // In production, this would be sent to a logging service
    if (process.env.NODE_ENV === 'development') {
      console.error('Supabase search error:', errorContext);
    }
    return NextResponse.json(
      { error: 'Failed to search vector store' },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const query = searchParams.get('q');
    const limit = Number.parseInt(searchParams.get('limit') || '5', 10);
    const threshold = Number.parseFloat(searchParams.get('threshold') || '0.7');

    if (!query) {
      return NextResponse.json(
        { error: "Query parameter 'q' is required" },
        { status: 400 },
      );
    }

    // Search for similar content
    const results = await supabaseRAG.searchSimilar(query, limit, threshold);

    return NextResponse.json({
      results,
      query,
      totalResults: results.length,
    });
  } catch (error) {
    // Log structured error for monitoring
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    const errorContext = {
      endpoint: '/api/vectorstore/supabase-search',
      method: 'GET',
      error: errorMessage,
      query: searchParams.get('q'),
      timestamp: new Date().toISOString(),
    };
    // In production, this would be sent to a logging service
    if (process.env.NODE_ENV === 'development') {
      console.error('Supabase search error:', errorContext);
    }
    return NextResponse.json(
      { error: 'Failed to search vector store' },
      { status: 500 },
    );
  }
}
