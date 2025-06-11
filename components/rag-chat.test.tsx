import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RAGChat } from './rag-chat';

// Mock the RAG hook
vi.mock('@/hooks/use-rag', () => ({
  useRAG: vi.fn(() => ({
    query: vi.fn(),
    isLoading: false,
    response: null,
    error: null,
    documents: [],
    addDocument: vi.fn(),
    removeDocument: vi.fn(),
  })),
}));

describe('RAGChat Component', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const renderWithQueryClient = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  it('should render RAG chat interface', () => {
    renderWithQueryClient(<RAGChat />);
    
    expect(screen.getByPlaceholderText(/ask a question/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send/i })).toBeInTheDocument();
  });

  it('should display document upload area', () => {
    renderWithQueryClient(<RAGChat />);
    
    expect(screen.getByText(/upload documents/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /browse files/i })).toBeInTheDocument();
  });

  it('should handle question submission', async () => {
    const mockQuery = vi.fn();
    vi.mocked(require('@/hooks/use-rag').useRAG).mockReturnValue({
      query: mockQuery,
      isLoading: false,
      response: null,
      error: null,
      documents: [],
      addDocument: vi.fn(),
      removeDocument: vi.fn(),
    });

    renderWithQueryClient(<RAGChat />);
    
    const input = screen.getByPlaceholderText(/ask a question/i);
    const submitButton = screen.getByRole('button', { name: /send/i });

    fireEvent.change(input, { target: { value: 'What is React?' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockQuery).toHaveBeenCalledWith({
        question: 'What is React?',
        chatHistory: [],
        modelId: expect.any(String),
      });
    });
  });

  it('should display loading state', () => {
    vi.mocked(require('@/hooks/use-rag').useRAG).mockReturnValue({
      query: vi.fn(),
      isLoading: true,
      response: null,
      error: null,
      documents: [],
      addDocument: vi.fn(),
      removeDocument: vi.fn(),
    });

    renderWithQueryClient(<RAGChat />);
    
    expect(screen.getByText(/generating response/i)).toBeInTheDocument();
  });

  it('should display response with sources', () => {
    const mockResponse = {
      answer: 'React is a JavaScript library for building user interfaces.',
      sources: [
        {
          documentId: 'doc-1',
          content: 'React documentation content...',
          score: 0.95,
          metadata: { title: 'React Docs' },
        },
      ],
      model: 'openai-gpt-4.1',
    };

    vi.mocked(require('@/hooks/use-rag').useRAG).mockReturnValue({
      query: vi.fn(),
      isLoading: false,
      response: mockResponse,
      error: null,
      documents: [],
      addDocument: vi.fn(),
      removeDocument: vi.fn(),
    });

    renderWithQueryClient(<RAGChat />);
    
    expect(screen.getByText(mockResponse.answer)).toBeInTheDocument();
    expect(screen.getByText(/sources/i)).toBeInTheDocument();
    expect(screen.getByText('React Docs')).toBeInTheDocument();
  });

  it('should handle document upload', async () => {
    const mockAddDocument = vi.fn();
    vi.mocked(require('@/hooks/use-rag').useRAG).mockReturnValue({
      query: vi.fn(),
      isLoading: false,
      response: null,
      error: null,
      documents: [],
      addDocument: mockAddDocument,
      removeDocument: vi.fn(),
    });

    renderWithQueryClient(<RAGChat />);
    
    const fileInput = screen.getByLabelText(/upload documents/i);
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });

    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockAddDocument).toHaveBeenCalledWith(expect.objectContaining({
        file,
        metadata: expect.any(Object),
      }));
    });
  });

  it('should display uploaded documents list', () => {
    const mockDocuments = [
      {
        id: 'doc-1',
        name: 'React Guide.pdf',
        size: 1024,
        uploadedAt: new Date(),
        status: 'processed' as const,
      },
      {
        id: 'doc-2',
        name: 'TypeScript Handbook.md',
        size: 2048,
        uploadedAt: new Date(),
        status: 'processing' as const,
      },
    ];

    vi.mocked(require('@/hooks/use-rag').useRAG).mockReturnValue({
      query: vi.fn(),
      isLoading: false,
      response: null,
      error: null,
      documents: mockDocuments,
      addDocument: vi.fn(),
      removeDocument: vi.fn(),
    });

    renderWithQueryClient(<RAGChat />);
    
    expect(screen.getByText('React Guide.pdf')).toBeInTheDocument();
    expect(screen.getByText('TypeScript Handbook.md')).toBeInTheDocument();
    expect(screen.getByText(/processing/i)).toBeInTheDocument();
  });

  it('should handle document removal', async () => {
    const mockRemoveDocument = vi.fn();
    const mockDocuments = [
      {
        id: 'doc-1',
        name: 'Test Document.pdf',
        size: 1024,
        uploadedAt: new Date(),
        status: 'processed' as const,
      },
    ];

    vi.mocked(require('@/hooks/use-rag').useRAG).mockReturnValue({
      query: vi.fn(),
      isLoading: false,
      response: null,
      error: null,
      documents: mockDocuments,
      addDocument: vi.fn(),
      removeDocument: mockRemoveDocument,
    });

    renderWithQueryClient(<RAGChat />);
    
    const removeButton = screen.getByRole('button', { name: /remove document/i });
    fireEvent.click(removeButton);

    await waitFor(() => {
      expect(mockRemoveDocument).toHaveBeenCalledWith('doc-1');
    });
  });
});