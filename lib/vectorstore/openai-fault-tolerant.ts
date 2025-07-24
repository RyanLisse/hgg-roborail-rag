import 'server-only';

import {
  FallbackMode,
  FaultToleranceFactory,
  type FaultTolerantService,
  type ServiceProvider,
} from './fault-tolerance';
import {
  createOpenAIVectorStoreService,
  type FileUploadRequest,
  type OpenAIVectorStoreService,
  type SearchRequest,
  type SearchResponse,
  type VectorStore,
  type VectorStoreFile,
} from './openai';

// ====================================
// FAULT-TOLERANT OPENAI SERVICE
// ====================================

export class FaultTolerantOpenAIVectorStoreService {
  private baseService: OpenAIVectorStoreService;
  private faultTolerantService: FaultTolerantService<any>;

  constructor(baseService?: OpenAIVectorStoreService) {
    this.baseService = baseService || createOpenAIVectorStoreService();

    // Create fault-tolerant wrapper
    this.faultTolerantService = FaultToleranceFactory.createService(
      'openai_vector_store',
      {
        enableRetry: true,
        enableCircuitBreaker: true,
        enableFallback: true,
        enableGracefulDegradation: true,
        retryConfig: {
          maxRetries: 3,
          baseDelayMs: 1000,
          maxDelayMs: 30_000,
          backoffMultiplier: 2,
          jitterFactor: 0.1,
          timeoutMs: 60_000,
        },
        circuitBreakerConfig: {
          failureThreshold: 5,
          recoveryTimeoutMs: 60_000,
          monitorWindowMs: 300_000,
          minimumThroughput: 10,
          successThreshold: 3,
        },
        fallbackConfig: {
          mode: FallbackMode.GRACEFUL,
          enableCaching: true,
          cacheRetentionMs: 3_600_000, // 1 hour
          maxCacheSize: 1000,
          fallbackTimeoutMs: 10_000,
          enablePartialResults: true,
          partialResultsThreshold: 0.5,
        },
        healthCheckIntervalMs: 60_000,
      },
    );

    this.setupFallbackProviders();
  }

  // ====================================
  // FAULT-TOLERANT METHODS
  // ====================================

  async searchFiles(request: SearchRequest): Promise<SearchResponse> {
    const cacheKey = `search:${request.query}:${request.maxResults}:${request.vectorStoreId}`;

    return this.faultTolerantService.execute(
      async () => {
        if (!this.baseService.isEnabled) {
          throw new Error('OpenAI vector store service is disabled');
        }
        return await this.baseService.searchFiles(request);
      },
      {
        operationName: 'searchFiles',
        cacheKey,
        requiredServiceLevel: 2, // Can operate in reduced functionality mode
      },
    );
  }

  async searchWithRetry(
    request: SearchRequest,
    maxRetries = 3,
  ): Promise<SearchResponse> {
    const cacheKey = `search_retry:${request.query}:${request.maxResults}:${request.vectorStoreId}:${maxRetries}`;

    return this.faultTolerantService.execute(
      async () => {
        if (!this.baseService.isEnabled) {
          throw new Error('OpenAI vector store service is disabled');
        }
        return await this.baseService.searchWithRetry(request, maxRetries);
      },
      {
        operationName: 'searchWithRetry',
        cacheKey,
        requiredServiceLevel: 2, // Can operate in reduced functionality mode
      },
    );
  }

  async uploadFile(
    request: FileUploadRequest,
    vectorStoreId?: string,
  ): Promise<VectorStoreFile> {
    return this.faultTolerantService.execute(
      async () => {
        if (!this.baseService.isEnabled) {
          throw new Error('OpenAI vector store service is disabled');
        }
        return await this.baseService.uploadFile(request, vectorStoreId);
      },
      {
        operationName: 'uploadFile',
        requiredServiceLevel: 1, // Requires higher service level
        bypassRetry: false, // Allow retries for uploads
      },
    );
  }

  async listFiles(vectorStoreId?: string): Promise<VectorStoreFile[]> {
    const cacheKey = `listFiles:${vectorStoreId || 'default'}`;

    return this.faultTolerantService.execute(
      async () => {
        if (!this.baseService.isEnabled) {
          return []; // Graceful degradation - return empty list
        }
        return await this.baseService.listFiles(vectorStoreId);
      },
      {
        operationName: 'listFiles',
        cacheKey,
        requiredServiceLevel: 3, // Can work in basic service mode
      },
    );
  }

  async deleteFile(fileId: string, vectorStoreId?: string): Promise<boolean> {
    return this.faultTolerantService.execute(
      async () => {
        if (!this.baseService.isEnabled) {
          throw new Error('OpenAI vector store service is disabled');
        }
        return await this.baseService.deleteFile(fileId, vectorStoreId);
      },
      {
        operationName: 'deleteFile',
        requiredServiceLevel: 1, // Requires higher service level
      },
    );
  }

  async createVectorStore(
    name: string,
    metadata?: Record<string, string>,
  ): Promise<VectorStore> {
    return this.faultTolerantService.execute(
      async () => {
        if (!this.baseService.isEnabled) {
          throw new Error('OpenAI vector store service is disabled');
        }
        return await this.baseService.createVectorStore(name, metadata);
      },
      {
        operationName: 'createVectorStore',
        requiredServiceLevel: 0, // Requires full service
      },
    );
  }

  async getVectorStore(vectorStoreId: string): Promise<VectorStore> {
    const cacheKey = `vectorStore:${vectorStoreId}`;

    return this.faultTolerantService.execute(
      async () => {
        if (!this.baseService.isEnabled) {
          throw new Error('OpenAI vector store service is disabled');
        }
        return await this.baseService.getVectorStore(vectorStoreId);
      },
      {
        operationName: 'getVectorStore',
        cacheKey,
        requiredServiceLevel: 2,
      },
    );
  }

  async listVectorStores(): Promise<VectorStore[]> {
    const cacheKey = 'vectorStores:list';

    return this.faultTolerantService.execute(
      async () => {
        if (!this.baseService.isEnabled) {
          return []; // Graceful degradation
        }
        return await this.baseService.listVectorStores();
      },
      {
        operationName: 'listVectorStores',
        cacheKey,
        requiredServiceLevel: 3,
      },
    );
  }

  async deleteVectorStore(vectorStoreId: string): Promise<boolean> {
    return this.faultTolerantService.execute(
      async () => {
        if (!this.baseService.isEnabled) {
          throw new Error('OpenAI vector store service is disabled');
        }
        return await this.baseService.deleteVectorStore(vectorStoreId);
      },
      {
        operationName: 'deleteVectorStore',
        requiredServiceLevel: 0, // Requires full service
      },
    );
  }

  async healthCheck(): Promise<{
    isHealthy: boolean;
    vectorStoreStatus?: string;
    error?: string;
  }> {
    return this.faultTolerantService.execute(
      async () => {
        if (!this.baseService.isEnabled) {
          return { isHealthy: false, error: 'Service disabled' };
        }
        return await this.baseService.healthCheck();
      },
      {
        operationName: 'healthCheck',
        bypassCircuitBreaker: true, // Don't let circuit breaker block health checks
        bypassRetry: true, // Health checks should be fast
      },
    );
  }

  async validateVectorStore(vectorStoreId: string): Promise<boolean> {
    return this.faultTolerantService.execute(
      async () => {
        if (!this.baseService.isEnabled) {
          return false;
        }
        return await this.baseService.validateVectorStore(vectorStoreId);
      },
      {
        operationName: 'validateVectorStore',
        requiredServiceLevel: 2,
      },
    );
  }

  async getSourceFiles(
    fileIds: string[],
  ): Promise<Array<{ id: string; name: string; url?: string }>> {
    const cacheKey = `sourceFiles:${fileIds.join(',')}`;

    return this.faultTolerantService.execute(
      async () => {
        if (!this.baseService.isEnabled) {
          return []; // Graceful degradation
        }
        return await this.baseService.getSourceFiles(fileIds);
      },
      {
        operationName: 'getSourceFiles',
        cacheKey,
        requiredServiceLevel: 3,
      },
    );
  }

  // ====================================
  // FALLBACK SEARCH WITH PROVIDERS
  // ====================================

  async searchWithFallback(request: SearchRequest): Promise<SearchResponse> {
    const cacheKey = `searchWithFallback:${request.query}:${request.maxResults}`;

    return this.faultTolerantService.executeWithProviders(
      'search',
      [request],
      cacheKey,
    );
  }

  // ====================================
  // SERVICE MANAGEMENT
  // ====================================

  get isEnabled(): boolean {
    return this.baseService.isEnabled;
  }

  get client() {
    return this.baseService.client;
  }

  get defaultVectorStoreId() {
    return this.baseService.defaultVectorStoreId;
  }

  getFileSearchTool(vectorStoreId?: string): any {
    if (!this.baseService.isEnabled) {
      return null;
    }
    return this.baseService.getFileSearchTool(vectorStoreId);
  }

  async getSystemHealth() {
    return this.faultTolerantService.healthCheck();
  }

  getMetrics() {
    return this.faultTolerantService.getMetrics();
  }

  reset() {
    this.faultTolerantService.reset();
  }

  // ====================================
  // PRIVATE SETUP METHODS
  // ====================================

  private setupFallbackProviders(): void {
    // Primary provider: Direct OpenAI API
    const primaryProvider: ServiceProvider<SearchResponse> = {
      name: 'openai_primary',
      priority: 1,
      isAvailable: async () => {
        try {
          if (!this.baseService.isEnabled) { return false; }
          const health = await this.baseService.healthCheck();
          return health.isHealthy;
        } catch {
          return false;
        }
      },
      execute: async (request: SearchRequest) => {
        return await this.baseService.searchFiles(request);
      },
      healthCheck: async () => {
        const health = await this.baseService.healthCheck();
        return health.isHealthy;
      },
    };

    // Fallback provider: Search with retry mechanism
    const retryProvider: ServiceProvider<SearchResponse> = {
      name: 'openai_retry',
      priority: 2,
      isAvailable: async () => {
        return this.baseService.isEnabled;
      },
      execute: async (request: SearchRequest) => {
        return await this.baseService.searchWithRetry(request, 2); // Reduced retries for fallback
      },
      fallbackValue: {
        success: false,
        message: 'Search temporarily unavailable',
        results: [],
        sources: [],
        totalResults: 0,
        query: '',
        executionTime: 0,
      } as SearchResponse,
    };

    // Emergency provider: Return empty results
    const emergencyProvider: ServiceProvider<SearchResponse> = {
      name: 'openai_emergency',
      priority: 3,
      isAvailable: async () => true, // Always available
      execute: async (request: SearchRequest) => {
        return {
          success: true,
          message:
            'Service temporarily degraded - returning cached/limited results',
          results: [],
          sources: [],
          totalResults: 0,
          query: request.query,
          executionTime: 0,
        } as SearchResponse;
      },
      fallbackValue: {
        success: true,
        message: 'Service unavailable',
        results: [],
        sources: [],
        totalResults: 0,
        query: '',
        executionTime: 0,
      } as SearchResponse,
    };

    // Add providers to fallback manager
    this.faultTolerantService.addProvider(primaryProvider);
    this.faultTolerantService.addProvider(retryProvider);
    this.faultTolerantService.addProvider(emergencyProvider);
  }
}

// ====================================
// FACTORY FUNCTION
// ====================================

let faultTolerantOpenAIService: FaultTolerantOpenAIVectorStoreService | null =
  null;

export function getFaultTolerantOpenAIVectorStoreService(): FaultTolerantOpenAIVectorStoreService {
  if (!faultTolerantOpenAIService) {
    const baseService = createOpenAIVectorStoreService();
    faultTolerantOpenAIService = new FaultTolerantOpenAIVectorStoreService(
      baseService,
    );
  }
  return faultTolerantOpenAIService;
}

// Re-export types for convenience
export type {
  FileUploadRequest,
  SearchRequest,
  SearchResponse,
  VectorStore,
  VectorStoreFile,
} from './openai';
