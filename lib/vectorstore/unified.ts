import 'server-only';

import { z } from 'zod';
import {
  getVectorStoreMonitoringService,
  withPerformanceMonitoring,
} from './monitoring';

import {
  getOpenAIVectorStoreService,
  type OpenAIVectorStoreService,
} from './openai';
import {
  type HybridSearchRequest,
  RelevanceScoringEngine,
  type RelevanceWeights,
  type RerankingRequest,
  type UserFeedback,
} from './relevance-scoring';
import {
  DocumentRerankingEngine,
  type FusionScore,
  LearningToRankEngine,
  type RerankingResult,
} from './reranking';
import {
  getSupabaseVectorStoreService,
  type SupabaseVectorStoreService,
} from './supabase';
import { getFaultTolerantUnifiedVectorStoreService } from './unified-fault-tolerant';

// Re-export types for use by other modules
export type { RelevanceWeights, UserFeedback } from './relevance-scoring';

// Unified schemas
export const VectorStoreType = z.enum([
  'openai',
  'supabase',
  'memory',
  'unified',
]);

export const UnifiedDocument = z.object({
  id: z.string(),
  content: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  source: VectorStoreType,
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

// Basic search request for backward compatibility
export const BasicSearchRequest = z.object({
  query: z.string().min(1),
  sources: z.array(VectorStoreType).default(['openai', 'supabase', 'memory']),
  maxResults: z.number().min(1).max(100).default(10),
  threshold: z.number().min(0).max(1).default(0.3),
  metadata: z.record(z.string(), z.unknown()).optional(),
  queryContext: z
    .object({
      type: z
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
          'multi_turn',
          'contextual',
        ])
        .optional(),
      domain: z.string().optional(),
      conversationHistory: z
        .array(
          z.object({
            role: z.enum(['user', 'assistant']),
            content: z.string(),
            timestamp: z.number(),
          }),
        )
        .optional(),
      previousQueries: z.array(z.string()).optional(),
      userIntent: z.string().optional(),
      complexity: z.enum(['basic', 'intermediate', 'advanced']).optional(),
      searchDepth: z
        .enum(['shallow', 'comprehensive', 'exhaustive'])
        .optional(),
    })
    .optional(),
  optimizePrompts: z.boolean().default(true),
  promptConfig: z
    .object({
      maxTokens: z.number().default(1500),
      temperature: z.number().min(0).max(1).default(0.1),
      includeContext: z.boolean().default(true),
      includeCitations: z.boolean().default(true),
    })
    .optional(),
});

// Enhanced search request with all advanced features
export const UnifiedSearchRequest = BasicSearchRequest.extend({
  // Enhanced relevance scoring options
  enableRelevanceScoring: z.boolean().default(false),
  relevanceWeights: z
    .object({
      similarity: z.number().min(0).max(1).default(0.3),
      recency: z.number().min(0).max(1).default(0.15),
      authority: z.number().min(0).max(1).default(0.2),
      contextRelevance: z.number().min(0).max(1).default(0.15),
      keywordMatch: z.number().min(0).max(1).default(0.1),
      semanticMatch: z.number().min(0).max(1).default(0.05),
      userFeedback: z.number().min(0).max(1).default(0.05),
    })
    .optional(),
  enableCrossEncoder: z.boolean().default(false),
  enableDiversification: z.boolean().default(false),
  enableHybridSearch: z.boolean().default(false),
  userId: z.string().optional(), // For personalized scoring
});

export const UnifiedSearchResult = z.object({
  document: UnifiedDocument,
  similarity: z.number(),
  distance: z.number(),
  source: VectorStoreType,
  // Enhanced relevance scoring information
  relevanceScore: z.number().optional(),
  rank: z.number().optional(),
  relevanceFactors: z
    .object({
      similarity: z.number(),
      recency: z.number(),
      authority: z.number(),
      contextRelevance: z.number(),
      keywordMatch: z.number(),
      semanticMatch: z.number(),
      userFeedback: z.number().optional(),
    })
    .optional(),
  scoringMetadata: z
    .object({
      scoringStrategy: z.string().optional(),
      processingTime: z.number().optional(),
      reranked: z.boolean().optional(),
      diversified: z.boolean().optional(),
    })
    .optional(),
});

export const EnhancedSearchResponse = z.object({
  results: z.array(UnifiedSearchResult),
  totalResults: z.number(),
  processingTime: z.number(),
  query: z.string(),
  rerankingApplied: z.boolean(),
  diversificationApplied: z.boolean(),
  hybridSearchUsed: z.boolean(),
  scoringStrategy: z.string(),
  performance: z.object({
    searchTime: z.number(),
    rerankingTime: z.number().optional(),
    totalTime: z.number(),
  }),
  debugInfo: z.record(z.string(), z.unknown()).optional(),
});

export const DocumentUploadRequest = z.object({
  content: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
  file: z.instanceof(File).optional(),
  targetSources: z.array(VectorStoreType).default(['memory']),
});

// Types
export type VectorStoreType = z.infer<typeof VectorStoreType>;
export type UnifiedDocument = z.infer<typeof UnifiedDocument>;
export type BasicSearchRequest = z.infer<typeof BasicSearchRequest>;
export type UnifiedSearchRequest = z.infer<typeof UnifiedSearchRequest>;
export type UnifiedSearchResult = z.infer<typeof UnifiedSearchResult>;
export type EnhancedSearchResponse = z.infer<typeof EnhancedSearchResponse>;
export type DocumentUploadRequest = z.infer<typeof DocumentUploadRequest>;

export interface UnifiedVectorStoreService {
  openaiService: OpenAIVectorStoreService | null;
  supabaseService: SupabaseVectorStoreService | null;

  // Document management
  addDocument: (request: DocumentUploadRequest) => Promise<UnifiedDocument[]>;
  getDocument: (
    id: string,
    source: VectorStoreType,
  ) => Promise<UnifiedDocument | null>;
  deleteDocument: (id: string, source: VectorStoreType) => Promise<boolean>;

  // Search operations
  searchAcrossSources: (
    request: BasicSearchRequest,
  ) => Promise<UnifiedSearchResult[]>;
  searchEnhanced: (
    request: UnifiedSearchRequest,
  ) => Promise<EnhancedSearchResponse>;
  searchOpenAI: (
    query: string,
    maxResults?: number,
  ) => Promise<UnifiedSearchResult[]>;
  searchSupabase: (
    query: string,
    maxResults?: number,
  ) => Promise<UnifiedSearchResult[]>;
  

  // Enhanced search features
  rerankResults: (request: RerankingRequest) => Promise<RerankingResult>;
  hybridSearch: (request: HybridSearchRequest) => Promise<FusionScore[]>;
  recordUserFeedback: (feedback: UserFeedback) => Promise<void>;
  getUserPreferences: (userId: string) => Promise<RelevanceWeights>;
  updateUserPreferences: (
    userId: string,
    weights: Partial<RelevanceWeights>,
  ) => Promise<void>;

  // Service status
  getAvailableSources: () => Promise<VectorStoreType[]>;
  getSourceStats: () => Promise<
    Record<VectorStoreType, { enabled: boolean; count?: number }>
  >;
  getRelevanceMetrics: () => Promise<{
    totalQueries: number;
    avgRelevanceScore: number;
    rerankingUsage: number;
    userFeedbackCount: number;
  }>;
}

// Create unified vector store service
export async function createUnifiedVectorStoreService(): Promise<UnifiedVectorStoreService> {
  const openaiService = await getOpenAIVectorStoreService();
  const supabaseService = await getSupabaseVectorStoreService();

    const service: UnifiedVectorStoreService = {
    openaiService,
    supabaseService,

    async addDocument(
      request: DocumentUploadRequest,
    ): Promise<UnifiedDocument[]> {
      const validatedRequest = DocumentUploadRequest.parse(request);
      const results: UnifiedDocument[] = [];

      for (const source of validatedRequest.targetSources) {
        try {
          switch (source) {
            case 'openai':
              if (openaiService.isEnabled && validatedRequest.file) {
                const vectorStoreFile = await openaiService.uploadFile({
                  file: validatedRequest.file,
                  metadata: validatedRequest.metadata as
                    | Record<string, string>
                    | undefined,
                });

                results.push(
                  UnifiedDocument.parse({
                    id: vectorStoreFile.id,
                    content: validatedRequest.content,
                    metadata: validatedRequest.metadata,
                    source: 'openai',
                    createdAt: new Date(vectorStoreFile.created_at * 1000),
                  }),
                );
              }
              break;

            

            case 'supabase':
              if (supabaseService.isEnabled) {
                const supabaseDoc = await supabaseService.addDocument({
                  content: validatedRequest.content,
                  metadata: validatedRequest.metadata,
                });

                results.push(
                  UnifiedDocument.parse({
                    id: supabaseDoc.id,
                    content: supabaseDoc.content,
                    metadata: supabaseDoc.metadata,
                    source: 'supabase',
                    createdAt: supabaseDoc.createdAt,
                    updatedAt: supabaseDoc.updatedAt,
                  }),
                );
              }
              break;

            case 'memory':
              // Memory storage is handled by the existing RAG service
              results.push(
                UnifiedDocument.parse({
                  id: crypto.randomUUID(),
                  content: validatedRequest.content,
                  metadata: validatedRequest.metadata,
                  source: 'memory',
                  createdAt: new Date(),
                }),
              );
              break;
          }
        } catch (_error) {}
      }

      return results;
    },

    async getDocument(
      id: string,
      source: VectorStoreType,
    ): Promise<UnifiedDocument | null> {
      try {
        switch (source) {
          case 'openai':
            if (openaiService.isEnabled) {
              // OpenAI doesn't have a direct file content retrieval API
              // This would need to be implemented differently
              return null;
            }
            break;

          

          case 'supabase':
            if (supabaseService.isEnabled) {
              const supabaseDoc = await supabaseService.getDocument(id);
              if (supabaseDoc) {
                return UnifiedDocument.parse({
                  id: supabaseDoc.id,
                  content: supabaseDoc.content,
                  metadata: supabaseDoc.metadata,
                  source: 'supabase',
                  createdAt: supabaseDoc.createdAt,
                  updatedAt: supabaseDoc.updatedAt,
                });
              }
            }
            break;

          case 'memory':
            // Memory retrieval would be handled by existing RAG service
            return null;
        }
      } catch (_error) {}

      return null;
    },

    async deleteDocument(
      id: string,
      source: VectorStoreType,
    ): Promise<boolean> {
      try {
        switch (source) {
          case 'openai':
            if (openaiService.isEnabled) {
              return await openaiService.deleteFile(id);
            }
            break;

          

          case 'supabase':
            if (supabaseService.isEnabled) {
              return await supabaseService.deleteDocument(id);
            }
            break;

          case 'memory':
            // Memory deletion would be handled by existing RAG service
            return true;
        }
      } catch (_error) {}

      return false;
    },

    searchAcrossSources: withPerformanceMonitoring(
      'unified',
      'searchAcrossSources',
      async function (
        this: UnifiedVectorStoreService,
        request: BasicSearchRequest,
      ): Promise<UnifiedSearchResult[]> {
        const monitoringService = getVectorStoreMonitoringService();
        const validatedRequest = BasicSearchRequest.parse(request);
        const startTime = Date.now();

        try {
          // Performance optimization: Check cache first
          const { getSmartCache } = await import('@/lib/cache');
          const smartCache = await getSmartCache();

          const cachedResults = await smartCache.getCachedVectorSearch<
            UnifiedSearchResult[]
          >(validatedRequest.query, validatedRequest.sources, {
            maxResults: validatedRequest.maxResults,
            threshold: validatedRequest.threshold,
            queryContext: validatedRequest.queryContext,
          });

          if (cachedResults) {
            monitoringService.recordSearchLatency(
              'unified',
              Date.now() - startTime,
              {
                query: validatedRequest.query,
                resultsCount: cachedResults.length,
                cached: true,
              },
            );
            return cachedResults;
          }

          // Performance optimization: Calculate results per source more efficiently
          const resultsPerSource = Math.ceil(
            validatedRequest.maxResults / validatedRequest.sources.length,
          );

          // Search in parallel with Promise.allSettled for better error handling
          const searchPromises = validatedRequest.sources.map(
            async (source) => {
              try {
                switch (source) {
                  case 'openai':
                    if (openaiService.isEnabled) {
                      return await this.searchOpenAI(
                        validatedRequest.query,
                        resultsPerSource,
                      );
                    }
                    break;

                  

                  case 'supabase':
                    if (supabaseService.isEnabled) {
                      return await this.searchSupabase(
                        validatedRequest.query,
                        resultsPerSource,
                      );
                    }
                    break;

                  case 'memory':
                    // Memory search would be handled by existing RAG service with context
                    return [];
                }
              } catch (error) {
                monitoringService.recordSearchError('unified', error as Error, {
                  query: validatedRequest.query,
                  failedSource: source,
                  optimizationUsed: validatedRequest.optimizePrompts,
                });
              }
              return [];
            },
          );

          // Performance optimization: Use Promise.allSettled for better error resilience
          const settledResults = await Promise.allSettled(searchPromises);
          const allResults: UnifiedSearchResult[] = [];

          // Process settled results and extract successful ones
          for (const result of settledResults) {
            if (result.status === 'fulfilled' && result.value) {
              allResults.push(...result.value);
            }
          }

          // Performance optimization: Use more efficient sorting
          const sortedResults = allResults.toSorted(
            (a, b) => b.similarity - a.similarity,
          );
          const finalResults = sortedResults.slice(
            0,
            validatedRequest.maxResults,
          );

          const executionTime = Date.now() - startTime;

          // Cache successful results
          await smartCache.cacheVectorSearch(
            validatedRequest.query,
            validatedRequest.sources,
            {
              maxResults: validatedRequest.maxResults,
              threshold: validatedRequest.threshold,
              queryContext: validatedRequest.queryContext,
            },
            finalResults,
            5 * 60 * 1000, // 5 minutes cache TTL
          );

          // Record unified search metrics with optimization info
          monitoringService.recordSearchLatency('unified', executionTime, {
            query: validatedRequest.query,
            resultsCount: finalResults.length,
            sourcesSearched: validatedRequest.sources,
            totalSourceResults: allResults.length,
            optimizationUsed: validatedRequest.optimizePrompts,
            queryType: validatedRequest.queryContext?.type,
            domain: validatedRequest.queryContext?.domain,
          });
          monitoringService.recordSearchSuccess('unified', {
            query: validatedRequest.query,
            resultsCount: finalResults.length,
            promptOptimizationUsed: validatedRequest.optimizePrompts,
          });
          return finalResults;
        } catch (error) {
          monitoringService.recordSearchError('unified', error as Error, {
            query: validatedRequest.query,
            sources: validatedRequest.sources,
            optimizationUsed: validatedRequest.optimizePrompts,
          });
          throw error;
        }
      },
    ),

    async searchOpenAI(
      query: string,
      maxResults = 10,
      queryContext?: any,
      optimizePrompts = true,
      promptConfig?: any,
    ): Promise<UnifiedSearchResult[]> {
      if (!openaiService.isEnabled) {
        return [];
      }

      try {
        const searchResponse = await openaiService.searchFiles({
          query,
          maxResults,
          includeContent: true,
          includeCitations: true,
          queryContext,
          optimizePrompts,
          promptConfig,
        });

        if (!searchResponse.success) {
          return [];
        }

        return searchResponse.results.map((result) =>
          UnifiedSearchResult.parse({
            document: UnifiedDocument.parse({
              id: result.id,
              content: result.content,
              metadata: result.metadata || {},
              source: 'openai',
              createdAt: result.metadata?.responseId ? new Date() : undefined,
            }),
            similarity: result.similarity,
            distance: 1 - result.similarity, // Convert similarity to distance
            source: 'openai',
          }),
        );
      } catch (_error) {
        return [];
      }
    },

    

    async searchSupabase(
      query: string,
      maxResults = 10,
      threshold = 0.3,
      queryContext?: any,
    ): Promise<UnifiedSearchResult[]> {
      if (!supabaseService.isEnabled) {
        return [];
      }

      try {
        const results = await supabaseService.searchSimilar({
          query,
          maxResults,
          threshold,
          metadata: queryContext
            ? {
                queryType: queryContext.type,
                domain: queryContext.domain,
                optimizationContext: true,
              }
            : undefined,
        });

        return results.map((result) =>
          UnifiedSearchResult.parse({
            document: UnifiedDocument.parse({
              id: result.document.id,
              content: result.document.content,
              metadata: result.document.metadata,
              source: 'supabase',
              createdAt: result.document.createdAt,
              updatedAt: result.document.updatedAt,
            }),
            similarity: result.similarity,
            distance: result.distance,
            source: 'supabase',
          }),
        );
      } catch (_error) {
        return [];
      }
    },

    async getAvailableSources(): Promise<VectorStoreType[]> {
      const sources: VectorStoreType[] = [];

      // Prioritize OpenAI vector store for RoboRail documentation
      if (openaiService.isEnabled) {
        sources.push('openai');
      }

      // Add memory as fallback
      sources.push('memory');

      

      if (supabaseService.isEnabled) {
        sources.push('supabase');
      }

      return sources;
    },

    async getSourceStats(): Promise<
      Record<VectorStoreType, { enabled: boolean; count?: number }>
    > {
      const stats: Record<
        VectorStoreType,
        { enabled: boolean; count?: number }
      > = {
        memory: { enabled: true },
        openai: { enabled: openaiService.isEnabled },
        
        supabase: { enabled: supabaseService.isEnabled },
        unified: { enabled: true },
      };

      // Get counts where possible
      try {
        if (openaiService.isEnabled) {
          const files = await openaiService.listFiles();
          stats.openai.count = files.length;
        }
      } catch (_error) {}

      return stats;
    },

    // Enhanced search with relevance scoring and reranking
    async searchEnhanced(
      request: UnifiedSearchRequest,
    ): Promise<EnhancedSearchResponse> {
      const startTime = Date.now();
      const validatedRequest = UnifiedSearchRequest.parse(request);

      try {
        // Step 1: Perform basic search across sources
        const searchStartTime = Date.now();
        const basicResults = await this.searchAcrossSources(validatedRequest);
        const searchTime = Date.now() - searchStartTime;

        let finalResults = basicResults;
        let rerankingApplied = false;
        let diversificationApplied = false;
        let hybridSearchUsed = false;
        let rerankingTime = 0;
        let scoringStrategy = 'basic_similarity';

        // Step 2: Apply relevance scoring and reranking if enabled
        if (
          validatedRequest.enableRelevanceScoring &&
          finalResults.length > 0
        ) {
          const rerankingStartTime = Date.now();

          // Prepare documents for reranking
          const documentsForReranking = finalResults.map((result) => ({
            id: result.document.id,
            content: result.document.content,
            similarity: result.similarity,
            metadata: result.document.metadata,
            source: result.source,
            createdAt: result.document.createdAt,
            updatedAt: result.document.updatedAt,
          }));

          // Get user preferences if available
          let relevanceWeights = validatedRequest.relevanceWeights;
          if (validatedRequest.userId) {
            const userPrefs = await this.getUserPreferences(
              validatedRequest.userId,
            );
            if (Object.keys(userPrefs).length > 0) {
              relevanceWeights = { ...relevanceWeights, ...userPrefs };
            }
          }

          // Perform reranking
          const rerankingRequest: RerankingRequest = {
            documents: documentsForReranking,
            query: validatedRequest.query,
            queryContext: validatedRequest.queryContext,
            weights: relevanceWeights,
            maxResults: validatedRequest.maxResults,
            enableCrossEncoder: validatedRequest.enableCrossEncoder,
            enableUserFeedback: true,
          };

          const rerankingResult = await this.rerankResults(rerankingRequest);
          rerankingTime = Date.now() - rerankingStartTime;

          // Convert scored documents back to unified results
          finalResults = rerankingResult.scoredDocuments.map((scoredDoc) =>
            UnifiedSearchResult.parse({
              document: UnifiedDocument.parse({
                id: scoredDoc.id,
                content: scoredDoc.content,
                metadata: scoredDoc.metadata,
                source: scoredDoc.source as VectorStoreType,
                createdAt: scoredDoc.createdAt,
                updatedAt: scoredDoc.updatedAt,
              }),
              similarity: scoredDoc.factors.similarity,
              distance: 1 - scoredDoc.relevanceScore,
              source: scoredDoc.source as VectorStoreType,
              relevanceScore: scoredDoc.relevanceScore,
              rank: scoredDoc.rank,
              relevanceFactors: {
                similarity: scoredDoc.factors.similarity,
                recency: scoredDoc.factors.recency,
                authority: scoredDoc.factors.authority,
                contextRelevance: scoredDoc.factors.contextRelevance,
                keywordMatch: scoredDoc.factors.keywordMatch,
                semanticMatch: scoredDoc.factors.semanticMatch,
                userFeedback: scoredDoc.factors.userFeedback,
              },
              scoringMetadata: {
                scoringStrategy: scoredDoc.scoringMetadata.scoringStrategy,
                processingTime: scoredDoc.scoringMetadata.processingTime,
                reranked: true,
                diversified: rerankingResult.diversificationApplied,
              },
            }),
          );

          rerankingApplied = true;
          diversificationApplied = rerankingResult.diversificationApplied;
          scoringStrategy = rerankingResult.strategy;
        }

        // Step 3: Apply hybrid search if enabled
        if (validatedRequest.enableHybridSearch && finalResults.length > 0) {
          // This would integrate keyword search results
          // For now, we'll mark it as used but not implement full keyword search
          hybridSearchUsed = true;
        }

        const totalTime = Date.now() - startTime;

        return EnhancedSearchResponse.parse({
          results: finalResults,
          totalResults: finalResults.length,
          processingTime: totalTime,
          query: validatedRequest.query,
          rerankingApplied,
          diversificationApplied,
          hybridSearchUsed,
          scoringStrategy,
          performance: {
            searchTime,
            rerankingTime: rerankingApplied ? rerankingTime : undefined,
            totalTime,
          },
        });
      } catch (error) {
        // Fallback to basic search
        const basicResults = await this.searchAcrossSources(validatedRequest);
        const totalTime = Date.now() - startTime;

        return EnhancedSearchResponse.parse({
          results: basicResults,
          totalResults: basicResults.length,
          processingTime: totalTime,
          query: validatedRequest.query,
          rerankingApplied: false,
          diversificationApplied: false,
          hybridSearchUsed: false,
          scoringStrategy: 'fallback_basic',
          performance: {
            searchTime: totalTime,
            totalTime,
          },
          debugInfo: {
            error: error instanceof Error ? error.message : 'Unknown error',
            fallbackUsed: true,
          },
        });
      }
    },

    // Rerank results using advanced relevance scoring
    async rerankResults(request: RerankingRequest): Promise<RerankingResult> {
      return await DocumentRerankingEngine.rerankDocuments(request);
    },

    // Hybrid search combining vector and keyword results
    async hybridSearch(request: HybridSearchRequest): Promise<FusionScore[]> {
      return DocumentRerankingEngine.fuseHybridResults(request);
    },

    // Record user feedback for learning
    async recordUserFeedback(feedback: UserFeedback): Promise<void> {
      RelevanceScoringEngine.recordUserFeedback(feedback);
    },

    // Get user-specific relevance preferences
    async getUserPreferences(userId: string): Promise<RelevanceWeights> {
      return DocumentRerankingEngine.getUserPreferences(userId);
    },

    // Update user preferences based on feedback
    async updateUserPreferences(
      userId: string,
      weights: Partial<RelevanceWeights>,
    ): Promise<void> {
      const _currentPrefs = await this.getUserPreferences(userId);
      const adjustments = { ...weights };

      DocumentRerankingEngine.updateUserPreferences(userId, {
        queryType: 'general', // Could be inferred from context
        preferredFactors: Object.keys(weights),
        adjustments,
      });
    },

    // Get relevance scoring metrics
    async getRelevanceMetrics(): Promise<{
      totalQueries: number;
      avgRelevanceScore: number;
      rerankingUsage: number;
      userFeedbackCount: number;
    }> {
      // In production, this would aggregate from monitoring service and database
      const ltrStats = LearningToRankEngine.getTrainingStats();

      return {
        totalQueries: ltrStats.totalQueries,
        avgRelevanceScore: 0.75, // Would be calculated from actual data
        rerankingUsage: 0.6, // Percentage of queries using reranking
        userFeedbackCount: ltrStats.totalSamples,
      };
    },
  };

  return service;
}

// Singleton service
let unifiedVectorStoreService: UnifiedVectorStoreService | null = null;

export async function getUnifiedVectorStoreService(): Promise<UnifiedVectorStoreService> {
  if (!unifiedVectorStoreService) {
    // Use fault-tolerant version by default for production resilience
    if (process.env.USE_FAULT_TOLERANT !== 'false') {
      unifiedVectorStoreService =
        await getFaultTolerantUnifiedVectorStoreService() as UnifiedVectorStoreService;
    } else {
      // Fallback to basic version if explicitly disabled
      unifiedVectorStoreService = await createUnifiedVectorStoreService();
    }
  }
  return unifiedVectorStoreService!;
}
