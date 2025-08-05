import 'server-only';

import {
  FallbackMode,
  FaultToleranceFactory,
  type FaultTolerantService,
  type ServiceProvider,
} from './fault-tolerance';
import {
  createSupabaseVectorStoreService,
  type SupabaseDocument,
  type SupabaseDocumentInsert,
  type SupabaseSearchRequest,
  type SupabaseSearchResult,
  type SupabaseVectorStoreService,
} from './supabase';

// ====================================
// FAULT-TOLERANT SUPABASE SERVICE
// ====================================

export class FaultTolerantSupabaseVectorStoreService {
  private baseService: SupabaseVectorStoreService;
  private faultTolerantService: FaultTolerantService<any>;

  constructor(baseService?: SupabaseVectorStoreService) {
    this.baseService = baseService || createSupabaseVectorStoreService();

    // Create fault-tolerant wrapper with Supabase-specific configuration
    this.faultTolerantService = FaultToleranceFactory.createService(
      'supabase_vector_store',
      {
        enableRetry: true,
        enableCircuitBreaker: true,
        enableFallback: true,
        enableGracefulDegradation: true,
        retryConfig: {
          maxRetries: 3,
          baseDelayMs: 500, // Database operations can be faster
          maxDelayMs: 15_000,
          backoffMultiplier: 2,
          jitterFactor: 0.1,
          timeoutMs: 30_000,
        },
        circuitBreakerConfig: {
          failureThreshold: 5,
          recoveryTimeoutMs: 30_000, // Faster recovery for database
          monitorWindowMs: 180_000,
          minimumThroughput: 5,
          successThreshold: 2,
        },
        fallbackConfig: {
          mode: FallbackMode.GRACEFUL,
          enableCaching: true,
          cacheRetentionMs: 1_800_000, // 30 minutes for database results
          maxCacheSize: 2000,
          fallbackTimeoutMs: 5000,
          enablePartialResults: true,
          partialResultsThreshold: 0.3, // More lenient for database queries
        },
        healthCheckIntervalMs: 30_000, // More frequent health checks for database
      },
    );

    this.setupFallbackProviders();
  }

  // ====================================
  // FAULT-TOLERANT METHODS
  // ====================================

  async addDocument(document: SupabaseDocumentInsert): Promise<SupabaseDocument> {
    return this.faultTolerantService.execute(
      async () => {
        if (!this.baseService.isEnabled) {
          throw new Error('Supabase vector store service is disabled');
        }
        return await this.baseService.addDocument(document);
      },
      {
        operationName: 'addDocument',
        requiredServiceLevel: 1, // Requires higher service level for writes
      },
    );
  }

  async addDocuments(documents: SupabaseDocumentInsert[]): Promise<SupabaseDocument[]> {
    return this.faultTolerantService.execute(
      async () => {
        if (!this.baseService.isEnabled) {
          throw new Error('Supabase vector store service is disabled');
        }
        return await this.baseService.addDocuments(documents);
      },
      {
        operationName: 'addDocuments',
        requiredServiceLevel: 1, // Requires higher service level for bulk writes
      },
    );
  }

  async getDocument(id: string): Promise<SupabaseDocument | null> {
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
      },
    );
  }

  async updateDocument(
    id: string,
    document: Partial<SupabaseDocumentInsert>,
  ): Promise<SupabaseDocument> {
    return this.faultTolerantService.execute(
      async () => {
        if (!this.baseService.isEnabled) {
          throw new Error('Supabase vector store service is disabled');
        }
        return await this.baseService.updateDocument(id, document);
      },
      {
        operationName: 'updateDocument',
        requiredServiceLevel: 1, // Requires higher service level for updates
      },
    );
  }

  async deleteDocument(id: string): Promise<boolean> {
    return this.faultTolerantService.execute(
      async () => {
        if (!this.baseService.isEnabled) {
          throw new Error('Supabase vector store service is disabled');
        }
        return await this.baseService.deleteDocument(id);
      },
      {
        operationName: 'deleteDocument',
        requiredServiceLevel: 1, // Requires higher service level for deletes
      },
    );
  }

  async searchSimilar(request: SupabaseSearchRequest): Promise<SupabaseSearchResult[]> {
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
      },
    );
  }

  async searchSimilarByEmbedding(
    embedding: number[],
    maxResults = 10,
    threshold = 0.3,
  ): Promise<SupabaseSearchResult[]> {
    const cacheKey = `embeddingSearch:${embedding.slice(0, 5).join(',')}:${maxResults}:${threshold}`;

    return this.faultTolerantService.execute(
      async () => {
        if (!this.baseService.isEnabled) {
          return []; // Graceful degradation
        }
        return await this.baseService.searchSimilarByEmbedding(
          embedding,
          maxResults,
          threshold,
        );
      },
      {
        operationName: 'searchSimilarByEmbedding',
        cacheKey,
        requiredServiceLevel: 2,
      },
    );
  }

  async generateEmbedding(text: string): Promise<number[]> {
    const cacheKey = `embedding:${text.slice(0, 50)}`;

    return this.faultTolerantService.execute(
      async () => {
        if (!this.baseService.isEnabled) {
          throw new Error('Supabase vector store service is disabled');
        }
        return await this.baseService.generateEmbedding(text);
      },
      {
        operationName: 'generateEmbedding',
        cacheKey,
        requiredServiceLevel: 2, // Embedding generation is core functionality
      },
    );
  }

  async initializeExtensions(): Promise<void> {
    return this.faultTolerantService.execute(
      async () => {
        if (!this.baseService.isEnabled) {
          throw new Error('Supabase vector store service is disabled');
        }
        return await this.baseService.initializeExtensions();
      },
      {
        operationName: 'initializeExtensions',
        requiredServiceLevel: 0, // Requires full service for initialization
        bypassRetry: true, // Extension initialization should not be retried
      },
    );
  }

  // ====================================
  // FALLBACK SEARCH WITH PROVIDERS
  // ====================================

  async searchWithFallback(
    request: SupabaseSearchRequest,
  ): Promise<SupabaseSearchResult[]> {
    const cacheKey = `searchWithFallback:${request.query}:${request.maxResults}:${request.threshold}`;

    return this.faultTolerantService.executeWithProviders(
      'search',
      [request],
      cacheKey,
    );
  }

  // ====================================
  // BATCH OPERATIONS WITH FAULT TOLERANCE
  // ====================================

  async batchAddDocuments(
    documents: SupabaseDocumentInsert[],
    batchSize = 10,
  ): Promise<SupabaseDocument[]> {
    const results: SupabaseDocument[] = [];
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
          },
        );

        results.push(...batchResults);
      } catch (error) {
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

  get client() {
    return this.baseService.client;
  }

  async getStats(): Promise<{
    totalDocuments: number;
    lastUpdated: Date;
  }> {
    return this.faultTolerantService.execute(
      async () => {
        if (!this.baseService.isEnabled) {
          return { totalDocuments: 0, lastUpdated: new Date() };
        }
        return await this.baseService.getStats();
      },
      {
        operationName: 'getStats',
        requiredServiceLevel: 3,
      },
    );
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
          await this.baseService.db.from('documents').select('count').limit(1);
          return { isHealthy: true, databaseStatus: 'Connected' };
        } catch (error) {
          return {
            isHealthy: false,
            error:
              error instanceof Error
                ? error.message
                : 'Database connection failed',
          };
        }
      },
      {
        operationName: 'healthCheck',
        bypassCircuitBreaker: true,
        bypassRetry: true,
      },
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
    const primaryProvider: ServiceProvider<SupabaseSearchResult[]> = {
      name: 'supabase_primary',
      priority: 1,
      isAvailable: async () => {
        try {
          if (!this.baseService.isEnabled) {
            return false;
          }
          await this.baseService.db.from('documents').select('count').limit(1);
          return true;
        } catch {
          return false;
        }
      },
      execute: async (request: SupabaseSearchRequest) => {
        return await this.baseService.searchSimilar(request);
      },
      healthCheck: async () => {
        try {
          await this.baseService.db.from('documents').select('count').limit(1);
          return true;
        } catch {
          return false;
        }
      },
    };

    // Fallback provider: Direct embedding search (bypasses text-to-embedding step)
    const embeddingProvider: ServiceProvider<SupabaseSearchResult[]> = {
      name: 'supabase_embedding_fallback',
      priority: 2,
      isAvailable: async () => {
        return this.baseService.isEnabled;
      },
      execute: async (request: SupabaseSearchRequest) => {
        // Generate embedding first, then search
        const embedding = await this.baseService.generateEmbedding(
          request.query,
        );
        return await this.baseService.searchSimilarByEmbedding(
          embedding,
          request.maxResults,
          request.threshold,
        );
      },
      fallbackValue: [] as SupabaseSearchResult[],
    };

    // Emergency provider: Return empty results
    const emergencyProvider: ServiceProvider<SupabaseSearchResult[]> = {
      name: 'supabase_emergency',
      priority: 3,
      isAvailable: async () => true, // Always available
      execute: async (_request: SupabaseSearchRequest) => {
        return [] as SupabaseSearchResult[];
      },
      fallbackValue: [] as SupabaseSearchResult[],
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

let faultTolerantSupabaseService: FaultTolerantSupabaseVectorStoreService | null = null;

export async function getFaultTolerantSupabaseVectorStoreService(): Promise<FaultTolerantSupabaseVectorStoreService> {
  if (!faultTolerantSupabaseService) {
    const baseService = createSupabaseVectorStoreService();
    faultTolerantSupabaseService = new FaultTolerantSupabaseVectorStoreService(
      baseService,
    );

    // Initialize extensions if service is enabled and not in test mode
    const isTestMode =
      process.env.NODE_ENV === 'test' || process.env.PLAYWRIGHT === 'true';
    if (baseService.isEnabled && !isTestMode) {
      try {
        await faultTolerantSupabaseService.initializeExtensions();
      } catch (_error) {}
    } else if (isTestMode) {
    }
  }
  return faultTolerantSupabaseService;
}

// Re-export types for convenience
export type {
  SupabaseDocument,
  SupabaseDocumentInsert,
  SupabaseSearchRequest,
  SupabaseSearchResult,
} from './supabase';
