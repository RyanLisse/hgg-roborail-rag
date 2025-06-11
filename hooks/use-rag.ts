'use client';

import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { createRAGService, type RAGQuery, type RAGResponse } from '@/lib/rag/rag';
import { nanoid } from 'nanoid';

// Schemas
const DocumentMetadata = z.object({
  name: z.string(),
  size: z.number(),
  type: z.string(),
  uploadedAt: z.date(),
  title: z.string().optional(),
  source: z.string().optional(),
});

const DocumentUpload = z.object({
  file: z.instanceof(File),
  metadata: DocumentMetadata,
});

const StoredDocument = z.object({
  id: z.string(),
  name: z.string(),
  size: z.number(),
  uploadedAt: z.date(),
  status: z.enum(['uploading', 'processing', 'processed', 'error']),
  content: z.string().optional(),
  error: z.string().optional(),
});

// Types
type DocumentUpload = z.infer<typeof DocumentUpload>;
type StoredDocument = z.infer<typeof StoredDocument>;

// Supported file types
const SUPPORTED_FILE_TYPES = [
  'text/plain',
  'text/markdown',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

// RAG service instance (singleton)
let ragService: ReturnType<typeof createRAGService> | null = null;

function getRagService() {
  if (!ragService) {
    ragService = createRAGService({
      vectorStore: 'memory',
      embeddingModel: 'openai-text-embedding-3-small',
      chatModel: 'openai-gpt-4.1',
    });
  }
  return ragService;
}

// File processing utilities
async function extractTextFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = () => {
      const result = reader.result as string;
      
      // For now, just handle text files directly
      // In a real app, you'd use libraries for PDF, DOCX, etc.
      if (file.type === 'text/plain' || file.type === 'text/markdown') {
        resolve(result);
      } else {
        resolve(result); // Fallback for other types
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

function validateFileType(file: File): void {
  if (!SUPPORTED_FILE_TYPES.includes(file.type as any)) {
    throw new Error(
      `Unsupported file type: ${file.type}. Supported types: ${SUPPORTED_FILE_TYPES.join(', ')}`
    );
  }
}

function validateFileSize(file: File, maxSizeMB = 10): void {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    throw new Error(`File size exceeds ${maxSizeMB}MB limit`);
  }
}

// Local storage utilities
const STORAGE_KEY = 'rag-documents';

function getStoredDocuments(): StoredDocument[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    
    const parsed = JSON.parse(stored);
    return parsed.map((doc: any) => ({
      ...doc,
      uploadedAt: new Date(doc.uploadedAt),
    }));
  } catch {
    return [];
  }
}

function saveDocuments(documents: StoredDocument[]): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
  } catch (error) {
    console.error('Failed to save documents to localStorage:', error);
  }
}

export function useRAG() {
  const [response, setResponse] = useState<RAGResponse | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const queryClient = useQueryClient();

  // Get stored documents
  const { data: documents = [] } = useQuery<StoredDocument[]>({
    queryKey: ['rag-documents'],
    queryFn: getStoredDocuments,
    staleTime: Number.POSITIVE_INFINITY,
  });

  // Document upload mutation
  const { mutate: addDocument, isPending: isUploadingDocument } = useMutation({
    mutationFn: async (uploadData: DocumentUpload): Promise<StoredDocument> => {
      const { file, metadata } = DocumentUpload.parse(uploadData);
      
      // Validate file
      validateFileType(file);
      validateFileSize(file);

      const documentId = nanoid();
      const newDocument: StoredDocument = {
        id: documentId,
        name: metadata.name,
        size: metadata.size,
        uploadedAt: metadata.uploadedAt,
        status: 'uploading',
      };

      // Update documents list immediately
      const currentDocs = queryClient.getQueryData<StoredDocument[]>(['rag-documents']) || [];
      const updatedDocs = [...currentDocs, newDocument];
      queryClient.setQueryData(['rag-documents'], updatedDocs);
      saveDocuments(updatedDocs);

      try {
        // Extract text content
        newDocument.status = 'processing';
        queryClient.setQueryData(['rag-documents'], 
          updatedDocs.map(doc => doc.id === documentId ? newDocument : doc)
        );

        const content = await extractTextFromFile(file);
        newDocument.content = content;

        // Embed document in RAG service
        const ragService = getRagService();
        await ragService.embedDocument({
          id: documentId,
          content,
          metadata: {
            title: metadata.title || metadata.name,
            source: metadata.source || 'upload',
            name: metadata.name,
            size: metadata.size,
            type: metadata.type,
          },
        });

        newDocument.status = 'processed';
        const finalDocs = updatedDocs.map(doc => 
          doc.id === documentId ? newDocument : doc
        );
        
        queryClient.setQueryData(['rag-documents'], finalDocs);
        saveDocuments(finalDocs);

        return newDocument;
      } catch (error) {
        newDocument.status = 'error';
        newDocument.error = error instanceof Error ? error.message : 'Unknown error';
        
        const errorDocs = updatedDocs.map(doc => 
          doc.id === documentId ? newDocument : doc
        );
        
        queryClient.setQueryData(['rag-documents'], errorDocs);
        saveDocuments(errorDocs);
        
        throw error;
      }
    },
  });

  // Document removal mutation
  const { mutate: removeDocument } = useMutation({
    mutationFn: async (documentId: string): Promise<void> => {
      const currentDocs = queryClient.getQueryData<StoredDocument[]>(['rag-documents']) || [];
      const filteredDocs = currentDocs.filter(doc => doc.id !== documentId);
      
      queryClient.setQueryData(['rag-documents'], filteredDocs);
      saveDocuments(filteredDocs);

      // TODO: Remove from vector store
      // ragService.removeDocument(documentId);
    },
  });

  // RAG query mutation
  const { mutate: executeQuery, isPending: isQuerying } = useMutation({
    mutationFn: async (query: RAGQuery): Promise<RAGResponse> => {
      const ragService = getRagService();
      const result = await ragService.generateResponse(query);
      setResponse(result);
      setError(null);
      return result;
    },
    onError: (error: Error) => {
      setError(error);
      setResponse(null);
    },
  });

  // Wrap query function to return a promise
  const query = useCallback(async (queryData: RAGQuery): Promise<RAGResponse> => {
    return new Promise((resolve, reject) => {
      executeQuery(queryData, {
        onSuccess: resolve,
        onError: reject,
      });
    });
  }, [executeQuery]);

  return {
    // State
    documents,
    response,
    error,
    isLoading: isQuerying || isUploadingDocument,

    // Actions
    query,
    addDocument,
    removeDocument,

    // Loading states
    isQuerying,
    isUploadingDocument,
  };
}