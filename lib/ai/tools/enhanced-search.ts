import { tool } from 'ai';
import { z } from 'zod';
import {
  getUnifiedVectorStoreService,
  type VectorStoreType,
} from '@/lib/vectorstore/unified';
import { getOpenAIResponsesService } from '@/lib/ai/responses';
import {
  parseCitationsFromContent,
  formatCitationsMarkdown,
} from '@/lib/utils/citations';

export const enhancedSearch = (sources: VectorStoreType[] = ['memory']) =>
  tool({
    description:
      'Advanced document search with comprehensive source citations and annotations. Use this for queries that require factual information with proper attribution.',
    parameters: z.object({
      query: z.string().describe('The search query to find relevant documents'),
      limit: z
        .number()
        .optional()
        .describe('Maximum number of results to return (default: 5)'),
      includeQuotes: z
        .boolean()
        .optional()
        .describe('Include quoted text from sources (default: true)'),
      responseModel: z
        .string()
        .optional()
        .describe('Model to use for OpenAI responses (default: gpt-4o-mini)'),
    }),
    execute: async ({
      query,
      limit = 5,
      includeQuotes = true,
      responseModel = 'gpt-4o-mini',
    }) => {
      try {
        console.log(`🔍 Enhanced search started for: "${query}"`);

        const vectorStore = await getUnifiedVectorStoreService();
        const results: any[] = [];
        let sourcesWithCitations: any[] = [];

        // 1. Search unified vector stores with enhanced search capabilities
        if (sources.includes('memory') || sources.includes('neon')) {
          const unifiedSources = sources.filter((s) => s !== 'openai');
          if (unifiedSources.length > 0) {
            const enhancedSearchResponse = await vectorStore.searchEnhanced({
              query,
              sources: unifiedSources,
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

            results.push(
              ...enhancedSearchResponse.results.map((result) => ({
                content: result.document.content,
                source: result.source,
                similarity: result.similarity,
                metadata: result.document.metadata,
                type: 'enhanced_vector_search',
                relevanceScore: result.relevanceScore,
                relevanceFactors: result.relevanceFactors,
                scoringMetadata: result.scoringMetadata,
              })),
            );
          }
        }

        // 2. Search OpenAI vector store with Responses API for citations
        if (sources.includes('openai')) {
          try {
            const responsesService = getOpenAIResponsesService();

            const searchQuery = `Based on the uploaded documents, please provide information about: ${query}`;

            const searchResponse =
              await responsesService.createResponseWithSources({
                model: responseModel,
                input: searchQuery,
                maxResults: limit,
              });

            // Parse citations from the response
            const citationContext = parseCitationsFromContent(
              searchResponse.content,
              searchResponse.annotations,
              searchResponse.sources,
            );

            if (searchResponse.content?.trim()) {
              results.push({
                content: searchResponse.content,
                source: 'openai',
                similarity: 1.0, // OpenAI results are considered highly relevant
                metadata: {
                  type: 'openai_file_search',
                  model: responseModel,
                  annotationCount: searchResponse.annotations.length,
                  citationCount: citationContext.citations.length,
                },
                type: 'openai_response',
                citations: citationContext.citations,
                sources: searchResponse.sources,
                annotations: searchResponse.annotations,
              });

              sourcesWithCitations = searchResponse.sources;
            }

            console.log(
              `✅ OpenAI search completed with ${searchResponse.sources.length} sources`,
            );
          } catch (error) {
            console.warn('OpenAI Responses API search failed:', error);
            // Continue with other results
          }
        }

        if (results.length === 0) {
          return {
            success: false,
            message: 'No relevant documents found for your query.',
            results: [],
            query,
            sources: sources.join(', '),
          };
        }

        // 3. Sort and format results
        results.sort((a, b) => b.similarity - a.similarity);
        const topResults = results.slice(0, limit);

        // 4. Format response with citations
        let formattedResponse = `Found ${topResults.length} relevant result(s) for "${query}":\n\n`;

        topResults.forEach((result, index) => {
          formattedResponse += `**Result ${index + 1}** (${result.source}, similarity: ${result.similarity.toFixed(2)}):\n`;

          if (
            result.type === 'openai_response' &&
            (result as any).citations?.length > 0
          ) {
            // For OpenAI responses, include formatted citations
            formattedResponse += result.content;
            formattedResponse += formatCitationsMarkdown(
              (result as any).citations,
            );
          } else {
            // For vector search results, show content with metadata
            const contentPreview =
              result.content.length > 500
                ? `${result.content.substring(0, 500)}...`
                : result.content;
            formattedResponse += contentPreview;

            if (result.metadata && Object.keys(result.metadata).length > 0) {
              formattedResponse += `\n*Metadata: ${JSON.stringify(result.metadata)}*`;
            }
          }

          formattedResponse += '\n\n---\n\n';
        });

        // 5. Add overall source summary
        const uniqueSources = [...new Set(topResults.map((r) => r.source))];
        formattedResponse += `**Search completed across:** ${uniqueSources.join(', ')}\n`;

        if (sourcesWithCitations.length > 0) {
          formattedResponse += `**Sources with citations:** ${sourcesWithCitations.length} file(s)\n`;
        }

        return {
          success: true,
          message: formattedResponse,
          results: topResults,
          query,
          sources: uniqueSources,
          citationSources: sourcesWithCitations,
          totalResults: results.length,
        };
      } catch (error) {
        console.error('Error in enhanced search:', error);
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        return {
          success: false,
          message: `Error occurred while searching: ${errorMessage}`,
          results: [],
          query,
          sources: sources.join(', '),
        };
      }
    },
  });
