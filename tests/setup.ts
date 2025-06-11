import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock server-only module to prevent client component errors in tests
vi.mock('server-only', () => ({}));

// Mock environment variables for testing
process.env.NODE_ENV = 'test';
process.env.OPENAI_API_KEY = 'sk-test-openai-key';
process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-google-key';
process.env.COHERE_API_KEY = 'test-cohere-key';
process.env.GROQ_API_KEY = 'test-groq-key';
process.env.AUTH_SECRET = 'test-auth-secret';
process.env.POSTGRES_URL = 'postgresql://test:test@localhost:5432/test';

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
  openai: vi.fn().mockImplementation(() => vi.fn()),
}));

vi.mock('@ai-sdk/anthropic', () => ({
  anthropic: vi.fn().mockImplementation(() => vi.fn()),
}));

vi.mock('@ai-sdk/google', () => ({
  google: vi.fn().mockImplementation(() => vi.fn()),
}));

vi.mock('@ai-sdk/cohere', () => ({
  cohere: vi.fn().mockImplementation(() => vi.fn()),
}));

vi.mock('@ai-sdk/groq', () => ({
  groq: vi.fn().mockImplementation(() => vi.fn()),
}));