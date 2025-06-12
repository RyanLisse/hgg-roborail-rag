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
    const { 
      query, 
      sources, 
      maxResults, 
      threshold, 
      metadata,
      // Enhanced search options for prompt optimization
      queryContext,
      optimizePrompts = true,
      promptConfig
    } = body;

    if (!query) {
      return NextResponse.json(
        { error: 'Query is required' },
        { status: 400 }
      );
    }

    console.log(`🔍 Vector store search request with optimization: ${optimizePrompts}`);
    if (queryContext) {
      console.log(`📊 Query context: ${queryContext.type || 'auto-detect'} (${queryContext.domain || 'general'})`);
    }

    const vectorStoreService = await getUnifiedVectorStoreService();
    
    const searchRequest = {
      query,
      sources: sources || ['openai', 'memory'], // Prioritize OpenAI for RoboRail docs
      maxResults: maxResults || 10,
      threshold: threshold || 0.3,
      metadata,
      // Pass optimization parameters
      queryContext: queryContext || {
        domain: 'roborail',
        type: 'conceptual', // Default fallback
      },
      optimizePrompts,
      promptConfig: promptConfig || {
        maxTokens: 1500,
        temperature: 0.1,
        includeContext: true,
        includeCitations: true,
      },
    };

    const results = await vectorStoreService.searchAcrossSources(searchRequest);

    // Enhanced response with optimization metadata
    const response = {
      results,
      searchMetadata: {
        queryOptimizationEnabled: optimizePrompts,
        sourcesSearched: searchRequest.sources,
        totalResults: results.length,
        queryContext: queryContext,
      },
    };

    console.log(`✅ Search completed: ${results.length} results across ${searchRequest.sources.join(', ')}`);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Failed to search vector stores:', error);
    return NextResponse.json(
      { 
        error: 'Failed to search vector stores',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}