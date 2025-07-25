import { vi } from 'vitest';
import '@testing-library/jest-dom';
import { resolve } from 'node:path';
import dotenv from 'dotenv';

// Load environment variables from .env.local first to get real DB credentials
dotenv.config({ path: resolve(__dirname, '../.env.local') });

// Mock server-only module to prevent client component errors in tests
vi.mock('server-only', () => ({}));

// Set test environment AFTER loading .env.local so our database logic can see the real credentials
// but still detect test mode and skip connections
process.env.NODE_ENV = 'test';

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

// Mock next-auth
vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({
    data: {
      user: {
        id: 'test-user',
        type: 'free',
      },
    },
  })),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock localStorage
Object.defineProperty(window, 'localStorage', {
  value: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
  writable: true,
});

// Mock crypto.randomUUID for jsdom environment
if (!global.crypto) {
  global.crypto = {} as any;
}
if (!global.crypto.randomUUID) {
  global.crypto.randomUUID = () =>
    `test-uuid-${Math.random().toString(36).substring(7)}`;
}

// Mock AI SDK functions for testing
vi.mock('ai', async () => {
  const actual = await vi.importActual('ai');
  return {
    ...actual,
    embed: vi.fn().mockResolvedValue({
      embedding: Array.from({ length: 1536 }, () => Math.random()),
    }),
    generateText: vi.fn().mockResolvedValue({
      text: 'This is a mocked response for testing purposes.',
      usage: {
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      },
    }),
    customProvider: vi.fn(),
    wrapLanguageModel: vi.fn(),
    extractReasoningMiddleware: vi.fn(),
  };
});

// Mock AI SDK providers
vi.mock('@ai-sdk/openai', () => ({
  openai: Object.assign(
    vi.fn().mockImplementation((modelId: string) => ({
      specificationVersion: 'v1',
      provider: 'openai',
      modelId,
      defaultObjectGenerationMode: 'json',
      supportsImageUrls: true,
      doGenerate: vi.fn(),
      doStream: vi.fn(),
    })),
    {
      textEmbeddingModel: vi.fn().mockImplementation(() => ({
        specificationVersion: 'v1',
        provider: 'openai',
        modelId: 'text-embedding-3-small',
        maxEmbeddingDimensions: 1536,
        doEmbed: async ({ values }: { values: string[] }) => ({
          embeddings: values.map(() =>
            Array.from({ length: 1536 }, () => Math.random()),
          ),
        }),
      })),
      responses: vi.fn().mockImplementation((modelId: string) => ({
        specificationVersion: 'v1',
        provider: 'openai',
        modelId,
        defaultObjectGenerationMode: 'json',
        supportsImageUrls: true,
        doGenerate: vi.fn(),
        doStream: vi.fn(),
      })),
      tools: {
        webSearchPreview: vi.fn().mockImplementation(() => ({})),
      },
    }
  ),
}));

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn().mockImplementation((modelId: string) => ({
    specificationVersion: 'v1',
    provider: 'anthropic',
    modelId,
    defaultObjectGenerationMode: 'json',
    supportsImageUrls: true,
    doGenerate: vi.fn(),
    doStream: vi.fn(),
  })),
}));

vi.mock('@ai-sdk/google', () => ({
  google: vi.fn().mockImplementation((modelId: string) => ({
    specificationVersion: 'v1',
    provider: 'google',
    modelId,
    defaultObjectGenerationMode: 'json',
    supportsImageUrls: true,
    doGenerate: vi.fn(),
    doStream: vi.fn(),
  })),
}));

vi.mock('@ai-sdk/cohere', () => ({
  cohere: vi.fn().mockImplementation(() => vi.fn()),
}));

vi.mock('@ai-sdk/groq', () => ({
  groq: vi.fn().mockImplementation(() => vi.fn()),
}));

// Mock OpenAI client
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    beta: {
      vectorStores: {
        create: vi.fn().mockResolvedValue({ id: 'vs_test' }),
        retrieve: vi.fn().mockResolvedValue({ id: 'vs_test', status: 'ready' }),
        update: vi.fn().mockResolvedValue({ id: 'vs_test' }),
        del: vi.fn().mockResolvedValue({}),
        fileBatches: {
          uploadAndPoll: vi.fn().mockResolvedValue({}),
        },
        files: {
          list: vi.fn().mockResolvedValue({ data: [] }),
          del: vi.fn().mockResolvedValue({}),
        },
      },
    },
    files: {
      create: vi.fn().mockResolvedValue({ id: 'file_test' }),
      del: vi.fn().mockResolvedValue({}),
    },
  })),
}));
