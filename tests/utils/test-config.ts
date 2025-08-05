/**
 * Test configuration and constants
 * Centralized configuration for consistent test behavior across the project
 */

// Test environment configuration
export const TEST_CONFIG = {
  // Timeout configurations (in milliseconds)
  timeouts: {
    short: 5000, // 5 seconds - for quick operations
    medium: 15_000, // 15 seconds - for API calls
    long: 30_000, // 30 seconds - for complex operations
    extended: 60_000, // 60 seconds - for integration tests
  },

  // Retry configurations
  retries: {
    default: 3,
    network: 5,
    flaky: 10,
  },

  // Test data limits
  limits: {
    maxMessageLength: 10_000,
    maxFileSize: 10 * 1024 * 1024, // 10MB
    maxConcurrentRequests: 10,
    batchSize: 100,
  },

  // Mock response delays (for realistic testing)
  delays: {
    api: 100, // 100ms for API responses
    database: 50, // 50ms for database operations
    network: 200, // 200ms for network requests
    ai: 1000, // 1s for AI operations
  },

  // Feature flags for conditional testing
  features: {
    enableRealDatabase: process.env.TEST_REAL_DB === 'true',
    enableNetworkTests: process.env.TEST_NETWORK === 'true',
    enableAITests: process.env.TEST_AI === 'true',
    enableE2ETests: process.env.TEST_E2E === 'true',
    verbose: process.env.TEST_VERBOSE === 'true',
  },

  // Test data patterns
  patterns: {
    uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    timestamp: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/,
    apiKey: /^sk-[a-zA-Z0-9]{48}$/,
  },
};

// Common test constants
export const TEST_CONSTANTS = {
  // User types
  userTypes: ['free', 'pro', 'premium'] as const,

  // Message roles
  messageRoles: ['user', 'assistant', 'system'] as const,

  // AI providers
  aiProviders: ['openai', 'anthropic', 'google', 'cohere', 'groq'] as const,

  // File types
  supportedFileTypes: [
    '.pdf',
    '.txt',
    '.md',
    '.docx',
    '.png',
    '.jpg',
    '.jpeg',
  ] as const,

  // HTTP status codes
  httpStatus: {
    ok: 200,
    created: 201,
    noContent: 204,
    badRequest: 400,
    unauthorized: 401,
    forbidden: 403,
    notFound: 404,
    conflict: 409,
    unprocessableEntity: 422,
    tooManyRequests: 429,
    internalServerError: 500,
    badGateway: 502,
    serviceUnavailable: 503,
  },

  // Error codes
  errorCodes: {
    badRequest: 'bad_request:api',
    unauthorized: 'unauthorized:auth',
    forbidden: 'forbidden:chat',
    notFound: 'not_found:resource',
    rateLimited: 'rate_limited:api',
    serverError: 'server_error:internal',
  },

  // Vector store configurations
  vectorStore: {
    dimensions: 1536,
    topK: 10,
    similarityThreshold: 0.7,
    maxChunkSize: 1000,
  },

  // Database table names
  tables: {
    users: 'users',
    chats: 'chats',
    messages: 'messages',
    documents: 'documents',
    embeddings: 'embeddings',
    sessions: 'sessions',
  },

  // API endpoints
  endpoints: {
    chat: '/api/chat',
    upload: '/api/vectorstore/supabase-upload',
    search: '/api/vectorstore/supabase-search',
    monitoring: '/api/vectorstore/monitoring',
    benchmarks: '/api/vectorstore/benchmarks',
    auth: '/api/auth',
  },

  // Test selectors (for UI testing)
  selectors: {
    chatInput: '[data-testid="multimodal-input"]',
    sendButton: '[data-testid="send-button"]',
    fileInput: 'input[type="file"]',
    attachButton: '[data-testid="attachments-button"]',
    messageContent: '.message-content',
    loading: '[data-testid="loading"]',
    error: '[data-testid="error"]',
  },
};

// Environment-specific configurations
export const ENV_CONFIG = {
  test: {
    database: {
      url:
        process.env.TEST_DATABASE_URL ||
        'postgresql://test:test@localhost:5432/test_db',
      maxConnections: 5,
    },
    redis: {
      url: process.env.TEST_REDIS_URL || 'redis://localhost:6379/1',
    },
    ai: {
      mockResponses: true,
      timeout: TEST_CONFIG.timeouts.medium,
    },
  },

  development: {
    database: {
      url: process.env.POSTGRES_URL,
      maxConnections: 10,
    },
    redis: {
      url: process.env.REDIS_URL,
    },
    ai: {
      mockResponses: false,
      timeout: TEST_CONFIG.timeouts.long,
    },
  },

  production: {
    database: {
      url: process.env.POSTGRES_URL,
      maxConnections: 20,
    },
    redis: {
      url: process.env.REDIS_URL,
    },
    ai: {
      mockResponses: false,
      timeout: TEST_CONFIG.timeouts.extended,
    },
  },
};

// Test utilities for configuration
export const configUtils = {
  // Get current environment configuration
  getCurrentConfig: () => {
    const env = process.env.NODE_ENV || 'development';
    return ENV_CONFIG[env as keyof typeof ENV_CONFIG] || ENV_CONFIG.development;
  },

  // Check if feature is enabled
  isFeatureEnabled: (feature: keyof typeof TEST_CONFIG.features) => {
    return TEST_CONFIG.features[feature];
  },

  // Get timeout for operation type
  getTimeout: (type: keyof typeof TEST_CONFIG.timeouts) => {
    return TEST_CONFIG.timeouts[type];
  },

  // Get retry count for operation type
  getRetries: (type: keyof typeof TEST_CONFIG.retries) => {
    return TEST_CONFIG.retries[type];
  },

  // Validate test data against patterns
  validatePattern: (
    value: string,
    pattern: keyof typeof TEST_CONFIG.patterns,
  ) => {
    return TEST_CONFIG.patterns[pattern].test(value);
  },

  // Create test environment variables
  createTestEnv: (overrides: Record<string, string> = {}) => {
    const baseEnv = {
      NODE_ENV: 'test',
      OPENAI_API_KEY: 'sk-test-openai-key',
      ANTHROPIC_API_KEY: 'test-anthropic-key',
      GOOGLE_GENERATIVE_AI_API_KEY: 'test-google-key',
      COHERE_API_KEY: 'test-cohere-key',
      GROQ_API_KEY: 'test-groq-key',
      XAI_API_KEY: 'test-xai-key',
      AUTH_SECRET: 'test-auth-secret',
      POSTGRES_URL: 'postgresql://test:test@localhost:5432/test',
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon-key',
      BLOB_READ_WRITE_TOKEN: 'test-blob-token',
      REDIS_URL: 'redis://localhost:6379',
      LANGCHAIN_API_KEY: 'test-langchain-key',
      LANGCHAIN_PROJECT: 'test-project',
      LANGCHAIN_TRACING_V2: 'false',
      ...overrides,
    };

    // Apply environment variables
    Object.entries(baseEnv).forEach(([key, value]) => {
      process.env[key] = value;
    });

    return baseEnv;
  },

  // Reset environment to original state
  resetEnv: (originalEnv: Record<string, string | undefined>) => {
    Object.entries(originalEnv).forEach(([key, value]) => {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    });
  },
};

// Performance testing utilities
export const performanceUtils = {
  // Measure execution time
  measureTime: async <T>(
    fn: () => Promise<T>,
  ): Promise<{ result: T; duration: number }> => {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    return { result, duration };
  },

  // Create performance thresholds
  createThresholds: (baseTime: number) => ({
    fast: baseTime * 0.5,
    normal: baseTime,
    slow: baseTime * 2,
    timeout: baseTime * 5,
  }),

  // Memory usage monitoring
  getMemoryUsage: () => {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage();
    }
    return null;
  },
};

// Export default configuration object
export default {
  config: TEST_CONFIG,
  constants: TEST_CONSTANTS,
  env: ENV_CONFIG,
  utils: configUtils,
  performance: performanceUtils,
};
