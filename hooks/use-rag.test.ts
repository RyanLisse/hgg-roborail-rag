import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClient, type QueryClientProvider } from '@tanstack/react-query';
import { useRAG } from './use-rag';
import type { ReactNode } from 'react';

// Mock the RAG service
vi.mock('@/lib/rag/rag', () => ({
  createRAGService: vi.fn(() => ({
    embedDocument: vi.fn().mockResolvedValue([]),
    generateResponse: vi.fn().mockResolvedValue({
      answer: 'Test response',
      sources: [],
      model: 'test-model',
    }),
  })),
}));

describe('useRAG Hook', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const wrapper = ({ children }: { children: ReactNode }) => {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  };

  it('should initialize with default state', () => {
    const { result } = renderHook(() => useRAG(), { wrapper });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.response).toBe(null);
    expect(result.current.error).toBe(null);
    expect(result.current.documents).toEqual([]);
    expect(typeof result.current.query).toBe('function');
    expect(typeof result.current.addDocument).toBe('function');
    expect(typeof result.current.removeDocument).toBe('function');
  });

  it('should handle document upload', async () => {
    const { result } = renderHook(() => useRAG(), { wrapper });

    const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const documentData = {
      file: mockFile,
      metadata: {
        name: 'test.txt',
        size: 1000,
        type: 'text/plain',
        uploadedAt: new Date(),
      },
    };

    await act(async () => {
      await result.current.addDocument(documentData);
    });

    await waitFor(() => {
      expect(result.current.documents.length).toBeGreaterThan(0);
    });
  });

  it('should handle document removal', async () => {
    const { result } = renderHook(() => useRAG(), { wrapper });

    // First add a document
    const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const documentData = {
      file: mockFile,
      metadata: {
        name: 'test.txt',
        size: 1000,
        type: 'text/plain',
        uploadedAt: new Date(),
      },
    };

    await act(async () => {
      await result.current.addDocument(documentData);
    });

    const documentId = result.current.documents[0]?.id;
    expect(documentId).toBeDefined();

    // Then remove it
    if (documentId) {
      await act(async () => {
        await result.current.removeDocument(documentId);
      });
    }

    await waitFor(() => {
      expect(result.current.documents.length).toBe(0);
    });
  });

  it('should handle RAG queries', async () => {
    const { result } = renderHook(() => useRAG(), { wrapper });

    const query = {
      question: 'What is React?',
      chatHistory: [],
      modelId: 'openai-gpt-4.1',
    };

    let response: any;
    await act(async () => {
      response = await result.current.query(query);
    });

    expect(response).toBeDefined();
    expect(response.answer).toBe('Test response');
    expect(result.current.response).toEqual(response);
  });

  it('should handle loading states during queries', async () => {
    const { result } = renderHook(() => useRAG(), { wrapper });

    const query = {
      question: 'What is React?',
      chatHistory: [],
      modelId: 'openai-gpt-4.1',
    };

    // Start the query
    const queryPromise = act(async () => {
      return result.current.query(query);
    });

    // Check loading state
    expect(result.current.isLoading).toBe(true);

    // Wait for completion
    await queryPromise;

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should handle errors during queries', async () => {
    // Mock the RAG service to throw an error
    vi.mocked(require('@/lib/rag/rag').createRAGService).mockReturnValue({
      embedDocument: vi.fn().mockResolvedValue([]),
      generateResponse: vi.fn().mockRejectedValue(new Error('Test error')),
    });

    const { result } = renderHook(() => useRAG(), { wrapper });

    const query = {
      question: 'What is React?',
      chatHistory: [],
      modelId: 'openai-gpt-4.1',
    };

    await act(async () => {
      try {
        await result.current.query(query);
      } catch (error) {
        // Expected to throw
      }
    });

    await waitFor(() => {
      expect(result.current.error).toBeDefined();
      expect(result.current.error?.message).toBe('Test error');
    });
  });

  it('should persist documents in local storage', async () => {
    const mockLocalStorage = {
      getItem: vi.fn().mockReturnValue(null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true,
    });

    const { result } = renderHook(() => useRAG(), { wrapper });

    const mockFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const documentData = {
      file: mockFile,
      metadata: {
        name: 'test.txt',
        size: 1000,
        type: 'text/plain',
        uploadedAt: new Date(),
      },
    };

    await act(async () => {
      await result.current.addDocument(documentData);
    });

    await waitFor(() => {
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'rag-documents',
        expect.any(String)
      );
    });
  });

  it('should validate document file types', async () => {
    const { result } = renderHook(() => useRAG(), { wrapper });

    const invalidFile = new File(['test content'], 'test.exe', { type: 'application/exe' });
    const documentData = {
      file: invalidFile,
      metadata: {
        name: 'test.exe',
        size: 1000,
        type: 'application/exe',
        uploadedAt: new Date(),
      },
    };

    await act(async () => {
      try {
        await result.current.addDocument(documentData);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain('file type');
      }
    });
  });

  it('should handle concurrent document uploads', async () => {
    const { result } = renderHook(() => useRAG(), { wrapper });

    const files = [
      new File(['content 1'], 'test1.txt', { type: 'text/plain' }),
      new File(['content 2'], 'test2.txt', { type: 'text/plain' }),
      new File(['content 3'], 'test3.txt', { type: 'text/plain' }),
    ];

    const uploadPromises = files.map(file => 
      result.current.addDocument({
        file,
        metadata: {
          name: file.name,
          size: file.size,
          type: file.type,
          uploadedAt: new Date(),
        },
      })
    );

    await act(async () => {
      await Promise.all(uploadPromises);
    });

    await waitFor(() => {
      expect(result.current.documents.length).toBe(3);
    });
  });
});