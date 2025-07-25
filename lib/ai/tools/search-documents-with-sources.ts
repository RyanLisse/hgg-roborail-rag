import { tool } from 'ai';
import { z } from 'zod';
import { getOpenAIResponsesService, type SourceFile } from '@/lib/ai/responses';
import {
  getUnifiedVectorStoreService,
  type VectorStoreType,
} from '@/lib/vectorstore/unified';

export interface DocumentSearchResult {
  content: string;
  source: string;
  similarity: number;
  metadata: Record<string, any>;
  citations?: SourceFile[];
}

export const searchDocumentsWithSources = (
  sources: VectorStoreType[] = ['memory'],
) =>
  tool({
    description:
      'Search through uploaded documents with comprehensive source citations and annotations',
    parameters: z.object({
      query: z.string().describe('The search query to find relevant documents'),
      limit: z
        .number()
        .optional()
        .describe('Maximum number of results to return (default: 5)'),
      includeOpenAISources: z
        .boolean()
        .optional()
        .describe(
          'Include OpenAI vector store sources with citations (default: true)',
        ),
    }),
    execute: async ({ query, limit = 5, includeOpenAISources = true }) => {
      try {
        const vectorStore = await getUnifiedVectorStoreService();

        // Search across unified vector stores with enhanced capabilities
        const enhancedSearchResponse = await vectorStore.searchEnhanced({
          query,
          sources: sources.filter((s) => s !== 'openai'), // Exclude OpenAI for separate handling
          maxResults: limit,
          threshold: 0.3,
          optimizePrompts: true,
          enableRelevanceScoring: true,
          enableDiversification: true,
          enableCrossEncoder: false,
          enableHybridSearch: false,
          queryContext: {
            type: 'technical',
            domain: 'roborail',
          },
        });

        const unifiedResults = enhancedSearchResponse.results;

        let openAIResults: any = null;
        let openAISources: SourceFile[] = [];

        // If OpenAI sources are enabled and available, search using Responses API
        if (includeOpenAISources && sources.includes('openai')) {
          try {
            const responsesService = getOpenAIResponsesService();

            // Create a search-focused response to get citations
            const searchResponse =
              await responsesService.createResponseWithSources({
                model: 'gpt-4o-mini', // Use efficient model for search
                input: `Search for information about: ${query}. Please provide relevant information with proper citations.`,
                maxResults: limit,
              });

            openAIResults = {
              content: searchResponse.content,
              annotations: searchResponse.annotations,
            };
            openAISources = searchResponse.sources;
          } catch (_error) {
            // Continue with unified results only
          }
        }

        // Combine results from different sources
        const combinedResults: DocumentSearchResult[] = [];

        // Add unified vector store results with enhanced metadata
        unifiedResults.forEach((result) => {
          combinedResults.push({
            content: result.document.content,
            source: result.source,
            similarity: result.similarity,
            metadata: {
              ...(result.document.metadata || {}),
              relevanceScore: result.relevanceScore,
              rank: result.rank,
              relevanceFactors: result.relevanceFactors,
              scoringMetadata: result.scoringMetadata,
            },
          });
        });

        // Add OpenAI results if available
        if (openAIResults?.content) {
          combinedResults.push({
            content: openAIResults.content,
            source: 'openai',
            similarity: 1.0, // OpenAI results are considered highly relevant
            metadata: {
              type: 'openai_file_search',
              annotationCount: openAIResults.annotations?.length || 0,
            },
            citations: openAISources,
          });
        }

        if (combinedResults.length === 0) {
          return {
            success: false,
            message: 'No relevant documents found for your query.',
            results: [],
            sources: [],
          };
        }

        // Sort by similarity score
        combinedResults.sort((a, b) => b.similarity - a.similarity);

        return {
          success: true,
          message: `Found ${combinedResults.length} relevant document(s) across ${sources.join(', ')} sources`,
          results: combinedResults.slice(0, limit),
          sources: openAISources,
          openAIAnnotations: openAIResults?.annotations || [],
        };
      } catch (_error) {
        return {
          success: false,
          message: 'Error occurred while searching documents.',
          results: [],
          sources: [],
        };
      }
    },
  });
