import { vi } from 'vitest';
import {
  createMockAIResponse,
  createMockAPIResponse,
  createMockEmbedding,
  createMockSession,
  createMockUser,
} from './mock-factories';

/**
 * Centralized mock providers for consistent testing
 * This file provides reusable mocks that can be imported across test files
 * Enhanced with factory functions for better type safety and consistency
 */

// Mock AI SDK providers
export const mockOpenAI = {
  openai: vi.fn().mockImplementation(() => vi.fn()),
};

export const mockAnthropic = {
  anthropic: vi.fn().mockImplementation(() => vi.fn()),
};

export const mockGoogle = {
  google: vi.fn().mockImplementation(() => vi.fn()),
};

export const mockCohere = {
  cohere: vi.fn().mockImplementation(() => vi.fn()),
};

export const mockGroq = {
  groq: vi.fn().mockImplementation(() => vi.fn()),
};

// Mock AI SDK core functions with factory integration
export const mockAICore = {
  embed: vi
    .fn()
    .mockImplementation(() => Promise.resolve(createMockEmbedding())),
  generateText: vi
    .fn()
    .mockImplementation(() => Promise.resolve(createMockAIResponse())),
  customProvider: vi.fn().mockImplementation((config: any) => ({
    languageModels: config.languageModels || {},
    textEmbeddingModels: config.textEmbeddingModels || {},
  })),
  wrapLanguageModel: vi.fn().mockImplementation((config: any) => config.model),
  extractReasoningMiddleware: vi.fn().mockReturnValue({}),
  streamText: vi.fn().mockImplementation(function* () {
    yield { type: 'text-delta', textDelta: 'Hello' };
    yield { type: 'text-delta', textDelta: ' world' };
    yield {
      type: 'finish',
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 2, totalTokens: 12 },
    };
  }),
  generateObject: vi.fn().mockResolvedValue({
    object: { test: true },
    usage: { promptTokens: 50, completionTokens: 25, totalTokens: 75 },
  }),
};

// Mock Next.js specific modules with factory integration
export const mockNextAuth = {
  useSession: vi.fn(() => createMockSession()),
  SessionProvider: ({ children }: { children: React.ReactNode }) => children,
  signIn: vi
    .fn()
    .mockResolvedValue({ ok: true, status: 200, url: '/dashboard' }),
  signOut: vi
    .fn()
    .mockResolvedValue({ ok: true, status: 200, url: '/auth/signin' }),
  getSession: vi.fn(() => Promise.resolve(createMockSession().data)),
  getServerSession: vi.fn(() => Promise.resolve(createMockSession().data)),
};

// Mock database operations
export const mockDatabase = {
  query: vi.fn().mockResolvedValue({ rows: [] }),
  insert: vi.fn().mockResolvedValue({ insertId: 1 }),
  update: vi.fn().mockResolvedValue({ affectedRows: 1 }),
  delete: vi.fn().mockResolvedValue({ affectedRows: 1 }),
};

// Mock vector store operations
export const mockVectorStore = {
  search: vi.fn().mockResolvedValue([]),
  upsert: vi.fn().mockResolvedValue(true),
  delete: vi.fn().mockResolvedValue(true),
  similarity: vi.fn().mockResolvedValue(0.85),
};

// Mock Redis operations
export const mockRedis = {
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue('OK'),
  del: vi.fn().mockResolvedValue(1),
  exists: vi.fn().mockResolvedValue(0),
  expire: vi.fn().mockResolvedValue(1),
};

// Mock file operations
export const mockBlob = {
  put: vi.fn().mockResolvedValue({ url: 'https://example.com/file' }),
  del: vi.fn().mockResolvedValue(undefined),
  head: vi.fn().mockResolvedValue({ size: 1024 }),
  list: vi.fn().mockResolvedValue({ blobs: [] }),
};

// Mock Web APIs with factory integration
export const mockWebAPIs = {
  fetch: vi
    .fn()
    .mockImplementation((url: string, options?: RequestInit) =>
      Promise.resolve(createMockAPIResponse({}, { status: 200 })),
    ),
  crypto: {
    randomUUID: () => `test-uuid-${Math.random().toString(36).substring(7)}`,
    getRandomValues: vi.fn((array: Uint8Array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    }),
  },
  localStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(() => null),
  },
  sessionStorage: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(() => null),
  },
};

// Setup global mocks - call this in test setup
export function setupGlobalMocks() {
  // Mock crypto for jsdom environment
  if (!global.crypto) {
    global.crypto = mockWebAPIs.crypto as any;
  }
  if (!global.crypto.randomUUID) {
    global.crypto.randomUUID = mockWebAPIs.crypto.randomUUID;
  }

  // Mock localStorage
  Object.defineProperty(window, 'localStorage', {
    value: mockWebAPIs.localStorage,
    writable: true,
  });

  // Mock server-only module
  vi.mock('server-only', () => ({}));
}

// Enhanced test utilities with better organization
export const testUtils = {
  // Time utilities
  sleep: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),

  // Console mocking
  mockConsole: () => {
    const originalConsole = console;
    const mockConsole = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
      table: vi.fn(),
      trace: vi.fn(),
      time: vi.fn(),
      timeEnd: vi.fn(),
    };

    const setup = () => {
      global.console = mockConsole as any;
    };

    const restore = () => {
      global.console = originalConsole;
    };

    return { mockConsole, setup, restore };
  },

  // Environment utilities
  mockEnvVar: (key: string, value: string) => {
    const originalValue = process.env[key];
    process.env[key] = value;
    return () => {
      if (originalValue === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originalValue;
      }
    };
  },

  // Test data generators
  generateTestId: (prefix = 'test') =>
    `${prefix}-${Math.random().toString(36).substring(7)}`,
  generateTestEmail: (domain = 'example.com') =>
    `test-${Math.random().toString(36).substring(7)}@${domain}`,
  generateTestTimestamp: (offsetMs = 0) =>
    new Date(Date.now() + offsetMs).toISOString(),

  // Async utilities
  waitFor: async (
    condition: () => boolean | Promise<boolean>,
    timeout = 5000,
    interval = 100,
  ) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await condition()) return true;
      await testUtils.sleep(interval);
    }
    throw new Error(`Condition not met within ${timeout}ms`);
  },

  // Mock cleanup utilities
  clearAllMocks: () => {
    vi.clearAllMocks();
  },

  resetAllMocks: () => {
    vi.resetAllMocks();
  },

  // Error simulation
  createNetworkError: (message = 'Network error') => {
    const error = new Error(message) as Error & { code?: string };
    error.code = 'NETWORK_ERROR';
    return error;
  },

  createTimeoutError: (message = 'Request timeout') => {
    const error = new Error(message) as Error & { code?: string };
    error.code = 'TIMEOUT';
    return error;
  },
};

// Mock configuration presets for different test scenarios
export const mockPresets = {
  // Basic unit test setup
  unit: () => {
    setupGlobalMocks();
    return {
      ai: mockAICore,
      auth: mockNextAuth,
      database: mockDatabase,
    };
  },

  // Integration test setup
  integration: () => {
    setupGlobalMocks();
    global.fetch = mockWebAPIs.fetch;
    return {
      ai: mockAICore,
      auth: mockNextAuth,
      database: mockDatabase,
      vectorStore: mockVectorStore,
      redis: mockRedis,
      blob: mockBlob,
    };
  },

  // E2E test setup (minimal mocking)
  e2e: () => {
    // Only mock external services that can't be controlled
    return {
      blob: mockBlob,
    };
  },
};

// Centralized mock registry for easy access
export const mockRegistry = {
  providers: {
    openai: mockOpenAI,
    anthropic: mockAnthropic,
    google: mockGoogle,
    cohere: mockCohere,
    groq: mockGroq,
  },
  services: {
    ai: mockAICore,
    auth: mockNextAuth,
    database: mockDatabase,
    vectorStore: mockVectorStore,
    redis: mockRedis,
    blob: mockBlob,
  },
  apis: mockWebAPIs,
  utils: testUtils,
  presets: mockPresets,
};

export default mockRegistry;
