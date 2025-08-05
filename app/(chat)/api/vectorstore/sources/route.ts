import { NextResponse } from 'next/server';
import { getUnifiedVectorStoreService } from '@/lib/vectorstore/unified';

export async function GET() {
  try {
    // Always try to get the unified service - it will determine what's available
    const vectorStoreService = await getUnifiedVectorStoreService();

    const [availableSources, sourceStats] = await Promise.all([
      vectorStoreService.getAvailableSources(),
      vectorStoreService.getSourceStats(),
    ]);

    return NextResponse.json({
      availableSources,
      sourceStats,
    });
  } catch (_error) {
    // Return fallback response with OpenAI as default if available
    const hasOpenAI = !!process.env.OPENAI_API_KEY;
    
    return NextResponse.json({
      availableSources: hasOpenAI ? ['openai', 'memory'] : ['memory'],
      sourceStats: {
        openai: { enabled: hasOpenAI, count: 0 },
        supabase: { enabled: false, count: 0 },
        memory: { enabled: true, count: 0 },
        unified: { enabled: true, count: 0 },
      },
    });
  }
}
