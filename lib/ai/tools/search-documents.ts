import { tool } from 'ai';
import { z } from 'zod';
import { getUnifiedVectorStoreService, type VectorStoreType } from '@/lib/vectorstore/unified';

export const searchDocuments = (sources: VectorStoreType[] = ['memory']) => 
  tool({
    description: 'Search through uploaded documents and knowledge base using vector similarity',
    parameters: z.object({
      query: z.string().describe('The search query to find relevant documents'),
      limit: z.number().optional().describe('Maximum number of results to return (default: 5)'),
    }),
    execute: async ({ query, limit = 5 }) => {
      try {
        const vectorStore = await getUnifiedVectorStoreService();
        
        const results = await vectorStore.searchAcrossSources({
          query,
          sources,
          maxResults: limit,
          threshold: 0.3,
        });

        if (results.length === 0) {
          return {
            success: false,
            message: 'No relevant documents found for your query.',
            results: [],
          };
        }

        return {
          success: true,
          message: `Found ${results.length} relevant document(s)`,
          results: results.map(result => ({
            content: result.document.content,
            source: result.source,
            similarity: result.similarity,
            metadata: result.document.metadata,
          })),
        };
      } catch (error) {
        console.error('Error searching documents:', error);
        return {
          success: false,
          message: 'Error occurred while searching documents.',
          results: [],
        };
      }
    },
  });