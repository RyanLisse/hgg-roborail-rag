import { vi } from 'vitest';

/**
 * Mock factory utilities for consistent test data generation
 * These factories provide reusable, type-safe mock objects for testing
 */

// Types for mock data
export interface MockUser {
  id: string;
  name: string;
  email: string;
  type: 'free' | 'pro' | 'premium';
  createdAt?: string;
  updatedAt?: string;
}

export interface MockMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  parts?: Array<{ type: string; text: string }>;
  createdAt: string;
  timestamp?: string;
}

export interface MockSession {
  data: {
    user: MockUser;
    expires: string;
  };
  status: 'authenticated' | 'unauthenticated' | 'loading';
}

export interface MockVectorSearchResult {
  id: string;
  content: string;
  metadata: Record<string, any>;
  score: number;
  embedding?: number[];
}

export interface MockAPIResponse {
  ok: boolean;
  status: number;
  statusText: string;
  json: () => Promise<any>;
  text: () => Promise<string>;
  blob: () => Promise<Blob>;
}

// User Factory
export const createMockUser = (
  overrides: Partial<MockUser> = {},
): MockUser => ({
  id: `user-${Math.random().toString(36).substring(7)}`,
  name: 'Test User',
  email: 'test@example.com',
  type: 'free',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

// Session Factory
export const createMockSession = (
  userOverrides: Partial<MockUser> = {},
): MockSession => ({
  data: {
    user: createMockUser(userOverrides),
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
  },
  status: 'authenticated',
});

// Message Factory
export const createMockMessage = (
  overrides: Partial<MockMessage> = {},
): MockMessage => {
  const id = `msg-${Math.random().toString(36).substring(7)}`;
  const content = overrides.content || 'Test message content';

  return {
    id,
    role: 'user',
    content,
    parts: [{ type: 'text', text: content }],
    createdAt: new Date().toISOString(),
    timestamp: new Date().toISOString(),
    ...overrides,
  };
};

// Vector Search Result Factory
export const createMockVectorSearchResult = (
  overrides: Partial<MockVectorSearchResult> = {},
): MockVectorSearchResult => ({
  id: `doc-${Math.random().toString(36).substring(7)}`,
  content: 'Test document content for vector search',
  metadata: {
    source: 'test-document.pdf',
    page: 1,
    type: 'document',
    ...overrides.metadata,
  },
  score: 0.85,
  embedding: Array.from({ length: 1536 }, () => Math.random()),
  ...overrides,
});

// API Response Factory
export const createMockAPIResponse = (
  data: any = {},
  options: Partial<{ status: number; ok: boolean; statusText: string }> = {},
): MockAPIResponse => {
  const status = options.status ?? 200;
  const ok = options.ok ?? (status >= 200 && status < 300);
  const statusText = options.statusText ?? (ok ? 'OK' : 'Error');

  return {
    ok,
    status,
    statusText,
    json: vi.fn().mockResolvedValue(data),
    text: vi
      .fn()
      .mockResolvedValue(
        typeof data === 'string' ? data : JSON.stringify(data),
      ),
    blob: vi
      .fn()
      .mockResolvedValue(
        new Blob([JSON.stringify(data)], { type: 'application/json' }),
      ),
  };
};

// Chat Conversation Factory
export const createMockChatConversation = (messageCount: number = 3) => {
  const chatId = `chat-${Math.random().toString(36).substring(7)}`;
  const messages: MockMessage[] = [];

  for (let i = 0; i < messageCount; i++) {
    const isUser = i % 2 === 0;
    messages.push(
      createMockMessage({
        role: isUser ? 'user' : 'assistant',
        content: isUser
          ? `User message ${i + 1}`
          : `Assistant response ${i + 1}`,
      }),
    );
  }

  return {
    id: chatId,
    messages,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
};

// Database Query Result Factory
export const createMockDatabaseResult = (
  rows: any[] = [],
  options: { insertId?: number; affectedRows?: number } = {},
) => ({
  rows,
  insertId: options.insertId,
  affectedRows: options.affectedRows,
  rowCount: rows.length,
});

// Error Factory
export const createMockError = (
  message: string = 'Test error',
  options: Partial<{ code: string; status: number; cause?: Error }> = {},
): Error & { code?: string; status?: number; cause?: Error } => {
  const error = new Error(message) as Error & {
    code?: string;
    status?: number;
    cause?: Error;
  };

  if (options.code) error.code = options.code;
  if (options.status) error.status = options.status;
  if (options.cause) error.cause = options.cause;

  return error;
};

// Performance Metrics Factory
export const createMockPerformanceMetrics = (overrides: Partial<any> = {}) => ({
  provider: 'openai',
  timeWindow: '24h',
  totalRequests: 1000 + Math.floor(Math.random() * 5000),
  successRate: 0.95 + Math.random() * 0.05,
  averageLatency: 200 + Math.random() * 300,
  p95Latency: 400 + Math.random() * 600,
  p99Latency: 800 + Math.random() * 1200,
  errorRate: 0.01 + Math.random() * 0.04,
  tokensUsed: 30000 + Math.floor(Math.random() * 50000),
  lastUpdated: new Date().toISOString(),
  ...overrides,
});

// Health Status Factory
export const createMockHealthStatus = (overrides: Partial<any> = {}) => ({
  provider: 'openai',
  isHealthy: true,
  latency: 100 + Math.random() * 200,
  lastChecked: new Date().toISOString(),
  vectorStoreStatus: 'Connected',
  errorMessage: null,
  ...overrides,
});

// Embedding Factory
export const createMockEmbedding = (dimensions: number = 1536) => ({
  embedding: Array.from({ length: dimensions }, () => Math.random() * 2 - 1), // Range -1 to 1
  model: 'text-embedding-ada-002',
  usage: {
    promptTokens: Math.floor(Math.random() * 100) + 10,
    totalTokens: Math.floor(Math.random() * 100) + 10,
  },
});

// AI Generation Response Factory
export const createMockAIResponse = (overrides: Partial<any> = {}) => ({
  text: 'This is a mocked AI response for testing purposes.',
  usage: {
    promptTokens: 100 + Math.floor(Math.random() * 50),
    completionTokens: 50 + Math.floor(Math.random() * 100),
    totalTokens: 150 + Math.floor(Math.random() * 150),
  },
  finishReason: 'stop',
  model: 'gpt-3.5-turbo',
  ...overrides,
});

// Stream Response Factory
export const createMockStreamResponse = function* (
  chunks: string[] = ['Hello', ' world', '!'],
) {
  for (const chunk of chunks) {
    yield {
      type: 'text-delta' as const,
      textDelta: chunk,
    };
  }

  yield {
    type: 'finish' as const,
    finishReason: 'stop' as const,
    usage: {
      promptTokens: 10,
      completionTokens: 3,
      totalTokens: 13,
    },
  };
};

// Batch Factory - Create multiple instances at once
export const createMockBatch = <T>(
  factory: (overrides?: any) => T,
  count: number,
  overridesArray: any[] = [],
): T[] => {
  return Array.from({ length: count }, (_, index) =>
    factory(overridesArray[index] || {}),
  );
};

// Time-based Factory - Create mocks with specific timestamps
export const createMockWithTimestamp = <
  T extends { createdAt?: string; updatedAt?: string },
>(
  factory: (overrides?: any) => T,
  baseTime: Date = new Date(),
  offsetMinutes: number = 0,
): T => {
  const timestamp = new Date(
    baseTime.getTime() + offsetMinutes * 60 * 1000,
  ).toISOString();
  return factory({
    createdAt: timestamp,
    updatedAt: timestamp,
  });
};

// Export all factories as a default object for easy importing
export default {
  createMockUser,
  createMockSession,
  createMockMessage,
  createMockVectorSearchResult,
  createMockAPIResponse,
  createMockChatConversation,
  createMockDatabaseResult,
  createMockError,
  createMockPerformanceMetrics,
  createMockHealthStatus,
  createMockEmbedding,
  createMockAIResponse,
  createMockStreamResponse,
  createMockBatch,
  createMockWithTimestamp,
};
