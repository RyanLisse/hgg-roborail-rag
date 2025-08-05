import 'server-only';
import { BaseVectorStoreService } from './core/base-service';
import {
  FallbackMode,
  FaultToleranceFactory,
  type FaultTolerantService,
  type ServiceProvider,
} from './fault-tolerance';
import {
  getVectorStoreMonitoringService,
  withPerformanceMonitoring,
} from './monitoring';
import {
  type FaultTolerantSupabaseVectorStoreService,
  getFaultTolerantSupabaseVectorStoreService,
} from './supabase-fault-tolerant';
import {
  type FaultTolerantOpenAIVectorStoreService,
  getFaultTolerantOpenAIVectorStoreService,
} from './openai-fault-tolerant';
import type { PromptConfig, QueryContext } from './prompt-optimization';
import type {
  FusionScore,
  HybridSearchRequest,
  RerankingRequest,
  RerankingResult,
} from './reranking';
import {
  BasicSearchRequest,
  DocumentUploadRequest,
  type EnhancedSearchResponse,
  type RelevanceWeights,
  UnifiedDocument,
  type UnifiedSearchRequest,
  UnifiedSearchResult,
  type UnifiedVectorStoreService,
  type UserFeedback,
  type VectorStoreType,
} from './unified';

// ====================================
// FAULT-TOLERANT UNIFIED SERVICE
// ====================================

export class FaultTolerantUnifiedVectorStoreService
  extends BaseVectorStoreService
  implements UnifiedVectorStoreService
{
  protected async searchImplementation(request: unknown): Promise<unknown[]> {
    const requestObj = request as Record<string, unknown>;
    const searchRequest =
      typeof request === 'object' && request !== null
        ? {
            query: String(requestObj.query || ''),
            sources: (requestObj.sources as (
              | 'openai'
              | 'supabase'
              | 'memory'
              | 'unified'
            )[]) || ['openai', 'supabase', 'memory'],
            maxResults: Number(requestObj.maxResults) || 10,
            threshold: Number(requestObj.threshold) || 0.3,
            optimizePrompts: Boolean(requestObj.optimizePrompts),
            metadata: requestObj.metadata as
              | Record<string, unknown>
              | undefined,
            queryContext: requestObj.queryContext as QueryContext | undefined,
            promptConfig: requestObj.promptConfig as PromptConfig | undefined,
          }
        : {
            query: String(request),
            sources: ['openai', 'supabase', 'memory'] as (
              | 'openai'
              | 'supabase'
              | 'memory'
              | 'unified'
            )[],
            maxResults: 10,
            threshold: 0.3,
            optimizePrompts: false,
          };
    return this.searchAcrossSources(searchRequest);
  }

  protected async performHealthCheck(): Promise<void> {
    const sources = await this.getAvailableSources();
    if (sources.length === 0) {
      throw new Error('No sources available');
    }
  }
  openaiService: FaultTolerantOpenAIVectorStoreService;
  supabaseService: FaultTolerantSupabaseVectorStoreService;

  private readonly faultTolerantService: FaultTolerantService<unknown>;

  constructor(
    openaiService?: FaultTolerantOpenAIVectorStoreService,
    supabaseService?: FaultTolerantSupabaseVectorStoreService,
  ) {
    super('unified-vector-store');
    this.openaiService =
      openaiService || getFaultTolerantOpenAIVectorStoreService();
    this.supabaseService =
      supabaseService || (null as unknown as FaultTolerantSupabaseVectorStoreService); // Will be initialized async

    // Create fault-tolerant wrapper for unified operations
    this.faultTolerantService = FaultToleranceFactory.createService(
      'unified_vector_store',
      {
        enableRetry: true,
        enableCircuitBreaker: true,
        enableFallback: true,
        enableGracefulDegradation: true,
        retryConfig: {
          maxRetries: 2, // Reduced for unified operations since individual services have their own retries
          baseDelayMs: 1000,
          maxDelayMs: 10_000,
          backoffMultiplier: 2,
          jitterFactor: 0.2,
          timeoutMs: 45_000,
        },
        circuitBreakerConfig: {
          failureThreshold: 3,
          recoveryTimeoutMs: 45_000,
          monitorWindowMs: 240_000,
          minimumThroughput: 5,
          successThreshold: 2,
        },
        fallbackConfig: {
          mode: FallbackMode.GRACEFUL,
          enableCaching: true,
          cacheRetentionMs: 1_800_000, // 30 minutes
          maxCacheSize: 500,
          fallbackTimeoutMs: 15_000,
          enablePartialResults: true,
          partialResultsThreshold: 0.3, // Accept results if 30% of sources succeed
        },
        healthCheckIntervalMs: 45_000,
      },
    );

    this.setupFallbackProviders();
    // Initialize supabase service asynchronously without blocking constructor
    this.initializeSupabaseService();
  }

  private initializeSupabaseService(): void {
    // Use void to indicate we don't wait for this
    void this.performAsyncInitialization();
  }

  private async performAsyncInitialization(): Promise<void> {
    try {
      this.supabaseService = await getFaultTolerantSupabaseVectorStoreService();
    } catch (_error) {
      // Supabase service initialization failed, but we can continue with other services
    }
  }

  // ====================================
  // UNIFIED DOCUMENT MANAGEMENT
  // ====================================

  async addDocument(
    request: DocumentUploadRequest,
  ): Promise<UnifiedDocument[]> {
    return this.faultTolerantService.execute(
      async () => {
        const validatedRequest = DocumentUploadRequest.parse(request);
        const results: UnifiedDocument[] = [];
        const errors: Error[] = [];

        // Process each target source with fault tolerance
        for (const source of validatedRequest.targetSources) {
          try {
            const sourceResults = await this.addDocumentToSource(
              source,
              validatedRequest,
            );
            results.push(...sourceResults);
          } catch (error) {
            errors.push(
              error instanceof Error ? error : new Error(String(error)),
            );
          }
        }

        // Return partial results if at least one source succeeded
        if (results.length > 0) {
          if (errors.length > 0) {
            // Log partial success with some failures, but continue with available results
            console.warn(
              `Partial document upload success: ${errors.length} sources failed`,
            );
          }
          return results;
        }

        // If all sources failed, throw the first error
        if (errors.length > 0) {
          throw errors[0];
        }

        return results;
      },
      {
        operationName: 'addDocument',
        requiredServiceLevel: 1,
      },
    );
  }

  async getDocument(
    id: string,
    source: VectorStoreType,
  ): Promise<UnifiedDocument | null> {
    const cacheKey = `unified:document:${source}:${id}`;

    return this.faultTolerantService.execute(
      async () => {
        switch (source) {
          case 'openai':
            if (this.openaiService.isEnabled) {
              // OpenAI doesn't have direct document retrieval, return null gracefully
              return null;
            }
            break;

          case 'supabase':
            if (this.supabaseService?.isEnabled) {
              const supabaseDoc = await this.supabaseService.getDocument(id);
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

        return null;
      },
      {
        operationName: 'getDocument',
        cacheKey,
        requiredServiceLevel: 3,
      },
    );
  }

  async deleteDocument(id: string, source: VectorStoreType): Promise<boolean> {
    return this.faultTolerantService.execute(
      async () => {
        switch (source) {
          case 'openai':
            if (this.openaiService.isEnabled) {
              return await this.openaiService.deleteFile(id);
            }
            break;

          case 'supabase':
            if (this.supabaseService?.isEnabled) {
              return await this.supabaseService.deleteDocument(id);
            }
            break;

          case 'memory':
            // Memory deletion would be handled by existing RAG service
            return true;
        }

        return false;
      },
      {
        operationName: 'deleteDocument',
        requiredServiceLevel: 1,
      },
    );
  }

  // ====================================
  // UNIFIED SEARCH OPERATIONS
  // ====================================

  searchAcrossSources = withPerformanceMonitoring(
    'unified',
    'searchAcrossSources',
    async (request: BasicSearchRequest): Promise<UnifiedSearchResult[]> => {
      const cacheKey = `unified:search:${request.query}:${request.maxResults}:${request.sources.join(',')}`;

      return this.faultTolerantService.execute(
        async () => {
          const monitoringService = getVectorStoreMonitoringService();
          const validatedRequest = BasicSearchRequest.parse(request);
          const allResults: UnifiedSearchResult[] = [];
          const startTime = Date.now();

          // Search in parallel across all requested sources with individual fault tolerance
          const searchPromises = validatedRequest.sources.map(
            async (source) => {
              try {
                switch (source) {
                  case 'openai':
                    if (this.openaiService.isEnabled) {
                      return await this.searchOpenAI(
                        validatedRequest.query,
                        Math.ceil(
                          validatedRequest.maxResults /
                            validatedRequest.sources.length,
                        ),
                      );
                    }
                    break;

                  case 'supabase':
                    if (this.supabaseService?.isEnabled) {
                      return await this.searchSupabase(
                        validatedRequest.query,
                        Math.ceil(
                          validatedRequest.maxResults /
                            validatedRequest.sources.length,
                        ),
                        validatedRequest.threshold,
                      );
                    }
                    break;

                  case 'memory':
                    // Memory search would be handled by existing RAG service
                    return [];
                }
              } catch (error) {
                monitoringService.recordSearchError('unified', error as Error, {
                  query: validatedRequest.query,
                  failedSource: source,
                });
              }
              return [];
            },
          );

          const results = await Promise.allSettled(searchPromises);

          // Collect successful results
          for (const result of results) {
            if (result.status === 'fulfilled' && result.value) {
              allResults.push(...result.value);
            }
          }

          // Sort by similarity and limit results
          const finalResults = allResults
            .toSorted((a, b) => b.similarity - a.similarity)
            .slice(0, validatedRequest.maxResults);

          const executionTime = Date.now() - startTime;

          // Record unified search metrics
          monitoringService.recordSearchLatency('unified', executionTime, {
            query: validatedRequest.query,
            resultsCount: finalResults.length,
            sourcesSearched: validatedRequest.sources,
            totalSourceResults: allResults.length,
          });

          monitoringService.recordSearchSuccess('unified', {
            query: validatedRequest.query,
            resultsCount: finalResults.length,
          });

          return finalResults;
        },
        {
          operationName: 'searchAcrossSources',
          cacheKey,
          requiredServiceLevel: 2,
        },
      );
    },
  );

  async searchOpenAI(
    query: string,
    maxResults = 10,
  ): Promise<UnifiedSearchResult[]> {
    if (!this.openaiService.isEnabled) {
      return [];
    }

    try {
      const searchResponse = await this.openaiService.searchFiles({
        query,
        maxResults,
        includeContent: true,
        includeCitations: true,
        optimizePrompts: false,
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
          distance: 1 - result.similarity,
          source: 'openai',
        }),
      );
    } catch (_error) {
      return [];
    }
  }

  async searchSupabase(
    query: string,
    maxResults = 10,
    threshold = 0.3,
  ): Promise<UnifiedSearchResult[]> {
    if (!this.supabaseService?.isEnabled) {
      return [];
    }

    try {
      const results = await this.supabaseService.searchSimilar({
        query,
        maxResults,
        threshold,
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
  }


  // ====================================
  // SERVICE STATUS AND MANAGEMENT
  // ====================================

  async getAvailableSources(): Promise<VectorStoreType[]> {
    return this.faultTolerantService.execute(
      async () => {
        const sources: VectorStoreType[] = [];

        // Check OpenAI availability
        if (this.openaiService.isEnabled) {
          try {
            const health = await this.openaiService.healthCheck();
            if (health.isHealthy) {
              sources.push('openai');
            }
          } catch (_error) {}
        }

        // Always include memory as fallback
        sources.push('memory');

        // Check Supabase availability
        if (this.supabaseService?.isEnabled) {
          try {
            const health = await this.supabaseService.healthCheck();
            if (health.isHealthy) {
              sources.push('supabase');
            }
          } catch (_error) {}
        }

        return sources;
      },
      {
        operationName: 'getAvailableSources',
        requiredServiceLevel: 4,
      },
    );
  }

  async getSourceStats(): Promise<
    Record<VectorStoreType, { enabled: boolean; count?: number }>
  > {
    return this.faultTolerantService.execute(
      async () => {
        const stats: Record<
          VectorStoreType,
          { enabled: boolean; count?: number }
        > = {
          memory: { enabled: true },
          openai: { enabled: this.openaiService.isEnabled },
          supabase: { enabled: this.supabaseService?.isEnabled },
        } as Record<VectorStoreType, { enabled: boolean; count?: number }>;

        // Get counts where possible with fault tolerance
        try {
          if (this.openaiService.isEnabled) {
            const files = await this.openaiService.listFiles();
            stats.openai.count = files.length;
          }
        } catch (_error) {}

        // Note: Supabase count would require a database query which might be expensive
        // Could be added as an optional operation

        return stats;
      },
      {
        operationName: 'getSourceStats',
        requiredServiceLevel: 3,
      },
    );
  }

  // ====================================
  // SYSTEM HEALTH AND METRICS
  // ====================================

  async getSystemHealth() {
    const [unifiedHealth, openaiHealth, supabaseHealth] = await Promise.allSettled([
      this.faultTolerantService.healthCheck(),
      this.openaiService.getSystemHealth(),
      this.supabaseService?.getSystemHealth(),
    ]);

    return {
      unified:
        unifiedHealth.status === 'fulfilled'
          ? unifiedHealth.value
          : { healthy: false },
      openai:
        openaiHealth.status === 'fulfilled'
          ? openaiHealth.value
          : { healthy: false },
      supabase:
        supabaseHealth.status === 'fulfilled'
          ? supabaseHealth.value
          : { healthy: false },
      timestamp: Date.now(),
    };
  }

  async getMetrics() {
    return [];
  }

  reset() {
    this.faultTolerantService.reset();
    this.openaiService.reset();
    this.supabaseService?.reset();
  }

  // ====================================
  // PRIVATE HELPER METHODS
  // ====================================

  private async addDocumentToSource(
    source: VectorStoreType,
    request: DocumentUploadRequest,
  ): Promise<UnifiedDocument[]> {
    const results: UnifiedDocument[] = [];

    switch (source) {
      case 'openai':
        if (this.openaiService.isEnabled && request.file) {
          const vectorStoreFile = await this.openaiService.uploadFile({
            file: request.file,
            metadata: request.metadata as Record<string, string> | undefined,
          });

          results.push(
            UnifiedDocument.parse({
              id: vectorStoreFile.id,
              content: request.content,
              metadata: request.metadata,
              source: 'openai',
              createdAt: new Date(vectorStoreFile.created_at * 1000),
            }),
          );
        }
        break;

      case 'supabase':
        if (this.supabaseService?.isEnabled) {
          const supabaseDoc = await this.supabaseService.addDocument({
            content: request.content,
            metadata: request.metadata,
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
            content: request.content,
            metadata: request.metadata,
            source: 'memory',
            createdAt: new Date(),
          }),
        );
        break;
    }

    return results;
  }

  private setupFallbackProviders(): void {
    // Multi-source search provider
    const multiSourceProvider: ServiceProvider<UnifiedSearchResult[]> = {
      name: 'unified_multi_source',
      priority: 1,
      isAvailable: async () => {
        const sources = await this.getAvailableSources();
        return sources.length > 0;
      },
      execute: async (request: UnifiedSearchRequest) => {
        return await this.searchAcrossSources(request);
      },
    };

    // OpenAI-only fallback
    const openaiOnlyProvider: ServiceProvider<UnifiedSearchResult[]> = {
      name: 'unified_openai_only',
      priority: 2,
      isAvailable: async () => {
        return this.openaiService.isEnabled;
      },
      execute: async (request: UnifiedSearchRequest) => {
        return await this.searchOpenAI(request.query, request.maxResults);
      },
    };

    // Supabase-only fallback
    const supabaseOnlyProvider: ServiceProvider<UnifiedSearchResult[]> = {
      name: 'unified_supabase_only',
      priority: 3,
      isAvailable: async () => {
        return this.supabaseService?.isEnabled;
      },
      execute: async (request: UnifiedSearchRequest) => {
        if (!this.supabaseService) {
          return [];
        }
        return await this.searchSupabase(
          request.query,
          request.maxResults,
          request.threshold,
        );
      },
    };


    // Emergency provider
    const emergencyProvider: ServiceProvider<UnifiedSearchResult[]> = {
      name: 'unified_emergency',
      priority: 5,
      isAvailable: async () => true,
      execute: async (_request: UnifiedSearchRequest) => {
        return [];
      },
      fallbackValue: [],
    };

    // Add providers
    this.faultTolerantService.addProvider(multiSourceProvider);
    this.faultTolerantService.addProvider(openaiOnlyProvider);
    this.faultTolerantService.addProvider(supabaseOnlyProvider);
    this.faultTolerantService.addProvider(emergencyProvider);
  }

  // ====================================
  // ENHANCED SEARCH FEATURES
  // ====================================

  async searchEnhanced(
    request: UnifiedSearchRequest,
  ): Promise<EnhancedSearchResponse> {
    // For fault-tolerant version, delegate to the basic service
    // In production, this could be enhanced with additional fault tolerance
    const basicService = await this.getBasicService();
    return basicService.searchEnhanced(request);
  }

  async rerankResults(request: RerankingRequest): Promise<RerankingResult> {
    const basicService = await this.getBasicService();
    return basicService.rerankResults(request);
  }

  async hybridSearch(request: HybridSearchRequest): Promise<FusionScore[]> {
    const basicService = await this.getBasicService();
    return basicService.hybridSearch(request);
  }

  async recordUserFeedback(feedback: UserFeedback): Promise<void> {
    const basicService = await this.getBasicService();
    return basicService.recordUserFeedback(feedback);
  }

  async getUserPreferences(userId: string): Promise<RelevanceWeights> {
    const basicService = await this.getBasicService();
    return basicService.getUserPreferences(userId);
  }

  async updateUserPreferences(
    userId: string,
    weights: Partial<RelevanceWeights>,
  ): Promise<void> {
    const basicService = await this.getBasicService();
    return basicService.updateUserPreferences(userId, weights);
  }

  async getRelevanceMetrics(): Promise<{
    totalQueries: number;
    avgRelevanceScore: number;
    rerankingUsage: number;
    userFeedbackCount: number;
  }> {
    const basicService = await this.getBasicService();
    return basicService.getRelevanceMetrics();
  }

  private async getBasicService(): Promise<UnifiedVectorStoreService> {
    // Import here to avoid circular dependency
    const { createUnifiedVectorStoreService } = await import('./unified');
    return createUnifiedVectorStoreService();
  }
}

// ====================================
// FACTORY FUNCTION
// ====================================

let faultTolerantUnifiedService: FaultTolerantUnifiedVectorStoreService | null =
  null;

export async function getFaultTolerantUnifiedVectorStoreService(): Promise<FaultTolerantUnifiedVectorStoreService> {
  if (!faultTolerantUnifiedService) {
    const openaiService = getFaultTolerantOpenAIVectorStoreService();
    const supabaseService = await getFaultTolerantSupabaseVectorStoreService();
    faultTolerantUnifiedService = new FaultTolerantUnifiedVectorStoreService(
      openaiService,
      supabaseService,
    );
  }
  return faultTolerantUnifiedService;
}

// Re-export types for convenience
export type {
  DocumentUploadRequest,
  UnifiedDocument,
  UnifiedSearchRequest,
  UnifiedSearchResult,
  VectorStoreType,
} from './unified';
