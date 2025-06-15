import { tool } from 'ai';
import { z } from 'zod';
import {
  getUnifiedVectorStoreService,
  type VectorStoreType,
} from '@/lib/vectorstore/unified';

export const searchDocuments = (
  sources: VectorStoreType[] = ['memory'],
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>,
) =>
  tool({
    description:
      'Search through uploaded documents and knowledge base using advanced vector similarity with prompt optimization for RoboRail technical documentation',
    parameters: z.object({
      query: z.string().describe('The search query to find relevant documents'),
      limit: z
        .number()
        .optional()
        .describe('Maximum number of results to return (default: 5)'),
      queryType: z
        .enum([
          'technical',
          'conceptual',
          'procedural',
          'troubleshooting',
          'configuration',
          'api',
          'integration',
          'best_practices',
          'examples',
          'reference',
        ])
        .optional()
        .describe('Type of query for optimization'),
      domain: z
        .string()
        .optional()
        .describe('Domain context (e.g., roborail, automation, integration)'),
      complexity: z
        .enum(['basic', 'intermediate', 'advanced'])
        .optional()
        .describe('Query complexity level'),
      searchDepth: z
        .enum(['shallow', 'comprehensive', 'exhaustive'])
        .optional()
        .describe('Search depth level'),
      optimizePrompts: z
        .boolean()
        .optional()
        .default(true)
        .describe('Enable prompt optimization for better results'),
    }),
    execute: async ({
      query,
      limit = 5,
      queryType,
      domain = 'roborail',
      complexity,
      searchDepth = 'comprehensive',
      optimizePrompts = true,
    }) => {
      try {
        const vectorStore = await getUnifiedVectorStoreService();

        // Build query context for prompt optimization
        const queryContext = {
          type: queryType,
          domain,
          complexity,
          searchDepth,
          conversationHistory: conversationHistory?.slice(-5), // Include recent conversation history
          userIntent: `Find relevant documentation for: ${query}`,
        };

        // Enhanced search request with optimization
        const searchRequest = {
          query,
          sources,
          maxResults: limit,
          threshold: 0.3,
          queryContext: optimizePrompts ? queryContext : undefined,
          optimizePrompts,
          promptConfig: {
            maxTokens: 1500,
            temperature: 0.1,
            includeContext: true,
            includeCitations: true,
          },
        };

        const results = await vectorStore.searchAcrossSources(searchRequest);

        if (results.length === 0) {
          return {
            success: false,
            message: optimizePrompts
              ? `No relevant documents found for your ${queryType || 'general'} query about ${domain}. Try using different keywords or simplifying your query.`
              : 'No relevant documents found for your query.',
            results: [],
            queryOptimization: optimizePrompts
              ? {
                  originalQuery: query,
                  queryType: queryType || 'conceptual',
                  domain,
                  complexity: complexity || 'intermediate',
                  optimizationApplied: true,
                }
              : undefined,
          };
        }

        return {
          success: true,
          message: optimizePrompts
            ? `Found ${results.length} relevant ${queryType || 'general'} document(s) for ${domain} domain`
            : `Found ${results.length} relevant document(s)`,
          results: results.map((result) => ({
            content: result.document.content,
            source: result.source,
            similarity: result.similarity,
            metadata: {
              ...result.document.metadata,
              queryOptimization: optimizePrompts
                ? {
                    queryType: queryType || 'conceptual',
                    domain,
                    relevanceScore: result.similarity,
                  }
                : undefined,
            },
          })),
          queryOptimization: optimizePrompts
            ? {
                originalQuery: query,
                queryType: queryType || 'conceptual',
                domain,
                complexity: complexity || 'intermediate',
                resultsFound: results.length,
                averageSimilarity:
                  results.reduce((sum, r) => sum + r.similarity, 0) /
                  results.length,
                optimizationApplied: true,
              }
            : undefined,
        };
      } catch (error) {
        console.error('Error searching documents with optimization:', error);
        return {
          success: false,
          message:
            'Error occurred while searching documents. Please try again with a simpler query.',
          results: [],
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },
  });
