import 'server-only';

import OpenAI from 'openai';
import { z } from 'zod';
import { OPENAI_API_KEY, OPENAI_VECTORSTORE } from '../env';
import {
  getVectorStoreMonitoringService,
  withPerformanceMonitoring,
} from './monitoring';
import {
  type OptimizedQuery,
  PromptOptimizationEngine,
} from './prompt-optimization';

// Schemas for OpenAI vector store operations
export const VectorStoreFile = z.object({
  id: z.string(),
  object: z.literal('vector_store.file'),
  created_at: z.number(),
  vector_store_id: z.string(),
  status: z.enum(['in_progress', 'completed', 'cancelled', 'failed']),
  last_error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .nullable(),
});

export const VectorStore = z.object({
  id: z.string(),
  object: z.literal('vector_store'),
  created_at: z.number(),
  name: z.string().nullable(),
  usage_bytes: z.number(),
  file_counts: z.object({
    in_progress: z.number(),
    completed: z.number(),
    failed: z.number(),
    cancelled: z.number(),
    total: z.number(),
  }),
  status: z.enum(['expired', 'in_progress', 'completed']),
  expires_after: z
    .object({
      anchor: z.enum(['last_active_at']),
      days: z.number(),
    })
    .nullable(),
  expires_at: z.number().nullable(),
  last_active_at: z.number().nullable(),
  metadata: z.record(z.string()).nullable(),
});

export const FileUploadRequest = z.object({
  file: z.instanceof(File),
  name: z.string().optional(),
  metadata: z.record(z.string()).optional(),
});

export const SearchRequest = z.object({
  query: z.string().min(1),
  vectorStoreId: z.string().optional(),
  maxResults: z.number().min(1).max(50).default(10),
  includeContent: z.boolean().default(true),
  includeCitations: z.boolean().default(true),
  // Enhanced search options for prompt optimization
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

export const SearchResult = z.object({
  id: z.string(),
  content: z.string(),
  similarity: z.number().min(0).max(1),
  source: z.object({
    file_id: z.string(),
    filename: z.string(),
    chunk_id: z.string().optional(),
  }),
  metadata: z.record(z.any()).optional(),
  annotations: z
    .array(
      z.object({
        type: z.enum(['file_citation', 'file_path']),
        text: z.string(),
        start_index: z.number(),
        end_index: z.number(),
        file_citation: z
          .object({
            file_id: z.string(),
            quote: z.string().optional(),
          })
          .optional(),
        file_path: z
          .object({
            file_id: z.string(),
          })
          .optional(),
      }),
    )
    .optional(),
});

export const SearchResponse = z.object({
  success: z.boolean(),
  message: z.string(),
  results: z.array(SearchResult),
  sources: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      url: z.string().optional(),
    }),
  ),
  totalResults: z.number(),
  query: z.string(),
  executionTime: z.number(),
  // Enhanced response with optimization metadata
  optimizationMetadata: z
    .object({
      originalQuery: z.string(),
      optimizedQuery: z.string(),
      queryType: z.string(),
      complexity: z.string(),
      expansionCount: z.number(),
      estimatedRelevance: z.number(),
      promptOptimizationUsed: z.boolean(),
    })
    .optional(),
});

// Types
export type VectorStoreFile = z.infer<typeof VectorStoreFile>;
export type VectorStore = z.infer<typeof VectorStore>;
export type FileUploadRequest = z.infer<typeof FileUploadRequest>;
export type SearchRequest = z.infer<typeof SearchRequest>;
export type SearchResult = z.infer<typeof SearchResult>;
export type SearchResponse = z.infer<typeof SearchResponse>;

// OpenAI API response types
export interface OpenAIResponsesAPIResult {
  attributes?: Record<string, any>;
  file_id?: string;
  filename?: string;
  score?: number;
  text?: string;
  chunk_id?: string;
}

export interface OpenAIResponsesAPIOutput {
  id: string;
  type: string;
  status: string;
  queries?: string[];
  results?: OpenAIResponsesAPIResult[];
}

export interface OpenAIResponsesAPIResponse {
  id: string;
  object: string;
  created_at: number;
  status: string;
  model: string;
  output?: OpenAIResponsesAPIOutput[];
}

export interface OpenAIVectorStoreConfig {
  apiKey: string;
  defaultVectorStoreId?: string | null;
  isEnabled: boolean;
}

export interface OpenAIVectorStoreService {
  client: OpenAI;
  defaultVectorStoreId: string | null | undefined;
  isEnabled: boolean;

  // Vector store management
  createVectorStore: (
    name: string,
    metadata?: Record<string, string>,
  ) => Promise<VectorStore>;
  getVectorStore: (vectorStoreId: string) => Promise<VectorStore>;
  listVectorStores: () => Promise<VectorStore[]>;
  deleteVectorStore: (vectorStoreId: string) => Promise<boolean>;

  // File management
  uploadFile: (
    request: FileUploadRequest,
    vectorStoreId?: string,
  ) => Promise<VectorStoreFile>;
  listFiles: (vectorStoreId?: string) => Promise<VectorStoreFile[]>;
  deleteFile: (fileId: string, vectorStoreId?: string) => Promise<boolean>;

  // Search operations
  searchFiles: (request: SearchRequest) => Promise<SearchResponse>;
  searchWithRetry: (
    request: SearchRequest,
    maxRetries?: number,
  ) => Promise<SearchResponse>;
  getFileSearchTool: (vectorStoreId?: string) => any;

  // Health checks and utilities
  healthCheck: () => Promise<{
    isHealthy: boolean;
    vectorStoreStatus?: string;
    error?: string;
  }>;
  validateVectorStore: (vectorStoreId: string) => Promise<boolean>;
  getSourceFiles: (
    fileIds: string[],
  ) => Promise<Array<{ id: string; name: string; url?: string }>>;
}

// Create OpenAI vector store service
export function createOpenAIVectorStoreService(
  config?: Partial<OpenAIVectorStoreConfig>,
): OpenAIVectorStoreService {
  const apiKey = config?.apiKey || OPENAI_API_KEY || '';
  const defaultVectorStoreId =
    config?.defaultVectorStoreId || OPENAI_VECTORSTORE || null;
  const isEnabled = !!apiKey;

  const validatedConfig: OpenAIVectorStoreConfig = {
    apiKey,
    defaultVectorStoreId,
    isEnabled,
  };

  // Validate API key format
  if (apiKey && !apiKey.startsWith('sk-')) {
  }

  // Validate vector store ID format
  if (defaultVectorStoreId && !defaultVectorStoreId.startsWith('vs_')) {
  }

  if (!validatedConfig.isEnabled) {
    return {
      client: null as any,
      defaultVectorStoreId: null,
      isEnabled: false,
      createVectorStore: async () => {
        throw new Error(
          'OpenAI vector store service is disabled - no API key provided',
        );
      },
      getVectorStore: async () => {
        throw new Error(
          'OpenAI vector store service is disabled - no API key provided',
        );
      },
      listVectorStores: async () => {
        return [];
      }, // Return empty array instead of throwing
      deleteVectorStore: async () => {
        return false;
      },
      uploadFile: async () => {
        throw new Error(
          'OpenAI vector store service is disabled - no API key provided',
        );
      },
      listFiles: async () => {
        return [];
      }, // Return empty array instead of throwing
      deleteFile: async () => {
        return false;
      },
      searchFiles: async () => {
        return SearchResponse.parse({
          success: false,
          message:
            'OpenAI vector store service is disabled - no API key provided',
          results: [],
          sources: [],
          totalResults: 0,
          query: '',
          executionTime: 0,
        });
      },
      searchWithRetry: async () => {
        return SearchResponse.parse({
          success: false,
          message:
            'OpenAI vector store service is disabled - no API key provided',
          results: [],
          sources: [],
          totalResults: 0,
          query: '',
          executionTime: 0,
        });
      },
      healthCheck: async () => ({
        isHealthy: false,
        error: 'Service disabled',
      }),
      validateVectorStore: async () => false,
      getSourceFiles: async () => [],
      getFileSearchTool: () => null, // Return null instead of throwing
    };
  }

  const client = new OpenAI({ apiKey: validatedConfig.apiKey });

  // Create a reference to the service for internal method calls
  const service = {
    client,
    defaultVectorStoreId: validatedConfig.defaultVectorStoreId,
    isEnabled: true,

    async createVectorStore(
      name: string,
      metadata?: Record<string, string>,
    ): Promise<VectorStore> {
        const response = await fetch(
          'https://api.openai.com/v1/vector_stores',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${validatedConfig.apiKey}`,
              'Content-Type': 'application/json',
              'OpenAI-Beta': 'assistants=v2',
            },
            body: JSON.stringify({
              name,
              metadata: metadata || {},
              expires_after: {
                anchor: 'last_active_at',
                days: 365,
              },
            }),
          },
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            `HTTP ${response.status}: ${errorData.error?.message || response.statusText}`,
          );
        }

        const data = await response.json();
        return VectorStore.parse(data);
    },

    async getVectorStore(vectorStoreId: string): Promise<VectorStore> {
        const response = await fetch(
          `https://api.openai.com/v1/vector_stores/${vectorStoreId}`,
          {
            headers: {
              Authorization: `Bearer ${validatedConfig.apiKey}`,
              'Content-Type': 'application/json',
              'OpenAI-Beta': 'assistants=v2',
            },
          },
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            `HTTP ${response.status}: ${errorData.error?.message || response.statusText}`,
          );
        }

        const data = await response.json();
        return VectorStore.parse(data);
    },

    async listVectorStores(): Promise<VectorStore[]> {
      try {
        const response = await fetch(
          'https://api.openai.com/v1/vector_stores',
          {
            headers: {
              Authorization: `Bearer ${validatedConfig.apiKey}`,
              'Content-Type': 'application/json',
              'OpenAI-Beta': 'assistants=v2',
            },
          },
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            `HTTP ${response.status}: ${errorData.error?.message || response.statusText}`,
          );
        }

        const data = await response.json();
        return data.data?.map((store: any) => VectorStore.parse(store)) || [];
      } catch (_error) {
        // Return empty array to prevent blocking the UI
        return [];
      }
    },

    async deleteVectorStore(vectorStoreId: string): Promise<boolean> {
      try {
        const response = await fetch(
          `https://api.openai.com/v1/vector_stores/${vectorStoreId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${validatedConfig.apiKey}`,
              'Content-Type': 'application/json',
              'OpenAI-Beta': 'assistants=v2',
            },
          },
        );

        if (!response.ok) {
          const _errorData = await response.json().catch(() => ({}));
          return false;
        }

        return true;
      } catch (_error) {
        return false;
      }
    },

    async uploadFile(
      request: FileUploadRequest,
      vectorStoreId?: string,
    ): Promise<VectorStoreFile> {
      const validatedRequest = FileUploadRequest.parse(request);
      const targetVectorStoreId =
        vectorStoreId || validatedConfig.defaultVectorStoreId;

      if (!targetVectorStoreId) {
        throw new Error(
          'No vector store ID provided and no default configured',
        );
      }
        // First upload the file
        const uploadedFile = await client.files.create({
          file: validatedRequest.file,
          purpose: 'assistants',
        });

        // Add file to vector store using direct API call
        const response = await fetch(
          `https://api.openai.com/v1/vector_stores/${targetVectorStoreId}/files`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${validatedConfig.apiKey}`,
              'Content-Type': 'application/json',
              'OpenAI-Beta': 'assistants=v2',
            },
            body: JSON.stringify({
              file_id: uploadedFile.id,
            }),
          },
        );

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(
            `HTTP ${response.status}: ${errorData.error?.message || response.statusText}`,
          );
        }

        const vectorStoreFile = await response.json();
        return VectorStoreFile.parse(vectorStoreFile);
    },

    async listFiles(vectorStoreId?: string): Promise<VectorStoreFile[]> {
      const targetVectorStoreId =
        vectorStoreId || validatedConfig.defaultVectorStoreId;

      if (!targetVectorStoreId) {
        throw new Error(
          'No vector store ID provided and no default configured',
        );
      }

      try {
        // Use direct API call since SDK might have compatibility issues
        const response = await fetch(
          `https://api.openai.com/v1/vector_stores/${targetVectorStoreId}/files`,
          {
            headers: {
              Authorization: `Bearer ${validatedConfig.apiKey}`,
              'Content-Type': 'application/json',
              'OpenAI-Beta': 'assistants=v2',
            },
          },
        );

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        return (
          data.data?.map((file: any) =>
            VectorStoreFile.parse({
              id: file.id,
              object: file.object,
              created_at: file.created_at,
              vector_store_id: file.vector_store_id,
              status: file.status,
              last_error: file.last_error,
            }),
          ) || []
        );
      } catch (_error) {
        // Return empty array instead of throwing to prevent blocking the UI
        return [];
      }
    },

    async deleteFile(fileId: string, vectorStoreId?: string): Promise<boolean> {
      const targetVectorStoreId =
        vectorStoreId || validatedConfig.defaultVectorStoreId;

      if (!targetVectorStoreId) {
        throw new Error(
          'No vector store ID provided and no default configured',
        );
      }

      try {
        const response = await fetch(
          `https://api.openai.com/v1/vector_stores/${targetVectorStoreId}/files/${fileId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${validatedConfig.apiKey}`,
              'Content-Type': 'application/json',
              'OpenAI-Beta': 'assistants=v2',
            },
          },
        );

        if (!response.ok) {
          const _errorData = await response.json().catch(() => ({}));
          return false;
        }

        return true;
      } catch (_error) {
        return false;
      }
    },

    searchFiles: withPerformanceMonitoring(
      'openai',
      'searchFiles',
      async (request: SearchRequest): Promise<SearchResponse> => {
        const monitoringService = getVectorStoreMonitoringService();
        const startTime = Date.now();
        const validatedRequest = SearchRequest.parse(request);
        const targetVectorStoreId =
          validatedRequest.vectorStoreId ||
          validatedConfig.defaultVectorStoreId;

        if (!targetVectorStoreId) {
          const response = SearchResponse.parse({
            success: false,
            message: 'No vector store ID provided and no default configured',
            results: [],
            sources: [],
            totalResults: 0,
            query: validatedRequest.query,
            executionTime: Date.now() - startTime,
          });
          monitoringService.recordSearchError(
            'openai',
            new Error('No vector store configured'),
          );
          return response;
        }

        try {

          // Validate vector store exists
          const isValid =
            await service.validateVectorStore(targetVectorStoreId);
          if (!isValid) {
            const response = SearchResponse.parse({
              success: false,
              message: `Vector store ${targetVectorStoreId} is not accessible or does not exist`,
              results: [],
              sources: [],
              totalResults: 0,
              query: validatedRequest.query,
              executionTime: Date.now() - startTime,
            });
            monitoringService.recordSearchError(
              'openai',
              new Error('Vector store not accessible'),
            );
            return response;
          }

          // Apply prompt optimization if enabled
          let optimizedQuery: OptimizedQuery | null = null;
          let searchPrompt = `Search for information about: ${validatedRequest.query}. Please provide comprehensive relevant information with proper citations.`;

          if (
            validatedRequest.optimizePrompts &&
            validatedRequest.queryContext &&
            validatedRequest.queryContext.type
          ) {
            try {
              optimizedQuery = await PromptOptimizationEngine.optimizeQuery(
                validatedRequest.query,
                {
                  ...validatedRequest.queryContext,
                  type: validatedRequest.queryContext.type || 'general',
                },
                validatedRequest.promptConfig,
              );

              if (optimizedQuery) {
                searchPrompt = optimizedQuery.optimizedQuery;
              }
            } catch (_error) {
            }
          } else {
            // Use simplified search prompt for faster response
            searchPrompt = `Find relevant information about: ${validatedRequest.query}`;
          }

          // Use OpenAI Responses API with file search for vector store search
          const response = await client.responses.create(
            {
              model: 'gpt-4o-mini', // Use efficient model for search
              input: searchPrompt,
              tools: [
                {
                  type: 'file_search',
                  vector_store_ids: [targetVectorStoreId],
                  max_num_results: Math.min(validatedRequest.maxResults, 10), // Limit results for faster response
                },
              ],
              include: ['file_search_call.results'],
            },
            {
              timeout: 10_000, // 10 second timeout
            },
          );

          // Extract file search results from output
          const results: SearchResult[] = [];
          const sourceFileIds = new Set<string>();

          if (response.output && Array.isArray(response.output)) {
            for (const output of response.output) {
              if (
                output.type === 'file_search_call' &&
                output.status === 'completed' &&
                output.results
              ) {

                // Process each search result (limit to maxResults)
                const limitedResults = output.results.slice(
                  0,
                  validatedRequest.maxResults,
                );
                for (let i = 0; i < limitedResults.length; i++) {
                  const searchItem = limitedResults[
                    i
                  ] as OpenAIResponsesAPIResult;
                  const searchId = `${response.id}_result_${i}`;

                  // Track source files
                  if (searchItem.file_id) {
                    sourceFileIds.add(searchItem.file_id);
                  }

                  // Create search result
                  results.push(
                    SearchResult.parse({
                      id: searchId,
                      content: searchItem.text || '',
                      similarity: searchItem.score || 0.8, // Use provided score or default
                      source: {
                        file_id: searchItem.file_id || 'unknown',
                        filename:
                          searchItem.filename ||
                          `File ${searchItem.file_id || 'unknown'}`,
                        chunk_id: searchItem.chunk_id || undefined,
                      },
                      metadata: {
                        responseId: response.id,
                        vectorStoreId: targetVectorStoreId,
                        score: searchItem.score,
                        attributes: searchItem.attributes,
                        resultIndex: i,
                        searchQueries: output.queries,
                      },
                    }),
                  );
                }
              }
            }
          }

          // Fetch file information for sources
          const sources = await service.getSourceFiles(
            Array.from(sourceFileIds),
          );

          const executionTime = Date.now() - startTime;

          // Record performance metrics
          monitoringService.recordSearchLatency('openai', executionTime, {
            query: validatedRequest.query,
            resultsCount: results.length,
            vectorStoreId: targetVectorStoreId,
          });
          monitoringService.recordSearchSuccess('openai', {
            query: validatedRequest.query,
            resultsCount: results.length,
            promptOptimizationUsed: !!optimizedQuery,
          });

          return SearchResponse.parse({
            success: true,
            message:
              results.length > 0
                ? `Found ${results.length} relevant result(s) with ${sources.length} source file(s)`
                : 'Search completed but no relevant content found',
            results,
            sources: sources.map((s: any) => ({
              id: s.id,
              name: s.name,
              url: s.url,
            })),
            totalResults: results.length,
            query: validatedRequest.query,
            executionTime,
            optimizationMetadata: optimizedQuery
              ? {
                  originalQuery: validatedRequest.query,
                  optimizedQuery: optimizedQuery.optimizedQuery,
                  queryType: validatedRequest.queryContext?.type || 'general',
                  complexity:
                    validatedRequest.queryContext?.complexity || 'basic',
                  expansionCount: 0, // Expansion count not available in current optimization structure
                  estimatedRelevance:
                    optimizedQuery.metadata?.estimatedRelevance || 0.5,
                  promptOptimizationUsed: true,
                }
              : undefined,
          });
        } catch (error) {
          const executionTime = Date.now() - startTime;

          // Record error metrics
          monitoringService.recordSearchError('openai', error as Error, {
            query: validatedRequest.query,
            vectorStoreId: targetVectorStoreId,
            executionTime,
          });

          return SearchResponse.parse({
            success: false,
            message: `Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            results: [],
            sources: [],
            totalResults: 0,
            query: validatedRequest.query,
            executionTime,
          });
        }
      },
    ),

    async searchWithRetry(
      request: SearchRequest,
      maxRetries = 3,
    ): Promise<SearchResponse> {
      let lastError: Error | null = null;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const result = await service.searchFiles(request);

          if (result.success) {
            if (attempt > 1) {
            }
            return result;
          }

          // If search failed but didn't throw, treat as error for retry
          lastError = new Error(result.message);
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          // Don't retry on certain errors
          if (
            lastError.message.includes('No vector store ID') ||
            lastError.message.includes('not accessible') ||
            lastError.message.includes('disabled')
          ) {
            break;
          }

          // Wait between retries with exponential backoff
          if (attempt < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }
      return SearchResponse.parse({
        success: false,
        message: `Search failed after ${maxRetries} attempts: ${lastError?.message || 'Unknown error'}`,
        results: [],
        sources: [],
        totalResults: 0,
        query: request.query,
        executionTime: 0,
      });
    },

    /**
     * Helper method to fetch source file information
     */
    async getSourceFiles(
      fileIds: string[],
    ): Promise<Array<{ id: string; name: string; url?: string }>> {
      if (!fileIds.length) { return []; }

      const sources: Array<{ id: string; name: string; url?: string }> = [];

      for (const fileId of fileIds) {
        try {
          const file = await client.files.retrieve(fileId);
          sources.push({
            id: file.id,
            name: file.filename || `File ${file.id}`,
            url: undefined, // OpenAI files don't have public URLs
          });
        } catch (_error) {
          // Add placeholder for failed file retrieval
          sources.push({
            id: fileId,
            name: `Unknown file (${fileId})`,
            url: undefined,
          });
        }
      }

      return sources;
    },

    getFileSearchTool(
      vectorStoreId?: string,
      optimizationConfig?: { domain?: string; queryType?: string },
    ): any {
      const targetVectorStoreId =
        vectorStoreId || validatedConfig.defaultVectorStoreId;

      if (!targetVectorStoreId) {
        return null;
      }

      // Enhanced configuration with optimization hints
      const toolConfig = {
        type: 'file_search' as const,
        file_search: {
          vector_store_ids: [targetVectorStoreId],
          max_num_results: 20, // Allow more results for better context
          // Add optimization metadata for the AI model to use
          search_strategy: optimizationConfig?.queryType || 'comprehensive',
          domain_context: optimizationConfig?.domain || 'roborail',
        },
      };

      // Add domain-specific search instructions
      if (optimizationConfig?.domain === 'roborail') {
      }

      return toolConfig;
    },

    async healthCheck(): Promise<{
      isHealthy: boolean;
      vectorStoreStatus?: string;
      error?: string;
    }> {
      const monitoringService = getVectorStoreMonitoringService();
      const startTime = Date.now();

      try {
        // Test basic API connectivity
        const testResponse = await fetch('https://api.openai.com/v1/models', {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${validatedConfig.apiKey}`,
            'Content-Type': 'application/json',
          },
        });

        if (!testResponse.ok) {
          const error = new Error(
            `API connectivity test failed: HTTP ${testResponse.status}`,
          );
          monitoringService.recordMetric({
            provider: 'openai',
            metricType: 'service_health',
            value: 0,
            unit: 'status',
            success: false,
            errorMessage: error.message,
            duration: Date.now() - startTime,
          });

          return {
            isHealthy: false,
            error: error.message,
          };
        }

        // Test vector store access if default is configured
        let vectorStoreStatus = 'No default vector store configured';
        if (validatedConfig.defaultVectorStoreId) {
          try {
            await service.getVectorStore(validatedConfig.defaultVectorStoreId);
            vectorStoreStatus = 'Default vector store accessible';
          } catch (error) {
            vectorStoreStatus = `Default vector store inaccessible: ${error instanceof Error ? error.message : 'Unknown error'}`;
          }
        }

        // Record successful health check
        monitoringService.recordMetric({
          provider: 'openai',
          metricType: 'service_health',
          value: 1,
          unit: 'status',
          success: true,
          duration: Date.now() - startTime,
          metadata: { vectorStoreStatus },
        });

        return {
          isHealthy: true,
          vectorStoreStatus,
        };
      } catch (error) {
        monitoringService.recordMetric({
          provider: 'openai',
          metricType: 'service_health',
          value: 0,
          unit: 'status',
          success: false,
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
          duration: Date.now() - startTime,
        });

        return {
          isHealthy: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    },

    async validateVectorStore(vectorStoreId: string): Promise<boolean> {
      try {
        const vectorStore = await service.getVectorStore(vectorStoreId);
        return (
          vectorStore.status === 'completed' ||
          vectorStore.status === 'in_progress'
        );
      } catch (_error) {
        return false;
      }
    },
  };

  return service;
}

// Singleton service
let openaiVectorStoreService: OpenAIVectorStoreService | null = null;

export async function getOpenAIVectorStoreService(): Promise<OpenAIVectorStoreService> {
  if (!openaiVectorStoreService) {
    openaiVectorStoreService = createOpenAIVectorStoreService();
  }
  return openaiVectorStoreService;
}
