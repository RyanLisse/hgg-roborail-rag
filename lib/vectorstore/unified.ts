import 'server-only';

import { z } from 'zod';
import { getOpenAIVectorStoreService, type OpenAIVectorStoreService } from './openai';
import { getNeonVectorStoreService, type NeonVectorStoreService } from './neon';
import { getVectorStoreMonitoringService, withPerformanceMonitoring } from './monitoring';

// Unified schemas
export const VectorStoreType = z.enum(['openai', 'neon', 'memory']);

export const UnifiedDocument = z.object({
  id: z.string(),
  content: z.string(),
  metadata: z.record(z.any()).optional(),
  source: VectorStoreType,
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const UnifiedSearchRequest = z.object({
  query: z.string().min(1),
  sources: z.array(VectorStoreType).default(['openai', 'neon', 'memory']),
  maxResults: z.number().min(1).max(100).default(10),
  threshold: z.number().min(0).max(1).default(0.3),
  metadata: z.record(z.any()).optional(),
});

export const UnifiedSearchResult = z.object({
  document: UnifiedDocument,
  similarity: z.number(),
  distance: z.number(),
  source: VectorStoreType,
});

export const DocumentUploadRequest = z.object({
  content: z.string().min(1),
  metadata: z.record(z.any()).optional(),
  file: z.instanceof(File).optional(),
  targetSources: z.array(VectorStoreType).default(['memory']),
});

// Types
export type VectorStoreType = z.infer<typeof VectorStoreType>;
export type UnifiedDocument = z.infer<typeof UnifiedDocument>;
export type UnifiedSearchRequest = z.infer<typeof UnifiedSearchRequest>;
export type UnifiedSearchResult = z.infer<typeof UnifiedSearchResult>;
export type DocumentUploadRequest = z.infer<typeof DocumentUploadRequest>;

export interface UnifiedVectorStoreService {
  openaiService: OpenAIVectorStoreService;
  neonService: NeonVectorStoreService;
  
  // Document management
  addDocument: (request: DocumentUploadRequest) => Promise<UnifiedDocument[]>;
  getDocument: (id: string, source: VectorStoreType) => Promise<UnifiedDocument | null>;
  deleteDocument: (id: string, source: VectorStoreType) => Promise<boolean>;
  
  // Search operations
  searchAcrossSources: (request: UnifiedSearchRequest) => Promise<UnifiedSearchResult[]>;
  searchOpenAI: (query: string, maxResults?: number) => Promise<UnifiedSearchResult[]>;
  searchNeon: (query: string, maxResults?: number, threshold?: number) => Promise<UnifiedSearchResult[]>;
  
  // Service status
  getAvailableSources: () => Promise<VectorStoreType[]>;
  getSourceStats: () => Promise<Record<VectorStoreType, { enabled: boolean; count?: number }>>;
}

// Create unified vector store service
export async function createUnifiedVectorStoreService(): Promise<UnifiedVectorStoreService> {
  const openaiService = await getOpenAIVectorStoreService();
  const neonService = await getNeonVectorStoreService();

    const service: UnifiedVectorStoreService = {
      openaiService,
      neonService,

      async addDocument(request: DocumentUploadRequest): Promise<UnifiedDocument[]> {
        const validatedRequest = DocumentUploadRequest.parse(request);
        const results: UnifiedDocument[] = [];

        for (const source of validatedRequest.targetSources) {
          try {
            switch (source) {
              case 'openai':
                if (openaiService.isEnabled && validatedRequest.file) {
                  const vectorStoreFile = await openaiService.uploadFile({
                    file: validatedRequest.file,
                    metadata: validatedRequest.metadata,
                  });
                  
                  results.push(UnifiedDocument.parse({
                    id: vectorStoreFile.id,
                    content: validatedRequest.content,
                    metadata: validatedRequest.metadata,
                    source: 'openai',
                    createdAt: new Date(vectorStoreFile.created_at * 1000),
                  }));
                }
                break;

              case 'neon':
                if (neonService.isEnabled) {
                  const neonDoc = await neonService.addDocument({
                    content: validatedRequest.content,
                    metadata: validatedRequest.metadata,
                  });
                  
                  results.push(UnifiedDocument.parse({
                    id: neonDoc.id,
                    content: neonDoc.content,
                    metadata: neonDoc.metadata,
                    source: 'neon',
                    createdAt: neonDoc.createdAt,
                    updatedAt: neonDoc.updatedAt,
                  }));
                }
                break;

              case 'memory':
                // Memory storage is handled by the existing RAG service
                results.push(UnifiedDocument.parse({
                  id: crypto.randomUUID(),
                  content: validatedRequest.content,
                  metadata: validatedRequest.metadata,
                  source: 'memory',
                  createdAt: new Date(),
                }));
                break;
            }
          } catch (error) {
            console.warn(`Failed to add document to ${source}:`, error);
          }
        }

        return results;
      },

      async getDocument(id: string, source: VectorStoreType): Promise<UnifiedDocument | null> {
        try {
          switch (source) {
            case 'openai':
              if (openaiService.isEnabled) {
                // OpenAI doesn't have a direct file content retrieval API
                // This would need to be implemented differently
                return null;
              }
              break;

            case 'neon':
              if (neonService.isEnabled) {
                const neonDoc = await neonService.getDocument(id);
                if (neonDoc) {
                  return UnifiedDocument.parse({
                    id: neonDoc.id,
                    content: neonDoc.content,
                    metadata: neonDoc.metadata,
                    source: 'neon',
                    createdAt: neonDoc.createdAt,
                    updatedAt: neonDoc.updatedAt,
                  });
                }
              }
              break;

            case 'memory':
              // Memory retrieval would be handled by existing RAG service
              return null;
          }
        } catch (error) {
          console.error(`Failed to get document ${id} from ${source}:`, error);
        }

        return null;
      },

      async deleteDocument(id: string, source: VectorStoreType): Promise<boolean> {
        try {
          switch (source) {
            case 'openai':
              if (openaiService.isEnabled) {
                return await openaiService.deleteFile(id);
              }
              break;

            case 'neon':
              if (neonService.isEnabled) {
                return await neonService.deleteDocument(id);
              }
              break;

            case 'memory':
              // Memory deletion would be handled by existing RAG service
              return true;
          }
        } catch (error) {
          console.error(`Failed to delete document ${id} from ${source}:`, error);
        }

        return false;
      },

      searchAcrossSources: withPerformanceMonitoring('unified', 'searchAcrossSources', async function(this: any, request: UnifiedSearchRequest): Promise<UnifiedSearchResult[]> {
        const monitoringService = getVectorStoreMonitoringService();
        const validatedRequest = UnifiedSearchRequest.parse(request);
        const allResults: UnifiedSearchResult[] = [];
        const startTime = Date.now();

        try {
          // Search in parallel across all requested sources
          const searchPromises = validatedRequest.sources.map(async (source) => {
            try {
              switch (source) {
                case 'openai':
                  if (openaiService.isEnabled) {
                    return await this.searchOpenAI(
                      validatedRequest.query, 
                      Math.ceil(validatedRequest.maxResults / validatedRequest.sources.length)
                    );
                  }
                  break;

                case 'neon':
                  if (neonService.isEnabled) {
                    return await this.searchNeon(
                      validatedRequest.query,
                      Math.ceil(validatedRequest.maxResults / validatedRequest.sources.length),
                      validatedRequest.threshold
                    );
                  }
                  break;

                case 'memory':
                  // Memory search would be handled by existing RAG service
                  return [];
              }
            } catch (error) {
              console.warn(`Failed to search ${source}:`, error);
              monitoringService.recordSearchError('unified', error as Error, {
                query: validatedRequest.query,
                failedSource: source,
              });
            }
            return [];
          });

          const results = await Promise.all(searchPromises);
          
          // Combine and sort results by similarity
          for (const sourceResults of results) {
            if (sourceResults) {
              allResults.push(...sourceResults);
            }
          }

          const finalResults = allResults
            .sort((a, b) => b.similarity - a.similarity)
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
        } catch (error) {
          monitoringService.recordSearchError('unified', error as Error, {
            query: validatedRequest.query,
            sources: validatedRequest.sources,
          });
          throw error;
        }
      }),

      async searchOpenAI(query: string, maxResults = 10): Promise<UnifiedSearchResult[]> {
        if (!openaiService.isEnabled) return [];

        try {
          const searchResponse = await openaiService.searchFiles({
            query,
            maxResults,
            includeContent: true,
            includeCitations: true,
          });

          if (!searchResponse.success) {
            console.warn('OpenAI search failed:', searchResponse.message);
            return [];
          }

          return searchResponse.results.map(result => UnifiedSearchResult.parse({
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
          }));
        } catch (error) {
          console.error('Failed to search OpenAI vector store:', error);
          return [];
        }
      },

      async searchNeon(query: string, maxResults = 10, threshold = 0.3): Promise<UnifiedSearchResult[]> {
        if (!neonService.isEnabled) return [];

        try {
          const results = await neonService.searchSimilar({
            query,
            maxResults,
            threshold,
          });

          return results.map(result => UnifiedSearchResult.parse({
            document: UnifiedDocument.parse({
              id: result.document.id,
              content: result.document.content,
              metadata: result.document.metadata,
              source: 'neon',
              createdAt: result.document.createdAt,
              updatedAt: result.document.updatedAt,
            }),
            similarity: result.similarity,
            distance: result.distance,
            source: 'neon',
          }));
        } catch (error) {
          console.error('Failed to search Neon vector store:', error);
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

        if (neonService.isEnabled) {
          sources.push('neon');
        }

        return sources;
      },

      async getSourceStats(): Promise<Record<VectorStoreType, { enabled: boolean; count?: number }>> {
        const stats: Record<VectorStoreType, { enabled: boolean; count?: number }> = {
          memory: { enabled: true },
          openai: { enabled: openaiService.isEnabled },
          neon: { enabled: neonService.isEnabled },
        };

        // Get counts where possible
        try {
          if (openaiService.isEnabled) {
            const files = await openaiService.listFiles();
            stats.openai.count = files.length;
          }
        } catch (error) {
          console.warn('Failed to get OpenAI file count:', error);
        }

        return stats;
      },
    };

    return service;
}

// Singleton service
let unifiedVectorStoreService: UnifiedVectorStoreService | null = null;

export async function getUnifiedVectorStoreService(): Promise<UnifiedVectorStoreService> {
  if (!unifiedVectorStoreService) {
    unifiedVectorStoreService = await createUnifiedVectorStoreService();
  }
  return unifiedVectorStoreService;
}