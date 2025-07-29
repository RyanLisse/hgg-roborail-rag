import '@testing-library/jest-dom/vitest';
import { resolve } from 'node:path';
import dotenv from 'dotenv';
import { vi } from 'vitest';
import { mockRegistry } from './utils/mock-providers';
import { configUtils, TEST_CONFIG } from './utils/test-config';

// Load environment variables from .env.local first to get real DB credentials
dotenv.config({ path: resolve(__dirname, '../.env.local') });

// Setup global mocks early using centralized registry
mockRegistry.presets.unit();

// Set test environment AFTER loading .env.local so our database logic can see the real credentials
// but still detect test mode and skip connections
process.env.NODE_ENV = 'test';

// Create standardized test environment
configUtils.createTestEnv();

// Use actual environment variables from .env.local, with fallbacks for testing
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-test-openai-key';
process.env.ANTHROPIC_API_KEY =
  process.env.ANTHROPIC_API_KEY || 'test-anthropic-key';
process.env.GOOGLE_GENERATIVE_AI_API_KEY =
  process.env.GOOGLE_GENERATIVE_AI_API_KEY || 'test-google-key';
process.env.COHERE_API_KEY = process.env.COHERE_API_KEY || 'test-cohere-key';
process.env.GROQ_API_KEY = process.env.GROQ_API_KEY || 'test-groq-key';
process.env.XAI_API_KEY = process.env.XAI_API_KEY || 'test-xai-key';
process.env.AUTH_SECRET = process.env.AUTH_SECRET || 'test-auth-secret';
process.env.POSTGRES_URL =
  process.env.POSTGRES_URL || 'postgresql://test:test@localhost:5432/test';
process.env.NEON_DATABASE_URL =
  process.env.NEON_DATABASE_URL ||
  process.env.POSTGRES_URL ||
  'postgresql://test:test@localhost:5432/test';
process.env.BLOB_READ_WRITE_TOKEN =
  process.env.BLOB_READ_WRITE_TOKEN || 'test-blob-token';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.LANGCHAIN_API_KEY =
  process.env.LANGCHAIN_API_KEY || 'test-langchain-key';
process.env.LANGCHAIN_PROJECT = process.env.LANGCHAIN_PROJECT || 'test-project';
process.env.LANGCHAIN_TRACING_V2 = process.env.LANGCHAIN_TRACING_V2 || 'false';

// Mock next-auth using centralized mock registry
vi.mock('next-auth/react', () => mockRegistry.services.auth);

// Mock AI SDK functions for testing using proper mock implementation
vi.mock('ai', async () => {
  const actual = await vi.importActual('ai');
  const mockAI = await import('../lib/ai/providers.mock');
  return {
    ...actual,
    customProvider: mockAI.customProvider,
    extractReasoningMiddleware: mockAI.extractReasoningMiddleware,
    wrapLanguageModel: mockAI.wrapLanguageModel,
    ...mockRegistry.services.ai,
  };
});

// Mock AI SDK providers using centralized mock registry
vi.mock('@ai-sdk/openai', () => mockRegistry.providers.openai);
vi.mock('@ai-sdk/anthropic', () => mockRegistry.providers.anthropic);
vi.mock('@ai-sdk/google', () => mockRegistry.providers.google);
vi.mock('@ai-sdk/cohere', () => mockRegistry.providers.cohere);
vi.mock('@ai-sdk/groq', () => mockRegistry.providers.groq);

// Mock additional providers that might be used
vi.mock('@ai-sdk/xai', () => ({
  xai: vi.fn().mockImplementation(() => vi.fn()),
}));

// Mock Vercel AI SDK utilities
vi.mock('@ai-sdk/provider-utils', () => ({
  createLanguageModel: vi.fn(),
  createEmbeddingModel: vi.fn(),
}));

// Configure test timeouts globally using standardized config
vi.setConfig({
  testTimeout: TEST_CONFIG.timeouts.medium, // 15 seconds default timeout
  hookTimeout: TEST_CONFIG.timeouts.short, // 5 seconds for setup/teardown
});

// Global test utilities available to all tests
(global as any).testUtils = mockRegistry.utils;
(global as any).mockRegistry = mockRegistry;

// Enhanced error handling for tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit the process in tests, just log
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit the process in tests, just log
});

// Setup performance monitoring for tests
if (TEST_CONFIG.features.verbose) {
  const originalIt = (globalThis as any).it;
  (globalThis as any).it = (name: string, fn?: any, timeout?: number) => {
    return originalIt(
      name,
      async () => {
        const start = performance.now();
        try {
          await fn?.();
        } finally {
          const duration = performance.now() - start;
          if (duration > 1000) {
            // Log slow tests
            console.log(
              `⚠️  Slow test: "${name}" took ${duration.toFixed(2)}ms`,
            );
          }
        }
      },
      timeout,
    );
  };
}
