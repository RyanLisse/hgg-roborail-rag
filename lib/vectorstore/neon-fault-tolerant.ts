import 'server-only';

import {
  type NeonVectorStoreService,
  type NeonDocument,
  type NeonDocumentInsert,
  type NeonSearchRequest,
  type NeonSearchResult,
  createNeonVectorStoreService,
} from './neon';
import {
  type FaultTolerantService,
  FaultToleranceFactory,
  type ServiceProvider,
  FallbackMode,
} from './fault-tolerance';

// ====================================
// FAULT-TOLERANT NEON SERVICE
// ====================================

export class FaultTolerantNeonVectorStoreService {
  private baseService: NeonVectorStoreService;
  private faultTolerantService: FaultTolerantService<any>;

  constructor(baseService?: NeonVectorStoreService) {
    this.baseService = baseService || createNeonVectorStoreService();

    // Create fault-tolerant wrapper with Neon-specific configuration
    this.faultTolerantService = FaultToleranceFactory.createService('neon_vector_store', {
      enableRetry: true,
      enableCircuitBreaker: true,
      enableFallback: true,
      enableGracefulDegradation: true,
      retryConfig: {
        maxRetries: 3,
        baseDelayMs: 500, // Database operations can be faster
        maxDelayMs: 15000,
        backoffMultiplier: 2,
        jitterFactor: 0.1,
        timeoutMs: 30000,
      },
      circuitBreakerConfig: {
        failureThreshold: 5,
        recoveryTimeoutMs: 30000, // Faster recovery for database
        monitorWindowMs: 180000,
        minimumThroughput: 5,
        successThreshold: 2,
      },
      fallbackConfig: {
        mode: FallbackMode.GRACEFUL,
        enableCaching: true,
        cacheRetentionMs: 1800000, // 30 minutes for database results
        maxCacheSize: 2000,
        fallbackTimeoutMs: 5000,
        enablePartialResults: true,
        partialResultsThreshold: 0.3, // More lenient for database queries
      },
      healthCheckIntervalMs: 30000, // More frequent health checks for database
    });

    this.setupFallbackProviders();
  }

  // ====================================
  // FAULT-TOLERANT METHODS
  // ====================================

  async addDocument(document: NeonDocumentInsert): Promise<NeonDocument> {
    return this.faultTolerantService.execute(
      async () => {
        if (!this.baseService.isEnabled) {
          throw new Error('Neon vector store service is disabled');
        }
        return await this.baseService.addDocument(document);
      },
      {
        operationName: 'addDocument',
        requiredServiceLevel: 1, // Requires higher service level for writes
      }
    );
  }

  async addDocuments(documents: NeonDocumentInsert[]): Promise<NeonDocument[]> {
    return this.faultTolerantService.execute(
      async () => {
        if (!this.baseService.isEnabled) {
          throw new Error('Neon vector store service is disabled');
        }
        return await this.baseService.addDocuments(documents);
      },
      {
        operationName: 'addDocuments',
        requiredServiceLevel: 1, // Requires higher service level for bulk writes
      }
    );
  }

  async getDocument(id: string): Promise<NeonDocument | null> {
    const cacheKey = `document:${id}`;

    return this.faultTolerantService.execute(
      async () => {
        if (!this.baseService.isEnabled) {
          return null; // Graceful degradation
        }
        return await this.baseService.getDocument(id);
      },
      {
        operationName: 'getDocument',
        cacheKey,
        requiredServiceLevel: 3, // Can work in basic service mode
      }
    );
  }

  async updateDocument(id: string, document: Partial<NeonDocumentInsert>): Promise<NeonDocument> {
    return this.faultTolerantService.execute(
      async () => {
        if (!this.baseService.isEnabled) {
          throw new Error('Neon vector store service is disabled');
        }
        return await this.baseService.updateDocument(id, document);
      },
      {
        operationName: 'updateDocument',
        requiredServiceLevel: 1, // Requires higher service level for updates
      }
    );
  }

  async deleteDocument(id: string): Promise<boolean> {
    return this.faultTolerantService.execute(
      async () => {
        if (!this.baseService.isEnabled) {
          throw new Error('Neon vector store service is disabled');
        }
        return await this.baseService.deleteDocument(id);
      },
      {
        operationName: 'deleteDocument',
        requiredServiceLevel: 1, // Requires higher service level for deletes
      }
    );
  }

  async searchSimilar(request: NeonSearchRequest): Promise<NeonSearchResult[]> {
    const cacheKey = `search:${request.query}:${request.maxResults}:${request.threshold}`;

    return this.faultTolerantService.execute(
      async () => {
        if (!this.baseService.isEnabled) {
          return []; // Graceful degradation - return empty results
        }
        return await this.baseService.searchSimilar(request);
      },
      {
        operationName: 'searchSimilar',
        cacheKey,
        requiredServiceLevel: 2, // Can operate in reduced functionality mode
      }
    );
  }

  async searchSimilarByEmbedding(
    embedding: number[],
    maxResults = 10,
    threshold = 0.3
  ): Promise<NeonSearchResult[]> {
    const cacheKey = `embeddingSearch:${embedding.slice(0, 5).join(',')}:${maxResults}:${threshold}`;

    return this.faultTolerantService.execute(
      async () => {
        if (!this.baseService.isEnabled) {
          return []; // Graceful degradation
        }
        return await this.baseService.searchSimilarByEmbedding(embedding, maxResults, threshold);
      },
      {
        operationName: 'searchSimilarByEmbedding',
        cacheKey,
        requiredServiceLevel: 2,
      }
    );
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const cacheKey = `embedding:${text.slice(0, 50)}`;

    return this.faultTolerantService.execute(
      async () => {
        if (!this.baseService.isEnabled) {
          throw new Error('Neon vector store service is disabled');
        }
        return await this.baseService.generateEmbedding(text);
      },
      {
        operationName: 'generateEmbedding',
        cacheKey,
        requiredServiceLevel: 2, // Embedding generation is core functionality
      }
    );
  }

  async initializeExtensions(): Promise<void> {
    return this.faultTolerantService.execute(
      async () => {
        if (!this.baseService.isEnabled) {
          throw new Error('Neon vector store service is disabled');
        }
        return await this.baseService.initializeExtensions();
      },
      {
        operationName: 'initializeExtensions',
        requiredServiceLevel: 0, // Requires full service for initialization
        bypassRetry: true, // Extension initialization should not be retried
      }
    );
  }

  // ====================================
  // FALLBACK SEARCH WITH PROVIDERS
  // ====================================

  async searchWithFallback(request: NeonSearchRequest): Promise<NeonSearchResult[]> {
    const cacheKey = `searchWithFallback:${request.query}:${request.maxResults}:${request.threshold}`;

    return this.faultTolerantService.executeWithProviders(
      'search',
      [request],
      cacheKey
    );
  }

  // ====================================
  // BATCH OPERATIONS WITH FAULT TOLERANCE
  // ====================================

  async batchAddDocuments(
    documents: NeonDocumentInsert[],
    batchSize = 10
  ): Promise<NeonDocument[]> {
    const results: NeonDocument[] = [];
    const errors: Error[] = [];

    // Process in batches to avoid overwhelming the system
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);

      try {
        const batchResults = await this.faultTolerantService.execute(
          async () => {
            if (!this.baseService.isEnabled) {
              throw new Error('Neon vector store service is disabled');
            }
            return await this.baseService.addDocuments(batch);
          },
          {
            operationName: 'batchAddDocuments',
            requiredServiceLevel: 1,
          }
        );

        results.push(...batchResults);
      } catch (error) {
        console.error(`Batch ${i / batchSize + 1} failed:`, error);
        errors.push(error instanceof Error ? error : new Error(String(error)));

        // Continue with remaining batches even if one fails
        // This provides partial success behavior
      }
    }

    if (errors.length > 0 && results.length === 0) {
      // If all batches failed, throw the first error
      throw errors[0];
    }

    if (errors.length > 0) {
      console.warn(`${errors.length} out of ${Math.ceil(documents.length / batchSize)} batches failed`);
    }

    return results;
  }

  // ====================================
  // SERVICE MANAGEMENT
  // ====================================

  get isEnabled(): boolean {
    return this.baseService.isEnabled;
  }

  get db() {
    return this.baseService.db;
  }

  get embeddingModel(): string {
    return this.baseService.embeddingModel;
  }

  async healthCheck(): Promise<{
    isHealthy: boolean;
    databaseStatus?: string;
    error?: string;
  }> {
    return this.faultTolerantService.execute(
      async () => {
        if (!this.baseService.isEnabled) {
          return { isHealthy: false, error: 'Service disabled' };
        }

        // Perform a simple database health check
        try {
          await this.baseService.db.execute({ sql: 'SELECT 1' } as any);
          return { isHealthy: true, databaseStatus: 'Connected' };
        } catch (error) {
          return {
            isHealthy: false,
            error: error instanceof Error ? error.message : 'Database connection failed',
          };
        }
      },
      {
        operationName: 'healthCheck',
        bypassCircuitBreaker: true,
        bypassRetry: true,
      }
    );
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
    // Primary provider: Direct database operations
    const primaryProvider: ServiceProvider<NeonSearchResult[]> = {
      name: 'neon_primary',
      priority: 1,
      isAvailable: async () => {
        try {
          if (!this.baseService.isEnabled) return false;
          await this.baseService.db.execute({ sql: 'SELECT 1' } as any);
          return true;
        } catch {
          return false;
        }
      },
      execute: async (request: NeonSearchRequest) => {
        return await this.baseService.searchSimilar(request);
      },
      healthCheck: async () => {
        try {
          await this.baseService.db.execute({ sql: 'SELECT 1' } as any);
          return true;
        } catch {
          return false;
        }
      },
    };

    // Fallback provider: Direct embedding search (bypasses text-to-embedding step)
    const embeddingProvider: ServiceProvider<NeonSearchResult[]> = {
      name: 'neon_embedding_fallback',
      priority: 2,
      isAvailable: async () => {
        return this.baseService.isEnabled;
      },
      execute: async (request: NeonSearchRequest) => {
        // Generate embedding first, then search
        const embedding = await this.baseService.generateEmbedding(request.query);
        return await this.baseService.searchSimilarByEmbedding(
          embedding,
          request.maxResults,
          request.threshold
        );
      },
      fallbackValue: [] as NeonSearchResult[],
    };

    // Emergency provider: Return empty results
    const emergencyProvider: ServiceProvider<NeonSearchResult[]> = {
      name: 'neon_emergency',
      priority: 3,
      isAvailable: async () => true, // Always available
      execute: async (request: NeonSearchRequest) => {
        console.log(`🚨 Neon emergency mode: returning empty results for query: ${request.query}`);
        return [] as NeonSearchResult[];
      },
      fallbackValue: [] as NeonSearchResult[],
    };

    // Add providers to fallback manager
    this.faultTolerantService.addProvider(primaryProvider);
    this.faultTolerantService.addProvider(embeddingProvider);
    this.faultTolerantService.addProvider(emergencyProvider);
  }
}

// ====================================
// FACTORY FUNCTION
// ====================================

let faultTolerantNeonService: FaultTolerantNeonVectorStoreService | null = null;

export async function getFaultTolerantNeonVectorStoreService(): Promise<FaultTolerantNeonVectorStoreService> {
  if (!faultTolerantNeonService) {
    const baseService = createNeonVectorStoreService();
    faultTolerantNeonService = new FaultTolerantNeonVectorStoreService(baseService);

    // Initialize extensions if service is enabled
    if (baseService.isEnabled) {
      try {
        await faultTolerantNeonService.initializeExtensions();
      } catch (error) {
        console.warn('Failed to initialize Neon extensions with fault tolerance:', error);
      }
    }
  }
  return faultTolerantNeonService;
}

// Re-export types for convenience
export type {
  NeonDocument,
  NeonDocumentInsert,
  NeonSearchRequest,
  NeonSearchResult,
} from './neon';